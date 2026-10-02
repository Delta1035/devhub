# 0010 自制标题栏

- 状态：已采纳
- 日期：2026-10-02

## 背景

系统自带的标题栏只显示「DevHub」，下面还有应用自己的一条顶栏（版本、更新提示、设置），白白占用两行高度；系统标题栏的样式也不跟随应用的深浅色主题。

## 决策

### Windows / Linux：`frame: false`，按钮全部自己画

- 标题栏（`features/title-bar/`）高 40px：左侧 logo、名称、版本；右侧更新提示、设置，再往右是最小化 / 最大化（还原）/ 关闭。
- 整条标题栏可拖动窗口（`.app-drag`，即 `-webkit-app-region: drag`），按钮等可点击区域用 `.app-no-drag`。
- 窗口按钮按 Windows 习惯：宽 46px，关闭按钮悬停时变红；最大化后图标切换为「还原」。
- 关闭按钮调用 `BrowserWindow.close()`，仍然经过窗口的 `close` 事件，「关闭时最小化到托盘 / 退出」的设置照常生效。
- 去掉边框后窗口设置了 `minWidth` / `minHeight`。

### macOS：`titleBarStyle: 'hiddenInset'`

- 保留系统的红绿灯按钮（mac 的惯例，也保留了全屏、窗口贴靠等系统行为），嵌在同一条标题栏里；标题栏左侧为红绿灯留出空位，全屏时不留。

### 接口

- 窗口控制是本机能力，放在 ShellApi：`getWindowState` / `onWindowState`（最大化、全屏变化时推送，带 `platform`）/ `minimizeWindow` / `toggleMaximizeWindow` / `closeWindow`。处理器在 `main/window-controls.ts`，作用于发起调用的窗口。
- 远程客户端没有 ShellApi，不显示窗口按钮。

## 备选与理由

- Windows 上用 `titleBarOverlay`（系统按钮叠在自制标题栏上）：能保留 Win11 悬停最大化按钮时的贴靠布局菜单，但按钮样式与颜色只能有限定制，Linux 上表现也不一致。用户希望按钮完全自定义，因此不采用。
- macOS 也画自己的按钮：违背平台习惯，且要自己处理全屏等行为。

## 已知限制

- 失去 Win11 悬停最大化按钮时的贴靠布局菜单（拖到屏幕边缘、Win+方向键贴靠仍然可用）。
- Linux 上去掉边框后，边缘调整大小、双击标题栏最大化取决于窗口管理器。已在 X11 + Cinnamon（Linux Mint 22.2）上确认全部正常；Wayland 会话未测。CI 的 xvfb 没有窗口管理器，E2E 在 CI 的 Linux 上只验证关闭按钮。
