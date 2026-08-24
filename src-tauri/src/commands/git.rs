use crate::error::{FalkonError, FalkonResult};
use crate::services::security::SecurityService;
use crate::services::workspace::WorkspaceService;
use serde_json::json;
use std::process::Command;

fn git_cmd(args: &[&str], cwd: &str) -> FalkonResult<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| FalkonError::GitError {
            message: format!("Failed to execute git {:?}: {}", args, e),
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(FalkonError::GitError {
            message: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        })
    }
}

#[tauri::command]
pub async fn git_branch(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: Option<String>,
) -> Result<String, FalkonError> {
    let dir = match cwd {
        Some(ref c) => SecurityService::resolve_and_validate_path(c, Some(&*workspace_service))?,
        None => workspace_service
            .get_active_workspace()
            .ok_or(FalkonError::WorkspaceNotConfigured)?,
    };
    tokio::task::spawn_blocking(move || {
        git_cmd(&["rev-parse", "--abbrev-ref", "HEAD"], &dir.to_string_lossy())
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_status(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: Option<String>,
) -> Result<serde_json::Value, FalkonError> {
    let dir = match cwd {
        Some(ref c) => SecurityService::resolve_and_validate_path(c, Some(&*workspace_service))?,
        None => workspace_service
            .get_active_workspace()
            .ok_or(FalkonError::WorkspaceNotConfigured)?,
    };
    tokio::task::spawn_blocking(move || {
        let raw = git_cmd(&["status", "--porcelain=v1"], &dir.to_string_lossy())?;
        let files: Vec<serde_json::Value> = raw
            .lines()
            .filter(|l| l.len() >= 4)
            .map(|l| {
                let status_code = &l[..2];
                let path = l[3..].trim_matches('"');
                json!({
                    "path": path,
                    "status": status_code,
                    "staged": status_code.starts_with('M') || status_code.starts_with('A') || status_code.starts_with('D'),
                })
            })
            .collect();
        Ok(json!(files))
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_is_repo(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: Option<String>,
) -> Result<bool, FalkonError> {
    let dir = match cwd {
        Some(ref c) => SecurityService::resolve_and_validate_path(c, Some(&*workspace_service))?,
        None => workspace_service
            .get_active_workspace()
            .ok_or(FalkonError::WorkspaceNotConfigured)?,
    };
    tokio::task::spawn_blocking(move || {
        Ok(git_cmd(&["rev-parse", "--is-inside-work-tree"], &dir.to_string_lossy()).is_ok())
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_log(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
    max: Option<usize>,
) -> Result<serde_json::Value, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        let n = max.unwrap_or(50).to_string();
        let raw = git_cmd(
            &["log", &format!("-n{n}"), "--pretty=format:%H|%an|%s|%ar"],
            &dir.to_string_lossy(),
        )?;
        let commits: Vec<serde_json::Value> = raw
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.splitn(4, '|').collect();
                if parts.len() == 4 {
                    Some(json!({
                        "hash": parts[0],
                        "author": parts[1],
                        "message": parts[2],
                        "date": parts[3],
                    }))
                } else {
                    None
                }
            })
            .collect();
        Ok(json!(commits))
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_diff(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
    staged: Option<bool>,
) -> Result<String, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        if staged.unwrap_or(false) {
            git_cmd(&["diff", "--cached"], &dir.to_string_lossy())
        } else {
            git_cmd(&["diff"], &dir.to_string_lossy())
        }
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_stage(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
    path: String,
) -> Result<bool, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        git_cmd(&["add", &path], &dir.to_string_lossy()).map(|_| true)
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_unstage(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
    path: String,
) -> Result<bool, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        git_cmd(&["reset", "HEAD", "--", &path], &dir.to_string_lossy()).map(|_| true)
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_commit(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
    message: String,
) -> Result<bool, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        git_cmd(&["commit", "-m", &message], &dir.to_string_lossy()).map(|_| true)
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_push(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
) -> Result<String, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || git_cmd(&["push"], &dir.to_string_lossy()))
        .await
        .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_pull(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
) -> Result<String, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || git_cmd(&["pull"], &dir.to_string_lossy()))
        .await
        .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}

#[tauri::command]
pub async fn git_checkout(
    workspace_service: tauri::State<'_, WorkspaceService>,
    cwd: String,
    branch: String,
    create: Option<bool>,
) -> Result<bool, FalkonError> {
    let dir = SecurityService::resolve_and_validate_path(&cwd, Some(&*workspace_service))?;
    tokio::task::spawn_blocking(move || {
        if create.unwrap_or(false) {
            git_cmd(&["checkout", "-b", &branch], &dir.to_string_lossy()).map(|_| true)
        } else {
            git_cmd(&["checkout", &branch], &dir.to_string_lossy()).map(|_| true)
        }
    })
    .await
    .map_err(|e| FalkonError::GitError { message: e.to_string() })?
}
