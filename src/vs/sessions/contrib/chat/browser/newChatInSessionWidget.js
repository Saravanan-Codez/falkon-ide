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
import "./media/chatWidget.css";
import "./media/newChatInSession.css";
import * as dom from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { constObservable, derived } from "../../../../base/common/observable.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { NewChatInputWidget } from "./newChatInput.js";
const STORAGE_KEY_SUB_SESSION_TIP_DISMISSED = "sessions.subSessionTipDismissed";
let NewChatInSessionWidget = class extends Disposable {
  constructor(_options, instantiationService, logService, sessionsManagementService, sessionsService, storageService) {
    super();
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    this.storageService = storageService;
    this._tipDisposable = this._register(new MutableDisposable());
    this._session = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession;
    });
    const canSendRequest = derived((reader) => {
      const session = this._session.read(reader);
      if (!session) {
        return false;
      }
      return true;
    });
    const loading = derived((_reader) => false);
    this._newChatInput = this._register(this.instantiationService.createInstance(NewChatInputWidget, {
      session: this._session,
      getContextFolderUri: () => this._getContextFolderUri(),
      sendRequest: async ({ query, attachments, background }) => this._send(query, attachments, background),
      canSendRequest,
      loading,
      historyKey: constObservable(void 0),
      // no persisted history for the new-chat-in-session view
      minEditorHeight: 64,
      placeholder: localize("newChatInSessionPlaceholder", "Ask a follow-up question or start a new topic within this session..."),
      supportsBackground: true,
      voiceRoutesWhileSessionActive: true
    }));
  }
  // --- Rendering ---
  render(parent) {
    const element = dom.append(parent, dom.$(".sessions-chat-widget.new-chat-in-session"));
    const chatWidgetContainer = dom.append(element, dom.$(".new-chat-widget-container"));
    const chatWidgetContent = dom.append(chatWidgetContainer, dom.$(".new-chat-widget-content"));
    this._renderSubSessionTip(chatWidgetContent);
    this._newChatInput.render(chatWidgetContent, parent);
    chatWidgetContainer.classList.add("revealed");
  }
  _renderSubSessionTip(container) {
    if (this.storageService.getBoolean(STORAGE_KEY_SUB_SESSION_TIP_DISMISSED, StorageScope.PROFILE, false)) {
      return;
    }
    const tipContainer = dom.append(container, dom.$(".sub-session-tip-container"));
    const tipWidget = dom.append(tipContainer, dom.$(".sub-session-tip-widget"));
    tipWidget.setAttribute("role", "status");
    tipWidget.setAttribute("aria-label", localize("subSessionTip.ariaLabel", "New chat tip"));
    const iconEl = dom.append(tipWidget, renderIcon(Codicon.lightbulb));
    iconEl.classList.add("sub-session-tip-icon");
    const textEl = dom.append(tipWidget, dom.$("span.sub-session-tip-text"));
    textEl.textContent = localize(
      "subSessionTip.message",
      "Start a parallel conversation to build on all the changes made in this session."
    );
    const dismissBtn = dom.append(tipWidget, dom.$("button.sub-session-tip-dismiss"));
    dismissBtn.type = "button";
    dismissBtn.setAttribute("aria-label", localize("subSessionTip.dismiss", "Dismiss tip"));
    dom.append(dismissBtn, renderIcon(Codicon.close));
    const dismiss = () => {
      this.storageService.store(STORAGE_KEY_SUB_SESSION_TIP_DISMISSED, true, StorageScope.PROFILE, StorageTarget.USER);
      tipContainer.remove();
      this._tipDisposable.clear();
    };
    const handleDismiss = (e) => {
      dom.EventHelper.stop(e, true);
      dismiss();
    };
    const store = new DisposableStore();
    store.add(Gesture.addTarget(dismissBtn));
    store.add(dom.addDisposableListener(dismissBtn, dom.EventType.CLICK, handleDismiss));
    store.add(dom.addDisposableListener(dismissBtn, TouchEventType.Tap, handleDismiss));
    this._tipDisposable.value = store;
  }
  /**
   * Returns the workspace URI from the active session's workspace.
   */
  _getContextFolderUri() {
    const session = this._session.get();
    const workspace = session?.workspace.get();
    return workspace?.folders[0]?.workingDirectory;
  }
  // --- Send ---
  async _send(query, attachedContext, background) {
    const activeSession = this._session.get();
    if (!activeSession) {
      return false;
    }
    const activeChat = activeSession.activeChat.get();
    try {
      if (background) {
        await this.sessionsService.openNewChatInSession(activeSession, { forceNew: true });
      }
      await this.sessionsManagementService.sendRequest(activeSession, activeChat, { query, attachedContext, background });
      return true;
    } catch (e) {
      this.logService.error("Failed to send secondary chat request:", e);
      return false;
    }
  }
  layout(height, width) {
    this._newChatInput.layout(height, width);
  }
  focusInput() {
    this._newChatInput.focus();
  }
  attach(uris) {
    this._newChatInput.attach(uris);
  }
};
NewChatInSessionWidget = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ISessionsManagementService),
  __decorateParam(4, ISessionsService),
  __decorateParam(5, IStorageService)
], NewChatInSessionWidget);
export {
  NewChatInSessionWidget
};
