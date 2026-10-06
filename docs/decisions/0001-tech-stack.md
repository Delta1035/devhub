# 0001 技术栈

- 状态：已采纳
- 日期：2026-10-02

## 背景

个人内部工具，全程 vibe coding 开发；目标平台 Windows / Ubuntu，后续 Android。
希望技术栈主流，对前端/全栈方向求职有帮助。

## 决策

全栈 TypeScript：

| 领域          | 选择                                                                  |
| ------------- | --------------------------------------------------------------------- |
| 桌面框架      | Electron + electron-vite                                              |
| UI            | React 19 + Tailwind CSS v4 + shadcn/ui                                |
| 服务端状态    | TanStack Query                                                        |
| 客户端状态    | Zustand（需要时引入）                                                 |
| 校验          | Zod                                                                   |
| 测试          | Vitest；E2E 用 Playwright                                             |
| 工程化        | pnpm workspace、ESLint、Prettier、husky + lint-staged、GitHub Actions |
| 进程/终端     | node-pty（M1 引入）                                                   |
| Android（M4） | 先 PWA，后 Capacitor（ADR 0027），之后再加 React Native + Expo        |

版本约束：TypeScript 6.0（2026-10-02 由 dependabot 从 5.9 升级；typescript-eslint 8.71 支持 `<6.1`，7.x 尚不支持，升级前先确认）、ESLint 9、Vite 7（electron-vite 5 要求）。升级前先确认生态兼容。

## 备选与理由

- Tauri 2 + Rust：更轻量且原生支持 Android，但岗位少，不符合求职目标。
- Wails + Go：Go 易写，但 Wails 小众，移动端无成熟路径。
- Electron 的内存开销（约 150–300MB）可接受：它替代的是多个 IDE 实例（VSCode 本身也是 Electron）。
- 暂不引入 Turborepo：只有两个包时 `pnpm -r` 足够，增加移动端后再评估。

## 补充（2026-10-02）

- shadcn/ui 使用 `radix-nova` 风格（Radix + Lucide 图标 + Geist 字体）。CLI 无法自动识别 electron-vite，已手动生成 `apps/desktop/components.json`；之后在 `apps/desktop` 下用 `pnpm dlx shadcn@latest add <组件>` 添加组件即可。
- shadcn 新版用官方的 `cn` 包（shadcn 维护，替代 `clsx + tailwind-merge`），生成的组件直接从 `cn` 导入，因此跟随官方、移除了 clsx 与 tailwind-merge。该包仍是 0.x，升级时留意变更。
- 被 Vite 打包进 renderer 的库一律放 `devDependencies`；`dependencies` 只放主进程运行时需要的包（electron-builder 会把它们打进安装包）。

## 补充（2026-10-06）：Android

- 网页版已复用桌面 renderer（ADR 0022 补充），Android 客户端改为先用 Capacitor 包装同一网页，Expo 原生客户端推迟（ADR 0027）。Capacitor 只消费构建产物，不引入 Turborepo。

## 补充（2026-10-02）：E2E 的做法

- `@playwright/test` 的 `_electron.launch` 驱动**构建产物**（`out/main/index.js`），不依赖 dev server，也不需要下载浏览器。
- 每个测试独立的 `--user-data-dir`：隔离 `projects.json` 和单实例锁，不影响开发者本机运行的 DevHub。
- 原生文件夹对话框在主进程中用 `electronApp.evaluate` 替换（`stubFolderPicker`），其余流程走真实 UI。
- 不放进 `pnpm check`（需构建 + 启动 Electron，较慢）；CI 在 Windows 与 Ubuntu（`xvfb-run`）上每次运行，失败时上传 trace。
- Linux CI 上加 `--no-sandbox`：GitHub 的 Ubuntu runner 无法配置 Chromium 的 SUID 沙箱。
