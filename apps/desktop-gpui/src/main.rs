#![allow(dead_code, unused_imports)]

mod app_state;
mod core;
mod domain;
mod ui;

use gpui::{
    App, Application, Bounds, Context, IntoElement, Render, TitlebarOptions, Window, WindowBounds,
    WindowDecorations, WindowOptions, div, prelude::*, px, rgb, size,
};

use crate::app_state::{DevHubApp, SidebarTab};
use crate::ui::Theme;

impl Render for DevHubApp {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.tick_engine() {
            cx.notify();
        }
        if self.process_mgr.is_any_running() || self.group_executor.is_running() {
            window.request_animation_frame();
        }

        let is_any_running = self.process_mgr.is_any_running();

        let mut root = div()
            .flex()
            .flex_col()
            .size_full()
            .relative()
            .bg(rgb(Theme::APP_BG))
            .text_color(rgb(Theme::TEXT_PRIMARY))
            .rounded_xl()
            .border_1()
            .border_color(if self.show_layout_outlines {
                rgb(0xef4444)
            } else {
                rgb(0xd4d4d8)
            })
            .shadow_2xl()
            .overflow_hidden()
            .child(self.render_title_bar(cx))
            .child(
                div()
                    .flex()
                    .flex_row()
                    .flex_1()
                    .overflow_hidden()
                    .child(self.render_sidebar(cx))
                    .child(if self.current_tab == SidebarTab::BatchTasks {
                        self.render_batch_view(cx).into_any_element()
                    } else {
                        self.render_project_view(cx).into_any_element()
                    }),
            )
            .child(if self.show_drawer || is_any_running {
                div()
                    .child(self.render_terminal_drawer(cx))
                    .into_any_element()
            } else {
                div()
                    .id("collapsed-terminal-bar")
                    .h(px(26.0))
                    .bg(rgb(Theme::SIDEBAR_BG))
                    .border_t_1()
                    .border_color(rgb(Theme::BORDER))
                    .flex()
                    .items_center()
                    .justify_between()
                    .px_3()
                    .cursor_pointer()
                    .hover(|s| s.bg(rgb(Theme::HOVER_BG)))
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.show_drawer = true;
                        cx.notify();
                    }))
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_MUTED))
                                    .child("⌨ 终端控制台"),
                            )
                            .child(
                                div()
                                    .px_1p5()
                                    .py_0p5()
                                    .rounded_md()
                                    .bg(rgb(Theme::BADGE_BG))
                                    .text_xs()
                                    .text_color(rgb(Theme::TEXT_SECONDARY))
                                    .child("就绪"),
                            ),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(rgb(Theme::TEXT_MUTED))
                            .child("点击展开 ▲"),
                    )
                    .into_any_element()
            })
            .child(self.render_modals(cx));

        // Onion Skinning: Superimpose 50% opacity web reference screenshot
        if self.show_debug_overlay {
            let ref_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("web-reference.png");
            if ref_path.exists() {
                root = root.child(
                    div()
                        .absolute()
                        .inset_0()
                        .opacity(self.debug_overlay_opacity)
                        .child(gpui::img(ref_path).size_full()),
                );
            }
        }

        root
    }
}

fn main() {
    Application::new().run(|cx: &mut App| {
        // Pixel-perfect baseline: 1280x800 unified viewport
        let bounds = Bounds::centered(None, size(px(1280.0), px(800.0)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                titlebar: Some(TitlebarOptions {
                    title: Some("DevHub".into()),
                    appears_transparent: true,
                    traffic_light_position: None,
                }),
                window_decorations: Some(WindowDecorations::Client),
                ..Default::default()
            },
            |_window, _cx| _cx.new(|_| DevHubApp::new()),
        )
        .unwrap();
        cx.activate(true);
    });
}
