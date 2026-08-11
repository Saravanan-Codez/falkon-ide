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
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IExtHostConsumerFileSystem } from "./extHostFileSystemConsumer.js";
import { URI } from "../../../base/common/uri.js";
const IExtensionStoragePaths = createDecorator("IExtensionStoragePaths");
let ExtensionStoragePaths = class {
  constructor(initData, _logService, _extHostFileSystem) {
    this._logService = _logService;
    this._extHostFileSystem = _extHostFileSystem;
    this._workspace = initData.workspace ?? void 0;
    this._environment = initData.environment;
    this.whenReady = this._getOrCreateWorkspaceStoragePath().then((value) => this._value = value);
  }
  async _getWorkspaceStorageURI(storageName) {
    return URI.joinPath(this._environment.workspaceStorageHome, storageName);
  }
  async _getOrCreateWorkspaceStoragePath() {
    if (!this._workspace) {
      return Promise.resolve(void 0);
    }
    const storageName = this._workspace.id;
    const storageUri = await this._getWorkspaceStorageURI(storageName);
    try {
      await this._extHostFileSystem.value.stat(storageUri);
      this._logService.trace("[ExtHostStorage] storage dir already exists", storageUri);
      return storageUri;
    } catch {
    }
    try {
      this._logService.trace("[ExtHostStorage] creating dir and metadata-file", storageUri);
      await this._extHostFileSystem.value.createDirectory(storageUri);
      await this._extHostFileSystem.value.writeFile(
        URI.joinPath(storageUri, "meta.json"),
        new TextEncoder().encode(JSON.stringify({
          id: this._workspace.id,
          configuration: URI.revive(this._workspace.configuration)?.toString(),
          name: this._workspace.name
        }, void 0, 2))
      );
      return storageUri;
    } catch (e) {
      this._logService.error("[ExtHostStorage]", e);
      return void 0;
    }
  }
  workspaceValue(extension) {
    if (this._value) {
      return URI.joinPath(this._value, extension.identifier.value);
    }
    return void 0;
  }
  globalValue(extension) {
    return URI.joinPath(this._environment.globalStorageHome, extension.identifier.value.toLowerCase());
  }
  onWillDeactivateAll() {
  }
};
ExtensionStoragePaths = __decorateClass([
  __decorateParam(0, IExtHostInitDataService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostConsumerFileSystem)
], ExtensionStoragePaths);
export {
  ExtensionStoragePaths,
  IExtensionStoragePaths
};
