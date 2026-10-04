# 快速上手

DevHub 支持 Windows 与 Linux（Ubuntu / X11）。

## 安装

从 [GitHub Releases](https://github.com/Delta1035/devhub/releases/latest) 下载最新版本：

| 平台    | 文件                                         |
| ------- | -------------------------------------------- |
| Windows | `devhub-*-setup.exe`（安装向导，可选择目录） |
| Linux   | `.AppImage`（支持自动更新）或 `.deb`         |

安装包未签名，Windows 首次运行会出现 SmartScreen 提示，选择「更多信息 → 仍要运行」。

可以用同一 Release 中的 `SHA256SUMS.txt` 校验文件，或用 GitHub CLI 验证构建来源：

```bash
gh attestation verify <文件> --repo Delta1035/devhub
```

## 添加项目

在侧栏点击「添加」，有两种方式：

- **单个项目**：选择项目文件夹，右侧列出识别到的脚本。
- **工作区**（「添加工作区」）：选择存放多个仓库的目录。DevHub 会找出其中的项目——含有 `package.json`、`pom.xml`、`build.gradle(.kts)`、`settings.gradle(.kts)` 或 `.devhub.yaml` 的文件夹——并保持同步：重新扫描或切回窗口时自动添加新仓库。默认只扫描直接子目录，可在工作区设置中改为 1～5 层。

从侧栏移除工作区中的项目后，以后的扫描不会再加回它，可在工作区设置中恢复。项目目录消失时不会被自动移除，而是标记为「目录缺失」，切换分支或拔掉移动硬盘不会清空它的历史。

## 运行脚本

1. 点击脚本的运行按钮，输出显示在下方终端面板的标签页中，可以输入、搜索、点击链接。
2. 脚本行显示所用端口和健康状态：
   - **启动中**：端口还不能连接（或 [健康检查路径](./devhub-yaml#健康检查) 还没有返回 2xx）；
   - **就绪**：检查通过；
   - **无响应**：连续 3 次检查失败。
3. 停止脚本会结束整棵进程树，包括 `mvnw`、`pnpm` 等包装命令拉起的服务。
4. 「历史」按钮列出该脚本最近 20 次运行及其日志。

启动时如果端口已被占用，DevHub 会先提示占用它的进程。

DevHub 能自动识别：

- **npm**：`package.json` 的 scripts，按 `packageManager` 字段或 lockfile 选择 pnpm / yarn / npm；monorepo 子包继承仓库根目录的包管理器。
- **Maven**：常用生命周期命令，Spring Boot 项目加 `spring-boot:run`；多模块项目为每个应用模块生成启动命令。
- **Gradle**：`clean` / `build` / `test`，按插件加 `bootRun` / `run`；支持多项目构建。

识别不到的命令写进 [`.devhub.yaml`](./devhub-yaml)。

## 托盘与退出

关闭窗口默认最小化到托盘，脚本继续运行；退出 DevHub 时停止所有运行。可在设置中改为关闭即退出。

## 更新

Windows 安装版和 Linux AppImage 会从 GitHub Releases 自动更新；`.deb` 包不会自动更新，需要手动安装新版本。
