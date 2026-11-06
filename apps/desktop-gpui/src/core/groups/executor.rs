use std::collections::HashMap;
use std::time::Instant;

use crate::core::process::ProcessManager;
use crate::domain::{ContinueCondition, Group, Project, Script};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepStatus {
    Pending,
    Running,
    Success,
    Failed,
}

pub struct GroupExecutor {
    active_group: Option<Group>,
    step_statuses: HashMap<usize, StepStatus>,
    current_step_idx: usize,
    step_started_at: Option<Instant>,
    is_active: bool,
}

impl GroupExecutor {
    pub fn new() -> Self {
        Self {
            active_group: None,
            step_statuses: HashMap::new(),
            current_step_idx: 0,
            step_started_at: None,
            is_active: false,
        }
    }

    pub fn is_running(&self) -> bool {
        self.is_active
    }

    pub fn active_group(&self) -> Option<&Group> {
        self.active_group.as_ref()
    }

    pub fn get_step_status(&self, step_idx: usize) -> StepStatus {
        self.step_statuses
            .get(&step_idx)
            .copied()
            .unwrap_or(StepStatus::Pending)
    }

    pub fn start_group(
        &mut self,
        group: Group,
        projects: &[Project],
        all_scripts: &HashMap<String, Vec<Script>>,
        process_mgr: &mut ProcessManager,
    ) {
        self.active_group = Some(group.clone());
        self.step_statuses.clear();
        self.current_step_idx = 0;
        self.step_started_at = None;
        self.is_active = true;

        for i in 0..group.steps.len() {
            self.step_statuses.insert(i, StepStatus::Pending);
        }

        if group.mode == "parallel" {
            // Parallel: trigger all steps immediately
            for (idx, step) in group.steps.iter().enumerate() {
                if let Some((script, proj_path)) =
                    Self::find_script(&step.project_id, &step.script_id, projects, all_scripts)
                {
                    let session_id = format!("group-step-{}", idx);
                    let title = format!("{}. {}", idx + 1, script.name);
                    let _ =
                        process_mgr.spawn(session_id, title, script.command.clone(), &proj_path);
                    self.step_statuses.insert(idx, StepStatus::Running);
                } else {
                    self.step_statuses.insert(idx, StepStatus::Failed);
                }
            }
            if !group.steps.is_empty() {
                process_mgr.set_active_session("group-step-0".to_string());
            }
        } else {
            // Serial: start first step
            self.start_serial_step(0, projects, all_scripts, process_mgr);
        }
    }

    fn start_serial_step(
        &mut self,
        step_idx: usize,
        projects: &[Project],
        all_scripts: &HashMap<String, Vec<Script>>,
        process_mgr: &mut ProcessManager,
    ) {
        if let Some(ref group) = self.active_group {
            if step_idx >= group.steps.len() {
                self.is_active = false;
                return;
            }

            self.current_step_idx = step_idx;
            self.step_started_at = Some(Instant::now());

            let step = &group.steps[step_idx];
            if let Some((script, proj_path)) =
                Self::find_script(&step.project_id, &step.script_id, projects, all_scripts)
            {
                let session_id = format!("group-step-{}", step_idx);
                let title = format!("{}. {}", step_idx + 1, script.name);
                let _ = process_mgr.spawn(
                    session_id.clone(),
                    title,
                    script.command.clone(),
                    &proj_path,
                );
                process_mgr.set_active_session(session_id);
                self.step_statuses.insert(step_idx, StepStatus::Running);
            } else {
                self.step_statuses.insert(step_idx, StepStatus::Failed);
            }
        }
    }

    pub fn tick(
        &mut self,
        projects: &[Project],
        all_scripts: &HashMap<String, Vec<Script>>,
        process_mgr: &mut ProcessManager,
    ) {
        if !self.is_active {
            return;
        }

        let group = match self.active_group.as_ref() {
            Some(g) => g.clone(),
            None => return,
        };

        if group.mode == "parallel" {
            let mut all_done = true;
            for (idx, _) in group.steps.iter().enumerate() {
                let session_id = format!("group-step-{}", idx);
                if let Some(sess) = process_mgr.sessions().iter().find(|s| s.id == session_id) {
                    if sess.is_running {
                        all_done = false;
                    } else if let Some(code) = sess.exit_code {
                        let status = if code == 0 {
                            StepStatus::Success
                        } else {
                            StepStatus::Failed
                        };
                        self.step_statuses.insert(idx, status);
                    }
                }
            }
            if all_done {
                self.is_active = false;
            }
        } else {
            // Serial step advancement
            let step_idx = self.current_step_idx;
            if step_idx >= group.steps.len() {
                self.is_active = false;
                return;
            }

            let step = &group.steps[step_idx];
            let session_id = format!("group-step-{}", step_idx);
            let sess_opt = process_mgr.sessions().iter().find(|s| s.id == session_id);

            let is_running = sess_opt.map(|s| s.is_running).unwrap_or(false);
            let exit_code = sess_opt.and_then(|s| s.exit_code);

            let mut advance = false;
            match &step.continue_when {
                None | Some(ContinueCondition::Ready) => {
                    advance = true;
                }
                Some(ContinueCondition::Delay { seconds }) => {
                    if let Some(start) = self.step_started_at {
                        if start.elapsed().as_secs() >= *seconds {
                            advance = true;
                        }
                    }
                }
                Some(ContinueCondition::ExitCodeZero) => {
                    if !is_running && exit_code.is_some() {
                        if exit_code == Some(0) {
                            self.step_statuses.insert(step_idx, StepStatus::Success);
                            advance = true;
                        } else {
                            self.step_statuses.insert(step_idx, StepStatus::Failed);
                            self.is_active = false;
                            return;
                        }
                    }
                }
                Some(ContinueCondition::Unknown) => {
                    advance = true;
                }
            }

            if advance {
                self.start_serial_step(step_idx + 1, projects, all_scripts, process_mgr);
            }
        }
    }

    pub fn stop(&mut self, process_mgr: &mut ProcessManager) {
        self.is_active = false;
        process_mgr.stop_all();
    }

    fn find_script(
        project_id: &str,
        script_id: &str,
        projects: &[Project],
        all_scripts: &HashMap<String, Vec<Script>>,
    ) -> Option<(Script, std::path::PathBuf)> {
        use crate::core::detectors::detect_all_scripts;

        if let Some(proj) = projects.iter().find(|p| p.id == project_id) {
            let proj_path = std::path::PathBuf::from(&proj.path);
            if let Some(scripts) = all_scripts.get(&proj.id) {
                if let Some(s) = scripts
                    .iter()
                    .find(|s| s.id == script_id || s.name == script_id)
                {
                    return Some((s.clone(), proj_path));
                }
            }
            // Fallback: detect directly
            let detected = detect_all_scripts(&proj_path);
            if let Some(s) = detected
                .into_iter()
                .find(|s| s.id == script_id || s.name == script_id)
            {
                return Some((s, proj_path));
            }
        }

        // Global fallback across any project
        for proj in projects {
            if let Some(scripts) = all_scripts.get(&proj.id) {
                if let Some(s) = scripts
                    .iter()
                    .find(|s| s.id == script_id || s.name == script_id)
                {
                    return Some((s.clone(), std::path::PathBuf::from(&proj.path)));
                }
            }
        }
        None
    }
}
