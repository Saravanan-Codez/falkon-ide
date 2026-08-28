use crate::error::FalkonError;
use serde_json::json;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct LspSession {
    pub id: String,
    pub language_id: String,
    pub child: Child,
}

pub struct LspState(pub Arc<Mutex<HashMap<String, LspSession>>>);

impl LspState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }
}

#[tauri::command]
pub fn lsp_start(
    app: AppHandle,
    state: State<'_, LspState>,
    language_id: String,
    server_cmd: String,
    server_args: Option<Vec<String>>,
    cwd: Option<String>,
) -> Result<serde_json::Value, FalkonError> {
    let mut cmd = Command::new(&server_cmd);
    if let Some(ref args) = server_args {
        cmd.args(args);
    }
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn().map_err(|e| FalkonError::LspError {
        message: format!("Failed to spawn LSP server '{server_cmd}': {e}"),
    })?;

    let session_id = Uuid::new_v4().to_string();
    let pid = child.id();

    // Stream stdout (LSP JSON-RPC protocol)
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        let _ = app_clone.emit(&format!("lsp-msg-{sid}"), line.clone());
                    }
                    Err(_) => break,
                }
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
                let _ = app_clone.emit(&format!("lsp-stderr-{sid}"), line);
            }
        });
    }

    let mut map = state
        .0
        .lock()
        .map_err(|e| FalkonError::LspError { message: e.to_string() })?;

    map.insert(
        session_id.clone(),
        LspSession {
            id: session_id.clone(),
            language_id: language_id.clone(),
            child,
        },
    );

    Ok(json!({
        "sessionId": session_id,
        "languageId": language_id,
        "pid": pid,
        "serverCmd": server_cmd
    }))
}

#[tauri::command]
pub fn lsp_send(
    state: State<'_, LspState>,
    session_id: String,
    message: String,
) -> Result<bool, FalkonError> {
    let mut map = state
        .0
        .lock()
        .map_err(|e| FalkonError::LspError { message: e.to_string() })?;

    if let Some(session) = map.get_mut(&session_id) {
        if let Some(stdin) = session.child.stdin.as_mut() {
            stdin
                .write_all(message.as_bytes())
                .map_err(|e| FalkonError::LspError {
                    message: format!("Failed to write to LSP stdin: {e}"),
                })?;
            stdin.flush().map_err(|e| FalkonError::LspError {
                message: format!("Failed to flush LSP stdin: {e}"),
            })?;
            return Ok(true);
        }
    }

    Err(FalkonError::LspError {
        message: format!("LSP session '{session_id}' not found"),
    })
}

#[tauri::command]
pub fn lsp_stop(
    state: State<'_, LspState>,
    session_id: String,
) -> Result<bool, FalkonError> {
    let mut map = state
        .0
        .lock()
        .map_err(|e| FalkonError::LspError { message: e.to_string() })?;

    if let Some(mut session) = map.remove(&session_id) {
        let _ = session.child.kill();
        let _ = session.child.wait();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn lsp_list(state: State<'_, LspState>) -> Result<serde_json::Value, FalkonError> {
    let map = state
        .0
        .lock()
        .map_err(|e| FalkonError::LspError { message: e.to_string() })?;

    let list: Vec<serde_json::Value> = map
        .values()
        .map(|s| {
            json!({
                "sessionId": s.id,
                "languageId": s.language_id,
                "pid": s.child.id()
            })
        })
        .collect();

    Ok(json!(list))
}
