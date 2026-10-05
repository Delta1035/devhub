# 0021 用 GitHub Issues 管理开发进度

- 状态：已采纳
- 日期：2026-10-05

## 背景

此前所有计划、进度和验证记录都写在 `docs/PROGRESS.md`，已接近 200 行：已完成、下一步与历史检查记录混在一起，难以看出当前要做什么。接下来的 M4（远程 API → PWA → Android）跨多个应用、需要拆成十几个有前后依赖的小任务，单个文件不便追踪。

## 决策

- 任务用 **GitHub Issues** 管理，一个 issue 一个小任务；阶段用 milestone（`桌面 MVP 发布`、`M4-1 远程 API`、`M4-2 PWA`、`M4-3 Android`）；看板为用户级 Project「DevHub Roadmap」（Todo / In Progress / Done），关联本仓库。
- 标签：类型沿用默认的 `bug` / `enhancement` / `documentation` / `dependencies`；新增 `area:core|shared|desktop|mobile|ci` 与 `platform:windows|linux|android`。
- 新增 Issue 模板「开发任务」（背景、要做、验收标准）。
- 提交用 `Refs #n` / `Closes #n` 关联；验证结果写在 issue 评论中，不再写进 PROGRESS。
- `docs/PROGRESS.md` 只保留当前阶段、进行中的 issue 与已知问题；此前的记录移入只读的 `docs/progress-archive.md`。
- 重要决策仍写 ADR，issue 只链接，不替代 ADR。
- AI 助手通过 `gh` CLI 读写 issue 与看板（需要 `project` 权限）。

## 备选与理由

- Jira：Sprint、工时、审批流对单人开发过重；与仓库关联需额外集成，AI 助手也要另配 API 访问。以后多人协作时可再评估，Issues 可迁移。
- 继续只用 PROGRESS.md：无依赖关系、无看板，文件持续膨胀，历史与待办难以区分。
- 仓库内 TODO 文件 / 每个任务一个 Markdown：比 Issues 少了提交自动关联与看板，没有明显好处。

## 已知限制

- 仓库是公开的，issue 内容对外可见；不要写入内网地址、凭据等敏感信息（例如 Linux 测试机地址只放在本机记忆中）。
- 离线时无法查看 issue；当前阶段与已知问题仍在 PROGRESS.md 中，可离线阅读。
