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
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
import { ILogService } from "../../../platform/log/common/log.js";
let MainThreadClipboard = class {
  constructor(_context, _clipboardService, _logService) {
    this._clipboardService = _clipboardService;
    this._logService = _logService;
  }
  dispose() {
  }
  $readText() {
    this._logService.trace("MainThreadClipboard#readText");
    const readText = this._clipboardService.readText();
    return readText;
  }
  $writeText(value) {
    this._logService.trace("MainThreadClipboard#writeText with text.length : ", value.length);
    return this._clipboardService.writeText(value);
  }
};
MainThreadClipboard = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadClipboard),
  __decorateParam(1, IClipboardService),
  __decorateParam(2, ILogService)
], MainThreadClipboard);
export {
  MainThreadClipboard
};
