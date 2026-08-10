import { VSBuffer } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import * as resources from "../../../base/common/resources.js";
import { newWriteableStream } from "../../../base/common/stream.js";
import { FileChangeType, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, createFileSystemProviderError, isFileOpenForWriteOptions } from "./files.js";
class File {
  constructor(name) {
    this.type = FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}
class Directory {
  constructor(name) {
    this.type = FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = /* @__PURE__ */ new Map();
  }
}
class InMemoryFileSystemProvider extends Disposable {
  constructor() {
    super(...arguments);
    this.memoryFdCounter = 0;
    this.fdMemory = /* @__PURE__ */ new Map();
    this._onDidChangeCapabilities = this._register(new Emitter());
    this.onDidChangeCapabilities = this._onDidChangeCapabilities.event;
    this._capabilities = FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.FileOpenReadWriteClose | FileSystemProviderCapabilities.FileAppend | FileSystemProviderCapabilities.PathCaseSensitive;
    this.root = new Directory("");
    // --- manage file events
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
    this._bufferedChanges = [];
  }
  get capabilities() {
    return this._capabilities;
  }
  setReadOnly(readonly) {
    const isReadonly = !!(this._capabilities & FileSystemProviderCapabilities.Readonly);
    if (readonly !== isReadonly) {
      this._capabilities = FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.FileAppend | FileSystemProviderCapabilities.PathCaseSensitive | (readonly ? FileSystemProviderCapabilities.Readonly : 0);
      this._onDidChangeCapabilities.fire();
    }
  }
  // --- manage file metadata
  async stat(resource) {
    return this._lookup(resource, false);
  }
  async readdir(resource) {
    const entry = this._lookupAsDirectory(resource, false);
    const result = [];
    entry.entries.forEach((child, name) => result.push([name, child.type]));
    return result;
  }
  // --- manage file contents
  async readFile(resource) {
    const data = this._lookupAsFile(resource, false).data;
    if (data) {
      return data;
    }
    throw createFileSystemProviderError("file not found", FileSystemProviderErrorCode.FileNotFound);
  }
  readFileStream(resource) {
    const data = this._lookupAsFile(resource, false).data;
    const stream = newWriteableStream((data2) => VSBuffer.concat(data2.map((data3) => VSBuffer.wrap(data3))).buffer);
    stream.end(data);
    return stream;
  }
  async writeFile(resource, content, opts) {
    const basename = resources.basename(resource);
    const parent = this._lookupParentDirectory(resource);
    let entry = parent.entries.get(basename);
    if (entry instanceof Directory) {
      throw createFileSystemProviderError("file is directory", FileSystemProviderErrorCode.FileIsADirectory);
    }
    if (!entry && !opts.create) {
      throw createFileSystemProviderError("file not found", FileSystemProviderErrorCode.FileNotFound);
    }
    if (entry && opts.create && !opts.overwrite) {
      throw createFileSystemProviderError("file exists already", FileSystemProviderErrorCode.FileExists);
    }
    if (!entry) {
      entry = new File(basename);
      parent.entries.set(basename, entry);
      this._fireSoon({ type: FileChangeType.ADDED, resource });
    }
    entry.mtime = Date.now();
    if (opts.append) {
      entry.size += content.byteLength;
      const oldData = entry.data ?? new Uint8Array(0);
      const newData = new Uint8Array(oldData.byteLength + content.byteLength);
      newData.set(oldData, 0);
      newData.set(content, oldData.byteLength);
      entry.data = newData;
    } else {
      entry.size = content.byteLength;
      entry.data = content;
    }
    this._fireSoon({ type: FileChangeType.UPDATED, resource });
  }
  // file open/read/write/close
  open(resource, opts) {
    let file = this._lookup(resource, true);
    const write = isFileOpenForWriteOptions(opts);
    const append = write && !!opts.append;
    if (!file) {
      if (!write) {
        throw createFileSystemProviderError("file not found", FileSystemProviderErrorCode.FileNotFound);
      }
      const basename = resources.basename(resource);
      const parent = this._lookupParentDirectory(resource);
      file = new File(basename);
      file.data = new Uint8Array(0);
      parent.entries.set(basename, file);
      this._fireSoon({ type: FileChangeType.ADDED, resource });
    } else if (file instanceof Directory) {
      throw createFileSystemProviderError("file is directory", FileSystemProviderErrorCode.FileIsADirectory);
    }
    if (!file.data) {
      file.data = new Uint8Array(0);
    }
    const fd = this.memoryFdCounter++;
    this.fdMemory.set(fd, { file, resource, write, append });
    return Promise.resolve(fd);
  }
  close(fd) {
    const fdData = this.fdMemory.get(fd);
    if (fdData?.write) {
      fdData.file.mtime = Date.now();
      fdData.file.size = fdData.file.data?.byteLength ?? 0;
      this._fireSoon({ type: FileChangeType.UPDATED, resource: fdData.resource });
    }
    this.fdMemory.delete(fd);
    return Promise.resolve();
  }
  read(fd, pos, data, offset, length) {
    const fdData = this.fdMemory.get(fd);
    if (!fdData) {
      throw createFileSystemProviderError(`No file with that descriptor open`, FileSystemProviderErrorCode.Unavailable);
    }
    if (!fdData.file.data) {
      return Promise.resolve(0);
    }
    const toWrite = VSBuffer.wrap(fdData.file.data).slice(pos, pos + length);
    data.set(toWrite.buffer, offset);
    return Promise.resolve(toWrite.byteLength);
  }
  write(fd, pos, data, offset, length) {
    const fdData = this.fdMemory.get(fd);
    if (!fdData) {
      throw createFileSystemProviderError(`No file with that descriptor open`, FileSystemProviderErrorCode.Unavailable);
    }
    const toWrite = VSBuffer.wrap(data).slice(offset, offset + length);
    fdData.file.data ??= new Uint8Array(0);
    const writePos = fdData.append ? fdData.file.data.byteLength : pos;
    const endPos = writePos + toWrite.byteLength;
    if (endPos > fdData.file.data.byteLength) {
      const newData = new Uint8Array(endPos);
      newData.set(fdData.file.data, 0);
      fdData.file.data = newData;
    }
    fdData.file.data.set(toWrite.buffer, writePos);
    return Promise.resolve(toWrite.byteLength);
  }
  // --- manage files/folders
  async rename(from, to, opts) {
    if (!opts.overwrite && this._lookup(to, true)) {
      throw createFileSystemProviderError("file exists already", FileSystemProviderErrorCode.FileExists);
    }
    const entry = this._lookup(from, false);
    const oldParent = this._lookupParentDirectory(from);
    const newParent = this._lookupParentDirectory(to);
    const newName = resources.basename(to);
    oldParent.entries.delete(entry.name);
    entry.name = newName;
    newParent.entries.set(newName, entry);
    this._fireSoon(
      { type: FileChangeType.DELETED, resource: from },
      { type: FileChangeType.ADDED, resource: to }
    );
  }
  async delete(resource, opts) {
    const dirname = resources.dirname(resource);
    const basename = resources.basename(resource);
    const parent = this._lookupAsDirectory(dirname, false);
    if (parent.entries.delete(basename)) {
      parent.mtime = Date.now();
      parent.size -= 1;
      this._fireSoon({ type: FileChangeType.UPDATED, resource: dirname }, { resource, type: FileChangeType.DELETED });
    }
  }
  async mkdir(resource) {
    if (this._lookup(resource, true)) {
      throw createFileSystemProviderError("file exists already", FileSystemProviderErrorCode.FileExists);
    }
    const basename = resources.basename(resource);
    const dirname = resources.dirname(resource);
    const parent = this._lookupAsDirectory(dirname, false);
    const entry = new Directory(basename);
    parent.entries.set(entry.name, entry);
    parent.mtime = Date.now();
    parent.size += 1;
    this._fireSoon({ type: FileChangeType.UPDATED, resource: dirname }, { type: FileChangeType.ADDED, resource });
  }
  _lookup(uri, silent) {
    const parts = uri.path.split("/");
    let entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }
      if (!child) {
        if (!silent) {
          throw createFileSystemProviderError("file not found", FileSystemProviderErrorCode.FileNotFound);
        } else {
          return void 0;
        }
      }
      entry = child;
    }
    return entry;
  }
  _lookupAsDirectory(uri, silent) {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw createFileSystemProviderError("file not a directory", FileSystemProviderErrorCode.FileNotADirectory);
  }
  _lookupAsFile(uri, silent) {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw createFileSystemProviderError("file is a directory", FileSystemProviderErrorCode.FileIsADirectory);
  }
  _lookupParentDirectory(uri) {
    const dirname = resources.dirname(uri);
    return this._lookupAsDirectory(dirname, false);
  }
  watch(resource, opts) {
    return Disposable.None;
  }
  _fireSoon(...changes) {
    this._bufferedChanges.push(...changes);
    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }
    this._fireSoonHandle = setTimeout(() => {
      this._onDidChangeFile.fire(this._bufferedChanges);
      this._bufferedChanges.length = 0;
    }, 5);
  }
  dispose() {
    super.dispose();
    this.fdMemory.clear();
  }
}
export {
  InMemoryFileSystemProvider
};
