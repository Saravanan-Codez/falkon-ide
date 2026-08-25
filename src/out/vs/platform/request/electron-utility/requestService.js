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
import { net } from "electron";
import { RequestService as NodeRequestService } from "../node/requestService.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { ILogService } from "../../log/common/log.js";
function getRawRequest(options) {
  return net.request;
}
let RequestService = class extends NodeRequestService {
  constructor(configurationService, environmentService, logService) {
    super("local", configurationService, environmentService, logService);
  }
  request(options, token) {
    return super.request({ ...options || {}, getRawRequest, isChromiumNetwork: true }, token);
  }
};
RequestService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, INativeEnvironmentService),
  __decorateParam(2, ILogService)
], RequestService);
export {
  RequestService
};
