use crate::app_state::DevHubApp;
use crate::ui::theme::Theme;
use gpui::{
    Context, IntoElement, MouseButton, ParentElement, Styled, Window, div, prelude::*, px, rgb,
};

impl DevHubApp {
    pub(crate) fn render_title_bar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let selected_group = self.groups.get(self.selected_group_idx);
        let active_task_name = selected_group.map(|g| g.name.clone());

        let mut left_container = div()
            .flex()
            .items_center()
            .gap_2p5()
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_center()
                    .size(px(20.0))
                    .rounded_md()
                    .bg(rgb(0x000000))
                    .text_color(rgb(0xffffff))
                    .text_xs()
                    .font_weight(gpui::FontWeight::BOLD)
                    .child("{ }"),
            )
            .child(
                div()
                    .flex()
                    .items_baseline()
                    .gap_1p5()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .text_color(rgb(Theme::TEXT_PRIMARY))
                            .child("DevHub"),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_MUTED))
                            .child("v1.7.3 (GPUI)"),
                    ),
            );

        if let Some(name) = active_task_name {
            left_container = left_container.child(
                div()
                    .flex()
                    .items_center()
                    .gap_1p5()
                    .px_2()
                    .py_0p5()
                    .rounded_full()
                    .bg(rgb(Theme::GREEN_BG))
                    .border_1()
                    .border_color(rgb(Theme::GREEN_BORDER))
                    .child(div().size(px(6.0)).rounded_full().bg(rgb(Theme::GREEN_DOT)))
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::GREEN_TEXT))
                            .child(format!("{} 运行中 3/3", name)),
                    ),
            );
        }

        let is_onion_active = self.show_debug_overlay;
        let is_outlines_active = self.show_layout_outlines;

        div()
            .id("window-draggable-titlebar")
            .flex()
            .flex_row()
            .justify_between()
            .items_center()
            .h(px(40.0))
            .pl_3()
            .pr_0()
            .bg(rgb(0xfafafa))
            .border_b_1()
            .border_color(rgb(Theme::BORDER))
            .cursor_default()
            // Native window dragging on single click, maximize/restore on double click
            .on_mouse_down(MouseButton::Left, |event, window, _| {
                if event.click_count == 2 {
                    window.zoom_window();
                } else if event.click_count == 1 {
                    window.start_window_move();
                }
            })
            // Right click opens native window context menu
            .on_mouse_down(MouseButton::Right, |event, window, _| {
                window.show_window_menu(event.position);
            })
            .child(left_container)
            .child(
                div()
                    .flex()
                    .items_center()
                    .h_full()
                    .gap_1()
                    // Onion Skinning Toggle
                    .child(
                        div()
                            .id("btn-toggle-onion")
                            .flex()
                            .items_center()
                            .gap_1()
                            .px_2()
                            .py_1()
                            .rounded_md()
                            .text_xs()
                            .cursor_pointer()
                            .bg(if is_onion_active {
                                rgb(0xfef3c7)
                            } else {
                                rgb(0xf4f4f5)
                            })
                            .text_color(if is_onion_active {
                                rgb(0xd97706)
                            } else {
                                rgb(Theme::TEXT_SECONDARY)
                            })
                            .hover(|s| s.bg(rgb(0xe4e4e7)))
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.toggle_debug_overlay();
                                cx.notify();
                            }))
                            .child(if is_onion_active {
                                "👁 蒙版 50%"
                            } else {
                                "👁 蒙版"
                            }),
                    )
                    // Layout Outlines Toggle
                    .child(
                        div()
                            .id("btn-toggle-outlines")
                            .flex()
                            .items_center()
                            .gap_1()
                            .px_2()
                            .py_1()
                            .rounded_md()
                            .text_xs()
                            .cursor_pointer()
                            .bg(if is_outlines_active {
                                rgb(0xfee2e2)
                            } else {
                                rgb(0xf4f4f5)
                            })
                            .text_color(if is_outlines_active {
                                rgb(0xdc2626)
                            } else {
                                rgb(Theme::TEXT_SECONDARY)
                            })
                            .hover(|s| s.bg(rgb(0xe4e4e7)))
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.toggle_layout_outlines();
                                cx.notify();
                            }))
                            .child(if is_outlines_active {
                                "📐 红线开"
                            } else {
                                "📐 红线"
                            }),
                    )
                    // Settings icon button
                    .child(
                        div()
                            .id("btn-open-settings")
                            .flex()
                            .items_center()
                            .justify_center()
                            .size(px(28.0))
                            .rounded_md()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                            .cursor_pointer()
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.open_settings_modal();
                                cx.notify();
                            }))
                            .child("⚙"),
                    )
                    // Minimize button (Native Windows 46px wide)
                    .child(
                        div()
                            .id("window-minimize-btn")
                            .flex()
                            .items_center()
                            .justify_center()
                            .w(px(46.0))
                            .h_full()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .hover(|s| s.bg(rgb(0xe4e4e7)).text_color(rgb(Theme::TEXT_PRIMARY)))
                            .cursor_pointer()
                            .on_click(|_, window, _| {
                                window.minimize_window();
                            })
                            .child("—"),
                    )
                    // Maximize / Restore button (Native Windows 46px wide)
                    .child(
                        div()
                            .id("window-maximize-btn")
                            .flex()
                            .items_center()
                            .justify_center()
                            .w(px(46.0))
                            .h_full()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .hover(|s| s.bg(rgb(0xe4e4e7)).text_color(rgb(Theme::TEXT_PRIMARY)))
                            .cursor_pointer()
                            .on_click(|_, window, _| {
                                window.zoom_window();
                            })
                            .child("▢"),
                    )
                    // Close button (Windows standard 46px wide red on hover)
                    .child(
                        div()
                            .id("window-close-btn")
                            .flex()
                            .items_center()
                            .justify_center()
                            .w(px(46.0))
                            .h_full()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_SECONDARY))
                            .hover(|s| s.bg(rgb(0xe81123)).text_color(rgb(0xffffff)))
                            .cursor_pointer()
                            .on_click(|_, _, cx| {
                                cx.quit();
                            })
                            .child("✕"),
                    ),
            )
    }
}
