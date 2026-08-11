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
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProcessService } from "../../../../platform/process/common/process.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ProcessExplorerControl } from "../browser/processExplorerControl.js";
let NativeProcessExplorerControl = class extends ProcessExplorerControl {
  constructor(container, instantiationService, productService, contextMenuService, nativeHostService, commandService, processService, clipboardService) {
    super(instantiationService, productService, contextMenuService, commandService, clipboardService);
    this.nativeHostService = nativeHostService;
    this.processService = processService;
    this.create(container);
  }
  killProcess(pid, signal) {
    return this.nativeHostService.killProcess(pid, signal);
  }
  resolveProcesses() {
    return this.processService.resolveProcesses();
  }
};
NativeProcessExplorerControl = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, INativeHostService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IProcessService),
  __decorateParam(7, IClipboardService)
], NativeProcessExplorerControl);
export {
  NativeProcessExplorerControl
};
