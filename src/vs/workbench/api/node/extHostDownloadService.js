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
import { join } from "../../../base/common/path.js";
import { tmpdir } from "os";
import { generateUuid } from "../../../base/common/uuid.js";
import { IExtHostCommands } from "../common/extHostCommands.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { MainContext } from "../common/extHost.protocol.js";
import { URI } from "../../../base/common/uri.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
let ExtHostDownloadService = class extends Disposable {
  constructor(extHostRpc, commands) {
    super();
    const proxy = extHostRpc.getProxy(MainContext.MainThreadDownloadService);
    commands.registerCommand(false, "_workbench.downloadResource", async (resource) => {
      const location = URI.file(join(tmpdir(), generateUuid()));
      await proxy.$download(resource, location);
      return location;
    });
  }
};
ExtHostDownloadService = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostCommands)
], ExtHostDownloadService);
export {
  ExtHostDownloadService
};
