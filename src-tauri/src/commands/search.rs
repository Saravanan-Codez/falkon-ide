use crate::error::FalkonError;
use crate::services::security::SecurityService;
use crate::services::workspace::WorkspaceService;
use serde_json::json;
use std::path::Path;

#[tauri::command]
pub async fn search_text(
    workspace_service: tauri::State<'_, WorkspaceService>,
    workspace: String,
    pattern: String,
    include: Option<String>,
    exclude: Option<String>,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<serde_json::Value, FalkonError> {
    let ws_path = SecurityService::resolve_and_validate_path(&workspace, Some(&*workspace_service))?;

    tokio::task::spawn_blocking(move || {
        let rg_bin_name = if cfg!(windows) { "rg.exe" } else { "rg" };
        let node_modules_rg = ws_path.join("node_modules").join("@vscode").join("ripgrep").join("bin").join(rg_bin_name);
        let project_rg = Path::new("out").join("node_modules").join("@vscode").join("ripgrep").join("bin").join(rg_bin_name);
        let root_rg = Path::new("node_modules").join("@vscode").join("ripgrep").join("bin").join(rg_bin_name);

        let rg_cmd_path = if node_modules_rg.exists() {
            node_modules_rg.to_string_lossy().to_string()
        } else if project_rg.exists() {
            project_rg.to_string_lossy().to_string()
        } else if root_rg.exists() {
            root_rg.to_string_lossy().to_string()
        } else {
            rg_bin_name.to_string()
        };

        let mut cmd = std::process::Command::new(&rg_cmd_path);
        let max_cnt = max_results.unwrap_or(500).to_string();
        cmd.arg("--json").arg("--max-count").arg(&max_cnt);
        if !case_sensitive.unwrap_or(false) {
            cmd.arg("-i");
        }
        if let Some(inc) = include {
            cmd.arg("-g").arg(inc);
        }
        if let Some(exc) = exclude {
            cmd.arg("--glob").arg(format!("!{}", exc));
        }
        cmd.arg(&pattern).arg(&ws_path);

        if let Ok(out) = cmd.output() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let results: Vec<serde_json::Value> = stdout
                .lines()
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect();
            Ok(json!(results))
        } else {
            Ok(json!([]))
        }
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}

#[tauri::command]
pub async fn search_files(
    workspace_service: tauri::State<'_, WorkspaceService>,
    workspace: String,
    pattern: String,
) -> Result<Vec<String>, FalkonError> {
    let ws_path = SecurityService::resolve_and_validate_path(&workspace, Some(&*workspace_service))?;

    tokio::task::spawn_blocking(move || {
        let mut matches = Vec::new();
        let pat_lower = pattern.to_lowercase();

        fn walk(dir: &Path, pattern: &str, matches: &mut Vec<String>, depth: usize) {
            if depth > 10 || matches.len() >= 200 {
                return;
            }
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with('.') || name == "node_modules" || name == "target" {
                        continue;
                    }
                    if path.is_dir() {
                        walk(&path, pattern, matches, depth + 1);
                    } else if name.to_lowercase().contains(pattern) {
                        matches.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }

        walk(&ws_path, &pat_lower, &mut matches, 0);
        Ok(matches)
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}
