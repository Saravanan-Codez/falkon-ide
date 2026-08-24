use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", content = "details")]
pub enum FalkonError {
    FileNotFound { path: String },
    FileAlreadyExists { path: String },
    PermissionDenied { path: String },
    PathOutsideWorkspace { path: String, workspace: String },
    InvalidDomain { url: String },
    InsecureProtocol { url: String },
    ProcessNotFound { command: String },
    ProcessSpawnFailed { command: String, message: String },
    ExecutionFailed { code: i32, stderr: String },
    PtyError { message: String },
    PtySessionNotFound { id: String },
    GitError { message: String },
    IoError { message: String },
    WorkspaceNotConfigured,
}

impl fmt::Display for FalkonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FalkonError::FileNotFound { path } => write!(f, "File not found: {path}"),
            FalkonError::FileAlreadyExists { path } => write!(f, "File already exists: {path}"),
            FalkonError::PermissionDenied { path } => write!(f, "Permission denied: {path}"),
            FalkonError::PathOutsideWorkspace { path, workspace } => {
                write!(f, "Path '{path}' is outside active workspace '{workspace}'")
            }
            FalkonError::InvalidDomain { url } => write!(f, "Invalid or unauthorized domain: {url}"),
            FalkonError::InsecureProtocol { url } => write!(f, "Insecure protocol in URL: {url}"),
            FalkonError::ProcessNotFound { command } => write!(f, "Executable not found: {command}"),
            FalkonError::ProcessSpawnFailed { command, message } => {
                write!(f, "Failed to spawn process '{command}': {message}")
            }
            FalkonError::ExecutionFailed { code, stderr } => {
                write!(f, "Command failed with code {code}: {stderr}")
            }
            FalkonError::PtyError { message } => write!(f, "PTY error: {message}"),
            FalkonError::PtySessionNotFound { id } => write!(f, "PTY session not found: {id}"),
            FalkonError::GitError { message } => write!(f, "Git error: {message}"),
            FalkonError::IoError { message } => write!(f, "I/O error: {message}"),
            FalkonError::WorkspaceNotConfigured => write!(f, "No active workspace configured"),
        }
    }
}

impl std::error::Error for FalkonError {}

impl From<std::io::Error> for FalkonError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => FalkonError::FileNotFound {
                path: err.to_string(),
            },
            std::io::ErrorKind::PermissionDenied => FalkonError::PermissionDenied {
                path: err.to_string(),
            },
            _ => FalkonError::IoError {
                message: err.to_string(),
            },
        }
    }
}

pub type FalkonResult<T> = Result<T, FalkonError>;
