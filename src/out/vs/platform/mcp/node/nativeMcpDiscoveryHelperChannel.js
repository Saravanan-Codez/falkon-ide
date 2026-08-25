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
import { transformOutgoingURIs } from "../../../base/common/uriIpc.js";
import { INativeMcpDiscoveryHelperService } from "../common/nativeMcpDiscoveryHelper.js";
let NativeMcpDiscoveryHelperChannel = class {
  constructor(getUriTransformer, nativeMcpDiscoveryHelperService) {
    this.getUriTransformer = getUriTransformer;
    this.nativeMcpDiscoveryHelperService = nativeMcpDiscoveryHelperService;
  }
  listen(context, event) {
    throw new Error("Invalid listen");
  }
  async call(context, command, args) {
    const uriTransformer = this.getUriTransformer?.(context);
    switch (command) {
      case "load": {
        const result = await this.nativeMcpDiscoveryHelperService.load();
        return uriTransformer ? transformOutgoingURIs(result, uriTransformer) : result;
      }
    }
    throw new Error("Invalid call");
  }
};
NativeMcpDiscoveryHelperChannel = __decorateClass([
  __decorateParam(1, INativeMcpDiscoveryHelperService)
], NativeMcpDiscoveryHelperChannel);
export {
  NativeMcpDiscoveryHelperChannel
};
