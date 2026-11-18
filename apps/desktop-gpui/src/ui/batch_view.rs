use gpui::{Context, IntoElement, SharedString, div, prelude::*, rgb};

use crate::app_state::DevHubApp;
use crate::core::groups::StepStatus;
use crate::ui::Theme;

impl DevHubApp {
    pub(crate) fn render_batch_view(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let selected_group = self.groups.get(self.selected_group_idx).cloned();
        let group = selected_group.unwrap_or_else(|| self.groups[0].clone());
        let mode_text = if group.mode == "parallel" {
            "并行"
        } else {
            "串行"
        };
        let steps = group.steps.clone();
        let is_running = self.group_executor.is_running();
        let group_for_run = group.clone();

        div()
            .id("batch-view-scroll")
            .flex()
            .flex_col()
            .flex_1()
            .overflow_y_scroll()
            .bg(rgb(Theme::APP_BG))
            .p_6()
            .gap_4()
            // Header
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1()
                            .child(
                                div()
                                    .text_2xl()
                                    .font_weight(gpui::FontWeight::BOLD)
                                    .child(group.name.clone()),
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(Theme::TEXT_SECONDARY))
                                    .child(format!("{} · 共 {} 个步骤", mode_text, steps.len())),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .id("batch-exec-btn")
                                    .px_4()
                                    .py_2()
                                    .rounded_md()
                                    .bg(if is_running {
                                        rgb(Theme::BADGE_BG)
                                    } else {
                                        rgb(Theme::BRAND_ORANGE)
                                    })
                                    .text_color(if is_running {
                                        rgb(Theme::TEXT_MUTED)
                                    } else {
                                        rgb(0xffffff)
                                    })
                                    .text_sm()
                                    .font_weight(gpui::FontWeight::SEMIBOLD)
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        let grp = group_for_run.clone();
                                        this.group_executor.start_group(
                                            grp,
                                            &this.projects,
                                            &this.all_scripts,
                                            &mut this.process_mgr,
                                        );
                                        this.show_drawer = true;
                                        cx.notify();
                                    }))
                                    .child("▷ 执行"),
                            )
                            .child(
                                div()
                                    .id("batch-stop-btn")
                                    .px_3()
                                    .py_2()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_sm()
                                    .cursor_pointer()
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.group_executor.stop(&mut this.process_mgr);
                                        cx.notify();
                                    }))
                                    .child("□ 停止全部"),
                            )
                            .child(
                                div()
                                    .id("batch-edit-btn")
                                    .px_3()
                                    .py_2()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_sm()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.open_edit_group_modal();
                                        cx.notify();
                                    }))
                                    .child("✎ 编辑"),
                            )
                            .child(
                                div()
                                    .id("batch-delete-btn")
                                    .px_3()
                                    .py_2()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(0xfecaca))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_sm()
                                    .text_color(rgb(0xef4444))
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(0xfee2e2)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.remove_current_group();
                                        cx.notify();
                                    }))
                                    .child("🗑 删除"),
                            ),
                    ),
            )
            // Step Cards
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .children(steps.into_iter().enumerate().map(|(idx, step)| {
                        let step_title = format!("{}. {}", idx + 1, step.script_id);
                        let status = self.group_executor.get_step_status(idx);

                        let (status_text, status_color) = match status {
                            StepStatus::Pending => ("已就绪", Theme::TEXT_SECONDARY),
                            StepStatus::Running => ("运行中...", Theme::BRAND_ORANGE),
                            StepStatus::Success => ("✓ 成功", Theme::GREEN_DOT),
                            StepStatus::Failed => ("✕ 失败", 0xef4444),
                        };

                        div()
                            .flex()
                            .flex_col()
                            .p_4()
                            .rounded_xl()
                            .bg(rgb(Theme::CARD_BG))
                            .border_1()
                            .border_color(rgb(Theme::BORDER))
                            .gap_2()
                            .child(
                                div()
                                    .flex()
                                    .justify_between()
                                    .items_center()
                                    .child(
                                        div()
                                            .text_sm()
                                            .font_weight(gpui::FontWeight::SEMIBOLD)
                                            .child(step_title),
                                    )
                                    .child(
                                        div()
                                            .px_2()
                                            .py_0p5()
                                            .rounded_md()
                                            .bg(rgb(Theme::BADGE_BG))
                                            .text_xs()
                                            .text_color(rgb(status_color))
                                            .child(status_text),
                                    ),
                            )
                            .child(
                                div()
                                    .flex()
                                    .justify_between()
                                    .items_center()
                                    .pt_2()
                                    .border_t_1()
                                    .border_color(rgb(Theme::BORDER_SUBTLE))
                                    .child(
                                        div()
                                            .text_xs()
                                            .text_color(rgb(Theme::TEXT_MUTED))
                                            .child(format!("条件: {:?}", step.continue_when)),
                                    )
                                    .child(
                                        div()
                                            .id(SharedString::from(format!(
                                                "view-step-log-{}",
                                                idx
                                            )))
                                            .text_xs()
                                            .text_color(rgb(Theme::TEXT_SECONDARY))
                                            .cursor_pointer()
                                            .on_click(cx.listener(move |this, _, _, cx| {
                                                let session_id = format!("group-step-{}", idx);
                                                this.process_mgr.set_active_session(session_id);
                                                this.show_drawer = true;
                                                cx.notify();
                                            }))
                                            .child("查看日志"),
                                    ),
                            )
                    })),
            )
    }
}
