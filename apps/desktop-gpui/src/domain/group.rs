use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContinueCondition {
    #[serde(rename = "delay")]
    Delay { seconds: u64 },
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "exitCodeZero")]
    ExitCodeZero,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupStep {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "scriptId")]
    pub script_id: String,
    #[serde(rename = "continueWhen")]
    pub continue_when: Option<ContinueCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub mode: String, // "parallel" or "serial"
    pub steps: Vec<GroupStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupsFile {
    pub version: u32,
    pub groups: Vec<Group>,
}
