# 0022 远程 API：HTTP + SSE、Token 鉴权与方法分级

- 状态：已采纳
- 日期：2026-10-05
- Issue：#12

## 背景

M4 要让手机（先 PWA，后 Android）查看和控制桌面端的项目与运行。架构已预留：`DevhubApi` 是 UI 与 core 之间唯一的契约，core 不依赖 Electron，参数在各服务内用 zod 校验（`devhub-core.ts`：「参数来自不可信的传输」），因此传输层可以像 IPC 一样薄。

风险在于 `DevhubApi` 的 40 个方法中约三分之一会在主机上执行程序：`startScript`、`startShell`、`writeRunInput`（向 PTY 写入按键即执行命令）、`openInEditor`、`openInSystemTerminal`；`addProject` / `addWorkspace` 注册的目录随后可执行其中的脚本与 `.devhub.yaml`；最危险的是 `updateSettings` 把 `customShells` 指向任意程序再 `startShell`。已有约束：ADR 0005 远程默认不开放交互式终端，ADR 0007 远程不开放修改会执行程序的设置。

## 决策

### 传输

- HTTP 用 Node 自带的 `node:http`，**无新依赖**，代码在 `core/remote/`（ESLint 允许 core 使用 Node 内置模块，不得依赖 Electron）。
- 请求：`POST /api/v1/<method>`，请求体 `{ "args": [...] }`（JSON，上限 1 MB），路由由 `devhubApiMethods` 自动生成，与 IPC 同源，不手写。参数原样交给 core，由各服务校验。
- 响应：HTTP 200 + 沿用 `IpcResult` 信封 `{ ok, value | error: { code, message } }`，保留错误码供客户端判断。传输层错误用状态码：401 未鉴权、403 方法未开放、404 未知方法、413 请求过大、429 鉴权失败过多。
- `GET /api/v1/info`（无需鉴权）只返回协议版本，用于客户端探测与兼容判断，不返回应用信息。

### 事件推送：SSE

- `GET /api/v1/events` 返回 `text/event-stream`，每个 `DevhubEvent` 一条 `data: <JSON>`，内容与 `DevhubEvents.subscribe` 完全相同；每 15 秒发送注释行心跳；带 `Cache-Control: no-cache` 与 `X-Accel-Buffering: no`。
- 连接建立并完成订阅后，先发一条 `event: ready`（`data: {"protocol":1}`）。客户端收到它之后再取快照，保证快照与后续事件之间不漏数据。
- 不实现 `Last-Event-ID` 重放。断线重连后客户端按现有方式补齐：等到 `ready`，再 `getRunOutput` 用 `OutputCursor` 拼接输出（ADR 0004），其余状态重新 `list*`。
- 背压：某连接未发出的数据超过 4 MB 时断开该连接，客户端退避重连后补齐；不影响其他客户端与桌面 UI。
- 客户端用 `fetch` 读取流（可带 `Authorization` 头），不用浏览器 `EventSource`（不能设置请求头，Token 只能放进 URL 而被日志记录）。React Native 的流式读取方案在 M4-3 的 ADR（#19）中决定（如 `expo/fetch` 或基于 XHR 的 SSE 库）。

### 鉴权

- Token：32 字节随机数（`node:crypto`，base64url），用 `timingSafeEqual` 比较；所有 `/api/v1/*`（`info` 除外）要求 `Authorization: Bearer <token>`。
- Token 与远程配置存单独的 `userData/remote.json`（zod 校验），**不进 `settings.json`**：`getSettings` 与 `settings-updated` 事件会发给所有客户端，包括远程客户端。Token 以明文存储，与项目、设置等本机数据同等保护；core 不依赖 Electron，不使用 `safeStorage`。
- 鉴权失败按来源地址限速（例如每分钟 10 次，超出返回 429）。
- 重新生成 Token 立即使旧 Token 失效，并断开已建立的事件流。

### 方法分级

`packages/shared` 新增 `remoteAccess`，用 `satisfies Record<DevhubApiMethod, RemoteAccess>` 为每个方法标注级别。新增 API 方法不归类则编译失败，不会默认开放。

