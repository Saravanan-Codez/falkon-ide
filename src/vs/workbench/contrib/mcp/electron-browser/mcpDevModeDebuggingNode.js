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
import { timeout } from "../../../../base/common/async.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IDebugService } from "../../debug/common/debug.js";
import { McpDevModeDebugging } from "../common/mcpDevMode.js";
let McpDevModeDebuggingNode = class extends McpDevModeDebugging {
  constructor(debugService, commandService, _nativeHostService) {
    super(debugService, commandService);
    this._nativeHostService = _nativeHostService;
  }
  async ensureListeningOnPort(port) {
    const deadline = Date.now() + 3e4;
    while (await this._nativeHostService.isPortFree(port) && Date.now() < deadline) {
      await timeout(50);
    }
  }
  getDebugPort() {
    return this._nativeHostService.findFreePort(
      5e3,
      10,
      5e3,
      2048
      /* skip 2048 ports between attempts */
    );
  }
};
McpDevModeDebuggingNode = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, INativeHostService)
], McpDevModeDebuggingNode);
export {
  McpDevModeDebuggingNode
};
