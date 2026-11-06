pub mod group;
pub mod history;
pub mod project;
pub mod settings;

use crate::app_state::DevHubApp;
use gpui::{Context, IntoElement, div, prelude::*};

impl DevHubApp {
    pub fn render_modals(&self, cx: &mut Context<Self>) -> impl IntoElement {
        if self.show_add_project_modal {
            self.render_add_project_modal(cx).into_any_element()
        } else if self.show_new_group_modal {
            self.render_new_group_modal(cx).into_any_element()
        } else if self.show_edit_group_modal {
            self.render_edit_group_modal(cx).into_any_element()
        } else if self.show_settings_modal {
            self.render_settings_modal(cx).into_any_element()
        } else if self.show_history_modal {
            self.render_history_modal(cx).into_any_element()
        } else {
            div().into_any_element()
        }
    }
}
