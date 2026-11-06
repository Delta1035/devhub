use crate::app_state::DevHubApp;
use crate::ui::theme::Theme;
use gpui::{Context, IntoElement, MouseButton, ParentElement, Styled, div, prelude::*, px, rgb};

impl DevHubApp {
    pub(crate) fn render_history_modal(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let all_records = self.storage.load_history();
        let filter_name = self.selected_script_history_name.clone();

        let filtered_records: Vec<_> = all_records
            .into_iter()
            .filter(|r| {
                if let Some(target) = &filter_name {
                    &r.script_name == target
                } else {
                    true
                }
            })
            .collect();

        let title = match &filter_name {
            Some(name) => format!("「{}」执行历史记录", name),
            None => "全量脚本执行历史记录".to_string(),
        };

        div()
            .id("modal-history-backdrop")
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
                    .w(px(640.0))
                    .max_h(px(540.0))
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
                                            .child(title),
                                    )
                                    .child(
                                        div()
                                            .px_2()
                                            .py_0p5()
                                            .rounded_full()
                                            .bg(rgb(Theme::BADGE_BG))
                                            .text_xs()
                                            .text_color(rgb(Theme::TEXT_MUTED))
                                            .child(format!("{} 条记录", filtered_records.len())),
                                    ),
                            )
                            .child(
                                div()
                                    .id("close-history-modal-btn")
                                    .cursor_pointer()
                                    .text_sm()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .hover(|s| s.text_color(rgb(Theme::TEXT_PRIMARY)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.close_history_modal();
                                        cx.notify();
                                    }))
                                    .child("✕"),
                            ),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .child("展示脚本最近运行的执行状态、退出码与消耗时长："),
                    )
                    .child(
                        div()
                            .id("history-scroll-list")
                            .flex_1()
                            .overflow_y_scroll()
                            .flex()
                            .flex_col()
                            .gap_2()
                            .p_1()
                            .children(if filtered_records.is_empty() {
                                vec![
                                    div()
                                        .py_10()
                                        .flex()
                                        .justify_center()
                                        .items_center()
                                        .text_xs()
                                        .text_color(rgb(Theme::TEXT_MUTED))
                                        .child("暂无该脚本的执行记录")
                                        .into_any_element(),
                                ]
                            } else {
                                filtered_records
                                    .iter()
                                    .map(|record| {
                                        let is_success = record.exit_code == Some(0);
                                        let is_running = record.status == "running";
                                        let duration_str =
                                            match (record.finished_at, record.started_at) {
                                                (Some(end), start) if end >= start => {
                                                    let diff = (end - start) as f64 / 1000.0;
                                                    format!("{:.1}s", diff)
                                                }
                                                _ => {
                                                    if is_running {
                                                        "进行中".into()
                                                    } else {
                                                        "-".into()
                                                    }
                                                }
                                            };

                                        div()
                                            .flex()
                                            .items_center()
                                            .justify_between()
                                            .p_3()
                                            .rounded_lg()
                                            .bg(rgb(Theme::SIDEBAR_BG))
                                            .border_1()
                                            .border_color(rgb(Theme::BORDER))
                                            .child(
                                                div()
                                                    .flex()
                                                    .flex_col()
                                                    .gap_1()
                                                    .child(
                                                        div()
                                                            .flex()
                                                            .items_center()
                                                            .gap_2()
                                                            .child(
                                                                div()
                                                                    .text_xs()
                                                                    .font_weight(
                                                                        gpui::FontWeight::BOLD,
                                                                    )
                                                                    .child(
                                                                        record.script_name.clone(),
                                                                    ),
                                                            )
                                                            .child(if is_running {
                                                                div()
                                                                    .px_1p5()
                                                                    .py_0p5()
                                                                    .rounded_md()
                                                                    .bg(rgb(0xdbeafe))
                                                                    .text_xs()
                                                                    .text_color(rgb(0x2563eb))
                                                                    .child("执行中")
                                                            } else if is_success {
                                                                div()
                                                                    .px_1p5()
                                                                    .py_0p5()
                                                                    .rounded_md()
                                                                    .bg(rgb(0xdcfce7))
                                                                    .text_xs()
                                                                    .text_color(rgb(0x15803d))
                                                                    .child("成功")
                                                            } else {
                                                                div()
                                                                    .px_1p5()
                                                                    .py_0p5()
                                                                    .rounded_md()
                                                                    .bg(rgb(0xfee2e2))
                                                                    .text_xs()
                                                                    .text_color(rgb(0xdc2626))
                                                                    .child(format!(
                                                                        "退出码 {:?}",
                                                                        record.exit_code
                                                                    ))
                                                            }),
                                                    )
                                                    .child(
                                                        div()
                                                            .text_xs()
                                                            .text_color(rgb(Theme::TEXT_MUTED))
                                                            .child(record.command.clone()),
                                                    ),
                                            )
                                            .child(
                                                div()
                                                    .flex()
                                                    .flex_col()
                                                    .items_end()
                                                    .gap_0p5()
                                                    .child(
                                                        div()
                                                            .text_xs()
                                                            .font_weight(gpui::FontWeight::MEDIUM)
                                                            .child(duration_str),
                                                    )
                                                    .child(
                                                        div()
                                                            .text_xs()
                                                            .text_color(rgb(Theme::TEXT_MUTED))
                                                            .child(format!("ID: {}", record.id)),
                                                    ),
                                            )
                                            .into_any_element()
                                    })
                                    .collect()
                            }),
                    )
                    .child(
                        div().flex().justify_end().pt_2().child(
                            div()
                                .id("close-history-btn")
                                .px_4()
                                .py_1p5()
                                .rounded_md()
                                .bg(rgb(Theme::PRIMARY))
                                .text_color(rgb(0xffffff))
                                .text_xs()
                                .cursor_pointer()
                                .hover(|s| s.bg(rgb(Theme::PRIMARY_HOVER)))
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.close_history_modal();
                                    cx.notify();
                                }))
                                .child("关闭"),
                        ),
                    ),
            )
    }
}
