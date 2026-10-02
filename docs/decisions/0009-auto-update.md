# 0009 自动更新

- 状态：已采纳
- 日期：2026-10-02

## 背景

发布流程已能在打 tag 后生成安装包并创建草稿 Release，但已安装的 DevHub 不知道有新版本，只能手动下载重装。

## 决策

### 使用 electron-updater 6.8，从 GitHub Releases 更新

- electron-builder 官方配套，读取 `electron-builder.yml` 的 `publish`（`github` / `Delta1035/devhub`）。仓库公开，无需令牌。
- 主进程运行时依赖（`dependencies`）。
- 支持范围：Windows（NSIS 安装版）与 Linux AppImage。deb 包由系统包管理器管理，开发版本不检查——这些情况显示原因，不提供按钮。

### 由用户决定下载与安装

- 启动 15 秒后检查一次，之后每 6 小时检查一次；**不自动下载、不在退出时自动安装**。
- 发现新版本：顶栏出现「新版本 x.y.z」按钮 → 下载（显示进度）→「重启并更新到 x.y.z」。设置页「关于与更新」显示当前版本、状态，可手动检查。
- 安装走正常退出流程：先停止所有脚本与终端（整棵进程树），再安装。
- 更新是本机能力，放在 ShellApi（`getUpdateStatus` / `checkForUpdates` / `downloadUpdate` / `installUpdate` / `onUpdateStatus`），远程客户端没有。
- 状态转换（`main/update-status.ts`）是纯函数并有单元测试；周期性检查不会覆盖「下载中 / 已下载」的状态。

### 发布流程

- electron-builder 在 `--publish never` 下也会生成 `latest.yml` / `latest-linux.yml` 与 `.blockmap`；发布工作流把它们和安装包一起上传。
- Release 仍以草稿创建：已安装的应用只能看到**已发布**的 Release，所以「在 GitHub 上点发布」就是推送更新的动作。
- 不做代码签名（已决定）：Windows 的安装包未签名，SmartScreen 会提示；electron-updater 校验下载文件的 sha512（来自 latest.yml）。

## 备选与理由

- 自动下载并在退出时安装（electron-updater 默认）：静默替换正在运行开发服务的工具不合适；用户应能选择时机。
- 自建更新服务器：没有必要，GitHub Releases 已经托管安装包。
- 只提示「有新版本」并打开下载页：仍需手动安装，体验差。

## 已知限制

- v0.1.2 及更早的 Release 没有 `latest.yml`，这些版本的用户第一次需要手动安装带自动更新的版本；此后发布的版本可自动更新。
- 完整的「发现 → 下载 → 安装」流程需要两个都带 `latest.yml` 的已发布版本才能实测，目前只验证到：打包产物包含更新元数据、已安装应用能连上 GitHub 并给出正确的状态。
