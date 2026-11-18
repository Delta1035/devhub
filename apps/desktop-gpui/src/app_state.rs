use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::core::Storage;
use crate::core::detectors::detect_all_scripts;
use crate::core::editors::EditorService;
use crate::core::groups::GroupExecutor;
use crate::core::process::ProcessManager;
use crate::domain::{AvailableEditor, Group, Project, Script, Workspace};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SidebarTab {
    Projects,
    BatchTasks,
}

pub struct DevHubApp {
    pub storage: Storage,
    pub current_tab: SidebarTab,
    pub projects: Vec<Project>,
    pub selected_project_idx: usize,
    pub all_scripts: HashMap<String, Vec<Script>>,
    pub groups: Vec<Group>,
    pub selected_group_idx: usize,
    pub workspaces: Vec<Workspace>,
    pub installed_editors: Vec<AvailableEditor>,
    pub process_mgr: ProcessManager,
    pub group_executor: GroupExecutor,
    pub show_drawer: bool,
    pub show_debug_overlay: bool,
    pub debug_overlay_opacity: f32,
    pub show_layout_outlines: bool,

    // Modal Dialog states
    pub show_add_project_modal: bool,
    pub input_project_path: String,
    pub input_project_name: String,
    pub add_project_error: Option<String>,

    pub show_new_group_modal: bool,
    pub input_group_name: String,
    pub input_group_mode: String,

    pub show_settings_modal: bool,
    pub show_history_modal: bool,
    pub selected_script_history_name: Option<String>,
    pub show_edit_group_modal: bool,
    pub script_filter: String,
}

