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
import { Event } from "../../../../base/common/event.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IExtensionManagementService, InstallOperation } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, EnablementState } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { Severity, INotificationService } from "../../../../platform/notification/common/notification.js";
let KeymapExtensions = class extends Disposable {
  constructor(instantiationService, extensionEnablementService, tipsService, lifecycleService, notificationService) {
    super();
    this.instantiationService = instantiationService;
    this.extensionEnablementService = extensionEnablementService;
    this.tipsService = tipsService;
    this.notificationService = notificationService;
    this._register(lifecycleService.onDidShutdown(() => this.dispose()));
    this._register(instantiationService.invokeFunction(onExtensionChanged)(((identifiers) => {
      Promise.all(identifiers.map((identifier) => this.checkForOtherKeymaps(identifier))).then(void 0, onUnexpectedError);
    })));
  }
  checkForOtherKeymaps(extensionIdentifier) {
    return this.instantiationService.invokeFunction(getInstalledExtensions).then((extensions) => {
      const keymaps = extensions.filter((extension2) => isKeymapExtension(this.tipsService, extension2));
      const extension = keymaps.find((extension2) => areSameExtensions(extension2.identifier, extensionIdentifier));
      if (extension && extension.globallyEnabled) {
        const otherKeymaps = keymaps.filter((extension2) => !areSameExtensions(extension2.identifier, extensionIdentifier) && extension2.globallyEnabled);
        if (otherKeymaps.length) {
          return this.promptForDisablingOtherKeymaps(extension, otherKeymaps);
        }
      }
      return void 0;
    });
  }
  promptForDisablingOtherKeymaps(newKeymap, oldKeymaps) {
    const onPrompt = (confirmed) => {
      if (confirmed) {
        this.extensionEnablementService.setEnablement(oldKeymaps.map((keymap) => keymap.local), EnablementState.DisabledGlobally);
      }
    };
    this.notificationService.prompt(
      Severity.Info,
      localize("disableOtherKeymapsConfirmation", "Disable other keymaps ({0}) to avoid conflicts between keybindings?", oldKeymaps.map((k) => `'${k.local.manifest.displayName}'`).join(", ")),
      [{
        label: localize("yes", "Yes"),
        run: () => onPrompt(true)
      }, {
        label: localize("no", "No"),
        run: () => onPrompt(false)
      }]
    );
  }
};
KeymapExtensions = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IExtensionRecommendationsService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, INotificationService)
], KeymapExtensions);
function onExtensionChanged(accessor) {
  const extensionService = accessor.get(IExtensionManagementService);
  const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
  const onDidInstallExtensions = Event.chain(
    extensionService.onDidInstallExtensions,
    ($) => $.filter((e) => e.some(({ operation }) => operation === InstallOperation.Install)).map((e) => e.map(({ identifier }) => identifier))
  );
  return Event.debounce(Event.any(
    Event.any(onDidInstallExtensions, Event.map(extensionService.onDidUninstallExtension, (e) => [e.identifier])),
    Event.map(extensionEnablementService.onEnablementChanged, (extensions) => extensions.map((e) => e.identifier))
  ), (result, identifiers) => {
    result = result || [];
    for (const identifier of identifiers) {
      if (result.some((l) => !areSameExtensions(l, identifier))) {
        result.push(identifier);
      }
    }
    return result;
  });
}
async function getInstalledExtensions(accessor) {
  const extensionService = accessor.get(IExtensionManagementService);
  const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
  const extensions = await extensionService.getInstalled();
  return extensions.map((extension) => {
    return {
      identifier: extension.identifier,
      local: extension,
      globallyEnabled: extensionEnablementService.isEnabled(extension)
    };
  });
}
function isKeymapExtension(tipsService, extension) {
  const cats = extension.local.manifest.categories;
  return cats && cats.indexOf("Keymaps") !== -1 || tipsService.getKeymapRecommendations().some((extensionId) => areSameExtensions({ id: extensionId }, extension.local.identifier));
}
export {
  KeymapExtensions,
  getInstalledExtensions
};
