/**
 * VS Code IFileSystemProvider implementation backed by Tauri IPC.
 *
 * This registers a local disk file system provider for the `file://` URI scheme
 * inside the VS Code workbench. Without this, the Explorer, editor tabs, and all
 * file operations are non-functional (VS Code web mode only has IndexedDB + HTMLFileSystemAccess).
 */

const PATH_SEP = navigator.platform.startsWith('Win') ? '\\' : '/';

export function uriToPath(uri) {
  // VS Code file URIs on Windows: file:///C:/path -> C:\path
  // On POSIX: file:///home/user -> /home/user
  let path = decodeURIComponent(uri.path || uri.fsPath || '');
  if (navigator.platform.startsWith('Win')) {
    if (path.startsWith('/')) {
      path = path.slice(1);
    }
    path = path.replace(/\//g, '\\');
  }
  return path;
}

export function pathToUri(filePath) {
  let normalized = filePath.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return {
    scheme: 'file',
    path: normalized,
    authority: '',
    query: '',
    fragment: ''
  };
}

/**
 * Converts Tauri stat result to VS Code FileStat shape
 */
function toFileStat(stat) {
  let fileType = 1; // FileType.File
  if (stat.isDirectory) {
    fileType = 2; // FileType.Directory
  } else if (stat.isSymlink) {
    fileType = 64; // FileType.SymbolicLink
  }
  return {
    type: fileType,
    ctime: stat.ctime ?? Date.now(),
    mtime: stat.mtime ?? Date.now(),
    size: stat.size ?? 0,
    permissions: undefined
  };
}

/**
 * VS Code FileSystemError codes
 */
const FileSystemError = {
  FileNotFound: (uri) => Object.assign(new Error(`File not found (${uri})`), { name: 'EntryNotFound (FileSystemError)' }),
  FileExists: (uri) => Object.assign(new Error(`File exists (${uri})`), { name: 'EntryExists (FileSystemError)' }),
  FileNotADirectory: (uri) => Object.assign(new Error(`File not a directory (${uri})`), { name: 'EntryNotADirectory (FileSystemError)' }),
  FileIsADirectory: (uri) => Object.assign(new Error(`File is a directory (${uri})`), { name: 'EntryIsADirectory (FileSystemError)' }),
  NoPermissions: (uri) => Object.assign(new Error(`No permissions (${uri})`), { name: 'NoPermissions (FileSystemError)' }),
  Unavailable: (uri) => Object.assign(new Error(`File system unavailable (${uri})`), { name: 'Unavailable (FileSystemError)' }),
};

export class TauriFileSystemProvider {
  constructor() {
    this._watchers = new Map();
    // Capabilities: FileReadWrite (2) | FileFolderCopy (8) | PathCaseSensitive (1024) | FileWriteUnlock (8192)
    this.capabilities = 2 | 8 | 1024 | 8192;
    this.onDidChangeCapabilities = { event: () => ({ dispose: () => {} }) };
    this.onDidChangeFile = { fire: () => {}, event: () => ({ dispose: () => {} }) };
    this.onDidWatchError = { fire: () => {}, event: () => ({ dispose: () => {} }) };
  }

  async stat(resource) {
    const path = uriToPath(resource);
    try {
      const stat = await window.__tauri_fs__.stat(path);
      if (!stat) throw FileSystemError.FileNotFound(path);
      return toFileStat(stat);
    } catch (e) {
      throw FileSystemError.FileNotFound(path);
    }
  }

  async readdir(resource) {
    const path = uriToPath(resource);
    try {
      const entries = await window.__tauri_fs__.readDir(path);
      if (!entries) return [];
      return entries.map(e => [
        e.name,
        e.isDirectory ? 2 : e.isSymlink ? 64 : 1
      ]);
    } catch (e) {
      throw FileSystemError.FileNotFound(path);
    }
  }

  async readFile(resource) {
    const path = uriToPath(resource);
    try {
      const content = await window.__tauri_fs__.readFile(path);
      if (content === null || content === undefined) {
        throw FileSystemError.FileNotFound(path);
      }
      return new TextEncoder().encode(content);
    } catch (e) {
      throw FileSystemError.FileNotFound(path);
    }
  }

  async writeFile(resource, content, opts) {
    const path = uriToPath(resource);
    try {
      const text = new TextDecoder('utf-8').decode(content);
      await window.__tauri_fs__.writeFile(path, text);
    } catch (e) {
      throw FileSystemError.NoPermissions(path);
    }
  }

  async mkdir(resource) {
    const path = uriToPath(resource);
    try {
      await window.__tauri_fs__.mkdir(path);
    } catch (e) {
      throw FileSystemError.NoPermissions(path);
    }
  }

  async delete(resource, opts) {
    const path = uriToPath(resource);
    try {
      await window.__tauri_fs__.delete(path);
    } catch (e) {
      throw FileSystemError.FileNotFound(path);
    }
  }

  async rename(from, to, opts) {
    const fromPath = uriToPath(from);
    const toPath = uriToPath(to);
    try {
      await window.__tauri_fs__.rename(fromPath, toPath);
    } catch (e) {
      throw FileSystemError.NoPermissions(fromPath);
    }
  }

  async copy(from, to, opts) {
    const fromPath = uriToPath(from);
    const toPath = uriToPath(to);
    try {
      const content = await window.__tauri_fs__.readFile(fromPath);
      if (content !== null && content !== undefined) {
        await window.__tauri_fs__.writeFile(toPath, content);
      }
    } catch (e) {
      throw FileSystemError.NoPermissions(toPath);
    }
  }

  watch(resource, opts) {
    return { dispose: () => {} };
  }
}
