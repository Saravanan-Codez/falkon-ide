use crate::error::{FalkonError, FalkonResult};
use serde_json::json;
use std::process::Command;

pub struct ProcessService;

impl ProcessService {
    pub fn run_command(
        program: &str,
        args: &[String],
        cwd: Option<&str>,
    ) -> FalkonResult<serde_json::Value> {
        let mut cmd = Command::new(program);
        for arg in args {
            cmd.arg(arg);
        }
        if let Some(c) = cwd {
            cmd.current_dir(c);
        }

        let output = cmd.output().map_err(|e| FalkonError::ProcessSpawnFailed {
            command: program.to_string(),
            message: e.to_string(),
        })?;

        let code = output.status.code().unwrap_or(-1);
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(json!({
            "code": code,
            "stdout": stdout,
            "stderr": stderr
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_run_command_success() {
        let prog = if cfg!(windows) { "cmd" } else { "echo" };
        let args = if cfg!(windows) {
            vec!["/C".to_string(), "echo".to_string(), "hello".to_string()]
        } else {
            vec!["hello".to_string()]
        };

        let res = ProcessService::run_command(prog, &args, None);
        assert!(res.is_ok());
        let val = res.unwrap();
        assert_eq!(val["code"], 0);
        assert!(val["stdout"].as_str().unwrap().contains("hello"));
    }
}
