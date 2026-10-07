# 0030 Android App 在线更新网页包

- 状态：已采纳（2026-10-07 用户选择方案 A：自托管的网页包在线更新）
- 日期：2026-10-07
- Issue：#32

## 背景

Capacitor 客户端（ADR 0027）把网页构建打进 APK，从本地加载。桌面端升级后 App 的界面不变，只能重新安装 APK；App 也不比对远程协议版本，桌面端协议变化后旧 App 可能静默出错。网页版由桌面端托管，天然与桌面端同版本，没有这个问题。

候选方案见 #32：A 自托管在线更新网页包；B App 直接加载桌面端托管的网页；C 只提示下载新 APK。用户选择 A。

## 决策

- **插件**：`@capawesome/capacitor-live-update` 8.6.0（MIT）。只用「从自有地址下载 zip」与 `ready()` 回滚，不调用 `sync()`、`fetchLatestBundle()`、`fetchChannels()` 等会访问 Capawesome Cloud 的方法。配置：`readyTimeout: 10000`（新包 10 秒内未调用 `ready()` 即回退）、`autoBlockRolledBackBundles`（回退过的包不再使用）、`autoDeleteBundles`、`publicKey`（校验签名）。
- **跟随所连的桌面端，而不是最新版**：远程会话 `RemoteSession` 新增 `appVersion`（桌面端版本，旧桌面端没有该字段时不更新）。App 连接后用桌面端版本对比当前网页包（shared `planLiveUpdate`）：
  - 相同：不处理；
  - 等于 APK 自带的版本：`reset()` 回到自带网页；
  - 其他：从该版本的 Release 下载清单 `devhub-web-<版本>.json` 与 zip，`setNextBundle` 后提示「重启后生效」，用户可「立即重启」（`reload()`）。降级同样处理。
  - 这样 App 与网页版一样总与桌面端同版本：桌面端不升级时，App 不会换上更新、可能不兼容的界面。
- **发布**：`release.yml` 的 `android` 任务在构建 APK 后运行 `scripts/live-update-bundle.mjs`：把 `out/capacitor` 打成 `devhub-web-<版本>.zip`（零依赖、内容相同则字节相同），用 RSA 私钥（GitHub Secret `LIVE_UPDATE_PRIVATE_KEY`，RSA 3072）对 zip 做 SHA256withRSA 签名，与 SHA-256 一起写入清单。两者随 APK 进入草稿 Release、校验和与构建来源证明。推 tag 时缺少私钥直接失败。
- **下载**：清单用 `CapacitorHttp.get`（原生请求）读取：GitHub 的 Release 下载地址（`github.com` 的 302 跳转）不带 CORS 头，WebView 中从 `http://localhost` 发出的 `fetch` 读不到。zip 由插件原生下载并校验 SHA-256 与签名。全局 `fetch` 仍不替换（ADR 0027：会破坏 SSE）。没有对应 Release（开发版、草稿）时静默跳过。
- **原生兼容**：清单的 `minVersionCode` 取自 `apps/mobile-capacitor/live-update.json`。网页包需要的原生能力（Capacitor 或插件版本、`android/`、`capacitor.config.ts`）变化时，把它调到即将发布的版本的 versionCode；低于它的 APK 不下载网页包，改为提示下载新 APK。打包脚本拒绝高于本版本 versionCode 的值。安装新 APK 后 Capacitor 自动改回 APK 自带的网页。
- **协议比对**：会话的 `protocol` 与客户端内置的 `remoteProtocolVersion` 不同时，提示条说明是桌面端还是 App 较旧（shared `protocolMismatch`）。
- **调试**：构建时设置 `VITE_LIVE_UPDATE_URL`（`{version}` 代表版本）可以改为从本地服务器下载，用于模拟器测试。

## 备选与理由

- Capgo（`@capgo/capacitor-updater`，MPL-2.0）：功能相近，但默认向其云端发送更新检查与统计（`updateUrl`、`statsUrl`），自托管需要逐项关闭；签名方案与其加密上传流程绑定。
- 方案 B（加载桌面端托管的网页）：版本天然一致、不需要外网，但远程页面中 Capacitor 插件的注入、页面来源变化（存储、CORS）与离线时的连接页都要另行处理。
- 方案 C（只提示 APK）：仍需整包下载安装，体验与现状差别不大。
- 始终更新到最新 Release：桌面端未升级时，界面可能用到桌面端没有的接口。

## 已知限制

- 手机需要能访问 github.com；访问不了时继续使用当前界面。
- 网页包签名私钥丢失后需换新密钥，旧 APK 无法再校验新网页包，只能更新 APK（同时调高 `minVersionCode`）。
