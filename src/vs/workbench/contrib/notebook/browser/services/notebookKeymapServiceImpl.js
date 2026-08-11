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
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { getInstalledExtensions } from "../../../extensions/common/extensionsUtils.js";
import { EnablementState, IWorkbenchExtensionEnablementService } from "../../../../services/extensionManagement/common/extensionManagement.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IExtensionManagementService, InstallOperation } from "../../../../../platform/extensionManagement/common/extensionManagement.js";
import { areSameExtensions } from "../../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { Memento } from "../../../../common/memento.js";
import { distinct } from "../../../../../base/common/arrays.js";
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
    result = result || (identifiers.length ? [identifiers[0]] : []);
    for (const identifier of identifiers) {
      if (result.some((l) => !areSameExtensions(l, identifier))) {
        result.push(identifier);
      }
    }
    return result;
  });
}
const hasRecommendedKeymapKey = "hasRecommendedKeymap";
let NotebookKeymapService = class extends Disposable {
  constructor(instantiationService, extensionEnablementService, notificationService, storageService, lifecycleService) {
    super();
    this.instantiationService = instantiationService;
    this.extensionEnablementService = extensionEnablementService;
    this.notificationService = notificationService;
    this.notebookKeymapMemento = new Memento("notebookKeymap", storageService);
    this.notebookKeymap = this.notebookKeymapMemento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    this._register(lifecycleService.onDidShutdown(() => this.dispose()));
    this._register(this.instantiationService.invokeFunction(onExtensionChanged)(((identifiers) => {
      Promise.all(identifiers.map((identifier) => this.checkForOtherKeymaps(identifier))).then(void 0, onUnexpectedError);
    })));
  }
  checkForOtherKeymaps(extensionIdentifier) {
    return this.instantiationService.invokeFunction(getInstalledExtensions).then((extensions) => {
      const keymaps = extensions.filter((extension2) => isNotebookKeymapExtension(extension2));
      const extension = keymaps.find((extension2) => areSameExtensions(extension2.identifier, extensionIdentifier));
      if (extension && extension.globallyEnabled) {
        this.notebookKeymap[hasRecommendedKeymapKey] = true;
        this.notebookKeymapMemento.saveMemento();
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
      localize("disableOtherKeymapsConfirmation", "Disable other keymaps ({0}) to avoid conflicts between keybindings?", distinct(oldKeymaps.map((k) => k.local.manifest.displayName)).map((name) => `'${name}'`).join(", ")),
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
NotebookKeymapService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ILifecycleService)
], NotebookKeymapService);
function isNotebookKeymapExtension(extension) {
  if (extension.local.manifest.extensionPack) {
    return false;
  }
  const keywords = extension.local.manifest.keywords;
  if (!keywords) {
    return false;
  }
  return keywords.indexOf("notebook-keymap") !== -1;
}
export {
  NotebookKeymapService,
  isNotebookKeymapExtension
};
