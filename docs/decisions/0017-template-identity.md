# 0017 模板产品标识与初始化

- 状态：已采纳
- 日期：2026-10-03

## 背景

ADR 0016 把基础模板放在 `templates/desktop`，初始化、安装器与 CI/发布留到后续任务。产品名、appId、安装目录、可执行文件、更新源分散在运行时、package.json 和打包配置中；任何一处遗漏都会让新应用与 DevHub 或其他副本冲突，甚至把更新指向 Delta1035/devhub。

## 决策

- `app.config.json` 是唯一的标识来源：projectName、productName、appId、author、homepage、repository。校验规则集中在 `scripts/app-config.mjs`（无新依赖），运行时 zod schema 保持相同规则。
- 初始化 `scripts/initialize.mjs` 只结构化写入 `app.config.json` 与两个 package.json（package.json 的元数据必须给 Electron 与 electron-builder 读取）。其余代码不做文本替换，在构建时读取配置：Vite 插件写入窗口标题，`electron-builder.config.mjs` 生成打包配置，并写入只含 `!define` 的 NSIS 包装文件。
- 默认只预览；`--yes` 才写入。先写全部临时文件再逐个替换，失败时回滚，并按退出码区分输入错误（2）和写入失败（1）。拒绝非模板目录与标识不一致的目录；修改已初始化的 appId 需显式确认。
- 打包用 `extraMetadata.name = projectName`，避免各副本共用更新缓存目录及非 ASCII 产品名的默认安装目录；没有 repository 时 `publish: null`，不允许 electron-builder 从 git remote 推断更新源。
- `scripts/check-identity.mjs` 纳入 `pnpm check`，检查一致性和来源应用残留；发布模式（`pnpm release`、release 工作流）还要求非默认标识，且 repository 与发布仓库一致。`scripts/verify-package.mjs` 校验真实产物。

## 影响

改名只需重新初始化，不会遗漏散落的副本。package.json 中仍有派生字段，由标识检查兜底。NSIS 包装文件为构建时生成，路径写入绝对路径，不纳入版本控制。模板仓库自身可以打包但不能发布，这是预期行为。
