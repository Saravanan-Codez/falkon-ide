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
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { BrowserProcessExplorerControl } from "./processExplorerControl.js";
let ProcessExplorerEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService) {
    super(ProcessExplorerEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.processExplorerControl = void 0;
  }
  static {
    this.ID = "workbench.editor.processExplorer";
  }
  createEditor(parent) {
    this.processExplorerControl = this._register(this.instantiationService.createInstance(BrowserProcessExplorerControl, parent));
  }
  focus() {
    this.processExplorerControl?.focus();
  }
  layout(dimension) {
    this.processExplorerControl?.layout(dimension);
  }
};
ProcessExplorerEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService)
], ProcessExplorerEditor);
export {
  ProcessExplorerEditor
};
