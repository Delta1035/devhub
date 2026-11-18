use crate::app_state::DevHubApp;
use crate::core::Storage;
use crate::ui::theme::Theme;
use gpui::{Context, IntoElement, MouseButton, ParentElement, Styled, div, prelude::*, px, rgb};

impl DevHubApp {
    pub(crate) fn render_settings_modal(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let storage_path = Storage::default_dir().to_string_lossy().to_string();

        div()
            .id("modal-settings-backdrop")
            .absolute()
            .inset_0()
            .bg(gpui::rgba(0x00000088))
            .flex()
            .items_center()
            .justify_center()
            .on_mouse_down(MouseButton::Left, |_, _, cx| {
                cx.stop_propagation();
            })
            .child(
                div()
                    .w(px(520.0))
                    .bg(rgb(Theme::APP_BG))
                    .rounded_xl()
                    .border_1()
                    .border_color(rgb(Theme::BORDER))
                    .shadow_2xl()
                    .p_5()
                    .flex()
                    .flex_col()
                    .gap_4()
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .items_center()
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .child(
                                        div()
                                            .text_base()
                                            .font_weight(gpui::FontWeight::BOLD)
                                            .child("系统与环境设置"),
                                    )
                                    .child(
                                        div()
                                            .px_2()
                                            .py_0p5()
                                            .rounded_full()
                                            .bg(rgb(Theme::BADGE_BG))
                                            .text_xs()
                                            .text_color(rgb(Theme::PRIMARY))
                                            .child("v1.7.3 Native GPU"),
                                    ),
                            )
                            .child(
                                div()
                                    .id("close-settings-modal-btn")
                                    .cursor_pointer()
                                    .text_sm()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .hover(|s| s.text_color(rgb(Theme::TEXT_PRIMARY)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_settings_modal();
                                        cx.notify();
                                    }))
                                    .child("✕"),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1p5()
                            .child(
                                div()
                                    .text_xs()
                                    .font_weight(gpui::FontWeight::SEMIBOLD)
                                    .child("已发现的代码编辑器："),
                            )
                            .child(if self.installed_editors.is_empty() {
                                div()
                                    .px_3()
                                    .py_2()
                                    .rounded_lg()
                                    .bg(rgb(Theme::SIDEBAR_BG))
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .child("未自动发现 VS Code、Cursor 或 IntelliJ IDEA")
                                    .into_any_element()
                            } else {
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap_1p5()
                                    .children(self.installed_editors.iter().map(|ed| {
                                        div()
                                            .flex()
                                            .items_center()
                                            .justify_between()
                                            .px_3()
                                            .py_2()
                                            .rounded_lg()
                                            .bg(rgb(Theme::SIDEBAR_BG))
                                            .border_1()
                                            .border_color(rgb(Theme::BORDER))
                                            .child(
                                                div()
                                                    .flex()
                                                    .items_center()
                                                    .gap_2()
                                                    .child(
                                                        div()
                                                            .text_xs()
                                                            .font_weight(gpui::FontWeight::MEDIUM)
                                                            .child(ed.name.clone()),
                                                    )
                                                    .child(
                                                        div()
                                                            .px_1p5()
                                                            .py_0p5()
                                                            .rounded_md()
                                                            .bg(rgb(0xdcfce7))
                                                            .text_xs()
                                                            .text_color(rgb(0x15803d))
                                                            .child("就绪"),
                                                    ),
                                            )
                                            .child(
                                                div()
                                                    .text_xs()
                                                    .text_color(rgb(Theme::TEXT_MUTED))
                                                    .child(ed.bin_path.clone()),
                                            )
                                    }))
                                    .into_any_element()
                            }),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1p5()
                            .child(
                                div()
                                    .text_xs()
                                    .font_weight(gpui::FontWeight::SEMIBOLD)
                                    .child("底层引擎规格："),
                            )
                            .child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap_1()
                                    .p_3()
                                    .rounded_lg()
                                    .bg(rgb(Theme::SIDEBAR_BG))
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .child(self.spec_row("UI 框架", "GPUI 0.2 (GPU 硬件加速渲染)"))
                                    .child(self.spec_row("布局系统", "Taffy Flexbox Engine"))
                                    .child(self.spec_row(
                                        "伪终端 (PTY)",
                                        "portable-pty + POSIX non-blocking IO",
                                    ))
                                    .child(self.spec_row(
                                        "跨平台目标",
                                        "Linux (X11/Wayland), Windows 10/11",
                                    ))
                                    .child(self.spec_row("数据存储目录", &storage_path)),
                            ),
                    )
                    .child(
                        div().flex().justify_end().pt_2().child(
                            div()
                                .id("confirm-settings-btn")
                                .px_4()
                                .py_1p5()
                                .rounded_md()
                                .bg(rgb(Theme::PRIMARY))
                                .text_color(rgb(0xffffff))
                                .text_xs()
                                .cursor_pointer()
                                .hover(|s| s.bg(rgb(Theme::PRIMARY_HOVER)))
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.close_settings_modal();
                                    cx.notify();
                                }))
                                .child("确认"),
                        ),
                    ),
            )
    }

    fn spec_row(&self, label: &'static str, value: &str) -> impl IntoElement {
        div()
            .flex()
            .justify_between()
            .items_center()
            .text_xs()
            .child(div().text_color(rgb(Theme::TEXT_MUTED)).child(label))
            .child(
                div()
                    .font_weight(gpui::FontWeight::MEDIUM)
                    .child(value.to_string()),
            )
    }
}
