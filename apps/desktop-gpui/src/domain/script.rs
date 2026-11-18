use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ScriptSource {
    Npm,
    Maven,
    Gradle,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Script {
    pub id: String,
    pub name: String,
    pub command: String,
    pub source: ScriptSource,
    pub cwd: String,
    #[serde(default)]
    pub description: Option<String>,
}
