use crate::domain::{Script, ScriptSource};
use std::fs;
use std::path::Path;

pub fn detect_maven_scripts(dir: &Path) -> Vec<Script> {
    let pom_path = dir.join("pom.xml");
    if !pom_path.exists() {
        return Vec::new();
    }

    let wrapper_name = if cfg!(target_os = "windows") {
        "mvnw.cmd"
    } else {
        "./mvnw"
    };
    let has_wrapper = dir
        .join(if cfg!(target_os = "windows") {
            "mvnw.cmd"
        } else {
            "mvnw"
        })
        .exists();
    let cmd_base = if has_wrapper { wrapper_name } else { "mvn" };

    let mut scripts = Vec::new();
    let base_goals = [
        ("clean", "清理构建产物"),
        ("compile", "编译"),
        ("test", "运行测试"),
        ("package", "打包（含测试）"),
        ("install", "安装到本地仓库（含测试）"),
    ];

    let has_spring_boot = if let Ok(content) = fs::read_to_string(&pom_path) {
        content.contains("spring-boot")
    } else {
        false
    };

    let dir_str = dir.to_string_lossy().to_string();

    for (goal, desc) in base_goals {
        scripts.push(Script {
            id: format!("maven:{}", goal),
            name: goal.to_string(),
            source: ScriptSource::Maven,
            command: format!("{} {}", cmd_base, goal),
            cwd: dir_str.clone(),
            description: Some(desc.to_string()),
        });
    }

    if has_spring_boot {
        scripts.push(Script {
            id: "maven:spring-boot:run".to_string(),
            name: "spring-boot:run".to_string(),
            source: ScriptSource::Maven,
            command: format!("{} spring-boot:run", cmd_base),
            cwd: dir_str,
            description: Some("运行 Spring Boot 应用".to_string()),
        });
    }

    scripts
}
