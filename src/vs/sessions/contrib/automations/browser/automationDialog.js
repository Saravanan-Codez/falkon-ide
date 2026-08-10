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
import * as DOM from "../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { Checkbox } from "../../../../base/browser/ui/toggle/toggle.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { defaultCheckboxStyles, defaultInputBoxStyles, defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { hasNativeContextMenu } from "../../../../platform/window/common/window.js";
import { WorkspacePicker } from "../../chat/browser/sessionWorkspacePicker.js";
import { BranchPicker } from "../../chat/browser/branchPicker.js";
import { MobileSessionTypePicker } from "../../chat/browser/mobile/mobileSessionTypePicker.js";
import { isMobilePickerSheetTarget } from "../../../browser/parts/mobile/mobilePickerSheet.js";
import { SESSION_WORKSPACE_GROUP_LOCAL } from "../../../services/sessions/common/session.js";
import { IGitService } from "../../../../workbench/contrib/git/common/gitService.js";
import { DAYS_OF_WEEK } from "../../../../workbench/contrib/chat/common/automations/schedule.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ChatAgentLocation, isChatPermissionLevel } from "../../../../workbench/contrib/chat/common/constants.js";
import { ChatInputPart } from "../../../../workbench/contrib/chat/browser/widget/input/chatInputPart.js";
import { isModeConsideredBuiltIn } from "../../../../workbench/contrib/chat/browser/widget/input/modePickerActionItem.js";
import { AutomationIsolationModel, normalizeAutomationBranchNames } from "../common/isolationGroupModel.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { showMobileWorkspacePickerSheet, shouldUseMobileWorkspacePickerSheet } from "../../chat/browser/mobile/mobileWorkspacePickerSheet.js";
const $ = DOM.$;
const INTERVALS = [
  { value: "manual", label: localize("automation.interval.manual", "Manual") },
  { value: "hourly", label: localize("automation.interval.hourly", "Hourly") },
  { value: "daily", label: localize("automation.interval.daily", "Daily") },
  { value: "weekly", label: localize("automation.interval.weekly", "Weekly") }
];
function isAutomationDialogPopupTarget(relatedTarget) {
  return isMobilePickerSheetTarget(relatedTarget) || !!relatedTarget.closest(
    ".context-view, .quick-input-widget, .monaco-menu-container, .monaco-hover, .monaco-hover-content"
  );
}
async function canSelectAutomationWorkspace(folderUri, preferredProviderId, sessionsManagementService, workspaceTrustRequestService) {
  const resolved = sessionsManagementService.resolveWorkspace(folderUri, preferredProviderId);
  if (!resolved) {
    return false;
  }
  if (!resolved.workspace.requiresWorkspaceTrust) {
    return true;
  }
  return !!await workspaceTrustRequestService.requestResourcesTrust({
    uri: folderUri,
    message: localize("automation.form.trustFolderMessage", "An agent session will be able to read files, run commands, and make changes in this folder.")
  });
}
function registerAutomationDialogKeyboardNavigation(targetWindow, getFocusableElements, isPopupTarget) {
  const store = new DisposableStore();
  let suppressPopupEscapeKeyUp = false;
  const visibleFocusableElements = () => getFocusableElements().filter((element) => {
    if (!element.isConnected || element.tabIndex < 0 || element.hasAttribute("disabled")) {
      return false;
    }
    for (let current = element; current; current = current.parentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") {
        return false;
      }
      const style = targetWindow.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }
    return true;
  });
  store.add(DOM.addDisposableListener(targetWindow, DOM.EventType.KEY_DOWN, (event) => {
    const target = event.target;
    if (target instanceof targetWindow.HTMLElement && isPopupTarget(target)) {
      suppressPopupEscapeKeyUp = event.key === "Escape";
      return;
    }
    suppressPopupEscapeKeyUp = false;
    if (event.key !== "Tab") {
      return;
    }
    const focusableElements = visibleFocusableElements();
    if (focusableElements.length === 0) {
      return;
    }
    const activeElement = targetWindow.document.activeElement;
    let focusedIndex = focusableElements.findIndex((element) => element === activeElement);
    if (focusedIndex < 0) {
      focusedIndex = focusableElements.findIndex((element) => !!activeElement && element.contains(activeElement));
    }
    if (focusedIndex < 0) {
      focusedIndex = event.shiftKey ? 0 : -1;
    }
    const nextIndex = event.shiftKey ? (focusedIndex - 1 + focusableElements.length) % focusableElements.length : (focusedIndex + 1) % focusableElements.length;
    event.preventDefault();
    event.stopImmediatePropagation();
    focusableElements[nextIndex].focus();
  }, true));
  store.add(DOM.addDisposableListener(targetWindow, DOM.EventType.KEY_UP, (event) => {
    if (event.key === "Escape" && suppressPopupEscapeKeyUp) {
      suppressPopupEscapeKeyUp = false;
      event.stopImmediatePropagation();
      return;
    }
    suppressPopupEscapeKeyUp = false;
  }, true));
  return {
    focusFirst: () => visibleFocusableElements()[0]?.focus(),
    dispose: () => store.dispose()
  };
}
class AutomationSessionDraftSynchronizer extends Disposable {
  constructor(sessionsManagementService, canSelectWorkspace, onError) {
    super();
    this.sessionsManagementService = sessionsManagementService;
    this.canSelectWorkspace = canSelectWorkspace;
    this.onError = onError;
    this.generation = 0;
    this.syncScheduled = false;
    this.syncPromise = Promise.resolve();
    this.disposed = false;
  }
  update(target) {
    this.requestedTarget = target;
    this.generation++;
    this.scheduleSync();
  }
  async waitForSync() {
    let pendingSync;
    do {
      pendingSync = this.syncPromise;
      await pendingSync;
    } while (pendingSync !== this.syncPromise);
  }
  scheduleSync() {
    if (this.syncScheduled) {
      return;
    }
    this.syncScheduled = true;
    this.syncPromise = Promise.resolve().then(() => {
      this.syncScheduled = false;
      if (!this.disposed) {
        return this.sync(this.generation);
      }
      return void 0;
    });
  }
  async sync(generation) {
    const target = this.requestedTarget;
    if (!target) {
      this.discardSession();
      return;
    }
    if (this.matchesAppliedTarget(target)) {
      return;
    }
    try {
      if (target.kind === "workspace" && !await this.canSelectWorkspace(target.folderUri, target.providerId)) {
        if (generation === this.generation) {
          this.discardSession();
        }
        return;
      }
      if (this.disposed || generation !== this.generation) {
        return;
      }
      this.session = target.kind === "quickChat" ? this.sessionsManagementService.createAutomationQuickChat({
        providerId: target.providerId,
        sessionTypeId: target.sessionTypeId
      }) : this.sessionsManagementService.createAutomationSession(target.folderUri, {
        providerId: target.providerId,
        sessionTypeId: target.sessionTypeId
      });
      this.appliedTarget = target;
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        this.discardSession();
        this.onError(error);
      }
    }
  }
  matchesAppliedTarget(target) {
    if (!this.session || !this.appliedTarget || this.sessionsManagementService.automationSession.get()?.sessionId !== this.session.sessionId || this.appliedTarget.kind !== target.kind || this.appliedTarget.providerId !== target.providerId || this.appliedTarget.sessionTypeId !== target.sessionTypeId) {
      return false;
    }
    return target.kind === "quickChat" || this.appliedTarget.kind === "workspace" && isEqual(this.appliedTarget.folderUri, target.folderUri);
  }
  discardSession() {
    if (this.session) {
      this.sessionsManagementService.discardAutomationSession(this.session);
    }
    this.session = void 0;
    this.appliedTarget = void 0;
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.discardSession();
    super.dispose();
  }
}
function resolveAutomationModelIdentifier(languageModelsService, identifier, logicalSessionType, modelTarget) {
  if (!logicalSessionType || !modelTarget) {
    return identifier;
  }
  const sourceModel = languageModelsService.lookupLanguageModel(identifier);
  if (sourceModel?.targetChatSessionType !== logicalSessionType) {
    return identifier;
  }
  return languageModelsService.getLanguageModelIds().find((candidateIdentifier) => {
    const candidate = languageModelsService.lookupLanguageModel(candidateIdentifier);
    return candidate?.targetChatSessionType === modelTarget && candidate.id === sourceModel.id;
  }) ?? identifier;
}
const AUTOMATIONS_HARNESS_CHIP_ACTION_ID = "workbench.action.chat.renderAutomationsHarnessChip";
const AUTOMATIONS_WORKSPACE_PICKER_ACTION_ID = "workbench.action.chat.renderAutomationsWorkspacePicker";
const AUTOMATIONS_ISOLATION_GROUP_ACTION_ID = "workbench.action.chat.renderAutomationsIsolationGroup";
function setAutomationControlVisible(container, visible) {
  container.style.display = visible ? "" : "none";
  if (visible) {
    container.removeAttribute("aria-hidden");
  } else {
    container.setAttribute("aria-hidden", "true");
  }
}
let AutomationIsolationGroupActionViewItem = class extends BaseActionViewItem {
  constructor(action, state, isolationModel, workspaceFolder, onDidChangeTarget, revalidate, options, visible, gitService, sessionsManagementService, pickerLogService, instantiationService) {
    super(void 0, action, options);
    this.state = state;
    this.isolationModel = isolationModel;
    this.workspaceFolder = workspaceFolder;
    this.onDidChangeTarget = onDidChangeTarget;
    this.revalidate = revalidate;
    this.visible = visible;
    this.gitService = gitService;
    this.sessionsManagementService = sessionsManagementService;
    this.pickerLogService = pickerLogService;
    this.renderDisposables = this._register(new DisposableStore());
    this.branchRepoDisposable = this._register(new MutableDisposable());
    this.branchRequest = this._register(new MutableDisposable());
    this.branchRequestId = 0;
    this.branchLoadState = "noFolder";
    this.branches = [];
    this.worktreeCapabilityResolved = false;
    this.branchPicker = this._register(instantiationService.createInstance(BranchPicker, {
      user: "automationBranchPicker",
      slotClassName: "automation-form-branch-picker-slot",
      triggerClassName: "automation-form-branch-slot",
      labelClassName: "automation-form-branch-name",
      descriptionClassName: "automation-form-branch-description",
      keepDisabledFocusable: true,
      renderDisabledAsStatic: true,
      ariaLive: "polite",
      onSelectBranch: (branch) => {
        this.isolationModel.selectBranch(branch);
        this.renderBranchControl();
      },
      onRetry: () => {
        void this.reloadRepository(this.isolationModel.folderUri);
      },
      isolation: {
        label: localize("automation.form.isolation.worktree", "New Worktree"),
        ariaLabel: localize("automation.form.isolation.checkboxAriaLabel", "Worktree isolation"),
        onToggle: (checked) => {
          this.isolationModel.selectIsolationMode(checked ? "worktree" : "workspace");
          this.renderBranchControl();
        }
      }
    }));
  }
  render(container) {
    this.renderDisposables.clear();
    this.branchRepoDisposable.clear();
    this.cancelBranchRequest();
    DOM.clearNode(container);
    container.style.marginLeft = "auto";
    const visible = this.visible;
    if (visible) {
      this.renderDisposables.add(autorun((reader) => {
        setAutomationControlVisible(container, visible.read(reader));
      }));
    }
    const isolationGroup = DOM.append(container, $("span.automation-form-isolation-group"));
    this.branchPicker.render(isolationGroup);
    this.refreshTargetCapability();
    this.renderBranchControl();
    this.renderDisposables.add(autorun((reader) => {
      const folderUri = this.workspaceFolder.read(reader);
      this.refreshTargetAndRender();
      void this.reloadRepository(folderUri);
    }));
    this.renderDisposables.add(this.onDidChangeTarget(() => {
      this.refreshTargetAndRender();
    }));
    this.renderDisposables.add(this.sessionsManagementService.onDidChangeSessionTypes(() => this.refreshTargetAndRender()));
    this.renderDisposables.add({
      dispose: () => {
        this.cancelBranchRequest();
      }
    });
  }
  refreshTargetCapability() {
    const folderUri = this.isolationModel.folderUri;
    const sessionTypeId = this.state.sessionTypeId;
    if (!folderUri || !sessionTypeId) {
      this.worktreeCapabilityResolved = false;
      this.isolationModel.setSupportsWorktreeConfiguration(false);
      return;
    }
    const sessionType = this.sessionsManagementService.getSessionTypesForFolder(folderUri).find(
      (candidate) => candidate.sessionType.id === sessionTypeId && (this.state.providerId === void 0 || candidate.providerId === this.state.providerId)
    )?.sessionType;
    if (!sessionType) {
      this.worktreeCapabilityResolved = false;
      this.isolationModel.setSupportsWorktreeConfiguration(false);
      return;
    }
    this.worktreeCapabilityResolved = true;
    const supportsWorktreeConfiguration = sessionType.supportsWorktreeConfiguration === true;
    this.isolationModel.setSupportsWorktreeConfiguration(supportsWorktreeConfiguration);
    if (!supportsWorktreeConfiguration && this.isolationModel.isolationMode === "worktree") {
      this.isolationModel.selectIsolationMode("workspace");
    }
  }
  refreshTargetAndRender() {
    this.refreshTargetCapability();
    this.renderBranchControl();
  }
  renderBranchControl() {
    const presentation = this.getBranchPresentation();
    const canOpen = this.canOpenBranchPicker();
    const selectedBranch = this.isolationModel.selectedBranch ?? this.isolationModel.headBranch;
    const branches = this.branches.map((branch) => ({
      name: branch,
      selected: branch === selectedBranch
    }));
    if (selectedBranch && !this.branches.includes(selectedBranch)) {
      branches.unshift({
        name: selectedBranch,
        selected: true,
        unavailable: true
      });
    }
    const worktreeUnavailableReason = this.getWorktreeUnavailableReason();
    const isolationState = worktreeUnavailableReason === void 0 ? "enabled" : "disabled";
    this.branchPicker.update({
      label: presentation.label,
      branches,
      status: this.branchLoadState === "loadingRepository" || this.branchLoadState === "loadingBranches" ? "loading" : this.branchLoadState === "error" ? "error" : this.branchLoadState === "ready" ? "ready" : "empty",
      canOpen,
      disabledReason: presentation.reason,
      missing: presentation.missing,
      showChevron: this.isolationModel.branchPickerAvailable || this.branchLoadState === "error",
      isolation: {
        checked: this.isolationModel.isolationMode === "worktree",
        state: isolationState,
        disabledReason: worktreeUnavailableReason
      }
    });
    this.revalidate();
  }
  getBranchPresentation() {
    const displayBranch = this.isolationModel.displayBranch;
    if (!this.isolationModel.folderUri) {
      return {
        label: localize("automation.form.branch.unknown", "\u2014"),
        reason: localize("automation.form.branch.noFolderReason", "Select a folder to determine its Git branch."),
        missing: true
      };
    }
    if (!this.worktreeCapabilityResolved) {
      return {
        label: displayBranch ?? localize("automation.form.branch.unknown", "\u2014"),
        reason: localize("automation.form.branch.capabilityLoadingReason", "Session capabilities are loading."),
        missing: !displayBranch
      };
    }
    if (!this.isolationModel.supportsWorktreeConfiguration) {
      return {
        label: displayBranch ?? localize("automation.form.branch.unknown", "\u2014"),
        reason: localize("automation.form.branch.unsupportedReason", "The selected session type does not support Worktree branch configuration."),
        missing: !displayBranch
      };
    }
    if (this.branchLoadState === "error") {
      return {
        label: displayBranch ?? localize("automation.form.branch.loadError", "Unable to load branches"),
        reason: localize("automation.form.branch.loadErrorReason", "Open the branch picker to retry loading local branches."),
        missing: !displayBranch
      };
    }
    if (this.isolationModel.isolationMode !== "worktree") {
      return {
        label: displayBranch ?? this.detachedCommit ?? localize("automation.form.branch.unknown", "\u2014"),
        reason: localize("automation.form.branch.folderModeReason", "Select Worktree to choose a branch."),
        missing: !displayBranch && !this.detachedCommit
      };
    }
    switch (this.branchLoadState) {
      case "loadingRepository":
      case "loadingBranches":
        return {
          label: displayBranch ?? localize("automation.form.branch.loading", "Loading branches\u2026"),
          reason: localize("automation.form.branch.loadingReason", "Local branches are loading."),
          missing: !displayBranch
        };
      case "noRepository":
        return {
          label: displayBranch ?? localize("automation.form.branch.noRepo", "no git repo"),
          reason: localize("automation.form.branch.noRepoReason", "No Git repository was found for the selected folder."),
          missing: !displayBranch
        };
      case "empty":
        return {
          label: displayBranch ?? localize("automation.form.branch.noBranches", "No local branches"),
          reason: localize("automation.form.branch.noBranchesReason", "No local branches were found in this repository."),
          missing: !displayBranch
        };
      case "ready":
        return {
          label: displayBranch ?? localize("automation.form.branch.select", "Select branch"),
          reason: localize("automation.form.branch.chooseReason", "Choose the local branch to use as the Worktree base."),
          missing: !displayBranch
        };
      case "noFolder":
        return {
          label: localize("automation.form.branch.unknown", "\u2014"),
          reason: localize("automation.form.branch.noFolderReason", "Select a folder to determine its Git branch."),
          missing: true
        };
    }
  }
  canOpenBranchPicker() {
    if (this.branchLoadState === "error") {
      return !!this.isolationModel.folderUri && this.worktreeCapabilityResolved && this.isolationModel.supportsWorktreeConfiguration;
    }
    return this.isolationModel.branchPickerAvailable && this.branchLoadState !== "noFolder" && this.branchLoadState !== "noRepository" && this.branchLoadState !== "loadingRepository" && this.branchLoadState !== "loadingBranches";
  }
  getWorktreeUnavailableReason() {
    if (!this.isolationModel.folderUri) {
      return localize("automation.form.isolation.worktreeNoFolder", "Select a folder to use Worktree isolation.");
    }
    if (!this.worktreeCapabilityResolved) {
      return localize("automation.form.branch.capabilityLoadingReason", "Session capabilities are loading.");
    }
    if (!this.isolationModel.supportsWorktreeConfiguration) {
      return localize("automation.form.isolation.worktreeUnavailable", "Not supported by the selected session type");
    }
    if (this.isolationModel.selectedBranch) {
      return void 0;
    }
    switch (this.branchLoadState) {
      case "loadingRepository":
      case "loadingBranches":
        return localize("automation.form.branch.loadingReason", "Local branches are loading.");
      case "noRepository":
        return localize("automation.form.branch.noRepoReason", "No Git repository was found for the selected folder.");
      case "error":
        return localize("automation.form.branch.loadErrorReason", "Open the branch picker to retry loading local branches.");
      case "empty":
        return localize("automation.form.branch.noBranchesReason", "No local branches were found in this repository.");
      case "ready":
        return this.branches.length > 0 ? void 0 : localize("automation.form.branch.noBranchesReason", "No local branches were found in this repository.");
      case "noFolder":
        return localize("automation.form.isolation.worktreeNoFolder", "Select a folder to use Worktree isolation.");
    }
  }
  cancelBranchRequest() {
    this.branchRequest.value?.cancel();
    this.branchRequest.clear();
  }
  async reloadRepository(folder) {
    const requestId = ++this.branchRequestId;
    this.cancelBranchRequest();
    this.branchRepoDisposable.clear();
    this.repository = void 0;
    this.branches = [];
    this.detachedCommit = void 0;
    if (!folder) {
      this.branchLoadState = "noFolder";
      this.isolationModel.setHeadBranch(void 0);
      this.renderBranchControl();
      return;
    }
    this.branchLoadState = "loadingRepository";
    this.renderBranchControl();
    const cts = new CancellationTokenSource();
    this.branchRequest.value = cts;
    let repo;
    try {
      repo = await this.gitService.openRepository(folder);
    } catch (error) {
      if (requestId !== this.branchRequestId || cts.token.isCancellationRequested) {
        return;
      }
      this.pickerLogService.error("[AutomationDialog] Failed to open Git repository for branch selection.", error);
      this.branchLoadState = "error";
      this.renderBranchControl();
      return;
    }
    if (requestId !== this.branchRequestId || cts.token.isCancellationRequested) {
      return;
    }
    if (!repo) {
      this.branchLoadState = "noRepository";
      this.renderBranchControl();
      return;
    }
    this.repository = repo;
    const watcher = new DisposableStore();
    watcher.add(autorun((reader) => {
      const head = repo.state.read(reader).HEAD;
      if (head?.commit && head.name) {
        this.detachedCommit = void 0;
        this.isolationModel.setHeadBranch(head.name);
      } else if (head?.commit) {
        this.detachedCommit = localize("automation.form.branch.detached", "({0})", head.commit.slice(0, 7));
        this.isolationModel.setHeadBranch(void 0);
      } else {
        this.detachedCommit = void 0;
        this.isolationModel.setHeadBranch(void 0);
      }
      this.renderBranchControl();
    }));
    this.branchRepoDisposable.value = watcher;
    this.branchLoadState = "loadingBranches";
    this.renderBranchControl();
    try {
      const refs = await repo.getRefs({ pattern: "refs/heads" }, cts.token);
      if (requestId !== this.branchRequestId || cts.token.isCancellationRequested || this.repository !== repo) {
        return;
      }
      this.branches = normalizeAutomationBranchNames(refs.map((ref) => ref.name));
      this.branchLoadState = this.branches.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (requestId !== this.branchRequestId || cts.token.isCancellationRequested) {
        return;
      }
      this.pickerLogService.error("[AutomationDialog] Failed to load local branches.", error);
      this.branchLoadState = "error";
    }
    this.renderBranchControl();
  }
};
AutomationIsolationGroupActionViewItem = __decorateClass([
  __decorateParam(8, IGitService),
  __decorateParam(9, ISessionsManagementService),
  __decorateParam(10, ILogService),
  __decorateParam(11, IInstantiationService)
], AutomationIsolationGroupActionViewItem);
class AutomationPickerActionViewItem extends BaseActionViewItem {
  constructor(action, renderPicker, visible, options) {
    super(void 0, action, options);
    this.renderPicker = renderPicker;
    this.visible = visible;
    this.visibilityWatch = this._register(new MutableDisposable());
  }
  render(container) {
    super.render(container);
    DOM.clearNode(container);
    this.renderPicker(container);
    const visible = this.visible;
    this.visibilityWatch.value = visible ? autorun((reader) => {
      setAutomationControlVisible(container, visible.read(reader));
    }) : void 0;
  }
}
registerAction2(class OpenAutomationsHarnessChipAction extends Action2 {
  constructor() {
    super({
      id: AUTOMATIONS_HARNESS_CHIP_ACTION_ID,
      title: localize2("automation.form.harnessChip.action", "Automations Harness Chip"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: -1,
        when: ChatContextKeys.inAutomationsDialog
      }]
    });
  }
  async run() {
  }
});
registerAction2(class OpenAutomationsWorkspacePickerAction extends Action2 {
  constructor() {
    super({
      id: AUTOMATIONS_WORKSPACE_PICKER_ACTION_ID,
      title: localize2("automation.form.workspacePicker.action", "Automations Workspace Picker"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 0,
        when: ChatContextKeys.inAutomationsDialog
      }]
    });
  }
  async run() {
  }
});
registerAction2(class OpenAutomationsIsolationGroupAction extends Action2 {
  constructor() {
    super({
      id: AUTOMATIONS_ISOLATION_GROUP_ACTION_ID,
      title: localize2("automation.form.isolationGroup.action", "Automations Isolation Group"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 2,
        when: ChatContextKeys.inAutomationsDialog
      }]
    });
  }
  async run() {
  }
});
function renderForm(form, state, disposables, validation, revalidate, instantiationService, contextKeyService, contextViewService, configurationService, languageModelsService, layoutService, logService, productService, sessionsManagementService, workspaceTrustRequestService, initialPrompt, initialMode, initialPermissionLevel, initialModelId) {
  const nameRow = DOM.append(form, $(".automation-form-row"));
  DOM.append(nameRow, $("span.automation-form-label", void 0, localize("automation.form.name", "Name")));
  const nameInputContainer = DOM.append(nameRow, $(".automation-form-input-host"));
  const nameInput = disposables.add(new InputBox(nameInputContainer, contextViewService, {
    inputBoxStyles: defaultInputBoxStyles,
    placeholder: localize("automation.form.namePlaceholder", "e.g. Morning standup notes"),
    ariaLabel: localize("automation.form.name", "Name")
  }));
  nameInput.value = state.name;
  disposables.add(nameInput.onDidChange((value) => {
    state.name = value;
    revalidate();
  }));
  const scheduleRow = DOM.append(form, $(".automation-form-row.automation-form-schedule-row"));
  const useCustomDrawn = !hasNativeContextMenu(configurationService);
  const intervalGroup = DOM.append(scheduleRow, $(".automation-form-schedule-group"));
  DOM.append(intervalGroup, $("span.automation-form-label", void 0, localize("automation.form.interval", "Schedule")));
  const intervalOptions = INTERVALS.map((item) => ({ text: item.label }));
  const intervalIndex = Math.max(0, INTERVALS.findIndex((item) => item.value === state.interval));
  const intervalSelect = disposables.add(new SelectBox(
    intervalOptions,
    intervalIndex,
    contextViewService,
    defaultSelectBoxStyles,
    { ariaLabel: localize("automation.form.interval", "Schedule"), useCustomDrawn }
  ));
  const intervalSelectContainer = DOM.append(intervalGroup, $(".automation-form-schedule-select-container"));
  intervalSelect.render(intervalSelectContainer);
  const timeGroup = DOM.append(scheduleRow, $(".automation-form-schedule-group.automation-form-time-group"));
  DOM.append(timeGroup, $("span.automation-form-label", void 0, localize("automation.form.time", "Time")));
  const timeOptions = buildTimeOptions();
  const initialTimeIndex = nearestTimeOptionIndex(state.hour, state.minute);
  state.hour = timeOptions[initialTimeIndex].hour;
  state.minute = timeOptions[initialTimeIndex].minute;
  const timeSelect = disposables.add(new SelectBox(
    timeOptions.map((opt) => ({ text: opt.label })),
    initialTimeIndex,
    contextViewService,
    defaultSelectBoxStyles,
    { ariaLabel: localize("automation.form.time", "Time"), useCustomDrawn }
  ));
  const timeSelectContainer = DOM.append(timeGroup, $(".automation-form-schedule-select-container.automation-form-time-select-container"));
  timeSelect.render(timeSelectContainer);
  disposables.add(timeSelect.onDidSelect((e) => {
    const opt = timeOptions[e.index];
    state.hour = opt.hour;
    state.minute = opt.minute;
  }));
  const dayGroup = DOM.append(scheduleRow, $(".automation-form-schedule-group.automation-form-day-group"));
  DOM.append(dayGroup, $("span.automation-form-label", void 0, localize("automation.form.day", "Day of week")));
  const dayOptions = DAYS_OF_WEEK.map((d) => ({ text: d }));
  const daySelect = disposables.add(new SelectBox(
    dayOptions,
    Math.min(Math.max(state.day, 0), DAYS_OF_WEEK.length - 1),
    contextViewService,
    defaultSelectBoxStyles,
    { ariaLabel: localize("automation.form.day", "Day of week"), useCustomDrawn }
  ));
  const daySelectContainer = DOM.append(dayGroup, $(".automation-form-schedule-select-container"));
  daySelect.render(daySelectContainer);
  disposables.add(daySelect.onDidSelect((e) => {
    state.day = e.index;
  }));
  const applyIntervalVisibility = () => {
    const showTime = state.interval === "daily" || state.interval === "weekly";
    const showDay = state.interval === "weekly";
    timeGroup.style.display = showTime ? "" : "none";
    dayGroup.style.display = showDay ? "" : "none";
  };
  applyIntervalVisibility();
  disposables.add(intervalSelect.onDidSelect((e) => {
    state.interval = INTERVALS[e.index].value;
    applyIntervalVisibility();
  }));
  const isolationModel = new AutomationIsolationModel(state);
  const workspaceControlsVisible = derived((reader) => !isolationModel.isQuickChatObs.read(reader));
  const sessionTypePicker = disposables.add(instantiationService.createInstance(MobileSessionTypePicker, constObservable(void 0), { persistSelection: false, telemetrySource: "AutomationSessionTypePicker", showChevron: false }));
  sessionTypePicker.setQuickChatSource(isolationModel.isQuickChatObs);
  sessionTypePicker.setFolderSource(isolationModel.folderUriObs, {
    initialPick: state.sessionTypeId ? { providerId: state.providerId, sessionTypeId: state.sessionTypeId } : void 0,
    preserveUnavailableInitialPick: true
  });
  const onDidChangeSessionType = disposables.add(new Emitter());
  const onDidChangeSessionTarget = disposables.add(new Emitter());
  const sessionTypeDelegate = {
    getActiveSessionProvider: () => sessionTypePicker.modelTargetChatSessionType.get(),
    onDidChangeActiveSessionProvider: onDidChangeSessionType.event
  };
  const syncStateFromPicker = () => {
    const pick = sessionTypePicker.selectedPick;
    state.providerId = pick?.providerId;
    state.sessionTypeId = pick?.sessionTypeId;
    onDidChangeSessionTarget.fire();
  };
  disposables.add(autorun((reader) => {
    const modelTarget = sessionTypePicker.modelTargetChatSessionType.read(reader);
    if (modelTarget) {
      onDidChangeSessionType.fire(modelTarget);
    }
  }));
  syncStateFromPicker();
  const workspacePicker = disposables.add(instantiationService.createInstance(MobileAutomationsWorkspacePicker, {
    canSelectWorkspace: (folderUri, preferredProviderId) => canSelectAutomationWorkspace(folderUri, preferredProviderId, sessionsManagementService, workspaceTrustRequestService)
  }));
  workspacePicker.setTargetModel(isolationModel);
  workspacePicker.setLayoutService(layoutService);
  const automationSessionDraftSynchronizer = disposables.add(new AutomationSessionDraftSynchronizer(
    sessionsManagementService,
    (folderUri, preferredProviderId) => canSelectAutomationWorkspace(folderUri, preferredProviderId, sessionsManagementService, workspaceTrustRequestService),
    (error) => logService.error("[AutomationDialog] Failed to synchronize the automation session draft.", error)
  ));
  const updateAutomationSessionTarget = () => {
    const folderUri = isolationModel.folderUriObs.get();
    const pick = sessionTypePicker.selectedPick;
    const isQuickChat = isolationModel.isQuickChatObs.get();
    if (!pick || isQuickChat && !pick.providerId || !isQuickChat && !folderUri) {
      automationSessionDraftSynchronizer.update(void 0);
      return;
    }
    if (isQuickChat) {
      const providerId = pick.providerId;
      if (providerId) {
        automationSessionDraftSynchronizer.update({ kind: "quickChat", providerId, sessionTypeId: pick.sessionTypeId });
      }
    } else if (folderUri) {
      automationSessionDraftSynchronizer.update({ kind: "workspace", folderUri, providerId: pick.providerId, sessionTypeId: pick.sessionTypeId });
    }
  };
  disposables.add(sessionTypePicker.onDidChangeSelectedPick(() => {
    syncStateFromPicker();
    updateAutomationSessionTarget();
    revalidate();
  }));
  disposables.add(sessionsManagementService.onDidChangeSessionTypes(() => updateAutomationSessionTarget()));
  if (state.folderUri) {
    workspacePicker.setSelectedWorkspace(state.folderUri, { fireEvent: false, persist: false });
  }
  disposables.add(workspacePicker.onDidSelectWorkspace((uri) => {
    if (isolationModel.setWorkspace(uri)) {
      updateAutomationSessionTarget();
      revalidate();
    }
  }));
  if (!state.isQuickChat && !state.folderUri && workspacePicker.selectedFolderUri) {
    isolationModel.setWorkspace(workspacePicker.selectedFolderUri);
  }
  disposables.add(autorun((reader) => {
    isolationModel.isQuickChatObs.read(reader);
    updateAutomationSessionTarget();
    revalidate();
  }));
  const promptRow = DOM.append(form, $(".automation-form-row"));
  DOM.append(promptRow, $("span.automation-form-label", void 0, localize("automation.form.prompt", "Prompt")));
  const promptHost = DOM.append(promptRow, $(".automation-form-prompt-host.interactive-session"));
  const chatInputStyles = {
    overlayBackground: "var(--vscode-input-background)",
    listForeground: "var(--vscode-foreground)",
    listBackground: "var(--vscode-input-background)"
  };
  const chatInputOptions = {
    renderFollowups: false,
    renderInputToolbarBelowInput: false,
    renderWorkingSet: false,
    enableImplicitContext: false,
    supportsChangingModes: true,
    hideCustomChatModes: true,
    suppressModePreferredModel: true,
    suppressModelPersistence: true,
    menus: {
      executeToolbar: MenuId.AutomationsDialogInput,
      telemetrySource: "automations.dialog"
    },
    widgetViewKindTag: "automations-dialog",
    inputEditorMinLines: 3,
    // The dialog renders the composer flush with its form column (the
    // `.interactive-input-part` margin is zeroed in CSS), so there is no
    // outer horizontal gutter. Without this, ChatInputPart would still
    // reserve the default 24px margin and lay the editor out too narrow,
    // leaving its scrollbar floating ~24px in from the right wall.
    inputPartHorizontalPadding: 0,
    sessionTypePickerDelegate: sessionTypeDelegate,
    secondaryToolbarActionViewItemProvider: (action, itemOptions) => {
      if (action.id === AUTOMATIONS_HARNESS_CHIP_ACTION_ID) {
        return new AutomationPickerActionViewItem(action, (container) => sessionTypePicker.render(container), void 0, itemOptions);
      }
      if (action.id === AUTOMATIONS_WORKSPACE_PICKER_ACTION_ID) {
        return new AutomationPickerActionViewItem(action, (container) => {
          container.classList.add("chat-input-picker-item");
          workspacePicker.render(container);
        }, void 0, itemOptions);
      }
      if (action.id === AUTOMATIONS_ISOLATION_GROUP_ACTION_ID) {
        const item = instantiationService.createInstance(
          AutomationIsolationGroupActionViewItem,
          action,
          state,
          isolationModel,
          isolationModel.folderUriObs,
          onDidChangeSessionTarget.event,
          revalidate,
          itemOptions,
          workspaceControlsVisible
        );
        return item;
      }
      return void 0;
    }
  };
  const stubWidget = {
    onDidChangeViewModel: Event.None,
    viewModel: void 0,
    contribs: [],
    location: ChatAgentLocation.Chat,
    viewContext: {},
    lockToCodingAgent: () => {
    },
    unlockFromCodingAgent: () => {
    }
  };
  const scopedContextKeyService = disposables.add(contextKeyService.createScoped(promptHost));
  ChatContextKeys.location.bindTo(scopedContextKeyService).set(ChatAgentLocation.Chat);
  ChatContextKeys.inChatSession.bindTo(scopedContextKeyService).set(true);
  ChatContextKeys.inAutomationsDialog.bindTo(scopedContextKeyService).set(true);
  const scopedInstantiationService = disposables.add(
    instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService]))
  );
  const chatInput = disposables.add(
    scopedInstantiationService.createInstance(ChatInputPart, ChatAgentLocation.Chat, chatInputOptions, chatInputStyles, false)
  );
  chatInput.render(promptHost, initialPrompt, stubWidget);
  chatInput.inputEditor.updateOptions({ placeholder: localize("automation.form.prompt.placeholder", "Describe what you want to automate") });
  if (initialMode) {
    const getUnfilteredInitialMode = () => {
      const modes = chatInput.currentChatModesObs.get();
      return modes.findModeById(initialMode) ?? modes.findModeByName(initialMode);
    };
    const isHiddenCustomInitialMode = () => {
      const mode = getUnfilteredInitialMode();
      return !!mode && chatInputOptions.hideCustomChatModes && !isModeConsideredBuiltIn(mode, productService);
    };
    if (isHiddenCustomInitialMode()) {
      logService.trace(`[AutomationDialog] Skipping hidden custom initial mode "${initialMode}". Falling back to the default mode.`);
    } else {
      chatInput.setChatMode(
        initialMode,
        /* storeSelection */
        false
      );
    }
    if (chatInput.currentModeObs.get().id !== initialMode && !isHiddenCustomInitialMode()) {
      const baseline = chatInput.currentModeObs.get().id;
      const retry = disposables.add(new MutableDisposable());
      const tryApply = () => {
        if (chatInput.currentModeObs.get().id !== baseline) {
          retry.clear();
          return;
        }
        if (isHiddenCustomInitialMode()) {
          logService.trace(`[AutomationDialog] Skipping hidden custom initial mode "${initialMode}" after modes updated. Falling back to the default mode.`);
          retry.clear();
          return;
        }
        const modes = chatInput.currentChatModesObs.get();
        if (modes.findModeById(initialMode) || modes.findModeByName(initialMode)) {
          chatInput.setChatMode(
            initialMode,
            /* storeSelection */
            false
          );
          if (chatInput.currentModeObs.get().id === initialMode) {
            retry.clear();
          }
        }
      };
      retry.value = autorun((reader) => {
        const modes = chatInput.currentChatModesObs.read(reader);
        reader.store.add(modes.onDidChange(tryApply));
        tryApply();
      });
    }
  }
  if (initialPermissionLevel && isChatPermissionLevel(initialPermissionLevel)) {
    chatInput.setPermissionLevel(initialPermissionLevel);
  }
  chatInput.resetLanguageModelToDefault();
  const resolveInitialModelId = () => initialModelId ? resolveAutomationModelIdentifier(
    languageModelsService,
    initialModelId,
    state.sessionTypeId,
    sessionTypePicker.modelTargetChatSessionType.get()
  ) : void 0;
  const resolvedInitialModelId = resolveInitialModelId();
  if (resolvedInitialModelId && !chatInput.switchModelByIdentifier(
    resolvedInitialModelId,
    /* storeSelection */
    false
  )) {
    const baseline = chatInput.selectedLanguageModel.get()?.identifier;
    const retry = disposables.add(new MutableDisposable());
    retry.value = Event.any(
      languageModelsService.onDidChangeLanguageModels,
      Event.fromObservableLight(sessionTypePicker.modelTargetChatSessionType)
    )(() => {
      if (chatInput.selectedLanguageModel.get()?.identifier !== baseline) {
        retry.clear();
        return;
      }
      const modelIdentifier = resolveInitialModelId();
      if (modelIdentifier && chatInput.switchModelByIdentifier(
        modelIdentifier,
        /* storeSelection */
        false
      )) {
        retry.clear();
      }
    });
  }
  disposables.add(chatInput.inputEditor.onDidChangeModelContent(() => {
    revalidate();
  }));
  chatInput.layout(580);
  queueMicrotask(() => {
    if (!disposables.isDisposed) {
      chatInput.layout(580);
    }
  });
  const resizeObserver = disposables.add(new DOM.DisposableResizeObserver("automationDialog.promptHost", (entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      if (width > 0) {
        chatInput.layout(width);
      }
    }
  }, DOM.getWindow(promptHost)));
  disposables.add(resizeObserver.observe(promptHost));
  const enabledRow = DOM.append(form, $(".automation-form-row.automation-form-checkbox-row"));
  const enabledLabelText = localize("automation.form.enabled", "Enabled (the scheduler runs this automation when due)");
  const enabledCheckbox = disposables.add(new Checkbox(enabledLabelText, state.enabled, defaultCheckboxStyles));
  DOM.append(enabledRow, enabledCheckbox.domNode);
  const enabledLabel = DOM.append(enabledRow, $("span.automation-form-checkbox-label", void 0, enabledLabelText));
  const setEnabled = (value) => {
    if (enabledCheckbox.checked !== value) {
      enabledCheckbox.checked = value;
    }
    state.enabled = value;
  };
  disposables.add(enabledCheckbox.onChange(() => {
    state.enabled = enabledCheckbox.checked;
  }));
  disposables.add(DOM.addStandardDisposableListener(enabledLabel, "click", () => {
    setEnabled(!enabledCheckbox.checked);
  }));
  return {
    getPrompt: () => chatInput.inputEditor.getValue(),
    getMode: () => chatInput.currentModeObs.get().id,
    getPermissionLevel: () => chatInput.currentPermissionLevelObs.get(),
    getModelId: () => chatInput.selectedLanguageModel.get()?.identifier,
    getBranch: () => isolationModel.persistedBranch,
    waitForAutomationSessionSync: () => {
      updateAutomationSessionTarget();
      return automationSessionDraftSynchronizer.waitForSync();
    },
    getFocusableElements: () => {
      return Array.from(form.querySelectorAll("input, select, textarea, button, a[href], [tabindex]"));
    }
  };
}
function buildTimeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const period = hour < 12 ? "AM" : "PM";
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const minuteText = minute.toString().padStart(2, "0");
      options.push({
        hour,
        minute,
        label: `${hour12}:${minuteText} ${period}`
      });
    }
  }
  return options;
}
function nearestTimeOptionIndex(hour, minute) {
  const safeHour = Math.max(0, Math.min(23, hour | 0));
  const safeMinute = Math.max(0, Math.min(59, minute | 0));
  const slot = Math.round(safeMinute / 15) % 4;
  const carriedHour = safeMinute >= 53 && slot === 0 ? (safeHour + 1) % 24 : safeHour;
  return carriedHour * 4 + slot;
}
function updateSaveButtonState(saveButton, state, validation, form, getPrompt, getBranch) {
  validation.nameError = state.name.trim() === "" ? localize("automation.form.nameRequired", "Name is required.") : void 0;
  validation.promptError = getPrompt().trim() === "" ? localize("automation.form.promptRequired", "Prompt is required.") : void 0;
  validation.folderError = !state.folderUri && !state.isQuickChat ? localize("automation.form.folderRequired", "Workspace folder is required.") : void 0;
  validation.sessionTypeError = !state.sessionTypeId || state.isQuickChat && !state.providerId ? localize("automation.form.sessionTypeRequired", "Session type is required.") : void 0;
  validation.branchError = !state.isQuickChat && state.isolationMode === "worktree" && !getBranch() ? localize("automation.form.branchRequired", "A branch is required for Worktree isolation.") : void 0;
  const valid = !validation.nameError && !validation.promptError && !validation.folderError && !validation.sessionTypeError && !validation.branchError;
  if (saveButton) {
    saveButton.enabled = valid;
  }
  form.classList.toggle("automation-form-invalid", !valid);
}
class AutomationsWorkspacePicker extends WorkspacePicker {
  constructor() {
    super(...arguments);
    this.targetModelWatch = this._register(new MutableDisposable());
  }
  setTargetModel(model) {
    this.targetModel = model;
    this.targetModelWatch.value = autorun((reader) => {
      model.isQuickChatObs.read(reader);
      this._updateTriggerLabel();
    });
  }
  _showTabs() {
    return false;
  }
  _shouldPersistSelection() {
    return false;
  }
  _buildItems() {
    const items = super._buildItems();
    const noWorkspace = {
      kind: ActionListItemKind.Action,
      label: localize("automation.form.noWorkspace", "No workspace"),
      description: localize("automation.form.noWorkspace.description", "Run without a backing workspace"),
      group: { title: "", icon: Codicon.commentDiscussion },
      item: {
        checked: this.targetModel?.isQuickChat || void 0,
        run: () => this.targetModel?.setQuickChat(true)
      }
    };
    return items.length > 0 ? [noWorkspace, { kind: ActionListItemKind.Separator, label: "" }, ...items] : [noWorkspace];
  }
  async _dispatchPickerItem(item) {
    const applied = await super._dispatchPickerItem(item);
    const selectedFolder = this.selectedFolderUri;
    if (applied && selectedFolder && (item.folderUri || item.browseActionIndex !== void 0)) {
      this.targetModel?.setQuickChat(false, selectedFolder);
    }
    return applied;
  }
  _isSelectedFolder(folderUri) {
    return !this.targetModel?.isQuickChat && super._isSelectedFolder(folderUri);
  }
  _renderTriggerLabel(trigger) {
    DOM.clearNode(trigger);
    const workspace = this.selectedResolved?.workspace;
    const noWorkspace = this.targetModel?.isQuickChat === true;
    const label = noWorkspace ? localize("automation.form.noWorkspace", "No workspace") : workspace?.label ?? localize("pickWorkspace", "workspace");
    const icon = noWorkspace ? Codicon.commentDiscussion : workspace?.icon ?? Codicon.project;
    trigger.setAttribute("aria-label", workspace || noWorkspace ? localize("automation.form.workspacePicker.selectedAriaLabel", "Automation target, {0}", label) : localize("automation.form.workspacePicker.pickAriaLabel", "Pick a workspace for this automation"));
    const renderedIcon = DOM.append(trigger, renderIcon(icon));
    renderedIcon.setAttribute("aria-hidden", "true");
    DOM.append(trigger, $("span.sessions-chat-dropdown-label", void 0, label));
    const chevron = DOM.append(trigger, renderIcon(Codicon.chevronDownCompact));
    chevron.classList.add("sessions-chat-dropdown-chevron");
    chevron.setAttribute("aria-hidden", "true");
  }
  _getAllBrowseActions() {
    return super._getAllBrowseActions().filter((a) => a.group === SESSION_WORKSPACE_GROUP_LOCAL);
  }
}
class MobileAutomationsWorkspacePicker extends AutomationsWorkspacePicker {
  setLayoutService(layoutService) {
    this.layoutService = layoutService;
  }
  showPicker(force = false, anchor) {
    const triggerElement = anchor ?? this._triggerElement;
    if (!triggerElement || !this.layoutService || !shouldUseMobileWorkspacePickerSheet(this.layoutService)) {
      super.showPicker(force, anchor);
      return;
    }
    void showMobileWorkspacePickerSheet(
      this.layoutService,
      triggerElement,
      this._buildItems(),
      (item) => {
        void this._dispatchPickerItem(item);
      },
      this._getAllBrowseActions()
    );
  }
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.action.chat.automationsDialog.insertNewline",
  weight: KeybindingWeight.EditorContrib + 100,
  when: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ChatContextKeys.inAutomationsDialog
  ),
  primary: KeyCode.Enter,
  handler: (accessor) => {
    const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    editor?.trigger("keyboard", "type", { text: "\n" });
  }
});
export {
  AutomationIsolationGroupActionViewItem,
  AutomationSessionDraftSynchronizer,
  AutomationsWorkspacePicker,
  MobileAutomationsWorkspacePicker,
  canSelectAutomationWorkspace,
  isAutomationDialogPopupTarget,
  registerAutomationDialogKeyboardNavigation,
  renderForm,
  resolveAutomationModelIdentifier,
  updateSaveButtonState
};
