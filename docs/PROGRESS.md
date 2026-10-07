# 进度

> 任务、计划与验证记录在 GitHub Issues 中管理（ADR 0021）。本文件只记录当前阶段、进行中的 issue 与已知问题，保持简短。2026-10-05 之前的详细记录见 [progress-archive.md](progress-archive.md)。

- 看板：[DevHub Roadmap](https://github.com/users/Delta1035/projects/2)
- 待办：[开放的 issue](https://github.com/Delta1035/devhub/issues)

## 当前阶段：桌面 MVP 发布 → M4 远程管理

桌面 MVP（项目/脚本管理、进程与终端、批量任务、工作区、设置、健康检查、运行历史）已完成，最新版本 v1.4.0。用户决定（2026-10-05）先不收尾 MVP 发布，直接开始 M4：远程 API → PWA → Android。CLI、Jira 与 Wayland 暂缓。

| Milestone                                                        | 内容                                               | Issue       |
| ---------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| [桌面 MVP 发布](https://github.com/Delta1035/devhub/milestone/1) | 两平台升级验证、官网审计告警、提交校验与 CHANGELOG | #7～#11     |
| [M4-1 远程 API](https://github.com/Delta1035/devhub/milestone/3) | ADR、HTTP 自动映射、SSE 事件推送、设置页、E2E      | #12～#16    |
| [M4-2 PWA](https://github.com/Delta1035/devhub/milestone/2)      | HTTP / SSE 客户端、手机布局与托管                  | #17、18     |
| [M4-3 Android](https://github.com/Delta1035/devhub/milestone/4)  | Capacitor ADR（0027）、客户端壳、构建与发布 CI     | #19～21、30 |

### 进行中

> 每个 issue 单独一行，新条目追加到所属分组末尾；只改自己 issue 的那一行，避免并行分支在同一行冲突。

M4-1 远程 API（全部完成）：

- #12 已完成：远程 API 设计（ADR 0022）。
- #13 已完成：HTTP 服务。
- #14 已完成：SSE 事件推送。
- #15 已完成：设置页「远程访问」与配置 API、连接二维码（ADR 0023 引入 uqr）。
- #16 已完成：远程 E2E。

M4-2 PWA：

- #17 已完成：网页版复用桌面 renderer（用户选择），由远程服务托管，扫码即连接；远程不允许的操作已隐藏。
- #25 已完成：监听地址按 Tailscale → 局域网 → 其他 → 代理虚拟网卡（`198.18.0.0/15`，设置页标注）排序，二维码随之使用局域网地址。
- #18 代码已完成，待真机验收：窄屏侧栏改为抽屉、触屏「⋯」菜单、manifest 可安装（不加 service worker）、HTTPS 交给 `tailscale serve`（设置页与官网「手机访问」说明，二维码暂不生成 HTTPS 链接）、终端与设置页按需加载（首屏 gzip 330 → 185 KB）。
- 未验证：真实手机经 Tailscale 安装与连接、经 `tailscale serve` 时 SSE 不被缓冲（本机未装 Tailscale）；远程相关代码尚未在 Linux 真机上运行（CI 的 Ubuntu 会跑单元测试与 E2E）。

M4-3 Android：

- #19 已完成：先用 Capacitor 包装网页版，Expo 原生客户端推迟（ADR 0027）。
- #20 已完成（v1.4.0）：`apps/mobile-capacitor`（Capacitor 8，`io.github.delta1035.devhub`）：连接页可填地址、粘贴或扫描连接地址，地址与 Token 存 Keystore，返回键先关浮层再退到后台；远程服务只对 `http://localhost` 开放 CORS；App 用单独的构建模式放宽 CSP 的 `connect-src`。
- #21 已完成（v1.4.0）：CI 每个 PR 构建未签名 APK；推 tag 后草稿 Release 含签名的 `DevHub-<版本>.apk` 与网页包（已验证）；版本号随桌面端（ADR 0029）。
- #30 已完成：保留按 Expo 方案做的原生客户端骨架（`apps/mobile`，ADR 0028）作为以后 Expo 客户端的基础；Capacitor 目录改为 `apps/mobile-capacitor`。
- #32 已完成（v1.4.0）：App 跟随所连桌面端的版本在线更新网页包（ADR 0030）；已用真实 GitHub Release（v1.4.0）验证下载、签名校验与切换。
- #35 已完成（v1.4.0）：设置页「复制连接地址」。
- #36 已完成（v1.4.0）：Android 图标与启动画面由桌面端 SVG 生成。
- #37 已完成（v1.4.0）：App 内扫码连接（`@capacitor/barcode-scanner`，不依赖 Google Play 服务，minSdk 26）；实际识别待真机验证。
- #41 已完成，待合并：桌面端早于 1.4（不支持 App 的 CORS）时，App 提示升级桌面端，而不是「检查网络」（真机反馈）。

桌面修复：

- #22 已完成：启动的子进程不再直接继承 DevHub 的环境：Windows 从注册表修复并补全 PATH（更新后经 Explorer 重启时 `%NVM_HOME%` 未展开、找不到 pnpm），Linux 捕获交互登录 shell 的环境（从桌面启动时缺少 `.bashrc` 中的 nvm）（ADR 0024）。
- #39 待开始：Linux 上收到 SIGTERM 不退出（#8 中发现），关机或注销时可能留下孤儿进程。
- #42 已完成，待合并：远程服务启动时端口被占用（更新后旧进程尚未退出）会重试约 15 秒，期间状态显示「正在重试」；修改设置时的冲突仍立即报告。

桌面 MVP 发布：

- #9 已完成：官网 Vite 经 pnpm overrides 提升到 6.4.3（ADR 0025），审计剩 2 high（electron-builder 链 http-cache-semantics、shadcn 链 braces，上游无修复）；VitePress 2 稳定后删除该 override。
- #10 已完成：提交信息校验与 CHANGELOG（ADR 0026），Release 正文改为取自 `CHANGELOG.md`，待下次发布时验证；已发布版本的 Release 正文暂不修改。已同步到模板仓库 [electron-desktop-template](https://github.com/Delta1035/electron-desktop-template)（78e45ce，模板 ADR 0009）。
- #8 已完成：Linux Mint（X11）上 AppImage 自动更新 1.3.0 → 1.4.0 实测通过（增量下载、替换文件、自动重启、数据保留）。

## 已知问题 / 待定

- 脚本命令目前是字符串（经 shell 执行）；进程管理时再决定是否改为 argv 形式
- E2E 偶发：Windows 上 `groups.spec.ts` 的串行用例在整套连续运行时偶尔超时（结束时关闭应用超过 60 秒，约 1/20），单独重复运行未复现；原因未查明
- 安装包多带了 node-pty 的其他平台预编译文件与源码 / 测试（Linux 包约 2 MB 未压缩，`.pdb` 已被 electron-builder 默认排除）；已评估收益小（安装包 100+ MB），且排除规则写错只会在打包版中暴露，暂缓到下次修改打包配置时处理
- 运行历史：异常中断的结束时间/退出码无法还原，日志检查点之后的最后一部分可能未保存；旧记录没有历史日志。
- Maven / Gradle 多模块识别仅覆盖静态声明；Gradle 插件继承、版本目录别名和动态 include，Maven Profile / pluginManagement / 外部父 POM 未计算，可用 `.devhub.yaml` 显式补充；本机未实际构建 Java 应用。
- Expo 客户端骨架（`apps/mobile`）：只在 Windows 上的模拟器（API 36）经 Expo Go 验证过，未在真机上运行；Windows 本地原生构建因 pnpm 路径过长失败（ADR 0028），尚无 APK 构建（#21 只构建 Capacitor）；没有应用内扫码（需粘贴连接地址）；日志页只显示最近 128 KB 纯文本
- Capacitor 客户端（`apps/mobile-capacitor`）：只在模拟器上验证过，未在真机上运行；扫码的实际识别未验证（模拟器虚拟场景不显示自定义二维码图片）；本地构建需 JDK 21（`D:\projects\_envs\jdk-21`）且 Gradle 要走代理
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
