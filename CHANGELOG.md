# Changelog

User-facing changes in each DevHub release. `pnpm release` generates each section from the
Conventional Commits since the previous tag (`scripts/changelog.mjs`), and the Release workflow
uses it as the GitHub Release notes.

## v1.11.0 - 2026-11-18

### Features

- **test:** 支持单元测试与系统集成测试快慢分流 (958aa47)
- add scheduled task execution for scripts and groups (4f393b9)

## v1.10.9 - 2026-11-17

### Fixes

- **terminal:** 修复窄屏终端页可视区过小导致 E2E 失败 (Closes #124) (e2684fd)
- **terminal:** 每次终端显示都刷新快照而非仅首次 (531ce6c)
- **terminal:** 终端显示时重取快照修复慢速 CI 输出为空 (6250e90)

## v1.10.8 - 2026-11-17

### Features

- 标题栏采用品牌图标，支持运行态任务栏与桌面快捷方式图标风格切换 (Closes #122, Closes #123) (33b2532)
- 全局搜索浅色适配、紧凑功能导航栏与项目列表宽度可调 (d7a0cc9)

### Fixes

- 消除批量任务绝对定位元素穿透引起的视口滚动 (0225d13)
- 修复批量任务页面全局溢出滚动并移除项目条目悬停编辑器图标 (38bbff3)

## v1.10.7 - 2026-11-16

### Fixes

- 修复 1024 桌面分辨率下项目详情被压缩至 0 宽导致的可见性检查失败 (Closes #118) (6c09980)

## v1.10.6 - 2026-11-16

### Fixes

- 适配 Windows 高 DPI 最小桌面宽度 (Refs #117) (edcc203)
- 适配 Windows 高 DPI 最小桌面宽度 (Refs #117) (83bb9d8)

## v1.10.5 - 2026-11-16

### Fixes

- 适配更窄高 DPI 桌面项目布局 (Refs #117) (405f0f3)
- 适配更窄高 DPI 桌面项目布局 (Refs #117) (3e875f0)

## v1.10.4 - 2026-11-16

### Fixes

- 兼容超窄桌面项目双栏布局 (Refs #117) (29bfdf0)
- 兼容超窄桌面项目双栏布局 (Refs #117) (30e705b)

## v1.10.3 - 2026-11-16

### Fixes

- 兼容高 DPI 窄桌面项目布局 (Refs #117) (02c5b27)
- 兼容高 DPI 窄桌面项目布局 (Refs #117) (ce8d23b)

## v1.10.2 - 2026-11-16

### Fixes

- 修复窄桌面项目布局不可见问题 (Refs #117) (e8e723c)
- 修复窄桌面项目布局不可见问题 (Refs #117) (d92d69f)

## v1.10.1 - 2026-11-16

### Features

- 重构功能导航并精简侧栏入口 (Closes #117) (5880765)

## v1.10.0 - 2026-11-14

### Features

- **core:** 支持 Python 语言项目环境嗅探与脚本管理 (Closes #116) (8ce5307)
- **core:** 支持 Go 语言项目工作区识别、多入口脚本探测与生命周期管理 (Closes #115) (92ecb93)
- **renderer:** 统一全局消息通知中心、精简外观模式与基于主题翠绿焕新软件图标 (9245f1b)
- **renderer:** 全局统一滚动条样式（对齐暗色科技原型设计） (Closes #112) (#113) (1717001)
- **desktop:** 补齐项目设置分栏视图、脚本端口交互与全页面按钮交互反馈 (Closes #110) (#111) (13bc837)
- 对齐原型科技暗色主题并支持浏览器模式测试 (#109) (e921cd1)
- 对齐项目工作区与双栏运行历史面板（对齐画板 eM1tc 与 G3SBfh） (#107) (3be0002)
- 重构主工作区路由与落地两栏式批量任务中心（对齐画板 vQtHE） (#105) (0240fcc)
- **project:** 重构运行历史与项目设置面板对齐原型设计 (#103) (240d0a7)
- **groups:** 重构批量任务主面板与步骤时间线对齐原型设计 (#101) (153a5b2)
- **workspace:** redesign project detail and terminal panel with tabs and command bar (#99) (47fc58f)
- **sidebar:** redesign project sidebar with modern cards and active runs monitor (#97) (945612f)
- **desktop:** 重构全局布局骨架与现代顶底栏 (b988964)

### Fixes

- **desktop:** 移除项目条目悬浮详情卡片避免遮挡 (639ccb9)

## v1.9.0 - 2026-11-10

### Features

- 启动前安全释放显式端口 (3498e0b)

### Fixes

- **windows:** 容忍已退出的父进程 (085b56b)
- **windows:** 加速端口监听进程查询 (a232622)
- 移除标题栏重复的批量任务信息 (63726a0)
- 刷新时清理已删除的项目 (34c3ec2)

## v1.8.0 - 2026-11-06

### Features

- 支持项目与批量任务置顶 (7384395)

### Fixes

- recover stale Linux single-instance locks (55dc08d)

## v1.7.3 - 2026-11-01

### Performance

- **mobile:** defer first drawer content until animation ends (cbfd5a7)

## v1.7.2 - 2026-10-31

### Fixes

- let mobile users cancel stalled connection checks (6a893c2)

### Performance

- keep mobile drawer work off its opening animation (9dc2aa1)

## v1.7.1 - 2026-10-30

### Fixes

- **release:** preserve Linux GLIBC compatibility (ddb4ab2)

## v1.7.0 - 2026-10-30

### Features

- **desktop:** enable in-app updates for Linux deb users (cb26489)
- make the DevHub repository accessible from the title bar (f2bf488)

### Fixes

- prevent project hover scans from freezing the app (2f088f5)

## v1.6.0 - 2026-10-29

### Features

- **projects:** surface active projects in the sidebar and as the default selection (#61) (1b90473)

### Fixes

- **mobile:** resolve broken lockfile and align ScrollView ref type (985d087)
- **mobile:** give up on an unanswered connection check after 10 s (#49) (ce1ff55)

## v1.5.0 - 2026-10-09

### Features

- **groups:** show which batch run is running (362b576)

### Fixes

- **desktop:** quit on SIGTERM when no scripts are running (#45) (28fb111)
- **remote:** retry a taken port at startup instead of giving up (#44) (eeb40e6)
- **mobile:** tell the user to upgrade an old desktop instead of blaming the network (#43) (2eb482f)

## v1.4.0 - 2026-10-07

### Features

- **mobile:** connect the Android app by scanning the desktop QR code (9888095)
- **mobile:** give the Android app the DevHub icon and launch screen (59b7bb2)
- **settings:** copy the whole connect link for the Android app (a1ba843)
- **mobile:** live-update the app's web bundle to match the desktop (d917e7a)
- **remote:** report the desktop's version in the remote session (343265a)
- **mobile:** package the web app as an Android app with Capacitor (e7fdfa6)
- **remote:** allow the Android app's origin through CORS (748e620)
- **mobile:** add the Expo Android client skeleton (0523043)
- make the web app installable and document HTTPS via tailscale serve (20d09d9)
- **renderer:** offer project actions behind a "more" button on touch screens (14b4928)
- **renderer:** fit the web app to phone-sized screens (4b0c507)
- **remote:** prefer LAN addresses and rank proxy TUN adapters last (8c3cc04)

### Performance

- **renderer:** load the terminal and settings on demand (983bab6)

## v1.3.0 - 2026-10-05

### Features

- **renderer:** run as the web app over the remote API (1d0d033)
- build the renderer as a web app and serve it from the remote server (81e19e1)
- **shared:** add the remote HTTP + SSE client and a session endpoint (387902c)
- configure remote access from settings, with a connection QR code (7fdb100)
- **core:** push core events to remote clients over SSE (2d89951)
- **core:** serve DevhubApi over an opt-in remote HTTP API (4e3ee5a)

### Fixes

- **website:** override VitePress's vite 5 to the patched 6.4.3 (ae7085b)
- **core:** resolve the user's environment for started processes (75ccf29)
- **core:** do not create remote.json while remote access is off (5abdc8c)

## v1.2.0 - 2026-10-05

### Features

- **desktop:** safer and richer project list interactions (885d581)
- **website:** make Chinese the primary language (18f07fc)
- **website:** add a bilingual VitePress site deployed to GitHub Pages (bf7040c)

### Fixes

- **desktop:** open project hover cards only under the pointer (4ea5a60)
- **website:** make Chinese search work and keep old /zh/ links alive (6cd6e24)

## v1.1.0 - 2026-10-04

### Features

- bundle per-style fonts and make run-state colors follow the style (9cbae30)
- add Nord, Yaru and Terminal design styles (27f8805)
- add switchable design styles (Neutral, Material 3, Fluent) (a2bd6a7)
- show workspaces in the sidebar, grouped and kept in sync (27e550e)
- discover and sync projects in workspace directories (core) (15e49d1)

## v1.0.0 - 2026-10-03

First stable release: the same app as v0.1.8, with an English README, license and contributing
guide.

## v0.1.8 - 2026-10-03

### Features

- preserve run history and logs across restarts (089543f)
- clarify batch runs and install paths for multi-project workflows (8604a39)

## v0.1.7 - 2026-10-03

### Features

- keep a history of how each script's runs ended (bb8baab)
- show whether running scripts are ready (health checks) (d2c439f)

## v0.1.6 - 2026-10-02

### Features

- replace system title bar with a custom one (7a481e6)
- combine projects and batch groups into sidebar tabs (65df013)

## v0.1.5 - 2026-10-02

No user-facing changes (development dependency updates).

## v0.1.4 - 2026-10-02

### Features

- update DevHub itself from GitHub Releases (6d3a260)
- custom shells with their own path and arguments (bff2ac5)
- regex output conditions and remembered group results (7441d69)
- custom scripts from a project's .devhub.yaml (dcce6a9)
- warn before starting a script whose port is taken (c8cd17d)
- add a settings page (89dba55)

### Fixes

- run mvnw / gradlew through sh when they are not executable (64bda4a)

## v0.1.3 - 2026-10-02

### Features

- offer to stop processes left behind by a crash (f5642ff)
- show which projects still have live terminals (5f47eeb)
- batch-run scripts across projects, in parallel or in sequence (3491c32)
- make the terminal a full interactive terminal (a7f8f36)
- open interactive terminals in a project (Git Bash by default) (ab68c00)
- open projects in VS Code or IntelliJ IDEA (756ea54)

### Fixes

- answer cmd's batch-job prompt so npm scripts stop in a second (a7a69f6)
- give the dev build its own userData (f3f146e)

## v0.1.2 - 2026-10-02

### Fixes

- add package metadata the Linux deb build requires (42e11df)

## v0.1.1 - 2026-10-02

### Features

- open terminal links with Ctrl+click, restrict to http(s) (eecf52c)
- stream run output to an xterm terminal panel (abf97a3)
- run, stop and restart scripts with process-tree cleanup (d3cd2b5)
- add DevHub app icon set with one-command generator (803d19f)
- list detected scripts in project detail view (28d7a76)
- add gradle script detector (9838338)
- add maven script detector (d07e9f2)
- add script detector interface and npm detector (94f99fe)
- add project registry with JSON persistence (68bd602)

### Fixes

- produce installers named devhub-* and drop dev files from the package (b0cf0be)
