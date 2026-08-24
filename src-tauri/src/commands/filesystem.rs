use crate::error::FalkonError;
use crate::services::security::SecurityService;
use crate::services::workspace::WorkspaceService;
use serde_json::json;
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn read_file(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
) -> Result<String, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service))?;
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub async fn read_file_bytes(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
) -> Result<Vec<u8>, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service))?;
    tokio::fs::read(&path)
        .await
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub async fn write_file(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
    content: String,
) -> Result<bool, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service))?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| FalkonError::IoError { message: e.to_string() })?;
    }
    tokio::fs::write(&path, content)
        .await
        .map(|_| true)
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub async fn write_file_bytes(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
    bytes: Vec<u8>,
) -> Result<bool, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service))?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| FalkonError::IoError { message: e.to_string() })?;
    }
    tokio::fs::write(&path, bytes)
        .await
        .map(|_| true)
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub async fn copy_file(
    workspace_service: tauri::State<'_, WorkspaceService>,
    source: String,
    target: String,
) -> Result<bool, FalkonError> {
    let src_path = SecurityService::resolve_and_validate_path(&source, Some(&*workspace_service))?;
    let tgt_path = SecurityService::resolve_and_validate_path(&target, Some(&*workspace_service))?;

    tokio::task::spawn_blocking(move || {
        if let Some(parent) = tgt_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if src_path.is_dir() {
            fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
                fs::create_dir_all(dst)?;
                for entry in fs::read_dir(src)? {
                    let entry = entry?;
                    let ty = entry.file_type()?;
                    if ty.is_dir() {
                        copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
                    } else {
                        fs::copy(entry.path(), dst.join(entry.file_name()))?;
                    }
                }
                Ok(())
            }
            copy_dir_all(&src_path, &tgt_path)
                .map(|_| true)
                .map_err(|e| FalkonError::IoError { message: e.to_string() })
        } else {
            fs::copy(&src_path, &tgt_path)
                .map(|_| true)
                .map_err(|e| FalkonError::IoError { message: e.to_string() })
        }
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

#[tauri::command]
pub async fn read_dir(
    workspace_service: tauri::State<'_, WorkspaceService>,
    dir_path: String,
) -> Result<serde_json::Value, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&dir_path, Some(&*workspace_service))?;

    tokio::task::spawn_blocking(move || {
        let entries = fs::read_dir(&path).map_err(|e| FalkonError::IoError { message: e.to_string() })?;
        let mut vec = Vec::new();
        for entry in entries {
            let e = entry.map_err(|er| FalkonError::IoError { message: er.to_string() })?;
            let meta = e.metadata().map_err(|er| FalkonError::IoError { message: er.to_string() })?;
            vec.push(json!({
                "name": e.file_name().to_string_lossy(),
                "isDirectory": meta.is_dir(),
                "isFile": meta.is_file(),
                "isSymlink": meta.file_type().is_symlink(),
                "size": meta.len(),
                "mtime": meta.modified().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
            }));
        }
        Ok(json!(vec))
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

#[tauri::command]
pub async fn stat_file(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
) -> Result<serde_json::Value, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service))?;

    tokio::task::spawn_blocking(move || {
        let meta = fs::metadata(&path).map_err(|e| FalkonError::IoError { message: e.to_string() })?;
        Ok(json!({
            "isDirectory": meta.is_dir(),
            "isFile": meta.is_file(),
            "isSymlink": meta.file_type().is_symlink(),
            "size": meta.len(),
            "mtime": meta.modified().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64),
            "ctime": meta.created().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
        }))
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

#[tauri::command]
pub async fn file_exists(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
) -> Result<bool, FalkonError> {
    if let Ok(path) = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service)) {
        Ok(tokio::task::spawn_blocking(move || path.exists()).await.unwrap_or(false))
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn create_dir(
    workspace_service: tauri::State<'_, WorkspaceService>,
    dir_path: String,
) -> Result<bool, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&dir_path, Some(&*workspace_service))?;
    tokio::fs::create_dir_all(&path)
        .await
        .map(|_| true)
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub async fn rename_file(
    workspace_service: tauri::State<'_, WorkspaceService>,
    old_path: String,
    new_path: String,
) -> Result<bool, FalkonError> {
    let old_p = SecurityService::resolve_and_validate_path(&old_path, Some(&*workspace_service))?;
    let new_p = SecurityService::resolve_and_validate_path(&new_path, Some(&*workspace_service))?;

    if let Some(parent) = new_p.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| FalkonError::IoError { message: e.to_string() })?;
    }
    tokio::fs::rename(&old_p, &new_p)
        .await
        .map(|_| true)
        .map_err(|e| FalkonError::IoError { message: e.to_string() })
}

#[tauri::command]
pub async fn create_temp_file(content: String) -> Result<String, FalkonError> {
    let mut path = std::env::temp_dir();
    let file_name = format!("falkon_{}.tmp", chrono::Utc::now().timestamp_millis());
    path.push(file_name);
    let p = path.to_string_lossy().to_string();
    tokio::fs::write(&p, content)
        .await
        .map_err(|e| FalkonError::IoError { message: e.to_string() })?;
    Ok(p)
}

#[tauri::command]
pub async fn delete_file(
    workspace_service: tauri::State<'_, WorkspaceService>,
    file_path: String,
) -> Result<bool, FalkonError> {
    let path = SecurityService::resolve_and_validate_path(&file_path, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        if path.is_dir() {
            fs::remove_dir_all(&path).map(|_| true).map_err(|e| FalkonError::IoError { message: e.to_string() })
        } else {
            fs::remove_file(&path).map(|_| true).map_err(|e| FalkonError::IoError { message: e.to_string() })
        }
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

// ─────────────────────────────────────────────
//  Native File Dialogs (using rfd)
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn open_folder_dialog(
    workspace_service: tauri::State<'_, WorkspaceService>,
) -> Result<Option<String>, FalkonError> {
    let res = rfd::AsyncFileDialog::new()
        .set_title("Open Folder")
        .pick_folder()
        .await;

    if let Some(folder) = res {
        let p = folder.path().to_string_lossy().to_string();
        workspace_service.set_active_workspace(&p);
        workspace_service.add_trusted_path(&p);
        Ok(Some(p))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn open_file_dialog() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .set_title("Open File")
        .pick_file()
        .await
        .map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_file_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("Save File");
    if let Some(ref name) = default_name {
        dialog = dialog.set_file_name(name);
    }
    dialog.save_file().await.map(|f| f.path().to_string_lossy().to_string())
}
