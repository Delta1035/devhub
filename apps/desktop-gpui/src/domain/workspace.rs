use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub scan_depth: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspacesFile {
    pub workspaces: Vec<Workspace>,
}
