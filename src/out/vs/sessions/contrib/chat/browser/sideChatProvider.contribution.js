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
import { raceTimeout } from "../../../../base/common/async.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { derived } from "../../../../base/common/observable.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { isRequestVM } from "../../../../workbench/contrib/chat/common/model/chatViewModel.js";
import { IChatService } from "../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { IChatSideChatService } from "../../../../workbench/contrib/chat/common/chatSideChatService.js";
import { IWorkbenchEnvironmentService } from "../../../../workbench/services/environment/common/environmentService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ChatOriginKind, SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { createAndSendSideChat } from "./sideChatOrchestration.js";
const SIDE_CHAT_SOURCE_REVEAL_TIMEOUT = 2e3;
let SessionsSideChatProviderContribution = class extends Disposable {
  constructor(sideChatService, sessionsManagementService, sessionsService, chatService, chatWidgetService, uriIdentityService, environmentService) {
    super();
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    this.chatService = chatService;
    this.chatWidgetService = chatWidgetService;
    this.uriIdentityService = uriIdentityService;
    // Cached observables avoid recreating deriveds for every rendered chat row.
    this._sideChatOrigins = new ResourceMap();
    this._isSessionsWindow = environmentService.isSessionsWindow;
    if (!this._isSessionsWindow) {
      return;
    }
    this._register(sideChatService.registerProvider(this));
  }
  static {
    this.ID = "sessions.contrib.sideChatProvider";
  }
  canAskInSideChat(sessionResource) {
    return !!this._resolveSource(sessionResource);
  }
  async askInSideChat(sessionResource, query, selection) {
    const source = this._resolveSource(sessionResource);
    if (!source) {
      throw new Error(`Side chats are not supported for ${sessionResource.toString()}`);
    }
    const { session, chatResource, turnId } = source;
    await createAndSendSideChat(this.sessionsManagementService, this.sessionsService, session, chatResource, turnId, query, selection);
  }
  /** Observes the source metadata for a side chat. */
  observeSideChatOrigin(sessionResource) {
    let sideChatOrigin = this._sideChatOrigins.get(sessionResource);
    if (!sideChatOrigin) {
      sideChatOrigin = derived(this, (reader) => {
        if (!this._isSessionsWindow) {
          return void 0;
        }
        const resolved = this._resolveSessionChat(sessionResource, reader);
        const origin = resolved?.chat.origin;
        if (!resolved || origin?.kind !== ChatOriginKind.SideChat || !origin.parentChat || !origin.turnId) {
          return void 0;
        }
        const sourceChat = resolved.session.chats.read(reader).find((chat) => this.uriIdentityService.extUri.isEqual(chat.resource, origin.parentChat));
        return {
          sourceSessionResource: origin.parentChat,
          sourceTurnId: origin.turnId,
          sourceTitle: sourceChat?.title.read(reader),
          selection: origin.selection ? { text: origin.selection.text } : void 0
        };
      });
      this._sideChatOrigins.set(sessionResource, sideChatOrigin);
    }
    return sideChatOrigin;
  }
  /** Activates a side chat's source and reveals its originating request. */
  async revealSideChatSource(sessionResource) {
    if (!this._isSessionsWindow) {
      return;
    }
    const origin = this.observeSideChatOrigin(sessionResource).get();
    if (!origin) {
      return;
    }
    const resolved = this._resolveSessionChat(sessionResource);
    if (!resolved) {
      return;
    }
    const widget = this.chatWidgetService.getWidgetBySessionResource(sessionResource);
    await this.sessionsService.openChat(resolved.session, origin.sourceSessionResource);
    if (!widget) {
      return;
    }
    if (!widget.viewModel || !this.uriIdentityService.extUri.isEqual(widget.viewModel.sessionResource, origin.sourceSessionResource)) {
      const viewModelChanged = Event.toPromise(Event.filter(
        widget.onDidChangeViewModel,
        (event) => event.currentSessionResource !== void 0 && this.uriIdentityService.extUri.isEqual(event.currentSessionResource, origin.sourceSessionResource)
      ), this._store);
      try {
        if (!await raceTimeout(viewModelChanged, SIDE_CHAT_SOURCE_REVEAL_TIMEOUT)) {
          return;
        }
      } finally {
        viewModelChanged.cancel();
      }
    }
    const item = widget.viewModel?.getItems().find((item2) => item2.id === origin.sourceTurnId);
    if (item && isRequestVM(item)) {
      widget.reveal(item);
    }
  }
  _resolveSessionChat(sessionResource, reader) {
    const visibleSessions = reader ? this.sessionsService.visibleSessions.read(reader) : this.sessionsService.visibleSessions.get();
    for (const session of visibleSessions) {
      if (!session) {
        continue;
      }
      const chats = reader ? session.chats.read(reader) : session.chats.get();
      const chat = chats.find((chat2) => this.uriIdentityService.extUri.isEqual(chat2.resource, sessionResource));
      if (chat) {
        return { session, chat };
      }
    }
    return this.sessionsManagementService.getSessionForChatResource(sessionResource);
  }
  /**
   * Resolves the session, chat and turn a side chat would branch from, or
   * `undefined` when this conversation cannot produce one — it is untitled,
   * archived, its provider lacks side chat support, or nothing has been sent
   * yet so there is no turn to anchor to.
   */
  _resolveSource(sessionResource) {
    const found = this.sessionsManagementService.getSessionForChatResource(sessionResource);
    if (!found) {
      return void 0;
    }
    const { session, chat } = found;
    if (session.status.get() === SessionStatus.Untitled || session.isArchived.get() || !session.capabilities.get().supportsSideChat) {
      return void 0;
    }
    const sourceTurn = this.chatService.getSession(chat.resource)?.getRequests().at(-1);
    if (!sourceTurn) {
      return void 0;
    }
    return { session, chatResource: chat.resource, turnId: sourceTurn.id };
  }
};
SessionsSideChatProviderContribution = __decorateClass([
  __decorateParam(0, IChatSideChatService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IWorkbenchEnvironmentService)
], SessionsSideChatProviderContribution);
registerWorkbenchContribution2(SessionsSideChatProviderContribution.ID, SessionsSideChatProviderContribution, WorkbenchPhase.BlockRestore);
export {
  SessionsSideChatProviderContribution
};
