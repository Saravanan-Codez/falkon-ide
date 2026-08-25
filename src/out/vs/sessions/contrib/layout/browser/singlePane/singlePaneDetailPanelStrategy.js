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
import { Sequencer } from "../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Event } from "../../../../../base/common/event.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { DiffEditorInput } from "../../../../../workbench/common/editor/diffEditorInput.js";
import { BrowserEditorInput } from "../../../../../workbench/contrib/browserView/common/browserEditorInput.js";
import { FileEditorInput } from "../../../../../workbench/contrib/files/browser/editors/fileEditorInput.js";
import { MultiDiffEditorInput } from "../../../../../workbench/contrib/multiDiffEditor/browser/multiDiffEditorInput.js";
import { WebviewInput } from "../../../../../workbench/contrib/webviewPanel/browser/webviewEditorInput.js";
import { IEditorGroupsService } from "../../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../../workbench/services/editor/common/editorService.js";
import { Parts } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { IViewsService } from "../../../../../workbench/services/views/common/viewsService.js";
import { IAgentWorkbenchLayoutService } from "../../../../browser/workbench.js";
import { HasDockedDetailsContext } from "../../../../common/contextkeys.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { CHANGES_VIEW_CONTAINER_ID } from "../../../changes/common/changes.js";
import { ISessionChangesService } from "../../../changes/browser/sessionChangesService.js";
import { EmptyFileEditorInput } from "../../../editor/browser/emptyFileEditorInput.js";
import { SESSIONS_FILES_CONTAINER_ID } from "../../../files/browser/files.contribution.js";
import { SinglePaneLayoutStrategy } from "./singlePaneLayoutStrategy.js";
var DetailPanelTarget = /* @__PURE__ */ ((DetailPanelTarget2) => {
  DetailPanelTarget2[DetailPanelTarget2["Hidden"] = 0] = "Hidden";
  DetailPanelTarget2[DetailPanelTarget2["BrowserHidden"] = 1] = "BrowserHidden";
  DetailPanelTarget2[DetailPanelTarget2["Changes"] = 2] = "Changes";
  DetailPanelTarget2[DetailPanelTarget2["ChangesForced"] = 3] = "ChangesForced";
  DetailPanelTarget2[DetailPanelTarget2["Files"] = 4] = "Files";
  DetailPanelTarget2[DetailPanelTarget2["FilesForced"] = 5] = "FilesForced";
  DetailPanelTarget2[DetailPanelTarget2["Preserve"] = 6] = "Preserve";
  return DetailPanelTarget2;
})(DetailPanelTarget || {});
const MARKDOWN_EDITOR_VIEW_TYPES = /* @__PURE__ */ new Set([
  "markdown.preview",
  "vscode.markdown.editor",
  "vscode.markdown.preview.editor"
]);
let SinglePaneDetailPanelStrategy = class extends SinglePaneLayoutStrategy {
  constructor(ctx, _layoutService, _sessionsService, _editorService, _editorGroupsService, _viewsService, _sessionChangesService, _contextKeyService) {
    super(ctx);
    this._layoutService = _layoutService;
    this._sessionsService = _sessionsService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._viewsService = _viewsService;
    this._sessionChangesService = _sessionChangesService;
    this._contextKeyService = _contextKeyService;
    this._detailSequencer = new Sequencer();
    this._detailGeneration = 0;
    this._hiddenByBrowser = false;
    this._hasDockedDetailsContext = HasDockedDetailsContext.bindTo(this._contextKeyService);
    const activeEditorObs = observableFromEvent(this, this._editorService.onDidActiveEditorChange, () => this._editorService.activeEditor);
    const mainPartEmptyObs = observableFromEvent(this, Event.any(this._editorService.onDidActiveEditorChange, this._editorService.onDidEditorsChange, this._editorService.onDidCloseEditor), () => this._isMainPartEmpty());
    const auxBarVisibleObs = observableFromEvent(this, this._layoutService.onDidChangePartVisibility, () => this._layoutService.isVisible(Parts.AUXILIARYBAR_PART));
    const editorPartVisibleObs = observableFromEvent(this, this._layoutService.onDidChangePartVisibility, () => this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow));
    const editorMaximizedObs = observableFromEvent(this, this._layoutService.onDidChangeEditorMaximized, () => this._layoutService.isEditorMaximized());
    this._register(autorun((reader) => {
      const activeEditor = activeEditorObs.read(reader);
      const target = this._computeDetailTarget(reader, activeEditor, mainPartEmptyObs, editorMaximizedObs, editorPartVisibleObs);
      const hasDockedDetails = target === 2 /* Changes */ || target === 3 /* ChangesForced */ || target === 4 /* Files */ || target === 5 /* FilesForced */;
      this._hasDockedDetailsContext.set(hasDockedDetails);
      auxBarVisibleObs.read(reader);
      const syncTarget = this._ctx.multipleSessionsVisibleObs.read(reader) ? 6 /* Preserve */ : target;
      const generation = ++this._detailGeneration;
      void this._detailSequencer.queue(() => this._syncDetailTarget(syncTarget, generation)).catch(onUnexpectedError);
    }));
    this._register(this._editorService.onDidActiveEditorChange(() => {
      if (this._editorService.activeEditor instanceof EmptyFileEditorInput && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow) && !this._ctx.isRestoringSessionLayout && !this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
        this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
      }
    }));
  }
  _computeDetailTarget(reader, activeEditor, mainPartEmptyObs, editorMaximizedObs, editorPartVisibleObs) {
    const activeSession = this._sessionsService.activeSession.read(reader);
    if (!activeSession) {
      return 6 /* Preserve */;
    }
    const isQuickChat = activeSession?.isQuickChat?.read(reader) ?? false;
    const workspace = activeSession?.workspace.read(reader);
    if (isQuickChat) {
      return 0 /* Hidden */;
    }
    if (!workspace) {
      return 6 /* Preserve */;
    }
    if (mainPartEmptyObs.read(reader) && (activeSession?.isCreated.read(reader) ?? true)) {
      return this._ctx.isRestoringSessionLayout ? 6 /* Preserve */ : 0 /* Hidden */;
    }
    if (editorMaximizedObs.read(reader)) {
      return 2 /* Changes */;
    }
    if (!activeEditor) {
      return activeSession?.isCreated.read(reader) ? 2 /* Changes */ : 4 /* Files */;
    }
    if (activeEditor instanceof BrowserEditorInput) {
      if (editorPartVisibleObs.read(reader)) {
        return 1 /* BrowserHidden */;
      }
      return activeSession?.isCreated.read(reader) ? 2 /* Changes */ : 4 /* Files */;
    }
    if (this._isChangesEditor(activeEditor)) {
      return 3 /* ChangesForced */;
    }
    if (this._isFileEditor(activeEditor)) {
      return 5 /* FilesForced */;
    }
    return 6 /* Preserve */;
  }
  _isMainPartEmpty() {
    for (const group of this._editorGroupsService.mainPart.groups) {
      if (!group.isEmpty) {
        return false;
      }
    }
    return true;
  }
  async _syncDetailTarget(target, generation) {
    if (generation !== this._detailGeneration) {
      return;
    }
    let auxBarVisible = this._layoutService.isVisible(Parts.AUXILIARYBAR_PART);
    switch (target) {
      case 0 /* Hidden */:
        if (this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
          this._layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
        }
        this._hiddenByBrowser = false;
        return;
      case 1 /* BrowserHidden */:
        if (this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
          this._layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
        }
        this._hiddenByBrowser = true;
        return;
      case 2 /* Changes */:
        if (!auxBarVisible && this._hiddenByBrowser) {
          this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
          auxBarVisible = true;
        }
        if (!auxBarVisible) {
          return;
        }
        await this._viewsService.openViewContainer(CHANGES_VIEW_CONTAINER_ID, false);
        this._hiddenByBrowser = false;
        return;
      case 3 /* ChangesForced */:
        await this._syncForcedDetailTarget(CHANGES_VIEW_CONTAINER_ID, auxBarVisible);
        return;
      case 4 /* Files */:
        if (!auxBarVisible && this._hiddenByBrowser) {
          this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
          auxBarVisible = true;
        }
        if (!auxBarVisible) {
          return;
        }
        await this._viewsService.openViewContainer(SESSIONS_FILES_CONTAINER_ID, false);
        this._hiddenByBrowser = false;
        return;
      case 5 /* FilesForced */:
        await this._syncForcedDetailTarget(SESSIONS_FILES_CONTAINER_ID, auxBarVisible);
        return;
      case 6 /* Preserve */:
        this._hiddenByBrowser = false;
        return;
    }
  }
  async _syncForcedDetailTarget(viewContainerId, auxBarVisible) {
    if (!auxBarVisible) {
      if (!this._hiddenByBrowser || !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow) || this._ctx.isRestoringSessionLayout) {
        return;
      }
      this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
    }
    await this._viewsService.openViewContainer(viewContainerId, false);
    this._hiddenByBrowser = false;
  }
  _isChangesEditor(editor) {
    if (editor instanceof DiffEditorInput || editor instanceof MultiDiffEditorInput) {
      return true;
    }
    const resource = editor.resource;
    return !!resource && this._sessionChangesService.getSessionResource(resource) !== void 0;
  }
  _isFileEditor(editor) {
    if (editor instanceof WebviewInput) {
      return MARKDOWN_EDITOR_VIEW_TYPES.has(editor.viewType) || MARKDOWN_EDITOR_VIEW_TYPES.has(editor.providerId ?? "");
    }
    return editor instanceof EmptyFileEditorInput || editor instanceof FileEditorInput;
  }
};
SinglePaneDetailPanelStrategy = __decorateClass([
  __decorateParam(1, IAgentWorkbenchLayoutService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IViewsService),
  __decorateParam(6, ISessionChangesService),
  __decorateParam(7, IContextKeyService)
], SinglePaneDetailPanelStrategy);
export {
  SinglePaneDetailPanelStrategy
};
