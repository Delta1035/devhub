use crate::app_state::DevHubApp;
use crate::ui::theme::Theme;
use gpui::{Context, IntoElement, MouseButton, ParentElement, Styled, div, prelude::*, px, rgb};

impl DevHubApp {
    pub(crate) fn render_add_project_modal(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let err_msg = self.add_project_error.clone();

        div()
            .id("modal-add-project-backdrop")
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
                    .w(px(480.0))
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
                            .child(div().text_base().font_weight(gpui::FontWeight::BOLD).child("添加本地项目"))
                            .child(
                                div()
                                    .id("close-add-modal-btn")
                                    .cursor_pointer()
                                    .text_sm()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .hover(|s| s.text_color(rgb(Theme::TEXT_PRIMARY)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_add_project_modal();
                                        cx.notify();
                                    }))
                                    .child("✕"),
                            ),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .child("选择本地项目目录，DevHub 将自动发现其 npm / Maven / Gradle / 自定义脚本"),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_2()
                            .child(div().text_xs().font_weight(gpui::FontWeight::MEDIUM).child("快捷选择常用目录："))
                            .child(
                                div()
                                    .flex()
                                    .flex_wrap()
                                    .gap_2()
                                    .child(self.quick_path_chip("当前 DevHub 仓库", Self::repository_root().to_string_lossy().into_owned(), cx))
                                    .child(self.quick_path_chip("项目父目录", Self::repository_root().parent().unwrap_or_else(|| std::path::Path::new(".")).to_string_lossy().into_owned(), cx)),
                            ),
                    )
                    .children(err_msg.map(|err| {
                        div()
                            .px_3()
                            .py_1p5()
                            .rounded_md()
                            .bg(rgb(0xfee2e2))
                            .border_1()
                            .border_color(rgb(0xfca5a5))
                            .text_xs()
                            .text_color(rgb(0xdc2626))
                            .child(err)
                    }))
                    .child(
                        div()
                            .flex()
                            .justify_end()
                            .gap_2()
                            .pt_2()
                            .child(
                                div()
                                    .id("cancel-add-modal-btn")
                                    .px_4()
                                    .py_1p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_add_project_modal();
                                        cx.notify();
                                    }))
                                    .child("取消"),
                            ),
                    ),
            )
    }

    fn quick_path_chip(
        &self,
        label: &'static str,
        path: String,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let project_path = path.clone();
        div()
            .id(gpui::SharedString::from(format!("chip-path-{}", label)))
            .px_3()
            .py_2()
            .rounded_lg()
            .bg(rgb(Theme::BADGE_BG))
            .border_1()
            .border_color(rgb(Theme::BORDER))
            .cursor_pointer()
            .hover(|s| s.bg(rgb(0xe0e7ff)).border_color(rgb(0x818cf8)))
            .on_click(cx.listener(move |this, _, _, cx| {
                let _ = this.submit_add_project(project_path.clone(), Some(label.to_string()));
                cx.notify();
            }))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_0p5()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::MEDIUM)
                            .child(label),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_MUTED))
                            .child(path),
                    ),
            )
    }
}
