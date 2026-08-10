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
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../../workbench/common/contributions.js";
import { Menus } from "../../../../browser/menus.js";
import { SessionHasGitRepositoryContext, SessionProviderIdContext, SessionTypeContext, IsNewChatSessionContext } from "../../../../common/contextkeys.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { BranchPicker } from "./branchPicker.js";
import { COPILOT_PROVIDER_ID, CopilotChatSessionsProvider } from "./copilotChatSessionsProvider.js";
import { ModePicker, ModePickerModel } from "./modePicker.js";
import { CopilotPermissionPickerDelegate, PermissionPicker } from "./permissionPicker.js";
import { CopilotCLISessionType } from "../../agentHost/browser/baseAgentHostSessionsProvider.js";
import { ISessionContext } from "../../../../services/sessions/browser/sessionContext.js";
const IsActiveSessionCopilotCLI = ContextKeyExpr.equals(SessionTypeContext.key, CopilotCLISessionType.id);
const IsActiveCopilotChatSessionProvider = ContextKeyExpr.equals(SessionProviderIdContext.key, COPILOT_PROVIDER_ID);
const IsActiveSessionCopilotChatCLI = ContextKeyExpr.and(IsActiveSessionCopilotCLI, IsActiveCopilotChatSessionProvider);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "sessions.defaultCopilot.branchPicker",
      title: localize2("branchPicker", "Branch"),
      f1: false,
      menu: [{
        id: Menus.NewSessionRepositoryConfig,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.and(IsNewChatSessionContext, IsActiveSessionCopilotChatCLI, SessionHasGitRepositoryContext)
      }]
    });
  }
  async run() {
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "sessions.defaultCopilot.modePicker",
      title: localize2("modePicker", "Mode"),
      f1: false,
      menu: [{
        id: Menus.NewSessionConfig,
        group: "navigation",
        order: 0,
        when: IsActiveSessionCopilotChatCLI
      }]
    });
  }
  async run() {
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "sessions.defaultCopilot.permissionPicker",
      title: localize2("permissionPicker", "Permissions"),
      f1: false,
      menu: [{
        id: Menus.NewSessionControl,
        group: "navigation",
        order: 1,
        when: IsActiveSessionCopilotChatCLI
      }]
    });
  }
  async run() {
  }
});
class PickerActionViewItem extends BaseActionViewItem {
  constructor(picker, disposable) {
    super(void 0, { id: "", label: "", enabled: true, class: void 0, tooltip: "", run: () => {
    } });
    this.picker = picker;
    if (disposable) {
      this._register(disposable);
    }
  }
  render(container) {
    this.picker.render(container);
  }
  dispose() {
    this.picker.dispose();
    super.dispose();
  }
}
let CopilotPickerActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.copilotPickerActionViewItems";
  }
  constructor(actionViewItemService, sessionsService, sessionsProvidersService, instantiationService) {
    super();
    const modePickerModel = this._register(instantiationService.createInstance(ModePickerModel));
    this._register(autorun((reader) => {
      const session = sessionsService.activeSession.read(reader);
      if (session) {
        const provider = sessionsProvidersService.getProvider(session.providerId);
        if (provider instanceof CopilotChatSessionsProvider) {
          const selectedModeId = session.mode.read(reader)?.id;
          modePickerModel.setSession(session, selectedModeId);
          return;
        }
      }
      modePickerModel.setSession(void 0, void 0);
    }));
    this._register(actionViewItemService.register(
      Menus.NewSessionRepositoryConfig,
      "sessions.defaultCopilot.branchPicker",
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        const picker = scopedInstantiationService.createInstance(BranchPicker, session);
        return new PickerActionViewItem(picker);
      }
    ));
    this._register(actionViewItemService.register(
      Menus.NewSessionConfig,
      "sessions.defaultCopilot.modePicker",
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        const picker = scopedInstantiationService.createInstance(ModePicker, modePickerModel, session);
        const disposableStore = new DisposableStore();
        disposableStore.add(picker.onDidSelect((mode) => {
          const scopedSession = session.get();
          if (!scopedSession) {
            return;
          }
          const provider = sessionsProvidersService.getProvider(scopedSession.providerId);
          if (provider instanceof CopilotChatSessionsProvider) {
            provider.getSession(scopedSession.sessionId)?.setMode(mode);
          }
        }));
        return new PickerActionViewItem(picker, disposableStore);
      }
    ));
    if (!isWeb) {
      this._register(actionViewItemService.register(
        Menus.NewSessionControl,
        "sessions.defaultCopilot.permissionPicker",
        (_action, _options, scopedInstantiationService) => {
          const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
          const delegate = scopedInstantiationService.createInstance(CopilotPermissionPickerDelegate, session);
          const picker = scopedInstantiationService.createInstance(PermissionPicker, delegate);
          return new PickerActionViewItem(picker, delegate);
        }
      ));
    }
  }
};
CopilotPickerActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, IInstantiationService)
], CopilotPickerActionViewItemContribution);
registerWorkbenchContribution2(CopilotPickerActionViewItemContribution.ID, CopilotPickerActionViewItemContribution, WorkbenchPhase.AfterRestored);
export {
  PickerActionViewItem
};
