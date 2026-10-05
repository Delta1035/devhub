# 进度

> 每个任务结束时更新本文件。保持简短：只记录当前状态、下一步、已知问题。

## 当前阶段：桌面 MVP 功能完成，升级验证与发布待办

MVP 范围为桌面端项目/脚本管理、进程与终端、批量任务、设置、健康检查和运行历史。CLI、手机远程管理、Jira 与 Wayland 暂缓；当前收尾项为安装升级验证与发布。

### 已完成

- 项目列表交互（2026-10-05）：① 侧栏 × 不再直接移除，弹出确认对话框（说明清理范围、显示路径与活动终端数，可取消）；② 悬停项目 0.6 秒显示详情卡片（名称、完整路径、来源工作区、添加时间、各来源脚本数与警告、活动终端），替代原 `title` 提示；③ 侧栏右边缘可拖动调整宽度（200px～窗口宽减 480px，方向键微调，双击恢复 256px，存 localStorage `devhub.sidebarWidth`）；④ 项目右键菜单：显示详情（对话框，含打开目录与编辑器按钮）、打开项目目录、打开方式（VS Code / IDEA，未检测到的禁用）、复制路径、移除（同样需确认）。
  - 打开目录为 ShellApi `openProjectFolder(projectId)`：只接收 id，由 `core/shell/project-folder.ts` 校验并查出注册路径、确认是目录后才交给 `shell.openPath`（避免任意路径被系统「打开」执行）。新增 shadcn `hover-card`（来自已有 radix-ui，无新依赖）。修复：右键菜单打开时悬停卡片会弹出并遮挡菜单，现菜单打开期间不显示卡片。
  - 右键菜单补充（同日）：「在 DevHub 终端中打开」用默认 shell 新开终端，并切换到该项目、选中新标签（复用 App 的 `openRun`，与批量任务查看日志相同）；「打开方式」子菜单新增「系统终端（名称）」，未检测到时禁用。系统终端为 DevhubApi `getSystemTerminal` / `openInSystemTerminal`，`core/terminals/` 实现：与编辑器一样以独立进程启动、不进入运行列表。查找顺序：Windows 为 Windows Terminal（`wt -d`，`;` 转义为 `\;`）→ PowerShell 7 → Windows PowerShell → cmd（控制台程序 detached 启动即获得独立窗口）；Linux 为 `x-terminal-emulator` → GNOME Terminal / Konsole / Xfce / MATE / Tilix / kitty / Alacritty（各自的工作目录参数）→ xterm，同时以项目目录作为 cwd。暂不支持在设置中指定终端。
    - 验证：`pnpm check` 通过（desktop 543）；E2E 29/29，`project-actions.spec.ts` 增加 DevHub 终端打开与切换、系统终端菜单项（实际启动由单元测试覆盖）；本机实际点击一次，Windows Terminal 在项目目录打开。Linux 终端未在真机上验证。
  - 验证：`pnpm check` 通过（desktop 522、shared 61）；`pnpm e2e` 29/29 通过，新增 `project-actions.spec.ts`（悬停卡片、右键详情 / 打开目录（桩替换 `shell.openPath`）/ 打开方式 / 移除确认、拖动宽度、重载保持、双击复位），受影响用例重复 5 次均通过；截图人工确认卡片、菜单与确认框。

- 官网（2026-10-04，ADR 0020）：新增 `apps/website`（VitePress 1.6，中英双语；按用户要求中文为主语言放在根路径，英文在 `/en/`，搜索框与 404 页也已汉化），包含首页（介绍、功能、截图、下载按钮指向 `releases/latest`）与三篇指南：快速上手（安装、项目与工作区、运行、托盘、更新）、`.devhub.yaml` 参考、批量任务。截图直接引用 `docs/assets/`。新增 `website.yml`：PR 只构建，`main` 构建并部署到 GitHub Pages（`https://delta1035.github.io/devhub/`）。README 加官网链接。`pnpm check` 通过；本地构建与预览后截图确认了英文首页、中文深色文档页和手机宽度。
  - 已上线：Pages 首次部署成功，仓库 About 的 Website 已设为官网地址。同日发布了 v1.1.0 草稿（Release 工作流只建草稿，需人工发布），并删除遗留的 v0.1.6 草稿 Release（tag 保留）。
  - 注意：Playwright 自带的浏览器版本与本机已下载的不一致（需 1243，本机为 1228），临时截图改用 `channel: 'msedge'`；E2E 不受影响（驱动 Electron）。

