use crate::error::FalkonError;
use serde_json::json;
use std::process::Command;

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
    let mut cmd = Command::new(prog);
    cmd.args(&full_args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|e| FalkonError::ProcessSpawnFailed {
        command: prog.to_string(),
        message: e.to_string(),
    })?;

    Ok(json!({
        "code": output.status.code().unwrap_or(-1),
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
    }))
}
