use crate::error::{FalkonError, FalkonResult};
use crate::services::workspace::WorkspaceService;
use std::path::{Component, Path, PathBuf};

pub struct SecurityService;

impl SecurityService {
    /// Resolves and canonicalizes a path for operation.
    /// If the path target does not exist yet (e.g. for write_file or create_dir),
    /// it finds the nearest existing ancestor parent directory, canonicalizes the parent,
    /// appends the remaining non-existent components, and verifies boundary safety.
    pub fn resolve_and_validate_path<P: AsRef<Path>>(
        raw_path: P,
        workspace: Option<&WorkspaceService>,
    ) -> FalkonResult<PathBuf> {
        let input_path = raw_path.as_ref();

        // 1. Normalize path components (remove `.` and resolve `..` logically)
        let normalized = Self::normalize_path(input_path);

        // 2. Canonicalize path or nearest existing ancestor
        let (canonical_base, tail) = Self::canonicalize_existing_ancestor(&normalized)?;

        let full_resolved = if tail.components().next().is_some() {
            canonical_base.join(tail)
        } else {
            canonical_base
        };

        // 3. If workspace is active, verify boundary
        if let Some(ws_service) = workspace {
            if let Some(ws_root) = ws_service.get_active_workspace() {
                let canonical_ws = ws_root.canonicalize().unwrap_or(ws_root);
                if !full_resolved.starts_with(&canonical_ws) {
                    return Err(FalkonError::PathOutsideWorkspace {
                        path: full_resolved.to_string_lossy().to_string(),
                        workspace: canonical_ws.to_string_lossy().to_string(),
                    });
                }
            }
        }

        Ok(full_resolved)
    }

    fn normalize_path(path: &Path) -> PathBuf {
        let mut out = PathBuf::new();
        for component in path.components() {
            match component {
                Component::CurDir => {}
                Component::ParentDir => {
                    out.pop();
                }
                c => out.push(c.as_os_str()),
            }
        }
        out
    }

    fn canonicalize_existing_ancestor(path: &Path) -> FalkonResult<(PathBuf, PathBuf)> {
        let mut current = path.to_path_buf();
        let mut tail_components = Vec::new();

        loop {
            if current.exists() {
                let canonical = current.canonicalize().map_err(|e| FalkonError::IoError {
                    message: format!("Failed to canonicalize {}: {}", current.display(), e),
                })?;
                let mut tail = PathBuf::new();
                for comp in tail_components.into_iter().rev() {
                    tail.push(comp);
                }
                return Ok((canonical, tail));
            }

            if let Some(name) = current.file_name() {
                tail_components.push(name.to_os_string());
                if let Some(parent) = current.parent() {
                    current = parent.to_path_buf();
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        // If nothing exists, return temp dir as root fallback or current path
        let temp = std::env::temp_dir();
        let canonical_temp = temp.canonicalize().unwrap_or(temp);
        Ok((canonical_temp, path.to_path_buf()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_normalize_path_traversal() {
        let path = Path::new("/workspace/foo/../bar/file.txt");
        let norm = SecurityService::normalize_path(path);
        assert_eq!(norm, PathBuf::from("/workspace/bar/file.txt"));
    }

    #[test]
    fn test_nonexistent_file_resolution() {
        let temp_dir = tempfile::tempdir().expect("failed to create temp dir");
        let ws_path = temp_dir.path().to_path_buf();

        let ws_service = WorkspaceService::new();
        ws_service.set_active_workspace(&ws_path);

        let target = ws_path.join("subdir").join("new_file.txt");
        let resolved = SecurityService::resolve_and_validate_path(&target, Some(&ws_service));
        assert!(resolved.is_ok());
    }

    #[test]
    fn test_outside_workspace_rejection() {
        let temp_dir1 = tempfile::tempdir().expect("failed to create temp dir");
        let temp_dir2 = tempfile::tempdir().expect("failed to create temp dir");

        let ws_service = WorkspaceService::new();
        ws_service.set_active_workspace(temp_dir1.path());

        let target = temp_dir2.path().join("outside.txt");
        let res = SecurityService::resolve_and_validate_path(&target, Some(&ws_service));
        assert!(res.is_err());
        match res.unwrap_err() {
            FalkonError::PathOutsideWorkspace { .. } => {}
            err => panic!("Expected PathOutsideWorkspace, got {:?}", err),
        }
    }
}
