# 进度

> 任务、计划与验证记录在 GitHub Issues 中管理（ADR 0021）。本文件只记录当前阶段、进行中的 issue 与已知问题，保持简短。2026-10-05 之前的详细记录见 [progress-archive.md](progress-archive.md)。

- 看板：[DevHub Roadmap](https://github.com/users/Delta1035/projects/2)
- 待办：[开放的 issue](https://github.com/Delta1035/devhub/issues)

## 当前阶段：桌面 MVP 发布 → M4 远程管理

桌面 MVP（项目/脚本管理、进程与终端、批量任务、工作区、设置、健康检查、运行历史）已完成，最新版本 v1.2.0。用户决定（2026-10-05）先不收尾 MVP 发布，直接开始 M4：远程 API → PWA → Android。CLI、Jira 与 Wayland 暂缓。

| Milestone                                                        | 内容                                               | Issue    |
| ---------------------------------------------------------------- | -------------------------------------------------- | -------- |
| [桌面 MVP 发布](https://github.com/Delta1035/devhub/milestone/1) | 两平台升级验证、官网审计告警、提交校验与 CHANGELOG | #7～#11  |
| [M4-1 远程 API](https://github.com/Delta1035/devhub/milestone/3) | ADR、HTTP 自动映射、SSE 事件推送、设置页、E2E      | #12～#16 |
| [M4-2 PWA](https://github.com/Delta1035/devhub/milestone/2)      | HTTP / SSE 客户端、手机布局与托管                  | #17、18  |
| [M4-3 Android](https://github.com/Delta1035/devhub/milestone/4)  | Expo ADR、客户端骨架、构建与发布 CI                | #19～21  |

### 进行中

- M4-1 远程 API：#12（ADR 0022）、#13（HTTP 服务）、#14（SSE 事件推送）、#15（设置页「远程访问」与配置 API、连接二维码，ADR 0023 引入 uqr）、#16（远程 E2E）已完成，M4-1 全部完成。M4-2：#17 已完成——网页版复用桌面 renderer（用户选择），由远程服务托管，扫码即连接；远程不允许的操作已隐藏。下一步 #18 手机布局（侧栏抽屉等）、可安装 PWA 与 HTTPS（`tailscale serve`）。真实手机尚未实际连接验证；远程相关代码尚未在 Linux 真机上运行（CI 的 Ubuntu 会跑单元测试与 E2E）。
- 桌面修复：#22 已完成——启动的子进程不再直接继承 DevHub 的环境：Windows 从注册表修复并补全 PATH（更新后经 Explorer 重启时 `%NVM_HOME%` 未展开、找不到 pnpm），Linux 捕获交互登录 shell 的环境（从桌面启动时缺少 `.bashrc` 中的 nvm）（ADR 0024）。

## 已知问题 / 待定

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
