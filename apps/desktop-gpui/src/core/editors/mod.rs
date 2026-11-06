use crate::domain::{AvailableEditor, EditorId};
use std::path::Path;
use std::process::Command;

pub struct EditorService;

impl EditorService {
    pub fn detect_installed_editors() -> Vec<AvailableEditor> {
        let mut editors = Vec::new();

        // 1. VS Code
        if let Some(path) = Self::find_in_path("code") {
            editors.push(AvailableEditor {
                id: EditorId::VSCode,
                name: "VS Code".to_string(),
                bin_path: path,
            });
        }

        // 2. Cursor
        if let Some(path) = Self::find_in_path("cursor") {
            editors.push(AvailableEditor {
                id: EditorId::Cursor,
                name: "Cursor".to_string(),
                bin_path: path,
            });
        }

        // 3. IntelliJ IDEA
        if let Some(path) = Self::find_in_path("idea") {
            editors.push(AvailableEditor {
                id: EditorId::Idea,
                name: "IntelliJ IDEA".to_string(),
                bin_path: path,
            });
        }

        editors
    }

    fn find_in_path(cmd: &str) -> Option<String> {
        let check_cmd = if cfg!(target_os = "windows") {
            "where"
        } else {
            "which"
        };
        if let Ok(output) = Command::new(check_cmd).arg(cmd).output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = stdout.lines().next() {
                    let trimmed = first_line.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }
        None
    }

    pub fn launch(bin_path: &str, target_dir: &Path) -> Result<(), String> {
        Command::new(bin_path)
            .arg(target_dir)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to launch editor: {}", e))
    }
}
