# 架构

## 总览

```
devhub/                        pnpm monorepo
├── apps/desktop/              Electron 桌面客户端
│   ├── e2e/                   Playwright E2E：驱动构建产物，每个测试独立 userData（ADR 0001 补充）
│   └── src/
│       ├── main/              主进程（Node）
│       │   ├── index.ts       应用生命周期：单实例、托盘、窗口
│       │   ├── window.ts      主窗口（关闭 = 隐藏到托盘）
│       │   ├── tray.ts        托盘菜单
│       │   ├── ipc.ts         把 DevhubApi 自动映射为 IPC 通道；ShellApi 处理器
│       │   └── core/          ★ 业务核心，不依赖 Electron
│       │       ├── devhub-core.ts   组装各服务，实现 DevhubApi
│       │       ├── storage/         通用 JSON 存储（见 ADR 0002）
│       │       ├── projects/        项目注册与持久化
│       │       ├── detectors/       脚本探测器：每种项目类型一个文件
│       │       ├── scripts/         按项目扫描脚本（listScripts）
│       │       ├── process/         进程管理：PTY、杀进程树、RunManager、输出缓冲（ADR 0003）
│       │       ├── events/          事件总线：把 core 事件分发给各传输层（ADR 0004）
│       │       ├── editors/         检测并启动外部编辑器（VS Code / IDEA）
│       │       ├── shells/          检测可用的交互式 shell，Git Bash 启动文件（ADR 0005）
│       │       ├── groups/          批量执行：任务存储、继续条件、执行器（ADR 0006）
│       │       ├── settings/        核心设置（settings.json）（ADR 0007）
│       │       ├── ports/           推断脚本端口、查找占用进程、启动前冲突检测
│       │       ├── net/             本地端口连通性检测
│       │       └── fs/              文件系统小工具；finder.ts：按候选位置查找已安装程序
│       ├── preload/           暴露 window.devhub（DevhubApi）、window.devhubEvents（事件订阅）与 window.devhubShell（ShellApi）
│       └── renderer/src/      React UI
│           ├── api/           ★ UI 访问核心的唯一入口
│           ├── features/<x>/  按功能组织：组件 + hooks（projects、scripts、terminal）
│           ├── components/ui/ shadcn 生成的组件（由 CLI 管理，不手改）
│           └── lib/           工具函数
└── packages/shared/           平台无关：API 契约、领域模型（zod schema）、错误类型
```

## 核心原则：API 契约 + 可替换传输层

```
React UI ──> @renderer/api ──> DevhubApi (packages/shared)
                                   │
              桌面: preload ─IPC─> ipc.ts ─┐
              远程(M4): HTTP/WS client ──> http server ─┤
                                                         └─> core (createDevhubCore)
```

- `DevhubApi`（`packages/shared/src/api.ts`）是 UI 与核心之间唯一的契约；所有方法返回 Promise。
- `core/` 实现该契约，与传输方式无关，依赖通过参数注入，因此可直接单元测试。
- IPC 层和 preload 根据 `devhubApiMethods` 自动生成，新增方法无需手写通道。
- 将来的手机端 / PWA 只需实现一个基于 HTTP 的 `DevhubApi` 客户端，UI 代码可复用。

这些边界由 ESLint 强制（见根目录 `eslint.config.mjs`）。

### 错误处理

- 预期内的失败在 core 中抛出 `DevhubError(code, message)`（`packages/shared/src/errors.ts`）；`message` 面向用户，直接显示在 UI。
- IPC 上传输 `IpcResult` 信封 `{ ok, value | error }`，preload 解包后在 renderer 抛出干净的 `Error`（避免 Electron 给错误信息加前缀）。
- 非预期异常在主进程记录日志，以 `INTERNAL` 返回。

### ShellApi：仅桌面端可用的能力

原生对话框、用系统浏览器打开链接等只在本机有意义的能力放在 `ShellApi`（`window.devhubShell`），不进入 `DevhubApi`。
UI 通过 `@renderer/api` 的 `shell` 访问；远程客户端中它为 `null`，UI 需据此隐藏相关入口。
ShellApi 的通道在 `shellChannel` 中手动定义（数量少，不走自动映射）。

## 领域模型（`packages/shared/src/domain.ts`）

| 概念           | 说明                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| Project        | 一个被管理的代码目录（已实现，存于 `projects.json`）                                      |
| Script         | 可运行命令，来源：npm / maven / gradle / custom                                           |
| ProjectScripts | 扫描结果：`status`（ok/missing）、脚本、探测器警告                                        |
| Group          | 批量任务：跨项目的脚本列表，并行或串行（带继续条件）；存于 `groups.json`                  |
| Run            | 终端标签里的一个进程：`script`（识别出的脚本）或 `shell`（交互式终端）；状态、PID、退出码 |
| `.devhub.yaml` | 项目内可选配置：自定义脚本（ADR 0008），由 `detectors/config-detector.ts` 读取            |

