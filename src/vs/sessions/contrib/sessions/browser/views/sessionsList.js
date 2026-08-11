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
import "../media/sessionsList.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { pauseCSSAnimationsWhenHidden, synchronizeCSSAnimations } from "../../../../../base/browser/animationSync.js";
import { Gesture } from "../../../../../base/browser/touch.js";
import { ListDragOverEffectPosition, ListDragOverEffectType, NotSelectableGroupId } from "../../../../../base/browser/ui/list/list.js";
import { ObjectTreeElementCollapseState } from "../../../../../base/browser/ui/tree/tree.js";
import { RenderIndentGuides, TreeFindMode } from "../../../../../base/browser/ui/tree/abstractTree.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { HighlightedLabel } from "../../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { createMatches } from "../../../../../base/common/filters.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { autorun, derived, observableSignalFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { fromNow } from "../../../../../base/common/date.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { localize } from "../../../../../nls.js";
import { MenuId, IMenuService, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { MarshalledId } from "../../../../../base/common/marshallingIds.js";
import { SessionProviderIdContext, SessionSupportsDeleteContext, SessionSupportsRenameContext, SessionTypeContext, IsPhoneLayoutContext, SessionIsArchivedContext, SessionIsReadContext, SessionHasPullRequestContext } from "../../../../common/contextkeys.js";
import { RENAME_SESSION_COMMAND_ID } from "../../../../common/sessionCommands.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { WorkbenchObjectTree } from "../../../../../platform/list/browser/listService.js";
import { defaultButtonStyles, defaultFindWidgetStyles, defaultInputBoxStyles, defaultToggleStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { asCssVariable } from "../../../../../platform/theme/common/colorUtils.js";
import { chartsOrange } from "../../../../../platform/theme/common/colors/chartsColors.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ChatSessionArchiveActionWording, ChatSessionArchiveActionWordingSettingId, getChatSessionArchivedSectionLabel, getChatSessionArchiveActionWording } from "../../../../../platform/chat/common/sessionArchiveActions.js";
import { getSessionWorkspaceKind, GITHUB_REMOTE_FILE_SCHEME, SessionStatus, SessionWorkspaceKind } from "../../../../services/sessions/common/session.js";
import { AgentSessionApprovalModel, agentSessionApprovalId } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentSessionApprovalModel.js";
import { IVoicePlaybackService } from "../../../../../workbench/contrib/chat/common/voicePlaybackService.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { Action, ActionRunner, Separator, SubmenuAction } from "../../../../../base/common/actions.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { HoverStyle } from "../../../../../base/browser/ui/hover/hover.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ISessionsManagementService } from "../../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ISessionsListModelService } from "../../../../services/sessions/browser/sessionsListModelService.js";
import { ISessionGroupsService } from "../../../../services/sessions/browser/sessionGroupsService.js";
import { ISessionSectionOrderService } from "../../../../services/sessions/browser/sessionSectionOrderService.js";
import { InputBox } from "../../../../../base/browser/ui/inputbox/inputBox.js";
import { IWorkbenchAssignmentService } from "../../../../../workbench/services/assignment/common/assignmentService.js";
import { IAgentSessionsService } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentSessionsService.js";
import { IAgentHostFilterService } from "../../../../services/agentHostFilter/common/agentHostFilter.js";
import { LocalSelectionTransfer } from "../../../../../platform/dnd/browser/dnd.js";
import { DraggedSessionIdentifier, SessionsDataTransfers } from "../../../../browser/dnd.js";
import { ElementsDragAndDropData, ListViewTargetSector } from "../../../../../base/browser/ui/list/listView.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { buildSessionHoverContent } from "../sessionHoverContent.js";
import { SessionStatusIcon } from "../../../../browser/sessionStatusIcon.js";
import { ChatAutomationsEnabledContext } from "../../../../../workbench/contrib/chat/common/automations/automationsEnabled.js";
import { IAutomationService } from "../../../../../workbench/contrib/chat/common/automations/automationService.js";
import { ICustomViewService } from "../../../../services/customView/browser/customViewService.js";
import { AUTOMATIONS_CUSTOM_VIEW_ID } from "./automationsView.js";
const $ = DOM.$;
const AUTOMATIONS_SECTION_ID = "automations";
const SESSION_SECTION_FOCUS_FROM_POINTER_CLASS = "session-section-focus-from-pointer";
const SESSION_HEADER_DROP_TARGET_CLASS = "session-header-drop-target";
const SessionItemToolbarMenuId = new MenuId("SessionItemToolbar");
const SessionItemContextMenuId = MenuId.SessionItemContextMenu;
const SessionSectionToolbarMenuId = new MenuId("SessionSectionToolbar");
const SessionGroupToolbarMenuId = new MenuId("SessionGroupToolbar");
const SESSIONS_LIST_SHOW_EMPTY_DEFAULT_GROUPS_SETTING = "sessions.list.showEmptyDefaultGroups";
const IsSessionPinnedContext = new RawContextKey("sessionItem.isPinned", false);
const SessionItemHasBranchNameContext = new RawContextKey("sessionItem.hasBranchName", false);
const SessionItemStatusContext = new RawContextKey("sessionItem.status", SessionStatus.Completed);
const SessionItemInGroupContext = new RawContextKey("sessionItem.inGroup", false);
const SessionSectionTypeContext = new RawContextKey("sessionSection.type", "");
const SessionGroupHasVisibleSessionsContext = new RawContextKey("sessionGroup.hasVisibleSessions", false);
const SessionGroupIsEmptyContext = new RawContextKey("sessionGroup.isEmpty", false);
var SessionsGrouping = /* @__PURE__ */ ((SessionsGrouping2) => {
  SessionsGrouping2["Workspace"] = "workspace";
  SessionsGrouping2["Date"] = "date";
  return SessionsGrouping2;
})(SessionsGrouping || {});
var SessionsSorting = /* @__PURE__ */ ((SessionsSorting2) => {
  SessionsSorting2["Created"] = "created";
  SessionsSorting2["Updated"] = "updated";
  return SessionsSorting2;
})(SessionsSorting || {});
function sortingToMode(sorting) {
  return sorting === "updated" /* Updated */ ? "updated" : "created";
}
const SORT_FALLBACK_STEP_MS = 6e4;
function isSessionGroupItem(item) {
  return "group" in item;
}
function isSessionSection(item) {
  return !isSessionGroupItem(item) && "sessions" in item && Array.isArray(item.sessions);
}
function isSessionShowMore(item) {
  return "showMore" in item && item.showMore === true;
}
function isSessionPlaceholder(item) {
  return "placeholder" in item && item.placeholder === true;
}
function isSessionItem(item) {
  return !isSessionGroupItem(item) && !isSessionSection(item) && !isSessionShowMore(item) && !isSessionPlaceholder(item);
}
const SHOW_MORE_FOLDERS_LABEL = "__more_folders__";
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1e3;
const DEFAULT_APPROVAL_ROW_MAX_LINES = 3;
class SessionsTreeDelegate {
  constructor(_approvalModel, _isPhone, _approvalRowMaxLines = DEFAULT_APPROVAL_ROW_MAX_LINES, _ciFixModel = void 0) {
    this._approvalModel = _approvalModel;
    this._isPhone = _isPhone;
    this._approvalRowMaxLines = _approvalRowMaxLines;
    this._ciFixModel = _ciFixModel;
  }
  static {
    this.ITEM_HEIGHT = 54;
  }
  static {
    /** Quick-chat rows are single-line — see the `.session-item.quick-chat` rules in `sessionsList.css`. */
    this.ITEM_HEIGHT_QUICK_CHAT = 28;
  }
  static {
    /**
     * Phone layout uses a taller row so the inline action toolbar can
     * meet the 44px minimum touch target without overflowing. Sized to
     * fit a 44px toolbar centered between the title and details rows.
     * Keep in sync with the `.phone-layout .session-item` rules in
     * `sessionsList.css`.
     */
    this.ITEM_HEIGHT_PHONE = 76;
  }
  static {
    this.SECTION_HEIGHT = 26;
  }
  static {
    this.SHOW_MORE_HEIGHT = 26;
  }
  static {
    this.PLACEHOLDER_HEIGHT = 26;
  }
  getHeight(element) {
    if (isSessionSection(element) || isSessionGroupItem(element)) {
      return SessionsTreeDelegate.SECTION_HEIGHT;
    }
    if (isSessionShowMore(element)) {
      return SessionsTreeDelegate.SHOW_MORE_HEIGHT;
    }
    if (isSessionPlaceholder(element)) {
      return SessionsTreeDelegate.PLACEHOLDER_HEIGHT;
    }
    let height;
    if (this._isPhone()) {
      height = SessionsTreeDelegate.ITEM_HEIGHT_PHONE;
    } else if (isQuickChatSession(element)) {
      height = SessionsTreeDelegate.ITEM_HEIGHT_QUICK_CHAT;
    } else {
      height = SessionsTreeDelegate.ITEM_HEIGHT;
    }
    if (this._approvalModel) {
      const approval = getFirstApprovalAcrossChats(this._approvalModel, element, void 0);
      if (approval) {
        height += SessionItemRenderer.getApprovalRowHeight(approval.label, this._approvalRowMaxLines);
      }
    }
    if (this._ciFixModel && this._ciFixModel.getCIFix(element).get()) {
      height += SessionItemRenderer.CI_ROW_HEIGHT;
    }
    return height;
  }
  hasDynamicHeight(element) {
    return (!!this._approvalModel || !!this._ciFixModel) && isSessionItem(element);
  }
  getTemplateId(element) {
    if (isSessionGroupItem(element)) {
      return SessionGroupRenderer.TEMPLATE_ID;
    }
    if (isSessionSection(element)) {
      return SessionSectionRenderer.TEMPLATE_ID;
    }
    if (isSessionShowMore(element)) {
      return SessionShowMoreRenderer.TEMPLATE_ID;
    }
    if (isSessionPlaceholder(element)) {
      return SessionPlaceholderRenderer.TEMPLATE_ID;
    }
    return SessionItemRenderer.TEMPLATE_ID;
  }
}
class SessionItemActionRunner extends ActionRunner {
  constructor(getMultiSelectedSessions, handleAction) {
    super();
    this.getMultiSelectedSessions = getMultiSelectedSessions;
    this.handleAction = handleAction;
  }
  async runAction(action, context) {
    if (context && !Array.isArray(context)) {
      if (this.handleAction && await this.handleAction(action, context)) {
        return;
      }
      await super.runAction(action, this.getMultiSelectedSessions(context));
      return;
    }
    await super.runAction(action, context);
  }
}
const SESSION_TITLE_SHIMMER_ANIMATION_NAME = "session-title-shimmer";
const SESSION_TITLE_SHIMMER_ANIMATION_NAMES = /* @__PURE__ */ new Set([SESSION_TITLE_SHIMMER_ANIMATION_NAME]);
const SESSION_TITLE_SHIMMER_PAUSED_CLASS = "session-title-shimmer-paused";
class SessionItemRenderer {
  constructor(options, approvalModel, ciFixModel, instantiationService, contextKeyService, markdownRendererService, hoverService, sessionsProvidersService, agentSessionsService, _voicePlaybackService) {
    this.options = options;
    this.approvalModel = approvalModel;
    this.ciFixModel = ciFixModel;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.markdownRendererService = markdownRendererService;
    this.hoverService = hoverService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.agentSessionsService = agentSessionsService;
    this._voicePlaybackService = _voicePlaybackService;
    this.templateId = SessionItemRenderer.TEMPLATE_ID;
    this._onDidChangeItemHeight = new Emitter();
    this.onDidChangeItemHeight = this._onDidChangeItemHeight.event;
    this._onDidApproveSession = new Emitter();
    /** Fires when the user approves a session's pending action via its "Allow" button. */
    this.onDidApproveSession = this._onDidApproveSession.event;
  }
  static {
    this.TEMPLATE_ID = "session-item";
  }
  static {
    this._APPROVAL_ROW_LINE_HEIGHT = 18;
  }
  static {
    this._APPROVAL_ROW_OVERHEAD = 14;
  }
  static {
    /** Height of the single-line "Fix CI" row (label + orange button), including its top margin. */
    this.CI_ROW_HEIGHT = 32;
  }
  static getApprovalRowHeight(label, maxLines = DEFAULT_APPROVAL_ROW_MAX_LINES) {
    const lineCount = Math.min(label.split(/\r?\n/).length, maxLines);
    return lineCount * SessionItemRenderer._APPROVAL_ROW_LINE_HEIGHT + SessionItemRenderer._APPROVAL_ROW_OVERHEAD;
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    container.classList.add("session-item");
    const iconContainer = DOM.append(container, $(".session-icon"));
    const statusIcon = disposables.add(this.instantiationService.createInstance(SessionStatusIcon, iconContainer));
    const mainCol = DOM.append(container, $(".session-main"));
    const titleRow = DOM.append(mainCol, $(".session-title-row"));
    const titleContainer = DOM.append(titleRow, $(".session-title"));
    const title = disposables.add(new HighlightedLabel(titleContainer));
    disposables.add(DOM.addDisposableListener(titleContainer, DOM.EventType.ANIMATION_START, (e) => {
      if (e.target === titleContainer && e.animationName === SESSION_TITLE_SHIMMER_ANIMATION_NAME) {
        synchronizeCSSAnimations(titleContainer, { animationNames: SESSION_TITLE_SHIMMER_ANIMATION_NAMES });
      }
    }));
    disposables.add(pauseCSSAnimationsWhenHidden(titleContainer, {
      pausedClass: SESSION_TITLE_SHIMMER_PAUSED_CLASS,
      animationNames: SESSION_TITLE_SHIMMER_ANIMATION_NAMES
    }));
    const titleToolbarContainer = DOM.append(titleRow, $(".session-title-toolbar"));
    const pendingVoiceIndicator = DOM.append(titleRow, $(".session-pending-voice-indicator"));
    for (const eventType of ["pointerdown", "pointerup", "click", "dblclick"]) {
      disposables.add(DOM.addDisposableListener(titleToolbarContainer, eventType, (e) => e.stopPropagation()));
    }
    disposables.add(Gesture.ignoreTarget(titleToolbarContainer));
    const detailsRow = DOM.append(mainCol, $(".session-details-row"));
    const approvalRow = DOM.append(mainCol, $(".session-approval-row"));
    const approvalLabel = DOM.append(approvalRow, $("span.session-approval-label"));
    const approvalButtonContainer = DOM.append(approvalRow, $(".session-approval-button"));
    const ciRow = DOM.append(mainCol, $(".session-ci-row"));
    const ciLabel = DOM.append(ciRow, $("span.session-ci-label"));
    const ciButtonContainer = DOM.append(ciRow, $(".session-ci-button"));
    for (const eventType of ["pointerdown", "pointerup", "click", "dblclick"]) {
      disposables.add(DOM.addDisposableListener(ciRow, eventType, (e) => e.stopPropagation()));
    }
    disposables.add(Gesture.ignoreTarget(ciRow));
    const contextKeyService = disposables.add(this.contextKeyService.createScoped(container));
    const statusContext = SessionItemStatusContext.bindTo(contextKeyService);
    const isReadContext = SessionIsReadContext.bindTo(contextKeyService);
    const scopedInstantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    let titleToolbar;
    if (this.options.toolbarMenuId) {
      const actionRunner = disposables.add(new SessionItemActionRunner(this.options.getMultiSelectedSessions, this.options.handleToolbarAction));
      titleToolbar = disposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, titleToolbarContainer, this.options.toolbarMenuId, {
        menuOptions: { shouldForwardArgs: true },
        actionRunner
      }));
    }
    return { container, statusIcon, title, titleContainer, titleToolbar, pendingVoiceIndicator, detailsRow, approvalRow, approvalLabel, approvalButtonContainer, ciRow, ciLabel, ciButtonContainer, contextKeyService, statusContext, isReadContext, disposables, elementDisposables };
  }
  renderElement(node, _index, template) {
    const element = node.element;
    if (!isSessionItem(element)) {
      return;
    }
    this.renderSession(element, template, createMatches(node.filterData));
  }
  renderSession(element, template, matches) {
    template.elementDisposables.clear();
    if (this.options.onDidRequestRename) {
      template.elementDisposables.add(DOM.addDisposableListener(template.title.element, DOM.EventType.DBLCLICK, (event) => {
        if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !element.capabilities.get().supportsRename) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.options.onDidRequestRename?.(element);
      }));
    }
    this.agentSessionsService.model.observeSession(element.resource);
    if (this.options.showHover) {
      template.elementDisposables.add(this.hoverService.setupDelayedHover(template.container, () => ({
        content: buildSessionHoverContent(element, this.sessionsProvidersService),
        appearance: { showPointer: true },
        position: { hoverPosition: HoverPosition.RIGHT, forcePosition: true },
        persistence: { hideOnHover: false }
      }), { groupId: "sessions-list" }));
    }
    const pendingVoiceResource = element.resource;
    template.pendingVoiceIndicator.className = "session-pending-voice-indicator " + ThemeIcon.asClassName(Codicon.unmute);
    template.elementDisposables.add(this.hoverService.setupManagedHover(
      getDefaultHoverDelegate("mouse"),
      template.pendingVoiceIndicator,
      localize("pendingVoiceResponse", "Voice response ready")
    ));
    template.elementDisposables.add(autorun((reader) => {
      this._voicePlaybackService.pendingResponseVersion.read(reader);
      template.pendingVoiceIndicator.classList.toggle("visible", this._voicePlaybackService.hasPendingResponse(pendingVoiceResource));
    }));
    if (template.titleToolbar) {
      template.titleToolbar.context = element;
    }
    const isPinned = this.options.isPinned(element);
    IsSessionPinnedContext.bindTo(template.contextKeyService).set(isPinned);
    SessionIsArchivedContext.bindTo(template.contextKeyService).set(element.isArchived.get());
    SessionItemHasBranchNameContext.bindTo(template.contextKeyService).set(!!element.workspace.get()?.folders[0]?.gitRepository?.branchName?.trim());
    template.elementDisposables.add(autorun((reader) => {
      const isArchived = element.isArchived.read(reader);
      template.container.classList.toggle("archived", isArchived);
      template.container.classList.toggle("pinned", isPinned && !isArchived);
    }));
    template.elementDisposables.add(autorun((reader) => {
      const wrapper = this.options.visibleSessions.read(reader).find((s) => s?.sessionId === element.sessionId);
      const isSticky = wrapper ? wrapper.sticky.read(reader) : false;
      template.container.classList.toggle("sticky", isSticky);
    }));
    template.elementDisposables.add(autorun((reader) => {
      const sessionStatus = element.status.read(reader);
      template.statusContext.set(sessionStatus);
      const isRead = element.isRead.read(reader);
      template.isReadContext.set(isRead);
      const isArchived = element.isArchived.read(reader);
      const gitHubInfo = element.workspace.read(reader)?.folders[0]?.gitRepository?.gitHubInfo.read(reader);
      const isQuickChat = element.isQuickChat?.read(reader) ?? false;
      const completedStateIcon = gitHubInfo?.pullRequest?.icon;
      template.statusIcon.setStatus(sessionStatus, isRead, isArchived, completedStateIcon, element.resource);
      template.container.classList.toggle("in-progress", sessionStatus === SessionStatus.InProgress);
      template.container.classList.toggle("needs-input", sessionStatus === SessionStatus.NeedsInput);
      template.container.classList.toggle("unread", !isRead && !isArchived);
      template.container.classList.toggle("quick-chat", isQuickChat);
    }));
    template.elementDisposables.add(autorun((reader) => {
      const titleText = element.title.read(reader);
      template.title.set(titleText, matches);
    }));
    const timeDisposable = template.elementDisposables.add(new MutableDisposable());
    const descriptionDisposable = template.elementDisposables.add(new MutableDisposable());
    template.elementDisposables.add(autorun((reader) => {
      const sessionStatus = element.status.read(reader);
      const workspace = element.workspace.read(reader);
      const description = element.description.read(reader);
      const isQuickChat = element.isQuickChat?.read(reader) ?? false;
      DOM.clearNode(template.detailsRow);
      if (isQuickChat) {
        descriptionDisposable.clear();
        timeDisposable.clear();
        return;
      }
      const changes = element.changes.read(reader);
      const changesSummary = element.changesSummary?.read(reader);
      let timeDate;
      const hideDetails = sessionStatus === SessionStatus.InProgress || sessionStatus === SessionStatus.NeedsInput;
      if (!hideDetails) {
        timeDate = element.updatedAt.read(reader);
      }
      const parts = [];
      if (sessionStatus !== SessionStatus.InProgress) {
        const kind = getSessionWorkspaceKind(workspace, element.worktreePending?.read(reader));
        const icon = kind === SessionWorkspaceKind.Virtual ? Codicon.cloudCompact : kind === SessionWorkspaceKind.Folder ? Codicon.folderCompact : Codicon.worktreeCompact;
        const typeIconEl = DOM.append(template.detailsRow, $("span.session-details-icon"));
        DOM.append(typeIconEl, $(`span${ThemeIcon.asCSSSelector(icon)}`));
        parts.push(typeIconEl);
      }
      if (!hideDetails && workspace && (this.options.grouping() !== "workspace" /* Workspace */ || this.options.isPinned(element) || element.isArchived.read(reader))) {
        const badgeLabel = this.getWorkspaceBadgeLabel(workspace);
        if (badgeLabel) {
          const badgeEl = DOM.append(template.detailsRow, $("span.session-badge"));
          badgeEl.textContent = badgeLabel;
          parts.push(badgeEl);
        }
      }
      if (!hideDetails && (changesSummary || changes.length > 0)) {
        let insertions = 0, deletions = 0;
        if (changesSummary) {
          insertions = changesSummary.additions;
          deletions = changesSummary.deletions;
        } else if (changes.length > 0) {
          for (const change of changes) {
            insertions += change.insertions;
            deletions += change.deletions;
          }
        }
        if (insertions > 0 || deletions > 0) {
          if (parts.length > 0) {
            DOM.append(template.detailsRow, $("span.session-separator.has-separator"));
          }
          const diffEl = DOM.append(template.detailsRow, $("span.session-diff"));
          DOM.append(diffEl, $("span.session-diff-added")).textContent = `+${insertions}`;
          DOM.append(diffEl, $("span.session-diff-removed")).textContent = `-${deletions}`;
          parts.push(diffEl);
        }
      }
      if (sessionStatus === SessionStatus.InProgress) {
        if (parts.length > 0) {
          DOM.append(template.detailsRow, $("span.session-separator.has-separator"));
        }
        const statusEl = DOM.append(template.detailsRow, $("span.session-description"));
        if (description) {
          descriptionDisposable.value = this.markdownRendererService.render(description, { sanitizerConfig: { replaceWithPlaintext: true } }, statusEl);
        } else {
          descriptionDisposable.clear();
          statusEl.textContent = localize("working", "Working...");
        }
        parts.push(statusEl);
      } else if (sessionStatus === SessionStatus.NeedsInput) {
        if (parts.length > 0) {
          DOM.append(template.detailsRow, $("span.session-separator.has-separator"));
        }
        const statusEl = DOM.append(template.detailsRow, $("span.session-description"));
        if (description) {
          descriptionDisposable.value = this.markdownRendererService.render(description, { sanitizerConfig: { replaceWithPlaintext: true } }, statusEl);
        } else {
          descriptionDisposable.clear();
          statusEl.textContent = localize("needsInput", "Input needed");
        }
        parts.push(statusEl);
      } else if (sessionStatus === SessionStatus.Error) {
        if (parts.length > 0) {
          DOM.append(template.detailsRow, $("span.session-separator.has-separator"));
        }
        const statusEl = DOM.append(template.detailsRow, $("span.session-description"));
        if (description) {
          descriptionDisposable.value = this.markdownRendererService.render(description, { sanitizerConfig: { replaceWithPlaintext: true } }, statusEl);
        } else {
          descriptionDisposable.clear();
          statusEl.textContent = localize("failed", "Failed");
        }
        parts.push(statusEl);
      } else {
        descriptionDisposable.clear();
      }
      if (!hideDetails && timeDate) {
        if (parts.length > 0) {
          DOM.append(template.detailsRow, $("span.session-separator.has-separator"));
        }
        const timeEl = DOM.append(template.detailsRow, $("span.session-time"));
        const definiteTimeDate = timeDate;
        const formatTime = () => {
          const seconds = Math.round((Date.now() - definiteTimeDate.getTime()) / 1e3);
          return seconds < 60 ? localize("secondsDuration", "now") : fromNow(definiteTimeDate, true);
        };
        timeEl.textContent = formatTime();
        const targetWindow = DOM.getWindow(timeEl);
        const interval = targetWindow.setInterval(() => {
          timeEl.textContent = formatTime();
        }, 6e4);
        timeDisposable.value = toDisposable(() => targetWindow.clearInterval(interval));
      } else {
        timeDisposable.clear();
      }
    }));
    if (this.approvalModel) {
      this.renderApprovalRow(element, template);
    }
    if (this.ciFixModel) {
      this.renderCIRow(element, template);
    }
  }
  renderApprovalRow(element, template) {
    if (!this.approvalModel) {
      return;
    }
    const approvalModel = this.approvalModel;
    const initialInfo = getFirstApprovalAcrossChats(approvalModel, element, void 0);
    let wasVisible = !!initialInfo;
    template.approvalRow.classList.toggle("visible", wasVisible);
    const buttonStore = template.elementDisposables.add(new DisposableStore());
    template.elementDisposables.add(autorun((reader) => {
      buttonStore.clear();
      const info = getFirstApprovalAcrossChats(approvalModel, element, reader);
      const visible = !!info;
      template.approvalRow.classList.toggle("visible", visible);
      if (info) {
        const lines = info.label.split("\n");
        const maxLines = this.options.approvalRowMaxLines;
        const visibleLines = lines.slice(0, maxLines);
        if (lines.length > maxLines) {
          visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1]} \u2026`;
        }
        const langId = info.languageId ?? "json";
        const labelContent = new MarkdownString();
        for (const line of visibleLines) {
          labelContent.appendCodeblock(langId, line);
        }
        template.approvalLabel.textContent = "";
        buttonStore.add(this.markdownRendererService.render(labelContent, {}, template.approvalLabel));
        if (this.options.showHover) {
          const fullContent = new MarkdownString().appendCodeblock(info.languageId ?? "json", info.label);
          buttonStore.add(this.hoverService.setupDelayedHover(template.approvalLabel, {
            content: fullContent,
            style: HoverStyle.Pointer,
            position: { hoverPosition: HoverPosition.BELOW }
          }));
        }
        template.approvalButtonContainer.textContent = "";
        const button = buttonStore.add(new Button(template.approvalButtonContainer, {
          title: localize("allowActionOnce", "Allow once"),
          secondary: true,
          ...defaultButtonStyles
        }));
        button.label = localize("allowAction", "Allow");
        buttonStore.add(button.onDidClick(() => {
          const approvalId = agentSessionApprovalId(info);
          info.confirm();
          this._onDidApproveSession.fire({ session: element, approvalId });
        }));
      }
      if (wasVisible !== visible) {
        wasVisible = visible;
        this._onDidChangeItemHeight.fire(element);
      }
    }));
  }
  renderCIRow(element, template) {
    if (!this.ciFixModel) {
      return;
    }
    const ciFixModel = this.ciFixModel;
    const stateObs = ciFixModel.getCIFix(element);
    let wasVisible = !!stateObs.get();
    template.ciRow.classList.toggle("visible", wasVisible);
    const buttonStore = template.elementDisposables.add(new DisposableStore());
    template.elementDisposables.add(autorun((reader) => {
      buttonStore.clear();
      const state = stateObs.read(reader);
      const visible = !!state;
      template.ciRow.classList.toggle("visible", visible);
      if (state) {
        template.ciLabel.textContent = localize("ci.blockedRow", "{0} checks failed, {1} pending", state.failed, state.pending);
        template.ciButtonContainer.textContent = "";
        const button = buttonStore.add(new Button(template.ciButtonContainer, {
          title: localize("ci.fixCITooltip", "Fix failing CI checks"),
          ...defaultButtonStyles,
          buttonBackground: asCssVariable(chartsOrange),
          buttonHoverBackground: `color-mix(in srgb, ${asCssVariable(chartsOrange)} 88%, black)`,
          buttonBorder: asCssVariable(chartsOrange)
        }));
        button.label = localize("ci.fixCI", "Fix CI");
        buttonStore.add(button.onDidClick(() => ciFixModel.fixCI(element)));
      }
      if (wasVisible !== visible) {
        wasVisible = visible;
        this._onDidChangeItemHeight.fire(element);
      }
    }));
  }
  getWorkspaceBadgeLabel(workspace) {
    const folder = workspace.folders[0];
    if (folder?.root.scheme === GITHUB_REMOTE_FILE_SCHEME) {
      const parts = folder.root.path.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }
    return workspace.label;
  }
  disposeElement(node, _index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(template) {
    template.disposables.dispose();
  }
}
class SessionSectionRenderer {
  constructor(hideSectionCount, instantiationService, contextKeyService, automationService, sessionsManagementService, customViewService) {
    this.hideSectionCount = hideSectionCount;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.automationService = automationService;
    this.sessionsManagementService = sessionsManagementService;
    this.customViewService = customViewService;
    this.templateId = SessionSectionRenderer.TEMPLATE_ID;
    this.templatesByElement = /* @__PURE__ */ new WeakMap();
    this.templatesById = /* @__PURE__ */ new Map();
    this.automationStatus = derived(this, (reader) => {
      const runs = this.automationService.runs.read(reader);
      if (runs.some((run) => run.status === "pending" || run.status === "running")) {
        return SessionStatus.InProgress;
      }
      const hasUnreadRun = runs.some((run) => {
        if (run.status !== "completed" && run.status !== "failed" || !run.sessionResource) {
          return false;
        }
        const session = this.sessionsManagementService.getSession(URI.parse(run.sessionResource));
        return !!session && !session.isRead.read(reader);
      });
      if (hasUnreadRun) {
        return SessionStatus.Completed;
      }
      return void 0;
    });
  }
  static {
    this.TEMPLATE_ID = "session-section";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    container.classList.add("session-section");
    const icon = DOM.append(container, $("span.session-section-icon"));
    icon.setAttribute("aria-hidden", "true");
    const label = DOM.append(container, $("span.session-section-label"));
    const statusIndicator = DOM.append(container, $("span.session-section-status-indicator"));
    statusIndicator.setAttribute("aria-hidden", "true");
    const count = DOM.append(container, $("span.session-section-count"));
    const toolbarContainer = DOM.append(container, $(".session-section-toolbar"));
    const chevron = DOM.append(container, $("span.session-section-chevron"));
    chevron.setAttribute("aria-hidden", "true");
    const contextKeyService = disposables.add(this.contextKeyService.createScoped(container));
    const scopedInstantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const toolbar = disposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, toolbarContainer, SessionSectionToolbarMenuId, {
      menuOptions: { shouldForwardArgs: true }
    }));
    return { container, icon, statusIndicator, label, count, toolbar, chevron, contextKeyService, disposables, elementDisposables };
  }
  renderElement(node, _index, template) {
    const element = node.element;
    if (!isSessionSection(element)) {
      return;
    }
    template.elementDisposables.clear();
    this.templatesByElement.set(element, template);
    this.templatesById.set(element.id, template);
    template.container.classList.remove(SESSION_HEADER_DROP_TARGET_CLASS);
    template.container.classList.remove("session-section-shortcut");
    if (element.id === AUTOMATIONS_SECTION_ID) {
      template.container.classList.add("session-section-shortcut");
    }
    const sectionIcon = element.id === QUICK_CHATS_SECTION_ID ? Codicon.commentDiscussion : element.id === "pinned" ? Codicon.pinned : element.id === AUTOMATIONS_SECTION_ID ? Codicon.watch : void 0;
    template.icon.className = sectionIcon ? `session-section-icon ${ThemeIcon.asClassName(sectionIcon)}` : "session-section-icon";
    template.icon.style.display = sectionIcon ? "" : "none";
    if (element.id === AUTOMATIONS_SECTION_ID) {
      template.elementDisposables.add(autorun((reader) => {
        const activeCustomView = this.customViewService.activeCustomView.read(reader);
        template.container.classList.toggle("active", activeCustomView?.id === AUTOMATIONS_CUSTOM_VIEW_ID);
      }));
      DOM.clearNode(template.statusIndicator);
      const statusIcon = template.elementDisposables.add(this.instantiationService.createInstance(SessionStatusIcon, template.statusIndicator));
      template.elementDisposables.add(autorun((reader) => {
        const automationStatus = this.automationStatus.read(reader);
        if (automationStatus === SessionStatus.InProgress) {
          template.statusIndicator.style.display = "";
          statusIcon.setStatus(SessionStatus.InProgress, true, false);
        } else if (automationStatus === SessionStatus.Completed) {
          template.statusIndicator.style.display = "";
          statusIcon.setStatus(SessionStatus.Completed, false, false);
        } else {
          template.statusIndicator.style.display = "none";
        }
      }));
    } else {
      template.statusIndicator.style.display = "none";
      DOM.clearNode(template.statusIndicator);
    }
    template.label.textContent = element.label;
    if (this.hideSectionCount || element.id === AUTOMATIONS_SECTION_ID) {
      template.count.textContent = "";
      template.count.style.display = "none";
    } else {
      template.count.textContent = String(element.sessions.length);
      template.count.style.display = "";
    }
    this.updateChevron(template, node.collapsible, node.collapsed);
    const sectionType = element.id.startsWith("workspace:") ? "workspace" : element.id;
    SessionSectionTypeContext.bindTo(template.contextKeyService).set(sectionType);
    template.toolbar.context = element;
  }
  /**
   * Updates the expand/collapse chevron for an already-rendered section. The
   * tree only re-invokes `renderTwistie` (not `renderElement`) when a section's
   * collapse state toggles, so the owning list forwards collapse changes here.
   */
  updateCollapseState(element, collapsed) {
    const template = this.templatesByElement.get(element);
    if (template) {
      this.updateChevron(template, true, collapsed);
    }
  }
  setDropTarget(sectionId, active) {
    const template = this.templatesById.get(sectionId);
    template?.container.classList.toggle(SESSION_HEADER_DROP_TARGET_CLASS, active);
  }
  updateChevron(template, collapsible, collapsed) {
    template.chevron.className = "session-section-chevron";
    if (collapsible) {
      template.chevron.classList.add("collapsible");
      const icon = collapsed ? Codicon.chevronRight : Codicon.chevronDown;
      template.chevron.classList.add(...ThemeIcon.asClassNameArray(icon));
    }
  }
  disposeElement(node, _index, template) {
    template.elementDisposables.clear();
    if (isSessionSection(node.element)) {
      this.templatesByElement.delete(node.element);
      this.templatesById.delete(node.element.id);
    }
  }
  disposeTemplate(template) {
    template.disposables.dispose();
  }
}
class SessionGroupRenderer {
  constructor(delegate, instantiationService, contextKeyService) {
    this.delegate = delegate;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = SessionGroupRenderer.TEMPLATE_ID;
    this.templatesByElement = /* @__PURE__ */ new WeakMap();
    this.templatesById = /* @__PURE__ */ new Map();
  }
  static {
    this.TEMPLATE_ID = "session-group";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    container.classList.add("session-section", "session-group");
    const label = DOM.append(container, $("span.session-section-label"));
    const inputContainer = DOM.append(container, $(".session-group-input"));
    const toolbarContainer = DOM.append(container, $(".session-section-toolbar"));
    const chevron = DOM.append(container, $("span.session-section-chevron"));
    chevron.setAttribute("aria-hidden", "true");
    const contextKeyService = disposables.add(this.contextKeyService.createScoped(container));
    const scopedInstantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const toolbar = disposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, toolbarContainer, SessionGroupToolbarMenuId, {
      menuOptions: { shouldForwardArgs: true }
    }));
    return { container, label, inputContainer, toolbar, chevron, contextKeyService, disposables, elementDisposables: disposables.add(new DisposableStore()) };
  }
  renderElement(node, _index, template) {
    const element = node.element;
    if (!isSessionGroupItem(element)) {
      return;
    }
    template.elementDisposables.clear();
    this.templatesByElement.set(element, template);
    this.templatesById.set(element.group.id, template);
    template.container.classList.remove(SESSION_HEADER_DROP_TARGET_CLASS);
    template.label.textContent = element.group.name;
    this.updateChevron(template, node.collapsible, node.collapsed);
    SessionGroupHasVisibleSessionsContext.bindTo(template.contextKeyService).set(element.sessions.length > 0);
    SessionGroupIsEmptyContext.bindTo(template.contextKeyService).set(element.isEmpty);
    template.toolbar.context = element;
    template.container.classList.toggle("session-group-editing", element.editing);
    if (element.editing) {
      this.renderInput(element, template);
    } else {
      template.inputContainer.style.display = "none";
      template.label.style.display = "";
    }
  }
  renderInput(element, template) {
    template.label.style.display = "none";
    template.inputContainer.style.display = "";
    DOM.clearNode(template.inputContainer);
    const input = template.elementDisposables.add(new InputBox(template.inputContainer, void 0, {
      inputBoxStyles: defaultInputBoxStyles,
      ariaLabel: localize("sessionGroupName", "Group name")
    }));
    input.value = element.group.name;
    input.focus();
    input.select();
    let done = false;
    const commit = () => {
      if (done) {
        return;
      }
      done = true;
      this.delegate.commitEdit(element.group, input.value.trim());
    };
    const cancel = () => {
      if (done) {
        return;
      }
      done = true;
      this.delegate.cancelEdit(element.group);
    };
    template.elementDisposables.add(DOM.addStandardDisposableListener(input.inputElement, DOM.EventType.KEY_DOWN, (e) => {
      if (e.equals(KeyCode.Enter)) {
        e.preventDefault();
        e.stopPropagation();
        commit();
      } else if (e.equals(KeyCode.Escape)) {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    }));
    template.elementDisposables.add(DOM.addDisposableListener(input.inputElement, DOM.EventType.BLUR, () => commit()));
  }
  /** Forwarded from the owning list when the group's collapse state toggles. */
  updateCollapseState(element, collapsed) {
    const template = this.templatesByElement.get(element);
    if (template) {
      this.updateChevron(template, true, collapsed);
    }
  }
  setDropTarget(groupId, active) {
    const template = this.templatesById.get(groupId);
    template?.container.classList.toggle(SESSION_HEADER_DROP_TARGET_CLASS, active);
  }
  updateChevron(template, collapsible, collapsed) {
    template.chevron.className = "session-section-chevron";
    if (collapsible) {
      template.chevron.classList.add("collapsible");
      const icon = collapsed ? Codicon.chevronRight : Codicon.chevronDown;
      template.chevron.classList.add(...ThemeIcon.asClassNameArray(icon));
    }
  }
  disposeElement(node, _index, template) {
    if (isSessionGroupItem(node.element)) {
      this.templatesByElement.delete(node.element);
      this.templatesById.delete(node.element.group.id);
    }
    template.elementDisposables.clear();
  }
  disposeTemplate(template) {
    template.disposables.dispose();
  }
}
class SessionShowMoreRenderer {
  constructor() {
    this.templateId = SessionShowMoreRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "session-show-more";
  }
  renderTemplate(container) {
    container.classList.add("session-show-more");
    return DOM.append(container, $("span.session-show-more-label"));
  }
  renderElement(node, _index, template) {
    const element = node.element;
    if (!isSessionShowMore(element)) {
      return;
    }
    const container = template.parentElement;
    container?.classList.toggle("session-show-more-folders", element.kind === "folders");
    if (element.mode === "less") {
      template.textContent = element.kind === "folders" ? localize("showLessWorkspacesCompact", "Show fewer workspaces") : localize("showLessCompact", "Show less");
    } else {
      template.textContent = element.kind === "folders" ? element.remainingCount === 1 ? localize("showMoreWorkspaceCompact", "+{0} more workspace", element.remainingCount) : localize("showMoreWorkspacesCompact", "+{0} more workspaces", element.remainingCount) : localize("showMoreCompact", "+{0} more", element.remainingCount);
    }
  }
  disposeTemplate(_template) {
  }
}
class SessionPlaceholderRenderer {
  constructor(hoverService) {
    this.hoverService = hoverService;
    this.templateId = SessionPlaceholderRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "session-placeholder";
  }
  renderTemplate(container) {
    container.classList.add("session-placeholder");
    return {
      container,
      label: DOM.append(container, $("span.session-placeholder-label")),
      hover: new MutableDisposable()
    };
  }
  renderElement(node, _index, template) {
    const element = node.element;
    if (!isSessionPlaceholder(element)) {
      return;
    }
    template.label.textContent = element.label;
    template.hover.value = element.hover ? this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), template.container, element.hover) : void 0;
  }
  disposeTemplate(template) {
    template.hover.dispose();
  }
}
class SessionsAccessibilityProvider {
  constructor(automationStatus) {
    this.automationStatus = automationStatus;
  }
  getWidgetAriaLabel() {
    return localize("sessionsList", "Sessions");
  }
  getAriaLabel(element) {
    if (isSessionGroupItem(element)) {
      return `${element.group.name}, ${element.sessions.length}`;
    }
    if (isSessionSection(element)) {
      if (element.id === AUTOMATIONS_SECTION_ID) {
        return this.automationStatus ? derived(this, (reader) => {
          switch (this.automationStatus?.read(reader)) {
            case SessionStatus.InProgress:
              return localize("automationsActiveAria", "{0}, run in progress", element.label);
            case SessionStatus.Completed:
              return localize("automationsUnreadRunAria", "{0}, unread run", element.label);
            default:
              return element.label;
          }
        }) : element.label;
      }
      return `${element.label}, ${element.sessions.length}`;
    }
    if (isSessionShowMore(element)) {
      if (element.mode === "less") {
        return element.kind === "folders" ? localize("showLessWorkspacesAria", "Show fewer workspaces") : localize("showLessAria", "Show fewer sessions");
      }
      return element.kind === "folders" ? element.remainingCount === 1 ? localize("showMoreWorkspaceAria", "Show {0} more workspace", element.remainingCount) : localize("showMoreWorkspacesAria", "Show {0} more workspaces", element.remainingCount) : localize("showMoreAria", "Show {0} more sessions", element.remainingCount);
    }
    if (isSessionPlaceholder(element)) {
      return element.hover ? localize("sessionPlaceholderAria", "{0}. {1}", element.label, element.hover) : element.label;
    }
    return derived(this, (reader) => {
      const title = element.title.read(reader);
      const updated = fromNow(element.updatedAt.read(reader), true);
      return element.worktreePending?.read(reader) ? localize("sessionItemWorktreePendingAria", "{0}, creating worktree, updated {1}", title, updated) : localize("sessionItemAria", "{0}, updated {1}", title, updated);
    });
  }
}
class SessionsListDragAndDrop extends Disposable {
  constructor(delegate) {
    super();
    this.delegate = delegate;
    this._transfer = LocalSelectionTransfer.getInstance();
  }
  getDragURI(element) {
    if (isSessionGroupItem(element)) {
      return `sessionGroup:${element.group.id}`;
    }
    if (isSessionSection(element)) {
      return element.id.startsWith("workspace:") ? `sessionWorkspace:${element.id}` : null;
    }
    if (isSessionShowMore(element)) {
      return null;
    }
    if (isSessionPlaceholder(element)) {
      return null;
    }
    return element.resource.toString();
  }
  getDragLabel(elements) {
    const groupItem = elements.find(isSessionGroupItem);
    if (groupItem) {
      return groupItem.group.name;
    }
    const workspaceSection = elements.find((e) => isSessionSection(e) && e.id.startsWith("workspace:"));
    if (workspaceSection) {
      return workspaceSection.label;
    }
    const sessions = this.toSessions(elements);
    if (sessions.length === 0) {
      return void 0;
    }
    if (sessions.length === 1) {
      return sessions[0].title.get();
    }
    return localize("sessions.dragLabel", "{0} sessions", sessions.length);
  }
  onDragStart(data, originalEvent) {
    const sessions = this.toSessions(data instanceof ElementsDragAndDropData ? data.elements : []);
    if (sessions.length === 0) {
      return;
    }
    const identifiers = sessions.map((s) => new DraggedSessionIdentifier(s.sessionId, s.resource));
    this._transfer.setData(identifiers, DraggedSessionIdentifier.prototype);
    if (originalEvent.dataTransfer) {
      const payload = JSON.stringify({ sessionId: sessions[0].sessionId, resource: sessions[0].resource.toString() });
      originalEvent.dataTransfer.setData(SessionsDataTransfers.SESSION, payload);
    }
  }
  onDragEnd() {
    this._transfer.clearData(DraggedSessionIdentifier.prototype);
    this.delegate.setDropTargetHeader(void 0);
  }
  onDragOver(data, targetElement, _targetIndex, targetSector) {
    const draggedHeader = this.draggedHeader(data);
    if (draggedHeader) {
      this.delegate.setDropTargetHeader(void 0);
      return this.onHeaderDragOver(draggedHeader, targetElement, targetSector);
    }
    const pinTarget = this.resolvePinTarget(data, targetElement, targetSector);
    if (pinTarget) {
      this.delegate.setDropTargetHeader(pinTarget.header);
      return this.toMembershipDropReaction(pinTarget);
    }
    const addToGroupTarget = this.resolveAddToGroupTarget(data, targetElement, targetSector);
    if (addToGroupTarget) {
      this.delegate.setDropTargetHeader(addToGroupTarget.header);
      return this.toMembershipDropReaction(addToGroupTarget);
    }
    this.delegate.setDropTargetHeader(void 0);
    const target = this.resolveReorderTarget(data, targetElement);
    if (!target) {
      return false;
    }
    const position = sectorToPosition(targetSector);
    return {
      accept: true,
      effect: {
        type: ListDragOverEffectType.Move,
        position: position === "after" ? ListDragOverEffectPosition.After : ListDragOverEffectPosition.Before
      }
    };
  }
  drop(data, targetElement, _targetIndex, targetSector) {
    this.delegate.setDropTargetHeader(void 0);
    try {
      const draggedHeader = this.draggedHeader(data);
      if (draggedHeader) {
        if (targetElement) {
          const targetRef = this.headerRefOf(targetElement);
          if (targetRef && targetRef !== draggedHeader.id) {
            this.delegate.reorderSection(draggedHeader.id, targetRef, sectorToPosition(targetSector), draggedHeader.isWorkspace);
          }
        }
        return;
      }
      const pinTarget = this.resolvePinTarget(data, targetElement, targetSector);
      if (pinTarget) {
        this.delegate.pinSessions(pinTarget.sessions, pinTarget.target, pinTarget.position);
        return;
      }
      const addToGroupTarget = this.resolveAddToGroupTarget(data, targetElement, targetSector);
      if (addToGroupTarget) {
        this.delegate.addSessionsToGroup(addToGroupTarget.sessions, addToGroupTarget.groupId, addToGroupTarget.target, addToGroupTarget.position);
        return;
      }
      const target = this.resolveReorderTarget(data, targetElement);
      if (!target) {
        return;
      }
      this.delegate.reorder(this.draggedSessions(data), target, sectorToPosition(targetSector));
    } finally {
      this.delegate.setDropTargetHeader(void 0);
    }
  }
  onHeaderDragOver(draggedHeader, targetElement, targetSector) {
    if (!targetElement) {
      return false;
    }
    const targetRef = this.headerRefOf(targetElement);
    if (!targetRef || targetRef === draggedHeader.id) {
      return false;
    }
    const position = sectorToPosition(targetSector);
    return {
      accept: true,
      effect: {
        type: ListDragOverEffectType.Move,
        position: position === "after" ? ListDragOverEffectPosition.After : ListDragOverEffectPosition.Before
      }
    };
  }
  resolvePinTarget(data, targetElement, targetSector) {
    if (!targetElement) {
      return void 0;
    }
    let target;
    if (isSessionSection(targetElement)) {
      if (targetElement.id !== "pinned") {
        return void 0;
      }
    } else if (isSessionItem(targetElement) && this.delegate.isSessionPinned(targetElement)) {
      target = targetElement;
    } else {
      return void 0;
    }
    const dragged = this.draggedSessions(data);
    const hasArchived = dragged.some((session) => session.isArchived.get());
    const allPinned = dragged.every((session) => this.delegate.isSessionPinned(session));
    if (dragged.length === 0 || hasArchived || allPinned) {
      return void 0;
    }
    if (target && dragged.some((session) => session.sessionId === target.sessionId)) {
      return void 0;
    }
    return {
      sessions: dragged,
      header: { kind: "section", id: "pinned" },
      target,
      position: target ? sectorToPosition(targetSector) : void 0
    };
  }
  resolveAddToGroupTarget(data, targetElement, targetSector) {
    if (!targetElement) {
      return void 0;
    }
    let groupId;
    let target;
    if (isSessionGroupItem(targetElement)) {
      groupId = targetElement.group.id;
    } else if (isSessionPlaceholder(targetElement) && targetElement.sectionId.startsWith("group:")) {
      groupId = targetElement.sectionId.slice("group:".length);
    } else if (isSessionItem(targetElement)) {
      groupId = this.delegate.getGroupIdOfSession(targetElement);
      target = groupId === void 0 ? void 0 : targetElement;
    }
    if (groupId === void 0) {
      return void 0;
    }
    const dragged = this.draggedSessions(data);
    const hasArchived = dragged.some((session) => session.isArchived.get());
    const allInGroup = dragged.every((session) => this.delegate.getGroupIdOfSession(session) === groupId);
    if (dragged.length === 0 || hasArchived || allInGroup) {
      return void 0;
    }
    if (target && dragged.some((session) => session.sessionId === target.sessionId)) {
      return void 0;
    }
    return {
      sessions: dragged,
      groupId,
      header: { kind: "group", id: groupId },
      target,
      position: target ? sectorToPosition(targetSector) : void 0
    };
  }
  /**
   * Resolve the session the drop should be positioned against, or `undefined`
   * if the current drag is not a valid in-list reorder.
   */
  resolveReorderTarget(data, targetElement) {
    if (!targetElement || !isSessionItem(targetElement)) {
      return void 0;
    }
    const target = targetElement;
    if (!this.delegate.isReorderable(target)) {
      return void 0;
    }
    const dragged = this.draggedSessions(data);
    if (dragged.length === 0 || dragged.some((s) => s.sessionId === target.sessionId)) {
      return void 0;
    }
    if (dragged.some((s) => !this.delegate.isReorderable(s))) {
      return void 0;
    }
    if (!this.delegate.canDropOn(dragged, target)) {
      return void 0;
    }
    return target;
  }
  toMembershipDropReaction(target) {
    let position = ListDragOverEffectPosition.Over;
    if (target.position === "after") {
      position = ListDragOverEffectPosition.After;
    } else if (target.position === "before") {
      position = ListDragOverEffectPosition.Before;
    }
    return {
      accept: true,
      effect: {
        type: ListDragOverEffectType.Move,
        position
      }
    };
  }
  draggedHeader(data) {
    if (!(data instanceof ElementsDragAndDropData)) {
      return void 0;
    }
    const elements = data.elements;
    const groupItem = elements.find(isSessionGroupItem);
    if (groupItem) {
      return { id: `group:${groupItem.group.id}`, isWorkspace: false };
    }
    const workspaceSection = elements.find((e) => isSessionSection(e) && e.id.startsWith("workspace:"));
    if (workspaceSection) {
      return { id: workspaceSection.id, isWorkspace: true };
    }
    return void 0;
  }
  /** The reorder identity of a top-level header element, or `undefined` when it is not reorderable. */
  headerRefOf(element) {
    if (isSessionGroupItem(element)) {
      return `group:${element.group.id}`;
    }
    if (isSessionSection(element) && element.id.startsWith("workspace:")) {
      return element.id;
    }
    return void 0;
  }
  draggedSessions(data) {
    return this.toSessions(data instanceof ElementsDragAndDropData ? data.elements : []);
  }
  toSessions(elements) {
    return elements.filter(isSessionItem);
  }
}
function sectorToPosition(sector) {
  return sector !== void 0 && sector >= ListViewTargetSector.CENTER_BOTTOM ? "after" : "before";
}
let SessionsList = class extends Disposable {
  constructor(container, options, _sessionsManagementService, _sessionsService, customViewService, _sessionsListModelService, _sessionGroupsService, _sessionSectionOrderService, _agentHostFilterService, instantiationService, contextKeyService, storageService, contextMenuService, menuService, keybindingService, commandService, automationService, _listVoicePlaybackService, assignmentService, configurationService) {
    super();
    this.options = options;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this.customViewService = customViewService;
    this._sessionsListModelService = _sessionsListModelService;
    this._sessionGroupsService = _sessionGroupsService;
    this._sessionSectionOrderService = _sessionSectionOrderService;
    this._agentHostFilterService = _agentHostFilterService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.keybindingService = keybindingService;
    this.commandService = commandService;
    this.automationService = automationService;
    this._listVoicePlaybackService = _listVoicePlaybackService;
    this.assignmentService = assignmentService;
    this.configurationService = configurationService;
    this.sessions = [];
    this.visible = true;
    /**
     * Maximum number of sessions shown per workspace section or user group.
     */
    this.sessionGroupLimit = observableValue(this, SessionsList.DEFAULT_SESSION_GROUP_LIMIT);
    this.expandedSessionGroups = /* @__PURE__ */ new Set();
    this.expandedMoreFolders = false;
    this.hasFindPattern = false;
    this.suspendCollapseStatePersistence = false;
    /**
     * Snapshot of the currently-rendered reorderable top-level headers (groups
     * and, in workspace mode, workspace sections) in display order, by reorder
     * identity. Captured each render and used as the basis for drag-reorder math.
     */
    this._topLevelOrder = [];
    this._onDidUpdate = this._register(new Emitter());
    this.onDidUpdate = this._onDidUpdate.event;
    this._onDidChangeFindOpenState = this._register(new Emitter());
    this.onDidChangeFindOpenState = this._onDidChangeFindOpenState.event;
    this.excludedSessionTypes = this.loadExcludedSessionTypes();
    this.excludedStatuses = this.loadExcludedStatuses();
    this._excludeArchived = this.storageService.getBoolean(SessionsList.EXCLUDE_ARCHIVED_KEY, StorageScope.PROFILE, true);
    this._excludeRead = this.storageService.getBoolean(SessionsList.EXCLUDE_READ_KEY, StorageScope.PROFILE, false);
    this.workspaceGroupCapped = this.storageService.getBoolean(SessionsList.WORKSPACE_GROUP_CAPPED_KEY, StorageScope.PROFILE, true);
    this.listContainer = DOM.append(container, $(".sessions-list-control"));
    this._register(DOM.addDisposableListener(this.listContainer, DOM.EventType.POINTER_DOWN, () => {
      this.listContainer.classList.add(SESSION_SECTION_FOCUS_FROM_POINTER_CLASS);
    }));
    this._register(DOM.addDisposableListener(this.listContainer.ownerDocument, DOM.EventType.KEY_DOWN, () => {
      this.listContainer.classList.remove(SESSION_SECTION_FOCUS_FROM_POINTER_CLASS);
    }, true));
    const approvalModel = this._register(instantiationService.createInstance(AgentSessionApprovalModel));
    const markdownRendererService = instantiationService.invokeFunction((accessor) => accessor.get(IMarkdownRendererService));
    const hoverService = instantiationService.invokeFunction((accessor) => accessor.get(IHoverService));
    const sessionsProvidersService = instantiationService.invokeFunction((accessor) => accessor.get(ISessionsProvidersService));
    this._sessionsProvidersService = sessionsProvidersService;
    const providerCapabilityListeners = this._register(new DisposableStore());
    const subscribeProviderCapabilities = () => {
      providerCapabilityListeners.clear();
      for (const provider of sessionsProvidersService.getProviders()) {
        if (provider.onDidChangeCapabilities) {
          providerCapabilityListeners.add(provider.onDidChangeCapabilities(() => this.update()));
        }
      }
    };
    subscribeProviderCapabilities();
    this._register(sessionsProvidersService.onDidChangeProviders(() => {
      subscribeProviderCapabilities();
      this.update();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SESSIONS_LIST_SHOW_EMPTY_DEFAULT_GROUPS_SETTING) || e.affectsConfiguration(ChatSessionArchiveActionWordingSettingId)) {
        this.update();
      }
    }));
    const agentSessionsService = instantiationService.invokeFunction((accessor) => accessor.get(IAgentSessionsService));
    const voicePlaybackService = instantiationService.invokeFunction((accessor) => accessor.get(IVoicePlaybackService));
    const sessionRenderer = new SessionItemRenderer(
      {
        grouping: this.options.grouping,
        isPinned: (s) => this.isSessionPinned(s),
        visibleSessions: this._sessionsService.visibleSessions,
        getMultiSelectedSessions: (s) => this.getMultiSelectedSessions(s),
        showHover: true,
        approvalRowMaxLines: DEFAULT_APPROVAL_ROW_MAX_LINES,
        toolbarMenuId: SessionItemToolbarMenuId,
        onDidRequestRename: (session) => {
          this.commandService.executeCommand(RENAME_SESSION_COMMAND_ID, session).catch(onUnexpectedError);
        }
      },
      approvalModel,
      void 0,
      instantiationService,
      contextKeyService,
      markdownRendererService,
      hoverService,
      sessionsProvidersService,
      agentSessionsService,
      voicePlaybackService
    );
    const showMoreRenderer = new SessionShowMoreRenderer();
    const placeholderRenderer = new SessionPlaceholderRenderer(hoverService);
    const sectionRenderer = new SessionSectionRenderer(true, instantiationService, contextKeyService, this.automationService, this._sessionsManagementService, this.customViewService);
    this._sectionRenderer = sectionRenderer;
    const groupRenderer = new SessionGroupRenderer({
      commitEdit: (group, name) => this.commitGroupEdit(group, name),
      cancelEdit: (group) => this.cancelGroupEdit(group)
    }, instantiationService, contextKeyService);
    this._groupRenderer = groupRenderer;
    const delegate = new SessionsTreeDelegate(approvalModel, () => !!IsPhoneLayoutContext.getValue(contextKeyService));
    this.tree = this._register(instantiationService.createInstance(
      WorkbenchObjectTree,
      "SessionsListTree",
      this.listContainer,
      delegate,
      [
        sessionRenderer,
        sectionRenderer,
        groupRenderer,
        showMoreRenderer,
        placeholderRenderer
      ],
      {
        accessibilityProvider: new SessionsAccessibilityProvider(sectionRenderer.automationStatus),
        dnd: this._register(new SessionsListDragAndDrop({
          isReorderable: (session) => this.isReorderable(session),
          isSessionPinned: (session) => this.isSessionPinned(session),
          canDropOn: (dragged, target) => this.canReorderOnto(dragged, target),
          reorder: (dragged, target, position) => this.reorderSessions(dragged, target, position),
          getGroupIdOfSession: (session) => this._sessionGroupsService.getGroupOfSession(session.sessionId),
          addSessionsToGroup: (sessions, groupId, target, position) => this.addSessionsToGroup(sessions, groupId, target, position),
          pinSessions: (sessions, target, position) => this.pinSessions(sessions, target, position),
          setDropTargetHeader: (header) => this.setDropTargetHeader(header),
          reorderSection: (draggedId, targetId, position, isWorkspace) => this.reorderSection(draggedId, targetId, position, isWorkspace)
        })),
        identityProvider: {
          getId: (element) => {
            if (isSessionGroupItem(element)) {
              return `group:${element.group.id}`;
            }
            if (isSessionSection(element)) {
              return `section:${element.id}`;
            }
            if (isSessionShowMore(element)) {
              return `show-more:${element.kind}:${element.mode}:${element.sectionId}`;
            }
            if (isSessionPlaceholder(element)) {
              return `placeholder:${element.sectionId}`;
            }
            return element.resource.toString();
          },
          getGroupId: (element) => {
            if (isSessionGroupItem(element)) {
              return NotSelectableGroupId;
            }
            if (isSessionSection(element)) {
              return NotSelectableGroupId;
            }
            if (isSessionShowMore(element)) {
              return NotSelectableGroupId;
            }
            if (isSessionPlaceholder(element)) {
              return NotSelectableGroupId;
            }
            return element.isArchived.get() ? 2 : 1;
          }
        },
        horizontalScrolling: false,
        multipleSelectionSupport: true,
        indent: 0,
        findWidgetEnabled: true,
        defaultFindMode: TreeFindMode.Filter,
        findWidgetContainer: this.options.findWidgetContainer,
        findWidgetStyles: {
          ...defaultFindWidgetStyles,
          toggleStyles: {
            ...defaultToggleStyles,
            inputActiveOptionBorder: "transparent"
          }
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (element) => {
            if (isSessionGroupItem(element)) {
              return element.group.name;
            }
            if (isSessionSection(element)) {
              return element.label;
            }
            if (isSessionShowMore(element)) {
              return element.sectionLabel;
            }
            if (isSessionPlaceholder(element)) {
              return element.label;
            }
            return element.title.get();
          }
        },
        overrideStyles: this.options.overrideStyles,
        renderIndentGuides: RenderIndentGuides.None,
        twistieAdditionalCssClass: () => "force-no-twistie"
      }
    ));
    this._register(this.tree.onDidOpen((e) => {
      const element = e.element;
      if (!element) {
        return;
      }
      if (isSessionShowMore(element)) {
        if (element.kind === "folders") {
          this.expandedMoreFolders = element.mode === "more";
        } else {
          if (element.mode === "more") {
            this.expandedSessionGroups.add(element.sectionId);
          } else {
            this.expandedSessionGroups.delete(element.sectionId);
          }
        }
        this.update();
        return;
      }
      if (isSessionPlaceholder(element)) {
        return;
      }
      if (isSessionSection(element) && element.id === AUTOMATIONS_SECTION_ID) {
        this.tree.setSelection([]);
        this.commandService.executeCommand("sessionsView.manageAutomations");
        return;
      }
      if (!isSessionSection(element) && !isSessionGroupItem(element)) {
        this.markRead(element);
        const isLeftClick = DOM.isMouseEvent(e.browserEvent) && e.browserEvent.button === 0;
        const preserveFocus = isLeftClick ? false : e.editorOptions.preserveFocus ?? false;
        this.options.onSessionOpen(element.resource, preserveFocus, e.sideBySide);
        if (this._listVoicePlaybackService.hasPendingResponse(element.resource)) {
          this.commandService.executeCommand("_chat.voice.activateSession", element.resource.toString());
        }
      }
    }));
    this._register(sessionRenderer.onDidChangeItemHeight((session) => {
      if (this.tree.hasElement(session)) {
        this.tree.updateElementHeight(session, delegate.getHeight(session));
      }
    }));
    const phoneKeys = /* @__PURE__ */ new Set([IsPhoneLayoutContext.key]);
    const automationKeys = /* @__PURE__ */ new Set([ChatAutomationsEnabledContext.key]);
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(automationKeys)) {
        this.update();
      }
      if (!e.affectsSome(phoneKeys)) {
        return;
      }
      for (const session of this.sessions) {
        if (this.tree.hasElement(session)) {
          this.tree.updateElementHeight(session, delegate.getHeight(session));
        }
      }
    }));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.tree.onDidChangeCollapseState((e) => {
      const element = e.node.element;
      if (element && isSessionGroupItem(element)) {
        this._groupRenderer.updateCollapseState(element, e.node.collapsed);
        if (!this.suspendCollapseStatePersistence) {
          this.saveSectionCollapseState(`group:${element.group.id}`, e.node.collapsed);
        }
      } else if (element && isSessionSection(element)) {
        sectionRenderer.updateCollapseState(element, e.node.collapsed);
        if (!this.suspendCollapseStatePersistence) {
          this.saveSectionCollapseState(element.id, e.node.collapsed);
        }
      }
    }));
    let isFindOpen = false;
    let findPattern = "";
    const updateFindPatternState = () => {
      const hasFindPattern = isFindOpen && findPattern.length > 0;
      if (hasFindPattern !== this.hasFindPattern) {
        this.hasFindPattern = hasFindPattern;
        this.update();
      }
    };
    this._register(this.tree.onDidChangeFindOpenState((open) => {
      isFindOpen = open;
      this._onDidChangeFindOpenState.fire(open);
      updateFindPatternState();
    }));
    this._register(this.tree.onDidChangeFindPattern((pattern) => {
      findPattern = pattern;
      updateFindPatternState();
    }));
    this._register(this._sessionsManagementService.onDidChangeSessions((e) => {
      if (this.visible) {
        this.refresh();
      }
      if (e.removed.length > 0) {
        this._sessionSectionOrderService.retain(this.liveSectionOrderIds());
      }
    }));
    this._register(this._sessionsListModelService.onDidChange(() => {
      if (this.visible) {
        this.update();
      }
    }));
    this._register(this._sessionGroupsService.onDidChange((e) => {
      if (this.visible) {
        this.update();
      }
      if (e.groupsChanged) {
        this._sessionSectionOrderService.retain(this.liveSectionOrderIds());
      }
    }));
    this._register(this._sessionSectionOrderService.onDidChange(() => {
      if (this.visible) {
        this.update();
      }
    }));
    this._register(this._agentHostFilterService.onDidChange(() => {
      if (this.visible) {
        this.update();
      }
    }));
    this._register(autorun((reader) => {
      this._sessionsService.activeSession.read(reader);
      if (this.visible) {
        this.update();
      }
    }));
    const assignmentRefetchSignal = observableSignalFromEvent(this, this.assignmentService.onDidRefetchAssignments);
    this._register(autorun((reader) => {
      assignmentRefetchSignal.read(reader);
      this.updateSessionGroupLimit();
    }));
    this.refresh();
  }
  static {
    this.SECTION_COLLAPSE_STATE_KEY = "sessionsListControl.sectionCollapseState";
  }
  static {
    this.EXCLUDED_TYPES_KEY = "sessionsListControl.excludedSessionTypes";
  }
  static {
    this.EXCLUDED_STATUSES_KEY = "sessionsListControl.excludedStatuses";
  }
  static {
    this.EXCLUDE_ARCHIVED_KEY = "sessionsListControl.excludeArchived";
  }
  static {
    this.EXCLUDE_READ_KEY = "sessionsListControl.excludeRead";
  }
  static {
    this.WORKSPACE_GROUP_CAPPED_KEY = "sessionsListControl.workspaceGroupCapped";
  }
  static {
    this.DEFAULT_SESSION_GROUP_LIMIT = 5;
  }
  static {
    /**
     * Experiment treatment that overrides how many sessions are shown per group
     * before the "show more" affordance appears.
     */
    this.SESSION_GROUP_LIMIT_TREATMENT = "sessions.workspaceGroupLimit";
  }
  get element() {
    return this.listContainer;
  }
  /**
   * Fetches the session group limit treatment and updates the backing
   * observable. Invalid or unset treatments fall back to the default limit.
   */
  updateSessionGroupLimit() {
    this.assignmentService.getTreatment(SessionsList.SESSION_GROUP_LIMIT_TREATMENT).then((value) => {
      const limit = typeof value === "number" && Number.isInteger(value) && value > 0 ? value : SessionsList.DEFAULT_SESSION_GROUP_LIMIT;
      if (this.sessionGroupLimit.get() !== limit) {
        this.sessionGroupLimit.set(limit, void 0);
        if (this.visible) {
          this.update();
        }
      }
    });
  }
  refresh() {
    this.sessions = this._sessionsManagementService.getSessions();
    for (const session of this.sessions) {
      this._sessionsListModelService.migrateLegacyReadState(session);
    }
    this.update();
  }
  update(expandAll) {
    const activeSession = this._sessionsService.activeSession.get();
    let filtered = this.sessions;
    const hostFilter = this._agentHostFilterService.selectedProviderId;
    if (hostFilter !== void 0) {
      filtered = filtered.filter((s) => s.providerId === hostFilter);
    }
    if (this.excludedSessionTypes.size > 0) {
      filtered = filtered.filter((s) => !this.excludedSessionTypes.has(s.sessionType));
    }
    if (this.excludedStatuses.size > 0) {
      filtered = filtered.filter((s) => !this.excludedStatuses.has(s.status.get()));
    }
    if (this._excludeArchived) {
      filtered = filtered.filter((s) => !s.isArchived.get());
    }
    if (this._excludeRead) {
      filtered = filtered.filter((s) => !s.isRead.get());
    }
    if (activeSession && !filtered.some((s) => s.sessionId === activeSession.sessionId)) {
      const match = this.sessions.find((s) => s.sessionId === activeSession.sessionId);
      if (match) {
        filtered = [...filtered, match];
      }
    }
    const grouping = this.options.grouping();
    const sorting = this.options.sorting();
    const sortKeyForGrouping = (s, srt) => this._sessionsListModelService.getSortKey(s, sortingToMode(srt));
    const groupedMembers = /* @__PURE__ */ new Map();
    const groupedRegularIds = /* @__PURE__ */ new Set();
    for (const s of filtered) {
      if (s.isArchived.get() || this.isSessionPinned(s)) {
        continue;
      }
      const groupId = this._sessionGroupsService.getGroupOfSession(s.sessionId);
      if (groupId !== void 0 && this._sessionGroupsService.getGroup(groupId)) {
        let members = groupedMembers.get(groupId);
        if (!members) {
          members = [];
          groupedMembers.set(groupId, members);
        }
        members.push(s);
        groupedRegularIds.add(s.sessionId);
      }
    }
    const forSections = groupedRegularIds.size > 0 ? filtered.filter((s) => !groupedRegularIds.has(s.sessionId)) : filtered;
    const groupItemsById = /* @__PURE__ */ new Map();
    for (const group of this._sessionGroupsService.getGroups()) {
      const members = groupedMembers.get(group.id) ?? [];
      const sortedMembers = sortSessions(members, sorting, sortKeyForGrouping);
      groupItemsById.set(group.id, {
        group,
        sessions: sortedMembers,
        isEmpty: this._sessionGroupsService.getSessionIdsInGroup(group.id).length === 0,
        editing: group.id === this._editingGroupId
      });
    }
    const defaultGroupIds = [...groupItemsById.values()].sort((a, b) => b.group.createdAt - a.group.createdAt).map((item) => `group:${item.group.id}`);
    const sections = groupSessionsForList(forSections, grouping, sorting, (session) => this.isSessionPinned(session), (s, srt) => this._sessionsListModelService.getSortKey(s, sortingToMode(srt)), getChatSessionArchivedSectionLabel(getChatSessionArchiveActionWording(this.configurationService)));
    const hasRecentSessions = sections.some((s) => s.id === "recent" && s.sessions.length > 0);
    const showEmptyDefaultGroups = this.configurationService.getValue(SESSIONS_LIST_SHOW_EMPTY_DEFAULT_GROUPS_SETTING);
    if (showEmptyDefaultGroups && this._someProviderSupportsQuickChats() && !sections.some((s) => s.id === QUICK_CHATS_SECTION_ID)) {
      sections.push({ id: QUICK_CHATS_SECTION_ID, label: localize("chatsSection", "Chats"), sessions: [] });
    }
    const partitionFolders = grouping === "workspace" /* Workspace */ && !this.hasFindPattern && this.workspaceGroupCapped;
    const moreFolderSectionIds = /* @__PURE__ */ new Set();
    if (partitionFolders) {
      const workspaceSections = sections.filter((s) => s.id.startsWith("workspace:"));
      if (workspaceSections.length > 0) {
        const now = Date.now();
        const isRecent = (section) => section.sessions.some((s) => s.updatedAt.get().getTime() >= now - FOUR_DAYS_MS);
        const isOpenWindow = (section) => !!this.openWindowSourceFolder && section.sessions.some((s) => sessionMatchesFolder(s, this.openWindowSourceFolder));
        const meetsCriteria = (section) => isRecent(section) || isOpenWindow(section);
        let anyMeets = false;
        for (const section of workspaceSections) {
          if (meetsCriteria(section)) {
            anyMeets = true;
            break;
          }
        }
        let fallbackId;
        if (!anyMeets) {
          let bestTime = -Infinity;
          for (const section of workspaceSections) {
            for (const s of section.sessions) {
              const t = s.updatedAt.get().getTime();
              if (t > bestTime) {
                bestTime = t;
                fallbackId = section.id;
              }
            }
          }
        }
        for (const section of workspaceSections) {
          if (!meetsCriteria(section) && section.id !== fallbackId && !this._sessionSectionOrderService.isPromoted(section.id)) {
            moreFolderSectionIds.add(section.id);
          }
        }
      }
    }
    const children = [];
    const sessionGroupLimit = this.sessionGroupLimit.get();
    const toSessionChildren = (sessions) => sessions.map((session) => ({ element: session }));
    const renderSessionChildren = (sessions, sectionId, sectionLabel, enabled) => {
      const limited = limitSessionsForList(sessions, sessionGroupLimit, {
        enabled,
        expanded: this.expandedSessionGroups.has(sectionId),
        sectionId,
        sectionLabel
      });
      const children2 = toSessionChildren(limited.sessions);
      if (limited.showMore) {
        children2.push({ element: limited.showMore });
      }
      return children2;
    };
    const renderSection = (section) => {
      if (section.id === AUTOMATIONS_SECTION_ID) {
        return {
          element: section,
          children: [],
          collapsible: false
        };
      }
      const isWorkspaceGroup = grouping === "workspace" /* Workspace */ && section.id.startsWith("workspace:");
      const limitSessions = isWorkspaceGroup && !this.hasFindPattern && this.workspaceGroupCapped;
      let sectionChildren = renderSessionChildren(section.sessions, section.id, section.label, limitSessions);
      if (section.id === QUICK_CHATS_SECTION_ID && section.sessions.length === 0) {
        sectionChildren = [{ element: { placeholder: true, sectionId: section.id, label: localize("noChats", "No chats") } }];
      }
      let defaultCollapsed = ObjectTreeElementCollapseState.PreserveOrExpanded;
      if (grouping === "date" /* Date */ && hasRecentSessions) {
        const olderSections = ["older", "archived"];
        if (olderSections.includes(section.id)) {
          defaultCollapsed = ObjectTreeElementCollapseState.PreserveOrCollapsed;
        }
      }
      if (section.id === "archived") {
        defaultCollapsed = ObjectTreeElementCollapseState.PreserveOrCollapsed;
      }
      if (section.id === "pinned" || section.id === QUICK_CHATS_SECTION_ID) {
        defaultCollapsed = ObjectTreeElementCollapseState.PreserveOrCollapsed;
      }
      return {
        element: section,
        collapsible: true,
        collapsed: this.getSavedCollapseState(section.id) ?? defaultCollapsed,
        children: sectionChildren
      };
    };
    const renderGroup = (groupItem) => {
      const sectionId = `group:${groupItem.group.id}`;
      const groupChildren = groupItem.sessions.length === 0 ? [{
        element: {
          placeholder: true,
          sectionId,
          label: localize("noSessionInGroup", "No session"),
          hover: localize("noSessionInGroupHover", "Use Add to Group from a session's context menu, or drag it into this group.")
        }
      }] : renderSessionChildren(groupItem.sessions, sectionId, groupItem.group.name, !this.hasFindPattern && this.workspaceGroupCapped);
      return {
        element: groupItem,
        collapsible: true,
        collapsed: this.getSavedCollapseState(sectionId) ?? ObjectTreeElementCollapseState.PreserveOrExpanded,
        children: groupChildren
      };
    };
    if (this.contextKeyService.getContextKeyValue(ChatAutomationsEnabledContext.key)) {
      children.push(renderSection({ id: AUTOMATIONS_SECTION_ID, label: localize("automations", "Automations"), sessions: [] }));
    }
    const pinnedSection = sections.find((s) => s.id === "pinned");
    if (pinnedSection) {
      children.push(renderSection(pinnedSection));
    }
    const quickChatsSection = sections.find((s) => s.id === QUICK_CHATS_SECTION_ID);
    if (quickChatsSection) {
      children.push(renderSection(quickChatsSection));
    }
    const renderGroupById = (id) => {
      const groupItem = groupItemsById.get(id.slice("group:".length));
      if (groupItem) {
        children.push(renderGroup(groupItem));
      }
    };
    if (grouping === "date" /* Date */) {
      const resolvedGroupIds = this._sessionSectionOrderService.resolveOrder(defaultGroupIds);
      this._topLevelOrder = resolvedGroupIds;
      for (const id of resolvedGroupIds) {
        renderGroupById(id);
      }
      for (const section of sections) {
        if (section.id === "pinned" || section.id === "archived" || section.id === QUICK_CHATS_SECTION_ID) {
          continue;
        }
        children.push(renderSection(section));
      }
      const archived = sections.find((s) => s.id === "archived");
      if (archived) {
        children.push(renderSection(archived));
      }
    } else {
      const workspaceSections = sections.filter((s) => s.id.startsWith("workspace:"));
      const sectionById = new Map(workspaceSections.map((s) => [s.id, s]));
      const primaryWorkspaceIds = workspaceSections.filter((s) => !moreFolderSectionIds.has(s.id)).map((s) => s.id);
      const defaultOrder = [...defaultGroupIds, ...primaryWorkspaceIds];
      const resolvedIds = this._sessionSectionOrderService.resolveOrder(defaultOrder);
      this._topLevelOrder = resolvedIds;
      for (const id of resolvedIds) {
        if (id.startsWith("group:")) {
          renderGroupById(id);
        } else {
          const section = sectionById.get(id);
          if (section) {
            children.push(renderSection(section));
          }
        }
      }
      const moreFolderSections = workspaceSections.filter((s) => moreFolderSectionIds.has(s.id));
      if (moreFolderSections.length > 0) {
        if (this.expandedMoreFolders) {
          for (const section of moreFolderSections) {
            children.push(renderSection(section));
          }
          children.push({
            element: { showMore: true, kind: "folders", mode: "less", sectionId: SHOW_MORE_FOLDERS_LABEL, sectionLabel: SHOW_MORE_FOLDERS_LABEL, remainingCount: 0 }
          });
        } else {
          children.push({
            element: { showMore: true, kind: "folders", mode: "more", sectionId: SHOW_MORE_FOLDERS_LABEL, sectionLabel: SHOW_MORE_FOLDERS_LABEL, remainingCount: moreFolderSections.length }
          });
        }
      }
      const archivedSection = sections.find((s) => s.id === "archived");
      if (archivedSection) {
        children.push(renderSection(archivedSection));
      }
    }
    this.tree.setChildren(null, children);
    this._onDidUpdate.fire();
  }
  getVisibleSessions() {
    const sessions = new Set(this.sessions);
    const visibleSessions = [];
    const collect = (node) => {
      if (!node.visible) {
        return;
      }
      if (node.element && sessions.has(node.element)) {
        visibleSessions.push(node.element);
      }
      if (node.collapsed) {
        return;
      }
      for (const child of node.children) {
        collect(child);
      }
    };
    const root = this.tree.getNode();
    for (const child of root.children) {
      collect(child);
    }
    return visibleSessions;
  }
  reveal(sessionResource) {
    const resourceStr = sessionResource.toString();
    for (const session of this.sessions) {
      if (session.resource.toString() === resourceStr) {
        if (this.tree.hasElement(session)) {
          if (this.tree.getRelativeTop(session) === null) {
            this.tree.reveal(session, 0.5);
          }
          this.tree.setFocus([session]);
          this.tree.setSelection([session]);
          return true;
        }
      }
    }
    return false;
  }
  clearFocus() {
    this.tree.setFocus([]);
    this.tree.setSelection([]);
  }
  hasFocusOrSelection() {
    return this.tree.getFocus().length > 0 || this.tree.getSelection().length > 0;
  }
  setVisible(visible) {
    if (this.visible === visible) {
      return;
    }
    this.visible = visible;
    if (this.visible) {
      this.refresh();
    }
  }
  layout(height, width) {
    this.tree.layout(height, width);
  }
  focus() {
    this.tree.domFocus();
    if (this.tree.getFocus().length === 0) {
      this.tree.focusFirst();
    }
  }
  openFind() {
    this.tree.openFind();
  }
  closeFind() {
    this.tree.closeFind();
  }
  // Context menu
  /**
   * Whether a session may participate in manual reordering. Archived (Done)
   * sessions keep their fixed section.
   */
  isReorderable(session) {
    return !session.isArchived.get();
  }
  /**
   * Whether the dragged sessions can be reordered relative to the target.
   * Reordering stays within the same scope: dragged sessions must share the
   * target's group membership, and (when grouping by workspace) its workspace.
   */
  canReorderOnto(dragged, target) {
    const targetPinned = this.isSessionPinned(target);
    if (dragged.some((s) => this.isSessionPinned(s) !== targetPinned)) {
      return false;
    }
    if (targetPinned) {
      return true;
    }
    const targetGroup = this._sessionGroupsService.getGroupOfSession(target.sessionId);
    if (dragged.some((s) => this._sessionGroupsService.getGroupOfSession(s.sessionId) !== targetGroup)) {
      return false;
    }
    if (targetGroup === void 0 && this.options.grouping() === "workspace" /* Workspace */) {
      const targetLabel = sessionWorkspaceLabel(target);
      return dragged.every((s) => sessionWorkspaceLabel(s) === targetLabel);
    }
    return true;
  }
  /**
   * Reorder the dragged sessions so they land as a contiguous block before or
   * after the target session, persisting a synthetic sort key (the midpoint of
   * the surrounding sessions' keys). When the dragged sessions' natural
   * timestamps already sort them into the dropped slot, any stored override is
   * dropped instead so the list falls back to natural ordering.
   */
  reorderSessions(dragged, target, position) {
    const mode = sortingToMode(this.options.sorting());
    const grouping = this.options.grouping();
    const getKey = (s) => this._sessionsListModelService.getSortKey(s, mode);
    const targetPinned = this.isSessionPinned(target);
    let scope = this.getVisibleSessions().filter((s) => this.isReorderable(s));
    scope = scope.filter((s) => this.isSessionPinned(s) === targetPinned);
    if (!targetPinned) {
      const targetGroup = this._sessionGroupsService.getGroupOfSession(target.sessionId);
      scope = scope.filter((s) => this._sessionGroupsService.getGroupOfSession(s.sessionId) === targetGroup);
      if (targetGroup === void 0 && grouping === "workspace" /* Workspace */) {
        const targetLabel = sessionWorkspaceLabel(target);
        scope = scope.filter((s) => sessionWorkspaceLabel(s) === targetLabel);
      }
    }
    const draggedIds = new Set(dragged.map((s) => s.sessionId));
    const draggedOrdered = scope.filter((s) => draggedIds.has(s.sessionId));
    if (draggedOrdered.length === 0) {
      return;
    }
    const remaining = scope.filter((s) => !draggedIds.has(s.sessionId));
    const targetIndex = remaining.findIndex((s) => s.sessionId === target.sessionId);
    if (targetIndex === -1) {
      return;
    }
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const above = remaining[insertIndex - 1];
    const below = remaining[insertIndex];
    const { set, clear } = computeReorderSortChanges({
      draggedIds: draggedOrdered.map((s) => s.sessionId),
      naturalKeys: draggedOrdered.map((s) => this._sessionsListModelService.getNaturalSortKey(s, mode)),
      aboveKey: above ? getKey(above) : void 0,
      belowKey: below ? getKey(below) : void 0,
      now: Date.now(),
      fallbackStep: SORT_FALLBACK_STEP_MS
    });
    this._sessionsListModelService.applySortChanges(mode, set, clear);
  }
  // -- Groups --
  /**
   * Create a new group containing the given sessions and start renaming it.
   * Archived (Done) sessions are ignored.
   */
  createGroupFromSessions(sessions) {
    const groupSessions = sessions.filter((session) => !session.isArchived.get());
    if (groupSessions.length === 0) {
      return;
    }
    this.createGroup(groupSessions);
  }
  createGroup(groupSessions) {
    this._sessionsListModelService.unpinSessions(groupSessions);
    const group = this._sessionGroupsService.createGroup(localize("newGroupName", "New Group"), groupSessions.map((s) => s.sessionId));
    this._editingGroupId = group.id;
    this.update();
    this.revealGroup(group.id);
  }
  /** Scroll the group's header into view so its inline name editor is visible. */
  revealGroup(groupId) {
    const root = this.tree.getNode();
    for (const node of root.children) {
      const element = node.element;
      if (element && isSessionGroupItem(element) && element.group.id === groupId) {
        if (this.tree.hasElement(element) && this.tree.getRelativeTop(element) === null) {
          this.tree.reveal(element, 0.5);
        }
        return;
      }
    }
  }
  /** Begin inline renaming of the group's header. */
  beginRenameGroup(groupId) {
    if (!this._sessionGroupsService.getGroup(groupId)) {
      return;
    }
    this._editingGroupId = groupId;
    this.update();
  }
  addSessionsToGroup(sessions, groupId, target, position) {
    const groupSessions = sessions.filter((session) => !session.isArchived.get());
    this._sessionsListModelService.unpinSessions(groupSessions);
    this._sessionGroupsService.addToGroup(groupSessions.map((s) => s.sessionId), groupId);
    if (target && position) {
      this.reorderSessions(groupSessions, target, position);
    }
  }
  commitGroupEdit(group, name) {
    this._editingGroupId = void 0;
    const trimmed = name.trim();
    if (trimmed) {
      this._sessionGroupsService.renameGroup(group.id, trimmed);
    }
    this.update();
  }
  cancelGroupEdit(_group) {
    this._editingGroupId = void 0;
    this.update();
  }
  /**
   * Reorder a top-level header (group or workspace section) so it lands
   * before/after the target header. The new order is persisted to the
   * section-order service. When the dragged header is a workspace it is also
   * promoted so it stays visible (escapes the "+N more workspaces" capping).
   */
  reorderSection(draggedId, targetId, position, isWorkspace) {
    this._sessionSectionOrderService.reorder(this._topLevelOrder, draggedId, targetId, position, isWorkspace ? draggedId : void 0);
  }
  /**
   * Groups in their current top-to-bottom display order. Groups are fully
   * user-managed (see {@link ISessionSectionOrderService}); the order defaults
   * to newest-first and is shared with the list. Used to keep the "Add to
   * Group" / "Move to Group" menu consistent with the rendered order.
   */
  getGroupsInDisplayOrder() {
    const groups = this._sessionGroupsService.getGroups();
    const byId = new Map(groups.map((g) => [`group:${g.id}`, g]));
    const defaultIds = [...groups].sort((a, b) => b.createdAt - a.createdAt).map((g) => `group:${g.id}`);
    return this._sessionSectionOrderService.resolveOrder(defaultIds).map((id) => byId.get(id)).filter((g) => !!g);
  }
  /**
   * The set of top-level reorder identities that currently exist (every group,
   * plus every workspace label present across all sessions, regardless of
   * grouping mode or capping). Used to garbage-collect stale manual order and
   * promotion entries. Reads sessions fresh from the management service so it
   * reflects the latest loaded state even when the list is not visible.
   */
  liveSectionOrderIds() {
    const ids = /* @__PURE__ */ new Set();
    for (const group of this._sessionGroupsService.getGroups()) {
      ids.add(`group:${group.id}`);
    }
    for (const session of this._sessionsManagementService.getSessions()) {
      ids.add(`workspace:${sessionWorkspaceLabel(session)}`);
    }
    return ids;
  }
  setDropTargetHeader(header) {
    const current = this._dropTargetHeader;
    if (current?.kind === header?.kind && current?.id === header?.id) {
      this.toggleDropTargetHeader(header, header !== void 0);
      return;
    }
    this.toggleDropTargetHeader(current, false);
    this._dropTargetHeader = header;
    this.toggleDropTargetHeader(header, true);
  }
  toggleDropTargetHeader(header, active) {
    if (!header) {
      return;
    }
    if (header.kind === "group") {
      this._groupRenderer.setDropTarget(header.id, active);
    } else {
      this._sectionRenderer.setDropTarget(header.id, active);
    }
  }
  getMultiSelectedSessions(session) {
    const selection = this.tree.getSelection().filter((s) => !!s && isSessionItem(s));
    return selection.includes(session) ? [session, ...selection.filter((s) => s !== session)] : [session];
  }
  onContextMenu(e) {
    const element = e.element;
    if (!element || isSessionSection(element) || isSessionShowMore(element) || isSessionPlaceholder(element)) {
      this.showCreateGroupContextMenu(e.anchor);
      return;
    }
    if (isSessionGroupItem(element)) {
      this.showGroupContextMenu(element, e.anchor);
      return;
    }
    const selectedSessions = this.getMultiSelectedSessions(element);
    const inGroup = this._sessionGroupsService.getGroupOfSession(element.sessionId) !== void 0;
    const contextOverlay = [
      [IsSessionPinnedContext.key, this.isSessionPinned(element)],
      [SessionIsArchivedContext.key, element.isArchived.get()],
      [SessionIsReadContext.key, element.isRead.get()],
      [SessionItemHasBranchNameContext.key, !!element.workspace.get()?.folders[0]?.gitRepository?.branchName?.trim()],
      [SessionItemInGroupContext.key, inGroup],
      [SessionTypeContext.key, element.sessionType],
      [SessionProviderIdContext.key, element.providerId],
      [SessionSupportsRenameContext.key, element.capabilities.get().supportsRename ?? false],
      [SessionSupportsDeleteContext.key, element.capabilities.get().supportsDelete ?? false],
      [SessionHasPullRequestContext.key, !!element.workspace.get()?.folders[0]?.gitRepository?.gitHubInfo.get()?.pullRequest]
    ];
    const menu = this.menuService.createMenu(SessionItemContextMenuId, this.contextKeyService.createOverlay(contextOverlay));
    const marshalledArg = {
      $mid: MarshalledId.AgentSessionContext,
      session: { resource: element.resource },
      sessions: selectedSessions.map((s) => ({ resource: s.resource }))
    };
    const wrapForExtensions = (action) => {
      if (!(action instanceof MenuItemAction) || !action.item.source) {
        return action;
      }
      const wrapped = new Action(action.id, action.label, action.class, action.enabled, () => this.commandService.executeCommand(action.id, marshalledArg));
      wrapped.tooltip = action.tooltip;
      wrapped.checked = action.checked;
      return wrapped;
    };
    this.contextMenuService.showContextMenu({
      getActions: () => {
        const base = Separator.join(...menu.getActions({ arg: selectedSessions, shouldForwardArgs: true }).map(([, actions]) => actions.map(wrapForExtensions)));
        const groupActions = this.getGroupSessionActions(selectedSessions);
        return groupActions.length > 0 ? [...base, new Separator(), ...groupActions] : base;
      },
      getAnchor: () => e.anchor,
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id) ?? void 0
    });
    menu.dispose();
  }
  /**
   * Build the group-related context menu actions for the given session(s):
   * "Create Group", an "Add to Group"/"Move to Group" submenu listing the
   * groups in display order, and "Remove from Group" when applicable.
   */
  getGroupSessionActions(selected) {
    const actions = [];
    if (selected.some((session) => session.isArchived.get())) {
      return actions;
    }
    actions.push(this.getCreateGroupAction(selected));
    const currentGroupIds = new Set(selected.map((s) => this._sessionGroupsService.getGroupOfSession(s.sessionId)));
    const currentGroupId = currentGroupIds.size === 1 ? [...currentGroupIds][0] : void 0;
    const targetGroups = this.getGroupsInDisplayOrder().filter((g) => g.id !== currentGroupId);
    if (targetGroups.length > 0) {
      const subActions = targetGroups.map((g) => new Action(`sessions.addToGroup.${g.id}`, g.name, void 0, true, async () => {
        this.addSessionsToGroup(selected, g.id);
      }));
      const label = currentGroupId !== void 0 ? localize("moveToGroupAction", "Move to Group") : localize("addToGroupAction", "Add to Group");
      actions.push(new SubmenuAction("sessions.addToGroupSubmenu", label, subActions));
    }
    if (currentGroupId !== void 0) {
      actions.push(new Action("sessions.removeFromGroup", localize("removeFromGroupAction", "Remove from Group"), void 0, true, async () => {
        for (const session of selected) {
          this._sessionGroupsService.removeFromGroup(session.sessionId);
        }
      }));
    }
    return actions;
  }
  getCreateGroupAction(sessions) {
    return new Action("sessions.createGroup", localize("createGroupAction", "Create Group"), void 0, true, async () => {
      if (sessions) {
        this.createGroupFromSessions(sessions);
      } else {
        this.createGroup([]);
      }
    });
  }
  showCreateGroupContextMenu(anchor) {
    this.contextMenuService.showContextMenu({
      getActions: () => [this.getCreateGroupAction()],
      getAnchor: () => anchor
    });
  }
  showGroupContextMenu(groupItem, anchor) {
    const actions = [
      this.getCreateGroupAction(),
      new Separator(),
      new Action("sessions.renameGroupAction", localize("renameGroupAction", "Rename..."), void 0, true, async () => {
        this.beginRenameGroup(groupItem.group.id);
      }),
      new Action("sessions.deleteGroupAction", localize("deleteGroupAction", "Delete Group"), void 0, true, async () => {
        this._sessionGroupsService.deleteGroup(groupItem.group.id);
      })
    ];
    this.contextMenuService.showContextMenu({
      getActions: () => actions,
      getAnchor: () => anchor
    });
  }
  resetSectionCollapseState() {
    this.storageService.remove(SessionsList.SECTION_COLLAPSE_STATE_KEY, StorageScope.PROFILE);
  }
  // -- Pinning --
  pinSession(session) {
    this._sessionsListModelService.pinSession(session);
  }
  pinSessions(sessions, target, position) {
    const pinnable = sessions.filter((session) => !session.isArchived.get());
    for (const session of pinnable) {
      this._sessionsListModelService.pinSession(session);
    }
    if (target && position) {
      this.reorderSessions(pinnable, target, position);
    }
  }
  unpinSession(session) {
    this._sessionsListModelService.unpinSession(session);
  }
  isSessionPinned(session) {
    return this._sessionsListModelService.isSessionPinned(session);
  }
  /** Whether any registered provider can create quick chats (gates the always-visible "Chats" section). */
  _someProviderSupportsQuickChats() {
    return this._sessionsProvidersService.getProviders().some((p) => !!p.supportsQuickChats);
  }
  // -- Read/Unread --
  markRead(session) {
    this._sessionsManagementService.markRead(session);
  }
  markUnread(session) {
    this._sessionsManagementService.markUnread(session);
  }
  // -- Session type filtering --
  setSessionTypeExcluded(sessionTypeId, excluded) {
    if (excluded) {
      this.excludedSessionTypes.add(sessionTypeId);
    } else {
      this.excludedSessionTypes.delete(sessionTypeId);
    }
    this.saveExcludedSessionTypes();
    this.update();
  }
  isSessionTypeExcluded(sessionTypeId) {
    return this.excludedSessionTypes.has(sessionTypeId);
  }
  loadExcludedSessionTypes() {
    const raw = this.storageService.get(SessionsList.EXCLUDED_TYPES_KEY, StorageScope.PROFILE);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      } catch {
      }
    }
    return /* @__PURE__ */ new Set();
  }
  saveExcludedSessionTypes() {
    if (this.excludedSessionTypes.size === 0) {
      this.storageService.remove(SessionsList.EXCLUDED_TYPES_KEY, StorageScope.PROFILE);
    } else {
      this.storageService.store(SessionsList.EXCLUDED_TYPES_KEY, JSON.stringify([...this.excludedSessionTypes]), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  // -- Status filtering --
  setStatusExcluded(status, excluded) {
    if (excluded) {
      this.excludedStatuses.add(status);
    } else {
      this.excludedStatuses.delete(status);
    }
    this.saveExcludedStatuses();
    this.update();
  }
  isStatusExcluded(status) {
    return this.excludedStatuses.has(status);
  }
  loadExcludedStatuses() {
    const raw = this.storageService.get(SessionsList.EXCLUDED_STATUSES_KEY, StorageScope.PROFILE);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      } catch {
      }
    }
    return /* @__PURE__ */ new Set();
  }
  saveExcludedStatuses() {
    if (this.excludedStatuses.size === 0) {
      this.storageService.remove(SessionsList.EXCLUDED_STATUSES_KEY, StorageScope.PROFILE);
    } else {
      this.storageService.store(SessionsList.EXCLUDED_STATUSES_KEY, JSON.stringify([...this.excludedStatuses]), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  // -- Archived / Read filtering --
  setExcludeArchived(exclude) {
    this._excludeArchived = exclude;
    this.storageService.store(SessionsList.EXCLUDE_ARCHIVED_KEY, exclude, StorageScope.PROFILE, StorageTarget.USER);
    this.update();
  }
  isExcludeArchived() {
    return this._excludeArchived;
  }
  setExcludeRead(exclude) {
    this._excludeRead = exclude;
    this.storageService.store(SessionsList.EXCLUDE_READ_KEY, exclude, StorageScope.PROFILE, StorageTarget.USER);
    this.update();
  }
  isExcludeRead() {
    return this._excludeRead;
  }
  resetFilters() {
    this.excludedSessionTypes.clear();
    this.saveExcludedSessionTypes();
    this.excludedStatuses.clear();
    this.saveExcludedStatuses();
    this._excludeArchived = true;
    this.storageService.store(SessionsList.EXCLUDE_ARCHIVED_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
    this._excludeRead = false;
    this.storageService.store(SessionsList.EXCLUDE_READ_KEY, false, StorageScope.PROFILE, StorageTarget.USER);
    this.workspaceGroupCapped = true;
    this.storageService.store(SessionsList.WORKSPACE_GROUP_CAPPED_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
    this.expandedSessionGroups.clear();
    this.expandedMoreFolders = false;
    this.update();
  }
  // Session group capping
  setWorkspaceGroupCapped(capped) {
    this.workspaceGroupCapped = capped;
    this.storageService.store(SessionsList.WORKSPACE_GROUP_CAPPED_KEY, capped, StorageScope.PROFILE, StorageTarget.USER);
    if (capped) {
      this.expandedSessionGroups.clear();
    }
    this.update();
  }
  isWorkspaceGroupCapped() {
    return this.workspaceGroupCapped;
  }
  setOpenWindowSourceFolder(folder) {
    const before = this.openWindowSourceFolder?.toString();
    const after = folder?.toString();
    if (before === after) {
      return;
    }
    this.openWindowSourceFolder = folder;
    this.update();
  }
  collapseAllSections() {
    this.suspendCollapseStatePersistence = true;
    try {
      this.tree.collapseAll();
    } finally {
      this.suspendCollapseStatePersistence = false;
    }
    this.saveBulkCollapseState(true);
  }
  // -- Section collapse persistence --
  getSavedCollapseState(sectionId) {
    const raw = this.storageService.get(SessionsList.SECTION_COLLAPSE_STATE_KEY, StorageScope.PROFILE);
    if (raw) {
      try {
        const state = JSON.parse(raw);
        if (typeof state[sectionId] === "boolean") {
          return state[sectionId];
        }
      } catch {
      }
    }
    return void 0;
  }
  saveSectionCollapseState(sectionId, collapsed) {
    let state = {};
    const raw = this.storageService.get(SessionsList.SECTION_COLLAPSE_STATE_KEY, StorageScope.PROFILE);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          state = parsed;
        }
      } catch {
      }
    }
    state[sectionId] = collapsed;
    this.storageService.store(SessionsList.SECTION_COLLAPSE_STATE_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.USER);
  }
  saveBulkCollapseState(collapsed) {
    const state = {};
    for (const child of this.tree.getNode(null).children) {
      if (child.element && isSessionSection(child.element)) {
        state[child.element.id] = collapsed;
      }
    }
    this.storageService.store(SessionsList.SECTION_COLLAPSE_STATE_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.USER);
  }
};
SessionsList = __decorateClass([
  __decorateParam(2, ISessionsManagementService),
  __decorateParam(3, ISessionsService),
  __decorateParam(4, ICustomViewService),
  __decorateParam(5, ISessionsListModelService),
  __decorateParam(6, ISessionGroupsService),
  __decorateParam(7, ISessionSectionOrderService),
  __decorateParam(8, IAgentHostFilterService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IContextMenuService),
  __decorateParam(13, IMenuService),
  __decorateParam(14, IKeybindingService),
  __decorateParam(15, ICommandService),
  __decorateParam(16, IAutomationService),
  __decorateParam(17, IVoicePlaybackService),
  __decorateParam(18, IWorkbenchAssignmentService),
  __decorateParam(19, IConfigurationService)
], SessionsList);
function getFirstApprovalAcrossChats(approvalModel, session, reader) {
  let oldest;
  for (const chat of session.chats.read(reader)) {
    const approval = approvalModel.getApproval(chat.resource).read(reader);
    if (approval && (!oldest || approval.since.getTime() < oldest.since.getTime())) {
      oldest = approval;
    }
  }
  return oldest;
}
function sessionMatchesFolder(session, folder) {
  const workspace = session.workspace.get();
  if (!workspace) {
    return false;
  }
  const folderStr = folder.toString();
  for (const folder2 of workspace.folders) {
    if (folder2.workingDirectory?.toString() === folderStr || folder2.root.toString() === folderStr) {
      return true;
    }
  }
  return false;
}
function sortSessions(sessions, sorting, getSortKey) {
  const key = getSortKey ?? defaultSortKey;
  return [...sessions].sort((a, b) => key(b, sorting) - key(a, sorting));
}
function limitSessionsForList(sessions, limit, options) {
  if (!options.enabled || sessions.length <= limit) {
    return { sessions, showMore: void 0 };
  }
  if (options.expanded) {
    return {
      sessions,
      showMore: {
        showMore: true,
        kind: "sessions",
        mode: "less",
        sectionId: options.sectionId,
        sectionLabel: options.sectionLabel,
        remainingCount: 0
      }
    };
  }
  return {
    sessions: sessions.slice(0, limit),
    showMore: {
      showMore: true,
      kind: "sessions",
      mode: "more",
      sectionId: options.sectionId,
      sectionLabel: options.sectionLabel,
      remainingCount: sessions.length - limit
    }
  };
}
function defaultSortKey(session, sorting) {
  if (sorting === "updated" /* Updated */) {
    return session.updatedAt.get().getTime();
  }
  return session.createdAt.getTime();
}
function computeReorderSortChanges(input) {
  const { draggedIds, naturalKeys, aboveKey, belowKey, now, fallbackStep } = input;
  const count = draggedIds.length;
  const upperFit = aboveKey ?? Number.POSITIVE_INFINITY;
  const lowerFit = belowKey ?? Number.NEGATIVE_INFINITY;
  let naturalFits = true;
  for (let i = 0; i < count; i++) {
    if (!(naturalKeys[i] < upperFit && naturalKeys[i] > lowerFit)) {
      naturalFits = false;
      break;
    }
    if (i > 0 && !(naturalKeys[i] < naturalKeys[i - 1])) {
      naturalFits = false;
      break;
    }
  }
  const set = /* @__PURE__ */ new Map();
  const clear = [];
  if (naturalFits) {
    for (const id of draggedIds) {
      clear.push(id);
    }
  } else {
    const upper = aboveKey ?? now;
    const lower = belowKey ?? upper - (count + 1) * fallbackStep;
    const step = (upper - lower) / (count + 1);
    for (let i = 0; i < count; i++) {
      set.set(draggedIds[i], upper - (i + 1) * step);
    }
  }
  return { set, clear };
}
const QUICK_CHATS_SECTION_ID = "quickchats";
function isQuickChatSession(session) {
  return session.isQuickChat?.get() ?? false;
}
function groupSessionsForList(sessions, grouping, sorting, isSessionPinned, getSortKey, archivedSectionLabel = getChatSessionArchivedSectionLabel(ChatSessionArchiveActionWording.MarkAsDone)) {
  const sorted = sortSessions(sessions, sorting, getSortKey);
  const pinned = [];
  const archived = [];
  const quickChats = [];
  const regular = [];
  for (const session of sorted) {
    if (session.isArchived.get()) {
      archived.push(session);
    } else if (isSessionPinned(session)) {
      pinned.push(session);
    } else if (isQuickChatSession(session)) {
      quickChats.push(session);
    } else {
      regular.push(session);
    }
  }
  const sections = [];
  if (pinned.length > 0) {
    sections.push({ id: "pinned", label: localize("pinned", "Pinned"), sessions: pinned });
  }
  if (quickChats.length > 0) {
    sections.push({ id: QUICK_CHATS_SECTION_ID, label: localize("chatsSection", "Chats"), sessions: quickChats });
  }
  sections.push(...grouping === "workspace" /* Workspace */ ? groupByWorkspace(regular) : groupByDate(regular, sorting, getSortKey));
  if (archived.length > 0) {
    sections.push({ id: "archived", label: archivedSectionLabel, sessions: archived });
  }
  return sections;
}
function sessionWorkspaceLabel(session) {
  return session.workspace.get()?.label || localize("unknown", "Unknown");
}
function groupByWorkspace(sessions) {
  const groups = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    const label = sessionWorkspaceLabel(session);
    let group = groups.get(label);
    if (!group) {
      group = [];
      groups.set(label, group);
    }
    group.push(session);
  }
  const unknownWorkspaceLabel = localize("unknown", "Unknown");
  const order = [...groups.keys()].filter((k) => k !== unknownWorkspaceLabel).sort((a, b) => a.localeCompare(b));
  const result = order.map((label) => ({
    id: `workspace:${label}`,
    label,
    sessions: groups.get(label)
  }));
  const unknownWorkspace = groups.get(unknownWorkspaceLabel);
  if (unknownWorkspace) {
    result.push({ id: `workspace:${unknownWorkspaceLabel}`, label: unknownWorkspaceLabel, sessions: unknownWorkspace });
  }
  return result;
}
const RECENT_SESSIONS_LIMIT = 10;
function groupByDate(sessions, sorting, getSortKey) {
  const key = getSortKey ?? defaultSortKey;
  const now = /* @__PURE__ */ new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 7 * 864e5;
  const recent = [];
  const older = [];
  for (const session of sessions) {
    const time = key(session, sorting);
    if (time >= startOfWeek && recent.length < RECENT_SESSIONS_LIMIT) {
      recent.push(session);
    } else {
      older.push(session);
    }
  }
  const sections = [];
  const addGroup = (id, label, groupSessions) => {
    if (groupSessions.length > 0) {
      sections.push({ id, label, sessions: groupSessions });
    }
  };
  addGroup("recent", localize("recent", "Recent"), recent);
  addGroup("older", localize("older", "Older"), older);
  return sections;
}
let SessionsFlatList = class extends Disposable {
  constructor(container, options, _sessionsService, _sessionsListModelService, _sessionsManagementService, instantiationService, contextKeyService, markdownRendererService, hoverService, sessionsProvidersService, voicePlaybackService) {
    super();
    this.options = options;
    this._sessionsService = _sessionsService;
    this._sessionsListModelService = _sessionsListModelService;
    this._sessionsManagementService = _sessionsManagementService;
    this._onDidChangeContentHeight = this._register(new Emitter());
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this._onDidApproveSession = this._register(new Emitter());
    /** Fires when a session's pending action is approved from its "Allow" button. */
    this.onDidApproveSession = this._onDidApproveSession.event;
    this._sessions = [];
    const listRoot = DOM.append(container, $(".sessions-list-control"));
    const approvalModel = this.options.approvalModel ?? this._register(instantiationService.createInstance(AgentSessionApprovalModel));
    const agentSessionsService = instantiationService.invokeFunction((accessor) => accessor.get(IAgentSessionsService));
    const sessionRenderer = new SessionItemRenderer(
      {
        grouping: () => "date" /* Date */,
        isPinned: (s) => this._sessionsListModelService.isSessionPinned(s),
        visibleSessions: this._sessionsService.visibleSessions,
        getMultiSelectedSessions: (s) => [s],
        showHover: this.options.showSessionHover ?? true,
        approvalRowMaxLines: this.options.approvalRowMaxLines ?? DEFAULT_APPROVAL_ROW_MAX_LINES,
        toolbarMenuId: this.options.toolbarMenuId ?? SessionItemToolbarMenuId,
        handleToolbarAction: this.options.onToolbarAction
      },
      approvalModel,
      this.options.ciFixModel,
      instantiationService,
      contextKeyService,
      markdownRendererService,
      hoverService,
      sessionsProvidersService,
      agentSessionsService,
      voicePlaybackService
    );
    this._delegate = new SessionsTreeDelegate(approvalModel, () => false, this.options.approvalRowMaxLines ?? DEFAULT_APPROVAL_ROW_MAX_LINES, this.options.ciFixModel);
    this.tree = this._register(instantiationService.createInstance(
      WorkbenchObjectTree,
      "SessionsFlatList",
      listRoot,
      this._delegate,
      [sessionRenderer],
      {
        accessibilityProvider: new SessionsAccessibilityProvider(),
        identityProvider: {
          getId: (element) => element.resource.toString()
        },
        horizontalScrolling: false,
        multipleSelectionSupport: false,
        indent: 0,
        overrideStyles: this.options.overrideStyles,
        renderIndentGuides: RenderIndentGuides.None,
        twistieAdditionalCssClass: () => "force-no-twistie"
      }
    ));
    this._register(this.tree.onDidOpen((e) => {
      const element = e.element;
      if (!element || !isSessionItem(element)) {
        return;
      }
      this._sessionsManagementService.markRead(element);
      const isLeftClick = DOM.isMouseEvent(e.browserEvent) && e.browserEvent.button === 0;
      const preserveFocus = isLeftClick ? false : e.editorOptions.preserveFocus ?? false;
      this.options.onSessionOpen(element.resource, preserveFocus, e.sideBySide);
    }));
    this._register(sessionRenderer.onDidChangeItemHeight((session) => {
      if (this.tree.hasElement(session)) {
        this.tree.updateElementHeight(session, this._delegate.getHeight(session));
        this._onDidChangeContentHeight.fire();
      }
    }));
    this._register(sessionRenderer.onDidApproveSession((approved) => this._onDidApproveSession.fire(approved)));
  }
  static {
    this.ROW_HEIGHT = 54;
  }
  setSessions(sessions) {
    this._sessions = sessions;
    this.tree.setChildren(null, sessions.map((session) => ({ element: session })));
  }
  /** The total pixel height required to render all current rows without scrolling. */
  getContentHeight() {
    return this._sessions.reduce((total, session) => total + this._delegate.getHeight(session), 0);
  }
  getRowHeight() {
    return SessionsFlatList.ROW_HEIGHT;
  }
  layout(height, width) {
    this.tree.layout(height, width);
  }
  focus() {
    this.tree.domFocus();
  }
};
SessionsFlatList = __decorateClass([
  __decorateParam(2, ISessionsService),
  __decorateParam(3, ISessionsListModelService),
  __decorateParam(4, ISessionsManagementService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IMarkdownRendererService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, ISessionsProvidersService),
  __decorateParam(10, IVoicePlaybackService)
], SessionsFlatList);
export {
  IsSessionPinnedContext,
  QUICK_CHATS_SECTION_ID,
  SESSIONS_LIST_SHOW_EMPTY_DEFAULT_GROUPS_SETTING,
  SessionGroupHasVisibleSessionsContext,
  SessionGroupIsEmptyContext,
  SessionGroupToolbarMenuId,
  SessionItemContextMenuId,
  SessionItemHasBranchNameContext,
  SessionItemInGroupContext,
  SessionItemStatusContext,
  SessionItemToolbarMenuId,
  SessionSectionToolbarMenuId,
  SessionSectionTypeContext,
  SessionsFlatList,
  SessionsGrouping,
  SessionsList,
  SessionsSorting,
  computeReorderSortChanges,
  getFirstApprovalAcrossChats,
  groupByDate,
  groupByWorkspace,
  groupSessionsForList,
  isQuickChatSession,
  limitSessionsForList,
  sortSessions
};
