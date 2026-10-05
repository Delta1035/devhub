# 0024 子进程环境：从注册表 / 登录 shell 重新解析

- 状态：已采纳
- 日期：2026-10-05
- Issue：#22

## 背景

DevHub 启动的脚本、内置终端、编辑器和系统终端原本直接继承 DevHub 进程的环境变量，而这份环境取决于谁启动了 DevHub：

- Windows：自动更新后由安装程序经 Explorer 重启 DevHub。Explorer 收到环境变更广播后重建的 PATH 中，`%NVM_HOME%;%NVM_SYMLINK%`、`%USERPROFILE%` 没有展开（用户 Path 被存成 `REG_SZ`；系统 Path 引用的变量本身是 `REG_EXPAND_SZ`），启动 pnpm 脚本报「'pnpm' 不是内部或外部命令」。另外，DevHub 运行期间新装的工具，要重启 DevHub 才能用。
- Linux：从桌面启动时，会话的 PATH 不含 `~/.bashrc` / `~/.zshrc` 中设置的内容（nvm 等）。脚本用 `$SHELL -lc` 运行，非交互 shell 不读 `.bashrc`（Ubuntu 的 `.bashrc` 对非交互 shell 直接 return），实测找不到 nvm 安装的 pnpm。

## 决策

`core/env/` 提供 `EnvResolver`，RunManager（脚本与内置终端）、编辑器和系统终端在每次启动前调用它：

- **Windows**：用 `reg query` 读 HKLM 与 HKCU 的 Environment（经 `chcp 65001`，否则非 ASCII 路径会乱码；cmd、chcp、reg 都用 `SystemRoot` 下的绝对路径调用，因为要修复的 PATH 本身可能不可用），与继承的环境合并：
  - PATH：继承的条目在前，其中的 `%VAR%` 先展开；然后补上注册表中缺少的系统和用户条目；仍含未展开引用的条目丢弃，重复条目去掉（不区分大小写）。
  - 其他变量：只补继承环境中缺少的，不覆盖已有的。
  - 不论注册表里存的是什么类型，PATH 中的 `%VAR%` 都会展开；变量之间的嵌套引用会递归展开，并检测循环。
  - 结果缓存 5 秒（批量任务一次启动多个脚本时只读一次）。每次读取约 60 ms。
- **Linux / macOS**：每个会话用 `$SHELL -ilc` 跑一次，捕获环境：输出前后打随机标记，中间是 `env -0`；子进程 detached，stdin 关闭，10 秒超时后杀掉整个进程组。剔除 `PWD`、`OLDPWD`、`SHLVL`、`_`，其余覆盖到继承的环境上。core 创建时就开始捕获。脚本仍用 `-lc` 运行。
- 任何失败（读注册表失败、shell 超时或没有输出环境）都退回继承的环境，并记录日志。

## 备选与理由

- 只修本机注册表：只修好一台机器，别的用户遇到同样的问题照样报错，运行期间新装的工具也仍要重启。
- Windows 只展开继承 PATH 中的 `%VAR%`：能修好这次的问题，但补不上运行期间新装的工具，也补不上继承环境中根本没有的变量。
- Windows 用注册表结果完全替换继承的环境：会丢掉启动 DevHub 的终端设置的变量（如激活的虚拟环境、开发模式下的变量）。
- Linux 改用 `-ic` / `-ilc` 运行每个脚本：每次启动都要执行 rc 文件（nvm 会慢 0.3–1 秒）；交互 shell 还会输出作业控制提示，并在 pty 中改变行为。
- 用 Electron 的 `process.execPath` 加 `ELECTRON_RUN_AS_NODE` 输出 JSON（VS Code 的做法）：core 不应知道 Electron；在目标平台 Linux 上，`env -0`（coreutils）同样能保住换行等特殊字符。

## 已知限制

- Linux：DevHub 运行期间修改 `.bashrc`，要重启 DevHub 才生效。
- macOS 不是目标平台：BSD `env` 不一定支持 `-0`，失败时退回继承的环境。
- 查找已安装程序的定位器（编辑器、终端、shell）仍使用继承的环境；它们还会查默认安装目录和注册表，受影响较小。
