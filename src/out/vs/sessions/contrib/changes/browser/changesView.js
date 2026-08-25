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
import "./media/changesView.css";
import * as dom from "../../../../base/browser/dom.js";
import { ActionViewItem, BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Schemas } from "../../../../base/common/network.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ActionRunner, Separator, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { autorun, derived, derivedObservableWithCache, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { ProgressBar } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { basename, isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { MenuWorkbenchButtonBar, WorkbenchButtonBar } from "../../../../platform/actions/browser/buttonbar.js";
import { getActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { ActionWidgetDropdownActionViewItem } from "../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js";
import { MenuId, Action2, MenuItemAction, registerAction2, IMenuService } from "../../../../platform/actions/common/actions.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchCompressibleObjectTree } from "../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { ActiveEditorContext } from "../../../../workbench/common/contextkeys.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { SinglePaneLayoutEnabledContext } from "../../../common/contextkeys.js";
import { SessionChangesEditorInput } from "./sessionChangesEditorInput.js";
import { defaultCountBadgeStyles, defaultProgressBarStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { fillEditorsDragData } from "../../../../workbench/browser/dnd.js";
import { ResourceLabels } from "../../../../workbench/browser/labels.js";
import { ViewPane, ViewAction } from "../../../../workbench/browser/parts/views/viewPane.js";
import { ViewPaneContainer } from "../../../../workbench/browser/parts/views/viewPaneContainer.js";
import { IViewDescriptorService } from "../../../../workbench/common/views.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { createFileIconThemableTreeContainerScope } from "../../../../workbench/contrib/files/browser/views/explorerView.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../workbench/services/editor/common/editorService.js";
import { IExtensionService } from "../../../../workbench/services/extensions/common/extensions.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { getChangesEditorLabels } from "./changesEditorLabels.js";
import { ISessionChangesService } from "./sessionChangesService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { CIStatusWidget } from "./checksWidget.js";
import { SessionFilesWidget } from "./sessionFilesWidget.js";
import { SessionFilesViewModel } from "./sessionFilesViewModel.js";
import { GITHUB_REMOTE_FILE_SCHEME, SessionChangesetOperationScope, SessionChangesetOperationStatus, SessionStatus } from "../../../services/sessions/common/session.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { Orientation } from "../../../../base/browser/ui/sash/sash.js";
import { LayoutPriority, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { Color } from "../../../../base/common/color.js";
import { PANEL_SECTION_BORDER } from "../../../../workbench/common/theme.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../workbench/common/editor.js";
import { logChangesViewFileSelect, logChangesViewVersionModeChange, logChangesViewViewModeChange } from "../../../common/sessionsTelemetry.js";
import { ChecksViewModel } from "./checksViewModel.js";
import { REVEAL_CI_CHECKS_COMMAND_ID } from "./checksActions.js";
import { AGENT_HOST_SKILL_BUTTON_UPDATE_PR_ID, isAgentHostSkillButtonId } from "../../providers/agentHost/browser/agentHostSkillButtons.js";
import { ActiveSessionContextKeys, CHANGES_VIEW_CONTAINER_ID, CHANGES_VIEW_ID, ChangesContextKeys, ChangesViewMode, SESSIONS_CHANGES_OPEN_SINGLE_FILE_DIFF_SETTING } from "../common/changes.js";
import { buildTreeChildren, ChangesTreeRenderer, isChangesFileItem, toIChangesFileItem } from "./changesViewRenderer.js";
import { ResourceTree } from "../../../../base/common/resourceTree.js";
import { compareFileNames, comparePaths } from "../../../../base/common/comparers.js";
import { IViewsService } from "../../../../workbench/services/views/common/viewsService.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { ChangesSummaryWidget } from "./changesSummaryWidget.js";
import { Menus } from "../../../browser/menus.js";
const $ = dom.$;
const RUN_SESSION_CODE_REVIEW_ACTION_ID = "sessions.codeReview.run";
const VERSIONS_PICKER_ACTION_ID = "chatEditing.versionsPicker";
const DIFF_STATS_ACTION_ID = "workbench.changesView.action.viewChanges";
const singlePaneChangesEditorHeader = ContextKeyExpr.and(
  SinglePaneLayoutEnabledContext,
  ActiveEditorContext.isEqualTo(SessionChangesEditorInput.EDITOR_ID)
);
const EMPTY_FILE_CHANGES_MIN_HEIGHT = 140;
const TREE_PANE_LIST_BOTTOM_PADDING = 12;
let ChangesMenuWorkbenchButtonBarWidget = class extends Disposable {
  constructor(container, hasGitOperationInProgressObs, menuService, changesViewService, contextKeyService, contextMenuService, keybindingService, telemetryService, hoverService) {
    super();
    this._onDidChangeActions = this._register(new Emitter());
    this.onDidChangeActions = this._onDidChangeActions.event;
    const outgoingChangesObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const activeSessionState = changesViewService.activeSessionStateObs.read(reader);
      const hasGitOperationInProgress = hasGitOperationInProgressObs.read(reader);
      if (hasGitOperationInProgress) {
        return lastValue;
      }
      return activeSessionState?.outgoingChanges;
    });
    const runningLabelObs = observableValue(this, void 0);
    this._register(autorun((reader) => {
      if (!hasGitOperationInProgressObs.read(reader)) {
        runningLabelObs.set(void 0, void 0);
      }
    }));
    this._register(autorun((reader) => {
      const hasGitOperationInProgress = hasGitOperationInProgressObs.read(reader);
      const sessionResource = changesViewService.activeSessionResourceObs.read(reader);
      const outgoingChanges = outgoingChangesObs.read(reader) ?? 0;
      const buttonBar = new MenuWorkbenchButtonBar(
        container,
        MenuId.AgentsChangesToolbar,
        {
          telemetrySource: "changesView",
          menuOptions: sessionResource ? { arg: sessionResource } : { shouldForwardArgs: true },
          buttonConfigProvider: (action) => this._getButtonConfiguration(action, outgoingChanges, hasGitOperationInProgress, runningLabelObs)
        },
        menuService,
        contextKeyService,
        contextMenuService,
        keybindingService,
        telemetryService,
        hoverService
      );
      reader.store.add(buttonBar.onWillRun((e) => runningLabelObs.set(e.action.label, void 0)));
      this._currentButtonBar = buttonBar;
      reader.store.add(buttonBar.onDidChange(() => this._onDidChangeActions.fire()));
      this._onDidChangeActions.fire();
      reader.store.add(buttonBar);
    }));
  }
  get hasActions() {
    return (this._currentButtonBar?.buttons.length ?? 0) > 0;
  }
  _getButtonConfiguration(action, outgoingChanges, hasGitOperationInProgress, runningLabelObs) {
    if (action.id === "github.copilot.sessions.commit" || action.id === "github.copilot.chat.createPullRequestCopilotCLIAgentSession.createPR") {
      if (!hasGitOperationInProgress) {
        return { showIcon: true, showLabel: true, isSecondary: false };
      }
      const customLabelObs = derived((reader) => {
        const running = runningLabelObs.read(reader);
        return `$(loading) ${running ?? action.label}`;
      });
      return { showIcon: false, showLabel: true, isSecondary: false, customLabelObs };
    }
    if (action.id === "github.copilot.sessions.sync" || action.id === "github.copilot.sessions.commitAndSync") {
      const labelWithCount = outgoingChanges > 0 ? `${action.label} ${outgoingChanges}\u2191` : `${action.label}`;
      if (!hasGitOperationInProgress) {
        return { showIcon: true, showLabel: true, isSecondary: false, customLabel: labelWithCount };
      }
      return { showIcon: false, showLabel: true, isSecondary: false, customLabel: `$(loading) ${labelWithCount}` };
    }
    if (action.id === AGENT_HOST_SKILL_BUTTON_UPDATE_PR_ID) {
      const customLabel = outgoingChanges > 0 ? `${action.label} ${outgoingChanges}\u2191` : action.label;
      return { customLabel, showIcon: true, showLabel: true, isSecondary: false };
    }
    if (action.id === RUN_SESSION_CODE_REVIEW_ACTION_ID || action.id === "chatEditing.viewAllSessionChanges" || action.id === "github.copilot.chat.openPullRequestCopilotCLIAgentSession.openPR") {
      return { showIcon: true, showLabel: false, isSecondary: true };
    }
    if (action.id === "agentFeedbackEditor.action.submitActiveSession") {
      return { showIcon: false, showLabel: true, isSecondary: false };
    }
    if (action.id === "github.copilot.chat.createPullRequestCopilotCLIAgentSession.createPR" || action.id === "github.copilot.chat.mergeCopilotCLIAgentSessionChanges.merge" || action.id === "github.copilot.chat.checkoutPullRequestReroute" || action.id === "pr.checkoutFromChat" || action.id === "github.copilot.sessions.initializeRepository" || action.id === "agentSession.restore" || action.id === "sessions.action.fixCIChecks" || isAgentHostSkillButtonId(action.id)) {
      return { showIcon: true, showLabel: true, isSecondary: false };
    }
    if (action instanceof MenuItemAction) {
      const icon = action.item.icon;
      if (icon) {
        return { showIcon: true, showLabel: false };
      }
    }
    return void 0;
  }
};
ChangesMenuWorkbenchButtonBarWidget = __decorateClass([
  __decorateParam(2, IMenuService),
  __decorateParam(3, IChangesViewService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IHoverService)
], ChangesMenuWorkbenchButtonBarWidget);
let ChangesWorkbenchButtonBarWidget = class extends Disposable {
  get hasActions() {
    return this._buttonBar.buttons.length > 0;
  }
  constructor(container, menuService, changesViewService, contextKeyService, instantiationService) {
    super();
    const menu = this._register(menuService.createMenu(MenuId.AgentsChangesToolbar, contextKeyService));
    const buttonBar = this._buttonBar = this._register(instantiationService.createInstance(
      WorkbenchButtonBar,
      container,
      {
        telemetrySource: "changesView",
        buttonConfigProvider: (_action, index) => {
          return { showIcon: true, showLabel: index === 0 };
        }
      }
    ));
    this.onDidChangeActions = Event.signal(buttonBar.onDidChange);
    const menuActionsObs = observableFromEvent(menu.onDidChange, () => {
      return getActionBarActions(menu.getActions({ shouldForwardArgs: true }));
    });
    const operationActionGroupsObs = derived((reader) => {
      const changeset = changesViewService.activeSessionChangesetObs.read(reader);
      if (!changeset) {
        return [];
      }
      const operations = changesViewService.activeSessionChangesetOperationsObs.read(reader);
      const changesetOperations = operations.filter((op) => op.scopes.includes(SessionChangesetOperationScope.Changeset));
      const toOperationAction = (op) => toAction({
        id: op.id,
        label: op.icon ? op.status === SessionChangesetOperationStatus.Running ? `$(loading) ${op.label}` : `$(${op.icon.id}) ${op.label}` : op.status === SessionChangesetOperationStatus.Running ? `$(loading) ${op.label}` : op.label,
        tooltip: op.description ?? op.label,
        enabled: op.status !== SessionChangesetOperationStatus.Disabled && op.status !== SessionChangesetOperationStatus.Running,
        run: () => changeset.invokeOperation(op.id)
      });
      const groups = /* @__PURE__ */ new Map();
      for (const op of changesetOperations) {
        if (op.status === SessionChangesetOperationStatus.Running) {
          continue;
        }
        const action = toOperationAction(op);
        const groupActions = groups.get(op.group);
        if (groupActions) {
          groupActions.push(action);
        } else {
          groups.set(op.group, [action]);
        }
      }
      const runningActions = changesetOperations.filter((op) => op.status === SessionChangesetOperationStatus.Running).map(toOperationAction);
      return [
        ...runningActions.length > 0 ? [runningActions] : [],
        ...groups.values()
      ];
    });
    this._register(autorun((reader) => {
      const isLoading = changesViewService.activeSessionLoadingObs.read(reader);
      if (isLoading) {
        return;
      }
      const operationActionGroups = operationActionGroupsObs.read(reader);
      const menuActions = menuActionsObs.read(reader);
      const primaryActions = [];
      const operationActions = operationActionGroups.flat();
      if (operationActions.length > 1) {
        const primaryAction = operationActions[0];
        const dropdownActions = [];
        for (const group of operationActionGroups) {
          if (dropdownActions.length > 0) {
            dropdownActions.push(new Separator());
          }
          dropdownActions.push(...group);
        }
        primaryActions.push(new SubmenuAction("changesView.operations.primary.dropdown", primaryAction.label, dropdownActions));
      } else {
        primaryActions.push(...operationActions);
      }
      primaryActions.push(...menuActions.primary);
      buttonBar.update(primaryActions, menuActions.secondary);
    }));
  }
};
ChangesWorkbenchButtonBarWidget = __decorateClass([
  __decorateParam(1, IMenuService),
  __decorateParam(2, IChangesViewService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService)
], ChangesWorkbenchButtonBarWidget);
let ChangesActionsBar = class extends Disposable {
  constructor(container, instantiationService, changesViewService, sessionsService, contextKeyService) {
    super();
    container.classList.add("changes-actions-bar");
    const hasGitOperationInProgressGlobalObs = observableFromEvent(contextKeyService.onDidChangeContext, () => contextKeyService.getContextKeyValue("sessions.hasGitOperationInProgress") === true);
    const hasGitOperationInProgressObs = derived((reader) => {
      if (hasGitOperationInProgressGlobalObs.read(reader)) {
        return true;
      }
      return changesViewService.activeSessionStateObs.read(reader)?.hasGitOperationInProgress === true;
    });
    const isAgentHostSessionObs = derived((reader) => {
      const activeSession = sessionsService.activeSession.read(reader);
      return activeSession ? isAgentHostProviderId(activeSession.providerId) : false;
    });
    let currentWidget;
    const updateVisibility = () => {
      const visible = currentWidget?.hasActions ?? false;
      dom.setVisibility(visible, container);
    };
    this._register(autorun((reader) => {
      dom.clearNode(container);
      const widget = isAgentHostSessionObs.read(reader) ? instantiationService.createInstance(ChangesWorkbenchButtonBarWidget, container) : instantiationService.createInstance(ChangesMenuWorkbenchButtonBarWidget, container, hasGitOperationInProgressObs);
      reader.store.add(widget);
      currentWidget = widget;
      reader.store.add(widget.onDidChangeActions(() => updateVisibility()));
      updateVisibility();
    }));
    this._register(autorun((reader) => {
      sessionsService.activeSession.read(reader)?.status.read(reader);
      updateVisibility();
    }));
  }
};
ChangesActionsBar = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IChangesViewService),
  __decorateParam(3, ISessionsService),
  __decorateParam(4, IContextKeyService)
], ChangesActionsBar);
const CHANGES_HEADER_ACTIONS_ID = "workbench.changesView.headerActions";
let ChangesActionsBarActionViewItem = class extends BaseActionViewItem {
  constructor(action, options, instantiationService) {
    super(void 0, action, options);
    this.instantiationService = instantiationService;
  }
  render(container) {
    super.render(container);
    this._register(this.instantiationService.createInstance(ChangesActionsBar, container));
  }
};
ChangesActionsBarActionViewItem = __decorateClass([
  __decorateParam(2, IInstantiationService)
], ChangesActionsBarActionViewItem);
let ChangesActionViewItemsContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.changesEditorHeader";
  }
  constructor(actionViewItemService) {
    super();
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(Menus.SessionsEditorHeaderPrimary, VERSIONS_PICKER_ACTION_ID, (action, _options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(ChangesPickerActionItem, action);
    }, onDidRegister.event));
    this._register(actionViewItemService.register(Menus.SessionsEditorHeaderPrimary, DIFF_STATS_ACTION_ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(SinglePaneChangesDiffStatsActionItem, action, options);
    }, onDidRegister.event));
    this._register(actionViewItemService.register(Menus.TitleBarSessionMenu, CHANGES_HEADER_ACTIONS_ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(ChangesActionsBarActionViewItem, action, options);
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
ChangesActionViewItemsContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], ChangesActionViewItemsContribution);
registerWorkbenchContribution2(ChangesActionViewItemsContribution.ID, ChangesActionViewItemsContribution, WorkbenchPhase.BlockRestore);
let ChangesViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, changesViewService, editorService, sessionsService, labelService, logService, telemetryService, sessionChangesService, workbenchLayoutService) {
    super({ ...options, titleMenuId: MenuId.ChatEditingSessionTitleToolbar }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.changesViewService = changesViewService;
    this.editorService = editorService;
    this.sessionsService = sessionsService;
    this.labelService = labelService;
    this.logService = logService;
    this.telemetryService = telemetryService;
    this.sessionChangesService = sessionChangesService;
    this.workbenchLayoutService = workbenchLayoutService;
    this.treePaneSizeChange = this._register(new Emitter());
    this.sectionPanesUserResized = false;
    this.renderDisposables = this._register(new DisposableStore());
    // Track current body dimensions for list layout
    this.currentBodyHeight = 0;
    this.currentBodyWidth = 0;
    this.isMergeBaseBranchProtectedContextKey = ActiveSessionContextKeys.IsMergeBaseBranchProtected.bindTo(this.scopedContextKeyService);
    this.isolationModeContextKey = ActiveSessionContextKeys.IsolationMode.bindTo(this.scopedContextKeyService);
    this.hasGitRepositoryContextKey = ActiveSessionContextKeys.HasGitRepository.bindTo(this.scopedContextKeyService);
    this.hasUpstreamContextKey = ActiveSessionContextKeys.HasUpstream.bindTo(this.scopedContextKeyService);
    this.hasIncomingChangesContextKey = ActiveSessionContextKeys.HasIncomingChanges.bindTo(this.scopedContextKeyService);
    this.hasOutgoingChangesContextKey = ActiveSessionContextKeys.HasOutgoingChanges.bindTo(this.scopedContextKeyService);
    this.hasUncommittedChangesContextKey = ActiveSessionContextKeys.HasUncommittedChanges.bindTo(this.scopedContextKeyService);
    this.hasBranchChangesContextKey = ActiveSessionContextKeys.HasBranchChanges.bindTo(this.scopedContextKeyService);
    this.hasGitHubRemoteContextKey = ActiveSessionContextKeys.HasGitHubRemote.bindTo(this.scopedContextKeyService);
    this.hasPullRequestContextKey = ActiveSessionContextKeys.HasPullRequest.bindTo(this.scopedContextKeyService);
    this.hasOpenPullRequestContextKey = ActiveSessionContextKeys.HasOpenPullRequest.bindTo(this.scopedContextKeyService);
    this.hasGitOperationInProgressContextKey = ActiveSessionContextKeys.HasGitOperationInProgress.bindTo(this.scopedContextKeyService);
    this._register(bindContextKey(ChangesContextKeys.VersionMode, this.scopedContextKeyService, (reader) => {
      return this.changesViewService.activeSessionChangesetObs.read(reader)?.id ?? "";
    }));
    this._register(bindContextKey(ChangesContextKeys.ViewMode, this.scopedContextKeyService, (reader) => {
      return this.changesViewService.viewModeObs.read(reader);
    }));
    this._register(bindContextKey(ChatContextKeys.agentSessionType, this.scopedContextKeyService, (reader) => {
      return this.changesViewService.activeSessionTypeObs.read(reader) ?? "";
    }));
    const hasGitOperationInProgressGlobalContextObs = observableFromEvent(this.contextKeyService.onDidChangeContext, () => {
      return this.contextKeyService.getContextKeyValue("sessions.hasGitOperationInProgress") === true;
    });
    const hasGitOperationInProgressStateObs = derived((reader) => {
      const activeSessionState = this.changesViewService.activeSessionStateObs.read(reader);
      return activeSessionState?.hasGitOperationInProgress === true;
    });
    this.hasGitOperationInProgressObs = derived((reader) => {
      const hasGitOperationInProgressGlobalContext = hasGitOperationInProgressGlobalContextObs.read(reader);
      const hasGitOperationInProgressState = hasGitOperationInProgressStateObs.read(reader);
      const contextKeyValue = hasGitOperationInProgressGlobalContext === true ? hasGitOperationInProgressGlobalContext : hasGitOperationInProgressState;
      this.hasGitOperationInProgressContextKey.set(contextKeyValue);
      return contextKeyValue;
    });
    const scopedServiceCollection = new ServiceCollection([IContextKeyService, this.scopedContextKeyService]);
    this.scopedInstantiationService = this.instantiationService.createChild(scopedServiceCollection);
    this._register(this.scopedInstantiationService);
  }
  renderBody(container) {
    super.renderBody(container);
    this.bodyContainer = dom.append(container, $(".changes-view-body"));
    this.actionsContainer = dom.append(this.bodyContainer, $(".chat-editing-session-actions.outside-card"));
    this.splitViewContainer = dom.append(this.bodyContainer, $(".changes-splitview-container"));
    this.contentContainer = dom.append(this.splitViewContainer, $(".chat-editing-session-container.show-file-icons"));
    this._register(createFileIconThemableTreeContainerScope(this.contentContainer, this.themeService));
    const updateHasFileIcons = () => {
      this.contentContainer.classList.toggle("has-file-icons", this.themeService.getFileIconTheme().hasFileIcons);
    };
    updateHasFileIcons();
    this._register(this.themeService.onDidFileIconThemeChange(updateHasFileIcons));
    this.createFilesHeader(this.contentContainer);
    const progressContainer = dom.append(this.contentContainer, $(".changes-progress"));
    this.changesProgressBar = this._register(new ProgressBar(progressContainer, defaultProgressBarStyles));
    this.changesProgressBar.stop().hide();
    this.listContainer = dom.append(this.contentContainer, $(".changes-file-list"));
    this.welcomeContainer = dom.append(this.contentContainer, $(".changes-welcome"));
    this.welcomeContainer.style.display = "none";
    const welcomeMessage = dom.append(this.welcomeContainer, $(".changes-welcome-message"));
    welcomeMessage.textContent = localize("changesView.noChanges", "Changed files and other session artifacts will appear here.");
    this.sessionFilesWidget = this._register(this.scopedInstantiationService.createInstance(SessionFilesWidget, this.splitViewContainer));
    this.ciStatusWidget = this._register(this.scopedInstantiationService.createInstance(CIStatusWidget, this.splitViewContainer));
    this.splitView = this._register(new SplitView(this.splitViewContainer, {
      orientation: Orientation.VERTICAL,
      proportionalLayout: false
    }));
    const sessionFilesWidget = this.sessionFilesWidget;
    const ciWidget = this.ciStatusWidget;
    const ciMinHeight = CIStatusWidget.HEADER_HEIGHT + CIStatusWidget.MIN_BODY_HEIGHT;
    const sessionFilesMinHeight = SessionFilesWidget.HEADER_HEIGHT + SessionFilesWidget.MIN_BODY_HEIGHT;
    const getSessionFilesContentHeight = () => Math.max(SessionFilesWidget.HEADER_HEIGHT, sessionFilesWidget.desiredHeight);
    const getSessionFilesMinimumHeight = () => sessionFilesWidget.collapsed ? SessionFilesWidget.HEADER_HEIGHT : Math.min(sessionFilesMinHeight, getSessionFilesContentHeight());
    const getSessionFilesPreferredHeight = () => Math.max(
      getSessionFilesMinimumHeight(),
      Math.min(getSessionFilesContentHeight(), SessionFilesWidget.HEADER_HEIGHT + SessionFilesWidget.PREFERRED_BODY_HEIGHT)
    );
    const getCIContentHeight = () => Math.max(CIStatusWidget.HEADER_HEIGHT, ciWidget.desiredHeight);
    const getCIMinimumHeight = () => ciWidget.collapsed ? CIStatusWidget.HEADER_HEIGHT : Math.min(ciMinHeight, getCIContentHeight());
    const getCIPreferredHeight = () => Math.max(
      getCIMinimumHeight(),
      Math.min(getCIContentHeight(), CIStatusWidget.HEADER_HEIGHT + CIStatusWidget.PREFERRED_BODY_HEIGHT)
    );
    const getReservedSectionHeight = () => (sessionFilesWidget.visible ? getSessionFilesMinimumHeight() : 0) + (ciWidget.visible ? getCIMinimumHeight() : 0);
    this.rebalanceSectionPanes = () => {
      if (!this.splitView || this.sectionPanesUserResized || !ciWidget.visible || ciWidget.collapsed) {
        return;
      }
      this.splitView.resizeView(2, getCIMinimumHeight());
    };
    const thisView = this;
    const treePane = {
      element: this.contentContainer,
      get minimumSize() {
        return thisView.getTreePaneMinimumSize(getReservedSectionHeight());
      },
      get maximumSize() {
        return thisView.getTreePaneMaximumSize();
      },
      onDidChange: this.treePaneSizeChange.event,
      layout: (height) => {
        this.contentContainer.style.height = `${height}px`;
        this._layoutTreeInPane(height);
      }
    };
    const sessionFilesElement = this.sessionFilesWidget.element;
    const sessionFilesPane = {
      element: sessionFilesElement,
      get minimumSize() {
        return getSessionFilesMinimumHeight();
      },
      get maximumSize() {
        return sessionFilesWidget.collapsed ? SessionFilesWidget.HEADER_HEIGHT : getSessionFilesContentHeight();
      },
      priority: LayoutPriority.High,
      onDidChange: Event.map(this.sessionFilesWidget.onDidChangeHeight, () => void 0),
      layout: (height) => {
        sessionFilesElement.style.height = `${height}px`;
        const bodyHeight = Math.max(0, height - SessionFilesWidget.HEADER_HEIGHT);
        sessionFilesWidget.layout(bodyHeight);
      }
    };
    const ciElement = this.ciStatusWidget.element;
    const ciPane = {
      element: ciElement,
      get minimumSize() {
        return getCIMinimumHeight();
      },
      get maximumSize() {
        return ciWidget.collapsed ? CIStatusWidget.HEADER_HEIGHT : getCIContentHeight();
      },
      priority: LayoutPriority.Low,
      onDidChange: Event.map(this.ciStatusWidget.onDidChangeHeight, () => void 0),
      layout: (height) => {
        ciElement.style.height = `${height}px`;
        const bodyHeight = Math.max(0, height - CIStatusWidget.HEADER_HEIGHT);
        ciWidget.layout(bodyHeight);
      }
    };
    this.splitView.addView(treePane, Sizing.Distribute, 0, true);
    this.splitView.addView(sessionFilesPane, SessionFilesWidget.HEADER_HEIGHT + SessionFilesWidget.PREFERRED_BODY_HEIGHT, 1, true);
    this.splitView.addView(ciPane, CIStatusWidget.HEADER_HEIGHT + CIStatusWidget.PREFERRED_BODY_HEIGHT, 2, true);
    const updateSplitViewStyles = () => {
      const borderColor = this.themeService.getColorTheme().getColor(PANEL_SECTION_BORDER);
      this.splitView.style({ separatorBorder: borderColor ?? Color.transparent });
    };
    updateSplitViewStyles();
    this._register(this.themeService.onDidColorThemeChange(updateSplitViewStyles));
    this._register(this.splitView.onDidSashChange(() => this.sectionPanesUserResized = true));
    this.splitView.setViewVisible(1, false);
    this.splitView.setViewVisible(2, false);
    this._wireSectionPane(this.sessionFilesWidget, 1, SessionFilesWidget.HEADER_HEIGHT, getSessionFilesPreferredHeight);
    this._register(this.sessionFilesWidget.onDidChangeHeight(() => this.fireTreePaneSizeChange()));
    this._wireSectionPane(this.ciStatusWidget, 2, CIStatusWidget.HEADER_HEIGHT, getCIPreferredHeight);
    this._register(this.ciStatusWidget.onDidChangeHeight(() => this.fireTreePaneSizeChange()));
    this._register(autorun((reader) => {
      const state = this.changesViewService.activeSessionSectionCollapseStateObs.read(reader);
      sessionFilesWidget.setCollapsed(state.otherFiles);
      ciWidget.setCollapsed(state.checks);
    }));
    this._register(sessionFilesWidget.onDidToggleCollapsed((collapsed) => this.setActiveSectionCollapsed("otherFiles", collapsed)));
    this._register(ciWidget.onDidToggleCollapsed((collapsed) => this.setActiveSectionCollapsed("checks", collapsed)));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible) {
        this.onVisible();
      } else {
        this.renderDisposables.clear();
      }
    }));
    if (this.isBodyVisible()) {
      this.onVisible();
    }
  }
  getActionsContext() {
    return this.changesViewService.activeSessionResourceObs.get();
  }
  onVisible() {
    this.renderDisposables.clear();
    this.renderDisposables.add(autorun((reader) => {
      this.changesViewService.activeSessionResourceObs.read(reader);
      this.updateActions();
    }));
    this.renderDisposables.add(autorun((reader) => {
      const isLoading = this.changesViewService.activeSessionChangesetLoadingObs.read(reader);
      if (isLoading) {
        this.changesProgressBar.infinite().show(200);
      } else {
        this.changesProgressBar.stop().hide();
      }
    }));
    const changesObs = derived((reader) => {
      const changes = this.changesViewService.activeSessionChangesObs.read(reader);
      return toIChangesFileItem(changes);
    });
    const topLevelStats = derivedObservableWithCache(this, (reader, lastValue) => {
      const isLoading = this.changesViewService.activeSessionChangesetLoadingObs.read(reader);
      if (isLoading) {
        return lastValue;
      }
      const entries = changesObs.read(reader);
      let added = 0, removed = 0;
      for (const entry of entries) {
        added += entry.linesAdded;
        removed += entry.linesRemoved;
      }
      return { files: entries.length, added, removed };
    });
    if (this.actionsContainer) {
      this._bindContextKeys(topLevelStats);
      this.createActionsButtonBar();
    }
    const activeSessionStatusObs = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession?.status.read(reader);
    });
    this.renderDisposables.add(autorun((reader) => {
      if (this.changesViewService.activeSessionLoadingObs.read(reader)) {
        return;
      }
      const activeSessionStatus = activeSessionStatusObs.read(reader);
      const isUntitled = activeSessionStatus === SessionStatus.Untitled;
      if (this.actionsContainer) {
        dom.setVisibility(this.isActionsContainerVisible(isUntitled), this.actionsContainer);
      }
      const stats = topLevelStats.read(reader);
      const hasEntries = stats !== void 0 && stats.files > 0;
      if (this.filesHeaderNode) {
        const hasGitRepository = this.changesViewService.activeSessionHasGitRepositoryObs.read(reader);
        dom.setVisibility(!isUntitled && (hasGitRepository || hasEntries), this.filesHeaderNode);
      }
      if (this.fileHeaderToolbarContainer) {
        dom.setVisibility(hasEntries, this.fileHeaderToolbarContainer);
      }
      dom.setVisibility(hasEntries, this.listContainer);
      dom.setVisibility(!hasEntries, this.welcomeContainer);
      this.fireTreePaneSizeChange();
      this.layoutSplitView();
    }));
    if (!this.tree && this.listContainer) {
      this.tree = this.createChangesTree(this.listContainer, this.onDidChangeBodyVisibility, this._store);
    }
    if (this.tree) {
      const tree = this.tree;
      this.renderDisposables.add(tree.onDidChangeContentHeight(() => {
        this.fireTreePaneSizeChange();
        this.layoutSplitView();
      }));
      this.renderDisposables.add(tree.onDidOpen((e) => {
        if (!e.element || !isChangesFileItem(e.element)) {
          return;
        }
        logChangesViewFileSelect(this.telemetryService, e.element.changeType);
        if (this.shouldOpenModalDiff()) {
          const items = changesObs.get();
          this._openFileItem(e.element, items, e.sideBySide, !!e.editorOptions?.preserveFocus, !!e.editorOptions?.pinned, items.length > 1);
          return;
        }
        const altKey = !!e.browserEvent?.altKey;
        const openSingleFileDiff = this.shouldOpenSingleFileDiffByDefault() !== altKey;
        if (openSingleFileDiff) {
          const sideBySide = e.sideBySide && !altKey;
          void this._openSingleFileDiffEditor(e.element, sideBySide, !!e.editorOptions?.preserveFocus, !!e.editorOptions?.pinned);
          return;
        }
        void this._openMultiFileDiffEditor(e.element.uri);
      }));
    }
    if (this.ciStatusWidget) {
      const checksViewModel = this.scopedInstantiationService.createInstance(ChecksViewModel);
      this.renderDisposables.add(checksViewModel);
      this.renderDisposables.add(this.ciStatusWidget.setInput(checksViewModel));
    }
    if (this.sessionFilesWidget) {
      const sessionFilesViewModel = this.scopedInstantiationService.createInstance(SessionFilesViewModel);
      this.renderDisposables.add(sessionFilesViewModel);
      this.renderDisposables.add(this.sessionFilesWidget.setInput(sessionFilesViewModel));
    }
    this.renderDisposables.add(autorun((reader) => {
      const changes = changesObs.read(reader);
      const viewMode = this.changesViewService.viewModeObs.read(reader);
      const changesetLoading = this.changesViewService.activeSessionChangesetLoadingObs.read(reader);
      this.changesViewService.activeSessionStateObs.read(reader);
      if (!this.tree || changesetLoading) {
        return;
      }
      this.listContainer?.classList.toggle("list-mode", viewMode === ChangesViewMode.List);
      if (viewMode === ChangesViewMode.Tree) {
        const treeRootInfo = this.getTreeRootInfo(changes);
        const treeChildren = buildTreeChildren(changes, treeRootInfo);
        this.tree.setChildren(null, treeChildren);
      } else {
        const listChildren = changes.map((item) => ({
          element: item,
          collapsible: false
        }));
        this.tree.setChildren(null, listChildren);
      }
      this.fireTreePaneSizeChange();
      this.layoutSplitView();
    }));
  }
  _bindContextKeys(topLevelStats) {
    this.renderDisposables.add(bindContextKey(ChatContextKeys.requestInProgress, this.scopedContextKeyService, (reader) => {
      const activeSessionStatus = this.sessionsService.activeSession.read(reader)?.status.read(reader);
      return activeSessionStatus !== SessionStatus.Completed && activeSessionStatus !== SessionStatus.Error;
    }));
    this.renderDisposables.add(bindContextKey(ChatContextKeys.hasAgentSessionChanges, this.scopedContextKeyService, (reader) => {
      const stats = topLevelStats.read(reader);
      return stats !== void 0 && stats.files > 0;
    }));
    this.renderDisposables.add(autorun((reader) => {
      const state = this.changesViewService.activeSessionStateObs.read(reader);
      if (!state || state.hasGitOperationInProgress) {
        return;
      }
      this.logService.info(`[ChangesViewPane][_bindContextKeys] Context keys: ${JSON.stringify(state)}`);
      this.scopedContextKeyService.bufferChangeEvents(() => {
        this.isolationModeContextKey.set(state.isolationMode);
        this.hasGitRepositoryContextKey.set(state.hasGitRepository);
        this.isMergeBaseBranchProtectedContextKey.set(state.isMergeBaseBranchProtected === true);
        this.hasGitHubRemoteContextKey.set(state.hasGitHubRemote === true);
        this.hasPullRequestContextKey.set(state.hasPullRequest === true);
        this.hasOpenPullRequestContextKey.set(state.hasOpenPullRequest === true);
        this.hasUpstreamContextKey.set(state.upstreamBranchName !== void 0);
        this.hasIncomingChangesContextKey.set(state.incomingChanges !== void 0 && state.incomingChanges > 0);
        this.hasOutgoingChangesContextKey.set(state.outgoingChanges !== void 0 && state.outgoingChanges > 0);
        this.hasUncommittedChangesContextKey.set(state.uncommittedChanges !== void 0 && state.uncommittedChanges > 0);
        this.hasBranchChangesContextKey.set(state.hasBranchChanges === true);
        this.hasGitOperationInProgressContextKey.set(state.hasGitOperationInProgress === true);
      });
    }));
  }
  /** Layout the tree within its SplitView pane. */
  _layoutTreeInPane(paneHeight) {
    if (!this.tree) {
      return;
    }
    const filesHeaderHeight = this.filesHeaderNode?.offsetHeight ?? 0;
    const treeHeight = Math.max(0, paneHeight - filesHeaderHeight);
    this.tree.layout(treeHeight, this.currentBodyWidth);
    this.tree.getHTMLElement().style.height = `${treeHeight}px`;
  }
  getTreePaneMinimumSize(reservedSectionHeight) {
    if (this.listContainer?.style.display === "none") {
      return EMPTY_FILE_CHANGES_MIN_HEIGHT;
    }
    const desiredSize = this.getTreePaneDesiredSize();
    const availableSize = this.getSplitViewAvailableHeight() - reservedSectionHeight;
    return Math.min(desiredSize, Math.max(EMPTY_FILE_CHANGES_MIN_HEIGHT, availableSize));
  }
  getTreePaneDesiredSize() {
    if (this.listContainer?.style.display === "none") {
      return EMPTY_FILE_CHANGES_MIN_HEIGHT;
    }
    const filesHeaderHeight = this.filesHeaderNode?.offsetHeight ?? 0;
    const treeContentHeight = this.tree?.contentHeight ?? 0;
    const bottomPadding = treeContentHeight > 0 ? TREE_PANE_LIST_BOTTOM_PADDING : 0;
    return filesHeaderHeight + treeContentHeight + bottomPadding;
  }
  getTreePaneMaximumSize() {
    return this.getTreePaneDesiredSize();
  }
  fireTreePaneSizeChange() {
    this.treePaneSizeChange.fire(void 0);
  }
  /** Compute the height available to the SplitView within the body. */
  getSplitViewAvailableHeight() {
    const bodyHeight = this.currentBodyHeight;
    if (bodyHeight <= 0) {
      return 0;
    }
    const bodyPadding = 16;
    const actionsHeight = this.actionsContainer?.offsetHeight ?? 0;
    const actionsMargin = actionsHeight > 0 ? 8 : 0;
    return Math.max(0, bodyHeight - bodyPadding - actionsHeight - actionsMargin);
  }
  /** Layout the SplitView to fill available body space. */
  layoutSplitView() {
    if (!this.splitView || !this.splitViewContainer) {
      return;
    }
    const availableHeight = this.getSplitViewAvailableHeight();
    if (availableHeight <= 0) {
      return;
    }
    this.splitViewContainer.style.height = `${availableHeight}px`;
    this.splitView.layout(availableHeight);
    this.rebalanceSectionPanes?.();
  }
  /**
   * Wires a collapsible section widget (CI checks / other files) to its
   * SplitView pane: toggling its header collapses/restores the pane, and
   * changes to its content show/hide the pane and re-layout. Both section
   * widgets share the same structural contract so this logic is reused.
   */
  _wireSectionPane(widget, paneIndex, headerHeight, getPreferredHeight) {
    let savedPaneHeight = getPreferredHeight();
    this._register(widget.onDidToggleCollapsed((collapsed) => {
      if (!this.splitView) {
        return;
      }
      if (collapsed) {
        const currentSize = this.splitView.getViewSize(paneIndex);
        if (currentSize > headerHeight) {
          savedPaneHeight = currentSize;
        }
        this.splitView.resizeView(paneIndex, headerHeight);
      } else {
        this.splitView.resizeView(paneIndex, savedPaneHeight);
      }
      this.layoutSplitView();
    }));
    this._register(widget.onDidChangeHeight(() => {
      if (!this.splitView) {
        return;
      }
      const visible = widget.visible;
      const isCurrentlyVisible = this.splitView.isViewVisible(paneIndex);
      if (visible !== isCurrentlyVisible) {
        this.splitView.setViewVisible(paneIndex, visible);
        if (visible && !widget.collapsed && !this.sectionPanesUserResized) {
          savedPaneHeight = getPreferredHeight();
          this.splitView.resizeView(paneIndex, savedPaneHeight);
        }
      }
      this.layoutSplitView();
    }));
  }
  setActiveSectionCollapsed(section, collapsed) {
    const sessionResource = this.changesViewService.activeSessionResourceObs.get();
    if (sessionResource) {
      this.changesViewService.setSectionCollapsed(sessionResource, section, collapsed);
    }
  }
  getTreeSelection() {
    const selection = this.tree?.getSelection() ?? [];
    return selection.filter((item) => !!item && isChangesFileItem(item));
  }
  getTreeRootInfo(items) {
    if (items.length === 0) {
      return void 0;
    }
    const activeSession = this.sessionsService.activeSession.get();
    const folder = activeSession?.workspace.get()?.folders[0];
    const workspaceFolderUri = folder?.workingDirectory;
    if (!folder?.root || !workspaceFolderUri) {
      return void 0;
    }
    let name = "";
    let resourceTreeRootUri = workspaceFolderUri;
    if (workspaceFolderUri.scheme === GITHUB_REMOTE_FILE_SCHEME) {
      resourceTreeRootUri = URI.from({ scheme: Schemas.copilotPr, path: "/" });
      const segments = workspaceFolderUri.path.split("/").filter(Boolean);
      name = `${segments.slice(0, 2).join("/")} (${decodeURIComponent(segments[2])})`;
    } else {
      const branchName = this.changesViewService.activeSessionStateObs.get()?.branchName;
      name = branchName ? `${basename(folder.workingDirectory)} (${branchName})` : basename(folder.workingDirectory);
    }
    return {
      root: {
        type: "root",
        uri: workspaceFolderUri,
        name
      },
      resourceTreeRootUri
    };
  }
  getSessionDiscardRef() {
    const changeset = this.changesViewService.activeSessionChangesetObs.get();
    return changeset?.originalCheckpointRef.get() ?? "";
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.currentBodyHeight = height;
    this.currentBodyWidth = width;
    this.layoutSplitView();
  }
  focus() {
    super.focus();
    if (this.tree && this.tree.getNode(null).visibleChildrenCount > 0) {
      this.tree.domFocus();
    }
  }
  renderSidebarList(container, onDidLayout, contextKeyService, items, openFileItem) {
    const disposables = new DisposableStore();
    container.classList.add("changes-file-list");
    const viewMode = this.changesViewService.viewModeObs.get();
    container.classList.toggle("list-mode", viewMode === ChangesViewMode.List);
    const headerNode = dom.append(container, $(".changes-sidebar-header"));
    const headerLabel = dom.append(headerNode, $("span"));
    headerLabel.textContent = localize("changes", "Changes");
    const countBadge = disposables.add(new CountBadge(headerNode, { count: items.length }, defaultCountBadgeStyles));
    countBadge.setCount(items.length);
    const tree = this.createChangesTree(container, Event.None, disposables, () => tree.getSelection().filter((item) => !!item && isChangesFileItem(item)), contextKeyService);
    if (viewMode === ChangesViewMode.Tree) {
      tree.setChildren(null, buildTreeChildren(items, this.getTreeRootInfo(items)));
    } else {
      tree.setChildren(null, items.map((item) => ({ element: item, collapsible: false })));
    }
    let updatingSelection = false;
    disposables.add(tree.onDidOpen((e) => {
      if (e.element && isChangesFileItem(e.element) && !updatingSelection) {
        openFileItem(
          e.element,
          items,
          e.sideBySide,
          !!e.editorOptions.preserveFocus,
          !!e.editorOptions.pinned,
          false
          /* preserve existing sidebar */
        );
      }
    }));
    disposables.add(Event.runAndSubscribe(this.editorService.onDidActiveEditorChange, () => {
      const activeEditor = this.editorService.activeEditor;
      if (!activeEditor) {
        return;
      }
      const primaryResource = EditorResourceAccessor.getCanonicalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
      const secondaryResource = EditorResourceAccessor.getCanonicalUri(activeEditor, { supportSideBySide: SideBySideEditor.SECONDARY });
      const index = items.findIndex(
        (i) => primaryResource !== void 0 && isEqual(i.uri, primaryResource) || secondaryResource !== void 0 && i.originalUri !== void 0 && isEqual(i.originalUri, secondaryResource)
      );
      if (index >= 0) {
        updatingSelection = true;
        try {
          tree.setFocus([items[index]]);
          tree.setSelection([items[index]]);
          tree.reveal(items[index]);
        } finally {
          updatingSelection = false;
        }
      }
    }));
    disposables.add(onDidLayout((e) => {
      const headerHeight = headerNode.offsetHeight;
      tree.layout(Math.max(0, e.height - headerHeight), e.width);
    }));
    return disposables;
  }
  createChangesTree(container, onDidChangeVisibility, disposables, getSelection, contextKeyService) {
    const treeInstantiationService = contextKeyService ? disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService]))) : this.instantiationService;
    const resourceLabels = disposables.add(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility }));
    const actionRunner = disposables.add(new ChangesViewActionRunner(
      () => this.changesViewService.activeSessionResourceObs.get(),
      () => this.getSessionDiscardRef(),
      getSelection ?? (() => this.getTreeSelection())
    ));
    return disposables.add(treeInstantiationService.createInstance(
      WorkbenchCompressibleObjectTree,
      "ChangesViewTree",
      container,
      new ChangesTreeDelegate(),
      [this.instantiationService.createInstance(
        ChangesTreeRenderer,
        resourceLabels,
        actionRunner,
        () => {
          const activeSession = this.sessionsService.activeSession.get();
          const folder = activeSession?.workspace.get()?.folders[0];
          return folder?.root.scheme === GITHUB_REMOTE_FILE_SCHEME ? URI.from({ scheme: Schemas.copilotPr, path: "/" }) : folder?.workingDirectory;
        }
      )],
      {
        alwaysConsumeMouseWheel: false,
        accessibilityProvider: {
          getAriaLabel: (element) => isChangesFileItem(element) ? basename(element.uri) : element.name,
          getWidgetAriaLabel: () => localize("changesViewTree", "Changes Tree")
        },
        dnd: {
          getDragURI: (element) => element.uri.toString(),
          getDragLabel: (elements) => {
            const uris = elements.map((e) => e.uri);
            if (uris.length === 1) {
              return this.labelService.getUriLabel(uris[0], { relative: true });
            }
            return `${uris.length}`;
          },
          dispose: () => {
          },
          onDragOver: () => false,
          drop: () => {
          },
          onDragStart: (data, originalEvent) => {
            try {
              const elements = data.getData();
              const uris = elements.filter(isChangesFileItem).map((e) => e.uri);
              this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, uris, originalEvent));
            } catch {
            }
          }
        },
        identityProvider: {
          getId: (element) => element.uri.toString()
        },
        indent: this.changesViewService.viewModeObs.get() === ChangesViewMode.List ? 0 : 8,
        compressionEnabled: true,
        sorter: new ChangesTreeSorter(() => this.changesViewService.viewModeObs.get()),
        twistieAdditionalCssClass: (e) => {
          return this.changesViewService.viewModeObs.get() === ChangesViewMode.List ? "force-no-twistie" : void 0;
        }
      }
    ));
  }
  async openChanges(resource) {
    const items = this.changesViewService.activeSessionChangesObs.get();
    if (items.length === 0) {
      return;
    }
    if (this.shouldOpenModalDiff()) {
      const changes = toIChangesFileItem(items);
      const changeToOpen = resource ? changes.find((c) => isEqual(c.uri, resource)) : void 0;
      await this._openFileItem(changeToOpen ?? changes[0], changes, false, false, false, changes.length > 1);
      return;
    }
    await this._openMultiFileDiffEditor(resource);
  }
  /**
   * Renders the files header (Branch Changes dropdown + diff stats) into the panel.
   * Standard layout only; {@link SinglePaneChangesViewPane} overrides this to a no-op
   * because the header lives in the custom Changes editor instead.
   */
  createFilesHeader(contentContainer) {
    this.filesHeaderNode = dom.append(contentContainer, $(".changes-files-header"));
    const filesHeaderToolbarContainer = dom.append(this.filesHeaderNode, $(".changes-files-header-toolbar"));
    this._register(this.scopedInstantiationService.createInstance(MenuWorkbenchToolBar, filesHeaderToolbarContainer, MenuId.ChatEditingSessionChangesFileHeaderToolbar, {
      menuOptions: { shouldForwardArgs: true },
      actionViewItemProvider: (action) => {
        if (action.id === "chatEditing.versionsPicker" && action instanceof MenuItemAction) {
          return this.scopedInstantiationService.createInstance(ChangesPickerActionItem, action);
        }
        return void 0;
      }
    }));
    this.fileHeaderToolbarContainer = dom.append(this.filesHeaderNode, $(".changes-files-header-right-toolbar"));
    this._register(this.scopedInstantiationService.createInstance(MenuWorkbenchToolBar, this.fileHeaderToolbarContainer, MenuId.ChatEditingSessionChangesFileHeaderRightToolbar, {
      menuOptions: { shouldForwardArgs: true },
      actionViewItemProvider: (action, options) => {
        if (action.id === ChangesDiffStatsAction.ID && action instanceof MenuItemAction) {
          return this.scopedInstantiationService.createInstance(ChangesDiffStatsActionItem, action, options);
        }
        return void 0;
      }
    }));
  }
  /**
   * Renders the Create-PR actions button bar into the actions container. Standard
   * layout only; {@link SinglePaneChangesViewPane} overrides this to a no-op because
   * the actions render in the Changes editor header instead.
   */
  createActionsButtonBar() {
    if (!this.actionsContainer) {
      return;
    }
    const isAgentHostSessionObs = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession ? isAgentHostProviderId(activeSession.providerId) : false;
    });
    this.renderDisposables.add(autorun((reader) => {
      dom.clearNode(this.actionsContainer);
      const isAgentHostSession = isAgentHostSessionObs.read(reader);
      const widget = isAgentHostSession ? this.scopedInstantiationService.createInstance(ChangesWorkbenchButtonBarWidget, this.actionsContainer) : this.scopedInstantiationService.createInstance(ChangesMenuWorkbenchButtonBarWidget, this.actionsContainer, this.hasGitOperationInProgressObs);
      reader.store.add(widget);
    }));
  }
  /**
   * Whether the actions container should be shown for the given session state.
   * Standard layout shows it for non-untitled sessions; {@link SinglePaneChangesViewPane}
   * never shows it (the actions live in the Changes editor).
   */
  isActionsContainerVisible(isUntitled) {
    return !isUntitled;
  }
  /**
   * Whether clicking a file opens the modal single-file diff. {@link SinglePaneChangesViewPane}
   * never uses the modal editor.
   */
  shouldOpenModalDiff() {
    return this.configurationService.getValue("workbench.editor.useModal") === "all";
  }
  /**
   * Whether clicking a file opens a single-file diff by default (vs the
   * multi-file diff editor). Alt inverts this.
   */
  shouldOpenSingleFileDiffByDefault() {
    return this.configurationService.getValue(SESSIONS_CHANGES_OPEN_SINGLE_FILE_DIFF_SETTING);
  }
  /**
   * Reveal the CI checks section: expand it if collapsed and move keyboard
   * focus into it. No-op when there are no checks to show.
   */
  revealChecks() {
    if (!this.ciStatusWidget || !this.ciStatusWidget.visible) {
      return;
    }
    this.ciStatusWidget.expand();
    this.ciStatusWidget.focus();
  }
  async _openFileItem(item, items, sideBySide, preserveFocus, pinned, includeSidebar) {
    const { uri: modifiedFileUri, originalUri, isDeletion } = item;
    const currentIndex = items.indexOf(item);
    const sidebar = includeSidebar ? {
      render: (container, onDidLayout, contextKeyService) => {
        return this.renderSidebarList(container, onDidLayout, contextKeyService, items, this._openFileItem.bind(this));
      }
    } : void 0;
    const navigation = {
      total: items.length,
      current: currentIndex,
      navigate: (index) => {
        const target = items[index];
        if (target) {
          this._openFileItem(target, items, false, false, false, includeSidebar);
        }
      }
    };
    const group = sideBySide ? SIDE_GROUP : ACTIVE_GROUP;
    const labels = getChangesEditorLabels(item.uri, this.labelService);
    if (isDeletion && originalUri) {
      this.editorService.openEditor({
        resource: originalUri,
        ...labels,
        options: { preserveFocus, pinned, modal: { sidebar, navigation } }
      }, group);
      return;
    }
    if (originalUri) {
      this.editorService.openEditor({
        original: { resource: originalUri },
        modified: { resource: modifiedFileUri },
        ...labels,
        options: { preserveFocus, pinned, modal: { sidebar, navigation } }
      }, group);
      return;
    }
    this.editorService.openEditor({
      resource: modifiedFileUri,
      ...labels,
      options: { preserveFocus, pinned, modal: { sidebar, navigation } }
    }, group);
  }
  async _openSingleFileDiffEditor(item, sideBySide, preserveFocus, pinned) {
    const { uri, originalUri, isDeletion } = item;
    const group = sideBySide ? SIDE_GROUP : ACTIVE_GROUP;
    const labels = getChangesEditorLabels(uri, this.labelService);
    const modifiedUri = isDeletion ? void 0 : uri;
    const pane = await this.editorService.openEditor({
      original: { resource: originalUri },
      modified: { resource: modifiedUri },
      ...labels,
      options: { preserveFocus, pinned }
    }, group);
    const control = pane?.getControl();
    if (pane && isDiffEditor(control)) {
      const openedInput = pane.input;
      control.updateOptions({ hideUnchangedRegions: { enabled: false } });
      const listener = pane.group.onDidActiveEditorChange(() => {
        if (pane.group.activeEditor === openedInput) {
          return;
        }
        listener.dispose();
        control.updateOptions({ hideUnchangedRegions: { enabled: this.configurationService.getValue("diffEditor.hideUnchangedRegions.enabled") } });
      });
      this._register(listener);
    }
  }
  async _openMultiFileDiffEditor(reveal) {
    const sessionResource = this.changesViewService.activeSessionResourceObs.get();
    const changes = this.changesViewService.activeSessionChangesObs.get();
    if (!sessionResource || changes.length === 0) {
      return;
    }
    this.workbenchLayoutService.revealEditorPartExplicitly();
    let options;
    if (reveal) {
      const target = changes.find((c) => isEqual(c.modifiedUri, reveal));
      if (target) {
        options = {
          viewState: {
            revealData: {
              resource: {
                original: target.originalUri,
                modified: target.modifiedUri
              }
            }
          }
        };
      }
    }
    await this.sessionChangesService.openChangesEditor(sessionResource, options);
  }
  dispose() {
    this.tree = void 0;
    super.dispose();
  }
};
ChangesViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IChangesViewService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, ISessionsService),
  __decorateParam(13, ILabelService),
  __decorateParam(14, ILogService),
  __decorateParam(15, ITelemetryService),
  __decorateParam(16, ISessionChangesService),
  __decorateParam(17, IWorkbenchLayoutService)
], ChangesViewPane);
class SinglePaneChangesViewPane extends ChangesViewPane {
  createFilesHeader(_contentContainer) {
  }
  createActionsButtonBar() {
  }
  isActionsContainerVisible(_isUntitled) {
    return false;
  }
  shouldOpenModalDiff() {
    return false;
  }
}
let ChangesViewPaneContainer = class extends ViewPaneContainer {
  constructor(layoutService, telemetryService, instantiationService, contextMenuService, themeService, storageService, configurationService, extensionService, contextService, viewDescriptorService, logService) {
    super(CHANGES_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService);
  }
  create(parent) {
    super.create(parent);
    parent.classList.add("changes-viewlet");
  }
};
ChangesViewPaneContainer = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, ILogService)
], ChangesViewPaneContainer);
class ChangesViewActionRunner extends ActionRunner {
  constructor(getSessionResource, getSessionDiscardRef, getSelectedFileItems) {
    super();
    this.getSessionResource = getSessionResource;
    this.getSessionDiscardRef = getSessionDiscardRef;
    this.getSelectedFileItems = getSelectedFileItems;
  }
  async runAction(action, context) {
    if (!(action instanceof MenuItemAction)) {
      return super.runAction(action, context);
    }
    const sessionResource = this.getSessionResource();
    const discardRef = this.getSessionDiscardRef();
    const selection = this.getSelectedFileItems();
    const contextIsSelected = selection.some((s) => s === context);
    const actualContext = contextIsSelected ? selection : [context];
    const args = actualContext.map((e) => {
      if (ResourceTree.isResourceNode(e)) {
        return ResourceTree.collect(e);
      }
      return isChangesFileItem(e) ? [e] : [];
    }).flat();
    await action.run(sessionResource, discardRef, ...args.map((item) => item.uri));
  }
}
class ChangesTreeDelegate {
  static {
    this.ROW_HEIGHT = 22;
  }
  getHeight(_element) {
    return ChangesTreeDelegate.ROW_HEIGHT;
  }
  getTemplateId(_element) {
    return ChangesTreeRenderer.TEMPLATE_ID;
  }
}
class ChangesTreeSorter {
  constructor(viewMode) {
    this.viewMode = viewMode;
  }
  compare(a, b) {
    if (this.viewMode() === ChangesViewMode.List) {
      const aPath = a.uri.fsPath;
      const bPath = b.uri.fsPath;
      return comparePaths(aPath, bPath);
    }
    const aIsDirectory = ResourceTree.isResourceNode(a);
    const bIsDirectory = ResourceTree.isResourceNode(b);
    if (aIsDirectory !== bIsDirectory) {
      return aIsDirectory ? -1 : 1;
    }
    const aName = ResourceTree.isResourceNode(a) ? a.name : basename(a.uri);
    const bName = ResourceTree.isResourceNode(b) ? b.name : basename(b.uri);
    return compareFileNames(aName, bName);
  }
}
class SetChangesListViewModeAction extends ViewAction {
  constructor() {
    super({
      id: "workbench.changesView.action.setListViewMode",
      title: localize("setListViewMode", "View as List"),
      viewId: CHANGES_VIEW_ID,
      f1: false,
      icon: Codicon.listFlat,
      toggled: ChangesContextKeys.ViewMode.isEqualTo(ChangesViewMode.List),
      menu: {
        id: MenuId.ChatEditingSessionTitleToolbar,
        group: "1_viewmode",
        order: 1
      }
    });
  }
  async runInView(accessor, _view) {
    logChangesViewViewModeChange(accessor.get(ITelemetryService), ChangesViewMode.List);
    accessor.get(IChangesViewService).setViewMode(ChangesViewMode.List);
  }
}
class SetChangesTreeViewModeAction extends ViewAction {
  constructor() {
    super({
      id: "workbench.changesView.action.setTreeViewMode",
      title: localize("setTreeViewMode", "View as Tree"),
      viewId: CHANGES_VIEW_ID,
      f1: false,
      icon: Codicon.listTree,
      toggled: ChangesContextKeys.ViewMode.isEqualTo(ChangesViewMode.Tree),
      menu: {
        id: MenuId.ChatEditingSessionTitleToolbar,
        group: "1_viewmode",
        order: 2
      }
    });
  }
  async runInView(accessor, _view) {
    logChangesViewViewModeChange(accessor.get(ITelemetryService), ChangesViewMode.Tree);
    accessor.get(IChangesViewService).setViewMode(ChangesViewMode.Tree);
  }
}
registerAction2(SetChangesListViewModeAction);
registerAction2(SetChangesTreeViewModeAction);
class VersionsPickerAction extends Action2 {
  static {
    this.ID = "chatEditing.versionsPicker";
  }
  constructor() {
    super({
      id: VersionsPickerAction.ID,
      title: localize2("chatEditing.versionsPicker", "Versions"),
      category: CHAT_CATEGORY,
      icon: Codicon.listFilter,
      f1: false,
      menu: [{
        id: MenuId.ChatEditingSessionChangesFileHeaderToolbar,
        group: "navigation",
        order: 9,
        when: ActiveSessionContextKeys.HasGitRepository
      }, {
        id: Menus.SessionsEditorHeaderPrimary,
        group: "navigation",
        order: 1,
        when: ContextKeyExpr.and(singlePaneChangesEditorHeader, ActiveSessionContextKeys.HasGitRepository)
      }]
    });
  }
  async run() {
  }
}
registerAction2(VersionsPickerAction);
let ChangesPickerActionItem = class extends ActionWidgetDropdownActionViewItem {
  constructor(action, actionWidgetService, keybindingService, contextKeyService, changesViewService, telemetryService) {
    const actionProvider = {
      getActions: () => {
        const changesets = changesViewService.activeSessionChangesetsObs.get() ?? [];
        const selectedChangeset = changesViewService.activeSessionChangesetObs.get();
        return changesets.map((changeset) => ({
          ...action,
          id: `agents.changes.changeset.${changeset.id}`,
          label: changeset.label,
          detail: changeset.description,
          checked: selectedChangeset?.id === changeset.id,
          category: {
            label: changeset.category ?? "",
            showHeader: false,
            order: 0
          },
          enabled: changeset.isEnabled.get(),
          run: async () => {
            changesViewService.setChangesetId(changeset.id);
            logChangesViewVersionModeChange(this.telemetryService, changeset.id);
          }
        }));
      }
    };
    super(action, { actionProvider, listOptions: { detailItemHeight: 44 } }, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.changesViewService = changesViewService;
    this.telemetryService = telemetryService;
    this._register(autorun((reader) => {
      changesViewService.activeSessionChangesetObs.read(reader);
      if (this.element) {
        this.renderLabel(this.element);
      }
    }));
  }
  render(container) {
    super.render(container);
    container.classList.add("changes-picker-action-rich");
  }
  renderLabel(element) {
    const changeset = this.changesViewService.activeSessionChangesetObs.get();
    if (!changeset) {
      return null;
    }
    dom.reset(element, dom.$("span", void 0, changeset.label), ...renderLabelWithIcons("$(chevron-down)"));
    this.updateAriaLabel();
    return null;
  }
};
ChangesPickerActionItem = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IChangesViewService),
  __decorateParam(5, ITelemetryService)
], ChangesPickerActionItem);
class ChangesDiffStatsAction extends Action2 {
  static {
    this.ID = "workbench.changesView.action.viewChanges";
  }
  constructor() {
    super({
      id: ChangesDiffStatsAction.ID,
      title: localize2("changesView.viewChanges", "View All Changes"),
      f1: false,
      menu: [{
        id: MenuId.ChatEditingSessionChangesFileHeaderRightToolbar,
        group: "navigation",
        order: 1,
        when: ChatContextKeys.hasAgentSessionChanges
      }, {
        id: Menus.SessionsEditorHeaderPrimary,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.and(singlePaneChangesEditorHeader, ChatContextKeys.hasAgentSessionChanges)
      }]
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = viewsService.getViewWithId(CHANGES_VIEW_ID);
    await view?.openChanges();
  }
}
registerAction2(ChangesDiffStatsAction);
class RevealCIChecksAction extends Action2 {
  static {
    this.ID = REVEAL_CI_CHECKS_COMMAND_ID;
  }
  constructor() {
    super({
      id: RevealCIChecksAction.ID,
      title: localize2("revealChecks", "Reveal Checks"),
      category: CHAT_CATEGORY,
      f1: false
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await viewsService.openView(CHANGES_VIEW_ID, true);
    view?.revealChecks();
  }
}
registerAction2(RevealCIChecksAction);
let ChangesDiffStatsActionItem = class extends ActionViewItem {
  constructor(action, options, instantiationService) {
    super(null, action, { ...options, icon: false, label: false });
    this._widget = this._register(instantiationService.createInstance(ChangesSummaryWidget));
    this._register(autorun((reader) => {
      const changesSummary = this._widget.summary.read(reader);
      if (changesSummary === void 0) {
        return;
      }
      this.updateTooltip();
    }));
  }
  render(container) {
    super.render(container);
    container.classList.add("changes-diff-stats-action");
    if (!this.label) {
      return;
    }
    this.renderLabelContents(this.label);
  }
  /**
   * Renders the diff-stats content into the action label. The base shows the
   * animated +/- summary; {@link SinglePaneChangesDiffStatsActionItem} overrides
   * this to a richer "N files +X -Y" label for the single-pane editor header.
   */
  renderLabelContents(label) {
    this._widget.render(label);
  }
  getTooltip() {
    const changesSummary = this._widget.summary.get();
    if (changesSummary === void 0) {
      return void 0;
    }
    const { files, additions, deletions } = changesSummary;
    return localize("changesView.diffStats.label", "{0} files, {1} additions, {2} deletions", files, additions, deletions);
  }
};
ChangesDiffStatsActionItem = __decorateClass([
  __decorateParam(2, IInstantiationService)
], ChangesDiffStatsActionItem);
class SinglePaneChangesDiffStatsActionItem extends ChangesDiffStatsActionItem {
  render(container) {
    super.render(container);
    container.classList.add("changes-diff-stats-action-rich");
  }
  renderLabelContents(label) {
    this._register(autorun((reader) => {
      const summary = this._widget.summary.read(reader);
      if (summary === void 0) {
        return;
      }
      const { files, additions, deletions } = summary;
      const filesLabel = files === 1 ? localize("changesView.diffStats.file", "1 file") : localize("changesView.diffStats.files", "{0} files", files);
      dom.reset(
        label,
        dom.$("span.changes-diff-stats-files", void 0, filesLabel),
        dom.$("span.working-set-lines-added", void 0, `+${additions}`),
        dom.$("span.working-set-lines-removed", void 0, `-${deletions}`)
      );
    }));
  }
}
export {
  CHANGES_HEADER_ACTIONS_ID,
  ChangesActionsBar,
  ChangesActionsBarActionViewItem,
  ChangesPickerActionItem,
  ChangesViewPane,
  ChangesViewPaneContainer,
  SinglePaneChangesDiffStatsActionItem,
  SinglePaneChangesViewPane
};
