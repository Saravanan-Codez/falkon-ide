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
import { Schemas } from "../../../base/common/network.js";
import { isWeb } from "../../../base/common/platform.js";
import { isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../platform/commands/common/commands.js";
import { IExtensionGalleryService, IExtensionManagementService } from "../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionManagementCLI } from "../../../platform/extensionManagement/common/extensionManagementCLI.js";
import { getExtensionId } from "../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { AbstractMessageLogger } from "../../../platform/log/common/log.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { IExtensionManagementServerService } from "../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionManifestPropertiesService } from "../../services/extensions/common/extensionManifestPropertiesService.js";
CommandsRegistry.registerCommand("_remoteCLI.openExternal", function(accessor, uri) {
  const openerService = accessor.get(IOpenerService);
  return openerService.open(isString(uri) ? uri : URI.revive(uri), { openExternal: true, allowTunneling: true });
});
CommandsRegistry.registerCommand("_remoteCLI.windowOpen", function(accessor, toOpen, options) {
  const commandService = accessor.get(ICommandService);
  if (!toOpen.length) {
    return commandService.executeCommand("_files.newWindow", options);
  }
  return commandService.executeCommand("_files.windowOpen", toOpen, options);
});
CommandsRegistry.registerCommand("_remoteCLI.getSystemStatus", function(accessor) {
  const commandService = accessor.get(ICommandService);
  return commandService.executeCommand("_issues.getSystemStatus");
});
CommandsRegistry.registerCommand("_remoteCLI.manageExtensions", async function(accessor, args) {
  const instantiationService = accessor.get(IInstantiationService);
  const extensionManagementServerService = accessor.get(IExtensionManagementServerService);
  const remoteExtensionManagementService = extensionManagementServerService.remoteExtensionManagementServer?.extensionManagementService;
  if (!remoteExtensionManagementService) {
    return;
  }
  const lines = [];
  const logger = new class extends AbstractMessageLogger {
    log(level, message) {
      lines.push(message);
    }
  }();
  const childInstantiationService = instantiationService.createChild(new ServiceCollection([IExtensionManagementService, remoteExtensionManagementService]));
  try {
    const cliService = childInstantiationService.createInstance(RemoteExtensionManagementCLI, logger);
    if (args.list) {
      await cliService.listExtensions(!!args.list.showVersions, args.list.category, void 0);
    } else {
      const revive = (inputs) => inputs.map((input) => isString(input) ? input : URI.revive(input));
      if (Array.isArray(args.install) && args.install.length) {
        try {
          await cliService.installExtensions(revive(args.install), [], { isMachineScoped: true }, !!args.force);
        } catch (e) {
          lines.push(e.message);
        }
      }
      if (Array.isArray(args.uninstall) && args.uninstall.length) {
        try {
          await cliService.uninstallExtensions(revive(args.uninstall), !!args.force, void 0);
        } catch (e) {
          lines.push(e.message);
        }
      }
    }
    return lines.join("\n");
  } finally {
    childInstantiationService.dispose();
  }
});
let RemoteExtensionManagementCLI = class extends ExtensionManagementCLI {
  constructor(logger, extensionManagementService, extensionGalleryService, labelService, envService, _extensionManifestPropertiesService, productService) {
    super([], logger, extensionManagementService, extensionGalleryService, productService);
    this._extensionManifestPropertiesService = _extensionManifestPropertiesService;
    const remoteAuthority = envService.remoteAuthority;
    this._location = remoteAuthority ? labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority) : void 0;
  }
  get location() {
    return this._location;
  }
  validateExtensionKind(manifest) {
    if (!this._extensionManifestPropertiesService.canExecuteOnWorkspace(manifest) && !(isWeb && this._extensionManifestPropertiesService.canExecuteOnWeb(manifest))) {
      this.logger.info(localize("cannot be installed", "Cannot install the '{0}' extension because it is declared to not run in this setup.", getExtensionId(manifest.publisher, manifest.name)));
      return false;
    }
    return true;
  }
};
RemoteExtensionManagementCLI = __decorateClass([
  __decorateParam(1, IExtensionManagementService),
  __decorateParam(2, IExtensionGalleryService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IExtensionManifestPropertiesService),
  __decorateParam(6, IProductService)
], RemoteExtensionManagementCLI);
