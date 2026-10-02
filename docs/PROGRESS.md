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
- M1-6 进程管理（ADR 0003）：node-pty 1.1.0 运行脚本，API `startScript` / `stopRun` / `restartRun` / `listRuns`
  - 停止先优雅（Windows Ctrl+C，Linux 进程组 SIGTERM），5 秒后强制杀整棵树（`taskkill /T /F` / SIGKILL）；退出 DevHub 时停止全部运行
  - 每个脚本保留最新一次运行，输出在 core 中保留最近 512 KB（尚未推送到 UI）
  - UI：脚本行运行 / 停止 / 重启按钮 + 状态徽标；有活动运行时每秒轮询 `listRuns`（临时方案）
  - 真实进程集成测试（当前平台）+ 手动验证：真实 `pnpm run` 启停（1.1 秒优雅退出）、重启、非零退出码、退出 DevHub 后无遗留进程
- M1-7 日志推送 + 终端（ADR 0004）：`DevhubEvents.subscribe` 推送运行状态与输出，替换轮询；新增 `getRunOutput` / `writeRunInput` / `resizeRun` / `removeRun`
  - 输出按流偏移量拼接快照与实时事件（`OutputCursor`），core 中 16 ms 合并后推送
  - 终端面板：xterm.js，每个运行一个标签页（状态圆点、关闭已结束的），启动后自动切换，可输入，高度可拖拽并记住
  - 移除 desktop 的 `postinstall`（@electron/rebuild 会从源码编译 node-pty 并失败，见 ADR 0003 补充）
  - 手动验证：彩色 + 中文输出、交互输入、1 MB 输出（合并为 51 条事件、顺序正确、快照截断到 512 KB）、切换标签页连续无重复、整页刷新后恢复、关闭标签、退出无遗留
- M1-8 终端链接可点击：`@xterm/addon-web-links`，Ctrl/⌘+点击打开；ShellApi `openExternal` 只允许 http/https（校验在 `core/shell/external-url.ts`）
  - 修复安全问题：`setWindowOpenHandler` 原先会把任意协议的 URL 交给系统打开
  - 手动验证：普通点击不打开、Ctrl+点击打开、URL 结尾标点不误入、`file:` / `javascript:` / `ms-settings:` 经 IPC 与 `window.open` 均被拒绝
- M1-9 Playwright E2E（`pnpm e2e`，6 个用例约 22 秒）：添加/重复/重启后保留/移除项目、脚本列表与包管理器、目录缺失、运行-输出-停止-退出码、终端输入、退出后整棵进程树被结束
  - 已确认用例能真实失败（故意改错断言 → 失败并保存 trace）；CI 在 Windows + Ubuntu（xvfb）运行，失败上传 trace
- M1-10 CI 加固：新增 `package` job（两平台 `build:unpack`，并校验 node-pty 的 `pty.node` 已解包到 `app.asar.unpacked`）；`permissions: contents: read`、PR 上取消被覆盖的运行、job 超时 20 分钟
  - 本机验证 Windows 打包与 `.node` 路径；Linux 路径（`build/Release/pty.node`，无预编译包、安装时编译）待 CI 首次运行确认
- M1-11 自动发布：`release.yml`，推送 `v*` tag → 校验 tag 与版本一致 → 两平台打安装包 → 创建草稿 Release（步骤见 README）；手动触发只打包
  - 修复：安装包名用了 `${name}`（`@devhub/desktop`，含 `/`），NSIS 输出到不存在的子目录导致 `build:win` 失败；改为固定的 `devhub-*`
  - 安装包不再包含 e2e、playwright 配置、`components.json`、`scripts/`
  - 本机验证 Windows 安装包生成；Linux 安装包与 Release 创建待首次推 tag 时确认
- M1-12 发布加固：`pnpm release <patch|minor|major>` 改版本、提交并打 tag（pnpm 自带 `version`，无新依赖）；Release 先跑 `pnpm check` + E2E，附 `SHA256SUMS.txt` 与构建溯源（`actions/attest`）；所有 action 升到 Node 24 版本并固定到 commit SHA；Dependabot 每周更新 actions 与 npm 依赖
  - 修复：v0.1.1 发布时 deb 打包失败（缺 `homepage`）；补 `homepage` / `author` / `desktopName`（+ `linux.syncDesktopName`）。CI 的 `package` job 改为打真实安装包（原先只打 `--dir`，发现不了安装包元数据问题）
