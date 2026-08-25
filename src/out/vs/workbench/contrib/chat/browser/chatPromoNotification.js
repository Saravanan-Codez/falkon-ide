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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { localChatSessionType } from "../common/chatSessionsService.js";
import { ILanguageModelChatMetadata, ILanguageModelsService } from "../common/languageModels.js";
import { ChatInputNotificationActionKind, ChatInputNotificationSeverity, IChatInputNotificationService } from "./widget/input/chatInputNotificationService.js";
const PROMO_NOTIFICATION_ID = "copilot.promoNotification";
const DISMISSED_PROMOS_STORAGE_KEY = "chat.dismissedPromoIds";
let ChatPromoNotificationContribution = class extends Disposable {
  constructor(_languageModelsService, _chatInputNotificationService, _storageService) {
    super();
    this._languageModelsService = _languageModelsService;
    this._chatInputNotificationService = _chatInputNotificationService;
    this._storageService = _storageService;
    this._shownNotifications = /* @__PURE__ */ new Map();
    this._register(this._languageModelsService.onDidChangeLanguageModels(() => this._update()));
    this._register(this._chatInputNotificationService.onDidDismiss((id) => {
      const promoId = this._shownNotifications.get(id)?.promoId;
      if (promoId) {
        this._persistDismissedPromo(promoId);
        this._update();
      }
    }));
    this._update();
  }
  static {
    this.ID = "workbench.contrib.chatPromoNotification";
  }
  _update() {
    const dismissed = this._getDismissedPromoIds();
    const modelIds = this._languageModelsService.getLanguageModelIds();
    const promoByHarness = /* @__PURE__ */ new Map();
    for (const id of modelIds) {
      const meta = this._languageModelsService.lookupLanguageModel(id);
      if (!meta || !ILanguageModelChatMetadata.hasPromoMessage(meta) || dismissed.has(meta.promo.id)) {
        continue;
      }
      const harness = meta.targetChatSessionType ?? localChatSessionType;
      const current = promoByHarness.get(harness);
      if (!current || !ILanguageModelChatMetadata.hasPromoDiscount(current.metadata) && ILanguageModelChatMetadata.hasPromoDiscount(meta)) {
        promoByHarness.set(harness, { identifier: id, metadata: meta });
      }
    }
    const desired = /* @__PURE__ */ new Set();
    for (const [harness, model] of promoByHarness) {
      const promo = model.metadata.promo;
      const notificationId = `${PROMO_NOTIFICATION_ID}.${harness}`;
      desired.add(notificationId);
      const shownNotification = this._shownNotifications.get(notificationId);
      if (shownNotification?.modelIdentifier === model.identifier && shownNotification.promoId === promo.id) {
        continue;
      }
      this._shownNotifications.set(notificationId, { promoId: promo.id, modelIdentifier: model.identifier });
      this._chatInputNotificationService.setNotification({
        id: notificationId,
        telemetryId: promo.id,
        severity: ChatInputNotificationSeverity.Info,
        message: promo.message,
        description: ILanguageModelChatMetadata.getPromoEndsAtLabel(promo.endsAt),
        actions: [{
          label: localize("chat.promo.tryModel", "Try {0}", model.metadata.name),
          kind: ChatInputNotificationActionKind.SwitchToModel,
          modelIdentifier: model.identifier
        }],
        dismissible: true,
        autoDismissOnMessage: false,
        sessionTypes: [harness]
      });
    }
    for (const notificationId of [...this._shownNotifications.keys()]) {
      if (!desired.has(notificationId)) {
        this._chatInputNotificationService.deleteNotification(notificationId);
        this._shownNotifications.delete(notificationId);
      }
    }
  }
  _persistDismissedPromo(promoId) {
    const dismissed = this._getDismissedPromoIds();
    if (dismissed.has(promoId)) {
      return;
    }
    dismissed.add(promoId);
    this._storageService.store(
      DISMISSED_PROMOS_STORAGE_KEY,
      JSON.stringify([...dismissed]),
      StorageScope.APPLICATION,
      StorageTarget.USER
    );
  }
  _getDismissedPromoIds() {
    const raw = this._storageService.get(DISMISSED_PROMOS_STORAGE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return /* @__PURE__ */ new Set();
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((v) => typeof v === "string"));
      }
    } catch {
    }
    return /* @__PURE__ */ new Set();
  }
};
ChatPromoNotificationContribution = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, IChatInputNotificationService),
  __decorateParam(2, IStorageService)
], ChatPromoNotificationContribution);
export {
  ChatPromoNotificationContribution
};
