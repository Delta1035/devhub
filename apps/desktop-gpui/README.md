# DevHub GPUI 实验原型

这是独立的 Rust / GPUI 源码实验项目，范围与限制见 [ADR 0032](../../docs/decisions/0032-gpui-prototype.md)。正式客户端仍为 `apps/desktop`。

在仓库根目录执行：

```sh
cargo fmt --manifest-path apps/desktop-gpui/Cargo.toml -- --check
cargo check --locked --manifest-path apps/desktop-gpui/Cargo.toml
cargo test --locked --manifest-path apps/desktop-gpui/Cargo.toml
```

运行需要 GPUI 对应平台的图形环境和原生构建依赖。目前只验证 Linux 编译与单测，未验收 GPUI UI 或 Windows。

原型可能读写正式客户端的 `DevHub` 配置目录。请使用隔离配置运行。Linux 示例（在仓库根目录）：

```sh
gpui_config_dir=$(mktemp -d)
mkdir -p "$gpui_config_dir/DevHub"
XDG_CONFIG_HOME="$gpui_config_dir" cargo run --locked --manifest-path apps/desktop-gpui/Cargo.toml
```

预先创建 `DevHub` 子目录很重要：当前存储实现仅在该目录已存在时采用 `XDG_CONFIG_HOME`。运行后的实验数据保留在临时目录中；Windows 请使用独立用户环境。

`resources/web-reference.png` 是视觉参考图。`scripts/visual_diff.py` 可比较两张截图，依赖 Pillow，并会在缺失时尝试通过 pip 安装，建议在 Python 虚拟环境执行。Electron 参考截图脚本位于 `apps/desktop/scripts/capture_web_reference.mjs`；这些辅助工具本次未做视觉验收。