- 用编辑器打开项目：项目列表（悬停）与详情标题栏的 VS Code / IDEA 按钮；API `listEditors` / `openInEditor`
  - 自动检测：PATH（`code.cmd` → 同目录 `Code.exe`）、JetBrains 注册表（自定义安装目录）、Toolbox、默认安装目录；Linux 含 snap / Toolbox
  - 编辑器作为独立进程启动（不进入运行列表，退出 DevHub 不受影响）；未检测到的编辑器按钮禁用
  - 手动验证：本机 VS Code（装在 D 盘，经 PATH 找到）成功打开带空格路径的项目；IDEA 未安装 → 按钮禁用、API 返回「未检测到 IntelliJ IDEA」
- 项目内交互式终端（ADR 0005）：终端面板「+」新建（默认 bash，Windows 为 Git Bash），下拉选择 PowerShell / cmd 等；同一项目可开多个
  - `Run` 改为 `script` / `shell` 联合类型（`scriptName` → `title`）；API `listShells` / `startShell`
  - 关闭终端结束整棵进程树：Linux SIGHUP + 强制时扫描整个会话；Windows `taskkill /T`
  - 修复 Git Bash 下 `node` 等被 winpty 包装、脱离进程树导致关闭终端杀不到的问题（DevHub 提供启动文件）
  - 编辑器与 shell 的查找逻辑合并为 `core/fs/finder.ts`
  - 验证：真实进程集成测试（Git Bash 中启动的 node 父子进程随终端关闭全部结束）、E2E（新建终端、bash 算术展开、关闭后进程消失）
- 完善终端（ADR 0004 补充）：切换标签保留终端实例（全屏程序、滚动、选区不丢）、复制粘贴（有选区 Ctrl+C 复制，否则中断）、右键菜单、Ctrl+F 搜索高亮、Unicode 11 宽字符、WebGL 渲染、清屏、字号缩放、面板最大化、自动聚焦
  - E2E 新增 2 个用例：剪贴板读写核对复制 / 粘贴 / 中断，标签切换后为同一实例，搜索计数、清屏、缩放、最大化；WebGL、中文对齐、右键菜单与搜索高亮已截图人工确认
- 批量执行（提前完成 M3「分组」，ADR 0006）：侧栏「批量」区；任务可跨项目，并行或串行；串行步骤的继续条件为成功退出 / 输出出现文字 / 端口可连接 / 等待 N 秒（带超时）；失败即停止后续并说明原因；已在运行的脚本复用；停止全部结束各脚本进程树
  - 存储 `userData/groups.json`；进度经 `group-updated` 事件推送
  - 测试：存储 9 个、条件 12 个（含真实端口检测）、执行器 8 个单元测试；E2E 2 个（跨项目串行按顺序启动并全部停止、失败步骤中断序列）；侧栏与编辑对话框已截图确认
- 项目列表显示活动终端：有未结束的脚本或终端时，项目名旁显示绿点和数量（停止中为琥珀色），悬停列出名称；E2E 覆盖出现与消失
- 与远端合并：本地 6 个提交 rebase 到 dependabot 的 TypeScript 6.0.3 / @types/node 26 之上，check 与 E2E 全部通过；ADR 0001 更新 TS 版本约束
- Windows 上停止 npm / yarn 脚本时自动回答「终止批处理操作吗(Y/N)?」：从 6 秒多降到约 1 秒（ADR 0003 补充）
- 崩溃后遗留进程：记录运行的 pid + 启动时间，下次启动若仍存活则提示「全部结束 / 忽略」（ADR 0003 补充）；E2E 模拟崩溃覆盖
- 设置页（ADR 0007）：顶栏齿轮进入；外观（主题）、终端（默认 shell、字号、回滚行数、GPU 渲染）、编辑器（手动指定 VS Code / IDEA 路径，可恢复自动检测）、进程（停止等待时间、关闭窗口时最小化到托盘 / 退出）；修改即时生效
  - 核心设置存 `settings.json`（API `getSettings` / `updateSettings`），显示偏好存本地；E2E 3 个（生效与重启后保留、编辑器路径、关闭即退出）
