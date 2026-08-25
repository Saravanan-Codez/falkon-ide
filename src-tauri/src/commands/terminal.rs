use crate::error::FalkonError;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use uuid::Uuid;

pub struct PtySession {
    pub master: Box<dyn portable_pty::MasterPty + Send>,
    pub writer: Box<dyn std::io::Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send>,
}

pub type PtyStore = Arc<Mutex<HashMap<String, PtySession>>>;

#[tauri::command]
pub async fn terminal_create(
    state: tauri::State<'_, PtyStore>,
    window: tauri::WebviewWindow,
    cols: Option<u16>,
    rows: Option<u16>,
    cwd: Option<String>,
) -> Result<String, FalkonError> {
    let store = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        let id = Uuid::new_v4().to_string();
        let pty_system = NativePtySystem::default();
        let size = PtySize {
            rows: rows.unwrap_or(24).max(1),
            cols: cols.unwrap_or(80).max(1),
            pixel_width: 0,
            pixel_height: 0,
        };
        let pair = pty_system.openpty(size).map_err(|e| FalkonError::PtyError {
            message: e.to_string(),
        })?;

        let shell = if cfg!(windows) {
            let pwsh = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";
            let cmd_exe = r"C:\Windows\System32\cmd.exe";
            if Path::new(pwsh).exists() {
                pwsh.to_string()
            } else if Path::new(cmd_exe).exists() {
                cmd_exe.to_string()
            } else {
                "cmd.exe".to_string()
            }
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };

        let mut cmd = CommandBuilder::new(&shell);
        if let Some(ref c) = cwd {
            // Strip URI scheme prefix (file:/// or file://)
            let stripped = c
                .trim_start_matches("file:///")
                .trim_start_matches("file://");
            // On Windows: convert forward slashes to backslashes
            #[cfg(windows)]
            let clean = stripped.replace('/', "\\");
            #[cfg(not(windows))]
            let clean = stripped.to_string();
            let p = Path::new(&clean);
            if p.exists() && p.is_dir() {
                cmd.cwd(&clean);
            }
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| FalkonError::PtyError {
            message: e.to_string(),
        })?;
        let writer = pair.master.take_writer().map_err(|e| FalkonError::PtyError {
            message: e.to_string(),
        })?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| FalkonError::PtyError {
            message: e.to_string(),
        })?;

        let window_clone = window.clone();
        let session_id_clone = id.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data_str = String::from_utf8_lossy(&buf[..n]).to_string();
                        let event_name = format!("terminal-data-{}", session_id_clone);
                        let _ = window_clone.emit(&event_name, json!({ "payload": data_str }));
                    }
                    Err(_) => break,
                }
            }
            let exit_event = format!("terminal-exit-{}", session_id_clone);
            let _ = window_clone.emit(&exit_event, json!({}));
        });

        let mut guard = store.lock().unwrap();
        guard.insert(
            id.clone(),
            PtySession {
                master: pair.master,
                writer,
                child,
            },
        );

        Ok(id)
    })
    .await
    .map_err(|e| FalkonError::PtyError { message: e.to_string() })?
}

#[tauri::command]
pub async fn terminal_write(
    state: tauri::State<'_, PtyStore>,
    id: String,
    data: String,
) -> Result<(), FalkonError> {
    let store = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut guard = store.lock().unwrap();
        if let Some(session) = guard.get_mut(&id) {
            session
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| FalkonError::PtyError { message: e.to_string() })?;
            session
                .writer
                .flush()
                .map_err(|e| FalkonError::PtyError { message: e.to_string() })?;
            Ok(())
        } else {
            Err(FalkonError::PtySessionNotFound { id })
        }
    })
    .await
    .map_err(|e| FalkonError::PtyError { message: e.to_string() })?
}

#[tauri::command]
pub async fn terminal_resize(
    state: tauri::State<'_, PtyStore>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), FalkonError> {
    let store = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        let guard = store.lock().unwrap();
        if let Some(session) = guard.get(&id) {
            let _ = session.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            });
        }
        Ok(())
    })
    .await
    .map_err(|e| FalkonError::PtyError { message: e.to_string() })?
}

#[tauri::command]
pub async fn terminal_kill(
    state: tauri::State<'_, PtyStore>,
    id: String,
) -> Result<(), FalkonError> {
    let store = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut guard = store.lock().unwrap();
        if let Some(mut session) = guard.remove(&id) {
            session
                .child
                .kill()
                .map_err(|e| FalkonError::PtyError { message: e.to_string() })
        } else {
            Ok(())
        }
    })
    .await
    .map_err(|e| FalkonError::PtyError { message: e.to_string() })?
}
