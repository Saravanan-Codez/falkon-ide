use std::path::{Path, PathBuf};
use std::sync::RwLock;

#[derive(Default)]
pub struct WorkspaceService {
    active_workspace: RwLock<Option<PathBuf>>,
    trusted_paths: RwLock<Vec<PathBuf>>,
}

impl WorkspaceService {
    pub fn new() -> Self {
        Self {
            active_workspace: RwLock::new(None),
            trusted_paths: RwLock::new(Vec::new()),
        }
    }

    pub fn set_active_workspace<P: AsRef<Path>>(&self, path: P) {
        let path_buf = path.as_ref().to_path_buf();
        let canonical = path_buf.canonicalize().unwrap_or(path_buf);
        let mut lock = self.active_workspace.write().unwrap();
        *lock = Some(canonical);
    }

    pub fn get_active_workspace(&self) -> Option<PathBuf> {
        let lock = self.active_workspace.read().unwrap();
        lock.clone()
    }

    pub fn add_trusted_path<P: AsRef<Path>>(&self, path: P) {
        let path_buf = path.as_ref().to_path_buf();
        let canonical = path_buf.canonicalize().unwrap_or(path_buf);
        let mut lock = self.trusted_paths.write().unwrap();
        if !lock.contains(&canonical) {
            lock.push(canonical);
        }
    }

    pub fn is_path_trusted<P: AsRef<Path>>(&self, path: P) -> bool {
        let target = path.as_ref();
        if let Some(ref ws) = *self.active_workspace.read().unwrap() {
            if target.starts_with(ws) {
                return true;
            }
        }
        let lock = self.trusted_paths.read().unwrap();
        lock.iter().any(|tp| target.starts_with(tp))
    }
}