impl DevHubApp {
    pub fn repository_root() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(Path::parent)
            .expect("GPUI crate must be inside the repository apps directory")
            .to_path_buf()
    }

    pub fn new() -> Self {
        let repository_root = Self::repository_root();
        let storage = Storage::new();
        let mut projects = storage.load_projects();
        let mut groups = storage.load_groups();
        let workspaces = storage.load_workspaces();
        let installed_editors = EditorService::detect_installed_editors();

        if projects.is_empty() {
            projects.push(Project {
                id: "devhub".into(),
                name: "devhub".into(),
                path: repository_root.to_string_lossy().into_owned(),
                added_at: None,
                workspace_id: None,
            });
        }

        if groups.is_empty() {
            groups.push(Group {
                id: "default-group".into(),
                name: "jinzhu".into(),
                mode: "parallel".into(),
                steps: vec![],
            });
        }

        let mut all_scripts = HashMap::new();
        for proj in &projects {
            let scripts = detect_all_scripts(Path::new(&proj.path));
            all_scripts.insert(proj.id.clone(), scripts);
        }

        let mut process_mgr = ProcessManager::new();
        let _ = process_mgr.spawn(
            "init-log".into(),
            "DevHub Native".into(),
            "echo '[DevHub Native GPU Engine] GPUI + portable-pty pipeline initialized successfully.'".into(),
            &repository_root,
        );

        Self {
            storage,
            current_tab: SidebarTab::BatchTasks,
            projects,
            selected_project_idx: 0,
            all_scripts,
            groups,
            selected_group_idx: 0,
            workspaces,
            installed_editors,
            process_mgr,
            group_executor: GroupExecutor::new(),
            show_drawer: true,
            show_debug_overlay: false,
            debug_overlay_opacity: 0.5,
            show_layout_outlines: false,
            show_add_project_modal: false,
            input_project_path: String::new(),
            input_project_name: String::new(),
            add_project_error: None,
            show_new_group_modal: false,
            input_group_name: String::new(),
            input_group_mode: "parallel".into(),
            show_settings_modal: false,
            show_history_modal: false,
            selected_script_history_name: None,
            show_edit_group_modal: false,
            script_filter: String::new(),
        }
    }

    pub fn open_add_project_modal(&mut self) {
        self.show_add_project_modal = true;
        self.input_project_path.clear();
        self.input_project_name.clear();
        self.add_project_error = None;
    }

    pub fn close_add_project_modal(&mut self) {
        self.show_add_project_modal = false;
        self.add_project_error = None;
    }

    pub fn submit_add_project(&mut self, path: String, name: Option<String>) -> Result<(), String> {
        let p = Path::new(&path);
        if !p.exists() || !p.is_dir() {
            let err = format!("路径不存在或不是目录: {}", path);
            self.add_project_error = Some(err.clone());
            return Err(err);
        }

        let proj_name = name.filter(|n| !n.trim().is_empty()).unwrap_or_else(|| {
            p.file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "project".into())
        });

        let proj_id = format!("proj-{}", self.projects.len() + 1);
        let project = Project {
            id: proj_id.clone(),
            name: proj_name,
            path: path.clone(),
            added_at: None,
            workspace_id: None,
        };

        let scripts = detect_all_scripts(Path::new(&path));
        self.all_scripts.insert(proj_id, scripts);
        self.projects.push(project);
        let _ = self.storage.save_projects(&self.projects);
        self.selected_project_idx = self.projects.len().saturating_sub(1);
        self.current_tab = SidebarTab::Projects;
        self.show_add_project_modal = false;
        self.add_project_error = None;
        Ok(())
    }

    pub fn open_new_group_modal(&mut self) {
        self.show_new_group_modal = true;
        self.input_group_name.clear();
        self.input_group_mode = "parallel".into();
    }

    pub fn close_new_group_modal(&mut self) {
        self.show_new_group_modal = false;
    }

    pub fn submit_new_group(&mut self, name: String, mode: String) -> Result<(), String> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err("任务名称不能为空".into());
        }

        let new_group = Group {
            id: format!("group-{}", self.groups.len() + 1),
            name: trimmed.to_string(),
            mode,
            steps: vec![],
        };

        self.groups.push(new_group);
        let _ = self.storage.save_groups(&self.groups);
        self.selected_group_idx = self.groups.len().saturating_sub(1);
        self.current_tab = SidebarTab::BatchTasks;
        self.show_new_group_modal = false;
        Ok(())
    }

    pub fn open_settings_modal(&mut self) {
        self.show_settings_modal = true;
    }

    pub fn close_settings_modal(&mut self) {
        self.show_settings_modal = false;
    }

    pub fn open_history_modal(&mut self, script_name: Option<String>) {
        self.selected_script_history_name = script_name;
        self.show_history_modal = true;
    }

    pub fn close_history_modal(&mut self) {
        self.show_history_modal = false;
        self.selected_script_history_name = None;
    }

    pub fn open_edit_group_modal(&mut self) {
        self.show_edit_group_modal = true;
    }

    pub fn close_edit_group_modal(&mut self) {
        self.show_edit_group_modal = false;
    }

    pub fn add_step_to_current_group(&mut self, proj_id: String, script_id: String) {
        if let Some(group) = self.groups.get_mut(self.selected_group_idx) {
            let step_id = format!("step-{}", group.steps.len() + 1);
            group.steps.push(crate::domain::GroupStep {
                id: step_id,
                project_id: proj_id,
                script_id: script_id,
                continue_when: Some(crate::domain::ContinueCondition::Delay { seconds: 1 }),
            });
            let _ = self.storage.save_groups(&self.groups);
        }
    }

    pub fn remove_current_project(&mut self) {
        if self.projects.len() <= 1 {
            return;
        }
        self.projects.remove(self.selected_project_idx);
        if self.selected_project_idx >= self.projects.len() {
            self.selected_project_idx = self.projects.len().saturating_sub(1);
        }
        let _ = self.storage.save_projects(&self.projects);
    }

    pub fn remove_current_group(&mut self) {
        if self.groups.len() <= 1 {
            return;
        }
        self.groups.remove(self.selected_group_idx);
        if self.selected_group_idx >= self.groups.len() {
            self.selected_group_idx = self.groups.len().saturating_sub(1);
        }
        let _ = self.storage.save_groups(&self.groups);
    }

    pub fn toggle_debug_overlay(&mut self) {
        self.show_debug_overlay = !self.show_debug_overlay;
    }

    pub fn toggle_layout_outlines(&mut self) {
        self.show_layout_outlines = !self.show_layout_outlines;
    }

    pub fn refresh_scripts(&mut self, proj_id: &str) {
        if let Some(proj) = self.projects.iter().find(|p| p.id == proj_id) {
            let scripts = detect_all_scripts(Path::new(&proj.path));
            self.all_scripts.insert(proj_id.to_string(), scripts);
        }
    }

    pub fn tick_engine(&mut self) -> bool {
        let pty_updated = self.process_mgr.poll_events();
        self.group_executor
            .tick(&self.projects, &self.all_scripts, &mut self.process_mgr);
        pty_updated
    }
}
