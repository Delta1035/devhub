use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Maximum number of historical records to persist in the rolling log.
pub const MAX_HISTORY_RECORDS: usize = 20;

/// Represents a single execution history entry of a project script.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunRecord {
    pub id: String,
    #[serde(alias = "scriptName")]
    pub script_name: String,
    #[serde(alias = "projectId")]
    pub project_id: String,
    pub command: String,
    #[serde(alias = "startedAt")]
    pub started_at: u64,
    #[serde(default, alias = "finishedAt")]
    pub finished_at: Option<u64>,
    #[serde(default, alias = "exitCode")]
    pub exit_code: Option<i32>,
    pub status: String,
    #[serde(default, alias = "logSnippet")]
    pub log_snippet: Option<String>,
}

impl RunRecord {
    pub fn new(
        id: impl Into<String>,
        script_name: impl Into<String>,
        project_id: impl Into<String>,
        command: impl Into<String>,
        started_at: u64,
        status: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            script_name: script_name.into(),
            project_id: project_id.into(),
            command: command.into(),
            started_at,
            finished_at: None,
            exit_code: None,
            status: status.into(),
            log_snippet: None,
        }
    }

    pub fn complete(
        &mut self,
        finished_at: u64,
        exit_code: Option<i32>,
        status: impl Into<String>,
        log_snippet: Option<String>,
    ) {
        self.finished_at = Some(finished_at);
        self.exit_code = exit_code;
        self.status = status.into();
        self.log_snippet = log_snippet;
    }
}

/// Optional file wrapper for backwards compatibility with object-wrapped history files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryFile {
    pub records: Vec<RunRecord>,
}

/// Appends a new record and maintains at most MAX_HISTORY_RECORDS (keeping the most recent).
pub fn append_and_rotate(records: &mut Vec<RunRecord>, record: RunRecord) {
    records.push(record);
    if records.len() > MAX_HISTORY_RECORDS {
        let excess = records.len() - MAX_HISTORY_RECORDS;
        records.drain(0..excess);
    }
}

/// Adds or updates a run record by id. If found, replaces it in-place; otherwise appends and rotates.
pub fn upsert_record(records: &mut Vec<RunRecord>, record: RunRecord) {
    if let Some(existing) = records.iter_mut().find(|r| r.id == record.id) {
        *existing = record;
    } else {
        append_and_rotate(records, record);
    }
}

/// Default path for DevHub run history (`~/.config/DevHub/history.json`).
pub fn default_history_path() -> PathBuf {
    crate::core::Storage::default_dir().join("history.json")
}

/// Load run records from a specific JSON file path.
pub fn load_history_from_file(path: &Path) -> Vec<RunRecord> {
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(records) = serde_json::from_str::<Vec<RunRecord>>(&content) {
            return records;
        }
        if let Ok(file) = serde_json::from_str::<HistoryFile>(&content) {
            return file.records;
        }
    }
    vec![]
}

