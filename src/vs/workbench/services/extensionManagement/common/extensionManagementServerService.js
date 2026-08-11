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
import { ExtensionInstallLocation, IExtensionManagementServerService } from "./extensionManagement.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { Schemas } from "../../../../base/common/network.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WebExtensionManagementService } from "./webExtensionManagementService.js";
import { RemoteExtensionManagementService } from "./remoteExtensionManagementService.js";
let ExtensionManagementServerService = class {
  constructor(remoteAgentService, labelService, instantiationService) {
    this.localExtensionManagementServer = null;
    this.remoteExtensionManagementServer = null;
    this.webExtensionManagementServer = null;
    const remoteAgentConnection = remoteAgentService.getConnection();
    if (remoteAgentConnection) {
      const extensionManagementService = instantiationService.createInstance(RemoteExtensionManagementService, remoteAgentConnection.getChannel("extensions"));
      this.remoteExtensionManagementServer = {
        id: "remote",
        extensionManagementService,
        get label() {
          return labelService.getHostLabel(Schemas.vscodeRemote, remoteAgentConnection.remoteAuthority) || localize("remote", "Remote");
        }
      };
    }
    if (isWeb) {
      const extensionManagementService = instantiationService.createInstance(WebExtensionManagementService);
      this.webExtensionManagementServer = {
        id: "web",
        extensionManagementService,
        label: localize("browser", "Browser")
      };
    }
  }
  getExtensionManagementServer(extension) {
    if (extension.location.scheme === Schemas.vscodeRemote) {
      return this.remoteExtensionManagementServer;
    }
    if (this.webExtensionManagementServer) {
      return this.webExtensionManagementServer;
    }
    throw new Error(`Invalid Extension ${extension.location}`);
  }
  getExtensionInstallLocation(extension) {
    const server = this.getExtensionManagementServer(extension);
    return server === this.remoteExtensionManagementServer ? ExtensionInstallLocation.Remote : ExtensionInstallLocation.Web;
  }
};
ExtensionManagementServerService = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, IInstantiationService)
], ExtensionManagementServerService);
registerSingleton(IExtensionManagementServerService, ExtensionManagementServerService, InstantiationType.Delayed);
export {
  ExtensionManagementServerService
};
