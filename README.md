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

```bash
pnpm release patch          # 或 minor / major / 1.2.3；工作区必须干净
git push --follow-tags      # 推送提交和 v* tag，触发 Release 工作流
```

`pnpm release` 修改 `apps/desktop/package.json` 的 `version`，提交 `chore(release): vX.Y.Z` 并打 tag。Release 工作流在 Windows / Ubuntu 重新跑检查与 E2E，打包 `.exe` / `.AppImage` / `.deb`，附上 `SHA256SUMS.txt` 和构建溯源证明，创建**草稿** GitHub Release；下载验证后在 GitHub 上发布。

- 验证安装包来源：`gh attestation verify <文件> --repo Delta1035/devhub`
- 在 Actions 页手动运行 Release 工作流只打包（产物在运行页下载），不创建 Release
- 安装包未签名，Windows 首次运行会出现 SmartScreen 提示

## 文档

- [产品需求](docs/PRD.md)
- [架构](docs/ARCHITECTURE.md)
- [进度](docs/PROGRESS.md)
- [架构决策记录](docs/decisions/)
- [AI 协作规则](AGENTS.md)
