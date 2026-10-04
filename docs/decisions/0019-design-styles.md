# 0019 可切换的设计风格与随附字体

- 状态：已采纳
- 日期：2026-10-04

## 背景

用户希望在几套设计风格之间一键切换（Neutral、Material 3、Fluent、Nord、Yaru、Terminal），而不是把整个 UI 迁移到某个组件库。各风格的字体若依赖系统安装，在没有该字体的机器上会回退成系统默认字体，风格的辨识度明显下降。运行状态的颜色（运行中、启动中等）原先在组件中写死，切换风格时不跟着变。

## 决策

- 风格是 `<html data-style>` 下对语义 CSS 变量的覆盖（`assets/styles/<风格>.css`），与亮/暗独立组合。组件只使用语义 token，新增风格不改组件。选择存在 renderer 的 localStorage（`devhub.style`），属于 ADR 0007 中的「显示偏好」。
- 新增运行状态 token：`success`（运行中 / 就绪 / 完成）、`warning`（启动中 / 停止中 / 扫描警告）、`info`（进行中），每套风格亮/暗各定义一份。组件中不再写死状态颜色；编辑器徽标（品牌色）和标题栏关闭按钮的红色（平台惯例）除外。
- 终端（xterm）的配色在 `terminal-prefs.ts` 中按风格与亮/暗选择。
- 随附三款开源可变字体（Fontsource，与已有的 Geist 相同来源，放在 devDependencies，由 Vite 打包进 renderer）：
  - `@fontsource-variable/roboto`（OFL-1.1）→ Material 3
  - `@fontsource-variable/ubuntu-sans`（Ubuntu Font Licence 1.0，允许随软件分发）→ Yaru
  - `@fontsource-variable/jetbrains-mono`（OFL-1.1）→ Terminal
  - 合计约 470 KB（拉丁字符子集）；中文仍回退到系统字体。浏览器只加载当前风格实际使用的字体。
- Fluent 使用系统的 Segoe UI Variable：它是微软专有字体，不得随软件分发；Windows 11 自带，其他系统回退到 Ubuntu / 系统字体。

## 备选与理由

- 迁移到 Angular Material / MUI 等组件库：只为换外观就要重写整个 renderer，且一次只能得到一种风格。
- 每套风格各写一份组件变体（ripple、亚克力材质等）：维护成本随风格数量翻倍；目前只换 token 已能满足需求。
- 只用系统字体：零依赖，但多数机器上 Material、Yaru、Terminal 都会显示为同一种默认字体。