- 撤销误操作发布（2026-10-04）：移除未推送的 `chore(release): v2.0.0` 提交与本地 `v2.0.0` tag，版本恢复为 `1.0.0`，保留此前全部功能提交。
- 设计风格切换（2026-10-04，试用）：设置 → 外观新增「风格」，共 6 套：Neutral（原样）/ Material 3（官方 baseline 色板、12px 圆角、按钮全圆角）/ Fluent（Windows 11 配色与默认强调色、6px 圆角、Segoe UI Variable）/ Nord（Polar Night + Frost，低对比）/ Yaru（Ubuntu 橙、Ubuntu 字体，深色终端为经典茄紫色）/ Terminal（全等宽字体、直角、绿色强调，`--spacing` 缩小约 10% 更紧凑）。实现为 `<html data-style>` 下的 CSS 变量覆盖（`assets/styles/*.css`），组件未改；与亮/暗独立组合，存 localStorage（`devhub.style`），终端配色随风格切换。
  - 字体与状态色（ADR 0019）：随附 Roboto / Ubuntu Sans / JetBrains Mono 可变字体（Fontsource，约 470 KB，devDependencies）；Fluent 的 Segoe UI Variable 为专有字体不能打包，依赖系统。Terminal 风格关闭连字，命令原样显示。新增状态 token `success` / `warning` / `info`，运行中 / 启动中 / 停止中 / 批量进行中 / 扫描警告等不再写死颜色，各风格亮暗各一份；编辑器徽标与标题栏关闭按钮的红色保留。12 张截图人工确认，`pnpm check` 与 E2E 28/28 通过。`pnpm check` 与 E2E 28/28 通过（settings 用例覆盖切换与重启保持；一次整套运行中 `groups.spec.ts` 串行用例偶发关闭超时，单独 ×3 与重跑整套均通过）。待用户试用后决定保留哪些。
- 工作区（2026-10-04，ADR 0018）：用户选定「工作区」方案——记住一个目录，自动发现其中的项目并保持同步（默认扫描 1 层，可设 1～5 层；JS monorepo 子包暂不展开）。侧栏「添加」改为菜单（添加项目 / 添加工作区），项目按工作区分组（可折叠、显示扫描警告、重新扫描、设置），有工作区时手动项目归入「独立项目」；设置对话框可改层数、恢复已排除项目、二次确认移除工作区。
  - 规则：发现的项目存为普通项目（`workspaceId`），id 稳定；目录已删除保留为缺失、扫描不完整或项目运行中不移除、不再符合条件才移除（清理历史）；侧栏移除工作区内项目即排除；工作区不得互相包含。启动时后台重扫，窗口聚焦时重扫，变化经 `projects-updated` 推送。
  - 验证：Windows / Linux `pnpm check`（desktop 515、shared 61）与 E2E 均通过（Windows 28/28；Linux 27 通过、1 个崩溃遗留用例照常跳过）。新增 `workspaces.spec.ts`；界面已截图确认。提交 `15e49d1`（core）、`27e550e`（UI）及文档提交，均未推送。
  - 注意：同期另一会话（设计风格切换）与本任务并发跑 E2E 时，Windows 上 `groups.spec.ts` 串行用例关闭超时两次；单独重复 5 遍与无并发时整套均通过。多个会话不要同时跑 E2E（共用 `out/` 构建产物与机器资源）。

