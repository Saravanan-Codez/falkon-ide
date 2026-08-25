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
import { Event } from "../../../../../base/common/event.js";
import { DisposableMap, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, observableFromEvent } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IInlineChatSessionService } from "../../../inlineChat/browser/inlineChatSessionService.js";
import { IChatEditingService, ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { IChatService } from "../../common/chatService/chatService.js";
const ctxIsGlobalEditingSession = new RawContextKey("chatEdits.isGlobalEditingSession", void 0, localize("chat.ctxEditSessionIsGlobal", "The current editor is part of the global edit session"));
const ctxHasEditorModification = new RawContextKey("chatEdits.hasEditorModifications", void 0, localize("chat.hasEditorModifications", "The current editor contains chat modifications"));
const ctxIsCurrentlyBeingModified = new RawContextKey("chatEdits.isCurrentlyBeingModified", void 0, localize("chat.isCurrentlyBeingModified", "The current editor is currently being modified"));
const ctxReviewModeEnabled = new RawContextKey("chatEdits.isReviewModeEnabled", true, localize("chat.ctxReviewModeEnabled", "Review mode for chat changes is enabled"));
const ctxHasRequestInProgress = new RawContextKey("chatEdits.isRequestInProgress", false, localize("chat.ctxHasRequestInProgress", "The current editor shows a file from an edit session which is still in progress"));
const ctxRequestCount = new RawContextKey("chatEdits.requestCount", 0, localize("chatEdits.requestCount", "The number of turns the editing session in this editor has"));
const ctxCursorInChangeRange = new RawContextKey("chatEdits.cursorInChangeRange", false, localize("chat.ctxCursorInChangeRange", "The cursor is inside a change range made by chat editing."));
let ChatEditingEditorContextKeys = class {
  constructor(instaService, editorGroupsService) {
    this._store = new DisposableStore();
    const editorGroupCtx = this._store.add(new DisposableMap());
    const editorGroups = observableFromEvent(
      this,
      Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup),
      () => editorGroupsService.groups
    );
    this._store.add(autorun((r) => {
      const toDispose = new Set(editorGroupCtx.keys());
      for (const group of editorGroups.read(r)) {
        toDispose.delete(group);
        if (editorGroupCtx.has(group)) {
          continue;
        }
        editorGroupCtx.set(group, instaService.createInstance(ContextKeyGroup, group));
      }
      for (const item of toDispose) {
        editorGroupCtx.deleteAndDispose(item);
      }
    }));
  }
  static {
    this.ID = "chat.edits.editorContextKeys";
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingEditorContextKeys = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IEditorGroupsService)
], ChatEditingEditorContextKeys);
let ContextKeyGroup = class {
  constructor(group, inlineChatSessionService, chatEditingService, chatService) {
    this._store = new DisposableStore();
    this._ctxIsGlobalEditingSession = ctxIsGlobalEditingSession.bindTo(group.scopedContextKeyService);
    this._ctxHasEditorModification = ctxHasEditorModification.bindTo(group.scopedContextKeyService);
    this._ctxIsCurrentlyBeingModified = ctxIsCurrentlyBeingModified.bindTo(group.scopedContextKeyService);
    this._ctxHasRequestInProgress = ctxHasRequestInProgress.bindTo(group.scopedContextKeyService);
    this._ctxReviewModeEnabled = ctxReviewModeEnabled.bindTo(group.scopedContextKeyService);
    this._ctxRequestCount = ctxRequestCount.bindTo(group.scopedContextKeyService);
    const editorObs = observableFromEvent(this, group.onDidModelChange, () => group.activeEditor);
    const tupleObs = derived((r) => {
      const editor = editorObs.read(r);
      const uri = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
      if (!uri) {
        this._reset();
        return;
      }
      return new ObservableEditorSession(uri, chatEditingService, inlineChatSessionService).value.read(r);
    });
    this._store.add(autorun((r) => {
      const tuple = tupleObs.read(r);
      if (!tuple) {
        this._reset();
        return;
      }
      const { session, entry } = tuple;
      const chatModel = chatService.getSession(session.chatSessionResource);
      this._ctxHasEditorModification.set(entry?.state.read(r) === ModifiedFileEntryState.Modified);
      this._ctxIsGlobalEditingSession.set(session.isGlobalEditingSession);
      this._ctxReviewModeEnabled.set(entry ? entry.reviewMode.read(r) : false);
      this._ctxHasRequestInProgress.set(chatModel?.requestInProgress.read(r) ?? false);
      this._ctxIsCurrentlyBeingModified.set(!!entry?.isCurrentlyBeingModifiedBy.read(r));
      const requestCount = chatModel ? observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().length) : constObservable(0);
      this._ctxRequestCount.set(requestCount.read(r));
    }));
  }
  _reset() {
    this._ctxIsGlobalEditingSession.reset();
    this._ctxHasEditorModification.reset();
    this._ctxHasRequestInProgress.reset();
    this._ctxReviewModeEnabled.reset();
    this._ctxRequestCount.reset();
  }
  dispose() {
    this._store.dispose();
    this._reset();
  }
};
ContextKeyGroup = __decorateClass([
  __decorateParam(1, IInlineChatSessionService),
  __decorateParam(2, IChatEditingService),
  __decorateParam(3, IChatService)
], ContextKeyGroup);
let ObservableEditorSession = class {
  constructor(uri, chatEditingService, inlineChatService) {
    const inlineSessionObs = observableFromEvent(this, inlineChatService.onDidChangeSessions, () => inlineChatService.getSessionByTextModel(uri));
    const sessionObs = chatEditingService.editingSessionsObs.map((value, r) => {
      for (const session of value) {
        const entry = session.readEntry(uri, r);
        if (entry) {
          return { session, entry, isInlineChat: false };
        }
      }
      return void 0;
    });
    this.value = derived((r) => {
      const inlineSession = inlineSessionObs.read(r);
      if (inlineSession) {
        return { session: inlineSession.editingSession, entry: inlineSession.editingSession.readEntry(uri, r), isInlineChat: true };
      }
      return sessionObs.read(r);
    });
  }
};
ObservableEditorSession = __decorateClass([
  __decorateParam(1, IChatEditingService),
  __decorateParam(2, IInlineChatSessionService)
], ObservableEditorSession);
export {
  ChatEditingEditorContextKeys,
  ObservableEditorSession,
  ctxCursorInChangeRange,
  ctxHasEditorModification,
  ctxHasRequestInProgress,
  ctxIsCurrentlyBeingModified,
  ctxIsGlobalEditingSession,
  ctxRequestCount,
  ctxReviewModeEnabled
};
