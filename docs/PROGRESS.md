# 进度

> 每个任务结束时更新本文件。保持简短：只记录当前状态、下一步、已知问题。

## 当前阶段：M1 进行中

### 已完成

- M0 骨架：monorepo、类型化 API 契约 + 自动 IPC 映射、托盘/单实例、质量关卡
- M1-1 项目管理：添加（原生文件夹选择）/ 移除项目，持久化到 `userData/projects.json`（ADR 0002）
  - 路径校验与规范化、重复检测（Windows 不区分大小写）、并发写安全、损坏文件自动备份
  - `DevhubError` + `IpcResult` 错误通道；shadcn/ui 已初始化（button、alert）

### 下一步（M1）

1. 探测器接口 + npm 探测器（识别 package.json scripts，区分 npm/pnpm/yarn），含测试；再加 Maven、Gradle
2. UI：项目详情中列出识别到的脚本
3. 进程管理：启动/停止/重启，杀进程树（Windows + Linux 测试），引入 node-pty
4. 日志推送：在 DevhubApi 中设计订阅接口
5. 接入 Playwright E2E（目前用 DevTools 协议手动验证过：添加、重复报错、重启后持久化、点击移除）

### 已知问题 / 待定

- 项目目录被删除或移动后，列表中仍会显示；需要在探测脚本时标记「目录不存在」
