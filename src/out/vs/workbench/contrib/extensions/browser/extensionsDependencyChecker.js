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
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { MenuRegistry, MenuId } from "../../../../platform/actions/common/actions.js";
import { localize } from "../../../../nls.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Action } from "../../../../base/common/actions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Promises } from "../../../../base/common/async.js";
let ExtensionDependencyChecker = class extends Disposable {
  constructor(extensionService, extensionsWorkbenchService, notificationService, hostService) {
    super();
    this.extensionService = extensionService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.notificationService = notificationService;
    this.hostService = hostService;
    CommandsRegistry.registerCommand("workbench.extensions.installMissingDependencies", () => this.installMissingDependencies());
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: {
        id: "workbench.extensions.installMissingDependencies",
        category: localize("extensions", "Extensions"),
        title: localize("auto install missing deps", "Install Missing Dependencies")
      }
    });
  }
  async getUninstalledMissingDependencies() {
    const allMissingDependencies = await this.getAllMissingDependencies();
    const localExtensions = await this.extensionsWorkbenchService.queryLocal();
    return allMissingDependencies.filter((id) => localExtensions.every((l) => !areSameExtensions(l.identifier, { id })));
  }
  async getAllMissingDependencies() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const runningExtensionsIds = this.extensionService.extensions.reduce((result, r) => {
      result.add(r.identifier.value.toLowerCase());
      return result;
    }, /* @__PURE__ */ new Set());
    const missingDependencies = /* @__PURE__ */ new Set();
    for (const extension of this.extensionService.extensions) {
      if (extension.extensionDependencies) {
        extension.extensionDependencies.forEach((dep) => {
          if (!runningExtensionsIds.has(dep.toLowerCase())) {
            missingDependencies.add(dep);
          }
        });
      }
    }
    return [...missingDependencies.values()];
  }
  async installMissingDependencies() {
    const missingDependencies = await this.getUninstalledMissingDependencies();
    if (missingDependencies.length) {
      const extensions = await this.extensionsWorkbenchService.getExtensions(missingDependencies.map((id) => ({ id })), CancellationToken.None);
      if (extensions.length) {
        await Promises.settled(extensions.map((extension) => this.extensionsWorkbenchService.install(extension)));
        this.notificationService.notify({
          severity: Severity.Info,
          message: localize("finished installing missing deps", "Finished installing missing dependencies. Please reload the window now."),
          actions: {
            primary: [new Action(
              "realod",
              localize("reload", "Reload Window"),
              "",
              true,
              () => this.hostService.reload()
            )]
          }
        });
      }
    } else {
      this.notificationService.info(localize("no missing deps", "There are no missing dependencies to install."));
    }
  }
};
ExtensionDependencyChecker = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IHostService)
], ExtensionDependencyChecker);
export {
  ExtensionDependencyChecker
};
