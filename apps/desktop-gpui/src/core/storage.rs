use std::fs;
use std::path::PathBuf;

use crate::core::history::RunRecord;
use crate::domain::{Group, GroupsFile, Project, ProjectsFile, Workspace, WorkspacesFile};

pub struct Storage {
    base_dir: PathBuf,
}

impl Storage {
    pub fn default_dir() -> PathBuf {
        if let Ok(config_home) = std::env::var("XDG_CONFIG_HOME") {
            let path = PathBuf::from(config_home).join("DevHub");
            if path.exists() {
                return path;
            }
        }

        if let Ok(home) = std::env::var("HOME") {
            let linux_path = PathBuf::from(&home).join(".config").join("DevHub");
            if linux_path.exists() {
                return linux_path;
            }
        }

        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("DevHub");
        }

        if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join(".config").join("DevHub")
        } else {
            PathBuf::from("./devhub_data")
        }
    }

    pub fn new() -> Self {
        let base_dir = Self::default_dir();
        let _ = fs::create_dir_all(&base_dir);
        Self { base_dir }
    }

    pub fn load_projects(&self) -> Vec<Project> {
        let file_path = self.base_dir.join("projects.json");
        if let Ok(content) = fs::read_to_string(&file_path) {
            if let Ok(parsed) = serde_json::from_str::<ProjectsFile>(&content) {
                return parsed.projects;
            }
        }
        vec![]
    }

    pub fn save_projects(&self, projects: &[Project]) -> Result<(), String> {
        let file_path = self.base_dir.join("projects.json");
        let file = ProjectsFile {
            version: 1,
            projects: projects.to_vec(),
        };
        let content = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())
    }

    pub fn load_groups(&self) -> Vec<Group> {
        let file_path = self.base_dir.join("groups.json");
        if let Ok(content) = fs::read_to_string(&file_path) {
            if let Ok(parsed) = serde_json::from_str::<GroupsFile>(&content) {
                return parsed.groups;
            }
        }
        vec![]
    }

    pub fn save_groups(&self, groups: &[Group]) -> Result<(), String> {
        let file_path = self.base_dir.join("groups.json");
        let file = GroupsFile {
            version: 1,
            groups: groups.to_vec(),
        };
        let content = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())
    }

    pub fn load_workspaces(&self) -> Vec<Workspace> {
        let file_path = self.base_dir.join("workspaces.json");
        if let Ok(content) = fs::read_to_string(&file_path) {
            if let Ok(parsed) = serde_json::from_str::<WorkspacesFile>(&content) {
                return parsed.workspaces;
            }
        }
        vec![]
    }

    pub fn save_workspaces(&self, workspaces: &[Workspace]) -> Result<(), String> {
        let file_path = self.base_dir.join("workspaces.json");
        let file = WorkspacesFile {
            workspaces: workspaces.to_vec(),
        };
        let content = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())
    }

    pub fn load_history(&self) -> Vec<RunRecord> {
        let file_path = self.base_dir.join("history.json");
        crate::core::history::load_history_from_file(&file_path)
    }

    pub fn save_history(&self, records: &[RunRecord]) -> Result<(), String> {
        let file_path = self.base_dir.join("history.json");
        crate::core::history::save_history_to_file(&file_path, records)
    }
}
