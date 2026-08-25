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
import { RunOnceScheduler } from "../../../../../../base/common/async.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../../nls.js";
import { readSessionPromptCacheState } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { CommandsRegistry } from "../../../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { IWorkbenchAssignmentService } from "../../../../../services/assignment/common/assignmentService.js";
import { ChatInputNotificationActionKind, ChatInputNotificationSeverity, IChatInputNotificationService } from "../../widget/input/chatInputNotificationService.js";
const PROMPT_CACHE_EXPIRATION_NOTIFICATION_EXPERIMENT = "copilotchat.promptCacheExpirationNotification";
const PROMPT_CACHE_EXPIRATION_DISABLED_STORAGE_KEY = "chat.promptCacheExpirationNotification.disabled";
const DISABLE_PROMPT_CACHE_EXPIRATION_NOTIFICATION_COMMAND = "workbench.action.chat.disablePromptCacheExpirationNotification";
const PROMPT_CACHE_EXPIRATION_LEARN_MORE_URL = "https://code.visualstudio.com/docs/agents/agent-troubleshooting/cache-explorer#_why-prompt-caching-matters";
let AgentHostPromptCacheNotification = class extends Disposable {
  constructor(_notificationService, assignmentService, _storageService, _logService) {
    super();
    this._notificationService = _notificationService;
    this._storageService = _storageService;
    this._logService = _logService;
    this._trackedSessions = this._register(new DisposableMap());
    this._cacheExpirations = new ResourceMap();
    this._dismissedExpirations = new ResourceMap();
    this._experimentEnabled = false;
    this._register(CommandsRegistry.registerCommand(DISABLE_PROMPT_CACHE_EXPIRATION_NOTIFICATION_COMMAND, () => {
      this._storageService.store(PROMPT_CACHE_EXPIRATION_DISABLED_STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
      for (const sessionResource of this._cacheExpirations.keys()) {
        this._notificationService.deleteNotification(this._notificationId(sessionResource));
      }
    }));
    this._register(this._notificationService.onDidDismiss((id) => {
      for (const [sessionResource, cacheExpiresAt] of this._cacheExpirations) {
        if (id === this._notificationId(sessionResource)) {
          this._dismissedExpirations.set(sessionResource, cacheExpiresAt);
          break;
        }
      }
    }));
    void assignmentService.getTreatment(PROMPT_CACHE_EXPIRATION_NOTIFICATION_EXPERIMENT).then((enabled) => {
      this._experimentEnabled = enabled === true;
      for (const sessionResource of this._cacheExpirations.keys()) {
        this._updateNotification(sessionResource);
      }
    }).catch((error) => this._logService.warn(`[AgentHostPromptCacheNotification] Failed to resolve experiment: ${error}`));
  }
  trackSession(sessionResource, subscription) {
    const key = sessionResource.toString();
    const store = new DisposableStore();
    this._trackedSessions.set(key, store);
    const expirationScheduler = store.add(new RunOnceScheduler(() => this._updateNotification(sessionResource), 0));
    const update = (state) => {
      expirationScheduler.cancel();
      const promptCache = state && !(state instanceof Error) ? readSessionPromptCacheState(state._meta) : void 0;
      if (promptCache) {
        if (this._cacheExpirations.get(sessionResource) !== promptCache.cacheExpiresAt) {
          this._dismissedExpirations.delete(sessionResource);
        }
        this._cacheExpirations.set(sessionResource, promptCache.cacheExpiresAt);
        const expirationTime = Date.parse(promptCache.cacheExpiresAt);
        if (Number.isFinite(expirationTime)) {
          const remainingTime = expirationTime - Date.now();
          if (remainingTime > 0) {
            expirationScheduler.schedule(remainingTime);
          }
        }
      } else {
        this._cacheExpirations.delete(sessionResource);
        this._dismissedExpirations.delete(sessionResource);
      }
      this._updateNotification(sessionResource);
    };
    store.add(subscription.onDidChange(update));
    update(subscription.value);
    store.add(toDisposable(() => {
      this._cacheExpirations.delete(sessionResource);
      this._dismissedExpirations.delete(sessionResource);
      this._notificationService.deleteNotification(this._notificationId(sessionResource));
    }));
    return toDisposable(() => this._trackedSessions.deleteAndDispose(key));
  }
  _updateNotification(sessionResource) {
    const cacheExpiresAt = this._cacheExpirations.get(sessionResource);
    const expirationTime = cacheExpiresAt ? Date.parse(cacheExpiresAt) : Number.NaN;
    const disabled = this._storageService.getBoolean(PROMPT_CACHE_EXPIRATION_DISABLED_STORAGE_KEY, StorageScope.PROFILE, false);
    if (!this._experimentEnabled || disabled || !Number.isFinite(expirationTime) || Date.now() < expirationTime) {
      this._notificationService.deleteNotification(this._notificationId(sessionResource));
      return;
    }
    if (this._dismissedExpirations.get(sessionResource) === cacheExpiresAt) {
      return;
    }
    this._notificationService.setNotification({
      id: this._notificationId(sessionResource),
      telemetryId: "copilot.promptCacheExpired",
      severity: ChatInputNotificationSeverity.Info,
      message: localize("promptCacheExpiration.title", "This chat's prompt cache is stale"),
      description: new MarkdownString(localize("promptCacheExpiration.description", "The next prompt will incur increased cost. Consider starting a new chat. [Learn more]({0})", PROMPT_CACHE_EXPIRATION_LEARN_MORE_URL)),
      actions: [
        {
          kind: ChatInputNotificationActionKind.Command,
          label: localize("promptCacheExpiration.startNewChat", "Start New Chat"),
          commandId: "workbench.action.chat.newChat"
        }
      ],
      dismissible: true,
      autoDismissOnMessage: true,
      mute: {
        commandId: DISABLE_PROMPT_CACHE_EXPIRATION_NOTIFICATION_COMMAND,
        tooltip: localize("promptCacheExpiration.dontShowAgain", "Don't Show Again")
      },
      sessionResources: [sessionResource]
    });
  }
  _notificationId(sessionResource) {
    return `copilot.promptCacheExpired.${sessionResource.toString()}`;
  }
};
AgentHostPromptCacheNotification = __decorateClass([
  __decorateParam(0, IChatInputNotificationService),
  __decorateParam(1, IWorkbenchAssignmentService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILogService)
], AgentHostPromptCacheNotification);
export {
  AgentHostPromptCacheNotification
};