- 仓库门面（2026-10-03）：README 改为英文主版本 + `README.zh-CN.md`，含徽章（CI、版本、下载量、平台、许可证、技术栈）、截图、Star History；截图 `docs/assets/main.png` / `batch.png` 用临时 Playwright 脚本以演示项目在真实应用中截取（脚本未保留，界面变化较大时需重截）。新增 MIT `LICENSE`（`apps/desktop/package.json` 补 `license`）、`CONTRIBUTING.md`（开发约定与发布流程从 README 移入）、Issue 表单（Bug / 功能建议）与 PR 模板。`pnpm check` 通过。
- 桌面模板迁出（2026-10-03，ADR 0016 补充）：模板已移到同级目录 `D:\projects\vibe-coding\electron-desktop-template`（共 123 个源文件，不含依赖与产物），由用户创建独立仓库；DevHub 删除 `templates/` 及相应排除规则。新位置冻结 lockfile 安装后，`pnpm check`（31 + 45 + 2 个测试）、E2E 3/3、Windows 打包与产物校验均通过。新目录尚未 `git init`，也未提交。
- 桌面模板初始化与交付（2026-10-03，ADR 0017）：模板（当时位于 `templates/desktop`）新增 `pnpm initialize`，默认预览，`--yes` 才写入；只结构化改写 `app.config.json` 与两个 package.json；可重复执行，写入失败会回滚，并拒绝非模板目录和未确认的 appId 变更。窗口标题、打包配置、NSIS 安装子目录、产物名、更新缓存与更新源都从配置派生；无仓库时显式关闭发布。新增标识检查（纳入 check，发布模式更严格）、产物校验、CI、release 与 dependabot。
  - 验证（Windows）：模板 `pnpm check` 通过（脚本 31、desktop 45、shared 2 个测试）。默认配置和两组产品配置均通过 check 与 E2E 3/3；Windows 安装包、免安装包、可执行文件、更新源与产物校验一致，打包版能启动且标题正确。验证后已恢复模板默认标识。Linux 打包/E2E、远端 CI、真实安装与更新尚未验证；未创建远端仓库。

- 桌面模板提取（2026-10-03，ADR 0016）：用户确认方案后，在 `templates/desktop` 建立独立 pnpm workspace，保留窗口/托盘/单实例、类型化 IPC、事件、JSON 存储、设置/主题、原生对话框、安全外链和更新；加入可删除便签示例与中性图标，移除终端/脚本管理依赖。模板冻结 lockfile 安装、`pnpm check`（desktop 45、shared 2、审计 6 个测试）与 Windows E2E 3/3 通过。初始化脚本、安装器参数化、CI/发布和远端 Template 仓库为后续小任务；Linux 尚未验证。

- 运行历史完善（2026-10-03，ADR 0015）：启动即保存记录，重启后将未结束记录标为异常中断，结束时间/退出码保持未知；每个脚本保留最近 20 次已结束记录。支持清空单脚本历史，保留当前运行；移除项目同步清理历史及日志，屏蔽晚到的退出事件。每次运行单独保存最近 512 KB 日志，按秒检查点、退出时刷新；历史日志跨重启可查看，截断和缺失情况明确提示，淘汰/清空同步清理日志。旧记录兼容保留。
  - 验证：`pnpm check` 全部通过（desktop 476、shared 59、审计脚本 6 个测试；1 个 Linux 专属测试在 Windows 跳过）；整套 `pnpm e2e` 27/27 通过，约 1.3 分钟。新增 E2E 覆盖日志跨重启、600 KB 输出截断、清空/项目移除同步删日志、实际异常退出后的记录及日志恢复、旧记录缺失日志提示。日志写入失败不影响脚本启动与结束记录，并重试保存；清空元数据失败保留记录供重试。本次运行历史改动已提交；尚未推送或发布。
- 用户确认（2026-10-03）：上一轮小任务 1～3（提交推送与 CI、Windows 新安装、Windows 卸载）已完成。CLI 与手机端暂不实施，桌面端功能完成作为 MVP 范围。

