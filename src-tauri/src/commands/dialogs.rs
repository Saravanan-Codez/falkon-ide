use crate::error::FalkonError;

#[tauri::command]
pub async fn open_folder_dialog() -> Result<Option<String>, FalkonError> {
    tokio::task::spawn_blocking(|| {
        let result = rfd::FileDialog::new()
            .set_title("Open Folder")
            .pick_folder();
        Ok(result.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

#[tauri::command]
pub async fn open_file_dialog(default_path: Option<String>) -> Result<Option<String>, FalkonError> {
    tokio::task::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_title("Open File");
        if let Some(ref p) = default_path {
            dialog = dialog.set_directory(p);
        }
        let result = dialog.pick_file();
        Ok(result.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

#[tauri::command]
pub async fn save_file_dialog(default_name: Option<String>) -> Result<Option<String>, FalkonError> {
    tokio::task::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_title("Save As");
        if let Some(ref name) = default_name {
            dialog = dialog.set_file_name(name);
        }
        let result = dialog.save_file();
        Ok(result.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}
