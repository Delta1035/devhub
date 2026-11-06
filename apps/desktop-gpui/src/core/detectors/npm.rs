use serde_json::Value;
use std::fs;
use std::path::Path;

use crate::domain::{Script, ScriptSource};

pub fn detect_npm_scripts(dir: &Path) -> Vec<Script> {
    let pkg_json = dir.join("package.json");
    if !pkg_json.exists() {
        return vec![];
    }

    let Ok(content) = fs::read_to_string(&pkg_json) else {
        return vec![];
    };

    let Ok(json) = serde_json::from_str::<Value>(&content) else {
        return vec![];
    };

    let pm = detect_package_manager(dir);
    let mut scripts = Vec::new();

    if let Some(scripts_obj) = json.get("scripts").and_then(|s| s.as_object()) {
        for (name, _) in scripts_obj {
            let cmd = if pm == "npm" {
                format!("npm run {}", name)
            } else {
                format!("{} {}", pm, name)
            };

            scripts.push(Script {
                id: format!("npm:{}", name),
                name: name.clone(),
                command: cmd,
                source: ScriptSource::Npm,
                cwd: dir.to_string_lossy().to_string(),
                description: None,
            });
        }
    }

    scripts
}

fn detect_package_manager(dir: &Path) -> String {
    let mut current = Some(dir);
    let mut depth = 0;

    while let Some(d) = current {
        if d.join("pnpm-lock.yaml").exists() || d.join("pnpm-workspace.yaml").exists() {
            return "pnpm".into();
        }
        if d.join("yarn.lock").exists() {
            return "yarn".into();
        }
        if d.join("bun.lockb").exists() || d.join("bun.lock").exists() {
            return "bun".into();
        }
        if d.join("package-lock.json").exists() {
            return "npm".into();
        }

        depth += 1;
        if depth > 4 {
            break;
        }
        current = d.parent();
    }

    "npm".into()
}
