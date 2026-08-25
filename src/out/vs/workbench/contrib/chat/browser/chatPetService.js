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
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import product from "../../../../platform/product/common/product.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
const CHAT_PET_ENABLED_STORAGE_KEY = "chat.vscodePet.enabled";
const CHAT_PET_VARIANT_STORAGE_KEY = "chat.vscodePet.variant";
const CHAT_PET_ON_THE_RUN_STORAGE_KEY = "chat.vscodePet.onTheRun";
function getChatPetVariant(configuredVariant, productQuality) {
  if (configuredVariant === "stable" || configuredVariant === "insiders") {
    return configuredVariant;
  }
  return productQuality === "stable" ? "stable" : "insiders";
}
const IChatPetService = createDecorator("chatPetService");
let ChatPetService = class extends Disposable {
  constructor(storageService, telemetryService) {
    super();
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this._enabled = observableValue(this, this.storageService.getBoolean(CHAT_PET_ENABLED_STORAGE_KEY, StorageScope.APPLICATION, false));
    this.enabled = this._enabled;
    this._variant = observableValue(this, getChatPetVariant(this.storageService.get(CHAT_PET_VARIANT_STORAGE_KEY, StorageScope.APPLICATION), product.quality));
    this.variant = this._variant;
    this._onTheRun = observableValue(this, this.storageService.getBoolean(CHAT_PET_ON_THE_RUN_STORAGE_KEY, StorageScope.APPLICATION, false));
    this.onTheRun = this._onTheRun;
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, CHAT_PET_ENABLED_STORAGE_KEY, this._store)(() => {
      this._setEnabled(this.storageService.getBoolean(CHAT_PET_ENABLED_STORAGE_KEY, StorageScope.APPLICATION, false));
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, CHAT_PET_VARIANT_STORAGE_KEY, this._store)(() => {
      this._variant.set(getChatPetVariant(this.storageService.get(CHAT_PET_VARIANT_STORAGE_KEY, StorageScope.APPLICATION), product.quality), void 0);
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, CHAT_PET_ON_THE_RUN_STORAGE_KEY, this._store)(() => {
      this._onTheRun.set(this.storageService.getBoolean(CHAT_PET_ON_THE_RUN_STORAGE_KEY, StorageScope.APPLICATION, false), void 0);
    }));
    this._logEnablement(this._enabled.get(), "startup");
  }
  toggle() {
    const enabled = !this._enabled.get();
    this._setEnabled(enabled);
    this.storageService.store(CHAT_PET_ENABLED_STORAGE_KEY, enabled, StorageScope.APPLICATION, StorageTarget.USER);
    status(enabled ? localize("chatPet.enabled", "VS Code pet enabled. Click the pet to interact with it, or use the Left and Right Arrow keys to move it.") : localize("chatPet.disabled", "VS Code pet disabled"));
    return enabled;
  }
  _setEnabled(enabled) {
    if (enabled === this._enabled.get()) {
      return;
    }
    this._enabled.set(enabled, void 0);
    this._logEnablement(enabled, "change");
  }
  _logEnablement(enabled, source) {
    this.telemetryService.publicLog2("chatPetEnablement", { enabled, source });
  }
  setVariant(variant) {
    this._variant.set(variant, void 0);
    this.storageService.store(CHAT_PET_VARIANT_STORAGE_KEY, variant, StorageScope.APPLICATION, StorageTarget.USER);
    status(variant === "stable" ? localize("chatPet.variant.stable", "VS Code pet changed to the Stable colors") : localize("chatPet.variant.insiders", "VS Code pet changed to the Insiders colors"));
  }
  setOnTheRun(onTheRun) {
    this._onTheRun.set(onTheRun, void 0);
    this.storageService.store(CHAT_PET_ON_THE_RUN_STORAGE_KEY, onTheRun, StorageScope.APPLICATION, StorageTarget.USER);
    status(onTheRun ? localize("chatPet.onTheRun", "The VS Code pet is on the run. Click the pet to bring it back.") : localize("chatPet.restored", "The VS Code pet is back"));
  }
};
ChatPetService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ITelemetryService)
], ChatPetService);
export {
  ChatPetService,
  IChatPetService,
  getChatPetVariant
};
