use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};

use crate::app_state::{DevHubApp, SidebarTab};
use crate::ui::Theme;

impl DevHubApp {
    pub(crate) fn render_sidebar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let is_running = self.process_mgr.is_any_running();
        let selected_group = self.groups.get(self.selected_group_idx);
        let active_task_name = selected_group.map(|g| g.name.clone());

        div()
            .flex()
            .flex_col()
            .w(px(256.0))
            .bg(rgb(Theme::SIDEBAR_BG))
            .border_r_1()
            .border_color(rgb(Theme::BORDER))
            .p_3()
            .gap_3()
            // 1. Top Active Running Pill
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .px_3()
                    .py_2()
                    .rounded_lg()
                    .bg(rgb(Theme::CARD_BG))
                    .border_1()
                    .border_color(rgb(Theme::BORDER))
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(div().size(px(7.0)).rounded_full().bg(if is_running {
                                rgb(Theme::BRAND_ORANGE)
                            } else {
                                rgb(Theme::GREEN_DOT)
                            }))
                            .child(
                                div().text_xs().font_weight(gpui::FontWeight::MEDIUM).child(
                                    active_task_name.unwrap_or_else(|| "DevHub".to_string()),
                                ),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .child(if is_running { "运行中" } else { "就绪" }),
                            )
                            .child(
                                div()
                                    .id("stop-active-btn")
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .cursor_pointer()
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.process_mgr.stop_all();
                                        cx.notify();
                                    }))
                                    .child("□"),
                            ),
                    ),
            )
            // 2. Segmented Tabs Switcher
            .child(
                div()
                    .flex()
                    .p_0p5()
                    .rounded_lg()
                    .bg(rgb(Theme::BADGE_BG))
                    .child(
                        div()
                            .id("tab-projects")
                            .flex()
                            .flex_1()
                            .justify_center()
                            .py_1()
                            .rounded_md()
                            .bg(if self.current_tab == SidebarTab::Projects {
                                rgb(Theme::CARD_BG)
                            } else {
                                rgb(Theme::BADGE_BG)
                            })
                            .text_xs()
                            .font_weight(gpui::FontWeight::MEDIUM)
                            .text_color(if self.current_tab == SidebarTab::Projects {
                                rgb(Theme::TEXT_PRIMARY)
                            } else {
                                rgb(Theme::TEXT_SECONDARY)
                            })
                            .cursor_pointer()
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.current_tab = SidebarTab::Projects;
                                cx.notify();
                            }))
                            .child("项目"),
                    )
                    .child(
                        div()
                            .id("tab-batch")
                            .flex()
                            .flex_1()
                            .justify_center()
                            .items_center()
                            .gap_1()
                            .py_1()
                            .rounded_md()
                            .bg(if self.current_tab == SidebarTab::BatchTasks {
                                rgb(Theme::CARD_BG)
                            } else {
                                rgb(Theme::BADGE_BG)
                            })
                            .text_xs()
                            .font_weight(gpui::FontWeight::MEDIUM)
                            .text_color(if self.current_tab == SidebarTab::BatchTasks {
                                rgb(Theme::TEXT_PRIMARY)
                            } else {
                                rgb(Theme::TEXT_SECONDARY)
                            })
                            .cursor_pointer()
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.current_tab = SidebarTab::BatchTasks;
                                cx.notify();
                            }))
                            .child("批量")
                            .child(div().size(px(5.0)).rounded_full().bg(rgb(Theme::GREEN_DOT))),
                    ),
            )
            // 3. Tab List Content
            .child(if self.current_tab == SidebarTab::BatchTasks {
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .items_center()
                            .py_1()
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .child(format!("{} 个任务", self.groups.len())),
                            )
                            .child(
                                div()
                                    .id("new-group-btn")
                                    .px_2()
                                    .py_0p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.open_new_group_modal();
                                        cx.notify();
                                    }))
                                    .child("+ 新建"),
                            ),
                    )
                    .child(
                        div()
                            .id("sidebar-groups-scroll")
                            .flex()
                            .flex_col()
                            .flex_1()
                            .overflow_y_scroll()
                            .gap_1()
                            .children(self.groups.iter().enumerate().map(|(idx, group)| {
                                let is_sel = self.selected_group_idx == idx;
                                let name = group.name.clone();
                                let mode_text = if group.mode == "parallel" {
                                    "并行"
                                } else {
                                    "串行"
                                };

                                div()
                                    .id(SharedString::from(format!("group-task-{}", idx)))
                                    .flex()
                                    .justify_between()
                                    .items_center()
                                    .px_3()
                                    .py_2()
                                    .rounded_lg()
                                    .bg(if is_sel {
                                        rgb(Theme::BADGE_BG)
                                    } else {
                                        rgb(Theme::SIDEBAR_BG)
                                    })
                                    .border_1()
                                    .border_color(if is_sel {
                                        rgb(Theme::BORDER)
                                    } else {
                                        rgb(Theme::SIDEBAR_BG)
                                    })
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        this.selected_group_idx = idx;
                                        cx.notify();
                                    }))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            .child(
                                                div()
                                                    .text_sm()
                                                    .text_color(rgb(Theme::TEXT_MUTED))
                                                    .child("☵"),
                                            )
                                            .child(
                                                div()
                                                    .flex()
                                                    .flex_col()
                                                    .child(
                                                        div()
                                                            .flex()
                                                            .items_center()
                                                            .gap_1p5()
                                                            .child(
                                                                div()
                                                                    .text_sm()
                                                                    .font_weight(
                                                                        gpui::FontWeight::SEMIBOLD,
                                                                    )
                                                                    .child(name),
                                                            )
                                                            .child(
                                                                div()
                                                                    .px_1p5()
                                                                    .py_0p5()
                                                                    .rounded_sm()
                                                                    .bg(rgb(Theme::BADGE_BG))
                                                                    .text_xs()
                                                                    .text_color(rgb(
                                                                        Theme::TEXT_SECONDARY,
                                                                    ))
                                                                    .child(mode_text),
                                                            ),
                                                    )
                                                    .child(
                                                        div()
                                                            .text_xs()
                                                            .text_color(rgb(Theme::TEXT_MUTED))
                                                            .child(format!(
                                                                "{} 个步骤",
                                                                group.steps.len()
                                                            )),
                                                    ),
                                            ),
                                    )
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            .text_xs()
                                            .text_color(rgb(Theme::TEXT_SECONDARY))
                                            .child("▷")
                                            .child("□")
                                            .child("✎"),
                                    )
                            })),
                    )
            } else {
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .items_center()
                            .py_1()
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .child(format!("{} 个项目", self.projects.len())),
                            )
                            .child(
                                div()
                                    .id("add-project-btn")
                                    .px_2()
                                    .py_0p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.open_add_project_modal();
                                        cx.notify();
                                    }))
                                    .child("+ 添加"),
                            ),
                    )
                    .child(
                        div()
                            .id("sidebar-projects-scroll")
                            .flex()
                            .flex_col()
                            .flex_1()
                            .overflow_y_scroll()
                            .gap_1()
                            .children(self.projects.iter().enumerate().map(|(idx, proj)| {
                                let is_sel = self.selected_project_idx == idx;
                                let name = proj.name.clone();

                                div()
                                    .id(SharedString::from(format!("proj-item-{}", idx)))
                                    .flex()
                                    .justify_between()
                                    .items_center()
                                    .px_3()
                                    .py_2()
                                    .rounded_lg()
                                    .bg(if is_sel {
                                        rgb(Theme::BADGE_BG)
                                    } else {
                                        rgb(Theme::SIDEBAR_BG)
                                    })
                                    .border_1()
                                    .border_color(if is_sel {
                                        rgb(Theme::BORDER)
                                    } else {
                                        rgb(Theme::SIDEBAR_BG)
                                    })
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        if idx < this.projects.len() {
                                            this.selected_project_idx = idx;
                                            let proj_id = this.projects[idx].id.clone();
                                            this.refresh_scripts(&proj_id);
                                            cx.notify();
                                        }
                                    }))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            .child(div().text_sm().child("📁"))
                                            .child(
                                                div()
                                                    .text_sm()
                                                    .font_weight(if is_sel {
                                                        gpui::FontWeight::BOLD
                                                    } else {
                                                        gpui::FontWeight::NORMAL
                                                    })
                                                    .child(name),
                                            ),
                                    )
                            })),
                    )
            })
    }
}
