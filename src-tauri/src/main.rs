#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use tauri::Manager;
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use uuid::Uuid;

// ─────────────────────────────────────────────
//  PTY Session Store
// ─────────────────────────────────────────────

struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn std::io::Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

type PtyStore = Mutex<HashMap<String, PtySession>>;

// ─────────────────────────────────────────────
//  File System Commands
// ─────────────────────────────────────────────

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(file_path: String, content: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    tokio::fs::write(&file_path, content).await.map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_dir(dir_path: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let entries = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;
        let mut vec = Vec::new();
        for entry in entries {
            let e = entry.map_err(|er| er.to_string())?;
            let meta = e.metadata().map_err(|er| er.to_string())?;
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
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn stat_file(file_path: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let meta = fs::metadata(&file_path).map_err(|e| e.to_string())?;
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
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn file_exists(file_path: String) -> bool {
    tokio::task::spawn_blocking(move || Path::new(&file_path).exists()).await.unwrap_or(false)
}

#[tauri::command]
async fn create_dir(dir_path: String) -> Result<bool, String> {
    tokio::fs::create_dir_all(&dir_path).await.map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&new_path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    tokio::fs::rename(&old_path, &new_path).await.map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_temp_file(content: String) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    let file_name = format!("falkon_{}.tmp", chrono::Utc::now().timestamp_millis());
    path.push(file_name);
    let p = path.to_string_lossy().to_string();
    tokio::fs::write(&p, content).await.map_err(|e| e.to_string())?;
    Ok(p)
}

#[tauri::command]
async fn delete_file(file_path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&file_path);
        if path.is_dir() {
            fs::remove_dir_all(path).map(|_| true).map_err(|e| e.to_string())
        } else {
            fs::remove_file(path).map(|_| true).map_err(|e| e.to_string())
        }
    }).await.map_err(|e| e.to_string())?
}

// ─────────────────────────────────────────────
//  Native File Dialogs (using rfd)
// ─────────────────────────────────────────────

#[tauri::command]
async fn open_folder_dialog() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .set_title("Open Folder")
        .pick_folder()
        .await
        .map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn open_file_dialog(filters: Option<Vec<serde_json::Value>>) -> Option<String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("Open File");
    if let Some(fs) = filters {
        for f in &fs {
            if let (Some(name), Some(exts)) = (f["name"].as_str(), f["extensions"].as_array()) {
                let exts: Vec<&str> = exts.iter().filter_map(|e| e.as_str()).collect();
                dialog = dialog.add_filter(name, &exts);
            }
        }
    }
    dialog.pick_file().await.map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn save_file_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("Save File");
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }
    dialog.save_file().await.map(|f| f.path().to_string_lossy().to_string())
}

// ─────────────────────────────────────────────
//  Settings Persistence (VS Code's own JSON format)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  Integrated Terminal (PTY via portable-pty)
// ─────────────────────────────────────────────

#[tauri::command]
fn terminal_create(
    state: tauri::State<PtyStore>,
    window: tauri::Window,
    cols: Option<u16>,
    rows: Option<u16>,
    cwd: Option<String>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let pty_system = NativePtySystem::default();
    let size = PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = pty_system.openpty(size).map_err(|e| e.to_string())?;

    let shell = if cfg!(windows) {
        let pwsh = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
        if Path::new(pwsh).exists() {
            pwsh.to_string()
        } else {
            "powershell.exe".to_string()
        }
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    };

    let mut cmd = CommandBuilder::new(&shell);
    if let Some(ref dir) = cwd {
        let clean = dir.trim_start_matches("file:///").trim_start_matches("file://");
        let p = Path::new(clean);
        if p.exists() {
            cmd.cwd(clean);
        }
    }

    // Configure complete interactive terminal environment
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "FalkonIDE");
    if let Ok(lang) = std::env::var("LANG") {
        cmd.env("LANG", lang);
    } else {
        cmd.env("LANG", "en_US.UTF-8");
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let master = pair.master;
    let writer = master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;

    let id_clone = id.clone();
    let window_clone = window.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    let _ = window_clone.emit(&format!("terminal-exit-{}", id_clone), ());
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = window_clone.emit(&format!("terminal-data-{}", id_clone), data);
                }
            }
        }
    });

    state.lock().unwrap().insert(id.clone(), PtySession { master, writer, child });
    Ok(id)
}

