# 0016 独立桌面应用模板

- 状态：已采纳
- 日期：2026-10-03

## 背景

DevHub 的应用外壳、通信、存储和交付能力可以用于其他桌面软件。用户已确认 `docs/DESKTOP-TEMPLATE.md`，本次先完成基础代码提取。

## 决策

将基础模板放在 `templates/desktop`，作为有自己 lockfile、依赖和检查命令的独立 pnpm workspace。它不加入 DevHub workspace；DevHub 根格式与 lint 排除此目录，模板自身仍使用完整的格式、架构 lint、类型、单测和 E2E。后续可以整体移至 GitHub Template 仓库。

沿用已批准技术栈，移除 node-pty、yaml 和 xterm 业务依赖。便签作为可删除的端到端示例。使用固定中性的内部包名和桥接名；app.config.json 集中描述产品与数据身份，未配置更新仓库时不发起更新请求。

初始化脚本、安装器与 CI/发布在下一小任务实现。本次不创建远端仓库，不发布公共包，也不将 DevHub 改为模板消费者。

### 补充（2026-10-03）：迁出

按用户要求，模板从 `templates/desktop` 迁移到同级目录 `../electron-desktop-template`，之后由用户建立独立仓库。DevHub 删除该目录和相应的格式化、lint 排除规则。迁移后在新位置以冻结 lockfile 安装，check、E2E 与 Windows 打包均通过验证。

## 影响

模板副本不会自动获取上游修复，需要独立维护版本。两套工作区分别检查，避免模板依赖和示例进入 DevHub 构建。新应用完成标识初始化与真实打包验证后才适合发布；目标平台为 Windows/Ubuntu，macOS 不作为已验证平台。
