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
- M1-4 Gradle 探测器：`build.gradle(.kts)` / `settings.gradle(.kts)` → clean / build / test；Spring Boot 插件加 `bootRun`，`application` 插件加 `run`
  - wrapper 选择抽为 `resolveWrapper`（Maven、Gradle 共用）
- M1-5 UI 脚本列表：左右两栏（左侧项目列表可选中，右侧项目详情）
  - 脚本按来源分组，显示命令与说明；目录缺失、探测警告、无脚本、加载中均有对应状态；手动刷新 + 窗口聚焦自动重扫
  - 右栏下方预留终端面板（占位），进程管理后接入每个运行一个标签页
  - 已用 DevTools 协议手动验证：三种来源显示、missing、warnings、空项目、移除选中项目后回退、刷新
- 应用图标：源文件 `build/icon.svg`（黑底圆角 + 白色花括号 + 橙黄闪电），导出 `build/icon.png`、7 尺寸 `build/icon.ico`、`resources/icon.png`
  - 托盘用专门的 `resources/tray.png`（16px）+ `tray@2x.png`（32px），不再运行时缩放；Windows / Linux 窗口都设置图标（含 dev 模式）
  - macOS：`build/icon.icns`（按 Apple 网格留白，源 `build/icon-mac.svg`），菜单栏用单色 `resources/trayTemplate(@2x).png`（源 `build/tray-template.svg`），dev 模式设置 Dock 图标
  - Web：`src/renderer/public/` 下 favicon（ico + svg）、apple-touch-icon、192/512 + maskable（源 `build/icon-square.svg`）、`manifest.webmanifest`
  - 改了 `build/*.svg` 后运行 `pnpm --filter @devhub/desktop icons` 一键重新生成全部 PNG / ICO / ICNS / Web 图标（`scripts/generate-icons.mjs`，用 Electron 离屏渲染，无额外依赖）

### 下一步（M1）

1. 进程管理：启动/停止/重启，杀进程树（Windows + Linux 测试），引入 node-pty；脚本行加运行按钮
2. 日志推送：在 DevhubApi 中设计订阅接口；终端面板用 xterm.js（需先征得同意并补 ADR），面板高度可拖拽
3. 接入 Playwright E2E（目前用 DevTools 协议手动验证过：添加、重复报错、重启后持久化、点击移除）

### 已知问题 / 待定

- npm 探测只看项目根目录：monorepo 子包作为项目添加时，根目录的 lockfile 识别不到，会回退为 npm
- 脚本命令目前是字符串（经 shell 执行）；进程管理时再决定是否改为 argv 形式
- Maven 多模块 / Gradle 多项目：只读根目录构建文件，子模块中的 `spring-boot:run` / `bootRun` 识别不到，且在根目录执行会作用于所有模块；以后扫描子模块并用 `-pl <module>` / `:<project>:bootRun`
- Linux 上 `mvnw` / `gradlew` 若无执行权限（如从 zip 解压），`./mvnw` 会失败；进程管理阶段再决定是否改为 `sh mvnw`
- Android 项目的 `assembleDebug`、`installDebug` 等任务暂不识别
- 在 VSCode 集成终端中启动 `pnpm dev` 需先清除 `ELECTRON_RUN_AS_NODE`（VSCode 会设置它，导致 Electron 以 Node 模式运行）：`env -u ELECTRON_RUN_AS_NODE pnpm dev`
