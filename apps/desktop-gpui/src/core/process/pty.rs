use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::sync::mpsc::Sender;
use std::thread;

use portable_pty::{CommandBuilder, PtySize, native_pty_system};

use crate::core::process::killer::ProcessKiller;

pub enum PtyEvent {
    Output(String),
    Exited(u32),
}

pub struct PtySession {
    pid: Option<u32>,
    writer: Option<Box<dyn Write + Send>>,
}

impl PtySession {
    pub fn spawn(
        command: &str,
        cwd: &Path,
        tx: Sender<PtyEvent>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        #[cfg(target_os = "windows")]
        let mut cmd = CommandBuilder::new("cmd.exe");
        #[cfg(target_os = "windows")]
        cmd.args(["/c", command]);

        #[cfg(not(target_os = "windows"))]
        let mut cmd = CommandBuilder::new("bash");
        #[cfg(not(target_os = "windows"))]
        cmd.args(["-c", command]);

        cmd.cwd(cwd);

        let mut child = pair.slave.spawn_command(cmd)?;
        let pid = child.process_id();

        let reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        // Background thread to stream PTY output line by line
        let tx_out = tx.clone();
        thread::spawn(move || {
            let buf = BufReader::new(reader);
            for line in buf.lines().map_while(Result::ok) {
                let _ = tx_out.send(PtyEvent::Output(line));
            }

            let code = match child.wait() {
                Ok(status) => status.exit_code(),
                Err(_) => 1,
            };
            let _ = tx.send(PtyEvent::Exited(code));
        });

        Ok(Self {
            pid,
            writer: Some(writer),
        })
    }

    pub fn write_input(&mut self, data: &[u8]) {
        if let Some(ref mut w) = self.writer {
            let _ = w.write_all(data);
            let _ = w.flush();
        }
    }

    pub fn stop(&mut self) {
        if let Some(pid) = self.pid {
            ProcessKiller::force_kill(pid);
        }
    }

    pub fn pid(&self) -> Option<u32> {
        self.pid
    }
}
