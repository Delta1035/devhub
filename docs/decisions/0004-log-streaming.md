# 0004 日志推送与终端：事件订阅 + 流偏移量 + xterm.js

- 状态：已采纳
- 日期：2026-10-02

## 背景

脚本的输出和运行状态需要实时显示在 UI 中，并且：切换标签页、重新打开窗口时能看到历史输出；将来手机端通过网络连接时也要能用同样的方式拿到。
`DevhubApi` 的方法都是请求-响应式的 Promise，无法表达持续推送。

## 决策

### 事件契约独立于 DevhubApi

- `packages/shared/src/events.ts` 定义 `DevhubEvent`（`run-updated` / `run-removed` / `run-output`）和 `DevhubEvents.subscribe(listener) => unsubscribe`。
- core 内部用 `core/events/event-bus.ts` 分发；单个监听器出错不影响其他传输。
- 桌面：主进程 `webContents.send(devhubEventChannel)` 推给所有窗口（包括隐藏到托盘的），preload 暴露 `window.devhubEvents`，renderer 只通过 `@renderer/api` 的 `events` 访问。
- 远程（M4）：同一接口用 WebSocket 实现。
- 运行状态改为推送后，renderer 用事件直接更新 TanStack Query 缓存，不再轮询 `listRuns`。

### 输出用「流偏移量」拼接快照与实时数据

- 每个运行的输出视为一条字符流；`run-output` 事件携带该段在流中的起始 `offset`。
- `getRunOutput(runId)` 返回 `{ data, end }`：最近 512 KB 及其在流中的结束位置。
- 客户端先订阅、暂存事件，再取快照，然后用 `OutputCursor`（shared，纯函数，有单元测试）丢弃已包含在快照中的部分。这样任意时刻打开终端都不丢、不重。
- 输出在 core 中按 16 ms 合并后再发出（`core/process/run-output.ts`），避免高频输出（进度条）刷爆 IPC / WebSocket。实测 1 MB 输出合并为约 50 条事件。

### 终端渲染：@xterm/xterm 6 + @xterm/addon-fit

- 业界标准（VS Code 同款），正确处理 ANSI 颜色、光标移动、宽字符（中文）。
- 只打包进 renderer，放 `devDependencies`。
- 每次只创建一个终端实例：切换标签页时销毁并用快照重建，内存不随运行数量增长。
- 输入经 `writeRunInput` 发给 PTY；面板尺寸变化经 `resizeRun` 同步 PTY 尺寸。

## 备选与理由

- 把订阅塞进 `DevhubApi`（例如 `onEvent(callback)`）：IPC 自动映射只支持请求-响应，回调无法跨进程传递，会破坏自动映射。
- 按行保存输出、事件按行推送：带光标控制的输出（进度条、清屏）没有可靠的「行」概念；按字符流 + 偏移量更简单且精确。
- 每个标签页常驻一个 xterm 实例：切换更快，但每个实例持有完整 scrollback，运行多时内存可观；512 KB 的快照重写只需几十毫秒。
- 不合并输出、逐块推送：实现最简单，但高频输出时每秒可能上千次 IPC。

## 补充（2026-10-02）：终端链接可点击

- 引入 `@xterm/addon-web-links` 0.12.0（官方插件，无其他依赖，`devDependencies`）。自己用 `registerLinkProvider` + 正则也能实现，但 URL 边界（括号、结尾标点、跨行）由插件处理更可靠。
- Ctrl+点击（macOS ⌘+点击）才打开，与 VS Code 一致，避免选中文字时误触；悬停时提示。
- 桌面端通过 ShellApi `openExternal` 打开；主进程用 `core/shell/external-url.ts` 校验，只允许 http / https（终端输出不可信，`file:`、`javascript:`、自定义协议一律拒绝）。远程客户端没有 ShellApi，回退到 `window.open`。
- `setWindowOpenHandler` 原先把任意 URL 交给 `shell.openExternal`，现改为同一校验，不合法的直接拒绝。

## 补充（2026-10-02）：终端实例常驻，推翻「切换标签即重建」

原决策是每次只保留一个 xterm 实例、切换标签时用快照重建。引入交互式终端（ADR 0005）后，这会让 vim / less / htop 等全屏程序、滚动位置和选区在切换时丢失，因此改为：

- renderer 中 `features/terminal/terminal-sessions.ts` 为每个运行保留一个 xterm 实例，直到该标签被关闭（`run-removed`）。切换标签只是把实例的 DOM 节点移入 / 移出面板；隐藏的终端继续接收输出。首次打开（或刷新页面后）仍用快照 + `OutputCursor` 恢复。
- 只有可见的终端持有 WebGL 上下文（浏览器同时可用的 WebGL 上下文约十几个），隐藏时释放、回到 DOM 渲染。
- 内存：每个实例 scrollback 5000 行，对几十个标签可接受。

同时引入三个 xterm 官方插件（`devDependencies`）：

- `@xterm/addon-webgl`：GPU 渲染，大量输出更流畅；上下文丢失或不可用时自动回退 DOM。可用 localStorage `devhub.terminalRenderer = dom` 强制 DOM（E2E 用它读取终端文本）。
- `@xterm/addon-unicode11`：中文、emoji 等宽字符按 Unicode 11 计算宽度，光标对齐。
- `@xterm/addon-search`：Ctrl+F 搜索、高亮、计数。

快捷键与 Windows Terminal / VS Code 一致：有选区时 Ctrl+C 复制、否则中断；Ctrl+V / Ctrl+Shift+V 粘贴（经 xterm，支持 bracketed paste）；Ctrl+Shift+C 复制；Ctrl+F 搜索；Ctrl+Shift+K 清屏；Ctrl+= / Ctrl+- / Ctrl+0 字号（全局记住）。被处理的组合键会 `preventDefault`，避免触发 Electron 默认菜单（如 Ctrl+= 缩放整个页面）。

## 已知限制

- Windows 上 Node.js 子进程在 ConPTY 下收到 resize 事件后，`process.stdout.columns/rows` 不会更新（PowerShell 等能读到新尺寸，确认是 libuv 的行为，不是 DevHub 的问题）。影响：调整面板大小后，Node 工具的输出换行可能仍按旧宽度。
- 输出缓冲只保留最近 512 KB；更早的输出在快照中不可见（实时观看时不受影响）。
- Windows：清屏只清 xterm 的显示；ConPTY 自己保存一份屏幕，终端尺寸变化时会整屏重发，被清掉的内容可能重新出现（VS Code 有同样现象）。