| 级别       | 远程               | 方法（示例）                                                                                                                                                                                    |
| ---------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`     | 开放               | `getAppInfo`、`list*`、`getRunOutput`、`getRunHistoryOutput`、`listRunHealth`、`getSettings`、`checkScriptPorts`                                                                                |
| `control`  | 开放               | `startScript`、`stopRun`、`restartRun`、`removeRun`、`resizeRun`、`startGroup`、`stopGroup`、`killOrphanedRuns`、`dismissOrphanedRuns`、`clearRunHistory`、`rescanWorkspaces`                   |
| `terminal` | 单独开关，默认关闭 | `startShell`、`writeRunInput`                                                                                                                                                                   |
| `local`    | 永不开放           | `updateSettings`、`addProject` / `removeProject`、`addWorkspace` / `updateWorkspace` / `removeWorkspace`、`saveGroup` / `deleteGroup`、`openInEditor`、`openInSystemTerminal`、远程配置相关方法 |

- `startScript` 只能运行已注册项目中探测到的脚本，项目与脚本的增删改都在 `local`，远程无法引入新的可执行内容。
- `terminal` 开启时设置页明确提示：等同于从手机在主机上执行任意命令。
- 被拒绝的方法返回 403 与 `DevhubError` 风格的错误信息；远程客户端据此隐藏入口（与 `shell === null` 同理）。

### 监听与生命周期

- 默认关闭。开启时从本机网卡地址中选择监听地址，Tailscale（`100.64.0.0/10`）地址排在最前并标为推荐；也可选「所有地址」，设置页警告局域网明文传输时 Token 可能被嗅探。默认端口 7420，可改。
- 不放行 CORS（PWA 将由同一服务托管，同源访问，见 #18）。
- 服务不做 TLS，依赖 Tailscale（WireGuard）加密。PWA 安装需要安全上下文，推荐 `tailscale serve` 提供 HTTPS，在 #18 中处理。
- 主进程在 `createDevhubCore` 之后按 `remote.json` 启动服务，配置变化时重启，`dispose` 时关闭（先断开事件流）。远程配置的读写为新的 `DevhubApi` 方法（级别 `local`），在 #15 中加入。

## 备选与理由

- WebSocket（`ws` 库）：双向、浏览器与 React Native 原生支持客户端，但需要新增运行时依赖；请求-响应已走 HTTP，推送只需单向，SSE 足够。自写 RFC 6455 服务端（分帧、掩码、心跳、背压）风险过高。
- 浏览器 `EventSource`：自动重连，但不能带请求头，Token 只能放在查询参数中。
- Token 存 `settings.json`：会随 `getSettings` / `settings-updated` 泄露给所有客户端。
- 按方法维护允许清单（数组）：新增方法时容易漏改；`Record` + `satisfies` 让遗漏变成编译错误。
- 服务自带 TLS（自签证书）：手机需要信任证书，体验差；Tailscale 已加密。

## 已知限制

- 绑定局域网地址且不经 Tailscale 时为明文 HTTP，Token 与日志内容可被同网段嗅探。
- 同一浏览器对同一来源最多 6 个 HTTP/1.1 连接；每个客户端只开一个事件流，不受影响。
- 无 `Last-Event-ID` 重放，断线期间的非输出事件靠重新拉取列表恢复。

## 补充（2026-10-05，#17）：网页版复用桌面 renderer

用户选择让 PWA 复用桌面 renderer，而不是新建 `apps/web`。

- 同一份 renderer 用普通 Vite 另行构建（`vite.web.config.ts` → `out/web`，`build` 包含它，随安装包发布），由远程服务在 `/api` 以外的路径托管：无需 Token（文件不含数据），路径严格限制在网页目录内，无扩展名的路径回退到 `index.html`，带哈希的资源长期缓存、页面本身不缓存，并带 `X-Frame-Options: DENY`。
- 客户端（`packages/shared` 的 `createRemoteClient`）：fetch、解码、计时器由调用方注入，shared 不引入 DOM / Node 类型，React Native 也可复用。事件流在全部订阅者之间共享一个连接，退避重连，每次连上发出 `onReady`，UI 据此重新拉取全部查询。
- 新增需要 Token 的 `GET /api/v1/session`（`{ protocol, allowTerminal }`）：网页连接时校验令牌，并决定是否显示终端入口。
- `@renderer/api` 在没有 preload 时改用远程客户端，并导出 `access`（`manage`：仅桌面；`terminal`：桌面或远程允许终端时）。远程不允许的操作（`local` 方法、未开启时的 `terminal` 方法）在界面上隐藏，而不是点击后报 403；只观看的手机不调整 PTY 尺寸，避免把桌面终端改成手机宽度。
- 布局仍是桌面布局，手机屏幕上的适配在 #18。

## 补充（2026-10-06，#18）：手机布局、安装与 HTTPS

- 手机布局沿用同一份组件：`md`（768px）以下侧栏改为抽屉（shadcn Sheet，基于已有的 Radix Dialog），触屏与窄屏上项目条目显示「⋯」菜单代替右键菜单，两者共用菜单项。不另做手机专用的逐级导航。
- 可安装：manifest 设置 `id` / `start_url` / `scope` 为 `./`（令牌在 localStorage 中，从主屏幕打开时地址不带令牌）。**不加 service worker**：Chrome 安装已不要求它；离线时应用本就不可用，缓存反而可能让手机一直停在旧版本。真机若不出现安装入口，再补一个只转发、不缓存的最小 service worker。
- HTTPS 不由 DevHub 提供，仍由 Tailscale 负责：DevHub 监听 `127.0.0.1`，`tailscale serve --bg <端口>` 在 `https://<机器名>.<tailnet>.ts.net` 上转发。说明写在设置页与官网「手机访问」；二维码暂时仍只编码所选监听地址（用户决定先只写说明），经 HTTPS 访问时需在手机上粘贴令牌。
- 事件流响应带 `Cache-Control: no-transform` 与 `X-Accel-Buffering: no`，代理不应缓冲或改写事件。
- 已知限制：经 `tailscale serve` 转发时所有请求的来源地址都是 `127.0.0.1`，令牌失败次数限速对它们合并计算——一台用旧令牌反复重试的设备可能让其他设备暂时被拒（429），直到 1 分钟的窗口过去。
