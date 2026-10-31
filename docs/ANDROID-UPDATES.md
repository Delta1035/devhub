# Android App 更新说明

本文说明当前 Capacitor Android App 如何更新界面，以及何时必须安装新版 APK。方案决策见 [ADR 0030](decisions/0030-android-live-update.md)，APK 的构建与签名规则见 [ADR 0029](decisions/0029-android-release.md)。当前的“热更新”只替换 App 内的网页包，不更新 Android 原生代码、Capacitor 插件或权限。

## 组成与版本

App 的界面是桌面端 renderer 的 `capacitor` 构建，首次安装时随 APK 一起打包。APK 的 `versionName` 与桌面端版本相同；`versionCode` 按 `主版本 × 10000 + 次版本 × 100 + 修订版本` 计算，例如 `1.4.0 → 10400`。计算规则在 [`android/app/build.gradle`](../apps/mobile-capacitor/android/app/build.gradle)。

每次发布同时产出：

| 文件                     | 用途                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `DevHub-<版本>.apk`      | 包含原生代码及该版本的内置网页包；安装原生能力更新时使用   |
| `devhub-web-<版本>.zip`  | 可在线下载的网页包                                         |
| `devhub-web-<版本>.json` | 网页包清单：版本、原生兼容下限、zip 文件名、SHA-256 和签名 |

这些文件由 [Release 工作流](../.github/workflows/release.yml)放在同一个 GitHub Release。网页包清单中的 `minVersionCode` 来自 [`live-update.json`](../apps/mobile-capacitor/live-update.json)，表示**能够运行该网页包的最旧 APK 的 `versionCode`**。它是兼容性下限，不是“最近发布版本”。

## App 如何决定更新方式

App 在成功连接桌面端、取得远程会话后检查更新。会话中的 `appVersion` 是**所连接桌面端**的版本；因此 App 跟随该桌面端，既可能升级网页包，也可能切回较旧的网页包，不会仅因为 GitHub 出现更高版本就自动升级。

1. 如果桌面端未提供有效的 `appVersion`，或当前待启用的网页包已是该版本，不处理。
2. 如果桌面端版本等于 APK 内置网页包的版本，调用 `reset()`，在下次重启时回到 APK 内置界面。
3. 否则，从该版本的 Release 读取 `devhub-web-<版本>.json`。若尚无已发布的清单（例如开发版或草稿 Release），继续使用当前界面。
4. 校验清单格式和目标版本，比较 `minVersionCode` 与当前 APK 的 `versionCode`：
   - `APK versionCode >= minVersionCode`：下载 zip，校验 SHA-256 和 RSA 签名，设置为下次启动使用的网页包；界面提示“已就绪，重启后生效”，也可点“立即重启”。
   - `APK versionCode < minVersionCode`：不下载网页包；界面提示“需要新版 App”，提供前往 Releases 的下载入口。用户需下载安装新版 APK；当前没有 App 内自动安装 APK 的功能。

例如，手机装的是 `1.4.0` APK（`versionCode = 10400`），连接 `1.7.1` 桌面端。如果 `1.7.1` 的清单仍写 `minVersionCode: 10400`，旧 APK 可以下载 `1.7.1` 网页包；如果该版本新增原生能力并将下限提高到 `10701`，旧 APK 会提示安装新版 APK。判断依据是**目标版本的清单**，不是两个版本号是否相同。

这里的兼容性声明由发布者维护：App 不会自动分析 Git diff 来识别原生改动。漏调 `minVersionCode` 可能使旧 APK 下载到无法正常运行的网页包；因此原生改动的发布审查必须检查这个值。

## 维护者如何发布

1. 确定本次改动是否需要新的原生能力。修改 Capacitor 或插件版本、`apps/mobile-capacitor/android/`、`apps/mobile-capacitor/capacitor.config.ts` 时，应视为原生变更。若新网页包无法在旧 APK 上运行，**在发布前**把 [`live-update.json`](../apps/mobile-capacitor/live-update.json) 的 `minVersionCode` 提高到本次发布的 `versionCode`。仅改网页界面且仍兼容旧 APK 时，保持原值。
2. 对照本次版本核算 `versionCode`。例如即将发布 `1.7.1`，需要提高原生兼容下限时填 `10701`。清单生成脚本会拒绝高于本次 APK `versionCode` 的值，但不会自动发现忘记提高的情况。
3. 按项目发布流程更新版本并推送 tag。Release 工作流构建 APK，再把 `out/capacitor` 打成 zip，并用 GitHub Secret `LIVE_UPDATE_PRIVATE_KEY` 签名；清单记录签名和校验和。推 tag 时缺少该私钥或 APK 签名密钥会使发布失败。
4. 检查草稿 Release 中的 APK、zip、JSON 清单及其中的 `minVersionCode`，然后按发布流程发布 Release。草稿 Release 尚不能作为 App 的在线更新来源。
5. 原生更新发布后，用户通过 App 的“下载”入口取得 APK 并安装。覆盖安装要求 APK 使用与已安装版本相同的 Android 签名密钥，且新 APK 的 `versionCode` 更高；安装后 App 会从新版 APK 内置网页包启动。

`minVersionCode` 是一个下限，不应因“本次主要是网页改动”就调低；只有确认目标网页包确实兼容更旧的原生能力时，才能使用更低的下限。若签名公钥或其他原生配置变更，也需要评估旧 APK 是否还能校验和运行新网页包。

## 安全、失败与限制

- 清单通过原生 `CapacitorHttp.get` 读取，因为 GitHub Release 下载地址的跳转响应没有供 WebView 使用的 CORS 头；zip 由 Live Update 插件下载。下载的 zip 同时校验 SHA-256 和 RSA 签名，公钥内置在 [`capacitor.config.ts`](../apps/mobile-capacitor/capacitor.config.ts)。不使用 Capawesome Cloud。
- 新网页包启动后调用 `ready()`；10 秒内未确认会回滚，回滚过的包会被阻止再次使用。下载或校验失败时保留当前界面，下次连接可重试。
- 手机需要能访问 GitHub Release。没有对应已发布网页包或无法获取清单时，继续使用当前界面；这不是 APK 更新提示。
- 远程协议版本与 App 内置版本不一致时，界面另有“桌面端/App 版本较旧”的提示。协议提示与 `minVersionCode` 的 APK 兼容性判断是两套检查。
- 目前不支持原生代码在线替换，也不支持 App 内自动下载和安装 APK。若更新签名私钥丢失，旧 APK 无法校验后续网页包，须发布使用新公钥的 APK 并提高兼容下限。

## 验证与实现入口

- 运行 `pnpm check` 验证清单判定、打包签名和其他质量检查；改动 UI、IPC/preload 或进程管理时还需运行 `pnpm e2e`。网页包下载、重启、回滚以及 APK 安装仍需在模拟器或真机验证；#32 记录了模拟器和真实 GitHub Release 的验证结果。
- 会话触发与提示：[`remote-gate.tsx`](../apps/desktop/src/renderer/src/features/remote/remote-gate.tsx)、[`app-update-banner.tsx`](../apps/desktop/src/renderer/src/features/remote/app-update-banner.tsx)。
- 决策与下载：[`live-update.ts`](../packages/shared/src/live-update.ts)、[`native-live-update.ts`](../apps/desktop/src/renderer/src/api/native-live-update.ts)。
- 产物与签名：[`live-update-bundle.mjs`](../scripts/live-update-bundle.mjs)、[Release 工作流](../.github/workflows/release.yml)。
