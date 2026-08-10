import { LifecyclePhase } from "../../../../workbench/services/lifecycle/common/lifecycle.js";
import { BaseLayoutController } from "./baseSessionLayoutController.js";
import { SinglePaneDetailPanelStrategy } from "./singlePane/singlePaneDetailPanelStrategy.js";
import { SinglePaneEditorAreaCollapseStrategy } from "./singlePane/singlePaneEditorAreaCollapseStrategy.js";
import { SinglePaneDockedTabsCoordinator } from "./singlePane/singlePaneLayoutStrategy.js";
import { SinglePaneManagedTabsStrategy } from "./singlePane/singlePaneManagedTabsStrategy.js";
import { SinglePaneDetailsStrategy } from "./singlePane/singlePaneDetailsStrategy.js";
import { SinglePaneSidePaneVisibilityStrategy } from "./singlePane/singlePaneSidePaneVisibilityStrategy.js";
import { TOGGLE_DETAILS_COMMAND_ID } from "./singlePane/singlePaneDetailsStrategy.js";
const SINGLE_PANE_LAYOUT_STATE_KEY = "sessions.singlePane.layoutState";
class SinglePaneLayoutController extends BaseLayoutController {
  get _layoutStateStorageKey() {
    return SINGLE_PANE_LAYOUT_STATE_KEY;
  }
  get _legacyWorkingSetsStorageKey() {
    return void 0;
  }
  get _ctx() {
    if (!this._context) {
      const that = this;
      this._context = {
        get isRestoringSessionLayout() {
          return that._isRestoringSessionLayout;
        },
        withSessionLayoutRestore: (work) => that._withSessionLayoutRestore(work),
        onDidEndSessionLayoutRestore: that.onDidEndSessionLayoutRestore,
        get togglingSidePane() {
          return that._togglingSidePane;
        },
        get multipleSessionsVisibleObs() {
          return that.multipleSessionsVisibleObs;
        },
        get activeSessionResourceObs() {
          return that.activeSessionResourceObs;
        }
      };
    }
    return this._context;
  }
  // --- Side-pane visibility + detail content + Toggle Details ---
  _registerViewStateManagement() {
    this._register(this._instantiationService.createInstance(SinglePaneSidePaneVisibilityStrategy, this._ctx));
    this._register(this._instantiationService.createInstance(SinglePaneDetailPanelStrategy, this._ctx));
    this._details = this._register(this._instantiationService.createInstance(SinglePaneDetailsStrategy, this._ctx));
  }
  // --- Managed tabs + detail panel (deferred to Restored so they reconcile on top of the restored group) ---
  _registerAuxiliaryControllers() {
    this._lifecycleService.when(LifecyclePhase.Restored).then(() => {
      if (this._store.isDisposed) {
        return;
      }
      const coordinator = this._register(new SinglePaneDockedTabsCoordinator(this._sessionChangesService));
      this._register(this._instantiationService.createInstance(SinglePaneManagedTabsStrategy, this._ctx, coordinator));
      this._register(this._instantiationService.createInstance(SinglePaneEditorAreaCollapseStrategy, this._ctx, coordinator));
    });
  }
  /** Toggle the detail panel and return whether it is now visible. */
  toggleDetails() {
    return this._details?.toggleDetails() ?? false;
  }
  // --- Base hooks ---
  /**
   * A session-switch restore closes/opens the docked editors (empty working-set
   * apply, managed-tab reconciliation), so suppress editor-part auto-visibility
   * for the whole restore to avoid closing the side pane or mistaking a
   * layout-driven close for a user dismissing a managed tab.
   */
  _suppressEditorVisibilityDuringRestore() {
    return this._layoutService.suppressEditorPartAutoVisibility();
  }
  get _isEditorPartVisibilityPerSession() {
    return false;
  }
  get _isViewStatePerSession() {
    return false;
  }
  _shouldRevealEditorPartOnApply(_editorPartHidden, _isModal) {
    return false;
  }
  _shouldHideEditorPartOnApply(_editorPartHidden) {
    return false;
  }
}
export {
  SinglePaneLayoutController,
  TOGGLE_DETAILS_COMMAND_ID
};
