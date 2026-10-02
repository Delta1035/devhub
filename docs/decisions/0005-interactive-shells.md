# 0005 项目内交互式终端

- 状态：已采纳
- 日期：2026-10-02

## 背景

M1 的终端只跟随「运行一个识别出的脚本」出现，用户无法在项目目录里自己执行命令（git、临时脚本、调试命令等）。
用户的习惯是 bash；Windows 上即 Git Bash。

## 决策

### 终端 = 一种运行（Run）

- `Run` 改为按 `kind` 区分的联合类型：`script`（带 `scriptId`）与 `shell`（带 `shellId`）；原 `scriptName` 改为通用的 `title`（脚本名或「终端 N」）。
- 交互式终端复用 RunManager 的全部能力：PTY、输出缓冲与推送、输入、尺寸、退出时清理。
- 同一项目可开多个终端，编号取最小未使用的数字；脚本仍是每个最多一个活动运行。
- API：`listShells()`、`startShell(projectId, shellId?)`。renderer 只传项目 id 与 shell id（zod 枚举），可执行文件由 core 决定。

### 选哪个 shell

按偏好排序，第一个为默认（「+」按钮），其余在下拉菜单中：

| 平台    | 顺序                                                             |
| ------- | ---------------------------------------------------------------- |
| Windows | Git Bash → PowerShell 7 → Windows PowerShell → cmd               |
| Linux   | bash → zsh → fish → sh（均以登录 shell `-l` 启动，加载 profile） |

- Git Bash 的定位：Git for Windows 注册表 `InstallPath` → PATH 上 `git.exe` 推出安装目录 → 默认目录。**不使用 PATH 上的 `bash`**：Windows 上那常是 WSL 的 `System32\bash.exe`。
- 查找逻辑（候选位置、PATH/PATHEXT、带版本号的目录）与编辑器检测共用 `core/fs/finder.ts`；文件系统与注册表经参数注入，两个平台的查找在任何系统上都可测试。

### Git Bash：DevHub 提供启动文件

实测发现：Git for Windows 的 `/etc/profile.d/aliases.sh` 在 `TERM=xterm*` 时把 `node`、`python` 等改为 `winpty node.exe`。这是为 mintty（没有 Win32 控制台）准备的；在 ConPTY 下控制台已存在，winpty 不但多余，而且它的中间进程会退出，使 node 脱离 Windows 进程树，**关闭终端时 `taskkill /T` 杀不到它**。

做法：Git Bash 以 `bash --rcfile <userData>/shell/git-bash.rc -i` 启动，该文件：

1. 按登录 shell 的顺序读取 `/etc/profile`、`~/.bash_profile` / `~/.bash_login` / `~/.profile`（用户配置照常生效）；
2. 只移除值为 `winpty …` 的别名，保留用户自己的别名。

另设 `CHERE_INVOKING=1`，否则 `/etc/profile` 会切到 `$HOME` 而不是停在项目目录。启动文件每次启动前重写，不需要用户维护。

### 关闭终端 = 结束整棵进程树

- 对 shell 发 Ctrl+C 不会让它退出，所以停止 shell 用 `hangup` 而不是 `interrupt`：
  - Linux：向进程组发 SIGHUP（与关闭终端窗口一致，bash 会转发给它的作业）；
  - Windows：没有挂断信号，直接 `taskkill /T /F`。
- 超时后仍走强制结束。**Linux 的强制结束改为同时扫描整个会话**（`/proc/*/stat` 的 session 字段）：交互式 bash 开启了作业控制，每个命令在自己的进程组中，只杀 `-pid` 会漏掉它们；PTY 的 shell 是会话首进程，会话覆盖终端下的所有进程组。
- 关闭运行中的终端不弹确认（与 VS Code 默认一致）；脚本的标签仍只能在结束后关闭，避免误点停掉服务。

### 远程访问（M4）

交互式终端等于「在主机上执行任意命令」。远程 API 默认**不开放** `startShell` 与终端输入，需单独开关并经 Token 鉴权。

## 备选与理由

- Windows Job Object：能从根本上保证子进程随终端结束，但需要额外原生代码；Git Bash 的问题用启动文件即可解决，暂不引入。
- 修改 `TERM`（不以 `xterm` 开头）来避开 winpty 别名：会影响程序的颜色与终端能力判断。
- 默认 PowerShell（VS Code 的 Windows 默认）：用户习惯 bash，保留 PowerShell / cmd 作为备选。

## 已知限制

- 自定义 shell 路径、默认 shell 的选择暂未提供设置项。
- 用户在 `~/.bashrc` 等文件中自己定义的 `winpty` 包装（非 Git 默认别名）同样会被移除，因为匹配的是别名的值。
- 通过 `start`、`setsid`、`nohup` 等方式刻意脱离的进程不在清理范围内。
