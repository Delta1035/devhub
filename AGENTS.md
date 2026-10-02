# DevHub — AI 协作规则

DevHub 是一个桌面客户端：自动发现本地项目中的脚本（npm / maven / gradle / 自定义），统一启动、停止、查看日志，并通过 Profile 一键切换对接的后端。目标平台：Windows、Ubuntu；后续 Android 远程管理。

开始任何任务前先读：`docs/PROGRESS.md`（当前进度）→ `docs/ARCHITECTURE.md`（结构与边界）→ 需要时读 `docs/PRD.md`。

## 工作流程

1. 非琐碎任务先给出方案，确认后再写代码。一次只做一个小任务。
2. 完成标准：`pnpm check` 全部通过（格式、lint、类型、测试）。不通过不算完成。
3. 新增或修改核心逻辑（`apps/desktop/src/main/core/`、`packages/shared/`）必须同时写测试。
4. 任务结束时更新 `docs/PROGRESS.md`；改变了结构或约定则同步更新 `docs/ARCHITECTURE.md`。
5. 做出重要技术决策（新依赖、新模式、推翻旧决策）时，在 `docs/decisions/` 新增 ADR。
6. 提交信息使用 Conventional Commits（`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`），说明「为什么」。

## 架构硬规则（ESLint 已强制，不要绕过或禁用规则）

- UI（renderer）只能通过 `@renderer/api` 访问核心；禁止在 renderer 中 import `electron`、Node 内置模块，禁止直接访问 `window.devhub`。
- `apps/desktop/src/main/core/` 不得依赖 Electron —— 它将来也要通过 HTTP 提供给手机端。需要的能力通过参数注入。
- `packages/shared/` 必须平台无关（不得 import `electron` 或 Node 内置模块）。
- 新增 API 方法：先改 `packages/shared/src/api.ts` 的 `DevhubApi` 和 `devhubApiMethods`，再在 core 中实现；IPC 与 preload 会自动映射，不要手写通道。
- 所有来自 renderer、配置文件、外部进程的输入，在 core 中用 zod 校验。
- 单文件不超过 400 行；超过前先拆分。
- 不要使用 `any`、`@ts-ignore`、`eslint-disable`。确有必要时在同一行写明原因。

## 依赖

已批准的技术栈见 `docs/decisions/0001-tech-stack.md`。引入清单外的依赖前，先说明理由并征得同意，然后补 ADR。

## 常用命令（在仓库根目录执行）

- `pnpm dev` — 启动桌面端（热更新）
- `pnpm check` — 完整质量检查
- `pnpm test` / `pnpm lint` / `pnpm typecheck`
- `pnpm --filter @devhub/desktop build:win` / `build:linux` — 打包

## 平台注意事项

- 所有路径处理用 `path` 模块，不要拼接 `/` 或 `\`。
- 进程管理必须同时考虑 Windows 与 Linux：杀进程必须杀整棵进程树，并为两个平台写测试。
