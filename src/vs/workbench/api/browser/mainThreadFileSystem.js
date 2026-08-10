var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Emitter, Event } from "../../../base/common/event.js";
import { toDisposable, DisposableStore, DisposableMap } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { IFileService, FileType, FileOperationError, FileOperationResult, FileSystemProviderErrorCode, FilePermission, toFileSystemProviderErrorCode } from "../../../platform/files/common/files.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { VSBuffer } from "../../../base/common/buffer.js";
let MainThreadFileSystem = class {
  constructor(extHostContext, _fileService) {
    this._fileService = _fileService;
    this._fileProvider = new DisposableMap();
    this._disposables = new DisposableStore();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostFileSystem);
    const infoProxy = extHostContext.getProxy(ExtHostContext.ExtHostFileSystemInfo);
    for (const entry of _fileService.listCapabilities()) {
      infoProxy.$acceptProviderInfos(URI.from({ scheme: entry.scheme, path: "/dummy" }), entry.capabilities);
    }
    this._disposables.add(_fileService.onDidChangeFileSystemProviderRegistrations((e) => infoProxy.$acceptProviderInfos(URI.from({ scheme: e.scheme, path: "/dummy" }), e.provider?.capabilities ?? null)));
    this._disposables.add(_fileService.onDidChangeFileSystemProviderCapabilities((e) => infoProxy.$acceptProviderInfos(URI.from({ scheme: e.scheme, path: "/dummy" }), e.provider.capabilities)));
  }
  dispose() {
    this._disposables.dispose();
    this._fileProvider.dispose();
  }
  async $registerFileSystemProvider(handle, scheme, capabilities, readonlyMessage) {
    this._fileProvider.set(handle, new RemoteFileSystemProvider(this._fileService, scheme, capabilities, readonlyMessage, handle, this._proxy));
  }
  $unregisterProvider(handle) {
    this._fileProvider.deleteAndDispose(handle);
  }
  $onFileSystemChange(handle, changes) {
    const fileProvider = this._fileProvider.get(handle);
    if (!fileProvider) {
      throw new Error("Unknown file provider");
    }
    fileProvider.$onFileSystemChange(changes);
  }
  // --- consumer fs, vscode.workspace.fs
  async $stat(uri) {
    try {
      const stat = await this._fileService.stat(URI.revive(uri));
      return {
        ctime: stat.ctime,
        mtime: stat.mtime,
        size: stat.size,
        permissions: stat.readonly ? FilePermission.Readonly : void 0,
        type: MainThreadFileSystem._asFileType(stat)
      };
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  async $readdir(uri) {
    try {
      const stat = await this._fileService.resolve(URI.revive(uri), { resolveMetadata: false });
      if (!stat.isDirectory) {
        const err = new Error(stat.name);
        err.name = FileSystemProviderErrorCode.FileNotADirectory;
        throw err;
      }
      return !stat.children ? [] : stat.children.map((child) => [child.name, MainThreadFileSystem._asFileType(child)]);
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  static _asFileType(stat) {
    let res = 0;
    if (stat.isFile) {
      res += FileType.File;
    } else if (stat.isDirectory) {
      res += FileType.Directory;
    }
    if (stat.isSymbolicLink) {
      res += FileType.SymbolicLink;
    }
    return res;
  }
  async $readFile(uri) {
    try {
      const file = await this._fileService.readFile(URI.revive(uri));
      return file.value;
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  async $writeFile(uri, content) {
    try {
      await this._fileService.writeFile(URI.revive(uri), content);
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  async $rename(source, target, opts) {
    try {
      await this._fileService.move(URI.revive(source), URI.revive(target), opts.overwrite);
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  async $copy(source, target, opts) {
    try {
      await this._fileService.copy(URI.revive(source), URI.revive(target), opts.overwrite);
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  async $mkdir(uri) {
    try {
      await this._fileService.createFolder(URI.revive(uri));
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  async $delete(uri, opts) {
    try {
      return await this._fileService.del(URI.revive(uri), opts);
    } catch (err) {
      return MainThreadFileSystem._handleError(err);
    }
  }
  static _handleError(err) {
    if (err instanceof FileOperationError) {
      switch (err.fileOperationResult) {
        case FileOperationResult.FILE_NOT_FOUND:
          err.name = FileSystemProviderErrorCode.FileNotFound;
          break;
        case FileOperationResult.FILE_IS_DIRECTORY:
          err.name = FileSystemProviderErrorCode.FileIsADirectory;
          break;
        case FileOperationResult.FILE_PERMISSION_DENIED:
          err.name = FileSystemProviderErrorCode.NoPermissions;
          break;
        case FileOperationResult.FILE_MOVE_CONFLICT:
          err.name = FileSystemProviderErrorCode.FileExists;
          break;
      }
    } else if (err instanceof Error) {
      const code = toFileSystemProviderErrorCode(err);
      if (code !== FileSystemProviderErrorCode.Unknown) {
        err.name = code;
      }
    }
    throw err;
  }
  $ensureActivation(scheme) {
    return this._fileService.activateProvider(scheme);
  }
};
MainThreadFileSystem = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadFileSystem),
  __decorateParam(1, IFileService)
], MainThreadFileSystem);
class RemoteFileSystemProvider {
  constructor(fileService, scheme, capabilities, readOnlyMessage, _handle, _proxy) {
    this.readOnlyMessage = readOnlyMessage;
    this._handle = _handle;
    this._proxy = _proxy;
    this._onDidChange = new Emitter();
    this.onDidChangeFile = this._onDidChange.event;
    this.onDidChangeCapabilities = Event.None;
    this.capabilities = capabilities;
    this._registration = fileService.registerProvider(scheme, this);
  }
  dispose() {
    this._registration.dispose();
    this._onDidChange.dispose();
  }
  watch(resource, opts) {
    const session = Math.random();
    this._proxy.$watch(this._handle, session, resource, opts);
    return toDisposable(() => {
      this._proxy.$unwatch(this._handle, session);
    });
  }
  $onFileSystemChange(changes) {
    this._onDidChange.fire(changes.map(RemoteFileSystemProvider._createFileChange));
  }
  static _createFileChange(dto) {
    return { resource: URI.revive(dto.resource), type: dto.type };
  }
  // --- forwarding calls
  async stat(resource) {
    try {
      return await this._proxy.$stat(this._handle, resource);
    } catch (err) {
      throw err;
    }
  }
  async readFile(resource) {
    const buffer = await this._proxy.$readFile(this._handle, resource);
    return buffer.buffer;
  }
  writeFile(resource, content, opts) {
    return this._proxy.$writeFile(this._handle, resource, VSBuffer.wrap(content), opts);
  }
  delete(resource, opts) {
    return this._proxy.$delete(this._handle, resource, opts);
  }
  mkdir(resource) {
    return this._proxy.$mkdir(this._handle, resource);
  }
  readdir(resource) {
    return this._proxy.$readdir(this._handle, resource);
  }
  rename(resource, target, opts) {
    return this._proxy.$rename(this._handle, resource, target, opts);
  }
  copy(resource, target, opts) {
    return this._proxy.$copy(this._handle, resource, target, opts);
  }
  open(resource, opts) {
    return this._proxy.$open(this._handle, resource, opts);
  }
  close(fd) {
    return this._proxy.$close(this._handle, fd);
  }
  async read(fd, pos, data, offset, length) {
    const readData = await this._proxy.$read(this._handle, fd, pos, length);
    data.set(readData.buffer, offset);
    return readData.byteLength;
  }
  write(fd, pos, data, offset, length) {
    return this._proxy.$write(this._handle, fd, pos, VSBuffer.wrap(data).slice(offset, offset + length));
  }
}
export {
  MainThreadFileSystem
};