#[tauri::command]
fn terminal_write(state: tauri::State<PtyStore>, id: String, data: String) -> Result<(), String> {
    let mut store = state.lock().unwrap();
    if let Some(session) = store.get_mut(&id) {
        use std::io::Write;
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("PTY session '{}' not found", id))
    }
}

#[tauri::command]
fn terminal_resize(
    state: tauri::State<PtyStore>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let store = state.lock().unwrap();
    if let Some(session) = store.get(&id) {
        let _ = session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        });
    }
    Ok(())
}

#[tauri::command]
fn terminal_kill(state: tauri::State<PtyStore>, id: String) -> Result<(), String> {
    let mut store = state.lock().unwrap();
    if let Some(mut session) = store.remove(&id) {
        session.child.kill().map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

// ─────────────────────────────────────────────
//  Search (ripgrep via shell)
// ─────────────────────────────────────────────

#[tauri::command]
async fn search_text(
    workspace: String,
    pattern: String,
    include: Option<String>,
    exclude: Option<String>,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let rg_bin_name = if cfg!(windows) { "rg.exe" } else { "rg" };
        let node_modules_rg = Path::new(&workspace).join("node_modules").join("@vscode").join("ripgrep").join("bin").join(rg_bin_name);

        let rg_cmd_path = if node_modules_rg.exists() {
            node_modules_rg.to_string_lossy().to_string()
        } else {
            rg_bin_name.to_string()
        };

        let mut cmd = std::process::Command::new(&rg_cmd_path);
        cmd.arg("--json").arg("--max-count").arg("100");
        if !case_sensitive.unwrap_or(false) {
            cmd.arg("-i");
        }
        if let Some(inc) = include {
            cmd.arg("-g").arg(inc);
        }
        if let Some(exc) = exclude {
            cmd.arg("--glob").arg(format!("!{}", exc));
        }
        cmd.arg(&pattern).arg(&workspace);

        if let Ok(out) = cmd.output() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let results: Vec<serde_json::Value> = stdout
                .lines()
                .filter_map(|l| serde_json::from_str(l).ok())
                .filter(|v: &serde_json::Value| v["type"] == "match")
                .take(max_results.unwrap_or(500))
                .collect();
            Ok(json!(results))
        } else {
            Ok(json!([]))
        }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn search_files(workspace: String, pattern: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let mut results = Vec::new();
        search_files_recursive(Path::new(&workspace), &pattern.to_lowercase(), &mut results, 0);
        Ok(json!(results))
    }).await.map_err(|e| e.to_string())?
}

fn search_files_recursive(dir: &Path, pattern: &str, results: &mut Vec<String>, depth: usize) {
    if depth > 10 || results.len() >= 500 { return; }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with('.') { continue; }
            if name == "node_modules" || name == "target" { continue; }
            if path.is_dir() {
                search_files_recursive(&path, pattern, results, depth + 1);
            } else if name.contains(pattern) {
                results.push(path.to_string_lossy().to_string());
            }
        }
    }
}

// ─────────────────────────────────────────────
//  Git SCM Commands
// ─────────────────────────────────────────────

