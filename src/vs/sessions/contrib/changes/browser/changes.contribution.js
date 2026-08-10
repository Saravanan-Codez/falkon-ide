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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../nls.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ViewContainerLocation, Extensions as ViewContainerExtensions, WindowEnablement } from "../../../../workbench/common/views.js";
import { EditorPaneDescriptor } from "../../../../workbench/browser/editor.js";
import { EditorExtensions } from "../../../../workbench/common/editor.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { CHANGES_VIEW_CONTAINER_ID, CHANGES_VIEW_ID, SESSIONS_CHANGES_OPEN_SINGLE_FILE_DIFF_SETTING } from "../common/changes.js";
import { ChangesViewPane, SinglePaneChangesViewPane, ChangesViewPaneContainer } from "./changesView.js";
import { SessionChangesEditor } from "./sessionChangesEditor.js";
import { SessionChangesEditorInput, SessionChangesEditorSerializer } from "./sessionChangesEditorInput.js";
import { IsPhoneLayoutContext, SessionHasWorkspaceContext } from "../../../common/contextkeys.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { ISessionChangesService, SessionChangesService } from "./sessionChangesService.js";
import "./changesActions.js";
import "./changesViewActions.js";
import "./changesetReviewActions.js";
import "./checksActions.js";
import "./media/multiFileDiffEditor.css";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ChangesViewService } from "./changesViewService.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { SessionsChangesAccessibilityHelp } from "./sessionsChangesAccessibilityHelp.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
let SinglePaneChangesEditorContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.singlePaneChangesEditor";
  }
  constructor(layoutService) {
    super();
    if (!layoutService.isSinglePaneLayoutEnabled) {
      return;
    }
    this._register(Registry.as(EditorExtensions.EditorPane).registerEditorPane(
      EditorPaneDescriptor.create(SessionChangesEditor, SessionChangesEditor.ID, localize("sessionChangesEditor.label", "Changes")),
      [new SyncDescriptor(SessionChangesEditorInput)]
    ));
    this._register(Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
      SessionChangesEditorInput.ID,
      SessionChangesEditorSerializer
    ));
  }
};
SinglePaneChangesEditorContribution = __decorateClass([
  __decorateParam(0, IAgentWorkbenchLayoutService)
], SinglePaneChangesEditorContribution);
registerWorkbenchContribution2(SinglePaneChangesEditorContribution.ID, SinglePaneChangesEditorContribution, WorkbenchPhase.BlockStartup);
AccessibleViewRegistry.register(new SessionsChangesAccessibilityHelp());
const changesViewIcon = registerIcon("changes-view-icon", Codicon.gitCompare, localize2("changesViewIcon", "View icon for the Changes view.").value);
const viewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
const changesViewContainer = viewContainersRegistry.registerViewContainer({
  id: CHANGES_VIEW_CONTAINER_ID,
  title: localize2("changes", "Changes"),
  icon: changesViewIcon,
  order: 10,
  ctorDescriptor: new SyncDescriptor(ChangesViewPaneContainer),
  storageId: CHANGES_VIEW_CONTAINER_ID,
  hideIfEmpty: true,
  openCommandActionDescriptor: {
    id: CHANGES_VIEW_CONTAINER_ID,
    mnemonicTitle: localize({ key: "miChanges", comment: ["&& denotes a mnemonic"] }, "Chan&&ges"),
    keybindings: {
      primary: 0,
      win: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG },
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG },
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyG }
    },
    order: 1
  },
  windowEnablement: WindowEnablement.Sessions
}, ViewContainerLocation.AuxiliaryBar);
const viewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
let ChangesViewContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.changesView";
  }
  constructor(layoutService) {
    super();
    const ctor = layoutService.isSinglePaneLayoutEnabled ? SinglePaneChangesViewPane : ChangesViewPane;
    viewsRegistry.registerViews([{
      id: CHANGES_VIEW_ID,
      name: localize2("changes", "Changes"),
      containerIcon: changesViewIcon,
      ctorDescriptor: new SyncDescriptor(ctor),
      canToggleVisibility: false,
      canMoveView: false,
      weight: 100,
      order: 1,
      when: ContextKeyExpr.and(IsPhoneLayoutContext.negate(), SessionHasWorkspaceContext),
      windowEnablement: WindowEnablement.Sessions
    }], changesViewContainer);
  }
};
ChangesViewContribution = __decorateClass([
  __decorateParam(0, IAgentWorkbenchLayoutService)
], ChangesViewContribution);
registerWorkbenchContribution2(ChangesViewContribution.ID, ChangesViewContribution, WorkbenchPhase.BlockStartup);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "sessions",
  properties: {
    [SESSIONS_CHANGES_OPEN_SINGLE_FILE_DIFF_SETTING]: {
      type: "boolean",
      tags: ["preview"],
      description: localize("sessions.changes.openSingleFileDiff", "Controls whether clicking a file in the Changes view opens a single file diff editor instead of the multi file diff editor."),
      default: false
    }
  }
});
registerSingleton(IChangesViewService, ChangesViewService, InstantiationType.Delayed);
registerSingleton(ISessionChangesService, SessionChangesService, InstantiationType.Delayed);
