use crate::error::FalkonError;
use crate::services::process::ProcessService;

#[tauri::command]
pub fn run_falkon(
    entry: String,
    options: Option<serde_json::Value>,
) -> Result<serde_json::Value, FalkonError> {
    let args = options
        .as_ref()
        .and_then(|o| o.get("args"))
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    let cwd = options
        .as_ref()
        .and_then(|o| o.get("cwd"))
        .and_then(|c| c.as_str());

    let mut full_args = Vec::new();
    if !entry.is_empty() {
        full_args.push(entry);
    }
    full_args.extend(args);

    let prog = if cfg!(windows) { "python" } else { "python3" };
    ProcessService::run_command(prog, &full_args, cwd)
}

#[tauri::command]
pub fn run_cimple(
    entry: String,
    options: Option<serde_json::Value>,
) -> Result<serde_json::Value, FalkonError> {
    run_falkon(entry, options)
}
