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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ProcessExplorerEditor } from "../browser/processExplorerEditor.js";
import { NativeProcessExplorerControl } from "./processExplorerControl.js";
let NativeProcessExplorerEditor = class extends ProcessExplorerEditor {
  constructor(group, telemetryService, themeService, storageService, instantiationService) {
    super(group, telemetryService, themeService, storageService, instantiationService);
  }
  createEditor(parent) {
    this.processExplorerControl = this._register(this.instantiationService.createInstance(NativeProcessExplorerControl, parent));
  }
};
NativeProcessExplorerEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService)
], NativeProcessExplorerEditor);
export {
  NativeProcessExplorerEditor
};
