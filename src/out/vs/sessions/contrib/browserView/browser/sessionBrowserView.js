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
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { IBrowserViewWorkbenchService } from "../../../../workbench/contrib/browserView/common/browserView.js";
import { BrowserEditorInput } from "../../../../workbench/contrib/browserView/common/browserEditorInput.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { runOnChange } from "../../../../base/common/observable.js";
let SessionBrowserViewController = class extends Disposable {
  constructor(_sessionManagementService, _sessionsService, _browserViewService, _editorService, _editorGroupsService) {
    super();
    this._sessionManagementService = _sessionManagementService;
    this._sessionsService = _sessionsService;
    this._browserViewService = _browserViewService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    /**
     * Tracks browser view inputs with their owning session. The
     * DisposableMap cleans up lifecycle listeners on deletion/disposal.
     */
    this._trackedInputs = this._register(new DisposableMap());
    this._register(this._editorService.onWillOpenEditor((e) => {
      if (e.editor instanceof BrowserEditorInput) {
        this._attachLifecycle(e.editor);
      }
    }));
    this._register(this._editorGroupsService.onDidAddGroup((group) => {
      for (const editor of group.editors) {
        if (editor instanceof BrowserEditorInput) {
          this._attachLifecycle(editor);
        }
      }
    }));
    const onDidChangeActiveSession = this._register(new Emitter());
    this._register(runOnChange(this._sessionsService.activeSession, () => onDidChangeActiveSession.fire()));
    this._register(this._browserViewService.registerContextualFilter({
      include: (input, context) => {
        const tracked = this._trackedInputs.get(input.id);
        const ownerId = input.model?.owner.sessionId ?? tracked?.session.resource.toString();
        if (!ownerId) {
          return true;
        }
        const owningSession = this._resolveOwningSession(ownerId) ?? tracked?.session;
        if (!owningSession) {
          return true;
        }
        const activeSession = context.activeSessionId ? this._resolveOwningSession(context.activeSessionId) : this._sessionsService.activeSession.read(void 0);
        return activeSession?.sessionId === owningSession.sessionId;
      },
      onDidChange: onDidChangeActiveSession.event
    }));
    this._register(this._browserViewService.registerOpenHandler({
      shouldOpenEditor: (_input, owner) => {
        if (!owner.sessionId) {
          return true;
        }
        const owningSession = this._resolveOwningSession(owner.sessionId);
        if (!owningSession) {
          return true;
        }
        const activeSession = this._sessionsService.activeSession.read(void 0);
        return owningSession.sessionId === activeSession?.sessionId;
      }
    }));
    this._register(this._sessionManagementService.onDidChangeSessions((e) => {
      if (e.removed.length === 0 || this._trackedInputs.size === 0) {
        return;
      }
      const removedSessionIds = new Set(e.removed.map((s) => s.resource.toString()));
      const known = this._browserViewService.getKnownBrowserViews();
      for (const [id, { session }] of this._trackedInputs) {
        if (removedSessionIds.has(session.resource.toString())) {
          const existingInput = known.get(id);
          if (existingInput instanceof BrowserEditorInput) {
            existingInput.dispose(true);
          }
        }
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.sessionBrowserViewController";
  }
  /**
   * Resolves a browser view owner id (the *chat* resource string the
   * browser tools stamp onto `IBrowserViewOwner.sessionId`) to the
   * `ISession` that owns it. A session's browsers can be opened from any
   * of its chats (main, peer, or subagent), so this looks up the owning
   * session across all chats rather than comparing against the session's
   * own resource directly.
   */
  _resolveOwningSession(ownerId) {
    let resource;
    try {
      resource = URI.parse(ownerId);
    } catch {
      return void 0;
    }
    return this._sessionManagementService.getSessionForChatResource(resource)?.session ?? this._sessionManagementService.getSession(resource);
  }
  _attachLifecycle(input) {
    if (this._trackedInputs.has(input.id)) {
      return;
    }
    const session = this._sessionsService.activeSession.read(void 0);
    if (!session) {
      return;
    }
    const store = new DisposableStore();
    this._trackedInputs.set(input.id, { session, dispose: () => store.dispose() });
    store.add(runOnChange(session.isArchived, (isArchived) => {
      if (isArchived) {
        input.dispose(true);
      }
    }));
    store.add(input.onBeforeDispose((e) => {
      const activeSession = this._sessionsService.activeSession.read(void 0);
      if (session.sessionId !== activeSession?.sessionId) {
        e.veto();
      }
    }));
    store.add(input.onWillDispose(() => {
      store.dispose();
      this._trackedInputs.deleteAndDispose(input.id);
    }));
  }
};
SessionBrowserViewController = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, IBrowserViewWorkbenchService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService)
], SessionBrowserViewController);
export {
  SessionBrowserViewController
};
