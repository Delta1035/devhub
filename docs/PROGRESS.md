# 进度

> 每个任务结束时更新本文件。保持简短：只记录当前状态、下一步、已知问题。

## 当前阶段：M1 进行中

### 已完成

- M0 骨架：monorepo、类型化 API 契约 + 自动 IPC 映射、托盘/单实例、质量关卡
- M1-1 项目管理：添加（原生文件夹选择）/ 移除项目，持久化到 `userData/projects.json`（ADR 0002）
  - 路径校验与规范化、重复检测（Windows 不区分大小写）、并发写安全、损坏文件自动备份
  - `DevhubError` + `IpcResult` 错误通道；shadcn/ui 已初始化（button、alert）
- M1-2 脚本探测：`ScriptDetector` 接口 + npm 探测器，API `listScripts(projectId)`
  - 包管理器：`packageManager` 字段 > lockfile（pnpm > yarn > npm）> 默认 npm；脚本 id 为确定性的 `npm:<name>`
  - 单个探测器失败转为 `warnings`，不影响其他探测器；项目目录不存在时返回 `status: 'missing'`
- M1-3 Maven 探测器：`pom.xml` → clean / compile / test / package / install；含 `spring-boot-maven-plugin` 时加 `spring-boot:run`
  - 优先使用当前平台的 wrapper（Windows `mvnw.cmd`，Linux `./mvnw`），否则 `mvn`；探测器经 `createDefaultDetectors(platform)` 注入平台

### 下一步（M1）

1. Gradle 探测器（build.gradle / build.gradle.kts；常用任务 + bootRun / run；优先 gradlew / gradlew.bat）
2. UI：项目详情中列出识别到的脚本，显示 `missing` 状态与 warnings
3. 进程管理：启动/停止/重启，杀进程树（Windows + Linux 测试），引入 node-pty
4. 日志推送：在 DevhubApi 中设计订阅接口
5. 接入 Playwright E2E（目前用 DevTools 协议手动验证过：添加、重复报错、重启后持久化、点击移除）

### 已知问题 / 待定

- 项目目录被删除或移动后，`listScripts` 会返回 `missing`，但 UI 尚未展示（M1 下一步第 2 项）
- npm 探测只看项目根目录：monorepo 子包作为项目添加时，根目录的 lockfile 识别不到，会回退为 npm
- 脚本命令目前是字符串（经 shell 执行）；进程管理时再决定是否改为 argv 形式
- Maven 多模块项目：在根目录执行 `spring-boot:run` 会作用于所有模块；以后可扫描子模块并用 `-pl <module>`
- Linux 上 `mvnw` 若无执行权限（如从 zip 解压），`./mvnw` 会失败；进程管理阶段再决定是否改为 `sh mvnw`
