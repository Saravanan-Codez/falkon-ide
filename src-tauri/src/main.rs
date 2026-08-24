#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod services;

use commands::filesystem::*;
use commands::git::*;
use commands::marketplace::*;
use commands::runner::*;
use commands::search::*;
use commands::settings::*;
use commands::terminal::*;
use commands::window::*;
use services::workspace::WorkspaceService;
use tauri::Manager;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Sanitize environment variables that may leak outdated Snap glibc / libpthread libraries
        let vars_to_clean = [
            "LD_LIBRARY_PATH",
            "GTK_PATH",
            "GIO_MODULE_DIR",
            "GIO_MODULE_PATH",
            "GSETTINGS_SCHEMA_DIR",
        ];
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

    let pty_store: PtyStore = Arc::new(Mutex::new(HashMap::new()));
    let workspace_service = WorkspaceService::new();

    // Store the last pending deep link URI received before the webview was ready.
    let pending_uri: std::sync::Arc<Mutex<Option<String>>> = std::sync::Arc::new(Mutex::new(None));
    let pending_uri_clone = pending_uri.clone();

    tauri::Builder::default()
        .manage(pty_store)
        .manage(workspace_service)
        .on_page_load(move |webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                if let Ok(mut lock) = pending_uri_clone.lock() {
                    if let Some(uri) = lock.take() {
                        let escaped = uri.replace('\\', "\\\\").replace('"', "\\\"");
                        let js = format!("window.__falkon_handle_uri && window.__falkon_handle_uri(\"{escaped}\");");
                        let _ = webview.eval(&js);
                    }
                }
            }
        })
        .setup(move |app| {
            let _webview_window = app
                .get_webview_window("main")
                .ok_or_else(|| Box::<dyn std::error::Error>::from("main window not found"))?;

            // Parse incoming CLI args for OAuth deep-link callback URLs
            let args: Vec<String> = std::env::args().collect();
            for arg in args {
                if arg.starts_with("code-oss://") || arg.starts_with("vscode://") {
                    let mut lock = pending_uri.lock().unwrap();
                    *lock = Some(arg);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File system
            read_file,
            read_file_bytes,
            write_file,
            write_file_bytes,
            copy_file,
            read_dir,
            stat_file,
            file_exists,
            create_dir,
            rename_file,
            create_temp_file,
            delete_file,
            // File dialogs
            open_folder_dialog,
            open_file_dialog,
            save_file_dialog,
            // Window controls
            window_minimize,
            window_toggle_maximize,
            window_close,
            open_external_url,
            // Settings
            read_settings,
            write_settings,
            read_keybindings,
            // Terminal
            terminal_create,
            terminal_write,
            terminal_resize,
            terminal_kill,
            // Search
            search_text,
            search_files,
            // Git
            git_branch,
            git_status,
            git_is_repo,
            git_log,
            git_diff,
            git_stage,
            git_unstage,
            git_commit,
            git_push,
            git_pull,
            git_checkout,
            // Marketplace CORS proxy
            marketplace_proxy,
            // Runners
            run_falkon,
            run_cimple
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
