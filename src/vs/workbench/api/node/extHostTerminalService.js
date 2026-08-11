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
import { generateUuid } from "../../../base/common/uuid.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { BaseExtHostTerminalService, ExtHostTerminal } from "../common/extHostTerminalService.js";
import { IExtHostCommands } from "../common/extHostCommands.js";
let ExtHostTerminalService = class extends BaseExtHostTerminalService {
  constructor(extHostCommands, extHostRpc) {
    super(true, extHostCommands, extHostRpc);
  }
  createTerminal(name, shellPath, shellArgs) {
    return this.createTerminalFromOptions({ name, shellPath, shellArgs });
  }
  createTerminalFromOptions(options, internalOptions) {
    const terminal = new ExtHostTerminal(this._proxy, generateUuid(), options, options.name);
    this._terminals.push(terminal);
    terminal.create(options, this._serializeParentTerminal(options, internalOptions));
    return terminal.value;
  }
};
ExtHostTerminalService = __decorateClass([
  __decorateParam(0, IExtHostCommands),
  __decorateParam(1, IExtHostRpcService)
], ExtHostTerminalService);
export {
  ExtHostTerminalService
};