- 批量任务运行视图（2026-10-03，ADR 0006 补充）：点击侧栏任务在右侧显示步骤进度、等待条件与超时、失败原因、独立进程/健康状态；按具体 runId 查看项目终端日志，历史运行不存在时显示日志不可用。显示本次启动或复用，明确停止范围包含复用运行；保存执行配置快照，编辑后展示和停止仍对应最近执行配置。修复停止期间延迟启动进程导致状态回退的问题。
- Windows 安装目录（2026-10-03，ADR 0014）：改为 NSIS 安装向导，可选择目录并自动创建 `devhub` 子目录；尾目录已是 devhub 时不重复，已有安装/静默升级保留原位置。完整 `build:win` 通过，真实 NSIS 路径函数 9/9 用例通过（根目录、尾分隔符、空格、中文等）；尚未进行实际安装或旧版本自动升级验证。
  - 目录页反馈修复：原实现直到开始安装才追加目录；改为自定义 nsDialogs 目录页，浏览选择立即更新输入框为最终路径，手动输入实时预览最终路径，继续安装使用同一规范化函数。真实 NSIS 控件验证 `D:\software\`、已有 devhub、盘符根目录、中文目录的预览与提交路径均通过；修正版 `devhub-0.1.7-setup-directoryfix.exe` 构建成功，重新运行 `pnpm check` 和 E2E 24/24 均通过。实际安装与旧版自动更新仍待验证。
  - 集成验证：`pnpm check` 全部通过（desktop 459、shared 55、审计脚本 6 个测试；1 个 Linux 专属测试在 Windows 跳过）；`pnpm e2e` 24/24 通过，约 1.2 分钟，覆盖详情条件、失败取消、完成后停止、精确日志导航、复用与重启后日志失效。

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
- 自定义 shell：设置页添加程序路径与参数，出现在「+」菜单中、可设为默认（ADR 0007 补充）；E2E 用 Node REPL 作为自定义 shell 覆盖
- Linux 上 `mvnw` / `gradlew` 没有执行权限时改用 `sh ./mvnw` 运行（有权限时仍是 `./mvnw`）；真实权限位测试只在 Linux CI 运行
- CI 缓存 Electron 与 electron-builder 的下载（`ELECTRON_CACHE` / `ELECTRON_BUILDER_CACHE` 指向仓库外的统一目录，按任务与 OS 分别缓存）；发布流程有意不使用缓存，避免缓存投毒影响分发的安装包
- 自动更新（ADR 0009，新依赖 electron-updater）：Windows 安装版与 Linux AppImage 从 GitHub Releases 检查更新，用户决定下载与重启安装；顶栏提示 + 设置页「关于与更新」；发布流程上传 `latest*.yml` 与 `.blockmap`
  - 已验证：本地打包产物含 `latest.yml` 与 `app-update.yml`，运行打包版能连上 GitHub 并正确提示 v0.1.2 缺少更新信息；完整更新流程需发布两个新版本后实测
- 侧栏改为「项目 / 批量」两个标签页（radix Tabs，无新依赖），各自占满侧栏高度并独立滚动；选中的标签记在本地；批量任务执行中时「批量」标签显示脉冲圆点；E2E 覆盖切换、圆点出现与消失、重启后保留标签
- `@electron-toolkit/eslint-config-ts` 升到 v4（内含 `@eslint/js` v10，ESLint 本体仍为 v9）：新推荐规则 `preserve-caught-error` 要求包装错误时带 `cause`，`no-useless-assignment` 修正了 E2E 重启后多余的 `app` 赋值
- 自制标题栏（ADR 0010）：Windows / Linux 去掉系统边框，标题栏含 logo、版本、更新提示、设置与最小化 / 最大化（还原）/ 关闭按钮，可拖动窗口；macOS 保留红绿灯（`hiddenInset`）；ShellApi 新增窗口控制与 `onWindowState`
  - E2E 1 个（最大化 / 还原 / 最小化，关闭后隐藏到托盘；CI 的 xvfb 无窗口管理器只测关闭）；深浅色与关闭悬停已截图确认
- 真实 Linux 桌面验证（Linux Mint 22.2 / Ubuntu 24.04 基础，X11 + Cinnamon，Node 24）：`pnpm check` 全部通过（含 Linux 杀进程树、SIGHUP 的真实进程集成测试），E2E 20 个通过（崩溃遗留进程用例跳过：pty 关闭时 SIGHUP 已结束脚本），AppImage + deb 打包成功、`pty.node` 从源码编译并正确解包
  - 打包版手动确认：无系统边框、拖动标题栏移动与贴靠、双击标题栏最大化 / 还原、边缘与四角调整大小、关闭隐藏到托盘并可唤回、Super+方向键贴靠
- 拆分 `run-manager.ts`（375 → 250 行）：启动一个运行移到 `run-entry.ts`，两阶段停止移到 `stop-run.ts`；纯重构，原测试未改
- 健康检查（M3，ADR 0011）：运行中的脚本显示启动中 / 就绪 / 无响应，悬停显示检查目标，终端标签圆点同色；默认检查推断出的端口，`.devhub.yaml` 写 `health: /路径` 改为 HTTP 2xx；就绪后连续 3 次失败转为无响应
  - `core/health/` 订阅运行事件、独立于 RunManager；事件 `run-health` + API `listRunHealth`；HTTP 检查用 Node 自带 fetch，无新依赖
  - 批量执行新增继续条件「HTTP 返回成功」（http / https 地址，2xx）
  - 测试：状态机（假时钟）、检查目标、真实 HTTP 服务（2xx / 404 / 重定向 / 超时）、配置字段、条件；E2E 1 个（先监听但返回 503 → 仍为启动中 → 2xx 后就绪 → 停止后徽标消失）
- 运行历史（M3）：脚本行「历史」按钮弹出最近的运行（今天 / 昨天 / 日期 + 时间、时长、已完成 / 已停止 / 退出码 N），打开时有运行结束会自动刷新
  - `core/history/run-history.ts` 订阅运行事件，脚本退出时记录，每个脚本保留最近 20 次，存 `run-history.json`（跨重启）；交互式终端不记录；退出 DevHub 时等待最后的记录写完
  - API `listRunHistory(projectId, scriptId)`；新增 shadcn `popover` 组件（来自已有的 radix-ui，无新依赖）
  - 测试：6 个单元测试（记录与排序、忽略运行中 / shell / 重复退出、按脚本截断、跨会话读取、无效 id、写入失败仍可用）；E2E 1 个（失败与停止的运行、打开时刷新、重启后保留）；Windows + Linux 均通过
- 修复 E2E 中 `app.getVersion()` 返回 Electron 版本：E2E 原先启动 `out/main/index.js`，Electron 找不到 package.json；改为启动应用目录（经 `main` 进入同一入口）；标题栏用例断言显示的是应用版本
- 健康检查后续（2026-10-03）：升级 `@types/node` 26.6.4、shadcn 4.21.1、Vitest 5.0.3；新增独立 CI 依赖审计报告（ADR 0012），不隐藏告警，网络 / 格式错误仍失败。
  - Windows E2E 关闭超过 10 秒时保存 Electron 输出、退出状态与进程快照；失败关闭不再被吞掉，新增 5 个诊断与清理测试。启动时缓存子进程，避免重启后访问已销毁的 Playwright 对象；一个实例关闭失败仍尝试清理其余实例。原有偶发退出超时根因仍待实际失败证据。
  - 自动更新修复：显式等待核心清理成功再请求安装，失败不安装、重复请求不重复安装；新增 3 个顺序与失败测试。v0.1.5 / v0.1.7 已有公开更新元数据；下载 v0.1.7 Windows 安装包（115,576,942 字节）与 sha512 校验一致，未执行安装器。
  - 验证：`pnpm check` 全部通过（449 个测试通过，1 个 Linux 权限测试跳过）；完整 E2E 23/23 通过，约 1.1 分钟；冻结 lockfile 安装与 CI YAML 解析通过。审计脚本本机真实运行成功并展示 2 项 high，新增 6 个审计测试覆盖告警与网络 / 格式 / 执行失败。本机无可用 Windows Sandbox，真实安装升级与本次两平台远端 CI 尚待验证。

### 下一步（M1）

1. 在 Windows Sandbox / VM 中实测 v0.1.5 → v0.1.7 完整安装升级；Linux 在 X11 下验证临时 AppImage 副本。已有两个带更新元数据的公开版本，无需为验证额外发布；Wayland 暂缓。
2. 脚本识别 a / b / c、批量任务运行视图与运行历史已实现；Windows 新安装和卸载已获用户确认。CLI、手机端与 Jira 暂缓。
   - a. monorepo 子包已实现：优先子包配置，缺失时逐级向上找 `packageManager` / lockfile / `pnpm-workspace.yaml`，检查含 `.git` 文件或目录的这一层后停止（最多 5 层父目录）；命令仍在子包目录执行。新增继承、优先级、仓库边界、深度限制与损坏配置测试；Jira 集成暂缓。
     - 验证（2026-10-03）：沙箱外 `pnpm check` 全部通过（463 个测试通过，1 个 Linux 权限测试跳过）；沙箱内两个真实进程清理测试超时，沙箱外重跑通过。本次仅修改探测器与文档，未修改 UI、IPC/preload 或进程管理，未运行 E2E。
   - b. Gradle 多项目已实现（ADR 0013）：静态 `include` / `projectDir=file(...)`，支持嵌套与去重；子项目按插件生成完整路径启动命令，使用根 wrapper、子项目端口；多项目根启动限定 `:bootRun` / `:run`。忽略注释、字符串示例、`apply false`；动态配置转为探测警告，可用 `.devhub.yaml` 补充。
   - c. Maven 多模块已实现（ADR 0013）：静态模块递归最多 3 层；应用模块分别提供 `-pl <模块> -am install -DskipTests` 与 `-pl <模块> spring-boot:run`；根 wrapper、子模块端口、稳定 id。聚合 POM 不启动，根应用含模块时用 `-N`；支持已扫描的直接本地父模块插件继承，不计算 effective POM 或外部父模块。两条开发线在独立 worktree 中并行完成并集成，路径、命令与符号链接边界均有测试。
     - 集成验证（2026-10-03）：沙箱外 `pnpm check` 全部通过（513 个测试通过，1 个 Linux 权限测试跳过）；`pnpm e2e` 24/24 通过，约 1.2 分钟，新增用例验证 Gradle / Maven 子模块命令与端口在真实应用中展示。沙箱内 Electron 因 Windows ACL 限制无法启动，沙箱外重跑通过；未改系统 ACL。
   - 不在范围内：添加 monorepo 根目录时列出所有子包脚本（目前可把子包分别添加为项目）
3. 本次运行历史改动提交推送后确认 Windows / Ubuntu CI；上一轮提交 `8604a39` 的推送及 CI 已获用户确认，此结果不覆盖本次运行历史改动。
4. 完成升级验证后发布新的桌面 MVP 版本；版本、tag 与 Release 尚未变更。
5. 提交与发布基础设施（待做，用户 2026-10-03 决定暂缓；完成后同步到模板）：
   - 提交信息校验：husky `commit-msg` 钩子检查 Conventional Commits，CI 对 PR 内提交复查（兜住 `--no-verify` 与网页提交）。
   - 变更日志：`pnpm release` 时按上个 tag 以来的提交生成 `CHANGELOG.md` 段落并随版本提交；`release.yml` 用该段落作为 Release 正文，替换 `--generate-notes`（提交直接进 main，按 PR 生成的说明基本为空）；补齐 v0.1.1～v0.1.8。
   - 实现候选：自写零依赖脚本（推荐，发布流程不变）/ commitlint + git-cliff（新依赖，需 ADR）/ release-please（改为合并发布 PR 的流程）。

### 已知问题 / 待定

- 仓库健康检查（2026-10-03，main `22443ad`）：本机 `pnpm check` 通过（435 个测试通过，1 个 Linux 权限测试在 Windows 跳过），E2E 23/23 通过；该提交的 Windows / Ubuntu CI 检查、E2E 与安装包构建均成功。调查前主工作区及另两个 worktree 均干净，无开放 PR。
  - 依赖审计：开发工具链有 2 项 high（electron-builder 间接依赖 `http-cache-semantics@4.2.0`、shadcn 间接依赖 `braces@3.0.3`）；官方 GHSA 尚无修复，npm 审计给出的 4.2.1 / 3.0.4 范围并非已发布、上游确认的修复。下载路径未默认启用 got HTTP 缓存，应用仅引用 shadcn CSS，未发现当前运行路径具备告警的触发条件；持续展示全部告警，不添加豁免。`audit --prod` 无告警，但 renderer 放在 devDependencies，不能据此断言整个安装包无漏洞。
  - Vite 8 / plugin-react 6 需与 electron-vite 一起升级，TypeScript 7 超出当前 typescript-eslint 支持范围，ESLint 10 需单独验证插件兼容。现存 peer 告警为 eslint-config-ts 4 内的 `@eslint/js@10` 要求 ESLint 10，当前沿用已通过检查的 ESLint 9；此次补丁升级未新增该告警。
- 脚本命令目前是字符串（经 shell 执行）；进程管理时再决定是否改为 argv 形式
- E2E 偶发：Windows 上 `groups.spec.ts` 的串行用例在整套连续运行时偶尔超时（结束时关闭应用超过 60 秒，约 1/20），单独重复运行未复现；原因未查明
- 安装包多带了 node-pty 的其他平台预编译文件与源码 / 测试（Linux 包约 2 MB 未压缩，`.pdb` 已被 electron-builder 默认排除）；已评估收益小（安装包 100+ MB），且排除规则写错只会在打包版中暴露，暂缓到下次修改打包配置时处理
- 运行历史：异常中断的结束时间/退出码无法还原，日志检查点之后的最后一部分可能未保存；旧记录没有历史日志。
- Maven / Gradle 多模块识别仅覆盖静态声明；Gradle 插件继承、版本目录别名和动态 include，Maven Profile / pluginManagement / 外部父 POM 未计算，可用 `.devhub.yaml` 显式补充；本机未实际构建 Java 应用。
- Android 项目的 `assembleDebug`、`installDebug` 等任务暂不识别
- Linux 上自己 `setsid` 脱离进程组的守护进程杀不到；崩溃后的遗留进程只有当记录的根进程本身存活时才能发现（子进程脱离后根进程已退出的情况发现不了）
- Windows 上 node-pty 在进程自然退出后会在 stderr 打印 `AttachConsole failed`（释放资源时的辅助进程），不影响功能
- Windows 上 Node.js 子进程在 ConPTY 下收不到新尺寸（`process.stdout.columns` 不更新，libuv 行为）；调整终端大小后 Node 工具的换行可能仍按旧宽度
- Linux 只在 X11（Cinnamon）上验证过，Wayland 会话未测，按用户要求暂不验证
- 在 VSCode 集成终端中启动 `pnpm dev` 需先清除 `ELECTRON_RUN_AS_NODE`（VSCode 会设置它，导致 Electron 以 Node 模式运行）：`env -u ELECTRON_RUN_AS_NODE pnpm dev`
- 终端：Windows 上清屏后若终端尺寸变化，ConPTY 会重发旧屏幕内容
- 编辑器：本机已安装 IDEA（D 盘自定义目录），经注册表检测成功；实际打开项目待人工点一次确认；检测不到时可在设置中手动指定；`reg query` 输出按系统代码页解码，安装路径含中文时可能识别不到
- 发布待办（GitHub 仓库设置，非代码）：开启 Immutable releases；为 `v*` tag 加 ruleset 限制创建者
- 发布：安装包不做签名（已决定，Windows SmartScreen 会提示）；v0.1.2 及更早版本没有 latest.yml，需手动升级一次
- 自制标题栏：Win11 悬停最大化按钮的贴靠布局菜单不再出现
- 端口推断是启发式的：脚本里没写端口、也不是已知工具时不检查
