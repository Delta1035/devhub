# 0026 提交信息校验与 CHANGELOG：零依赖脚本

- 状态：已采纳
- 日期：2026-10-05
- Issue：#10

## 背景

提交信息约定为 Conventional Commits，但没有任何检查。提交直接进 main，`release.yml` 的 `--generate-notes` 按 PR 生成 Release 说明，结果基本为空。

## 决策

用两个零依赖 Node 脚本实现，不引入新依赖，发布流程（`pnpm release` → `git push --follow-tags` → 草稿 Release）不变。

- `scripts/commit-msg.mjs`：校验首行 `type(scope)!: subject`。type 限于 feat / fix / perf / refactor / docs / test / build / ci / chore / style / revert，首行不超过 100 字符，正文前空一行；git 生成的 `Merge …`、`Revert "…"` 放行。
  - 本地：husky `commit-msg` 钩子校验提交信息文件（忽略 `#` 注释与 scissors 以下内容），`fixup!` / `squash!` 在本地放行。
  - CI：`ci.yml` 的 `commit-messages` 任务用 `--range` 复查 PR 内或本次推送的提交（兜住 `--no-verify` 与网页提交），`fixup!` 在 CI 中拒绝。
- `scripts/changelog.mjs`：
  - `release`：作为 `apps/desktop` 的 `version` 生命周期脚本，由 `pnpm release` 在改版本号之后、提交之前运行（pnpm 11 原生 `version` 已实测会执行此脚本，并把暂存文件带进版本提交）。它把上一个 `v*` tag 以来的提交生成一段写在 `CHANGELOG.md` 顶部，并执行 `git add`。只收录 Breaking Changes / feat / fix / perf；docs、test、refactor、chore、ci 不进入说明。段落用英文（即提交主题），可以在推送前改写。
  - `notes <tag>`：取出某个版本的段落。Release 工作流在 build 开始时检查段落是否存在（缺少就提前失败），release 任务用它作为 `gh release create --notes-file`。
- v0.1.1～v1.2.0 的历史段落由同一逻辑生成后人工修订；已发布的 Release 正文暂不修改。

## 备选与理由

- commitlint + git-cliff：功能完整，但带来两个新依赖（commitlint 依赖链较长，git-cliff 是额外的二进制）。本项目只需要一套固定规则和一种段落格式，约 200 行脚本就够用。
- release-please：发布方式会改成合并 Release PR，与现有的「本地 `pnpm release` 打 tag」流程不同。仓库没有走 PR 的习惯，改动收益小。

## 已知限制

- 条目来自提交主题，质量取决于提交信息；有面向用户的改动时，`feat` / `fix` 主题要写成用户能看懂的话。
- 推送到 main 时，如果旧 tip 不可达（新分支、强推），CI 只检查最新一个提交。
