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
| Android（M4） | 先 PWA，后 React Native + Expo                                        |

版本约束：TypeScript 5.9（typescript-eslint 尚不支持 7.x）、ESLint 9、Vite 7（electron-vite 5 要求）。升级前先确认生态兼容。

## 备选与理由

- Tauri 2 + Rust：更轻量且原生支持 Android，但岗位少，不符合求职目标。
- Wails + Go：Go 易写，但 Wails 小众，移动端无成熟路径。
- Electron 的内存开销（约 150–300MB）可接受：它替代的是多个 IDE 实例（VSCode 本身也是 Electron）。
- 暂不引入 Turborepo：只有两个包时 `pnpm -r` 足够，增加移动端后再评估。
