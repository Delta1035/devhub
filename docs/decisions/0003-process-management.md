# 0003 进程管理：node-pty + 两阶段杀进程树

- 状态：已采纳
- 日期：2026-10-02

## 背景

DevHub 要启动项目脚本（`pnpm run dev`、`mvnw spring-boot:run` 等），保留带颜色的输出，并且停止时不能留下孤儿进程。
目标平台 Windows / Ubuntu；core 不能依赖 Electron（将来通过 HTTP 提供给手机端）。

## 决策

### 使用 node-pty 1.1.0（官方包）运行脚本

- 在伪终端中运行，子进程认为自己连着终端：保留 ANSI 颜色、进度条；将来可直接接入 xterm.js 并支持交互输入。
- 1.1.0 基于 N-API：ABI 稳定，同一个二进制在 Node（vitest）和 Electron 中都能加载，不需要针对 Electron 重新编译（`npmRebuild: false`）。
- Windows 自带预编译文件（含 ConPTY）；Linux 安装时用 node-gyp 编译（需要 `build-essential`、`python3`）。
- 需要在 `pnpm-workspace.yaml` 的 `allowBuilds` 中允许 `node-pty`；作为主进程运行时依赖放在 desktop 的 `dependencies`。
- 命令经平台 shell 执行：Windows `cmd.exe /d /s /c "<command>"`（参数以字符串传入，避免 node-pty 用反斜杠转义内部引号）；Linux `$SHELL -lc <command>`（登录 shell 补齐 nvm/sdkman 等 PATH）。

### 停止 = 先礼后兵，作用于整棵进程树

| 平台    | 第一阶段（优雅）             | 超时（默认 5 秒）后强制     |
| ------- | ---------------------------- | --------------------------- |
| Windows | 向 PTY 写入 Ctrl+C（`\x03`） | `taskkill /PID <pid> /T /F` |
| Linux   | 对进程组发 SIGTERM（`-pid`） | 对进程组发 SIGKILL          |

- node-pty 在 Linux 上让子进程成为会话首进程，pgid = pid，信号发给 `-pid` 覆盖整棵树。
- 强制后若仍未收到退出事件，再等一个超时并直接标记为已退出，避免状态卡在「停止中」。
- 退出 DevHub 时（`before-quit`）先停止所有运行，最多等 10 秒。
- 进程管理放在 `core/process/`，PTY 与杀进程逻辑通过参数注入：单元测试用假实现覆盖两个平台的分支，集成测试在当前平台用真实进程验证整棵树被清理（CI 矩阵覆盖 Windows 与 Ubuntu）。

### 安全

renderer 只传 `projectId` + `scriptId`，core 重新扫描并按 id 找到脚本后执行，不接受来自 UI 的命令字符串。

## 备选与理由

- `@lydell/node-pty`：各平台都有预编译包（Linux 免编译），但目前是 beta。等它发布正式版或 Linux 编译成为负担时再评估。
- `child_process.spawn` + 管道：无需原生模块，但子进程检测不到 TTY，多数工具会关闭颜色和交互；Windows 上 Ctrl+C 也无法送达。
- `tree-kill` 等库：逻辑只有几十行且需要按平台精细控制（两阶段、超时），自己实现更透明，不额外引入依赖。
- Windows Job Object：能保证 DevHub 崩溃时子进程也退出，但需要额外原生代码；暂不做，崩溃遗留进程记入已知问题。

## 补充（2026-10-02）：移除 desktop 的 `postinstall: electron-builder install-app-deps`

该脚本会调用 @electron/rebuild 从源码重新编译 node-pty，在 Windows 上编译 winpty 失败（`GetCommitHash.bat` 找不到），导致 `pnpm install` 整体失败、新依赖被回滚。
node-pty 是 N-API 模块，本来就不需要针对 Electron 重新编译，因此移除该脚本。以后若引入需要针对 Electron ABI 编译的原生模块，再重新评估。

## 补充（2026-10-02）：Windows 批处理提示自动应答

`npm` / `yarn` 在 Windows 上是 `.cmd`，Ctrl+C 后 cmd 会询问「终止批处理操作吗(Y/N)?」并等待，原先要等满 5 秒才强制结束。现在停止脚本时监视中断之后的新输出，出现以 `(Y/N)?` 结尾的提示（各语言版本都以它结尾，去掉 ANSI 控制码后匹配）就回答一次 `Y`（`process/batch-prompt.ts`）。只看中断之后的输出，程序自己之前打印的 `(Y/N)?` 不会被回答；只用于 Windows 的脚本，不用于交互式终端。实测 `npm run` 停止从 6 秒多降到 1 秒左右，集成测试覆盖（去掉应答后该测试失败）。

## 补充（2026-10-02）：崩溃后遗留进程

DevHub 正常退出时会停止所有运行；崩溃或被强制结束时来不及。现在：

- 运行启动时把 pid 与**进程启动时间**（Windows：`Get-Process` 的 StartTime；Linux：`/proc/<pid>/stat` 第 22 字段 + boot id）记入 `userData/runs.json`，结束时删除（`process/run-registry.ts`、`process-identity.ts`）。只比较 pid 会误伤被系统复用了同一 pid 的无关进程，因此必须 pid 与启动时间都一致才算遗留。
- 下次启动时，仍存活的旧记录在主区域顶部提示，由用户选择「全部结束」（`taskkill /T` / 杀进程组与会话，结束前再核对一次身份）或「忽略」。已不存在的记录直接丢弃。
- 实测哪些进程会遗留：Windows 上 DevHub 主进程消失后 ConPTY 关闭，cmd、node 等控制台程序会随之结束；**Git Bash 不会**，因此交互式终端是 Windows 上的主要遗留来源。Linux 上忽略 SIGHUP 的程序会遗留（只有当记录的根进程本身存活时才能发现）。E2E 用「Git Bash / bash 终端里运行忽略 SIGHUP 的服务，再强制结束 DevHub」覆盖。

## 已知限制

- 自己调用 `setsid` / 脱离进程组的守护进程在 Linux 上杀不到。
- Windows：进程自然退出后需调用一次 `pty.kill()` 释放 node-pty 的 conout 工作线程；此时 node-pty 的辅助进程会在 stderr 打印 `AttachConsole failed`，不影响功能。
- Windows：Ctrl+C 中断 `.cmd` 批处理时 cmd 会询问「终止批处理操作吗(Y/N)?」，此时要等到超时才强制结束（子进程已先收到 Ctrl+C）。
