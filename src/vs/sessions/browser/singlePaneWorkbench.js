import { Sizing } from "../../base/browser/ui/grid/grid.js";
import { alert } from "../../base/browser/ui/aria/aria.js";
import { localize } from "../../nls.js";
import { Parts } from "../../workbench/services/layout/browser/layoutService.js";
import { DockedEditorInput } from "../common/dockedEditorInput.js";
import { DockedAuxiliaryBarController } from "./dockedAuxiliaryBarController.js";
import { EDITOR_PART_MINIMUM_WIDTH } from "./parts/editorPartSizing.js";
import { Workbench } from "./workbench.js";
class DockedEditorSizeMemento {
}
class SinglePaneWorkbench extends Workbench {
  constructor() {
    super(...arguments);
    this._dockedAuxiliaryBarWidth = DockedAuxiliaryBarController.DEFAULT_WIDTH;
    this._syncingEditorVisibility = false;
    this._detailHiddenForEditorResize = false;
    this._memento = new DockedEditorSizeMemento();
    this._defaultSidePaneState = { editor: true, auxiliaryBar: false };
  }
  static {
    /** Node width past the detail width at which editor content counts as visible. */
    this._EDITOR_CONTENT_VISIBLE_THRESHOLD = 4;
  }
  static {
    this._DETAIL_AUTO_SHOW_MARGIN = 100;
  }
  get isSinglePaneLayoutEnabled() {
    return true;
  }
  isEditorPaneVisible() {
    return this.workbenchGrid ? this.workbenchGrid.isViewVisible(this.editorPartView) : super.isEditorPaneVisible();
  }
  toggleSecondarySideBar() {
    const visible = this.toggleSidePane();
    alert(visible ? localize("sidePaneVisible", "Side pane shown") : localize("sidePaneHidden", "Side pane hidden"));
  }
  isSecondarySideBarVisible() {
    return this.isSidePaneVisible();
  }
  /**
   * A docked-detail editor (Changes/Files) renders its content in the docked
   * detail panel. While that panel is open and the editor area is closed,
   * re-activating such an editor (closing a neighbouring tab, or clicking the
   * tab) must not reveal the editor area. When the detail panel is closed the
   * base reveal still runs so the content becomes visible.
   */
  revealEditorOnOpen(e) {
    if (!this.isRestored() && !this.partVisibility.editor) {
      return;
    }
    if (e.editor instanceof DockedEditorInput && this.partVisibility.auxiliaryBar && !this.partVisibility.editor) {
      return;
    }
    super.revealEditorOnOpen(e);
  }
  getDockedAuxiliaryBarWidth() {
    return this._dockedAuxiliaryBarWidth;
  }
  setDockedAuxiliaryBarWidth(width) {
    this._dockedAuxiliaryBarWidth = width;
    if (this.workbenchGrid && this.partVisibility.auxiliaryBar && !this.partVisibility.editor) {
      this._syncingEditorVisibility = true;
      try {
        this.workbenchGrid.resizeView(this.editorPartView, {
          width: this._dockedAuxiliaryBarWidth,
          height: this.workbenchGrid.getViewSize(this.editorPartView).height
        });
      } finally {
        this._syncingEditorVisibility = false;
      }
    }
    this._layoutDockedAuxBar();
  }
  /** Re-layouts the docked auxiliary bar, which the editor part owns. */
  _layoutDockedAuxBar() {
    this.editorGroupService.mainPart.layoutDockedAuxiliaryBar();
  }
  _applyLayoutContainerClass() {
    this.mainContainer.classList.toggle("dock-detail-panel", true);
  }
  _auxiliaryBarLayoutWidth() {
    return this._dockedAuxiliaryBarWidth;
  }
  _auxiliaryBarViewSize() {
    return { width: this._dockedAuxiliaryBarWidth, height: this._editorPartContainer?.clientHeight ?? 0 };
  }
  _setAuxiliaryBarViewSize(size) {
    this._dockedAuxiliaryBarWidth = Math.max(DockedAuxiliaryBarController.MIN_WIDTH, size.width);
    this._layoutDockedAuxBar();
  }
  _resizeAuxiliaryBarBy(deltaWidth, _deltaHeight) {
    this._dockedAuxiliaryBarWidth = Math.max(DockedAuxiliaryBarController.MIN_WIDTH, this._dockedAuxiliaryBarWidth + deltaWidth);
    this._layoutDockedAuxBar();
  }
  _restoreAuxiliaryBarWidth(width) {
    this._dockedAuxiliaryBarWidth = Math.max(DockedAuxiliaryBarController.MIN_WIDTH, width);
  }
  _persistedEditorWidth(editorGridWidth) {
    if (typeof editorGridWidth !== "number") {
      return editorGridWidth;
    }
    const dockedDetailWidth = this.partVisibility.auxiliaryBar ? this._dockedAuxiliaryBarWidth : 0;
    return Math.max(0, editorGridWidth - dockedDetailWidth);
  }
  _persistedGridViewSize(view, dimension, visible) {
    if (view === this.auxiliaryBarPartView) {
      return this._dockedAuxiliaryBarWidth;
    }
    return super._persistedGridViewSize(view, dimension, visible);
  }
  _defaultSideBarSize(policySideBarSize) {
    return Math.min(policySideBarSize, 280);
  }
  _editorNodeSize(effectiveEditorWidth, effectiveAuxBarWidth) {
    if (!this.partVisibility.editor && this.partVisibility.auxiliaryBar) {
      return this._dockedAuxiliaryBarWidth;
    }
    return effectiveEditorWidth + effectiveAuxBarWidth;
  }
  _editorNodeVisible(editorVisible, auxBarVisible) {
    return editorVisible || auxBarVisible;
  }
  _minimumPartWidthForActivation(view) {
    if (view === this.editorPartView && this.partVisibility.auxiliaryBar) {
      return view.minimumWidth + this._dockedAuxiliaryBarWidth;
    }
    return super._minimumPartWidthForActivation(view);
  }
  _topRightSectionChildren(sessionsNode, editorNode, _auxiliaryBarNode, customViewGridNode) {
    return [sessionsNode, editorNode, customViewGridNode];
  }
  _layoutSidePane() {
    this._layoutDockedAuxBar();
  }
  _layoutGrid() {
    const sessionsSize = this.workbenchGrid.getViewSize(this.sessionsPartView);
    const editorSize = this.workbenchGrid.getViewSize(this.editorPartView);
    const preserveRatio = this.partVisibility.editor && this.workbenchGrid.isViewVisible(this.sessionsPartView) && this.workbenchGrid.isViewVisible(this.editorPartView) && sessionsSize.width > 0 && editorSize.width > 0;
    super._layoutGrid();
    if (preserveRatio) {
      this._preserveSessionsEditorRatio(sessionsSize.width, editorSize.width);
    }
  }
  _preserveSessionsEditorRatio(previousSessionsWidth, previousEditorWidth) {
    const sessionsSize = this.workbenchGrid.getViewSize(this.sessionsPartView);
    const editorSize = this.workbenchGrid.getViewSize(this.editorPartView);
    const previousTotalWidth = previousSessionsWidth + previousEditorWidth;
    const totalWidth = sessionsSize.width + editorSize.width;
    if (totalWidth === previousTotalWidth) {
      return;
    }
    const minimumEditorWidth = this._minimumPartWidthForActivation(this.editorPartView);
    const maximumEditorWidth = totalWidth - this._minimumPartWidthForActivation(this.sessionsPartView);
    if (maximumEditorWidth < minimumEditorWidth) {
      return;
    }
    const proportionalEditorWidth = Math.round(totalWidth * previousEditorWidth / previousTotalWidth);
    const targetEditorWidth = Math.min(maximumEditorWidth, Math.max(minimumEditorWidth, proportionalEditorWidth));
    if (targetEditorWidth === editorSize.width) {
      return;
    }
    this._runWithEditorResizeSyncSuspended(() => {
      this.workbenchGrid.resizeView(this.editorPartView, {
        width: targetEditorWidth,
        height: editorSize.height
      });
    });
  }
  _applyEditorAreaVisibility() {
    this.workbenchGrid.setViewVisible(this.editorPartView, this._editorNodeShouldBeVisible());
    this._layoutDockedAuxBar();
  }
  _onGridDidChange() {
    this._syncEditorVisibility(this.workbenchGrid.getViewSize(this.editorPartView).width);
  }
  _onEditorNodeResized(nodeWidth) {
    this._syncEditorVisibility(nodeWidth);
  }
  _fireDidChangePartVisibility(partId, visible, source) {
    if (partId === Parts.AUXILIARYBAR_PART && source !== "resize") {
      this._detailHiddenForEditorResize = false;
    }
    super._fireDidChangePartVisibility(partId, visible, source);
  }
  _syncEditorVisibility(nodeWidth) {
    if (this._syncingEditorVisibility) {
      return;
    }
    if (this._isEditorPartAutoVisibilitySuppressed) {
      return;
    }
    this._syncingEditorVisibility = true;
    try {
      const detailFitsBesideEditor = nodeWidth >= this._dockedAuxiliaryBarWidth + EDITOR_PART_MINIMUM_WIDTH;
      if (this.partVisibility.editor && this.partVisibility.auxiliaryBar && !detailFitsBesideEditor) {
        this._detailHiddenForEditorResize = true;
        this.setAuxiliaryBarHiddenForResize(true);
        return;
      }
      const detailShowThreshold = this._dockedAuxiliaryBarWidth + EDITOR_PART_MINIMUM_WIDTH + SinglePaneWorkbench._DETAIL_AUTO_SHOW_MARGIN;
      if (this.partVisibility.editor && !this.partVisibility.auxiliaryBar && this._detailHiddenForEditorResize && nodeWidth >= detailShowThreshold) {
        this.setAuxiliaryBarHiddenForResize(false);
        this._detailHiddenForEditorResize = false;
        return;
      }
      const editorContentVisible = nodeWidth > this._dockedAuxiliaryBarWidth + SinglePaneWorkbench._EDITOR_CONTENT_VISIBLE_THRESHOLD;
      if (this.partVisibility.editor && !editorContentVisible && this.partVisibility.auxiliaryBar) {
        this.partVisibility.editor = false;
        this._setMainEditorAreaHidden(true);
        this._editorRevealedExplicitly = false;
        this._layoutDockedAuxBar();
        this._fireDidChangePartVisibility(Parts.EDITOR_PART, false);
        this._savePartVisibility();
        return;
      }
    } finally {
      this._syncingEditorVisibility = false;
    }
  }
  _runWithEditorResizeSyncSuspended(fn) {
    this._syncingEditorVisibility = true;
    try {
      fn();
    } finally {
      this._syncingEditorVisibility = false;
    }
  }
  _applyEditorVisibility(hidden) {
    if (hidden) {
      const contentWidth = this._persistedEditorWidth(this.workbenchGrid.getViewSize(this.editorPartView).width);
      if (contentWidth !== void 0 && contentWidth >= EDITOR_PART_MINIMUM_WIDTH) {
        this._savedPartSizes = { ...this._savedPartSizes, editor: contentWidth };
      }
    }
    const dockedEditorSizeBeforeHide = this._memento.dockedEditorSizeBeforeHide;
    const savedEditorWidth = this._savedPartSizes.editor;
    const canRestoreSavedWidth = savedEditorWidth !== void 0 && savedEditorWidth >= EDITOR_PART_MINIMUM_WIDTH;
    const shouldRestoreDockedEditorSize = !hidden && !!dockedEditorSizeBeforeHide;
    const shouldRestoreSavedWidth = !hidden && !shouldRestoreDockedEditorSize && canRestoreSavedWidth;
    const shouldApplyEvenSplit = !hidden && !shouldRestoreDockedEditorSize && !shouldRestoreSavedWidth;
    this.workbenchGrid.setViewVisible(
      this.editorPartView,
      this._editorNodeShouldBeVisible(),
      shouldApplyEvenSplit ? Sizing.Distribute : void 0
    );
    if (hidden) {
      if (this.partVisibility.auxiliaryBar) {
        this._memento.dockedEditorSizeBeforeHide = this.workbenchGrid.getViewSize(this.editorPartView);
        this.workbenchGrid.resizeView(this.editorPartView, {
          width: this._dockedAuxiliaryBarWidth,
          height: this._memento.dockedEditorSizeBeforeHide.height
        });
      } else {
        this._memento.dockedEditorSizeBeforeHide = void 0;
      }
    } else if (dockedEditorSizeBeforeHide) {
      this.workbenchGrid.resizeView(this.editorPartView, dockedEditorSizeBeforeHide);
      this._memento.dockedEditorSizeBeforeHide = void 0;
    } else if (shouldRestoreSavedWidth) {
      const height = this.workbenchGrid.getViewSize(this.editorPartView).height;
      const detailWidth = this.partVisibility.auxiliaryBar ? this._dockedAuxiliaryBarWidth : 0;
      this.workbenchGrid.resizeView(this.editorPartView, { width: savedEditorWidth + detailWidth, height });
    }
    if (shouldApplyEvenSplit) {
      this._hasAppliedInitialEditorSplit = true;
    }
    this._layoutDockedAuxBar();
    this._fireDidChangePartVisibility(Parts.EDITOR_PART, !hidden);
    this._notifyContainerDidLayout();
  }
  _onWillHideAuxiliaryBar(hidden) {
    if (hidden && !this.partVisibility.editor && !this._isEditorPartAutoVisibilitySuppressed) {
      this.setEditorHidden(
        false,
        /* explicit */
        true
      );
    }
  }
  /**
   * No-op unless detail-only (editor content hidden): there the shared node is a
   * snap view, so sash-drag collapse/reveal maps onto hiding/showing the auxiliary bar.
   */
  _onEditorPartGridVisibilityChange(visible) {
    if (this.partVisibility.editor) {
      return;
    }
    if (!visible) {
      const suppression = this.suppressEditorPartAutoVisibility();
      try {
        this.setAuxiliaryBarHiddenForResize(true);
      } finally {
        suppression.dispose();
      }
      return;
    }
    this.setAuxiliaryBarHiddenForResize(false);
  }
  _applyAuxiliaryBarVisibility(hidden, source) {
    if (this.workbenchGrid) {
      this.workbenchGrid.setViewVisible(
        this.editorPartView,
        this._editorNodeShouldBeVisible()
      );
      if (!hidden && !this.partVisibility.editor) {
        this._syncingEditorVisibility = true;
        try {
          this.workbenchGrid.resizeView(this.editorPartView, {
            width: this._dockedAuxiliaryBarWidth,
            height: this.workbenchGrid.getViewSize(this.editorPartView).height
          });
        } finally {
          this._syncingEditorVisibility = false;
        }
      }
    }
    this._layoutDockedAuxBar();
    this._fireDidChangePartVisibility(Parts.AUXILIARYBAR_PART, !hidden, source);
    this._notifyContainerDidLayout();
  }
  _shouldOpenAuxiliaryPaneComposite(containerId) {
    return this._isAuxViewContainerActive(containerId);
  }
  _handleAllEditorsClosed() {
    if (!this.partVisibility.editor && !this.partVisibility.auxiliaryBar) {
      return;
    }
    if (this.partVisibility.editor) {
      this.rememberAttachedEditorMaximizedState();
    }
    const suppress = this.suppressEditorPartAutoVisibility();
    try {
      if (this.partVisibility.editor) {
        this.setEditorHidden(true);
      }
      if (this.partVisibility.auxiliaryBar) {
        this.setAuxiliaryBarHidden(true);
      }
    } finally {
      suppress.dispose();
    }
  }
}
export {
  DockedEditorSizeMemento,
  SinglePaneWorkbench
};
