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
- 不实现 `Last-Event-ID` 重放。断线重连后客户端按现有方式补齐：先订阅，再 `getRunOutput` 用 `OutputCursor` 拼接输出（ADR 0004），其余状态重新 `list*`。
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