## 脚本探测

- `ScriptDetector { source, detect(dir) }`（`core/detectors/types.ts`）：不适用返回 `[]`；构建文件损坏时抛出面向用户的 `Error`。
- 新增项目类型 = 新增一个探测器文件，并加入 `detect-scripts.ts` 的 `createDefaultDetectors(platform)`。
- 需要平台信息的探测器（如选择 `mvnw` / `mvnw.cmd`）用工厂函数注入 `platform`，以便在任一系统上测试两个平台。
- 读取构建文件、判断文件存在的公共逻辑在 `detectors/fs-utils.ts`。
- `detectScripts` 并行执行所有探测器，失败的探测器转为 `warnings`，不影响其他结果。
- 脚本 id 形如 `<source>:<name>`，重新扫描保持稳定，供进程管理关联运行状态。
- 不缓存：每次 `listScripts` 都读磁盘。

## 进程管理（`core/process/`，见 ADR 0003）

- `pty.ts`：`PtySpawner` 接口 + node-pty 实现；命令经平台 shell 执行。
- `process-killer.ts`：两阶段停止。Windows：Ctrl+C → `taskkill /T /F`；Linux：进程组 SIGTERM → SIGKILL。
- `run-manager.ts`：脚本每个只保留最新一次运行；交互式 shell 每个项目可多个（ADR 0005）；输出缓冲（最近 512 KB）；`dispose()` 停止全部运行。
- 停止：脚本先 `interrupt`（Ctrl+C / SIGTERM），shell 用 `hangup`（SIGHUP / `taskkill /T`）；超时后 `forceKill`，Linux 上同时扫描整个会话。
- `batch-prompt.ts`：Windows 停止脚本时自动回答 cmd 的「终止批处理操作吗(Y/N)?」。
- `run-registry.ts` + `process-identity.ts`：把运行的 pid 与进程启动时间记入 `runs.json`，崩溃后下次启动发现仍存活的进程并提示用户处理。
- `createDevhubCore` 返回 `DevhubCore`（`DevhubApi` + `dispose`）；主进程在 `before-quit` 中等待 `dispose()`（最多 10 秒）。
- renderer 只传 id，命令由 core 重新扫描得到。

## 用编辑器打开项目（`core/editors/`）

- `editor-locator.ts`：按平台列出候选位置（PATH、注册表、Toolbox、默认安装目录），第一个存在的胜出；文件系统 / 注册表经参数注入，路径用 `path.win32` / `path.posix`，两个平台的查找逻辑在任何系统上都可测试。
- `editor-launch.ts`：可执行文件直接启动（不经 shell）；Windows 的 `.cmd` 启动脚本经 `cmd /d /s /c` 并加引号。以 detached 独立进程启动，不进入 RunManager。去掉 `ELECTRON_RUN_AS_NODE`，否则 VS Code（同为 Electron）会以 Node 模式启动。
- 放在 `DevhubApi`（`listEditors` / `openInEditor`）而不是 ShellApi：启动进程不需要 Electron，逻辑可测试；renderer 只传项目 id 与编辑器 id，路径由 core 查出。

## 事件推送（见 ADR 0004）

- `DevhubEvents.subscribe` 独立于 `DevhubApi`：请求-响应走自动映射的 IPC，推送走 `devhubEventChannel`（主进程 `webContents.send` → preload → `@renderer/api` 的 `events`）。远程端将改用 WebSocket。
- 事件：`run-updated`、`run-removed`、`run-output`（带流偏移量）、`group-updated`（批量任务进度）、`settings-updated`。
- 设置分两处（ADR 0007）：影响 core 行为的存 `settings.json`；纯显示偏好（主题、终端字号等）存 renderer 的 localStorage（`lib/appearance.ts`、`terminal-prefs.ts`）。renderer 用事件直接更新 TanStack Query 缓存（`useRunEventsSync`，在 App 挂载一次）。
- 终端：先订阅再取 `getRunOutput` 快照，用 shared 的 `OutputCursor` 去重拼接；core 中输出按 16 ms 合并后推送。
- renderer 的 `terminal-sessions.ts` 为每个运行保留一个 xterm 实例（切换标签只移动 DOM 节点，关闭标签时释放）；只有可见终端使用 WebGL。快捷键在 `terminal-keys.ts`，外观偏好（主题、字号、渲染方式）在 `terminal-prefs.ts`。

## 安全

- renderer 运行在 sandbox + contextIsolation 下，只能访问 `window.devhub` 与 `window.devhubShell`。
- 来自 renderer 的参数一律视为不可信，在 core 中用 zod 校验。
- 交给系统打开的 URL（ShellApi `openExternal`、`setWindowOpenHandler`）统一经 `core/shell/external-url.ts` 校验，只允许 http / https：链接可能来自不可信的进程输出。
- 远程 API 默认关闭；开启时必须 Token 鉴权。
