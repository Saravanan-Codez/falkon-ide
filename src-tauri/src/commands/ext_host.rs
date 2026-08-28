use crate::error::FalkonError;
use serde::Serialize;
use serde_json::json;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct ExtHostHandle {
    pub child: Child,
    pub pid: u32,
    pub port: u16,
}

pub struct ExtHostState(pub Arc<Mutex<Option<ExtHostHandle>>>);

impl ExtHostState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

#[derive(Serialize, Clone)]
pub struct ExtHostLogEvent {
    pub stream: String,
    pub line: String,
}

#[tauri::command]
pub fn ext_host_start(
    app: AppHandle,
    state: State<'_, ExtHostState>,
    node_path: Option<String>,
) -> Result<serde_json::Value, FalkonError> {
    let mut guard = state
        .0
        .lock()
        .map_err(|e| FalkonError::ExtHostError { message: e.to_string() })?;

    if let Some(ref handle) = *guard {
        return Ok(json!({
            "running": true,
            "pid": handle.pid,
            "port": handle.port,
            "message": "Extension host process is already running"
        }));
    }

    // Determine node binary path
    let node_bin = match node_path {
        Some(p) if !p.trim().is_empty() => p,
        _ => match which::which("node") {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => {
                return Err(FalkonError::ExtHostError {
                    message: "Node.js executable not found on system PATH. Please install Node.js to run extensions.".to_string(),
                });
            }
        },
    };

    // Locate ext-host-server.js
    let current_dir = std::env::current_dir().unwrap_or_default();
    let mut candidate_paths = vec![
        current_dir.join("dist").join("ext-host-server.js"),
        current_dir.join("ext-host-server.js"),
        current_dir.join("src").join("dist").join("ext-host-server.js"),
        current_dir.join("src").join("extension-host-server").join("index.js"),
    ];

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidate_paths.push(parent.join("dist").join("ext-host-server.js"));
            candidate_paths.push(parent.join("ext-host-server.js"));
            candidate_paths.push(parent.join("resources").join("ext-host-server.js"));
            candidate_paths.push(parent.join("..").join("Resources").join("ext-host-server.js"));
        }
    }

    let server_script = candidate_paths
        .into_iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| FalkonError::ExtHostError {
            message: "Extension host server script (ext-host-server.js) not found".to_string(),
        })?;

    let port: u16 = 9889;

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&server_script);
    cmd.env("PORT", port.to_string());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| FalkonError::ExtHostError {
        message: format!("Failed to spawn Node.js extension host ({node_bin}): {e}"),
    })?;

    let pid = child.id();

    // Monitor stdout
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                if line.contains("EXT_HOST_READY") {
                    let _ = app_clone.emit("ext-host-ready", json!({ "port": port, "pid": pid }));
                }
                let _ = app_clone.emit(
                    "ext-host-log",
                    ExtHostLogEvent {
                        stream: "stdout".to_string(),
                        line,
                    },
                );
            }
        });
    }

    // Monitor stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = app_clone.emit(
                    "ext-host-log",
                    ExtHostLogEvent {
                        stream: "stderr".to_string(),
                        line,
                    },
                );
            }
        });
    }

    *guard = Some(ExtHostHandle { child, pid, port });

    Ok(json!({
        "running": true,
        "pid": pid,
        "port": port,
        "serverScript": server_script
    }))
}

#[tauri::command]
pub fn ext_host_stop(state: State<'_, ExtHostState>) -> Result<bool, FalkonError> {
    let mut guard = state
        .0
        .lock()
        .map_err(|e| FalkonError::ExtHostError { message: e.to_string() })?;

    if let Some(mut handle) = guard.take() {
        let _ = handle.child.kill();
        let _ = handle.child.wait();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn ext_host_status(state: State<'_, ExtHostState>) -> Result<serde_json::Value, FalkonError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| FalkonError::ExtHostError { message: e.to_string() })?;

    if let Some(ref handle) = *guard {
        Ok(json!({
            "running": true,
            "pid": handle.pid,
            "port": handle.port
        }))
    } else {
        Ok(json!({
            "running": false,
            "pid": null,
            "port": 9889
        }))
    }
}

#[tauri::command]
pub fn ext_host_restart(
    app: AppHandle,
    state: State<'_, ExtHostState>,
    node_path: Option<String>,
) -> Result<serde_json::Value, FalkonError> {
    let _ = ext_host_stop(state.clone());
    ext_host_start(app, state, node_path)
}
