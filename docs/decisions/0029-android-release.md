# 0029 Android App 的构建、签名与发布

- 状态：已采纳
- 日期：2026-10-07
- Issue：#21

## 背景

Capacitor 客户端（ADR 0027，#20）需要随桌面端一起发布。Android 只允许用同一签名密钥覆盖安装已安装的 App：密钥一旦丢失或更换，用户只能卸载重装（App 中保存的连接会丢失）。版本号也要单调递增，否则不能覆盖安装。

## 决策

- **与桌面端同一次发布**：`release.yml` 新增 `android` 任务（Ubuntu runner，Temurin JDK 21，runner 自带 Android SDK），执行 `pnpm --filter @devhub/mobile-capacitor sync`（renderer 的 `capacitor` 模式构建 + `cap sync`）与 Gradle `assembleRelease`；APK 命名为 `DevHub-<版本>.apk`，与安装包一起写入 `SHA256SUMS.txt`、生成构建来源证明并附到草稿 Release。不使用 EAS 或其他第三方构建服务。
- **版本号取自桌面端**：`android/app/build.gradle` 读取 `apps/desktop/package.json` 的版本，`versionName` 与其相同，`versionCode = 主 × 10000 + 次 × 100 + 修订`（1.3.0 → 10300）。`pnpm release` 改版本时 App 随之变化，无需额外步骤；次版本和修订号须小于 100。
- **签名密钥只存在 GitHub Secrets 中**：`ANDROID_KEYSTORE_BASE64`（keystore 文件的 base64）、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。工作流把 keystore 解码到 `$RUNNER_TEMP`，`build.gradle` 通过环境变量 `ANDROID_KEYSTORE_PATH` 等读取。仓库与构建产物中都不包含密钥。
  - 推 tag 时缺少密钥直接失败，不发布未签名或用临时密钥签名的 APK。
  - 手动运行（`workflow_dispatch`）与 CI 在没有密钥时构建未签名 APK（`DevHub-<版本>-unsigned.apk`），只用来验证构建。
  - keystore 文件与密码由维护者另行离线备份；丢失后只能换新密钥，用户需卸载重装。
- **CI 每次构建 APK**：`ci.yml` 的 `android` 任务对每个 PR 构建未签名的 release APK（PR 拿不到 Secrets），Gradle / Capacitor 的问题在发布前暴露。
- 只发布 APK，不上架应用商店，不生成 AAB。

## 备选与理由

- 用 debug 密钥签名：每台机器的 debug 密钥不同，CI 每次构建的 APK 都无法覆盖安装。
- Play App Signing / AAB：需要开发者账号并上架商店，不符合「Release 直接下载安装」的分发方式。
- App 版本独立于桌面端：两者共用远程 API 与网页代码，同版本发布最不容易混淆；协议不兼容的提示在 #32 处理。
- 签名放在本地完成、只上传 APK：发布依赖维护者的机器，也无法生成构建来源证明。
