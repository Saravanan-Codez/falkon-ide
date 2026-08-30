#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod services;

use commands::dialogs::*;
use commands::ext_host::*;
use commands::marketplace::*;
use commands::runner::*;
use commands::settings::*;
use commands::window::*;

use std::sync::Mutex;

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Prevent GIO / GVFS from timing out on D-Bus daemon queries
        std::env::set_var("GIO_USE_VFS", "local");
        std::env::set_var("GIO_USE_VOLUME_MONITOR", "unix");

        // Sanitize environment variables only if they leak outdated Snap libraries
        let vars_to_clean = [
            "LD_LIBRARY_PATH",
            "GTK_PATH",
            "GIO_MODULE_DIR",
            "GIO_MODULE_PATH",
            "GSETTINGS_SCHEMA_DIR",
        ];
        for var in &vars_to_clean {
            if let Ok(val) = std::env::var(var) {
                if val.contains("/snap/core") || val.contains("/snap/") {
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
        }

        // Enable hardware compositing mode for responsive canvas/xterm rendering
        if std::env::var("WEBKIT_FORCE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_FORCE_COMPOSITING_MODE", "1");
        }
    }

    let ext_host_state = ExtHostState::new();

    // Store the last pending deep link URI received before the webview was ready.
    let pending_uri: std::sync::Arc<Mutex<Option<String>>> = std::sync::Arc::new(Mutex::new(None));
    let pending_uri_clone = pending_uri.clone();

    tauri::Builder::default()
        .manage(ext_host_state)
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
            // Parse incoming CLI args for OAuth deep-link callback URLs
            let _ = app;
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
            // Native File Dialogs
            open_folder_dialog,
            open_file_dialog,
            save_file_dialog,
            // Native Window Controls
            window_minimize,
            window_toggle_maximize,
            window_close,
            open_external_url,
            // Settings persistence
            read_settings,
            write_settings,
            read_keybindings,
            // Marketplace CORS Proxy
            marketplace_proxy,
            // Code Runner
            run_falkon,
            // Node Extension Host / Server Supervisor
            ext_host_start,
            ext_host_stop,
            ext_host_status,
            ext_host_restart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
