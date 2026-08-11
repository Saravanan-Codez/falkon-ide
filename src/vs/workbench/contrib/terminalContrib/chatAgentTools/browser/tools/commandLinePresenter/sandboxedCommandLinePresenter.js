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
import { ITerminalSandboxService } from "../../../common/terminalSandboxService.js";
let SandboxedCommandLinePresenter = class {
  constructor(_sandboxService) {
    this._sandboxService = _sandboxService;
  }
  async present(options) {
    if (!await this._sandboxService.isEnabled()) {
      return void 0;
    }
    return {
      commandLine: options.commandLine.forDisplay,
      processOtherPresenters: true
    };
  }
};
SandboxedCommandLinePresenter = __decorateClass([
  __decorateParam(0, ITerminalSandboxService)
], SandboxedCommandLinePresenter);
export {
  SandboxedCommandLinePresenter
};
