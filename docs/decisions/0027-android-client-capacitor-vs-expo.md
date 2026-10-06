# 0027 Android 客户端：Capacitor 方案与 Expo 方案对比

- 状态：已采纳（2026-10-06 用户选择：优先 Capacitor，以后再加 Expo）
- 日期：2026-10-06
- Issue：#19

## 背景

ADR 0001 规划 Android「先 PWA，后 React Native + Expo」。之后的两个事实改变了权衡：

- #17 让网页版**复用桌面 renderer**（React 19 + Tailwind + shadcn + xterm.js），由远程服务托管（ADR 0022 补充）；#18 会把它适配到 375px 手机屏幕。手机端的完整 UI 因此已经存在，而且是 Web 技术。
- `createRemoteClient`（`packages/shared`）的 fetch、解码、计时器都由调用方注入，任何 JS 运行时都能复用。

于是有两条路：把现有网页包进原生壳（Capacitor / Cordova），或按原计划用 React Native（Expo）重写一套原生 UI。

## 决策

Android 客户端**先用 Capacitor**（方案 A）包装 renderer 的网页构建；Cordova 不采用；Expo 原生客户端（方案 B）保留为后续计划，届时另立 issue，复用同一远程 API 与 `createRemoteClient`。下文的新依赖在 #20 实施时按版本确认。

## 方案 A：Capacitor（采用）

### 形态

新增 `apps/mobile-capacitor`，只包含 `capacitor.config.ts`、`package.json` 与 Capacitor 生成的 `android/` 原生工程（按 Capacitor 惯例提交进仓库）。`webDir` 指向 renderer 的网页构建产物（`vite.web.config.ts`，必要时加一个 mobile 模式），**不另写 UI**。

运行时 WebView 从 `http://localhost`（`androidScheme: 'http'`）加载打包进 APK 的网页，再跨域访问桌面端的远程 API。

### 需要改的地方

| 位置                                    | 改动                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderer/src/api/remote-connection.ts` | `baseUrl` 目前写死为 `''`（同源），改为可配置；Token 存储改为注入（网页 localStorage，App 用安全存储）                                                          |
| renderer                                | App 内增加「连接」页：输入地址 + Token，或扫描设置页的二维码（解析 ADR 0023 的 `http://<地址>:<端口>/#token=…`）；处理 Android 返回键                           |
| `@renderer/api`                         | 运行环境三选一：有 preload → IPC；Capacitor → 远程 + 已保存的地址；其他 → 同源远程。Capacitor 插件只在这一层（或一个平台模块）里使用，保持 ESLint 边界          |
| `core/remote/remote-server.ts`          | 增加 CORS：只允许 App 的来源 `http://localhost`（无端口）；处理 `OPTIONS` 预检（`Authorization` 头与 JSON 请求体都会触发预检，SSE 的 GET 也会）。不放宽其他来源 |
| Android 工程                            | `network_security_config` 允许明文 HTTP（局域网直连时；经 Tailscale HTTPS 时不需要）                                                                            |
| CI（#21）                               | `pnpm --filter @devhub/desktop build:web` → `cap sync android` → Gradle `assembleRelease`，签名密钥放 GitHub Secrets；不需要 EAS 账号                           |

CORS 的风险：API 用 Bearer Token 而不是 Cookie，浏览器不会自动附带凭据，所以允许某个来源跨域并不会让没有 Token 的页面获得访问能力。

### 注意点

- **不要启用 `CapacitorHttp`**：它把 `fetch` 替换为原生请求，不支持流式响应，SSE 会失效。保持 WebView 自带的 `fetch` + `ReadableStream`（Android System WebView 早已支持）。
- `androidScheme` 必须从第一版就定下来：改动会改变来源，localStorage 等数据会丢失。`http://localhost` 仍属于安全上下文，`crypto`、剪贴板等 API 可用。
- xterm 的 WebGL 渲染在部分 Android WebView 上可能失败，需要回退到 DOM 渲染器（`terminal-prefs.ts` 已有渲染方式开关）。
- 后台：App 切到后台后 WebView 的 SSE 会被系统挂起，回到前台靠现有的 `onReady` 重连补齐；「运行结束时通知」需要前台服务或推送，与 Expo 同样不简单，暂不做。

### 新依赖（需确认）

`@capacitor/core`、`@capacitor/cli`、`@capacitor/android`、`@capacitor/app`（返回键、生命周期）；安全存储插件（Capacitor 官方没有，候选 `@aparajita/capacitor-secure-storage`，基于 Android Keystore）；扫码插件（候选 `@capacitor-mlkit/barcode-scanning`，可后补，先手动输入）。具体版本实施时确认。

