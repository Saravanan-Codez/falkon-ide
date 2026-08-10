/**
 * Tauri FileSystemProvider for VS Code Workbench
 * Bridges VS Code IFileSystemProvider calls to Tauri Rust native IPC commands
 */

export class TauriFileSystemProvider {
  constructor() {
    this.capabilities = 2; // FileReadWrite
    this.onDidChangeCapabilities = () => ({ dispose: () => {} });
    this.onDidChangeFile = () => ({ dispose: () => {} });
  }

  async stat(resource) {
    const pathStr = resource.path;
    try {
      const exists = await window.electronAPI.invoke('file-exists', pathStr);
      if (!exists) throw new Error('File not found');
      return {
        type: pathStr.endsWith('/') ? 2 : 1, // 2 = Directory, 1 = File
        ctime: Date.now(),
        mtime: Date.now(),
        size: 1024
      };
    } catch {
      throw new Error('File not found');
    }
  }

  async readdir(resource) {
    const pathStr = resource.path;
    try {
      const entries = await window.electronAPI.invoke('read-dir', pathStr);
      if (Array.isArray(entries)) {
        return entries.map(e => [e.name, e.isDirectory ? 2 : 1]);
      }
      return [];
    } catch {
      return [];
    }
  }

  async readFile(resource) {
    const pathStr = resource.path;
    const contentStr = await window.electronAPI.invoke('read-file', pathStr);
    const encoder = new TextEncoder();
    return encoder.encode(contentStr || '');
  }

  async writeFile(resource, content, options) {
    const pathStr = resource.path;
    const decoder = new TextDecoder();
    const textContent = decoder.decode(content);
    await window.electronAPI.invoke('write-file', pathStr, textContent);
  }

  async delete(resource, options) {
    const pathStr = resource.path;
    await window.electronAPI.invoke('delete-file', pathStr);
  }

  watch(resource, opts) {
    return { dispose: () => {} };
  }
}
