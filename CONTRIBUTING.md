# 参与贡献

感谢你愿意改进 DevHub！提交问题和 PR 都欢迎。项目文档使用中文，Issue / PR 用中文或英文均可。

## 报告问题与建议

- Bug：用 [Bug 报告](https://github.com/Delta1035/devhub/issues/new?template=bug_report.yml) 模板，写明 DevHub 版本、系统、复现步骤；涉及脚本识别时附上相关的 `package.json` / `pom.xml` / `build.gradle` 片段。
- 新功能：用 [功能建议](https://github.com/Delta1035/devhub/issues/new?template=feature_request.yml) 模板，先描述要解决的问题，再说想要的做法。
- 先看一眼 [已知问题](docs/PROGRESS.md#已知问题--待定)，可能已经记录。

## 开发环境

需要 Node.js ≥ 22、pnpm 11，Windows 或 Linux。

```bash
pnpm install
pnpm dev      # 启动桌面端（热更新）
pnpm check    # 格式 + lint + 类型 + 测试
pnpm e2e      # 构建并用 Playwright 驱动真实应用（约 1 分钟）
```

在 VS Code 集成终端中运行 `pnpm dev` / `pnpm e2e` 前需清除 `ELECTRON_RUN_AS_NODE`，例如 `env -u ELECTRON_RUN_AS_NODE pnpm dev`。

打包：`pnpm --filter @devhub/desktop build:win` / `build:linux`。

## 目录结构

```
apps/desktop/
  src/main/core/   核心逻辑（项目、脚本探测、进程、批量、健康检查…），不依赖 Electron
  src/main/        Electron 主进程：窗口、托盘、IPC 自动映射
  src/preload/     暴露类型化 API
  src/renderer/    React UI，只通过 @renderer/api 访问核心
  e2e/             Playwright 用例
packages/shared/   平台无关的 API 契约、领域类型与 zod schema
docs/              需求、架构、进度与架构决策记录（ADR）
```

动手前请先读 [架构](docs/ARCHITECTURE.md)；完整约定见 [AGENTS.md](AGENTS.md)，要点如下：

- renderer 只能通过 `@renderer/api` 访问核心；`src/main/core/` 与 `packages/shared/` 不得依赖 Electron。这些边界由 ESLint 强制，不要禁用规则。
- 新增 API 先改 `packages/shared/src/api.ts`，IPC 与 preload 会自动映射。
- 外部输入（renderer、配置文件、外部进程）在 core 中用 zod 校验。
- 修改核心逻辑必须带测试；进程管理要同时考虑 Windows 与 Linux。
- 单文件不超过 400 行；路径一律用 `path` 模块处理。
- 引入新依赖前先在 Issue 中说明理由；重要技术决策在 `docs/decisions/` 新增 ADR。

## 提交 PR

1. 从 `main` 拉分支，一个 PR 只做一件事。
2. `pnpm check` 必须通过；改动 UI、IPC/preload 或进程管理时还要跑 `pnpm e2e`。CI 会在 Windows 与 Ubuntu 上重复这两项。
3. 提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/)（`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`，另有 `perf` / `build` / `ci` / `style` / `revert`），正文说明「为什么」。本地 `commit-msg` 钩子与 CI 都会校验（`scripts/commit-msg.mjs`，首行不超过 100 字符）。`feat` / `fix` / `perf` 的主题会原样进入 CHANGELOG，请写成用户能看懂的话。
4. 改了结构或约定时同步更新 `docs/ARCHITECTURE.md`。

## 发布（维护者）

```bash
pnpm release patch          # 或 minor / major / 1.2.3；工作区必须干净
git push --follow-tags      # 推送提交和 v* tag，触发 Release 工作流
```

`pnpm release` 修改 `apps/desktop/package.json` 的 `version`，把上个 tag 以来的 feat / fix / perf 提交写成 `CHANGELOG.md` 的新段落，一起提交为 `chore(release): vX.Y.Z` 并打 tag。推送前可以修改这一段的措辞（改完后 `git commit --amend` 并重新打 tag）。Release 工作流用这一段作为 Release 正文（缺少时直接失败），在 Windows / Ubuntu 重新跑检查与 E2E，打包 `.exe` / `.AppImage` / `.deb`，附上 `SHA256SUMS.txt`、自动更新元数据和构建溯源证明，创建**草稿** GitHub Release；下载验证后在 GitHub 上发布。

在 Actions 页手动运行 Release 工作流只打包（产物在运行页下载），不创建 Release。

## 许可

提交贡献即表示你同意以 [MIT](LICENSE) 许可发布你的代码。
