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
import "./media/sessionView.css";
import { $, size } from "../../../base/browser/dom.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { localize } from "../../../nls.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { asCssVariable } from "../../../platform/theme/common/colorUtils.js";
import { IChatViewFactory } from "../../services/chatView/browser/chatViewFactory.js";
import { ChatCompositeBar } from "./chatCompositeBar.js";
import { SessionReadOnlyBanner } from "./sessionReadOnlyBanner.js";
import { SessionHeader, SessionViewFloatingToolbar } from "./sessionHeader.js";
import { ISessionContext, SessionContext } from "../../services/sessions/browser/sessionContext.js";
import { autorun, observableFromEvent, observableValue } from "../../../base/common/observable.js";
import { SessionIsMaximizedContext } from "../../common/contextkeys.js";
import { UNARCHIVE_SESSION_COMMAND_ID } from "../../common/sessionCommands.js";
import { AGENTS_CENTERED_CONTENT_MAX_WIDTH } from "../../common/layoutConstants.js";
import { setActiveSessionContextKeys } from "../../services/sessions/common/sessionContextKeys.js";
import { activeSessionViewBackground, activeSessionViewForeground, inactiveSessionViewBackground, inactiveSessionViewForeground } from "../../common/theme.js";
import { ChatInteractivity, SessionStatus } from "../../services/sessions/common/session.js";
import { getChatSessionArchiveActionPresentation, getChatSessionArchiveActionWording } from "../../../platform/chat/common/sessionArchiveActions.js";
let SessionView = class extends Disposable {
  constructor(chatViewFactory, instantiationService, contextKeyService, commandService, configurationService) {
    super();
    this.chatViewFactory = chatViewFactory;
    this.commandService = commandService;
    this.element = $(".session-view");
    this.minimumWidth = 200;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 200;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._currentView = this._register(new MutableDisposable());
    this._openSessionDisposables = this._register(new DisposableStore());
    this._hasOpenedSession = false;
    /** Whether this view currently hosts the active session in the grid. */
    this._isActive = true;
    /** Whether the owning {@link SessionsPart} is visible in the workbench grid. */
    this._isPartVisible = true;
    /** Whether this leaf is visible within the part's internal grid. */
    this._isLeafVisible = true;
    this._sessionObs = observableValue(this, void 0);
    const scopedContextKeyService = this._scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
    this._sessionIsMaximizedKey = SessionIsMaximizedContext.bindTo(scopedContextKeyService);
    const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, scopedContextKeyService],
      [ISessionContext, new SessionContext(this._sessionObs)]
    )));
    this.element.style.setProperty("--session-view-centered-content-max-width", `${SessionView.CENTERED_CONTENT_MAX_WIDTH}px`);
    this._centeredContentContainer = $(".session-view-centered-content");
    this.element.appendChild(this._centeredContentContainer);
    this._header = this._register(scopedInstantiationService.createInstance(SessionHeader));
    this._centeredContentContainer.appendChild(this._header.element);
    this._compositeBar = this._register(scopedInstantiationService.createInstance(ChatCompositeBar));
    this._centeredContentContainer.appendChild(this._compositeBar.element);
    this._readOnlyBanner = this._register(new SessionReadOnlyBanner());
    this._centeredContentContainer.appendChild(this._readOnlyBanner.domNode);
    const archiveActionWording = observableFromEvent(
      this,
      configurationService.onDidChangeConfiguration,
      () => getChatSessionArchiveActionWording(configurationService)
    );
    this._register(autorun((reader) => {
      const session = this._sessionObs.read(reader);
      const activeChat = session?.activeChat.read(reader);
      const readOnly = !!activeChat && activeChat.interactivity.read(reader) !== ChatInteractivity.Full;
      if (readOnly) {
        const archived = !!session && session.isArchived.read(reader);
        if (archived && session) {
          const action = getChatSessionArchiveActionPresentation(archiveActionWording.read(reader)).unarchive;
          this._readOnlyBanner.setContent({
            message: localize("sessionReadOnlyBanner.archived", "Archived sessions are read-only."),
            action: {
              label: action.title.value,
              run: () => this.commandService.executeCommand(UNARCHIVE_SESSION_COMMAND_ID, session)
            }
          });
        } else {
          this._readOnlyBanner.setContent({ message: localize("sessionReadOnlyBanner.message", "This chat is read-only") });
        }
      }
      if (this._readOnlyBanner.visible !== readOnly) {
        this._readOnlyBanner.setVisible(readOnly);
        this._layoutChildren();
      }
    }));
    this._contentContainer = $(".session-view-content");
    this.element.appendChild(this._contentContainer);
    this._floatingToolbar = this._register(scopedInstantiationService.createInstance(SessionViewFloatingToolbar));
    this.element.appendChild(this._floatingToolbar.element);
    this._applyActiveSessionStyles();
    this._register(this._header.onDidChangeVisibility(() => this._layoutChildren()));
    this._register(this._header.onDidChangeHeight(() => this._layoutChildren()));
    this._register(this._compositeBar.onDidChangeVisibility(() => this._layoutChildren()));
    this._register(this._compositeBar.onDidChangeHeight(() => this._layoutChildren()));
  }
  static {
    this.TYPE = "sessions.sessionView";
  }
  static {
    this.CENTERED_CONTENT_MAX_WIDTH = AGENTS_CENTERED_CONTENT_MAX_WIDTH;
  }
  static {
    this.ACTIVE_BACKGROUND = asCssVariable(activeSessionViewBackground);
  }
  static {
    this.ACTIVE_FOREGROUND = asCssVariable(activeSessionViewForeground);
  }
  static {
    this.INACTIVE_BACKGROUND = asCssVariable(inactiveSessionViewBackground);
  }
  static {
    this.INACTIVE_FOREGROUND = asCssVariable(inactiveSessionViewForeground);
  }
  openSession(session, options) {
    if (this._hasOpenedSession && this._currentSession === session) {
      return;
    }
    this._hasOpenedSession = true;
    this._currentSession = session;
    this._sessionObs.set(session, void 0);
    this._openSessionDisposables.clear();
    this._openSessionDisposables.add(this._handleContextKeys(session));
    this._openSessionDisposables.add(autorun((reader) => {
      let desiredKind;
      if (session === void 0 || session.isCreated.read(reader) === false) {
        desiredKind = "newSession";
      } else if (session.activeChat.read(reader).status.read(reader) === SessionStatus.Untitled && session.activeChat.read(reader).interactivity.read(reader) === ChatInteractivity.Full) {
        desiredKind = "newChatInSession";
      } else {
        desiredKind = "chat";
      }
      let view = this._currentView.value;
      if (!view || view.kind !== desiredKind) {
        view = desiredKind === "chat" ? this.chatViewFactory.createChatView() : this.chatViewFactory.createNewChatView(desiredKind === "newChatInSession", options);
        this._contentContainer.replaceChildren(view.element);
        this._currentView.value = view;
        view.setActive(this._isActive);
        view.setVisible(this._isVisible);
      }
      if (session) {
        view.setChat(session.activeChat.read(reader), session.sessionId);
      }
      this._header.setSession(session);
      this._compositeBar.setSession(session);
      this._floatingToolbar.setSession(session);
      this._layoutChildren();
    }));
  }
  _handleContextKeys(session) {
    return autorun((reader) => {
      setActiveSessionContextKeys(session, this._scopedContextKeyService, reader);
    });
  }
  layout(width, height, top, left) {
    size(this.element, width, height);
    this._lastLayout = { width, height, top, left };
    this._layoutChildren();
  }
  _layoutChildren() {
    if (!this._lastLayout) {
      return;
    }
    const { width, height, top, left } = this._lastLayout;
    if (!this._isVisible || width === 0 || height === 0) {
      return;
    }
    const centeredWidth = Math.min(width, SessionView.CENTERED_CONTENT_MAX_WIDTH);
    this._centeredContentContainer.style.width = `${centeredWidth}px`;
    const headerHeight = this._header.visible ? this._header.height : 0;
    const tabsHeight = this._compositeBar.visible ? this._compositeBar.height : 0;
    const bannerHeight = this._readOnlyBanner.visible ? this._readOnlyBanner.domNode.offsetHeight : 0;
    const barHeight = headerHeight + tabsHeight + bannerHeight;
    size(this._centeredContentContainer, centeredWidth, barHeight);
    this._currentView.value?.layout(width, height - barHeight, top + barHeight, left);
  }
  toJSON() {
    return { type: SessionView.TYPE };
  }
  focus() {
    this._currentView.value?.focus();
  }
  startTitleEditing() {
    this._header.startTitleEditing();
  }
  selectWorkspace(folderUri, providerId) {
    this._currentView.value?.selectWorkspace(folderUri, providerId);
  }
  prefillInput(text) {
    this._currentView.value?.prefillInput(text);
  }
  sendQuery(text) {
    this._currentView.value?.sendQuery(text);
  }
  submitInput() {
    return this._currentView.value?.submitInput() ?? Promise.resolve(false);
  }
  /**
   * Attaches the given resources as context to the hosted chat view's input.
   */
  attach(uris) {
    this._currentView.value?.attach(uris);
  }
  /**
   * Updates the view's maximized context key so toolbars hosted within can react.
   * Called by the owning {@link SessionsPart} when the grid's maximized view changes.
   */
  setMaximized(maximized) {
    this._sessionIsMaximizedKey.set(maximized);
  }
  /**
   * Updates whether this view currently hosts the active session in the grid.
   * Forwarded to the inner chat view so it can adjust its visual styling
   * (e.g. dim the list background for inactive sessions).
   */
  setActive(active) {
    if (this._isActive === active) {
      return;
    }
    this._isActive = active;
    this._applyActiveSessionStyles();
    this._currentView.value?.setActive(active);
  }
  /**
   * Grid hook invoked by the part's internal split view when this leaf is
   * hidden or shown (e.g. when a sibling session is maximized).
   */
  setVisible(visible) {
    if (this._isLeafVisible === visible) {
      return;
    }
    const wasVisible = this._isVisible;
    this._isLeafVisible = visible;
    this._updateVisibility(wasVisible);
  }
  /**
   * Called by the owning {@link SessionsPart} when the part itself is hidden or
   * shown in the workbench grid. Combined with this leaf's own visibility to
   * form the view's effective visibility.
   */
  setPartVisible(visible) {
    if (this._isPartVisible === visible) {
      return;
    }
    const wasVisible = this._isVisible;
    this._isPartVisible = visible;
    this._updateVisibility(wasVisible);
  }
  /**
   * Whether this view is actually shown. Unrelated to {@link setActive}:
   * inactive sessions shown side by side are still visible.
   */
  get _isVisible() {
    return this._isPartVisible && this._isLeafVisible;
  }
  _updateVisibility(wasVisible) {
    const visible = this._isVisible;
    if (visible === wasVisible) {
      return;
    }
    this._currentView.value?.setVisible(visible);
    if (visible) {
      this._layoutChildren();
    }
  }
  _applyActiveSessionStyles() {
    const background = this._isActive ? SessionView.ACTIVE_BACKGROUND : SessionView.INACTIVE_BACKGROUND;
    const foreground = this._isActive ? SessionView.ACTIVE_FOREGROUND : SessionView.INACTIVE_FOREGROUND;
    this.element.style.setProperty("--session-view-background", background);
    this.element.style.setProperty("--session-view-foreground", foreground);
    this.element.style.setProperty("--part-background", background);
    this.element.style.setProperty("--part-foreground", foreground);
  }
};
SessionView = __decorateClass([
  __decorateParam(0, IChatViewFactory),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IConfigurationService)
], SessionView);
export {
  SessionView
};
