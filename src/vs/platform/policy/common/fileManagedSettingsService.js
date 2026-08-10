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
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { equals } from "../../../base/common/objects.js";
import { isObject } from "../../../base/common/types.js";
import { FileOperationResult, IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { normalizeManagedSettings } from "./copilotManagedSettings.js";
const MANAGED_SETTINGS_MAX_FILE_SIZE = 1024 * 1024;
let FileManagedSettingsService = class extends Disposable {
  constructor(file, fileService, logService) {
    super();
    this.file = file;
    this.fileService = fileService;
    this.logService = logService;
    this._rawManagedSettings = {};
    this._managedSettings = {};
    this._onDidChangeRawManagedSettings = this._register(new Emitter());
    this.onDidChangeRawManagedSettings = this._onDidChangeRawManagedSettings.event;
    this._onDidChangeManagedSettings = this._register(new Emitter());
    this.onDidChangeManagedSettings = this._onDidChangeManagedSettings.event;
    this.throttledDelayer = this._register(new ThrottledDelayer(500));
    const onDidChangeFile = Event.filter(fileService.onDidFilesChange, (e) => e.affects(file));
    this._register(fileService.watch(file));
    this._register(onDidChangeFile(() => this.throttledDelayer.trigger(() => this.refresh())));
    this.throttledDelayer.trigger(() => this.refresh(), 0);
  }
  get rawManagedSettings() {
    return this._rawManagedSettings;
  }
  get managedSettings() {
    return this._managedSettings;
  }
  async refresh() {
    const previousRaw = this._rawManagedSettings;
    const previous = this._managedSettings;
    try {
      const content = await this.fileService.readFile(this.file, { limits: { size: MANAGED_SETTINGS_MAX_FILE_SIZE } });
      const parsed = JSON.parse(content.value.toString());
      if (isObject(parsed)) {
        this._rawManagedSettings = parsed;
        this._managedSettings = normalizeManagedSettings(
          parsed,
          (msg) => this.logService.warn(`[FileManagedSettingsService] ${msg}`)
        );
      } else {
        this.logService.warn("[FileManagedSettingsService] managed-settings.json is not a JSON object");
        this._rawManagedSettings = {};
        this._managedSettings = {};
      }
    } catch (error) {
      if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error("[FileManagedSettingsService] Failed to read managed-settings.json", error);
      }
      this._rawManagedSettings = {};
      this._managedSettings = {};
    }
    if (!equals(previousRaw, this._rawManagedSettings)) {
      this._onDidChangeRawManagedSettings.fire(this._rawManagedSettings);
    }
    if (!equals(previous, this._managedSettings)) {
      this._onDidChangeManagedSettings.fire(this._managedSettings);
    }
  }
};
FileManagedSettingsService = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], FileManagedSettingsService);
export {
  FileManagedSettingsService
};
