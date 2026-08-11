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
import { Event } from "../../../../../base/common/event.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { EditorActivation } from "../../../../../platform/editor/common/editor.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../../workbench/common/editor.js";
import { IEditorGroupsService } from "../../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../../workbench/services/editor/common/editorService.js";
import { Parts } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { IAgentWorkbenchLayoutService } from "../../../../browser/workbench.js";
import { SinglePaneChangesTabAvailableContext, SinglePaneChangesTabMissingContext, SinglePaneFilesTabAvailableContext, SinglePaneFilesTabMissingContext } from "../../../../common/contextkeys.js";
import { DockedEditorInput } from "../../../../common/dockedEditorInput.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ISessionChangesService } from "../../../changes/browser/sessionChangesService.js";
import { IChangesViewService } from "../../../changes/common/changesViewService.js";
import { EmptyFileEditorInput } from "../../../editor/browser/emptyFileEditorInput.js";
import { SinglePaneLayoutStrategy } from "./singlePaneLayoutStrategy.js";
const CHANGES_TAB_OPTIONS = { pinned: true, index: 0, inactive: true, preserveFocus: true, activation: EditorActivation.PRESERVE, isExplicit: false };
const CHANGES_TAB_ACTIVE_OPTIONS = { pinned: true, index: 0, preserveFocus: true, isExplicit: false };
const FILES_TAB_OPTIONS = { pinned: true, inactive: true, preserveFocus: true, activation: EditorActivation.PRESERVE, isExplicit: false };
function mergeTriggers(a, b) {
  return {
    openDefaultsIfEmpty: a.openDefaultsIfEmpty || b.openDefaultsIfEmpty,
    ensureChanges: a.ensureChanges || b.ensureChanges,
    ensureChangesActive: a.ensureChangesActive || b.ensureChangesActive
  };
}
let SinglePaneManagedTabsStrategy = class extends SinglePaneLayoutStrategy {
  constructor(ctx, _coordinator, _layoutService, _sessionsService, _editorService, _editorGroupsService, _sessionChangesService, _changesViewService, contextKeyService, _instantiationService) {
    super(ctx);
    this._coordinator = _coordinator;
    this._layoutService = _layoutService;
    this._sessionsService = _sessionsService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._sessionChangesService = _sessionChangesService;
    this._changesViewService = _changesViewService;
    this._instantiationService = _instantiationService;
    this._generation = 0;
    this._changesTabMissingContext = SinglePaneChangesTabMissingContext.bindTo(contextKeyService);
    this._filesTabMissingContext = SinglePaneFilesTabMissingContext.bindTo(contextKeyService);
    this._changesTabAvailableContext = SinglePaneChangesTabAvailableContext.bindTo(contextKeyService);
    this._filesTabAvailableContext = SinglePaneFilesTabAvailableContext.bindTo(contextKeyService);
    let previousIsCreated;
    let previousSessionKey;
    let previousWantsChangesTab = false;
    let previousSession;
    let changesActivationPendingForSession;
    this._register(autorun((reader) => {
      const session = this._sessionsService.activeSession.read(reader);
      const isCreated = session ? session.isCreated.read(reader) : false;
      const sessionKey = session?.resource.toString();
      const target = this._readTarget(reader);
      const isSubmit = previousIsCreated === false && isCreated && (previousSession === session || previousSession?.isCreated.read(void 0) === true);
      if (isSubmit) {
        changesActivationPendingForSession = sessionKey;
      } else if (sessionKey !== previousSessionKey) {
        changesActivationPendingForSession = void 0;
      }
      const hasChanges = (session?.changes.read(reader).length ?? 0) > 0;
      const ensureChangesActive = changesActivationPendingForSession === sessionKey && hasChanges;
      if (ensureChangesActive) {
        changesActivationPendingForSession = void 0;
      }
      const ensureChanges = !isCreated && target.wantsChangesTab && (sessionKey !== previousSessionKey || !previousWantsChangesTab);
      previousIsCreated = session ? isCreated : void 0;
      previousSession = session;
      previousSessionKey = sessionKey;
      previousWantsChangesTab = target.wantsChangesTab;
      this._queueReconcile(target, { openDefaultsIfEmpty: true, ensureChanges, ensureChangesActive });
    }));
    this._register(this._layoutService.onDidRevealSidePane(() => {
      this._queueReconcile(this._readTarget(void 0), { openDefaultsIfEmpty: true });
    }));
    const partVisibilityChangedSignal = observableSignalFromEvent(this, this._layoutService.onDidChangePartVisibility);
    const editorsChangedSignal = observableSignalFromEvent(this, Event.any(this._editorService.onDidActiveEditorChange, this._editorService.onDidEditorsChange));
    this._register(autorun((reader) => {
      partVisibilityChangedSignal.read(reader);
      editorsChangedSignal.read(reader);
      this._queueReconcile(this._readTarget(void 0), {});
    }));
    this._register(this._ctx.onDidEndSessionLayoutRestore(() => {
      const session = this._sessionsService.activeSession.get();
      const target = this._readTarget(void 0);
      const ensureChanges = target.wantsChangesTab && session?.isCreated.get() === false;
      this._queueReconcile(target, { openDefaultsIfEmpty: true, ensureChanges });
    }));
    this._register(this._editorService.onWillOpenEditor((e) => {
      if (this._ctx.isRestoringSessionLayout || !this._isWorkspaceFileEditor(e.editor)) {
        return;
      }
      const group = this._editorGroupsService.mainPart.getGroup(e.groupId);
      if (!group || group.contains(e.editor)) {
        return;
      }
      void this._coordinator.sequencer.queue(() => this._removeFilesTab(this._editorGroupsService.mainPart.activeGroup)).catch(onUnexpectedError);
    }));
  }
  // --- Trigger plumbing -------------------------------------------------
  _readTarget(reader) {
    const read = (obs) => reader ? obs.read(reader) : obs.get();
    const session = read(this._sessionsService.activeSession);
    const isQuickChat = session?.isQuickChat ? read(session.isQuickChat) : false;
    const workspace = session ? read(session.workspace) : void 0;
    if (!session || isQuickChat || !workspace) {
      return { changesSessionResource: void 0, workspace: void 0, wantsChangesTab: false, wantsFilesTab: false };
    }
    return { changesSessionResource: session.resource, workspace, wantsChangesTab: true, wantsFilesTab: true };
  }
  _queueReconcile(target, trigger) {
    const sessionKey = this._sessionsService.activeSession.get()?.resource.toString();
    const mergedTrigger = this._pending && this._pending.sessionKey === sessionKey ? mergeTriggers(this._pending.trigger, trigger) : trigger;
    this._pending = { sessionKey, target, trigger: mergedTrigger };
    const generation = ++this._generation;
    void this._coordinator.sequencer.queue(() => this._reconcile(generation)).catch(onUnexpectedError);
  }
  // --- Reconcile --------------------------------------------------------
  async _reconcile(generation) {
    if (generation !== this._generation || !this._pending) {
      return;
    }
    const pending = this._pending;
    this._pending = void 0;
    try {
      await this._reconcileCore(pending.target, pending.trigger, generation);
    } finally {
      const successor = this._pending;
      if (generation !== this._generation && successor && successor.sessionKey === pending.sessionKey) {
        this._pending = { ...successor, trigger: mergeTriggers(successor.trigger, pending.trigger) };
      }
    }
  }
  async _reconcileCore(target, trigger, generation) {
    const group = this._editorGroupsService.mainPart.activeGroup;
    this._resetCollapsedEditorsOnSessionChange();
    const changesResource = target.changesSessionResource ? this._sessionChangesService.getChangesEditorResource(target.changesSessionResource) : void 0;
    const suppression = this._layoutService.suppressEditorPartAutoVisibility();
    try {
      await this._closeForeignChangesEditors(group, changesResource);
      if (generation !== this._generation) {
        return;
      }
      this._updateFilesEditors(group, target.workspace);
      const openIntoEmpty = !!trigger.openDefaultsIfEmpty && group.editors.length === 0;
      const changesPresent = !!changesResource && !!this._findChangesEditor(group, changesResource);
      const filesPresent = group.editors.some((editor) => editor instanceof EmptyFileEditorInput);
      const activeChangesResource = this._editorService.activeEditor && this._coordinator.getChangesEditorResource(this._editorService.activeEditor);
      const activateChanges = !!trigger.ensureChangesActive && !!changesResource && (!activeChangesResource || !isEqual(activeChangesResource, changesResource));
      const ensureAllInputs = this._layoutService.isVisible(Parts.AUXILIARYBAR_PART) && !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow);
      const openChanges = target.wantsChangesTab && !!changesResource && (activateChanges || !changesPresent && (openIntoEmpty || ensureAllInputs || trigger.ensureChanges));
      const openFiles = target.wantsFilesTab && !filesPresent && (openIntoEmpty || ensureAllInputs);
      const isCreated = this._sessionsService.activeSession.get()?.isCreated.get() ?? false;
      const openFilesFirst = openChanges && openFiles && !isCreated && group.editors.length === 0;
      if (openFilesFirst) {
        await this._openFilesTab(group, target.workspace);
        if (generation !== this._generation) {
          return;
        }
      }
      if (openChanges && changesResource) {
        if (!await this._openChangesTab(target.changesSessionResource, changesResource, group, generation, activateChanges)) {
          return;
        }
      }
      if (openFiles && !openFilesFirst) {
        await this._openFilesTab(group, target.workspace);
        if (generation !== this._generation) {
          return;
        }
      }
    } finally {
      suppression.dispose();
      if (generation === this._generation) {
        this._updateAddTabContexts(target);
      }
    }
  }
  /** On a session change, drop editors captured while the previous session's editor area was hidden so they are not reopened here. */
  _resetCollapsedEditorsOnSessionChange() {
    const sessionKey = this._sessionsService.activeSession.get()?.resource.toString();
    if (sessionKey !== this._lastSyncedSessionKey) {
      this._coordinator.collapsedEditors = void 0;
      this._lastSyncedSessionKey = sessionKey;
    }
  }
  // --- Tab operations ---------------------------------------------------
  /** Opens the Changes editor pinned first (active on submit). Returns `false` if a newer reconcile superseded this one mid-open. */
  async _openChangesTab(sessionResource, changesResource, group, generation, active) {
    this._changesViewService.setChangesetId(void 0);
    await this._sessionChangesService.openChangesEditor(sessionResource, active ? CHANGES_TAB_ACTIVE_OPTIONS : CHANGES_TAB_OPTIONS, group);
    if (generation !== this._generation) {
      return false;
    }
    const changesEditor = this._findChangesEditor(group, changesResource);
    if (changesEditor) {
      this._pinFirst(group, changesEditor);
    }
    return true;
  }
  async _openFilesTab(group, workspace) {
    const suppression = this._layoutService.suppressEditorPartAutoVisibility();
    try {
      await this._editorService.openEditor(this._instantiationService.createInstance(EmptyFileEditorInput, workspace), FILES_TAB_OPTIONS, group);
    } finally {
      suppression.dispose();
    }
  }
  async _removeFilesTab(group) {
    const placeholder = group.editors.find((editor) => editor instanceof EmptyFileEditorInput);
    if (placeholder) {
      await this._closeManagedEditors(group, [placeholder]);
    }
  }
  async _closeForeignChangesEditors(group, activeChangesResource) {
    const foreign = group.editors.filter((editor) => {
      const resource = this._coordinator.getChangesEditorResource(editor);
      return resource && (!activeChangesResource || !isEqual(resource, activeChangesResource));
    });
    if (foreign.length > 0) {
      await this._closeManagedEditors(group, foreign);
    }
  }
  _updateFilesEditors(group, workspace) {
    for (const editor of group.editors) {
      if (editor instanceof EmptyFileEditorInput) {
        editor.setWorkspace(workspace);
      }
    }
  }
  /** Closes editors we own, preserving focus so a transient close never steals it. */
  async _closeManagedEditors(group, editors) {
    await this._editorService.closeEditors(editors.map((editor) => ({ groupId: group.id, editor })), { preserveFocus: true, force: true });
  }
  _pinFirst(group, editor) {
    if (!group.isPinned(editor)) {
      group.pinEditor(editor);
    }
    if (group.getIndexOfEditor(editor) !== 0) {
      group.moveEditor(editor, group, CHANGES_TAB_OPTIONS);
    }
  }
  // --- Queries ----------------------------------------------------------
  _findChangesEditor(group, changesResource) {
    return group.editors.find((editor) => {
      const resource = this._coordinator.getChangesEditorResource(editor);
      return !!resource && isEqual(resource, changesResource);
    });
  }
  /** Whether the editor shows a workspace file (a file-system resource), excluding managed docked placeholders. */
  _isWorkspaceFileEditor(editor) {
    if (editor instanceof DockedEditorInput) {
      return false;
    }
    const resource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    return resource?.scheme === Schemas.file || resource?.scheme === Schemas.vscodeRemote;
  }
  /** Offer the `+` "Changes"/"Files" entries when the session supports them but their tabs are closed. */
  _updateAddTabContexts(target) {
    const group = this._editorGroupsService.mainPart.activeGroup;
    const changesPresent = group.editors.some((editor) => this._coordinator.getChangesEditorResource(editor) !== void 0);
    const filesPresent = group.editors.some((editor) => editor instanceof EmptyFileEditorInput);
    this._changesTabAvailableContext.set(target.wantsChangesTab);
    this._filesTabAvailableContext.set(target.wantsFilesTab);
    this._changesTabMissingContext.set(target.wantsChangesTab && !changesPresent);
    this._filesTabMissingContext.set(target.wantsFilesTab && !filesPresent);
  }
};
SinglePaneManagedTabsStrategy = __decorateClass([
  __decorateParam(2, IAgentWorkbenchLayoutService),
  __decorateParam(3, ISessionsService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IEditorGroupsService),
  __decorateParam(6, ISessionChangesService),
  __decorateParam(7, IChangesViewService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IInstantiationService)
], SinglePaneManagedTabsStrategy);
export {
  SinglePaneManagedTabsStrategy
};
