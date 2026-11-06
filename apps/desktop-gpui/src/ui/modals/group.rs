use crate::app_state::DevHubApp;
use crate::ui::theme::Theme;
use gpui::{Context, IntoElement, MouseButton, ParentElement, Styled, div, prelude::*, px, rgb};

impl DevHubApp {
    pub(crate) fn render_new_group_modal(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let is_parallel = self.input_group_mode == "parallel";

        div()
            .id("modal-new-group-backdrop")
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
                    .w(px(460.0))
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
                            .child(div().text_base().font_weight(gpui::FontWeight::BOLD).child("新建批量任务"))
                            .child(
                                div()
                                    .id("close-new-group-modal-btn")
                                    .cursor_pointer()
                                    .text_sm()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .hover(|s| s.text_color(rgb(Theme::TEXT_PRIMARY)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_new_group_modal();
                                        cx.notify();
                                    }))
                                    .child("✕"),
                            ),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .child("批量任务可将跨项目的多个脚本组合在一起，实现一键自动化流水线启动。"),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1p5()
                            .child(div().text_xs().font_weight(gpui::FontWeight::MEDIUM).child("快速预设任务名称："))
                            .child(
                                div()
                                    .flex()
                                    .gap_2()
                                    .child(self.preset_group_chip("前后端一键联调", "parallel", cx))
                                    .child(self.preset_group_chip("项目全量构建", "sequential", cx)),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1p5()
                            .child(div().text_xs().font_weight(gpui::FontWeight::MEDIUM).child("执行策略："))
                            .child(
                                div()
                                    .flex()
                                    .gap_2()
                                    .child(
                                        div()
                                            .id("mode-parallel-btn")
                                            .flex_1()
                                            .p_2p5()
                                            .rounded_lg()
                                            .border_1()
                                            .border_color(if is_parallel { rgb(Theme::PRIMARY) } else { rgb(Theme::BORDER) })
                                            .bg(if is_parallel { rgb(0xeef2ff) } else { rgb(Theme::APP_BG) })
                                            .cursor_pointer()
                                            .on_click(cx.listener(|this, _, _, cx| {
                                                this.input_group_mode = "parallel".into();
                                                cx.notify();
                                            }))
                                            .child(
                                                div()
                                                    .flex()
                                                    .flex_col()
                                                    .gap_1()
                                                    .child(div().text_xs().font_weight(gpui::FontWeight::SEMIBOLD).child("⚡ 并行模式"))
                                                    .child(div().text_xs().text_color(rgb(Theme::TEXT_MUTED)).child("同时启动所有步骤脚本")),
                                            ),
                                    )
                                    .child(
                                        div()
                                            .id("mode-sequential-btn")
                                            .flex_1()
                                            .p_2p5()
                                            .rounded_lg()
                                            .border_1()
                                            .border_color(if !is_parallel { rgb(Theme::PRIMARY) } else { rgb(Theme::BORDER) })
                                            .bg(if !is_parallel { rgb(0xeef2ff) } else { rgb(Theme::APP_BG) })
                                            .cursor_pointer()
                                            .on_click(cx.listener(|this, _, _, cx| {
                                                this.input_group_mode = "sequential".into();
                                                cx.notify();
                                            }))
                                            .child(
                                                div()
                                                    .flex()
                                                    .flex_col()
                                                    .gap_1()
                                                    .child(div().text_xs().font_weight(gpui::FontWeight::SEMIBOLD).child("📋 串行流水线"))
                                                    .child(div().text_xs().text_color(rgb(Theme::TEXT_MUTED)).child("依次按序前置条件执行")),
                                            ),
                                    ),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .justify_end()
                            .gap_2()
                            .pt_2()
                            .child(
                                div()
                                    .id("cancel-new-group-btn")
                                    .px_4()
                                    .py_1p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_new_group_modal();
                                        cx.notify();
                                    }))
                                    .child("取消"),
                            )
                            .child(
                                div()
                                    .id("confirm-new-group-btn")
                                    .px_4()
                                    .py_1p5()
                                    .rounded_md()
                                    .bg(rgb(Theme::PRIMARY))
                                    .text_color(rgb(0xffffff))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::PRIMARY_HOVER)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        let name = if this.input_group_name.is_empty() {
                                            format!("批量任务-{}", this.groups.len() + 1)
                                        } else {
                                            this.input_group_name.clone()
                                        };
                                        let mode = this.input_group_mode.clone();
                                        let _ = this.submit_new_group(name, mode);
                                        cx.notify();
                                    }))
                                    .child("立即创建"),
                            ),
                    ),
            )
    }

    fn preset_group_chip(
        &self,
        name: &'static str,
        mode: &'static str,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        div()
            .id(gpui::SharedString::from(format!("chip-group-{}", name)))
            .px_3()
            .py_1p5()
            .rounded_md()
            .bg(rgb(Theme::BADGE_BG))
            .border_1()
            .border_color(rgb(Theme::BORDER))
            .cursor_pointer()
            .text_xs()
            .hover(|s| s.bg(rgb(0xe0e7ff)).border_color(rgb(0x818cf8)))
            .on_click(cx.listener(move |this, _, _, cx| {
                let _ = this.submit_new_group(name.to_string(), mode.to_string());
                cx.notify();
            }))
            .child(format!("+ {}", name))
    }

    pub(crate) fn render_edit_group_modal(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let current_group = self.groups.get(self.selected_group_idx).cloned();
        let group_name = current_group
            .as_ref()
            .map(|g| g.name.clone())
            .unwrap_or_default();
        let step_count = current_group.as_ref().map(|g| g.steps.len()).unwrap_or(0);

        div()
            .id("modal-edit-group-backdrop")
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
                    .w(px(560.0))
                    .max_h(px(520.0))
                    .bg(rgb(Theme::APP_BG))
                    .rounded_xl()
                    .border_1()
                    .border_color(rgb(Theme::BORDER))
                    .shadow_2xl()
                    .p_5()
                    .flex()
                    .flex_col()
                    .gap_3()
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
                                            .child("编辑批量任务步骤"),
                                    )
                                    .child(
                                        div()
                                            .px_2()
                                            .py_0p5()
                                            .rounded_full()
                                            .bg(rgb(Theme::BADGE_BG))
                                            .text_xs()
                                            .text_color(rgb(Theme::PRIMARY))
                                            .child(format!(
                                                "{} ({} 个步骤)",
                                                group_name, step_count
                                            )),
                                    ),
                            )
                            .child(
                                div()
                                    .id("close-edit-group-modal-btn")
                                    .cursor_pointer()
                                    .text_sm()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .hover(|s| s.text_color(rgb(Theme::TEXT_PRIMARY)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_edit_group_modal();
                                        cx.notify();
                                    }))
                                    .child("✕"),
                            ),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .child("从下方项目中点击脚本，即可将其添加至当前任务流水线中："),
                    )
                    .child(
                        div()
                            .id("edit-group-scroll-area")
                            .flex_1()
                            .overflow_y_scroll()
                            .flex()
                            .flex_col()
                            .gap_2p5()
                            .p_1()
                            .children(self.projects.iter().map(|proj| {
                                let scripts =
                                    self.all_scripts.get(&proj.id).cloned().unwrap_or_default();
                                let proj_id = proj.id.clone();
                                let proj_name = proj.name.clone();

                                div()
                                    .flex()
                                    .flex_col()
                                    .gap_1p5()
                                    .p_2p5()
                                    .rounded_lg()
                                    .bg(rgb(Theme::SIDEBAR_BG))
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_1p5()
                                            .child(
                                                div()
                                                    .text_xs()
                                                    .font_weight(gpui::FontWeight::BOLD)
                                                    .child(format!("📁 {}", proj_name)),
                                            )
                                            .child(
                                                div()
                                                    .text_xs()
                                                    .text_color(rgb(Theme::TEXT_MUTED))
                                                    .child(format!("({} 个脚本)", scripts.len())),
                                            ),
                                    )
                                    .child(div().flex().flex_wrap().gap_2().children(
                                        scripts.into_iter().map(|s| {
                                            let pid = proj_id.clone();
                                            let sid = s.id.clone();
                                            let sname = s.name.clone();
                                            div()
                                                .id(gpui::SharedString::from(format!(
                                                    "add-step-{}-{}",
                                                    pid, sid
                                                )))
                                                .px_2p5()
                                                .py_1()
                                                .rounded_md()
                                                .bg(rgb(Theme::APP_BG))
                                                .border_1()
                                                .border_color(rgb(Theme::BORDER))
                                                .cursor_pointer()
                                                .text_xs()
                                                .hover(|st| {
                                                    st.bg(rgb(0xe0e7ff)).border_color(rgb(0x818cf8))
                                                })
                                                .on_click(cx.listener(move |this, _, _, cx| {
                                                    this.add_step_to_current_group(
                                                        pid.clone(),
                                                        sid.clone(),
                                                    );
                                                    cx.notify();
                                                }))
                                                .child(format!("+ {}", sname))
                                        }),
                                    ))
                            })),
                    )
                    .child(
                        div().flex().justify_end().pt_2().child(
                            div()
                                .id("done-edit-group-btn")
                                .px_4()
                                .py_1p5()
                                .rounded_md()
                                .bg(rgb(Theme::PRIMARY))
                                .text_color(rgb(0xffffff))
                                .text_xs()
                                .cursor_pointer()
                                .hover(|s| s.bg(rgb(Theme::PRIMARY_HOVER)))
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.close_edit_group_modal();
                                    cx.notify();
                                }))
                                .child("完成"),
                        ),
                    ),
            )
    }
}
