use crate::error::FalkonError;
use std::fs;
use std::path::PathBuf;

fn settings_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let falkon_dir = base.join("Falkon IDE").join("User");
    if falkon_dir.exists() {
        return falkon_dir;
    }
    let code_oss_dir = base.join("Code - OSS").join("User");
    if code_oss_dir.exists() {
        return code_oss_dir;
    }
    falkon_dir
}

#[tauri::command]
pub fn read_settings() -> Result<String, FalkonError> {
    let path = settings_dir().join("settings.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| FalkonError::IoError { message: e.to_string() })
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub fn write_settings(content: String) -> Result<bool, FalkonError> {
    let dir = settings_dir();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("settings.json");
    fs::write(&path, content)
        .map(|_| true)
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub fn read_keybindings() -> Result<String, FalkonError> {
    let path = settings_dir().join("keybindings.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| FalkonError::IoError { message: e.to_string() })
    } else {
        Ok("[]".to_string())
    }
}
