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
import { mainWindow } from "../../../../../base/browser/window.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { IEditorGroupsService } from "../../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../../workbench/services/editor/common/editorService.js";
import { Parts } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { IAgentWorkbenchLayoutService } from "../../../../browser/workbench.js";
import { DockedEditorInput } from "../../../../common/dockedEditorInput.js";
import { SinglePaneLayoutStrategy } from "./singlePaneLayoutStrategy.js";
let SinglePaneEditorAreaCollapseStrategy = class extends SinglePaneLayoutStrategy {
  constructor(ctx, _coordinator, _layoutService, _editorService, _editorGroupsService) {
    super(ctx);
    this._coordinator = _coordinator;
    this._layoutService = _layoutService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    const editorAreaVisibleObs = observableFromEvent(
      this,
      this._layoutService.onDidChangePartVisibility,
      () => this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)
    );
    this._register(autorun((reader) => {
      const visible = editorAreaVisibleObs.read(reader);
      if (this._editorAreaVisible === void 0) {
        this._editorAreaVisible = visible;
        return;
      }
      if (visible === this._editorAreaVisible) {
        return;
      }
      this._editorAreaVisible = visible;
      if (this._ctx.isRestoringSessionLayout) {
        return;
      }
      if (visible) {
        void this._coordinator.sequencer.queue(() => this._restoreCollapsedTabs()).catch(onUnexpectedError);
        return;
      }
      if (this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
        void this._coordinator.sequencer.queue(() => this._collapseNonManagedTabs()).catch(onUnexpectedError);
      }
    }));
    this._register(this._ctx.onDidEndSessionLayoutRestore(() => this._queueCollapseIfDetailsOnly()));
    this._register(this._editorService.onDidEditorsChange(() => {
      if (!this._ctx.isRestoringSessionLayout) {
        this._queueCollapseIfDetailsOnly();
      }
    }));
  }
  _queueCollapseIfDetailsOnly() {
    if (!this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow) && this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
      void this._coordinator.sequencer.queue(() => this._collapseNonManagedTabs()).catch(onUnexpectedError);
    }
  }
  async _collapseNonManagedTabs() {
    const group = this._editorGroupsService.mainPart.activeGroup;
    const captured = [...this._coordinator.collapsedEditors ?? []];
    const toClose = [];
    group.editors.forEach((editor, index) => {
      if (editor instanceof DockedEditorInput || this._coordinator.getChangesEditorResource(editor)) {
        return;
      }
      const untyped = editor.toUntyped();
      if (untyped) {
        captured.push({ editor: untyped, index });
      }
      toClose.push(editor);
    });
    if (toClose.length === 0) {
      return;
    }
    this._coordinator.collapsedEditors = captured;
    const suppressEditorPartAutoVisibility = this._layoutService.suppressEditorPartAutoVisibility();
    try {
      await this._editorService.closeEditors(toClose.map((editor) => ({ groupId: group.id, editor })), { preserveFocus: true });
    } finally {
      suppressEditorPartAutoVisibility.dispose();
    }
  }
  async _restoreCollapsedTabs() {
    const captured = this._coordinator.collapsedEditors;
    this._coordinator.collapsedEditors = void 0;
    if (!captured || captured.length === 0) {
      return;
    }
    const group = this._editorGroupsService.mainPart.activeGroup;
    const suppressEditorPartAutoVisibility = this._layoutService.suppressEditorPartAutoVisibility();
    try {
      await this._editorService.openEditors(
        [...captured].sort((a, b) => a.index - b.index).map(({ editor, index }) => ({ ...editor, options: { ...editor.options, index, inactive: true, preserveFocus: true, pinned: true } })),
        group
      );
    } finally {
      suppressEditorPartAutoVisibility.dispose();
    }
  }
};
SinglePaneEditorAreaCollapseStrategy = __decorateClass([
  __decorateParam(2, IAgentWorkbenchLayoutService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService)
], SinglePaneEditorAreaCollapseStrategy);
export {
  SinglePaneEditorAreaCollapseStrategy
};
