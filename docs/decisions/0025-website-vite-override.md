# 0025 官网：用 pnpm overrides 把 VitePress 的 Vite 5 提升到 6.4.3

- 状态：已采纳（补充 0012、0020）
- 日期：2026-10-05
- Issue：#9

## 背景

VitePress 1.6.4（当前稳定版）依赖 `vite ^5.4.14`，锁定到 Vite 5.4.21 / esbuild 0.21.5，审计报 1 high + 3 moderate：Vite 的 `server.fs.deny` Windows 路径绕过（high）、优化依赖 `.map` 路径穿越、launch-editor UNC 路径泄露 NTLMv2 哈希，以及 esbuild 开发服务器跨站读取。修复版本为 Vite ≥ 6.4.3、esbuild ≥ 0.24.3，Vite 5 没有修复版。VitePress 2 依赖 Vite 8，但仍是 alpha（2.0.0-alpha.20）。

这些漏洞都只影响开发服务器；GitHub Pages 部署的是静态产物，但本地在 Windows 上运行 `vitepress dev` 时会受影响。

## 决策

- 在 `pnpm-workspace.yaml` 中加 `overrides: { vite@5: ^6.4.3 }`。按版本范围匹配，只替换 VitePress 带来的 Vite 5；桌面端的 Vite 7 / 8 不受影响。Vite 6.4.3 自带 esbuild ^0.25，esbuild 告警同时消除。
- 兼容性：VitePress 使用的 `@vitejs/plugin-vue` 5.2 的 peer 已允许 `^5 || ^6`。已验证 `build`、`verify` 与 `vitepress dev`（页面、客户端入口、Markdown 模块均正常加载）。
- 对 0012「不覆盖到尚未发布或未经上游确认的版本」的说明：Vite 6.4.3 是 Vite 官方已发布的修复版本；VitePress 未声明支持 Vite 6，这一兼容风险由上述构建验证覆盖，且站点构建在 PR 中运行，失败会立即暴露。
- 退出条件：VitePress 2 发布稳定版后，升级 VitePress 并删除该 override。

## 备选与理由

- 升级到 VitePress 2.0 alpha：主题与配置 API 仍可能变化，正式官网不宜依赖 alpha。
- 不处理，只记录理由：漏洞确实会影响 Windows 上的本地开发服务器，而覆盖方案成本低、可验证。
- 覆盖到 Vite 7 / 8：超出 `@vitejs/plugin-vue` 5 的 peer 范围，兼容风险更大，且 6.4.3 已足以修复。
