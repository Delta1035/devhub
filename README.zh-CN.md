<div align="center">

<img src="apps/desktop/build/icon.png" alt="DevHub" width="96" height="96" />

# DevHub

统一管理本地多个项目的脚本：自动识别 npm / Maven / Gradle / 自定义脚本，一处批量启动、停止、看日志。

[English](README.md) · **简体中文**

[![CI](https://github.com/Delta1035/devhub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Delta1035/devhub/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Delta1035/devhub?sort=semver)](https://github.com/Delta1035/devhub/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Delta1035/devhub/total)](https://github.com/Delta1035/devhub/releases)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20Android-informational)
[![License](https://img.shields.io/github/license/Delta1035/devhub)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)

[官网](https://delta1035.github.io/devhub/) · [下载](https://github.com/Delta1035/devhub/releases/latest) · [功能](#功能) · [使用](#使用) · [开发](#开发) · [参与贡献](CONTRIBUTING.md)

</div>

同时开着前端、后端、mock 服务时，不用再为每个项目开一个终端窗口，也不用记各自的启动命令。

支持 Windows 与 Linux（Ubuntu / X11）。

![DevHub 主界面：项目列表、识别到的脚本与运行中的终端](docs/assets/main.png)

## 功能

- **自动识别脚本**
  - npm：读取 `package.json` 的 scripts，按 `packageManager` 字段或 lockfile 选择 pnpm / yarn / npm；monorepo 子包会继承仓库根目录的包管理器
  - Maven：常用生命周期命令，Spring Boot 项目加 `spring-boot:run`；支持多模块项目，为每个应用模块生成单独的启动命令
  - Gradle：`clean` / `build` / `test`，按插件加 `bootRun` / `run`；支持多项目构建
  - Go：识别 `go.mod` / `go.work`，为根目录和 `cmd/<app>` 入口生成 `run` / `build` / `test` / `tidy` 脚本
  - Python：识别 `pyproject.toml` / `requirements.txt` 等，嗅探 uv / poetry / pdm / pipenv / venv，生成运行、测试与依赖同步脚本并推断框架端口
  - 优先使用项目自带的 `mvnw` / `gradlew`
  - 识别不到的命令写进 [`.devhub.yaml`](#自定义脚本devhubyaml)
- **工作区**：指定代码目录，自动发现其中的项目并随仓库增删保持同步；有运行中的脚本时优先显示，也支持手动置顶
- **运行与日志**：启动 / 停止 / 重启，停止时结束整棵进程树；每个运行一个终端标签页，可交互输入，支持搜索、复制粘贴和可点击链接
- **端口与健康检查**：从命令推断端口，指出占用进程，可在启动服务前自动结束占用者；运行中显示启动中 / 就绪 / 无响应
- **批量任务**：跨项目组合脚本，并行或串行启动；串行步骤可以等待成功退出、输出出现指定文字、端口可连接、HTTP 返回成功或固定秒数后再继续，失败时停止后续步骤并说明原因
- **定时任务（v1.11.0 起）**：为单个脚本或批量任务设置单次、每天、每周、固定间隔或 5 段 Cron 规则；目标已在运行时可跳过或停止后重跑，仅在 DevHub 运行期间执行
- **运行历史**：每个脚本保留最近 20 次运行的结果与日志，重启 DevHub 后仍可查看
- **项目内终端**：在项目目录中打开 bash / PowerShell / cmd 或自定义 shell
- **手机访问**：开启远程访问后，用浏览器 / PWA 或 Android App 查看状态、启停脚本（远程终端默认关闭，见[手机访问](apps/website/guide/remote.md)）
- **其他**：用 VS Code / IntelliJ IDEA 打开项目、全局搜索与消息通知、托盘常驻、深浅色主题、自动更新

## 安装

从 [Releases](https://github.com/Delta1035/devhub/releases) 下载：

| 平台    | 文件                                         |
| ------- | -------------------------------------------- |
| Windows | `devhub-*-setup.exe`（安装向导，可选择目录） |
| Linux   | `.AppImage` 或 `.deb`（均支持应用内更新）    |
| Android | `DevHub-*.apk`（远程客户端，需配合桌面端）   |

安装包未签名，Windows 首次运行会出现 SmartScreen 提示，选择「更多信息 → 仍要运行」。

可以用 `SHA256SUMS.txt` 校验文件，或验证构建来源：

```bash
gh attestation verify <文件> --repo Delta1035/devhub
```

## 使用

1. 在侧栏「项目」中添加项目文件夹，右侧列出识别到的脚本。
2. 点击脚本的运行按钮，输出显示在下方终端面板；脚本行显示端口和健康状态，「历史」查看以前的运行。
3. 需要同时启动多个服务时，在侧栏「批量」中新建任务，选择各项目的脚本和启动顺序。

![批量任务：先启动后端，等它输出启动完成后再启动前端](docs/assets/batch.png)

关闭窗口默认最小化到托盘，脚本继续运行；退出 DevHub 时停止所有运行。可在设置中改为关闭即退出。

### 自定义脚本（`.devhub.yaml`）

在项目根目录创建 `.devhub.yaml`，补充自动识别不到的命令（docker compose、带参数的启动命令、子模块等）：

```yaml
scripts:
  api:
    command: mvnw.cmd spring-boot:run -pl server # 也可以按平台写：{ windows: ..., linux: ... }
    description: 后端 # 可选
    port: 8081 # 可选，也可以写 ports: [8081, 8082]；省略时从命令推断
    portConflictPolicy: terminate # 可选，启动此脚本前先结束端口占用者
    health: /actuator/health # 可选，HTTP 路径字符串或探针对象（见下）
  db:
    command: docker compose up postgres
    cwd: deploy # 可选，相对项目目录，不能跳出项目
  worker:
    command: node worker.js
    health:
      type: output
      pattern: worker ready
```

`health` 除了直接填写 HTTP 路径字符串（如 `/actuator/health`，在该脚本首个端口上期望 HTTP 2xx）外，还支持多模态健康检测探针对象：

- `{ type: http, path: string, port?: number }`：请求指定端口（`port` 省略时取脚本第一个端口）的 `path`，期望返回 HTTP 2xx。
- `{ type: output, pattern: string, regex?: boolean }`：当进程输出匹配 `pattern`（`regex: true` 时按正则表达式匹配）时标记为就绪。
- `{ type: ports, ports: number[] }`：指定的端口列表全部可连接时标记为就绪。
- `{ type: alive, delayMs?: number }`：进程启动后稳定存活指定毫秒数（默认 `2000`，即 2 秒）时标记为就绪；未配置端口且未配置 `health` 时默认采用此行为。

保存后刷新或切回窗口即生效；写错时脚本列表会显示行号或字段路径。

设置 → 进程 →「端口被占用时」默认为「报告冲突」。选择「结束占用进程后启动」可全局开启自动接管，也可以仅在自定义脚本上设置 `portConflictPolicy: terminate`。脚本的 `error` 或 `terminate` 会覆盖全局设置，单项与批量启动均适用，仅自动释放 `.devhub.yaml` 中通过 `port` 或 `ports` 明确声明的端口。推断端口仍报告冲突，避免工具默认端口与实际配置不一致时结束无关服务。DevHub 会正常停止受管服务，结束外部占用者及其进程树，并等待端口释放；无法识别占用者或无法结束进程时，启动失败并说明原因。

## 开发

需要 Node.js ≥ 22、pnpm 11。

```bash
pnpm install
pnpm dev      # 启动桌面端（热更新）
pnpm check    # 格式 + lint + 类型 + 测试
pnpm e2e      # 构建并用 Playwright 驱动真实应用
```

目录结构、开发约定、提交规范和发布流程见 [参与贡献](CONTRIBUTING.md)。

## 文档

- [使用文档（官网，中英双语）](https://delta1035.github.io/devhub/)
- [定时任务](apps/website/guide/scheduled-tasks.md)
- [产品需求](docs/PRD.md)
- [架构](docs/ARCHITECTURE.md)
- [进度与已知问题](docs/PROGRESS.md)
- [架构决策记录](docs/decisions/)
- [AI 协作规则](AGENTS.md)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Delta1035/devhub&type=Date)](https://star-history.com/#Delta1035/devhub&Date)

## 许可证

[MIT](LICENSE)
