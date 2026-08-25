import { StorageScope } from "../../../../../../platform/storage/common/storage.js";
import { getSelectedModelStorageKey, SELECTED_MODEL_STORAGE_KEY_PREFIX } from "../../../common/chatSelectedModel.js";
class ChatModelSelectionDiagnostics {
  constructor(_logService, _storageService, _getContext) {
    this._logService = _logService;
    this._storageService = _storageService;
    this._getContext = _getContext;
  }
  report(event, details, level = "debug") {
    const context = this._getContext();
    const fields = {
      surface: context.surface,
      sessionKey: context.sessionKey,
      conversationKey: context.conversationKey,
      modelTarget: context.modelTarget,
      storageKey: getSelectedModelStorageKey(context.location, context.modelTarget),
      ...context.metadata,
      ...details
    };
    const message = `[ChatModelSelection] event=${event} ${Object.entries(fields).map(([key, value]) => `${key}=${value === void 0 ? "undefined" : JSON.stringify(value)}`).join(" ")}`;
    switch (level) {
      case "debug":
        this._logService.debug(message);
        break;
      case "info":
        this._logService.info(message);
        break;
      case "error":
        this._logService.error(message);
        break;
    }
  }
  logStorageChange(event, currentModel) {
    if (!event.key.startsWith(SELECTED_MODEL_STORAGE_KEY_PREFIX) || event.key.endsWith(".isDefault")) {
      return;
    }
    const context = this._getContext();
    const activeStorageKey = getSelectedModelStorageKey(context.location, context.modelTarget);
    const storedModel = this._storageService.get(event.key, StorageScope.PROFILE);
    const matchesActiveKey = event.key === activeStorageKey;
    const conflictsWithCurrentModel = matchesActiveKey && !!storedModel && !!currentModel && storedModel !== currentModel;
    this.report("storage-change", {
      changedKey: event.key,
      external: event.external,
      matchesActiveKey,
      conflictsWithCurrentModel,
      storedModel,
      currentModel
    }, event.external || conflictsWithCurrentModel ? "info" : "debug");
  }
}
const NullChatModelSelectionDiagnostics = {
  report: () => {
  }
};
export {
  ChatModelSelectionDiagnostics,
  NullChatModelSelectionDiagnostics
};
