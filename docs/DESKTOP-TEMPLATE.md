# 桌面应用基础模板提取方案

状态：用户已确认；基础代码、初始化、打包与 CI/发布配置已完成（ADR 0017），并迁出到同级目录 `../electron-desktop-template`；Linux 与远端 CI 待验证。日期：2026-10-03。独立仓库：[Delta1035/electron-desktop-template](https://github.com/Delta1035/electron-desktop-template)（2026-10-05 记录）。

## 交付形式与范围

第一版交付独立的 GitHub Template 仓库，工作名称 `electron-desktop-template`。先在独立目录完成代码、初始化脚本、测试和安装包验证，再创建远端仓库并开启 Template 属性。DevHub 继续作为业务应用维护，不改为模板，也不让它依赖尚未稳定的模板包。

第一版只做基础桌面应用；终端、进程执行、任务编排作为后续扩展。暂不发布 npm CLI、公共运行时包或 Skill。初始化使用仓库内的 Node 脚本，不增加依赖。

GitHub Template 创建的是独立代码副本，后续修复不会自动同步。模板用版本和变更记录标识更新，记录提取源提交；以后至少两个真实项目验证接口后，再评估公共包。

## 保留、改造与排除

| 能力                 | 来源                                                         | 第一版处理                                                            |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| 工程骨架             | 根配置、desktop 构建配置、shared                             | 保留 pnpm、Electron、React、TypeScript 及现有架构约束                 |
| 生命周期、窗口、托盘 | main/index.ts、window.ts、tray.ts                            | 移除 DevHub core 依赖，注入初始化与异步清理；保留单实例与开发数据隔离 |
| 标题栏与窗口控制     | main/window-controls.ts、features/title-bar                  | 保留交互，品牌从应用配置读取                                          |
| API、IPC、错误通道   | shared/api.ts、errors.ts、main/ipc.ts、preload、renderer/api | 改为 AppApi/AppError，移除全部项目脚本方法；保留自动映射              |
| 事件总线             | core/events                                                  | 改为模板事件契约，保留取消订阅与异常隔离                              |
| JSON 存储            | core/storage                                                 | 保留校验、损坏备份、临时文件替换；服务层串行读改写，测试并发更新      |
| 设置与主题           | core/settings、features/settings、lib/appearance             | 仅保留主题与关闭行为，移除终端、编辑器、停止等待时间                  |
| 原生选择与安全外链   | main/ipc.ts、core/shell                                      | 保留文件/目录选择、http/https 白名单、沙箱与 contextIsolation         |
| 通用 UI              | components/ui、assets/main.css                               | 保留基础组件与设计配置，替换品牌色和图标                              |
| 自动更新             | main/updater.ts、update-status.ts、features/updates          | 保留流程和测试，更新仓库未配置时禁用检查及下载                        |
| 安装与图标           | electron-builder.yml、build/installer.nsh、图标脚本          | 参数化标识、安装子目录、产物名；使用中性图标                          |
| 质量与交付           | check、E2E 夹具、CI/release、审计脚本                        | 保留工程检查和诊断，重写业务 E2E；移除 node-pty 解包检查              |
| 示例功能             | 新建 notes 模块                                              | 最小便签列表、添加、删除、持久化，用于展示完整调用链                  |

排除 `projects`、`detectors`、`scripts`、`process`、`shells`、`editors`、`groups`、`ports`、`health`、`history` 及对应 UI、领域类型、配置格式和测试。基础依赖中移除 node-pty、yaml、xterm 及其 addons；排除 DevHub 发布产物、运行数据、业务文档和历史图标。

网络检查、程序发现、终端、日志流、进程回收、健康状态、任务编排和运行历史只记录为后续模块，不在第一版保留未接入代码。

## 目标目录

```text
electron-desktop-template/
├── app.config.json              产品标识与可选更新仓库
├── apps/desktop/
│   ├── build/                   中性图标、参数化安装脚本
│   ├── resources/
│   ├── e2e/                     窗口、设置、便签、数据隔离
│   └── src/
│       ├── main/                生命周期、IPC、窗口、托盘、更新
│       │   └── core/            app-core、storage、events、settings、notes
│       ├── preload/
│       └── renderer/src/        api、components/ui、features、lib
├── packages/shared/src/         API、schema、事件、错误
├── scripts/                     initialize.mjs、配置生成与审计
├── docs/                        架构、初始化、开发、发布、删除示例说明
├── .github/workflows/           CI、release
├── AGENTS.md
└── README.md
```

名称仅表达目标结构，现阶段不新增工作区包。main core 不依赖 Electron，shared 不依赖 Electron 或 Node；renderer 仅从 api 入口访问核心，边界继续由 ESLint 强制。

便签示例使用独立 `notes` 类型、服务、UI 和测试文件。删除说明列出 API 方法、事件、core 组装、UI 入口和测试的移除位置，避免示例散落在基础设施中。

## 初始化参数与行为

| 参数        | 示例                        | 用途                                                                             |
| ----------- | --------------------------- | -------------------------------------------------------------------------------- |
| projectName | my-tool                     | 根包名、内部包 scope、可执行文件、产物及安装子目录；仅允许小写字母、数字和中划线 |
| productName | 我的工具                    | 标题栏、安装器、快捷方式、应用菜单                                               |
| appId       | com.example.mytool          | 应用标识；必须显式填写，禁止继续使用模板默认标识                                 |
| author      | Example                     | 包与 Linux 安装元数据                                                            |
| homepage    | https://example.com/my-tool | 产品主页；校验为 http/https                                                      |
| repository  | owner/my-tool               | 可选 GitHub 仓库与更新源，缺失时更新关闭                                         |

localStorage 前缀派生自 appId；应用数据目录按明确的产品标识配置，开发目录追加 `-dev`，E2E 的显式 userData 参数优先。内部 IPC 和 preload 名称使用固定的中性名称，不需要按产品全局替换。

初始化先校验并展示变更计划，确认输入完整后统一写入配置和明确列出的文件；使用结构化读写及指定占位符，不对源码做任意全局替换。禁止覆盖非模板项目；失败返回非零状态并提供恢复办法；重复执行相同配置应无变化，已初始化项目改 appId 需明确提示会改变数据与安装身份。

打包配置由 app.config.json 生成或读取，避免运行时与安装器标识分离。更新、CI 和发布从新仓库获取目标信息，绝不能指向 Delta1035/devhub。模板默认可以本地开发，发布前必须通过标识完整性检查。

## 开发与使用路径

创建模板副本后：安装依赖 → 运行初始化 → 生成中性图标 → `pnpm check` → `pnpm e2e` → `pnpm dev`。README 给出实际脚本落地后的准确命令。

开发新功能：先 shared 契约与 schema，再 core 服务及测试，再 UI；IPC/preload 自动映射。示例演示 UI → API → IPC → core → JSON 存储，并通过事件更新界面缓存。

自动更新的可用范围先保持 Windows 安装版与 Linux AppImage。deb 通过安装包更新；macOS 仅保留现有兼容结构，不宣称已经验证。

## 分步实施与验收

1. 本设计稿：确定模块边界、目标目录、初始化参数和验收要求。
2. 基础代码提取：在独立目录建立可启动模板，加入便签示例、设置、窗口和通信；通过该目录的 check 与真实 Electron E2E。
3. 初始化与交付：落地配置生成、标识校验、图标、打包和 CI；验证两组不同产品配置，检查 DevHub 标识残留，验证 Windows 安装包与 Linux CI。
4. 远端模板：发布已验证的仓库，开启 GitHub Template；从模板重新创建一个实例，按 README 验证完整路径。

每步单独 review。模板第一版完成标准：干净环境冻结 lockfile 安装、check 全通过、Windows/Ubuntu E2E 通过，便签和设置重启保留、窗口与托盘行为正确、初始化后的应用与 DevHub 可并存。打包检查真实安装产物；安装路径与跨版本更新另做真实安装验证，不能用编译成功代替。

测试迁移时保留通用行为用例，不复制 DevHub 业务用例冒充覆盖。第一版的 E2E 至少包含便签增删和重启持久化、主题与关闭设置、窗口控制、原生对话框取消、开发/测试数据隔离。初始化测试覆盖无效输入、重复执行、部分写入失败和产品标识一致性。

## 待落地问题

- 独立仓库的最终名称、存放目录及可见性在创建远端前确定；本设计稿不创建远端资源。
- LICENSE 与第三方组件版权声明在提取时核对，不能默认把 DevHub 授权范围等同于模板授权。
- 当前工作区存在运行历史改动；提取时选择已验证源快照，不混入未验证修改。
