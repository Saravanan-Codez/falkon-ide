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
import { ThrottledDelayer } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { isUndefined, isUndefinedOrNull } from "../../../base/common/types.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { FileOperationResult, IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
var SaveStrategy = /* @__PURE__ */ ((SaveStrategy2) => {
  SaveStrategy2[SaveStrategy2["IMMEDIATE"] = 0] = "IMMEDIATE";
  SaveStrategy2[SaveStrategy2["DELAYED"] = 1] = "DELAYED";
  return SaveStrategy2;
})(SaveStrategy || {});
class FileStorage extends Disposable {
  constructor(storagePath, saveStrategy, logService, fileService) {
    super();
    this.storagePath = storagePath;
    this.logService = logService;
    this.fileService = fileService;
    this.storage = /* @__PURE__ */ Object.create(null);
    this.lastSavedStorageContents = "";
    this.initializing = void 0;
    this.closing = void 0;
    this.flushDelayer = this._register(new ThrottledDelayer(
      saveStrategy === 0 /* IMMEDIATE */ ? 0 : 100
      /* buffer saves over a short time */
    ));
  }
  init() {
    if (!this.initializing) {
      this.initializing = this.doInit();
    }
    return this.initializing;
  }
  async doInit() {
    try {
      this.lastSavedStorageContents = (await this.fileService.readFile(this.storagePath)).value.toString();
      this.storage = JSON.parse(this.lastSavedStorageContents);
    } catch (error) {
      if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(error);
      }
    }
  }
  getItem(key, defaultValue) {
    const res = this.storage[key];
    if (isUndefinedOrNull(res)) {
      return defaultValue;
    }
    return res;
  }
  setItem(key, data) {
    this.setItems([{ key, data }]);
  }
  setItems(items) {
    let save = false;
    for (const { key, data } of items) {
      if (this.storage[key] === data) {
        continue;
      }
      if (isUndefinedOrNull(data)) {
        if (!isUndefined(this.storage[key])) {
          this.storage[key] = void 0;
          save = true;
        }
      } else {
        this.storage[key] = data;
        save = true;
      }
    }
    if (save) {
      this.save();
    }
  }
  removeItem(key) {
    if (!isUndefined(this.storage[key])) {
      this.storage[key] = void 0;
      this.save();
    }
  }
  async save() {
    if (this.closing) {
      return;
    }
    return this.flushDelayer.trigger(() => this.doSave());
  }
  async doSave() {
    if (!this.initializing) {
      return;
    }
    await this.initializing;
    const serializedDatabase = JSON.stringify(this.storage, null, 4);
    if (serializedDatabase === this.lastSavedStorageContents) {
      return;
    }
    try {
      await this.fileService.writeFile(this.storagePath, VSBuffer.fromString(serializedDatabase), { atomic: { postfix: ".vsctmp" } });
      this.lastSavedStorageContents = serializedDatabase;
    } catch (error) {
      this.logService.error(error);
    }
  }
  async close() {
    if (!this.closing) {
      this.closing = this.flushDelayer.trigger(
        () => this.doSave(),
        0
        /* as soon as possible */
      );
    }
    return this.closing;
  }
}
let StateReadonlyService = class extends Disposable {
  constructor(saveStrategy, environmentService, logService, fileService) {
    super();
    this.fileStorage = this._register(new FileStorage(environmentService.stateResource, saveStrategy, logService, fileService));
  }
  async init() {
    await this.fileStorage.init();
  }
  getItem(key, defaultValue) {
    return this.fileStorage.getItem(key, defaultValue);
  }
};
StateReadonlyService = __decorateClass([
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IFileService)
], StateReadonlyService);
class StateService extends StateReadonlyService {
  setItem(key, data) {
    this.fileStorage.setItem(key, data);
  }
  setItems(items) {
    this.fileStorage.setItems(items);
  }
  removeItem(key) {
    this.fileStorage.removeItem(key);
  }
  close() {
    return this.fileStorage.close();
  }
}
export {
  FileStorage,
  SaveStrategy,
  StateReadonlyService,
  StateService
};
