#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::json;
use std::fs;
use std::path::Path;
use std::process::Command;

#[tauri::command]
fn read_file(file_path: String) -> Result<String, String> {
  fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(file_path: String, content: String) -> Result<bool, String> {
  fs::write(&file_path, content).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_dir(dir_path: String) -> Result<serde_json::Value, String> {
  let entries = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;
  let mut vec = Vec::new();
  for entry in entries {
    let e = entry.map_err(|er| er.to_string())?;
    let meta = e.metadata().map_err(|er| er.to_string())?;
    vec.push(json!({
      "name": e.file_name().to_string_lossy(),
      "isDirectory": meta.is_dir(),
      "size": meta.len()
    }));
  }
  Ok(json!(vec))
}

#[tauri::command]
fn file_exists(file_path: String) -> bool {
  Path::new(&file_path).exists()
}

#[tauri::command]
fn create_dir(dir_path: String) -> Result<bool, String> {
  fs::create_dir_all(&dir_path).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_temp_file(content: String) -> Result<String, String> {
  let mut path = std::env::temp_dir();
  let file_name = format!("falkon_run_{}.falkon", chrono::Utc::now().timestamp_millis());
  path.push(file_name);
  let p = path.to_string_lossy().to_string();
  fs::write(&p, content).map_err(|e| e.to_string())?;
  Ok(p)
}

#[tauri::command]
fn delete_file(file_path: String) -> Result<bool, String> {
  let path = Path::new(&file_path);
  if path.is_dir() {
    fs::remove_dir_all(path).map(|_| true).map_err(|e| e.to_string())
  } else {
    fs::remove_file(path).map(|_| true).map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn git_branch(cwd: Option<String>) -> Result<Option<String>, String> {
  let out = Command::new("git")
    .arg("branch").arg("--show-current")
    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
    .output()
    .map_err(|e| e.to_string())?;
  let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
  if s.is_empty() { Ok(None) } else { Ok(Some(s)) }
}

#[tauri::command]
fn git_status(cwd: Option<String>) -> Result<String, String> {
  let out = Command::new("git")
    .arg("status").arg("--porcelain")
    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
    .output()
    .map_err(|e| e.to_string())?;
  Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
fn git_is_repo(cwd: Option<String>) -> bool {
  Command::new("git")
    .arg("rev-parse").arg("--git-dir")
    .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
    .output()
    .map(|o| o.status.success())
    .unwrap_or(false)
}

#[tauri::command]
fn run_falkon(entry: String, options: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
  let args = options.as_ref().and_then(|o| o.get("args")).and_then(|a| a.as_array()).map(|arr| {
    arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<String>>()
  }).unwrap_or_default();
  let cwd = options.as_ref().and_then(|o| o.get("cwd")).and_then(|c| c.as_str()).map(|s| s.to_string());
  let cmd = if cfg!(windows) { "python" } else { "python3" };
  let mut command = Command::new(cmd);
  if !entry.is_empty() { command.arg(entry.clone()); }
  for a in &args { command.arg(a); }
  if let Some(c) = cwd.as_ref() { command.current_dir(c); }
  let out = command.output().map_err(|e| e.to_string())?;
  Ok(json!({
    "code": out.status.code().unwrap_or(0),
    "stdout": String::from_utf8_lossy(&out.stdout).to_string(),
    "stderr": String::from_utf8_lossy(&out.stderr).to_string(),
    "entryPath": entry,
    "args": args,
    "cwd": cwd.unwrap_or_else(|| std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default())
  }))
}

#[tauri::command]
fn run_cimple(entry: String, options: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
  run_falkon(entry, options)
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      read_file, write_file, read_dir, file_exists, create_dir, create_temp_file, delete_file,
      git_branch, git_status, git_is_repo, run_falkon, run_cimple
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