- 启动前端口冲突检测（M2）：从脚本推断端口（`--port` / `-p` / `PORT=`、vite / next / nuxt / react-scripts / vue-cli / webpack / angular / astro 默认端口、Spring Boot 的 `server.port`，默认 8080），脚本行显示「端口 N」；启动前检测，被占用时提示占用进程与 PID，可「仍然启动」；批量执行遇到冲突该步失败并说明
  - 占用进程：Windows `Get-NetTCPConnection`，Linux `ss -ltnp`；E2E 用真实占用的端口覆盖
- `.devhub.yaml` 自定义脚本（M2，ADR 0008，新依赖 `yaml`）：command（可按平台区分）、cwd（限制在项目内）、description、port；写错时以警告显示行号或字段路径；脚本列表底部有格式示例
  - 也可用来补上 monorepo 子包 / 多模块项目中识别不到的启动命令
- 批量执行：「输出中出现文字」支持正则（保存时校验）；每个任务最近一次结果与完成时间保存在 `group-history.json`，重启后仍显示（ADR 0006 补充）

### 下一步（M1）

1. 依次：自定义 shell 路径与参数 → Linux 下 `mvnw` / `gradlew` 无执行权限 → CI 缓存 Electron → 自动更新（electron-updater）
2. monorepo 子包 / 多模块项目的脚本识别（暂缓）
3. 推送后确认 CI 在 Windows + Ubuntu 都通过（Linux 上的杀进程树集成测试、E2E 与打包都是首次运行）

### 已知问题 / 待定

- npm 探测只看项目根目录：monorepo 子包作为项目添加时，根目录的 lockfile 识别不到，会回退为 npm
- 脚本命令目前是字符串（经 shell 执行）；进程管理时再决定是否改为 argv 形式
- Maven 多模块 / Gradle 多项目：只读根目录构建文件，子模块中的 `spring-boot:run` / `bootRun` 识别不到，且在根目录执行会作用于所有模块；以后扫描子模块并用 `-pl <module>` / `:<project>:bootRun`
- Linux 上 `mvnw` / `gradlew` 若无执行权限（如从 zip 解压），`./mvnw` 会失败；进程管理阶段再决定是否改为 `sh mvnw`
- Android 项目的 `assembleDebug`、`installDebug` 等任务暂不识别
- Linux 上自己 `setsid` 脱离进程组的守护进程杀不到；崩溃后的遗留进程只有当记录的根进程本身存活时才能发现（子进程脱离后根进程已退出的情况发现不了）
- Windows 上 node-pty 在进程自然退出后会在 stderr 打印 `AttachConsole failed`（释放资源时的辅助进程），不影响功能
- Windows 上 Node.js 子进程在 ConPTY 下收不到新尺寸（`process.stdout.columns` 不更新，libuv 行为）；调整终端大小后 Node 工具的换行可能仍按旧宽度
- Linux 上的真实进程集成测试、E2E 与打包尚未运行过（本机是 Windows），需推送后由 CI（ubuntu）验证
- 在 VSCode 集成终端中启动 `pnpm dev` 需先清除 `ELECTRON_RUN_AS_NODE`（VSCode 会设置它，导致 Electron 以 Node 模式运行）：`env -u ELECTRON_RUN_AS_NODE pnpm dev`
- 终端：Windows 上清屏后若终端尺寸变化，ConPTY 会重发旧屏幕内容
- 终端：自定义 shell 路径与参数暂不支持（默认 shell 已可在设置中选择）；Linux 上 shell 的 SIGHUP / 会话扫描只在 CI 中验证
- 编辑器：本机已安装 IDEA（D 盘自定义目录），经注册表检测成功；实际打开项目待人工点一次确认；检测不到时可在设置中手动指定；`reg query` 输出按系统代码页解码，安装路径含中文时可能识别不到
- CI 待办：缓存 Electron 二进制（每次 install 下载 100MB+）
- 发布待办（GitHub 仓库设置，非代码）：开启 Immutable releases；为 `v*` tag 加 ruleset 限制创建者
- 发布：安装包不做签名（已决定，Windows SmartScreen 会提示）；自动更新排在待办中
- 端口推断是启发式的：脚本里没写端口、也不是已知工具时不检查；`run-manager.ts` 已接近 400 行，下次改动时拆分
