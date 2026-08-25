import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../base/common/observable.js";
import { CanGoBackContext, CanGoForwardContext } from "../../../common/contextkeys.js";
import { SessionStatus } from "../common/session.js";
function entryKey(sessionResource, chatResource) {
  return `${sessionResource.toString()}::${chatResource?.toString() ?? ""}`;
}
class SessionsNavigation extends Disposable {
  constructor(_opener, _activeSession, _sessionsManagementService, _recency, contextKeyService, _logService) {
    super();
    this._opener = _opener;
    this._activeSession = _activeSession;
    this._sessionsManagementService = _sessionsManagementService;
    this._recency = _recency;
    this._logService = _logService;
    /** Identity of the entry the cursor currently points at. */
    this._currentKey = observableValue(this, void 0);
    /** Guard: true while we are performing a back/forward navigation. */
    this._navigating = false;
    /**
     * True when the user has explicitly navigated to the new-session view after
     * having been on a real session. Enables going back to the last real session
     * without storing a new-session view entry in the history.
     */
    this._beyondHistory = observableValue(this, false);
    this._canGoBack = derived(this, (reader) => {
      const idx = this._indexOfCurrent(reader);
      const entries = this._recency.entries;
      const beyond = this._beyondHistory.read(reader);
      return idx >= 0 && idx < entries.length - 1 || beyond && entries.length > 0;
    });
    this._canGoForward = derived(this, (reader) => {
      if (this._beyondHistory.read(reader)) {
        return false;
      }
      return this._indexOfCurrent(reader) > 0;
    });
    this._canGoBackCtx = CanGoBackContext.bindTo(contextKeyService);
    this._canGoForwardCtx = CanGoForwardContext.bindTo(contextKeyService);
    this._register(autorun((reader) => {
      const activeSession = this._activeSession.read(reader);
      const activeChat = activeSession?.activeChat.read(reader);
      const sessionStatus = activeSession?.status.read(reader);
      const chatStatus = activeChat?.status.read(reader);
      if (this._navigating) {
        return;
      }
      if (!activeSession || sessionStatus === SessionStatus.Untitled) {
        if (this._recency.entries.length > 0) {
          this._beyondHistory.set(true, void 0);
        }
        return;
      }
      const chatResource = activeChat && chatStatus !== SessionStatus.Untitled ? activeChat.resource : void 0;
      this._beyondHistory.set(false, void 0);
      this._recency.markOpened(activeSession.resource, chatResource);
      this._currentKey.set(entryKey(activeSession.resource, chatResource), void 0);
    }));
    this._register(autorun((reader) => {
      this._recency.version.read(reader);
      const key = this._currentKey.read(void 0);
      if (key !== void 0 && this._indexOf(key) < 0) {
        const front = this._recency.entries[0];
        this._currentKey.set(front ? entryKey(front.sessionResource, front.chatResource) : void 0, void 0);
      }
    }));
    this._register(autorun((reader) => {
      this._canGoBackCtx.set(this._canGoBack.read(reader));
      this._canGoForwardCtx.set(this._canGoForward.read(reader));
    }));
  }
  onDidRemoveSessions(e) {
    if (e.removed.length === 0) {
      return;
    }
    const removedUris = new Set(e.removed.map((s) => s.resource.toString()));
    this._recency.remove((entry) => removedUris.has(entry.sessionResource.toString()));
  }
  async goBack() {
    if (this._beyondHistory.get()) {
      this._beyondHistory.set(false, void 0);
      const idx2 = this._indexOfCurrent();
      await this._navigateTo(idx2 < 0 ? 0 : idx2);
      return;
    }
    const idx = this._indexOfCurrent();
    if (idx < 0 || idx >= this._recency.entries.length - 1) {
      return;
    }
    await this._navigateTo(idx + 1);
  }
  async goForward() {
    const idx = this._indexOfCurrent();
    if (idx <= 0) {
      return;
    }
    await this._navigateTo(idx - 1);
  }
  /** Index of the current cursor entry in the recency history, or -1. */
  _indexOfCurrent(reader) {
    const key = reader ? this._currentKey.read(reader) : this._currentKey.get();
    if (reader) {
      this._recency.version.read(reader);
    }
    if (key === void 0) {
      return -1;
    }
    return this._indexOf(key);
  }
  _indexOf(key) {
    return this._recency.entries.findIndex((e) => entryKey(e.sessionResource, e.chatResource) === key);
  }
  async _navigateTo(targetIdx) {
    const entry = this._recency.entries[targetIdx];
    if (!entry) {
      return;
    }
    this._logService.trace(`[SessionNavigation] navigating to idx=${targetIdx} session=${entry.sessionResource.toString()} chat=${entry.chatResource?.toString()}`);
    this._navigating = true;
    try {
      this._currentKey.set(entryKey(entry.sessionResource, entry.chatResource), void 0);
      const session = this._sessionsManagementService.getSession(entry.sessionResource);
      if (session) {
        if (entry.chatResource) {
          const chatExists = session.chats.get().some((c) => c.resource.toString() === entry.chatResource.toString());
          if (chatExists) {
            await this._opener.openChat(session, entry.chatResource);
          } else {
            await this._opener.openSession(entry.sessionResource);
          }
        } else {
          await this._opener.openSession(entry.sessionResource);
        }
      } else {
        const sessionUri = entry.sessionResource.toString();
        this._recency.remove((e) => e.sessionResource.toString() === sessionUri);
      }
    } finally {
      this._navigating = false;
    }
  }
}
export {
  SessionsNavigation
};
