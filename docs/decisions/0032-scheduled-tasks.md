# 0032 定时任务调度

- 状态：已采纳
- 日期：2026-11-18
- 关联：[Issue #128](https://github.com/Delta1035/devhub/issues/128)

## 背景

DevHub 已能手动执行单个脚本和批量任务，但没有按计划触发的能力。用户需要用表单化规则或 Cron 定时执行这些已有目标，同时避免重复启动正在运行的脚本或批量任务。

## 决策

- 定时任务存放在 DevHub 自己的 `userData/schedules.json`，不写入项目目录；目标只保存稳定的 `projectId + scriptId` 或 `groupId`。
- 时间规则同时支持单次、每天、每周、固定间隔和标准 5 段 Cron。规则计算放在 `packages/shared` 的纯 TypeScript 中，使用本地时区；Cron 支持通配符、列表、范围和步长。
- 调度器位于 `apps/desktop/src/main/core/schedules/`，只在 DevHub 进程运行期间工作。应用启动时会将停机期间错过的单次任务标记为跳过，周期任务移动到下一个未来时间，不补执行。
- 调度器复用 `RunManager` 与 `GroupRunner`，不复制脚本扫描、进程启动或进程树停止逻辑。所有来自 API 的输入在 core 中通过 shared schema 校验。
- 目标冲突策略存于每个定时任务：默认 `skip`，正在运行时记录跳过；`stop-and-restart` 先停止对应脚本或批量任务，再启动一次新运行。脚本被其他批量任务复用时，停止影响范围由界面明确提示。
- 定时任务通过 `DevhubApi` 自动映射到 IPC 和远程 HTTP；定义变化与最近执行结果通过 `schedules-updated` 事件同步。
- DevHub 退出后不接入 Windows 任务计划程序、Linux systemd/cron 或 Android 后台服务；后续如要支持退出后执行，另建 ADR 和 issue。

## 备选与理由

- **使用第三方 Cron 库**：当前只需标准 5 段表达式，纯实现可以保持 shared 平台无关并避免新增依赖；未来若扩展到时区、秒级 Cron 或复杂日历规则，再单独评估依赖。
- **把调度放进 renderer**：renderer 可能被关闭或切换为远程客户端，无法保证执行；调度必须由 core 生命周期管理。
- **目标运行时直接并行启动**：RunManager 会拒绝同一脚本的重复运行，批量任务也会拒绝重复执行；默认跳过可以避免无意义错误和端口冲突。
