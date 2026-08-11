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
import { IExtHostConsumerFileSystem } from "../common/extHostFileSystemConsumer.js";
import { Schemas } from "../../../base/common/network.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { DiskFileSystemProvider } from "../../../platform/files/node/diskFileSystemProvider.js";
import { FilePermission } from "../../../platform/files/common/files.js";
import { isLinux } from "../../../base/common/platform.js";
let ExtHostDiskFileSystemProvider = class {
  constructor(extHostConsumerFileSystem, logService) {
    extHostConsumerFileSystem.addFileSystemProvider(Schemas.file, new DiskFileSystemProviderAdapter(logService), { isCaseSensitive: isLinux });
  }
};
ExtHostDiskFileSystemProvider = __decorateClass([
  __decorateParam(0, IExtHostConsumerFileSystem),
  __decorateParam(1, ILogService)
], ExtHostDiskFileSystemProvider);
class DiskFileSystemProviderAdapter {
  constructor(logService) {
    this.impl = new DiskFileSystemProvider(logService);
  }
  async stat(uri) {
    const stat = await this.impl.stat(uri);
    return {
      type: stat.type,
      ctime: stat.ctime,
      mtime: stat.mtime,
      size: stat.size,
      permissions: stat.permissions === FilePermission.Readonly ? 1 : void 0
    };
  }
  readDirectory(uri) {
    return this.impl.readdir(uri);
  }
  createDirectory(uri) {
    return this.impl.mkdir(uri);
  }
  readFile(uri) {
    return this.impl.readFile(uri);
  }
  writeFile(uri, content, options) {
    return this.impl.writeFile(uri, content, { ...options, unlock: false, atomic: false });
  }
  delete(uri, options) {
    return this.impl.delete(uri, { ...options, useTrash: false, atomic: false });
  }
  rename(oldUri, newUri, options) {
    return this.impl.rename(oldUri, newUri, options);
  }
  copy(source, destination, options) {
    return this.impl.copy(source, destination, options);
  }
  // --- Not Implemented ---
  get onDidChangeFile() {
    throw new Error("Method not implemented.");
  }
  watch(uri, options) {
    throw new Error("Method not implemented.");
  }
}
export {
  ExtHostDiskFileSystemProvider
};
