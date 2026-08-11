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
import { localize } from "../../../../nls.js";
import { Schemas } from "../../../../base/common/network.js";
import { ExtensionInstallLocation, IExtensionManagementServerService } from "../common/extensionManagement.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { NativeRemoteExtensionManagementService } from "./remoteExtensionManagementService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { NativeExtensionManagementService } from "./nativeExtensionManagementService.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
let ExtensionManagementServerService = class extends Disposable {
  constructor(sharedProcessService, remoteAgentService, labelService, instantiationService) {
    super();
    this.remoteExtensionManagementServer = null;
    this.webExtensionManagementServer = null;
    const localExtensionManagementService = this._register(instantiationService.createInstance(NativeExtensionManagementService, sharedProcessService.getChannel("extensions")));
    this.localExtensionManagementServer = { extensionManagementService: localExtensionManagementService, id: "local", label: localize("local", "Local") };
    const remoteAgentConnection = remoteAgentService.getConnection();
    if (remoteAgentConnection) {
      const extensionManagementService = instantiationService.createInstance(NativeRemoteExtensionManagementService, remoteAgentConnection.getChannel("extensions"), this.localExtensionManagementServer);
      this.remoteExtensionManagementServer = {
        id: "remote",
        extensionManagementService,
        get label() {
          return labelService.getHostLabel(Schemas.vscodeRemote, remoteAgentConnection.remoteAuthority) || localize("remote", "Remote");
        }
      };
    }
  }
  getExtensionManagementServer(extension) {
    if (extension.location.scheme === Schemas.file) {
      return this.localExtensionManagementServer;
    }
    if (this.remoteExtensionManagementServer && extension.location.scheme === Schemas.vscodeRemote) {
      return this.remoteExtensionManagementServer;
    }
    throw new Error(`Invalid Extension ${extension.location}`);
  }
  getExtensionInstallLocation(extension) {
    const server = this.getExtensionManagementServer(extension);
    return server === this.remoteExtensionManagementServer ? ExtensionInstallLocation.Remote : ExtensionInstallLocation.Local;
  }
};
ExtensionManagementServerService = __decorateClass([
  __decorateParam(0, ISharedProcessService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IInstantiationService)
], ExtensionManagementServerService);
registerSingleton(IExtensionManagementServerService, ExtensionManagementServerService, InstantiationType.Delayed);
export {
  ExtensionManagementServerService
};
