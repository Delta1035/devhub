# 0032 Rust / GPUI 桌面端实验原型

- 状态：已采纳（仅实验原型）
- 日期：2026-11-06
- Issue：[#77](https://github.com/Delta1035/devhub/issues/77)

## 背景

仓库中已有一份 Rust / GPUI 桌面端原型，包含原生界面、脚本发现、PTY、批量任务和历史记录的初步实现。用户确认保存原型，并批准本实验引入的新技术与依赖，方便后续评估。

## 决策

- 原型保存在 `apps/desktop-gpui/`，作为独立 Cargo 二进制项目，提交 `Cargo.lock`。正式客户端仍按 ADR 0001 使用 Electron / TypeScript；本决策不代表迁移正式客户端。
- 使用 GPUI 0.2.2 绘制 UI、portable-pty 0.9 管理 PTY、serde / serde_json 序列化数据、libc 提供底层平台能力，精确解析版本见锁文件。辅助图片比对脚本使用 Pillow，执行时会尝试安装缺失依赖，应在独立 Python 虚拟环境中运行。
- Rust 核心与 UI 分目录组织，但当前未接入 shared 的 DevhubApi、HTTP/SSE、现有 IPC 或正式发布流水线。现有实现不视为与正式客户端功能对等。
- 保留参考图片、Electron 截图脚本与 Python 图片比对脚本，供后续视觉评估使用；本次不宣称已达到像素一致。
- 仓库位置与参考图路径从 `CARGO_MANIFEST_DIR` 推导，因此原型目前以源码构建运行为准，移动已编译二进制的资源定位另行设计。
- `target/` 不入库；Rust 文件通过 rustfmt 检查，原型目录不交给 Prettier。Cargo 检查需单独执行，当前 `pnpm check` 不覆盖 Rust。

## 验证边界与限制

- 本任务仅保存并整理现有原型，验证 Rust 格式、Linux 编译、现有 9 个核心单测，以及正式客户端的 `pnpm check` / `pnpm e2e`。
- Electron E2E 不覆盖 GPUI；GPUI 界面交互、Windows 编译和进程树管理均尚未验收，已有单测也不代表覆盖全部新核心逻辑。
- 原型默认存储位置可能与正式客户端共用 `DevHub` 配置目录，序列化兼容性未完整验证。实验时必须隔离配置，避免覆盖真实项目、任务与历史；后续正式使用前需解决数据隔离及迁移策略。

## 备选与理由

- 不保存原型：无法为后续评估留下可复现的源码与依赖版本。
- 直接替换 Electron：原型尚缺 API 契约集成、跨平台测试和功能验收，本次没有迁移依据。
