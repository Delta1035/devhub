# 0020 官网：VitePress + GitHub Pages

- 状态：已采纳
- 日期：2026-10-04

## 背景

项目只有 GitHub 仓库页。README 承担了介绍、安装、使用和 `.devhub.yaml` 参考，内容越来越长；用户希望有一个像其他开源软件那样的官网，放下载入口和使用文档。

## 决策

- 新增 workspace 包 `apps/website`（`@devhub/website`），与桌面端互不依赖。
- 使用 **VitePress 1.6**（devDependency，只在构建站点时使用，不进入安装包）。2.0 仍是 alpha，暂不采用。它自带 Vite 5，与桌面端的 Vite 7 由 pnpm 分别安装，互不影响（2026-10-05 起经 pnpm overrides 提升到 Vite 6.4.3 以修复审计告警，见 ADR 0025）。
- 中英双语，用 VitePress 内置的 locales：中文为主语言，放在根路径；英文在 `/en/`（2026-10-04 按用户要求由「英文根路径 + `/zh/`」调整）。本地搜索用内置的 `local` 提供方，无外部服务。
- 截图直接引用 `docs/assets/`（Vite 构建时打包），与 README 共用一份，避免两处不同步；图标复制到 `public/logo.png`。
- 下载按钮指向 `releases/latest`，发版后站点无需修改。
- 部署到 GitHub Pages（`https://delta1035.github.io/devhub/`，`base: '/devhub/'`）。工作流 `website.yml`：PR 只构建（VitePress 构建会检查站内死链），`main` 上的相关改动构建并部署；只安装站点自身依赖并跳过安装脚本，不下载 Electron。
- 站点配置 `.vitepress/config.mts` 纳入 `pnpm typecheck`，Markdown 由 Prettier 检查格式。

## 备选与理由

- 纯 HTML 单页：零依赖，但只能放首页，双语切换和文档导航都要自己写。
- Astro + Starlight：功能相近，但引入一套与现有 Vite / React 无关的新体系，对一个文档站来说过重。
- 继续只用 README：没有导航和搜索，配置参考与使用说明会继续挤在一个文件里。

## 已知限制

- 需要在仓库 Settings → Pages 中把 Source 设为「GitHub Actions」，部署才会生效。
- 文档内容与 README 有重复（功能、安装）；以后 README 可以精简为简介 + 链接到官网。