/// Save run records to a specific JSON file path, enforcing MAX_HISTORY_RECORDS limit.
pub fn save_history_to_file(path: &Path, records: &[RunRecord]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let to_save: &[RunRecord] = if records.len() > MAX_HISTORY_RECORDS {
        &records[records.len() - MAX_HISTORY_RECORDS..]
    } else {
        records
    };
    let json = serde_json::to_string_pretty(to_save).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// Load run records from the default user configuration directory (`~/.config/DevHub/history.json`).
pub fn load_history() -> Vec<RunRecord> {
    load_history_from_file(&default_history_path())
}

/// Save run records to the default user configuration directory (`~/.config/DevHub/history.json`).
pub fn save_history(records: &[RunRecord]) -> Result<(), String> {
    save_history_to_file(&default_history_path(), records)
}

/// Record or update a single run record directly into the default history store.
pub fn record_run(record: RunRecord) -> Result<(), String> {
    let path = default_history_path();
    let mut records = load_history_from_file(&path);
    upsert_record(&mut records, record);
    save_history_to_file(&path, &records)
}

/// History store abstraction for managing historical script runs.
#[derive(Debug, Clone)]
pub struct HistoryStore {
    file_path: PathBuf,
}

impl HistoryStore {
    pub fn new() -> Self {
        Self {
            file_path: default_history_path(),
        }
    }

    pub fn with_path(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    pub fn load(&self) -> Vec<RunRecord> {
        load_history_from_file(&self.file_path)
    }

    pub fn save(&self, records: &[RunRecord]) -> Result<(), String> {
        save_history_to_file(&self.file_path, records)
    }

    pub fn add(&self, record: RunRecord) -> Result<(), String> {
        let mut records = self.load();
        append_and_rotate(&mut records, record);
        self.save(&records)
    }

    pub fn upsert(&self, record: RunRecord) -> Result<(), String> {
        let mut records = self.load();
        upsert_record(&mut records, record);
        self.save(&records)
    }
}

impl Default for HistoryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_record(i: usize) -> RunRecord {
        RunRecord {
            id: format!("run-{}", i),
            script_name: format!("script-{}", i),
            project_id: format!("project-{}", i % 3),
            command: format!("npm run dev-{}", i),
            started_at: 1000 + i as u64 * 10,
            finished_at: Some(1005 + i as u64 * 10),
            exit_code: Some(0),
            status: "finished".to_string(),
            log_snippet: Some(format!("output {}", i)),
        }
    }

    #[test]
    fn test_append_and_rotate_keeps_latest_20() {
        let mut records = Vec::new();
        for i in 0..25 {
            append_and_rotate(&mut records, make_record(i));
        }

        assert_eq!(records.len(), MAX_HISTORY_RECORDS);
        assert_eq!(records.first().unwrap().id, "run-5");
        assert_eq!(records.last().unwrap().id, "run-24");
    }

    #[test]
    fn test_upsert_record_updates_existing_or_appends() {
        let mut records = Vec::new();
        let r1 = make_record(1);
        upsert_record(&mut records, r1);
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].status, "finished");

        let mut r1_updated = make_record(1);
        r1_updated.status = "interrupted".to_string();
        upsert_record(&mut records, r1_updated);
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].status, "interrupted");

        let r2 = make_record(2);
        upsert_record(&mut records, r2);
        assert_eq!(records.len(), 2);
    }

    #[test]
    fn test_save_and_load_file_roundtrip() {
        let temp_dir =
            std::env::temp_dir().join(format!("devhub_hist_test_{}", std::process::id()));
        let file_path = temp_dir.join("history.json");

        let store = HistoryStore::with_path(file_path.clone());
        let initial = store.load();
        assert!(initial.is_empty());

        let mut to_save = Vec::new();
        for i in 0..25 {
            to_save.push(make_record(i));
        }

        store.save(&to_save).expect("save should succeed");
        let loaded = store.load();

        // Must be capped at 20 most recent
        assert_eq!(loaded.len(), MAX_HISTORY_RECORDS);
        assert_eq!(loaded[0].id, "run-5");
        assert_eq!(loaded.last().unwrap().id, "run-24");

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_serde_camel_and_snake_case_compatibility() {
        let json_str = r#"{
            "id": "run-test",
            "scriptName": "build",
            "projectId": "proj-1",
            "command": "npm run build",
            "startedAt": 1700000000,
            "finishedAt": 1700000050,
            "exitCode": 0,
            "status": "success",
            "logSnippet": "Build completed."
        }"#;

        let record: RunRecord =
            serde_json::from_str(json_str).expect("should deserialize camelCase");
        assert_eq!(record.id, "run-test");
        assert_eq!(record.script_name, "build");
        assert_eq!(record.project_id, "proj-1");
        assert_eq!(record.started_at, 1700000000);
        assert_eq!(record.finished_at, Some(1700000050));
        assert_eq!(record.exit_code, Some(0));
    }
}
