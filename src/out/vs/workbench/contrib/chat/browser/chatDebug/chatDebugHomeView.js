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
import * as DOM from "../../../../../base/browser/dom.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isUUID } from "../../../../../base/common/uuid.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { IChatDebugService } from "../../common/chatDebugService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { AgentHostAgentDebugLogEnabledSettingId, AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING } from "../../common/promptSyntax/promptTypes.js";
import { getChatSessionType, isUntitledChatSession, LocalChatSessionUri } from "../../common/model/chatUri.js";
import { IChatWidgetService } from "../chat.js";
import { IAgentSessionsService } from "../agentSessions/agentSessionsService.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
const $ = DOM.$;
const PAGE_SIZE = 5;
let ChatDebugHomeView = class extends Disposable {
  constructor(parent, chatService, chatDebugService, chatWidgetService, agentSessionsService, configurationService, preferencesService) {
    super();
    this.chatService = chatService;
    this.chatDebugService = chatDebugService;
    this.chatWidgetService = chatWidgetService;
    this.agentSessionsService = agentSessionsService;
    this.configurationService = configurationService;
    this.preferencesService = preferencesService;
    this._onNavigateToSession = this._register(new Emitter());
    this.onNavigateToSession = this._onNavigateToSession.event;
    this.renderDisposables = this._register(new DisposableStore());
    /** Number of sessions currently visible (grows on "Show More"). */
    this._visibleCount = PAGE_SIZE;
    /** Tracks the number of known sessions so we can detect new ones. */
    this._lastKnownSessionCount = 0;
    this.container = DOM.append(parent, $(".chat-debug-home"));
    this.scrollContent = DOM.append(this.container, $("div.chat-debug-home-content"));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING) || e.affectsConfiguration(AgentHostAgentDebugLogEnabledSettingId)) {
        this.render();
      }
    }));
    this._register(this.chatDebugService.onDidAddEvent((e) => {
      const currentCount = this.chatDebugService.getSessionResources().length;
      if (currentCount !== this._lastKnownSessionCount) {
        this._lastKnownSessionCount = currentCount;
        if (this.container.style.display !== "none") {
          this.render();
        }
      }
    }));
    this._register(this.chatDebugService.onDidChangeAvailableSessionResources(() => {
      if (this.container.style.display !== "none") {
        this.render();
      }
    }));
  }
  show() {
    this.container.style.display = "";
    this.render();
  }
  hide() {
    this.container.style.display = "none";
  }
  render() {
    const isEnabled = this._isDebugEnabled();
    this._lastKnownSessionCount = this.chatDebugService.getSessionResources().length;
    const sessionResources = isEnabled ? this._getFilteredSessionResources(this.chatDebugService.getAvailableSessionResources()) : [];
    this._renderWithSessions(sessionResources);
  }
  /**
   * The panel is enabled when either local file logging or agent-host (Copilot
   * CLI) debug logging is on; each provider self-gates on its own setting, so
   * the aggregated session list only contains the sources that are enabled.
   */
  _isDebugEnabled() {
    return this.configurationService.getValue(AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING) || this.configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId);
  }
  _getFilteredSessionResources(resources) {
    const cliSessionTypes = /* @__PURE__ */ new Set(["copilotcli"]);
    return [...resources].filter((r) => !cliSessionTypes.has(getChatSessionType(r)) || !isUntitledChatSession(r));
  }
  _renderWithSessions(sessionResources) {
    DOM.clearNode(this.scrollContent);
    this.renderDisposables.clear();
    DOM.append(this.scrollContent, $("h2.chat-debug-home-title", void 0, localize("chatDebug.title", "Agent Debug Logs")));
    const isEnabled = this._isDebugEnabled();
    if (!isEnabled) {
      DOM.append(this.scrollContent, $(
        "p.chat-debug-home-subtitle",
        void 0,
        localize("chatDebug.disabled", "Enable to view debug logs and investigate chat issues with /troubleshoot.")
      ));
      const enableButton = this.renderDisposables.add(new Button(this.scrollContent, { ...defaultButtonStyles, secondary: true }));
      enableButton.element.style.width = "auto";
      enableButton.label = localize("chatDebug.openSetting", "Enable in Settings");
      this.renderDisposables.add(enableButton.onDidClick(() => {
        this.preferencesService.openSettings({ jsonEditor: false, query: "agentDebugLog" });
      }));
      return;
    }
    const activeWidget = this.chatWidgetService.lastFocusedWidget;
    const activeSessionResource = activeWidget?.viewModel?.sessionResource;
    const bubbleToTop = (resource) => {
      if (!resource) {
        return;
      }
      const idx = sessionResources.findIndex((r) => r.toString() === resource.toString());
      if (idx > 0) {
        sessionResources.splice(idx, 1);
        sessionResources.unshift(resource);
      }
    };
    bubbleToTop(this._lastOpenedSessionResource);
    bubbleToTop(activeSessionResource);
    DOM.append(this.scrollContent, $(
      "p.chat-debug-home-subtitle",
      void 0,
      sessionResources.length > 0 ? localize("chatDebug.homeSubtitle", "Select a chat session to debug") : localize("chatDebug.noSessions", "Send a chat message to get started")
    ));
    if (sessionResources.length > 0) {
      const visibleSessions = sessionResources.slice(0, this._visibleCount);
      const sessionList = DOM.append(this.scrollContent, $(".chat-debug-home-session-list"));
      sessionList.setAttribute("role", "list");
      sessionList.setAttribute("aria-label", localize("chatDebug.sessionList", "Chat sessions"));
      const items = [];
      for (const sessionResource of visibleSessions) {
        const agentSession = this.agentSessionsService.model.getSession(sessionResource);
        const rawTitle = agentSession?.label ?? this.chatService.getSessionTitle(sessionResource);
        const importedTitle = this.chatDebugService.getImportedSessionTitle(sessionResource);
        const historicalTitle = this.chatDebugService.getHistoricalSessionTitle(sessionResource);
        let sessionTitle;
        if (rawTitle && !isUUID(rawTitle)) {
          sessionTitle = rawTitle;
        } else if (historicalTitle) {
          sessionTitle = historicalTitle;
        } else if (importedTitle) {
          sessionTitle = localize("chatDebug.importedSession", "Imported: {0}", importedTitle);
        } else if (LocalChatSessionUri.isLocalSession(sessionResource)) {
          sessionTitle = localize("chatDebug.newSession", "New Chat");
        } else if (getChatSessionType(sessionResource) === "copilotcli") {
          const pathId = sessionResource.path.replace(/^\//, "").split("-")[0];
          const shortId = pathId || sessionResource.authority || sessionResource.toString();
          sessionTitle = localize("chatDebug.copilotCliSessionWithId", "Copilot CLI: {0}", shortId);
        } else {
          sessionTitle = localize("chatDebug.newSession", "New Chat");
        }
        const isActive = activeSessionResource !== void 0 && sessionResource.toString() === activeSessionResource.toString();
        const item = DOM.append(sessionList, $("button.chat-debug-home-session-item"));
        item.setAttribute("role", "listitem");
        if (isActive) {
          item.classList.add("chat-debug-home-session-item-active");
          item.setAttribute("aria-current", "true");
        }
        DOM.append(item, $(`span${ThemeIcon.asCSSSelector(Codicon.comment)}`));
        const titleSpan = DOM.append(item, $("span.chat-debug-home-session-item-title"));
        titleSpan.textContent = sessionTitle;
        const ariaLabel = isActive ? localize("chatDebug.sessionItemActive", "{0} (active)", sessionTitle) : sessionTitle;
        item.setAttribute("aria-label", ariaLabel);
        if (isActive) {
          DOM.append(item, $("span.chat-debug-home-session-badge", void 0, localize("chatDebug.active", "Active")));
        }
        this.renderDisposables.add(DOM.addDisposableListener(item, DOM.EventType.CLICK, () => {
          this._lastOpenedSessionResource = sessionResource;
          this._onNavigateToSession.fire(sessionResource);
        }));
        items.push(item);
      }
      if (sessionResources.length > this._visibleCount) {
        const remaining = sessionResources.length - this._visibleCount;
        const showMoreButton = this.renderDisposables.add(new Button(this.scrollContent, { ...defaultButtonStyles, secondary: true }));
        showMoreButton.element.classList.add("chat-debug-home-show-more");
        showMoreButton.label = localize("chatDebug.showMore", "Show More ({0})", remaining);
        this.renderDisposables.add(showMoreButton.onDidClick(() => {
          this._visibleCount += PAGE_SIZE;
          this.render();
        }));
      }
      this.renderDisposables.add(DOM.addDisposableListener(sessionList, DOM.EventType.KEY_DOWN, (e) => {
        if (items.length === 0) {
          return;
        }
        const focused = DOM.getActiveElement();
        const idx = items.indexOf(focused);
        if (idx === -1) {
          return;
        }
        let nextIdx;
        switch (e.key) {
          case "ArrowDown":
            nextIdx = idx + 1 < items.length ? idx + 1 : idx;
            break;
          case "ArrowUp":
            nextIdx = idx - 1 >= 0 ? idx - 1 : idx;
            break;
          case "Home":
            nextIdx = 0;
            break;
          case "End":
            nextIdx = items.length - 1;
            break;
        }
        if (nextIdx !== void 0) {
          e.preventDefault();
          items[nextIdx].focus();
        }
      }));
    }
  }
};
ChatDebugHomeView = __decorateClass([
  __decorateParam(1, IChatService),
  __decorateParam(2, IChatDebugService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, IAgentSessionsService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IPreferencesService)
], ChatDebugHomeView);
export {
  ChatDebugHomeView
};
