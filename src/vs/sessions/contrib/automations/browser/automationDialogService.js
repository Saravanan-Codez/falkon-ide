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
import "./media/automationDialog.css";
import * as DOM from "../../../../base/browser/dom.js";
import { Dialog } from "../../../../base/browser/ui/dialog/dialog.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { defaultDialogStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { createWorkbenchDialogOptions } from "../../../../workbench/browser/parts/dialogs/dialog.js";
import { ILanguageModelsService } from "../../../../workbench/contrib/chat/common/languageModels.js";
import { IHostService } from "../../../../workbench/services/host/browser/host.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { isAutomationDialogPopupTarget, registerAutomationDialogKeyboardNavigation, renderForm, updateSaveButtonState } from "./automationDialog.js";
const $ = DOM.$;
const automationDialogAllowableCommands = /* @__PURE__ */ new Set([
  "workbench.action.quit",
  "workbench.action.reloadWindow",
  "copy",
  "cut",
  "paste",
  "editor.action.selectAll",
  "editor.action.clipboardCopyAction",
  "editor.action.clipboardCutAction",
  "editor.action.clipboardPasteAction",
  "hideCodeActionWidget",
  "clearFilterCodeActionWidget",
  "selectPrevCodeAction",
  "selectNextCodeAction",
  "acceptSelectedCodeAction",
  "previewSelectedCodeAction",
  "toggleSectionCodeAction",
  "collapseSectionCodeAction",
  "expandSectionCodeAction",
  "quickInput.next",
  "quickInput.previous",
  "quickInput.accept",
  "quickInput.hide"
]);
let AutomationDialogService = class {
  constructor(instantiationService, contextKeyService, contextViewService, configurationService, languageModelsService, keybindingService, layoutService, logService, productService, hostService, sessionsManagementService, workspaceTrustRequestService) {
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.contextViewService = contextViewService;
    this.configurationService = configurationService;
    this.languageModelsService = languageModelsService;
    this.keybindingService = keybindingService;
    this.layoutService = layoutService;
    this.logService = logService;
    this.productService = productService;
    this.hostService = hostService;
    this.sessionsManagementService = sessionsManagementService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
  }
  async showAutomationDialog(options) {
    const disposables = new DisposableStore();
    const initial = options.existing;
    const isEdit = !!initial;
    const initialTarget = initial?.target;
    const initialWorkspaceTarget = initialTarget?.kind === "workspace" ? initialTarget : void 0;
    const state = {
      name: initial?.name ?? "",
      interval: initial?.schedule.interval ?? "daily",
      hour: initial?.schedule.scheduleHour ?? 9,
      minute: initial?.schedule.scheduleMinute ?? 0,
      day: initial?.schedule.scheduleDay ?? 1,
      isQuickChat: initialTarget?.kind === "quickChat",
      folderUri: initialWorkspaceTarget?.folderUri,
      providerId: initialTarget?.providerId,
      sessionTypeId: initialTarget?.sessionTypeId,
      isolationMode: initialWorkspaceTarget?.isolation.kind === "default" ? void 0 : initialWorkspaceTarget?.isolation.kind === "worktree" ? "worktree" : "workspace",
      branch: initialWorkspaceTarget?.isolation.kind === "worktree" ? initialWorkspaceTarget.isolation.branch : void 0,
      enabled: initial?.enabled ?? true
    };
    const validation = { nameError: void 0, promptError: void 0, folderError: void 0, sessionTypeError: void 0, branchError: void 0 };
    let saveButton;
    let cancelButton;
    let revalidate = () => {
    };
    let getPrompt = () => initial?.prompt ?? "";
    let getMode = () => initial?.mode;
    let getPermissionLevel = () => initial?.permissionLevel;
    let getModelId = () => initial?.modelId;
    let getBranch = () => initialWorkspaceTarget?.isolation.kind === "worktree" ? initialWorkspaceTarget.isolation.branch : void 0;
    let waitForAutomationSessionSync = async () => {
    };
    let getFocusableElements = () => [];
    let focusFirst = () => {
    };
    const title = isEdit ? localize("automation.dialog.editTitle", "Edit automation") : localize("automation.dialog.createTitle", "New automation");
    const buttonLabels = [
      isEdit ? localize("automation.dialog.save", "Save") : localize("automation.dialog.create", "Create"),
      localize("automation.dialog.cancel", "Cancel")
    ];
    const activeContainer = this.layoutService.activeContainer;
    const dialog = disposables.add(new Dialog(
      activeContainer,
      title,
      buttonLabels,
      createWorkbenchDialogOptions({
        type: "none",
        extraClasses: ["automation-dialog"],
        cancelId: 1,
        isExternalFocusAllowed: isAutomationDialogPopupTarget,
        // textLinkForeground stamps inline styles onto chat input picker chips.
        dialogStyles: { ...defaultDialogStyles, textLinkForeground: void 0 },
        buttonOptions: [
          {
            styleButton: (button) => {
              saveButton = button;
              revalidate();
            }
          },
          {
            styleButton: (button) => {
              cancelButton = button;
            }
          }
        ],
        renderBody: (container) => {
          container.classList.add("automation-dialog-body");
          const titlebar = DOM.append(container, $(".automation-titlebar"));
          titlebar.setAttribute("aria-hidden", "true");
          titlebar.textContent = title;
          const description = DOM.append(container, $(".automation-description"));
          description.textContent = isEdit ? localize("automation.dialog.editDescription", "Update the schedule, prompt, or run target for this automation.") : localize("automation.dialog.createDescription", "Define a prompt that will run on a schedule against the selected target.");
          const formPane = DOM.append(container, $(".automation-form-pane"));
          const form = DOM.append(formPane, $(".automation-form"));
          const handle = renderForm(form, state, disposables, validation, () => revalidate(), this.instantiationService, this.contextKeyService, this.contextViewService, this.configurationService, this.languageModelsService, this.layoutService, this.logService, this.productService, this.sessionsManagementService, this.workspaceTrustRequestService, initial?.prompt ?? "", initial?.mode, initial?.permissionLevel, initial?.modelId);
          getPrompt = handle.getPrompt;
          getMode = handle.getMode;
          getPermissionLevel = handle.getPermissionLevel;
          getModelId = handle.getModelId;
          getBranch = handle.getBranch;
          waitForAutomationSessionSync = handle.waitForAutomationSessionSync;
          getFocusableElements = handle.getFocusableElements;
          const keyboardNavigation = disposables.add(registerAutomationDialogKeyboardNavigation(
            DOM.getWindow(container),
            () => [
              ...getFocusableElements(),
              ...saveButton ? [saveButton.element] : [],
              ...cancelButton ? [cancelButton.element] : []
            ],
            isAutomationDialogPopupTarget
          ));
          focusFirst = keyboardNavigation.focusFirst;
          revalidate = () => updateSaveButtonState(saveButton, state, validation, form, getPrompt, getBranch);
          revalidate();
        }
      }, this.keybindingService, this.layoutService, this.hostService, automationDialogAllowableCommands)
    ));
    activeContainer.classList.add("automation-dialog-open");
    disposables.add(toDisposable(() => activeContainer.classList.remove("automation-dialog-open")));
    try {
      const resultPromise = dialog.show();
      focusFirst();
      const result = await resultPromise;
      if (result.button !== 0) {
        return void 0;
      }
      revalidate();
      if (validation.nameError || validation.promptError || validation.folderError || validation.sessionTypeError || validation.branchError) {
        return void 0;
      }
      if (!state.isQuickChat && !state.folderUri || !state.sessionTypeId || state.isQuickChat && !state.providerId) {
        return void 0;
      }
      await waitForAutomationSessionSync();
      const schedule = {
        interval: state.interval,
        scheduleHour: state.hour,
        scheduleMinute: state.minute,
        scheduleDay: state.day
      };
      const prompt = getPrompt();
      const mode = getMode();
      const permissionLevel = getPermissionLevel();
      const modelId = getModelId();
      const branch = getBranch();
      const target = createAutomationTarget(state, branch);
      if (!target) {
        return void 0;
      }
      if (isEdit && initial) {
        const patch = {
          name: state.name,
          prompt,
          schedule,
          target,
          modelId: modelId ?? null,
          mode: mode ?? null,
          permissionLevel: permissionLevel ?? null,
          enabled: state.enabled
        };
        return { kind: "update", id: initial.id, value: patch };
      }
      const create = {
        name: state.name,
        prompt,
        schedule,
        target,
        modelId,
        mode,
        permissionLevel,
        enabled: state.enabled
      };
      return { kind: "create", value: create };
    } finally {
      disposables.dispose();
    }
  }
};
AutomationDialogService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ILanguageModelsService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IProductService),
  __decorateParam(9, IHostService),
  __decorateParam(10, ISessionsManagementService),
  __decorateParam(11, IWorkspaceTrustRequestService)
], AutomationDialogService);
function createAutomationTarget(state, branch) {
  if (state.isQuickChat) {
    return state.providerId && state.sessionTypeId ? { kind: "quickChat", providerId: state.providerId, sessionTypeId: state.sessionTypeId } : void 0;
  }
  if (!state.folderUri) {
    return void 0;
  }
  const isolation = state.isolationMode === "worktree" ? branch ? { kind: "worktree", branch } : void 0 : state.isolationMode === "workspace" ? { kind: "folder" } : { kind: "default" };
  return isolation ? {
    kind: "workspace",
    folderUri: state.folderUri,
    providerId: state.providerId,
    sessionTypeId: state.sessionTypeId,
    isolation
  } : void 0;
}
export {
  AutomationDialogService
};
