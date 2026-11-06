#[cfg(target_os = "windows")]
use std::process::Command;

pub struct ProcessKiller;

impl ProcessKiller {
    /// Gracefully interrupts a process by sending Ctrl+C or SIGTERM.
    pub fn interrupt(pid: u32) {
        #[cfg(target_os = "windows")]
        {
            Self::force_kill(pid);
        }

        #[cfg(not(target_os = "windows"))]
        {
            unsafe {
                let pgid = -(pid as i32);
                libc::kill(pgid, libc::SIGTERM);
            }
        }
    }

    /// Forcibly kills the whole process tree (Windows: taskkill /T /F, Linux: SIGKILL to process group).
    pub fn force_kill(pid: u32) {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output();
        }

        #[cfg(not(target_os = "windows"))]
        {
            unsafe {
                let pgid = -(pid as i32);
                libc::kill(pgid, libc::SIGKILL);
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }
    }
}
