use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EditorId {
    VSCode,
    Cursor,
    Idea,
}

impl EditorId {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::VSCode => "VS Code",
            Self::Cursor => "Cursor",
            Self::Idea => "IntelliJ IDEA",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AvailableEditor {
    pub id: EditorId,
    pub name: String,
    pub bin_path: String,
}
