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
fn read_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(file_path: String, content: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
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
            "isFile": meta.is_file(),
            "isSymlink": meta.file_type().is_symlink(),
            "size": meta.len(),
            "mtime": meta.modified().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
        }));
    }
    Ok(json!(vec))
}

#[tauri::command]
fn stat_file(file_path: String) -> Result<serde_json::Value, String> {
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
fn rename_file(old_path: String, new_path: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&new_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&old_path, &new_path).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_temp_file(content: String) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    let file_name = format!("falkon_{}.tmp", chrono::Utc::now().timestamp_millis());
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

fn settings_dir() -> std::path::PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    dir.push("Code - OSS");
    dir.push("User");
    dir
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
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    };

    let mut cmd = CommandBuilder::new(&shell);
    if let Some(cwd) = cwd {
        cmd.cwd(cwd);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let master = pair.master;
    let writer = master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;

    let id_clone = id.clone();
    let window_clone = window.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
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
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())
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
fn search_text(
    workspace: String,
    pattern: String,
    include: Option<String>,
    exclude: Option<String>,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<serde_json::Value, String> {
    let rg = if cfg!(windows) { "rg.exe" } else { "rg" };
    let mut cmd = std::process::Command::new(rg);
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

    let out = cmd.output().map_err(|e| format!("ripgrep not found: {}", e))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let results: Vec<serde_json::Value> = stdout
        .lines()
        .filter_map(|l| serde_json::from_str(l).ok())
        .filter(|v: &serde_json::Value| v["type"] == "match")
        .take(max_results.unwrap_or(500))
        .collect();
    Ok(json!(results))
}

#[tauri::command]
fn search_files(workspace: String, pattern: String) -> Result<serde_json::Value, String> {
    let mut results = Vec::new();
    search_files_recursive(Path::new(&workspace), &pattern.to_lowercase(), &mut results, 0);
    Ok(json!(results))
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
fn git_branch(cwd: Option<String>) -> Result<Option<String>, String> {
    let dir = cwd.unwrap_or_else(|| ".".to_string());
    let s = git_cmd(&["branch", "--show-current"], &dir)?;
    let s = s.trim().to_string();
    if s.is_empty() { Ok(None) } else { Ok(Some(s)) }
}

#[tauri::command]
fn git_status(cwd: Option<String>) -> Result<String, String> {
    git_cmd(&["status", "--porcelain"], &cwd.unwrap_or_else(|| ".".to_string()))
}

#[tauri::command]
fn git_is_repo(cwd: Option<String>) -> bool {
    Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(cwd.unwrap_or_else(|| ".".to_string()))
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
fn git_log(cwd: String, max: Option<usize>) -> Result<String, String> {
    let n = max.unwrap_or(50).to_string();
    git_cmd(&["log", "--oneline", &format!("-{}", n)], &cwd)
}

#[tauri::command]
fn git_diff(cwd: String, staged: Option<bool>) -> Result<String, String> {
    if staged.unwrap_or(false) {
        git_cmd(&["diff", "--cached"], &cwd)
    } else {
        git_cmd(&["diff"], &cwd)
    }
}

#[tauri::command]
fn git_stage(cwd: String, path: String) -> Result<bool, String> {
    git_cmd(&["add", &path], &cwd).map(|_| true)
}

#[tauri::command]
fn git_unstage(cwd: String, path: String) -> Result<bool, String> {
    git_cmd(&["restore", "--staged", &path], &cwd).map(|_| true)
}

#[tauri::command]
fn git_commit(cwd: String, message: String) -> Result<bool, String> {
    git_cmd(&["commit", "-m", &message], &cwd).map(|_| true)
}

#[tauri::command]
fn git_push(cwd: String) -> Result<String, String> {
    git_cmd(&["push"], &cwd)
}

#[tauri::command]
fn git_pull(cwd: String) -> Result<String, String> {
    git_cmd(&["pull"], &cwd)
}

#[tauri::command]
fn git_checkout(cwd: String, branch: String, create: Option<bool>) -> Result<bool, String> {
    if create.unwrap_or(false) {
        git_cmd(&["checkout", "-b", &branch], &cwd).map(|_| true)
    } else {
        git_cmd(&["checkout", &branch], &cwd).map(|_| true)
    }
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

// ─────────────────────────────────────────────
//  Node.js Extension Host Sidecar Supervisor
// ─────────────────────────────────────────────

struct ServerManager {
    #[allow(dead_code)]
    child: Mutex<Option<std::process::Child>>,
}

fn find_server_script() -> Option<std::path::PathBuf> {
    let candidates = [
        // 1. Current working directory
        std::env::current_dir().ok().map(|d| d.join("src").join("server-main.js")),
        std::env::current_dir().ok().map(|d| d.join("server-main.js")),
        // 2. Executable directory parent
        std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())).map(|d| d.join("src").join("server-main.js")),
        std::env::current_exe().ok().and_then(|p| p.parent().and_then(|d| d.parent()).map(|d| d.to_path_buf())).map(|d| d.join("src").join("server-main.js")),
        // 3. Compile-time manifest dir fallback
        option_env!("CARGO_MANIFEST_DIR").map(|d| {
            let mut p = std::path::PathBuf::from(d);
            if p.ends_with("src-tauri") { p.pop(); }
            p.join("src").join("server-main.js")
        }),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn start_node_server() -> Option<std::process::Child> {
    // Check if server is already running on port 9888
    if std::net::TcpStream::connect("127.0.0.1:9888").is_ok() {
        println!("[Falkon] Node.js Extension Host server is already running on 127.0.0.1:9888");
        return None;
    }

    let node_cmd = if cfg!(windows) { "node.exe" } else { "node" };
    let server_path = match find_server_script() {
        Some(p) => p,
        None => {
            eprintln!("[Falkon] Error: Could not locate server-main.js");
            return None;
        }
    };

    let server_path_str = server_path.to_string_lossy().to_string();
    println!("[Falkon] Starting Node.js Extension Host sidecar: {}", server_path_str);

    let mut cmd = Command::new(node_cmd);
    cmd.arg(&server_path_str)
        .arg("--host").arg("127.0.0.1")
        .arg("--port").arg("9888")
        .arg("--connection-token").arg("falkon-dev-token")
        .arg("--accept-server-license-terms");

    match cmd.spawn() {
        Ok(child) => {
            println!("[Falkon] Node.js Extension Host sidecar spawned with PID: {}", child.id());
            // Give the server a brief moment to bind to the port
            std::thread::sleep(std::time::Duration::from_millis(500));
            Some(child)
        }
        Err(e) => {
            eprintln!("[Falkon] Warning: Could not spawn Node.js sidecar automatically: {}", e);
            None
        }
    }
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
    let server_manager = ServerManager {
        child: Mutex::new(start_node_server()),
    };

    // Store the last pending deep link URI received before the webview was ready.
    // Thread-safe: protected by a Mutex so the on_page_load handler can drain it.
    let pending_uri: std::sync::Arc<Mutex<Option<String>>> = std::sync::Arc::new(Mutex::new(None));
    let pending_uri_clone = pending_uri.clone();

    tauri::Builder::default()
        .manage(pty_store)
        .manage(server_manager)
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
        // Inject the initialization script into the Tauri WebView.
        // This script runs on every page load inside the WebView, including
        // the VS Code workbench served from http://127.0.0.1:9888.
        // It provides a __falkon_handle_uri(uri) function which the Rust side
        // can call to dispatch URI-handler events to the VS Code extension host.
        .setup(move |app| {
            let webview_window = app.get_webview_window("main")
                .ok_or_else(|| Box::<dyn std::error::Error>::from("main window not found"))?;

            // Register the code-oss:// URI scheme on the operating system so that
            // the system browser can redirect back into the app after OAuth.
            // This is equivalent to vscode:// on VS Code Desktop.
            //
            // On Linux/macOS/Windows the OS will invoke our binary with:
            //   falkon_dev_kit_tauri code-oss://...
            // Tauri captures this and emits a "deep-link" event.
            // We forward that URI to the workbench via JavaScript eval.
            let wv_clone = webview_window.clone();
            let _ = wv_clone; // keep reference
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_authority,
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
