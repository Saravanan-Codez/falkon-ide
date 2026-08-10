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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ILifecycleService, LifecyclePhase } from "../../../../services/lifecycle/common/lifecycle.js";
import { ChatSessionStatus } from "../../common/chatSessionsService.js";
import { AgentSessionProviders } from "../agentSessions/agentSessions.js";
import { sessionOpenerRegistry } from "../agentSessions/agentSessionsOpener.js";
import { IChatWidgetService } from "../chat.js";
import { CHAT_OPEN_ACTION_ID } from "../actions/chatActions.js";
let GrowthSessionController = class extends Disposable {
  constructor(storageService, chatWidgetService, lifecycleService, logService) {
    super();
    this.storageService = storageService;
    this.chatWidgetService = chatWidgetService;
    this.lifecycleService = lifecycleService;
    this.logService = logService;
    this._onDidChangeChatSessionItems = this._register(new Emitter());
    this.onDidChangeChatSessionItems = this._onDidChangeChatSessionItems.event;
    this._onDidDismiss = this._register(new Emitter());
    this.onDidDismiss = this._onDidDismiss.event;
    this._created = Date.now();
    this._dismissed = this.storageService.getBoolean(GrowthSessionController.STORAGE_KEY, StorageScope.APPLICATION, false);
    this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
      if (this._store.isDisposed || this._dismissed) {
        return;
      }
      this._register(this.chatWidgetService.onDidAddWidget(() => {
        this.dismiss();
      }));
    });
  }
  static {
    this.STORAGE_KEY = "chat.growthSession.dismissed";
  }
  static {
    this.SESSION_URI = URI.from({ scheme: AgentSessionProviders.Growth, path: "/growth-welcome" });
  }
  get isDismissed() {
    return this._dismissed;
  }
  get items() {
    if (this._dismissed) {
      return [];
    }
    return [{
      resource: GrowthSessionController.SESSION_URI,
      label: localize("growthSession.label", "Try Copilot"),
      description: localize("growthSession.description", "GitHub Copilot is available. Try it for free."),
      status: ChatSessionStatus.NeedsInput,
      iconPath: Codicon.lightbulb,
      timing: {
        created: this._created,
        lastRequestStarted: void 0,
        lastRequestEnded: void 0
      }
    }];
  }
  async refresh() {
  }
  dismiss() {
    if (this._dismissed) {
      return;
    }
    this.logService.trace("[GrowthSession] Dismissing growth session");
    this._dismissed = true;
    this.storageService.store(GrowthSessionController.STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
    this._onDidChangeChatSessionItems.fire({
      removed: [GrowthSessionController.SESSION_URI]
    });
    this._onDidDismiss.fire();
  }
};
GrowthSessionController = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, ILogService)
], GrowthSessionController);
class GrowthSessionOpenerParticipant {
  async handleOpenSession(accessor, session, _openOptions) {
    if (session.providerType !== AgentSessionProviders.Growth) {
      return false;
    }
    const commandService = accessor.get(ICommandService);
    const opts = {
      query: "",
      isPartialQuery: true,
      previousRequests: [{
        request: localize("growthSession.previousRequest", "Tell me about GitHub Copilot!"),
        // allow-any-unicode-next-line
        response: localize("growthSession.previousResponse", 'Welcome to GitHub Copilot, your AI coding assistant! Here are some things you can try:\n\n- \u{1F41B} *"Help me debug this error"* \u2014 paste an error message and get a fix\n- \u{1F9EA} *"Write tests for my function"* \u2014 select code and ask for unit tests\n- \u{1F4A1} *"Explain this code"* \u2014 highlight something unfamiliar and ask what it does\n- \u{1F680} *"Scaffold a REST API"* \u2014 describe what you want and let Agent mode build it\n- \u{1F3A8} *"Refactor this to be more readable"* \u2014 select messy code and clean it up\n\nType anything below to get started!')
      }]
    };
    await commandService.executeCommand(CHAT_OPEN_ACTION_ID, opts);
    return true;
  }
}
function registerGrowthSession(chatSessionsService, growthController) {
  const disposables = new DisposableStore();
  disposables.add(chatSessionsService.registerChatSessionItemController(AgentSessionProviders.Growth, growthController));
  disposables.add(sessionOpenerRegistry.registerParticipant(new GrowthSessionOpenerParticipant()));
  return disposables;
}
registerAction2(class ResetGrowthSessionAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.resetGrowthSession",
      title: localize2("resetGrowthSession", "Reset Growth Session Notification"),
      category: localize2("developer", "Developer"),
      f1: true
    });
  }
  run(accessor) {
    const storageService = accessor.get(IStorageService);
    storageService.remove(GrowthSessionController.STORAGE_KEY, StorageScope.APPLICATION);
  }
});
export {
  GrowthSessionController,
  GrowthSessionOpenerParticipant,
  registerGrowthSession
};