## 方案 A'：Cordova（不推荐）

技术形态与 Capacitor 相同（WebView 壳），差异：

- 原生工程是构建产物（`platforms/` 不提交），改原生配置要通过 `config.xml` 与插件钩子，调试和定制都比直接改 Android Studio 工程麻烦。
- 插件生态更新缓慢，许多插件长期无人维护；Ionic 已把 Capacitor 作为其后继，Capacitor 也能直接使用大部分 Cordova 插件。
- 工具链（CLI、对现代 Gradle / AGP 的跟进）比 Capacitor 慢。

结论：既然选 WebView 壳，Capacitor 在各方面都不比 Cordova 差，没有选 Cordova 的理由。

## 方案 B：Expo（原计划，推迟）

在 `apps/mobile`（Expo + Expo Router，骨架已在 #30 完成，结构见 ADR 0028）上继续，用 React Native 组件重写项目列表、脚本列表、运行状态、日志与设置；复用 `packages/shared` 的类型、zod schema 与 `createRemoteClient`（流式读取用 `expo/fetch`）；Token 用 `expo-secure-store`，扫码用 `expo-camera`。构建用 `expo prebuild` 后在 CI 跑 Gradle（ADR 0028）。

## 对比

| 维度              | Capacitor                                                           | Expo（React Native）                                                                   |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| UI 复用           | 约 100%：直接用 renderer（#18 的手机布局同时服务 PWA 与 App）       | 只复用 shared 的类型与客户端；UI 全部重写，shadcn / Tailwind 不可用（可选 NativeWind） |
| 终端 / 日志       | xterm.js 原样可用                                                   | RN 没有终端组件，只能在 `react-native-webview` 里嵌 xterm，或另写日志视图              |
| 功能同步          | 桌面新增功能自动出现在 App                                          | 每个功能都要在移动端再实现一次，长期维护两套 UI                                        |
| 工作量（#19～21） | 小：壳 + 连接页 + CORS + CI，约数天                                 | 大：骨架、导航、各页面、日志、测试体系，约数周                                         |
| 原生体验          | WebView：滚动、手势、转场不如原生；本应用以列表与日志为主，影响有限 | 原生组件、手势与性能更好                                                               |
| 服务端改动        | 需要 CORS + 预检（跨域）                                            | 不需要（RN 不受 CORS 限制）                                                            |
| monorepo          | 没有打包器，只消费构建产物，与 pnpm 无冲突；不需要 Turborepo        | Metro 与 pnpm 符号链接、React / RN 版本需对齐 Expo SDK；可能需要任务编排               |
| 构建与 CI         | 标准 Gradle 工程，CI 直接构建，无第三方账号                         | EAS（云端，免费额度有限）或 prebuild + Gradle                                          |
| 测试              | 现有 Playwright 网页 E2E 覆盖大部分 UI；原生壳只需人工冒烟          | 需新增 Jest + RNTL，E2E 需 Maestro / Detox                                             |
| 安全存储 / 扫码   | 社区插件                                                            | 官方 `expo-secure-store` / `expo-camera`                                               |
| 求职价值（0001）  | 一般：Ionic / Capacitor 有市场但较小                                | 高：React Native 是主流移动端技能                                                      |
| 相对 PWA 的增量   | 安全存储 Token、局域网 HTTP 直连无需 HTTPS、扫码、APK 分发、返回键  | 同左，另加原生体验                                                                     |

## 取舍

- 以「用最小成本得到可用的 Android 客户端」为目标：选 **Capacitor**。它基本只是把 #18 的成果装进 APK，并且消除了 PWA 安装必须 HTTPS 的限制。
- 以「学习 / 展示 React Native」为目标（ADR 0001 的求职考虑）：保留 **Expo**，但需接受重写 UI、终端只能嵌 WebView、长期维护两套界面。
- 两者不互斥：`createRemoteClient` 与远程 API 对两者都适用，先做 Capacitor，之后仍可以再做 Expo 原生版。

已同步：ADR 0001 的 Android 一行、PRD M4；#20 改为 Capacitor 壳 + 连接页 + CORS，#21 改为 Gradle 构建。

补充（2026-10-07，#30）：决定 Capacitor 之前按方案 B 做出的 Expo 骨架（PR #29）保留在 `apps/mobile`，作为以后 Expo 客户端的基础（ADR 0028）；Capacitor 壳因此放在 `apps/mobile-capacitor`。两者连接同一远程 API，互不依赖。
