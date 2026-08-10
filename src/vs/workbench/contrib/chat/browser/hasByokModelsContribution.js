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
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ChatEntitlementContextKeys } from "../../../services/chat/common/chatEntitlementService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { ChatAIDisabledSettingId } from "../common/constants.js";
import { COPILOT_VENDOR_ID } from "../common/languageModels.js";
import { ILanguageModelsConfigurationService } from "../common/languageModelsConfiguration.js";
let HasByokModelsContribution = class extends Disposable {
  constructor(_languageModelsConfigurationService, _contextKeyService, _configurationService, _storageService, extensionService) {
    super();
    this._languageModelsConfigurationService = _languageModelsConfigurationService;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._storageService = _storageService;
    this._extensionsRegistered = false;
    this._configurationLoaded = false;
    this._hasByokModels = ChatEntitlementContextKeys.hasByokModels.bindTo(this._contextKeyService);
    this._restore();
    this._update();
    extensionService.whenInstalledExtensionsRegistered().then(() => {
      if (!this._store.isDisposed) {
        this._extensionsRegistered = true;
        this._update();
      }
    });
    this._languageModelsConfigurationService.whenReady.then(() => {
      if (!this._store.isDisposed) {
        this._configurationLoaded = true;
        this._update();
      }
    });
    this._register(Event.any(
      Event.filter(this._configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ChatAIDisabledSettingId)),
      Event.filter(this._contextKeyService.onDidChangeContext, (e) => e.affectsSome(HasByokModelsContribution.TRACKED_KEYS)),
      this._languageModelsConfigurationService.onDidChangeLanguageModelGroups
    )(() => this._update()));
  }
  static {
    this.ID = "workbench.contrib.hasByokModels";
  }
  static {
    this.STORAGE_KEY_LAST_KNOWN = "chat.hasByokModels.lastKnown";
  }
  static {
    this.TRACKED_KEYS = /* @__PURE__ */ new Set([
      ChatEntitlementContextKeys.clientByokEnabled.key,
      ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.key
    ]);
  }
  _isFeatureEnabled() {
    return !this._configurationService.getValue(ChatAIDisabledSettingId) && !!this._contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.clientByokEnabled.key);
  }
  _restore() {
    if (!this._isFeatureEnabled()) {
      this._hasByokModels.set(false);
      return;
    }
    this._hasByokModels.set(this._storageService.getBoolean(HasByokModelsContribution.STORAGE_KEY_LAST_KNOWN, StorageScope.APPLICATION, false));
  }
  _setResult(value) {
    this._hasByokModels.set(value);
    this._storageService.store(HasByokModelsContribution.STORAGE_KEY_LAST_KNOWN, value, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  _update() {
    if (!this._isFeatureEnabled()) {
      this._setResult(false);
      return;
    }
    const hasByokVendor = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().some((g) => g.vendor !== COPILOT_VENDOR_ID);
    if (hasByokVendor) {
      this._setResult(true);
      return;
    }
    if (!this._extensionsRegistered && this._contextKeyService.getContextKeyValue(ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.key)) {
      this._setResult(true);
      return;
    }
    if (this._extensionsRegistered && this._configurationLoaded) {
      this._setResult(false);
    }
  }
};
HasByokModelsContribution = __decorateClass([
  __decorateParam(0, ILanguageModelsConfigurationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IExtensionService)
], HasByokModelsContribution);
export {
  HasByokModelsContribution
};
