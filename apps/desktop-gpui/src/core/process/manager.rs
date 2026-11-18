use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, Sender, channel};

use crate::core::history::RunRecord;
use crate::core::ports::detect_port_conflict;
use crate::core::process::buffer::OutputBuffer;
use crate::core::process::pty::{PtyEvent, PtySession};
use crate::core::storage::Storage;

pub struct ProcessSession {
    pub id: String,
    pub title: String,
    pub command: String,
    pub cwd: PathBuf,
    pub pty: Option<PtySession>,
    pub buffer: OutputBuffer,
    pub is_running: bool,
    pub exit_code: Option<u32>,
    pub rx: Receiver<PtyEvent>,
}

pub struct ProcessManager {
    sessions: Vec<ProcessSession>,
    active_id: Option<String>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            sessions: Vec::new(),
            active_id: None,
        }
    }

    pub fn sessions(&self) -> &[ProcessSession] {
        &self.sessions
    }

    pub fn active_session_id(&self) -> Option<&str> {
        self.active_id.as_deref()
    }

    pub fn set_active_session(&mut self, id: String) {
        self.active_id = Some(id);
    }

    pub fn active_session(&self) -> Option<&ProcessSession> {
        if let Some(ref id) = self.active_id {
            self.sessions.iter().find(|s| &s.id == id)
        } else {
            self.sessions.last()
        }
    }

    pub fn active_session_mut(&mut self) -> Option<&mut ProcessSession> {
        if let Some(ref id) = self.active_id.clone() {
            self.sessions.iter_mut().find(|s| &s.id == id)
        } else {
            self.sessions.last_mut()
        }
    }

    pub fn running_count(&self) -> usize {
        self.sessions.iter().filter(|s| s.is_running).count()
    }

    pub fn is_any_running(&self) -> bool {
        self.sessions.iter().any(|s| s.is_running)
    }

    pub fn spawn(
        &mut self,
        id: String,
        title: String,
        command: String,
        cwd: &Path,
    ) -> Result<(), String> {
        let conflict_warn = detect_port_conflict(&command)
            .map(|p| format!("--- [PORT WARNING] 警告：检测到端口 {} 疑似被占用！---", p));

        // If session already exists and running, stop it first
        if let Some(existing) = self.sessions.iter_mut().find(|s| s.id == id) {
            if existing.is_running {
                if let Some(ref mut pty) = existing.pty {
                    pty.stop();
                }
                existing.is_running = false;
            }
            existing.command = command.clone();
            existing.cwd = cwd.to_path_buf();
            existing.title = title.clone();
            existing
                .buffer
                .append_line(format!("--- [RESTART] Executing: {} ---", command));
            if let Some(ref warn) = conflict_warn {
                existing.buffer.append_line(warn.clone());
            }

            let (tx, rx): (Sender<PtyEvent>, Receiver<PtyEvent>) = channel();
            existing.rx = rx;

            match PtySession::spawn(&command, cwd, tx) {
                Ok(pty) => {
                    let pid = pty.pid().unwrap_or(0);
                    existing
                        .buffer
                        .append_line(format!("[PTY OK] Subprocess spawned with PID: {}", pid));
                    existing.pty = Some(pty);
                    existing.is_running = true;
                    existing.exit_code = None;
                }
                Err(e) => {
                    existing
                        .buffer
                        .append_line(format!("[PTY ERROR] Failed: {}", e));
                    return Err(e.to_string());
                }
            }
            self.active_id = Some(id);
            return Ok(());
        }

        let mut buffer = OutputBuffer::default_buffer();
        buffer.append_line(format!("--- [SPAWN] Executing: {} ---", command));
        if let Some(ref warn) = conflict_warn {
            buffer.append_line(warn.clone());
        }

        let (tx, rx): (Sender<PtyEvent>, Receiver<PtyEvent>) = channel();
        let pty_res = PtySession::spawn(&command, cwd, tx);

        match pty_res {
            Ok(pty) => {
                let pid = pty.pid().unwrap_or(0);
                buffer.append_line(format!("[PTY OK] Subprocess spawned with PID: {}", pid));
                self.sessions.push(ProcessSession {
                    id: id.clone(),
                    title,
                    command,
                    cwd: cwd.to_path_buf(),
                    pty: Some(pty),
                    buffer,
                    is_running: true,
                    exit_code: None,
                    rx,
                });
                self.active_id = Some(id);
                Ok(())
            }
            Err(e) => {
                buffer.append_line(format!("[PTY ERROR] Failed: {}", e));
                self.sessions.push(ProcessSession {
                    id: id.clone(),
                    title,
                    command,
                    cwd: cwd.to_path_buf(),
                    pty: None,
                    buffer,
                    is_running: false,
                    exit_code: Some(1),
                    rx,
                });
                self.active_id = Some(id);
                Err(e.to_string())
            }
        }
    }

    pub fn stop(&mut self, id: &str) {
        if let Some(session) = self.sessions.iter_mut().find(|s| s.id == id) {
            if session.is_running {
                if let Some(ref mut pty) = session.pty {
                    pty.stop();
                }
                session.is_running = false;
                session
                    .buffer
                    .append_line("[Process stopped by user]".to_string());
            }
        }
    }

    pub fn stop_all(&mut self) {
        for session in &mut self.sessions {
            if session.is_running {
                if let Some(ref mut pty) = session.pty {
                    pty.stop();
                }
                session.is_running = false;
                session
                    .buffer
                    .append_line("[Process stopped by user (stop all)]".to_string());
            }
        }
    }

    pub fn poll_events(&mut self) -> bool {
        let mut updated = false;
        for session in &mut self.sessions {
            while let Ok(event) = session.rx.try_recv() {
                updated = true;
                match event {
                    PtyEvent::Output(line) => {
                        session.buffer.append_line(line);
                    }
                    PtyEvent::Exited(code) => {
                        session.is_running = false;
                        session.exit_code = Some(code);
                        session
                            .buffer
                            .append_line(format!("--- [PTY EXITED] Code: {} ---", code));

                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();
                        let mut record = RunRecord::new(
                            session.id.clone(),
                            session.title.clone(),
                            "project".to_string(),
                            session.command.clone(),
                            now,
                            "running".to_string(),
                        );
                        record.complete(
                            now,
                            Some(code as i32),
                            if code == 0 { "finished" } else { "failed" },
                            None,
                        );
                        let _ = Storage::new().save_history(&[record]);
                    }
                }
            }
        }
        updated
    }
}
