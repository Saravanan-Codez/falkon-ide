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
import { ILogService } from "../../log/common/log.js";
import { AgentHostClientConnectionKind } from "../common/agentHostTelemetry.js";
import { RelayTransport } from "../common/relayTransport.js";
let WSLRelayTransport = class extends RelayTransport {
  constructor(connectionId, wslService, ahpLogger, logService) {
    super(connectionId, wslService, ahpLogger, logService, "[WSLRelayTransport]", AgentHostClientConnectionKind.WSL);
  }
};
WSLRelayTransport = __decorateClass([
  __decorateParam(3, ILogService)
], WSLRelayTransport);
export {
  WSLRelayTransport
};
