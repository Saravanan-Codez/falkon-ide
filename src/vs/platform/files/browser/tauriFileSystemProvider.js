import { VSBuffer } from "../../../base/common/buffer.js";
import { Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { newWriteableStream } from "../../../base/common/stream.js";
import {
  createFileSystemProviderError,
  FileSystemProviderCapabilities,
  FileSystemProviderErrorCode,
  FileType
} from "../common/files.js";
class TauriFileSystemProvider extends Disposable {
  constructor(logService) {
    super();
    this.logService = logService;
    this.onDidChangeCapabilities = Event.None;
    this.onDidChangeFile = Event.None;
    this.onDidWatchError = Event.None;
  }
  get capabilities() {
    if (!this._capabilities) {
      this._capabilities = FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.FileReadStream | FileSystemProviderCapabilities.FileFolderCopy | FileSystemProviderCapabilities.FileWriteUnlock;
      if (isLinux) {
        this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
      }
    }
    return this._capabilities;
  }
  get tauriFs() {
    const fs = globalThis.__tauri_fs__ || window.__tauri_fs__;
    if (!fs) {
      throw createFileSystemProviderError("Tauri File System Bridge is not initialized", FileSystemProviderErrorCode.Unavailable);
    }
    return fs;
  }
  uriToPath(resource) {
    let path = decodeURIComponent(resource.path || resource.fsPath || "");
    if (isWindows) {
      if (path.startsWith("/")) {
        path = path.slice(1);
      }
      path = path.replace(/\//g, "\\");
    }
    return path;
  }
  //#region File Metadata Resolving
  async stat(resource) {
    const path = this.uriToPath(resource);
    try {
      const stat = await this.tauriFs.stat(path);
      if (!stat) {
        throw createFileSystemProviderError(`File not found: ${path}`, FileSystemProviderErrorCode.FileNotFound);
      }
      let type = FileType.File;
      if (stat.isDirectory) {
        type = FileType.Directory;
      } else if (stat.isSymlink) {
        type = FileType.SymbolicLink;
      }
      return {
        type,
        ctime: stat.ctime ?? 0,
        mtime: stat.mtime ?? 0,
        size: stat.size ?? 0
      };
    } catch (error) {
      throw createFileSystemProviderError(`Unable to stat file: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  async readdir(resource) {
    const path = this.uriToPath(resource);
    try {
      const entries = await this.tauriFs.readDir(path);
      if (!entries) {
        return [];
      }
      return entries.map((entry) => [
        entry.name,
        entry.isDirectory ? FileType.Directory : entry.isSymlink ? FileType.SymbolicLink : FileType.File
      ]);
    } catch (error) {
      throw createFileSystemProviderError(`Unable to read directory: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  //#endregion
  //#region File Reading/Writing
  async readFile(resource) {
    const path = this.uriToPath(resource);
    try {
      const content = await this.tauriFs.readFile(path);
      if (content === null || content === void 0) {
        throw createFileSystemProviderError(`File not found: ${path}`, FileSystemProviderErrorCode.FileNotFound);
      }
      return new TextEncoder().encode(content);
    } catch (error) {
      throw createFileSystemProviderError(`Unable to read file: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  readFileStream(resource, opts, token) {
    const stream = newWriteableStream((data) => VSBuffer.concat(data.map((d) => VSBuffer.wrap(d))).buffer);
    (async () => {
      try {
        let buffer = await this.readFile(resource);
        if (typeof opts.position === "number") {
          buffer = buffer.slice(opts.position);
        }
        if (typeof opts.length === "number") {
          buffer = buffer.slice(0, opts.length);
        }
        stream.end(buffer);
      } catch (error) {
        stream.error(error);
        stream.end();
      }
    })();
    return stream;
  }
  async writeFile(resource, content, opts) {
    const path = this.uriToPath(resource);
    try {
      const text = new TextDecoder("utf-8").decode(content);
      const ok = await this.tauriFs.writeFile(path, text);
      if (!ok) {
        throw createFileSystemProviderError(`Failed to write file: ${path}`, FileSystemProviderErrorCode.NoPermissions);
      }
    } catch (error) {
      throw createFileSystemProviderError(`Unable to write file: ${path} (${error})`, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async mkdir(resource) {
    const path = this.uriToPath(resource);
    try {
      await this.tauriFs.mkdir(path);
    } catch (error) {
      throw createFileSystemProviderError(`Unable to create folder: ${path} (${error})`, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async delete(resource, opts) {
    const path = this.uriToPath(resource);
    try {
      await this.tauriFs.delete(path);
    } catch (error) {
      throw createFileSystemProviderError(`Unable to delete file: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  async rename(from, to, opts) {
    const fromPath = this.uriToPath(from);
    const toPath = this.uriToPath(to);
    try {
      await this.tauriFs.rename(fromPath, toPath);
    } catch (error) {
      throw createFileSystemProviderError(`Unable to rename from ${fromPath} to ${toPath} (${error})`, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async copy(from, to, opts) {
    const fromPath = this.uriToPath(from);
    const toPath = this.uriToPath(to);
    try {
      const content = await this.tauriFs.readFile(fromPath);
      if (content !== null && content !== void 0) {
        await this.tauriFs.writeFile(toPath, content);
      }
    } catch (error) {
      throw createFileSystemProviderError(`Unable to copy from ${fromPath} to ${toPath} (${error})`, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  //#endregion
  watch(resource, opts) {
    return { dispose: () => {
    } };
  }
}
export {
  TauriFileSystemProvider
};
