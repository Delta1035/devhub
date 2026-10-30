# 0031 Linux deb 应用内更新

- 状态：已采纳
- 日期：2026-10-30
- 关联：#65、ADR 0009

## 背景

ADR 0009 只允许 Windows 安装版与 Linux AppImage 在应用内更新。Linux deb 用户每次都要手动下载并安装新包；项目没有 apt 软件仓库。

## 决策

- 启用现有 `electron-updater` 6.8.9 的 `DebUpdater`。electron-builder 在 deb 的 resources 中写入 `package-type=deb`，更新器据此选择 deb 安装器；其他未知 Linux 安装格式继续不启用更新。
- 沿用 ADR 0009 的流程：用户选择下载及安装，安装前先停止 DevHub 管理的进程。Release 的 `latest-linux.yml` 同时列出 AppImage 与 deb 的 SHA-512，更新器按格式选择并校验下载文件。
- 安装走系统授权，由 `DebUpdater` 调用 Linux 包管理器。授权取消或安装失败时在更新状态显示错误，不静默退出。
- 旧版 deb 本身禁用了更新，用户需要手动安装一次包含此功能的新版本。

## 验证

v1.6.0 已发布的 `latest-linux.yml` 同时列出 `devhub-1.6.0.AppImage` 和 `devhub_1.6.0_amd64.deb`，各有 SHA-512。实际跨版本 deb 升级须在下一个版本发布后验证。

## 备选与理由

- 自建 apt 软件仓库：增加托管和签名维护成本，当前只有一个公开发布渠道。
- 手写下载和提权安装：重复现有更新器的校验和安装逻辑，也扩大安全审计范围。
