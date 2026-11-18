use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};

use crate::app_state::DevHubApp;
use crate::ui::Theme;

impl DevHubApp {
    pub(crate) fn render_terminal_drawer(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let active_sess = self
            .process_mgr
            .active_session_id()
            .and_then(|id| self.process_mgr.sessions().iter().find(|s| s.id == id))
            .or_else(|| self.process_mgr.sessions().last());

        let (active_id, _active_title, active_lines, is_running) = match active_sess {
            Some(s) => (
                s.id.clone(),
                s.title.clone(),
                s.buffer.lines().to_vec(),
                s.is_running,
            ),
            None => (
                "".to_string(),
                "终端就绪".to_string(),
                vec!["[DevHub Terminal] No active console session.".to_string()],
                false,
            ),
        };

        let stop_id = active_id.clone();
        let clear_id = active_id.clone();

        div()
            .flex()
            .flex_col()
            .flex_shrink_0()
            .h(px(240.0))
            .bg(rgb(Theme::TERMINAL_BG))
            .text_color(rgb(Theme::TERMINAL_TEXT))
            .border_t_2()
            .border_color(rgb(Theme::BRAND_ORANGE))
            // Drawer Header with Sessions Tabs & Controls
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .px_4()
                    .py_1p5()
                    .bg(rgb(Theme::TERMINAL_HEADER))
                    // Left Tabs
                    .child(div().flex().items_center().gap_1().children(
                        self.process_mgr.sessions().iter().map(|s| {
                            let s_id = s.id.clone();
                            let is_sel = self.process_mgr.active_session_id() == Some(&s.id);
                            let title = s.title.clone();
                            let is_run = s.is_running;

                            div()
                                .id(SharedString::from(format!("term-tab-{}", s.id)))
                                .flex()
                                .items_center()
                                .gap_1p5()
                                .px_2p5()
                                .py_1()
                                .rounded_t_md()
                                .bg(if is_sel {
                                    rgb(Theme::TERMINAL_BG)
                                } else {
                                    rgb(Theme::TERMINAL_HEADER)
                                })
                                .text_xs()
                                .text_color(if is_sel {
                                    rgb(0xffffff)
                                } else {
                                    rgb(Theme::TERMINAL_MUTED)
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.process_mgr.set_active_session(s_id.clone());
                                    cx.notify();
                                }))
                                .child(div().size(px(5.0)).rounded_full().bg(if is_run {
                                    rgb(Theme::GREEN_DOT)
                                } else {
                                    rgb(Theme::BORDER)
                                }))
                                .child(title)
                        }),
                    ))
                    // Right Action Controls
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_3()
                            .child(if is_running {
                                div()
                                    .id("term-stop-btn")
                                    .text_xs()
                                    .text_color(rgb(0xf38ba8))
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        this.process_mgr.stop(&stop_id);
                                        cx.notify();
                                    }))
                                    .child("中断进程 [Ctrl+C]")
                            } else {
                                div()
                                    .id("term-stopped-label")
                                    .text_xs()
                                    .text_color(rgb(Theme::TERMINAL_MUTED))
                                    .child("已结束")
                            })
                            .child(
                                div()
                                    .id("term-clear-btn")
                                    .text_xs()
                                    .text_color(rgb(Theme::TERMINAL_MUTED))
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        if let Some(sess) = this.process_mgr.active_session_mut() {
                                            if sess.id == clear_id {
                                                sess.buffer.clear();
                                                cx.notify();
                                            }
                                        }
                                    }))
                                    .child("清屏"),
                            )
                            .child(
                                div()
                                    .id("close-log-btn")
                                    .text_xs()
                                    .text_color(rgb(Theme::TERMINAL_MUTED))
                                    .cursor_pointer()
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.show_drawer = false;
                                        cx.notify();
                                    }))
                                    .child("关闭 [✕]"),
                            ),
                    ),
            )
            // Output Content Lines
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_grow()
                    .p_3()
                    .text_xs()
                    .font_family("monospace")
                    .children(
                        active_lines
                            .iter()
                            .rev()
                            .take(18)
                            .collect::<Vec<_>>()
                            .into_iter()
                            .rev()
                            .map(|line| div().py_0p5().child(line.clone())),
                    ),
            )
    }
}
