# 进度

> 每个任务结束时更新本文件。保持简短：只记录当前状态、下一步、已知问题。

## 当前阶段：M0 骨架 ✅ → 准备 M1

### 已完成

- pnpm monorepo：`apps/desktop`（Electron + React + TS）、`packages/shared`
- 类型化 API 契约 + 自动 IPC 映射，端到端打通（`getAppInfo`）
- 单实例锁、托盘、关闭窗口隐藏到托盘
- 质量关卡：Prettier、ESLint（含架构边界规则）、TS strict、Vitest、husky + lint-staged、GitHub Actions（Windows + Ubuntu）、Claude Code hooks

### 下一步（M1）

1. 项目管理：添加/移除项目目录，本地持久化项目列表
2. 探测器接口 + npm 探测器（含测试），再加 Maven、Gradle
3. 进程管理：启动/停止/重启，杀进程树（Windows + Linux 测试），引入 node-pty
4. 日志推送：在 DevhubApi 中设计订阅接口
5. UI：初始化 shadcn/ui；项目列表 + 脚本列表 + 日志面板

### 已知问题 / 待定

- shadcn/ui 尚未初始化（首次做 UI 时执行 `pnpm dlx shadcn@latest init`，alias 使用 `@renderer`）
- Playwright E2E 尚未接入（M1 UI 成型后加）
- 尚未选定项目列表的持久化方案（JSON 文件 vs SQLite），M1 第 1 步决定并写 ADR
