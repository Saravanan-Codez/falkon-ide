use crate::error::FalkonError;
use serde_json::json;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct ManagedProcess {
    pub id: String,
    pub command: String,
    pub child: Child,
}

pub struct ProcessManagerState(pub Arc<Mutex<HashMap<String, ManagedProcess>>>);

impl ProcessManagerState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }
}

#[tauri::command]
pub fn process_spawn(
    app: AppHandle,
    state: State<'_, ProcessManagerState>,
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
) -> Result<serde_json::Value, FalkonError> {
    let mut cmd = Command::new(&command);
    if let Some(ref a) = args {
        cmd.args(a);
    }
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn().map_err(|e| FalkonError::ProcessSpawnFailed {
        command: command.clone(),
        message: e.to_string(),
    })?;

    let session_id = Uuid::new_v4().to_string();
    let pid = child.id();

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let _ = app_clone.emit(&format!("proc-stdout-{sid}"), line);
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = app_clone.emit(&format!("proc-stderr-{sid}"), line);
            }
        });
    }

    let mut map = state
        .0
        .lock()
        .map_err(|e| FalkonError::IoError { message: e.to_string() })?;

    map.insert(
        session_id.clone(),
        ManagedProcess {
            id: session_id.clone(),
            command: command.clone(),
            child,
        },
    );

    Ok(json!({
        "sessionId": session_id,
        "pid": pid,
        "command": command
    }))
}

#[tauri::command]
pub fn process_kill(
    state: State<'_, ProcessManagerState>,
    session_id: String,
) -> Result<bool, FalkonError> {
    let mut map = state
        .0
        .lock()
        .map_err(|e| FalkonError::IoError { message: e.to_string() })?;

    if let Some(mut proc) = map.remove(&session_id) {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn process_send_stdin(
    state: State<'_, ProcessManagerState>,
    session_id: String,
    input: String,
) -> Result<bool, FalkonError> {
    let mut map = state
        .0
        .lock()
        .map_err(|e| FalkonError::IoError { message: e.to_string() })?;

    if let Some(proc) = map.get_mut(&session_id) {
        if let Some(stdin) = proc.child.stdin.as_mut() {
            stdin
                .write_all(input.as_bytes())
                .map_err(|e| FalkonError::IoError {
                    message: format!("Failed to write to process stdin: {e}"),
                })?;
            stdin.flush().map_err(|e| FalkonError::IoError {
                message: format!("Failed to flush process stdin: {e}"),
            })?;
            return Ok(true);
        }
    }

    Err(FalkonError::IoError {
        message: format!("Managed process '{session_id}' not found"),
    })
}

#[tauri::command]
pub fn process_list(
    state: State<'_, ProcessManagerState>,
) -> Result<serde_json::Value, FalkonError> {
    let map = state
        .0
        .lock()
        .map_err(|e| FalkonError::IoError { message: e.to_string() })?;

    let list: Vec<serde_json::Value> = map
        .values()
        .map(|p| {
            json!({
                "sessionId": p.id,
                "command": p.command,
                "pid": p.child.id()
            })
        })
        .collect();

    Ok(json!(list))
}
