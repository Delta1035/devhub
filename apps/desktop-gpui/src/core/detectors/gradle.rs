use crate::domain::{Script, ScriptSource};
use std::fs;
use std::path::Path;

pub fn detect_gradle_scripts(dir: &Path) -> Vec<Script> {
    let build_gradle = dir.join("build.gradle");
    let build_gradle_kts = dir.join("build.gradle.kts");
    let settings_gradle = dir.join("settings.gradle");
    let settings_gradle_kts = dir.join("settings.gradle.kts");

    if !build_gradle.exists()
        && !build_gradle_kts.exists()
        && !settings_gradle.exists()
        && !settings_gradle_kts.exists()
    {
        return Vec::new();
    }

    let wrapper_name = if cfg!(target_os = "windows") {
        "gradlew.bat"
    } else {
        "./gradlew"
    };
    let has_wrapper = dir
        .join(if cfg!(target_os = "windows") {
            "gradlew.bat"
        } else {
            "gradlew"
        })
        .exists();
    let cmd_base = if has_wrapper { wrapper_name } else { "gradle" };

    let mut scripts = Vec::new();
    let base_tasks = [
        ("clean", "清理构建产物"),
        ("build", "构建（含测试）"),
        ("test", "运行测试"),
    ];

    let mut has_boot_run = false;
    let mut has_run = false;

    for f in [&build_gradle, &build_gradle_kts] {
        if let Ok(content) = fs::read_to_string(f) {
            if content.contains("org.springframework.boot") || content.contains("springBoot") {
                has_boot_run = true;
            }
            if content.contains("application") {
                has_run = true;
            }
        }
    }

    let dir_str = dir.to_string_lossy().to_string();

    for (task, desc) in base_tasks {
        scripts.push(Script {
            id: format!("gradle:{}", task),
            name: task.to_string(),
            source: ScriptSource::Gradle,
            command: format!("{} {}", cmd_base, task),
            cwd: dir_str.clone(),
            description: Some(desc.to_string()),
        });
    }

    if has_boot_run {
        scripts.push(Script {
            id: "gradle:bootRun".to_string(),
            name: "bootRun".to_string(),
            source: ScriptSource::Gradle,
            command: format!("{} bootRun", cmd_base),
            cwd: dir_str.clone(),
            description: Some("运行 Spring Boot 应用".to_string()),
        });
    }

    if has_run && !has_boot_run {
        scripts.push(Script {
            id: "gradle:run".to_string(),
            name: "run".to_string(),
            source: ScriptSource::Gradle,
            command: format!("{} run", cmd_base),
            cwd: dir_str,
            description: Some("运行应用".to_string()),
        });
    }

    scripts
}
