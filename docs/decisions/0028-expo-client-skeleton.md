# 0028 Expo 原生客户端骨架：apps/mobile 结构

- 状态：已采纳（作为以后 Expo 客户端的基础；当前 Android 客户端以 ADR 0027 的 Capacitor 为准）
- 日期：2026-10-06（2026-10-07 由 0027-mobile-expo 改编号）
- Issue：#30

## 背景

ADR 0001 原定 Android 的路线是先 PWA、后 React Native + Expo，本 ADR 按此做出了 `apps/mobile` 的骨架（PR #29）。之后 ADR 0027 改为先用 Capacitor 包装网页版（`apps/mobile-capacitor`，#20），Expo 原生客户端推迟。骨架保留下来作为以后 Expo 客户端的基础：它和 Capacitor 壳连接同一远程 API，互不依赖；Expo 客户端不受 CORS 限制，不需要远程服务额外开放来源。

远程 API（ADR 0022）和网页版（#17）已经完成，shared 的 `createRemoteClient` 设计时就把 fetch、解码、计时器做成了注入项，供原生客户端复用。本 ADR 确定 `apps/mobile` 的版本、目录结构、代码复用边界、构建方式，以及仓库层面是否需要任务编排。

## 决策

- **Expo SDK 57**（当前 latest；React Native 0.86、React 19.2）。版本以 `npx expo install` 解析的为准，新增原生相关依赖一律用它安装，不手写版本号。
- **路由**：`expo-router`，页面放在 `apps/mobile/src/app/`（Expo 默认模板的结构），非页面代码（api、features、lib）放在 `src/` 下的其他目录。
- **复用边界**：
  - 共享 `packages/shared`：`DevhubApi` 契约、`createRemoteClient`（HTTP + SSE）、领域模型与 zod schema、`OutputCursor`、`stripAnsi`、`remoteAccess`。
  - UI 不共享：React Native 的组件和 DOM / Tailwind / shadcn 不通用，桌面 renderer 继续作为网页版（#17）。手机端只做远程管理需要的页面（项目 → 脚本 → 启动 / 停止 → 日志）。
  - 数据层沿用 TanStack Query（ADR 0001 已批准），事件订阅方式与 renderer 相同：订阅后再取快照，用 `OutputCursor` 去重。
- **平台适配**：`src/api/` 是页面访问远程的唯一入口（对应 renderer 的 `@renderer/api`）。fetch 用 `expo/fetch`（WinterCG 实现，支持流式读取响应体，SSE 依赖它）；Token 用 **expo-secure-store**（Android Keystore 加密）保存，地址存在同一处。连接页可以粘贴桌面端二维码里的连接地址（`remoteConnectUrl` 格式，ADR 0023），由客户端拆出地址和 Token。
- **pnpm workspace**：使用 SDK 54 起支持的隔离安装，Metro 的 monorepo 配置由 Expo 自动完成，不手写 `watchFolders`。如果遇到原生库解析问题，退回 `nodeLinker: hoisted` 并在这里补充说明。同一个 app 里不能出现两份 React：mobile 固定使用 SDK 要求的 React 版本，和 desktop 的 React 版本互不影响。
- **不引入 Turborepo**：三个应用（desktop、website、mobile）用 `pnpm -r` 仍然够用；mobile 的 lint、typecheck、vitest 照常纳入 `pnpm check`，耗时不明显时不加缓存层。
- **ESLint 边界**：`apps/mobile` 禁止 import `electron` 和 Node 内置模块；`src/app/`、`src/features/` 只能经 `src/api` 访问远程（禁止直接 import `expo/fetch`、`expo-secure-store`）。
- **测试**：可单独测的逻辑（连接地址解析、日志拼接、客户端适配）写成不依赖 React Native 的 TS 模块，用 Vitest 测试。暂不引入 jest-expo 或组件测试库。
- **构建与分发（Expo 客户端恢复开发时另立 issue；#21 只构建 Capacitor）**：在 GitHub Actions 中执行 `expo prebuild` + Gradle `assembleRelease`，不依赖 EAS 和 Expo 账号；签名密钥放在 GitHub Secrets；APK 附在 Release 中直接安装，不上架商店。`android/` 由 prebuild 生成，不提交。
- **明文 HTTP**：远程服务是 http（局域网或 Tailscale），Android 9 起默认禁止明文流量；通过 **expo-build-properties** 设置 `usesCleartextTraffic`。HTTPS（`tailscale serve`）可用时优先使用 HTTPS。

## 备选与理由

- 继续只用 PWA：已经可用，但 Token 只能存在 localStorage，浏览器回收后台标签页时 SSE 会断开；原生应用可以用 Keystore 保存 Token，后续还能加通知。
- React Navigation（手写导航器）：expo-router 底层就是它，基于文件的路由是 Expo 默认方案，样板代码更少。
- 共享 UI（react-native-web 或 Tamagui 替代 renderer）：要重写整个桌面 UI，收益不足。
- Turborepo / Nx：用来缓存和编排大量包；目前只有 4 个包，`pnpm -r` 的耗时可以接受，以后 CI 明显变慢再评估。
- EAS Build：免去本地和 CI 的 Android SDK，但需要 Expo 账号和 `EXPO_TOKEN`，免费额度有排队和次数限制，构建过程也不在本仓库中可见。Gradle 在 GitHub 的 Ubuntu runner 上就能完成。
- AsyncStorage 存 Token：明文存储，不适合保存等同于远程控制权限的凭据。

## 已知限制

- Expo Go 只支持最新的 SDK；开发时用模拟器或开发构建（`expo run:android`）。
- 应用内扫码（expo-camera）暂不做，先支持粘贴连接地址。
- Windows 本地 `expo run:android` / Gradle 原生构建失败：pnpm 隔离安装的包路径很深（`node_modules/.pnpm/<包>_<哈希>/…`），CMake 目标文件路径超过 250 字符，ninja 报 `build.ninja still dirty`。CI 在 Ubuntu 上构建不受影响；Windows 上开发用 Expo Go（`expo start --go`，本应用用到的原生模块都在 Expo Go 中）。
