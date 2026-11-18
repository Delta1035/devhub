use std::fs;
use std::path::Path;

use crate::domain::{Script, ScriptSource};

pub fn detect_custom_scripts(dir: &Path) -> Vec<Script> {
    let config_path = dir.join(".devhub.yaml");
    if !config_path.exists() {
        return vec![];
    }

    let Ok(content) = fs::read_to_string(&config_path) else {
        return vec![];
    };

    let mut scripts = Vec::new();
    let mut current_name = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("name:") {
            current_name = trimmed
                .trim_start_matches("name:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();
        } else if trimmed.starts_with("command:") {
            let cmd = trimmed
                .trim_start_matches("command:")
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();
            if !current_name.is_empty() && !cmd.is_empty() {
                scripts.push(Script {
                    id: format!("custom:{}", current_name),
                    name: current_name.clone(),
                    command: cmd,
                    source: ScriptSource::Custom,
                    cwd: dir.to_string_lossy().to_string(),
                    description: None,
                });
                current_name.clear();
            }
        }
    }

    scripts
}
