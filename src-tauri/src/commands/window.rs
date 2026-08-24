use crate::error::FalkonError;
use std::process::Command;

#[tauri::command]
pub fn window_minimize(window: tauri::WebviewWindow) -> Result<(), FalkonError> {
    window.minimize().map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub fn window_toggle_maximize(window: tauri::WebviewWindow) -> Result<bool, FalkonError> {
    let is_max = window.is_maximized().map_err(|e| FalkonError::IoError { message: e.to_string() })?;
    if is_max {
        window.unmaximize().map_err(|e| FalkonError::IoError { message: e.to_string() })?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| FalkonError::IoError { message: e.to_string() })?;
        Ok(true)
    }
}

#[tauri::command]
pub fn window_close(window: tauri::WebviewWindow) -> Result<(), FalkonError> {
    window.close().map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), FalkonError> {
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| FalkonError::ProcessSpawnFailed {
                command: "xdg-open".to_string(),
                message: e.to_string(),
            })?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| FalkonError::ProcessSpawnFailed {
                command: "open".to_string(),
                message: e.to_string(),
            })?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(&["/C", "start", "", &url])
            .spawn()
            .map_err(|e| FalkonError::ProcessSpawnFailed {
                command: "cmd".to_string(),
                message: e.to_string(),
            })?;
    }
    Ok(())
}
