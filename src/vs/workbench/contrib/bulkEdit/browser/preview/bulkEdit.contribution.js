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
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../common/contributions.js";
import { IBulkEditService } from "../../../../../editor/browser/services/bulkEditService.js";
import { BulkEditPane } from "./bulkEditPane.js";
import { Extensions as ViewContainerExtensions, ViewContainerLocation } from "../../../../common/views.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { FocusedViewContext } from "../../../../common/contextkeys.js";
import { localize, localize2 } from "../../../../../nls.js";
import { ViewPaneContainer } from "../../../../browser/parts/views/viewPaneContainer.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { WorkbenchListFocusContextKey } from "../../../../../platform/list/browser/listService.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { MenuId, registerAction2, Action2 } from "../../../../../platform/actions/common/actions.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../../../base/common/severity.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { IPaneCompositePartService } from "../../../../services/panecomposite/browser/panecomposite.js";
async function getBulkEditPane(viewsService) {
  const view = await viewsService.openView(BulkEditPane.ID, true);
  if (view instanceof BulkEditPane) {
    return view;
  }
  return void 0;
}
let UXState = class {
  constructor(_paneCompositeService, _editorGroupsService) {
    this._paneCompositeService = _paneCompositeService;
    this._editorGroupsService = _editorGroupsService;
    this._activePanel = _paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)?.getId();
  }
  async restore(panels, editors) {
    if (panels) {
      if (typeof this._activePanel === "string") {
        await this._paneCompositeService.openPaneComposite(this._activePanel, ViewContainerLocation.Panel);
      } else {
        this._paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
      }
    }
    if (editors) {
      for (const group of this._editorGroupsService.groups) {
        const previewEditors = [];
        for (const input of group.editors) {
          const resource = EditorResourceAccessor.getCanonicalUri(input, { supportSideBySide: SideBySideEditor.PRIMARY });
          if (resource?.scheme === BulkEditPane.Schema) {
            previewEditors.push(input);
          }
        }
        if (previewEditors.length) {
          group.closeEditors(previewEditors, { preserveFocus: true });
        }
      }
    }
  }
};
UXState = __decorateClass([
  __decorateParam(0, IPaneCompositePartService),
  __decorateParam(1, IEditorGroupsService)
], UXState);
class PreviewSession {
  constructor(uxState, cts = new CancellationTokenSource()) {
    this.uxState = uxState;
    this.cts = cts;
  }
}
let BulkEditPreviewContribution = class {
  constructor(_paneCompositeService, _viewsService, _editorGroupsService, _dialogService, bulkEditService, contextKeyService) {
    this._paneCompositeService = _paneCompositeService;
    this._viewsService = _viewsService;
    this._editorGroupsService = _editorGroupsService;
    this._dialogService = _dialogService;
    bulkEditService.setPreviewHandler((edits) => this._previewEdit(edits));
    this._ctxEnabled = BulkEditPreviewContribution.ctxEnabled.bindTo(contextKeyService);
  }
  static {
    this.ID = "workbench.contrib.bulkEditPreview";
  }
  static {
    this.ctxEnabled = new RawContextKey("refactorPreview.enabled", false);
  }
  async _previewEdit(edits) {
    this._ctxEnabled.set(true);
    const uxState = this._activeSession?.uxState ?? new UXState(this._paneCompositeService, this._editorGroupsService);
    const view = await getBulkEditPane(this._viewsService);
    if (!view) {
      this._ctxEnabled.set(false);
      return edits;
    }
    if (view.hasInput()) {
      const { confirmed } = await this._dialogService.confirm({
        type: Severity.Info,
        message: localize("overlap", "Another refactoring is being previewed."),
        detail: localize("detail", "Press 'Continue' to discard the previous refactoring and continue with the current refactoring."),
        primaryButton: localize({ key: "continue", comment: ["&& denotes a mnemonic"] }, "&&Continue")
      });
      if (!confirmed) {
        return [];
      }
    }
    let session;
    if (this._activeSession) {
      await this._activeSession.uxState.restore(false, true);
      this._activeSession.cts.dispose(true);
      session = new PreviewSession(uxState);
    } else {
      session = new PreviewSession(uxState);
    }
    this._activeSession = session;
    try {
      return await view.setInput(edits, session.cts.token) ?? [];
    } finally {
      if (this._activeSession === session) {
        await this._activeSession.uxState.restore(true, true);
        this._activeSession.cts.dispose();
        this._ctxEnabled.set(false);
        this._activeSession = void 0;
      }
    }
  }
};
BulkEditPreviewContribution = __decorateClass([
  __decorateParam(0, IPaneCompositePartService),
  __decorateParam(1, IViewsService),
  __decorateParam(2, IEditorGroupsService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IBulkEditService),
  __decorateParam(5, IContextKeyService)
], BulkEditPreviewContribution);
registerAction2(class ApplyAction extends Action2 {
  constructor() {
    super({
      id: "refactorPreview.apply",
      title: localize2("apply", "Apply Refactoring"),
      category: localize2("cat", "Refactor Preview"),
      icon: Codicon.check,
      precondition: ContextKeyExpr.and(BulkEditPreviewContribution.ctxEnabled, BulkEditPane.ctxHasCheckedChanges),
      menu: [{
        id: MenuId.BulkEditContext,
        order: 1
      }],
      keybinding: {
        weight: KeybindingWeight.EditorContrib - 10,
        when: ContextKeyExpr.and(BulkEditPreviewContribution.ctxEnabled, FocusedViewContext.isEqualTo(BulkEditPane.ID)),
        primary: KeyMod.CtrlCmd + KeyCode.Enter
      }
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await getBulkEditPane(viewsService);
    view?.accept();
  }
});
registerAction2(class DiscardAction extends Action2 {
  constructor() {
    super({
      id: "refactorPreview.discard",
      title: localize2("Discard", "Discard Refactoring"),
      category: localize2("cat", "Refactor Preview"),
      icon: Codicon.clearAll,
      precondition: BulkEditPreviewContribution.ctxEnabled,
      menu: [{
        id: MenuId.BulkEditContext,
        order: 2
      }]
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await getBulkEditPane(viewsService);
    view?.discard();
  }
});
registerAction2(class ToggleAction extends Action2 {
  constructor() {
    super({
      id: "refactorPreview.toggleCheckedState",
      title: localize2("toogleSelection", "Toggle Change"),
      category: localize2("cat", "Refactor Preview"),
      precondition: BulkEditPreviewContribution.ctxEnabled,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: WorkbenchListFocusContextKey,
        primary: KeyCode.Space
      },
      menu: {
        id: MenuId.BulkEditContext,
        group: "navigation"
      }
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await getBulkEditPane(viewsService);
    view?.toggleChecked();
  }
});
registerAction2(class GroupByFile extends Action2 {
  constructor() {
    super({
      id: "refactorPreview.groupByFile",
      title: localize2("groupByFile", "Group Changes By File"),
      category: localize2("cat", "Refactor Preview"),
      icon: Codicon.ungroupByRefType,
      precondition: ContextKeyExpr.and(BulkEditPane.ctxHasCategories, BulkEditPane.ctxGroupByFile.negate(), BulkEditPreviewContribution.ctxEnabled),
      menu: [{
        id: MenuId.BulkEditTitle,
        when: ContextKeyExpr.and(BulkEditPane.ctxHasCategories, BulkEditPane.ctxGroupByFile.negate()),
        group: "navigation",
        order: 3
      }]
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await getBulkEditPane(viewsService);
    view?.groupByFile();
  }
});
registerAction2(class GroupByType extends Action2 {
  constructor() {
    super({
      id: "refactorPreview.groupByType",
      title: localize2("groupByType", "Group Changes By Type"),
      category: localize2("cat", "Refactor Preview"),
      icon: Codicon.groupByRefType,
      precondition: ContextKeyExpr.and(BulkEditPane.ctxHasCategories, BulkEditPane.ctxGroupByFile, BulkEditPreviewContribution.ctxEnabled),
      menu: [{
        id: MenuId.BulkEditTitle,
        when: ContextKeyExpr.and(BulkEditPane.ctxHasCategories, BulkEditPane.ctxGroupByFile),
        group: "navigation",
        order: 3
      }]
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await getBulkEditPane(viewsService);
    view?.groupByType();
  }
});
registerAction2(class ToggleGrouping extends Action2 {
  constructor() {
    super({
      id: "refactorPreview.toggleGrouping",
      title: localize2("groupByType", "Group Changes By Type"),
      category: localize2("cat", "Refactor Preview"),
      icon: Codicon.listTree,
      toggled: BulkEditPane.ctxGroupByFile.negate(),
      precondition: ContextKeyExpr.and(BulkEditPane.ctxHasCategories, BulkEditPreviewContribution.ctxEnabled),
      menu: [{
        id: MenuId.BulkEditContext,
        order: 3
      }]
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = await getBulkEditPane(viewsService);
    view?.toggleGrouping();
  }
});
registerWorkbenchContribution2(
  BulkEditPreviewContribution.ID,
  BulkEditPreviewContribution,
  WorkbenchPhase.BlockRestore
);
const refactorPreviewViewIcon = registerIcon("refactor-preview-view-icon", Codicon.lightbulb, localize("refactorPreviewViewIcon", "View icon of the refactor preview view."));
const container = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
  id: BulkEditPane.ID,
  title: localize2("panel", "Refactor Preview"),
  hideIfEmpty: true,
  ctorDescriptor: new SyncDescriptor(
    ViewPaneContainer,
    [BulkEditPane.ID, { mergeViewWithContainerWhenSingleView: true }]
  ),
  icon: refactorPreviewViewIcon,
  storageId: BulkEditPane.ID
}, ViewContainerLocation.Panel);
Registry.as(ViewContainerExtensions.ViewsRegistry).registerViews([{
  id: BulkEditPane.ID,
  name: localize2("panel", "Refactor Preview"),
  when: BulkEditPreviewContribution.ctxEnabled,
  ctorDescriptor: new SyncDescriptor(BulkEditPane),
  containerIcon: refactorPreviewViewIcon
}], container);
