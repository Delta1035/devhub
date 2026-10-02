# DevHub

统一管理本地多个项目的脚本：自动识别 npm / Maven / Gradle / 自定义脚本，一处启动、停止、看日志，一键切换对接的后端。

## 开发

```bash
pnpm install
pnpm dev      # 启动桌面端
pnpm check    # 格式 + lint + 类型 + 测试
```

需要 Node.js ≥ 22、pnpm 11。

## 发布

1. 修改 `apps/desktop/package.json` 的 `version` 并提交
2. 打与版本一致的 tag 并推送：`git tag v0.1.0 && git push origin v0.1.0`
3. Release 工作流在 Windows / Ubuntu 打包（`.exe` / `.AppImage` / `.deb`），并创建**草稿** GitHub Release
4. 下载安装包验证后，在 GitHub 上发布草稿

在 Actions 页手动运行 Release 工作流只打包（产物在运行页下载），不创建 Release。安装包未签名，Windows 首次运行会出现 SmartScreen 提示。

## 文档

- [产品需求](docs/PRD.md)
- [架构](docs/ARCHITECTURE.md)
- [进度](docs/PROGRESS.md)
- [架构决策记录](docs/decisions/)
- [AI 协作规则](AGENTS.md)
