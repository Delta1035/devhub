use gpui::{Context, IntoElement, SharedString, div, prelude::*, rgb};
use std::path::{Path, PathBuf};

use crate::app_state::DevHubApp;
use crate::core::editors::EditorService;
use crate::domain::AvailableEditor;
use crate::ui::Theme;

impl DevHubApp {
    pub(crate) fn render_project_view(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let selected_project = self.projects.get(self.selected_project_idx).cloned();
        let proj = selected_project.unwrap_or_else(|| self.projects[0].clone());
        let empty_scripts = Vec::new();
        let scripts = self
            .all_scripts
            .get(&proj.id)
            .unwrap_or(&empty_scripts)
            .clone();
        let proj_id_for_refresh = proj.id.clone();
        let active_sess_id = self.process_mgr.active_session_id().map(|s| s.to_string());

        let filtered_scripts: Vec<_> = scripts
            .into_iter()
            .filter(|s| {
                if self.script_filter.is_empty() {
                    true
                } else {
                    let f = self.script_filter.to_lowercase();
                    s.name.to_lowercase().contains(&f) || s.command.to_lowercase().contains(&f)
                }
            })
            .collect();

        div()
            .id("project-view-scroll")
            .flex()
            .flex_col()
            .flex_1()
            .overflow_y_scroll()
            .bg(rgb(Theme::APP_BG))
            // 1. Top Toolbar
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .px_6()
                    .py_4()
                    .border_b_1()
                    .border_color(rgb(Theme::BORDER))
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .child(
                                div()
                                    .text_lg()
                                    .font_weight(gpui::FontWeight::BOLD)
                                    .child(proj.name.clone()),
                            )
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .child(proj.path.clone()),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            // Installed Editors
                            .children(self.installed_editors.iter().map(
                                |editor: &AvailableEditor| {
                                    let ed = editor.clone();
                                    let target_path = proj.path.clone();

                                    div()
                                        .id(SharedString::from(format!(
                                            "open-editor-{}",
                                            editor.name
                                        )))
                                        .px_3()
                                        .py_1p5()
                                        .rounded_md()
                                        .border_1()
                                        .border_color(rgb(Theme::BORDER))
                                        .bg(rgb(Theme::CARD_BG))
                                        .text_xs()
                                        .cursor_pointer()
                                        .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                        .on_click(cx.listener(move |_, _, _, _| {
                                            let _ = EditorService::launch(
                                                &ed.bin_path,
                                                Path::new(&target_path),
                                            );
                                        }))
                                        .child(editor.name.clone())
                                },
                            ))
                            // Open Folder in System File Manager
                            .child({
                                let dir_path = proj.path.clone();
                                div()
                                    .id("open-dir-btn")
                                    .px_3()
                                    .py_1p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(move |_, _, _, _| {
                                        #[cfg(target_os = "windows")]
                                        let _ = std::process::Command::new("explorer")
                                            .arg(&dir_path)
                                            .spawn();
                                        #[cfg(not(target_os = "windows"))]
                                        let _ = std::process::Command::new("xdg-open")
                                            .arg(&dir_path)
                                            .spawn();
                                    }))
                                    .child("📁 目录")
                            })
                            // Refresh Scripts
                            .child(
                                div()
                                    .id("refresh-scripts-btn")
                                    .px_3()
                                    .py_1p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(Theme::BORDER))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_xs()
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        this.refresh_scripts(&proj_id_for_refresh);
                                        cx.notify();
                                    }))
                                    .child("↻ 刷新"),
                            )
                            // Remove Project
                            .child(
                                div()
                                    .id("remove-project-btn")
                                    .px_3()
                                    .py_1p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(0xfecaca))
                                    .bg(rgb(Theme::CARD_BG))
                                    .text_xs()
                                    .text_color(rgb(0xef4444))
                                    .cursor_pointer()
                                    .hover(|s| s.bg(rgb(0xfee2e2)))
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.remove_current_project();
                                        cx.notify();
                                    }))
                                    .child("🗑 移除"),
                            ),
                    ),
            )
            // 2. Filter Bar
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .px_6()
                    .py_2()
                    .bg(rgb(Theme::SIDEBAR_BG))
                    .border_b_1()
                    .border_color(rgb(Theme::BORDER_SUBTLE))
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_MUTED))
                            .child(format!(
                                "共 {} 个脚本（已显示 {} 个）",
                                self.all_scripts.get(&proj.id).map(|s| s.len()).unwrap_or(0),
                                filtered_scripts.len()
                            )),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_1p5()
                            .child(self.filter_tag("全部", "", cx))
                            .child(self.filter_tag("dev", "dev", cx))
                            .child(self.filter_tag("build", "build", cx))
                            .child(self.filter_tag("test", "test", cx)),
                    ),
            )
            // 3. Scripts List
            .child(div().flex().flex_col().p_6().gap_2().children(
                filtered_scripts.into_iter().enumerate().map(|(idx, s)| {
                    let script = s.clone();
                    let s_id = s.id.clone();
                    let s_name = s.name.clone();
                    let s_cmd = s.command.clone();
                    let is_current_running = active_sess_id.as_deref() == Some(&s_id);
                    let s_id_for_stop = s_id.clone();

                    div()
                        .flex()
                        .justify_between()
                        .items_center()
                        .p_3()
                        .rounded_lg()
                        .border_1()
                        .border_color(rgb(Theme::BORDER))
                        .bg(rgb(Theme::CARD_BG))
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(
                                            div()
                                                .text_sm()
                                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                                .child(s_name.clone()),
                                        )
                                        .child(
                                            div()
                                                .px_1p5()
                                                .py_0p5()
                                                .rounded_sm()
                                                .bg(rgb(Theme::BADGE_BG))
                                                .text_xs()
                                                .text_color(rgb(Theme::TEXT_SECONDARY))
                                                .child(format!("{:?}", s.source).to_lowercase()),
                                        ),
                                )
                                .child(
                                    div()
                                        .text_xs()
                                        .text_color(rgb(Theme::TEXT_MUTED))
                                        .child(s_cmd),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_2()
                                // View Run History
                                .child(
                                    div()
                                        .id(SharedString::from(format!("script-history-{}", idx)))
                                        .px_2p5()
                                        .py_1()
                                        .rounded_md()
                                        .border_1()
                                        .border_color(rgb(Theme::BORDER))
                                        .bg(rgb(Theme::CARD_BG))
                                        .text_xs()
                                        .text_color(rgb(Theme::TEXT_SECONDARY))
                                        .cursor_pointer()
                                        .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                                        .on_click(cx.listener({
                                            let hist_name = s_name.clone();
                                            move |this, _, _, cx| {
                                                this.open_history_modal(Some(hist_name.clone()));
                                                cx.notify();
                                            }
                                        }))
                                        .child("🕒 历史"),
                                )
                                // Run / Stop
                                .child(if is_current_running {
                                    div()
                                        .id(SharedString::from(format!("script-stop-{}", idx)))
                                        .px_3()
                                        .py_1()
                                        .rounded_md()
                                        .border_1()
                                        .border_color(rgb(Theme::BORDER))
                                        .bg(rgb(Theme::CARD_BG))
                                        .text_color(rgb(0xef4444))
                                        .text_xs()
                                        .font_weight(gpui::FontWeight::MEDIUM)
                                        .cursor_pointer()
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.process_mgr.stop(&s_id_for_stop);
                                            cx.notify();
                                        }))
                                        .child("■ 停止")
                                } else {
                                    div()
                                        .id(SharedString::from(format!("script-run-{}", idx)))
                                        .px_3()
                                        .py_1()
                                        .rounded_md()
                                        .bg(rgb(Theme::BRAND_ORANGE))
                                        .text_color(rgb(0xffffff))
                                        .text_xs()
                                        .font_weight(gpui::FontWeight::MEDIUM)
                                        .cursor_pointer()
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            let id = script.id.clone();
                                            let title = script.name.clone();
                                            let cmd = script.command.clone();
                                            let cwd = PathBuf::from(&script.cwd);
                                            let _ = this.process_mgr.spawn(id, title, cmd, &cwd);
                                            this.show_drawer = true;
                                            cx.notify();
                                        }))
                                        .child("▶ 执行")
                                }),
                        )
                }),
            ))
    }

    fn filter_tag(
        &self,
        label: &'static str,
        filter: &'static str,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let is_active = self.script_filter == filter;
        div()
            .id(SharedString::from(format!("filter-tag-{}", label)))
            .px_2()
            .py_0p5()
            .rounded_md()
            .bg(if is_active {
                rgb(Theme::BRAND_ORANGE)
            } else {
                rgb(Theme::CARD_BG)
            })
            .text_color(if is_active {
                rgb(0xffffff)
            } else {
                rgb(Theme::TEXT_SECONDARY)
            })
            .border_1()
            .border_color(if is_active {
                rgb(Theme::BRAND_ORANGE)
            } else {
                rgb(Theme::BORDER)
            })
            .text_xs()
            .cursor_pointer()
            .on_click(cx.listener(move |this, _, _, cx| {
                this.script_filter = filter.to_string();
                cx.notify();
            }))
            .child(label)
    }
}
