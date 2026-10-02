# 架构

## 总览

```
devhub/                        pnpm monorepo
├── apps/desktop/              Electron 桌面客户端
│   └── src/
│       ├── main/              主进程（Node）
│       │   ├── index.ts       应用生命周期：单实例、托盘、窗口
│       │   ├── window.ts      主窗口（关闭 = 隐藏到托盘）
│       │   ├── tray.ts        托盘菜单
│       │   ├── ipc.ts         把 DevhubApi 自动映射为 IPC 通道
│       │   └── core/          ★ 业务核心，不依赖 Electron
│       ├── preload/           把 DevhubApi 以 window.devhub 暴露给 UI（sandbox）
│       └── renderer/src/      React UI
│           ├── api/           ★ UI 访问核心的唯一入口
│           ├── features/<x>/  按功能组织：组件 + hooks
│           ├── components/    通用 UI 组件（shadcn/ui）
│           └── lib/           工具函数
└── packages/shared/           平台无关：API 契约、领域模型（zod schema）
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

## 领域模型（`packages/shared/src/domain.ts`）

| 概念           | 说明                                            |
| -------------- | ----------------------------------------------- |
| Project        | 一个被管理的代码目录                            |
| Script         | 可运行命令，来源：npm / maven / gradle / custom |
| Profile        | 一组环境变量与参数覆盖，用于切换对接的后端      |
| Run（M1）      | 一次运行：状态、PID、日志                       |
| `.devhub.yaml` | 项目内可选配置：自定义脚本 + Profile            |

## 规划中的模块（M1）

- `core/detectors/`：每种项目类型一个探测器，实现统一接口；新增类型 = 新增一个文件。
- `core/process/`：进程管理。Windows 用进程树终止（taskkill /T 或 Job Object），Linux 用进程组；PTY 采用 `node-pty`。
- 事件推送（日志、状态变化）：契约中以订阅接口表达，IPC 用 `webContents.send`，远程用 WebSocket。

## 安全

- renderer 运行在 sandbox + contextIsolation 下，只能访问 `window.devhub`。
- 远程 API 默认关闭；开启时必须 Token 鉴权。