fn git_cmd(args: &[&str], cwd: &str) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[tauri::command]
async fn git_branch(cwd: Option<String>) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let dir = cwd.unwrap_or_else(|| ".".to_string());
        let s = git_cmd(&["branch", "--show-current"], &dir)?;
        let s = s.trim().to_string();
        if s.is_empty() { Ok(None) } else { Ok(Some(s)) }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_status(cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        git_cmd(&["status", "--porcelain"], &cwd.unwrap_or_else(|| ".".to_string()))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_is_repo(cwd: Option<String>) -> bool {
    tokio::task::spawn_blocking(move || {
        Command::new("git")
            .args(["rev-parse", "--git-dir"])
            .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }).await.unwrap_or(false)
}

#[tauri::command]
async fn git_log(cwd: String, max: Option<usize>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let n = max.unwrap_or(50).to_string();
        git_cmd(&["log", "--oneline", &format!("-{}", n)], &cwd)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_diff(cwd: String, staged: Option<bool>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        if staged.unwrap_or(false) {
            git_cmd(&["diff", "--cached"], &cwd)
        } else {
            git_cmd(&["diff"], &cwd)
        }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_stage(cwd: String, path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        git_cmd(&["add", &path], &cwd).map(|_| true)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_unstage(cwd: String, path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        git_cmd(&["restore", "--staged", &path], &cwd).map(|_| true)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_commit(cwd: String, message: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        git_cmd(&["commit", "-m", &message], &cwd).map(|_| true)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_push(cwd: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        git_cmd(&["push"], &cwd)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_pull(cwd: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        git_cmd(&["pull"], &cwd)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn git_checkout(cwd: String, branch: String, create: Option<bool>) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        if create.unwrap_or(false) {
            git_cmd(&["checkout", "-b", &branch], &cwd).map(|_| true)
        } else {
            git_cmd(&["checkout", &branch], &cwd).map(|_| true)
        }
    }).await.map_err(|e| e.to_string())?
}

// ─────────────────────────────────────────────
//  Runner Commands
// ─────────────────────────────────────────────

#[tauri::command]
fn run_falkon(entry: String, options: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let args = options.as_ref().and_then(|o| o.get("args")).and_then(|a| a.as_array()).map(|arr| {
        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<String>>()
    }).unwrap_or_default();
    let cwd = options.as_ref().and_then(|o| o.get("cwd")).and_then(|c| c.as_str()).map(|s| s.to_string());
    let cmd_str = if cfg!(windows) { "python" } else { "python3" };
    let mut command = Command::new(cmd_str);
    if !entry.is_empty() { command.arg(&entry); }
    for a in &args { command.arg(a); }
    if let Some(c) = cwd.as_ref() { command.current_dir(c); }
    let out = command.output().map_err(|e| e.to_string())?;
    Ok(json!({
        "code": out.status.code().unwrap_or(0),
        "stdout": String::from_utf8_lossy(&out.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&out.stderr).to_string(),
    }))
}

#[tauri::command]
fn run_cimple(entry: String, options: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    run_falkon(entry, options)
}

fn settings_dir() -> std::path::PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
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
fn read_settings() -> Result<String, String> {
    let path = settings_dir().join("settings.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn write_settings(content: String) -> Result<bool, String> {
    let dir = settings_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("settings.json"), content).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_keybindings() -> Result<String, String> {
    let path = settings_dir().join("keybindings.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_server_authority() -> String {
    "127.0.0.1:9888".to_string()
}

// ─────────────────────────────────────────────
//  Open URL in System Browser (cross-platform)
// ─────────────────────────────────────────────
// Works on:
//   Linux:   xdg-open (all distros, X11 + Wayland)
//   macOS:   open
//   Windows: PowerShell Start-Process
//   ARM:     same commands work

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("xdg-open failed: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("open failed: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(&["-NoProfile", "-NonInteractive", "-Command", &format!("Start-Process '{}'", url)])
            .spawn()
            .map_err(|e| format!("PowerShell Start-Process failed: {e}"))?;
    }
    Ok(())
}

fn start_oauth_callback_server(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind("127.0.0.1:9888") {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[Falkon OAuth] Port 9888 already bound or unavailable: {}", e);
                return;
            }
        };

        println!("[Falkon OAuth] OAuth callback listener active on http://127.0.0.1:9888");

        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                use std::io::{Read, Write};
                let mut buf = [0u8; 4096];
                if let Ok(n) = stream.read(&mut buf) {
                    if n > 0 {
                        let request = String::from_utf8_lossy(&buf[..n]);
                        if let Some(first_line) = request.lines().next() {
                            let parts: Vec<&str> = first_line.split_whitespace().collect();
                            if parts.len() >= 2 {
                                let path_and_query = parts[1];
                                let full_uri = format!("http://127.0.0.1:9888{}", path_and_query);

                                if let Some(window) = app_handle.get_webview_window("main") {
                                    let escaped = full_uri.replace('\\', "\\\\").replace('"', "\\\"");
                                    let js = format!(
                                        r#"if (window.__falkon_handle_uri) {{ window.__falkon_handle_uri("{escaped}"); }}"#,
                                        escaped = escaped
                                    );
                                    let _ = window.eval(&js);
                                }

                                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><head><title>Falkon IDE - Authentication</title><style>body{font-family:system-ui,sans-serif;background:#1e1e1e;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;}h2{color:#4ec9b0;}p{color:#cccccc;}</style></head><body><h2>Authentication Successful!</h2><p>You have successfully authenticated. You may close this browser tab and return to Falkon IDE.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>";
                                let _ = stream.write_all(response.as_bytes());
                                let _ = stream.flush();
                            }
                        }
                    }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Sanitize environment variables that may leak outdated Snap glibc / libpthread libraries
        let vars_to_clean = ["LD_LIBRARY_PATH", "GTK_PATH", "GIO_MODULE_DIR", "GIO_MODULE_PATH", "GSETTINGS_SCHEMA_DIR"];
        for var in &vars_to_clean {
            if let Ok(val) = std::env::var(var) {
                let cleaned: Vec<&str> = val
                    .split(':')
                    .filter(|p| !p.contains("/snap/core") && !p.contains("/snap/"))
                    .filter(|p| !p.trim().is_empty())
                    .collect();
                if cleaned.is_empty() {
                    std::env::remove_var(var);
                } else {
                    std::env::set_var(var, cleaned.join(":"));
                }
            }
        }

        // Avoid DRI2 / EGL driver crashes and WebKitGTK bugs on Linux
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    let pty_store: PtyStore = Mutex::new(HashMap::new());

    // Store the last pending deep link URI received before the webview was ready.
    // Thread-safe: protected by a Mutex so the on_page_load handler can drain it.
    let pending_uri: std::sync::Arc<Mutex<Option<String>>> = std::sync::Arc::new(Mutex::new(None));
    let pending_uri_clone = pending_uri.clone();

    tauri::Builder::default()
        .manage(pty_store)
        .on_page_load(move |webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                if let Ok(mut lock) = pending_uri_clone.lock() {
                    if let Some(uri) = lock.take() {
                        let escaped = uri.replace('\\', "\\\\").replace('"', "\\\"");
                        let js = format!(
                            r#"if (window.__falkon_handle_uri) {{ window.__falkon_handle_uri("{escaped}"); }}"#,
                            escaped = escaped
                        );
                        let _ = webview.eval(&js);
                    }
                }
            }
        })
        .setup(move |app| {
            let webview_window = app.get_webview_window("main")
                .ok_or_else(|| Box::<dyn std::error::Error>::from("main window not found"))?;

            // Start dedicated OAuth callback listener on port 9888 for GitHub / Microsoft account login
            start_oauth_callback_server(app.handle().clone());

            // Parse incoming CLI args for OAuth deep-link callback URLs
            let args: Vec<String> = std::env::args().collect();
            for arg in args {
                if arg.starts_with("code-oss://") || arg.starts_with("vscode://") {
                    let escaped = arg.replace('\\', "\\\\").replace('"', "\\\"");
                    let js = format!("window.__falkon_handle_uri && window.__falkon_handle_uri(\"{escaped}\");");
                    let _ = webview_window.eval(&js);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_authority,
            marketplace_proxy,
            // File system
            read_file, write_file, read_dir, stat_file, file_exists,
            create_dir, rename_file, create_temp_file, delete_file,
            // File dialogs
            open_folder_dialog, open_file_dialog, save_file_dialog,
            // Window controls
            window_minimize, window_toggle_maximize, window_close,
            // Open URL in system browser (for OAuth / auth flows on all platforms)
            open_external_url,
            // Settings
            read_settings, write_settings, read_keybindings,
            // Terminal
            terminal_create, terminal_write, terminal_resize, terminal_kill,
            // Search
            search_text, search_files,
            // Git
            git_branch, git_status, git_is_repo, git_log, git_diff,
            git_stage, git_unstage, git_commit, git_push, git_pull, git_checkout,
            // Runners
            run_falkon, run_cimple
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn marketplace_proxy(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let is_post = method.as_deref().unwrap_or("GET").eq_ignore_ascii_case("POST");
        let mut req = if is_post {
            client.post(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json;api-version=6.0-preview.1;excludeMetaData=true")
        } else {
            client.get(&url)
        };

        req = req.header("User-Agent", "VSCode/1.133.0");

        if let Some(hdrs) = headers {
            for (k, v) in hdrs {
                if k.eq_ignore_ascii_case("host") || k.eq_ignore_ascii_case("content-length") { continue; }
                req = req.header(&k, &v);
            }
        }

        if is_post {
            if let Some(b) = body {
                req = req.body(b);
            }
        }

        let res = req.send().map_err(|e| e.to_string())?;
        let text = res.text().map_err(|e| e.to_string())?;
        Ok(text)
    }).await.map_err(|e| e.to_string())?
}
