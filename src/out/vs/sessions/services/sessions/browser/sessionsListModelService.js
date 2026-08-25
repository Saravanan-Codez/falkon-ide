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
import { Emitter } from "../../../../base/common/event.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { themeColorFromId } from "../../../../base/common/themables.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { SessionStatus } from "../common/session.js";
import { ISessionsManagementService } from "../common/sessionsManagement.js";
var SessionListModelChangeKind = /* @__PURE__ */ ((SessionListModelChangeKind2) => {
  SessionListModelChangeKind2["Pinned"] = "pinned";
  SessionListModelChangeKind2["Sort"] = "sort";
  return SessionListModelChangeKind2;
})(SessionListModelChangeKind || {});
const ISessionsListModelService = createDecorator("sessionsListModelService");
let SessionsListModelService = class extends Disposable {
  constructor(storageService, sessionsManagementService) {
    super();
    this.storageService = storageService;
    this.sessionsManagementService = sessionsManagementService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._pinnedSessionIds = this.loadSet(SessionsListModelService.PINNED_SESSIONS_KEY);
    this._sortOverrides = this.loadSortOverrides();
    const legacyRead = this.loadSet(SessionsListModelService.LEGACY_READ_SESSIONS_KEY);
    this._legacyReadSessionIds = legacyRead.size > 0 ? legacyRead : void 0;
    this._migratedReadSessionIds = this.loadSet(SessionsListModelService.READ_MIGRATION_DONE_KEY);
    this._register(this.sessionsManagementService.onDidDeleteSession((session) => {
      this.deleteSession(session);
    }));
  }
  static {
    this.PINNED_SESSIONS_KEY = "sessionsListControl.pinnedSessions";
  }
  static {
    this.SORT_OVERRIDES_KEY = "sessionsListControl.sortOverrides";
  }
  static {
    this.LEGACY_READ_SESSIONS_KEY = "sessionsListControl.readSessions";
  }
  static {
    this.READ_MIGRATION_DONE_KEY = "sessionsListControl.readMigrationDone";
  }
  static {
    this.UNREAD_DEFAULT_CUTOFF = /* @__PURE__ */ new Date("2026-05-12T00:00:00.000Z");
  }
  // -- Legacy read-state migration --
  // TODO@sandy081 Remove after 2026-10-14. Additive only: never marks unread
  // (the provider already defaults to unread); the one-shot guard stops a later
  // legitimate unread from being re-flipped to read on refresh.
  migrateLegacyReadState(session) {
    const sessionId = session.sessionId;
    if (this._migratedReadSessionIds.has(sessionId)) {
      return;
    }
    const wasRead = (this._legacyReadSessionIds?.has(sessionId) ?? false) || session.updatedAt.get() < SessionsListModelService.UNREAD_DEFAULT_CUTOFF;
    if (!wasRead) {
      return;
    }
    this.sessionsManagementService.markRead(session);
    this._migratedReadSessionIds.add(sessionId);
    this.saveSet(SessionsListModelService.READ_MIGRATION_DONE_KEY, this._migratedReadSessionIds);
  }
  // -- Pinning --
  pinSession(session) {
    if (this._pinnedSessionIds.has(session.sessionId)) {
      return;
    }
    this._pinnedSessionIds.add(session.sessionId);
    this.saveSet(SessionsListModelService.PINNED_SESSIONS_KEY, this._pinnedSessionIds);
    this._onDidChange.fire({ changes: [{ sessionId: session.sessionId, kind: "pinned" /* Pinned */ }] });
  }
  unpinSession(session) {
    if (!this._pinnedSessionIds.has(session.sessionId)) {
      return;
    }
    this._pinnedSessionIds.delete(session.sessionId);
    this.saveSet(SessionsListModelService.PINNED_SESSIONS_KEY, this._pinnedSessionIds);
    this._onDidChange.fire({ changes: [{ sessionId: session.sessionId, kind: "pinned" /* Pinned */ }] });
  }
  unpinSessions(sessions) {
    const changed = [];
    for (const session of sessions) {
      if (this._pinnedSessionIds.delete(session.sessionId)) {
        changed.push({ sessionId: session.sessionId, kind: "pinned" /* Pinned */ });
      }
    }
    if (changed.length > 0) {
      this.saveSet(SessionsListModelService.PINNED_SESSIONS_KEY, this._pinnedSessionIds);
      this._onDidChange.fire({ changes: changed });
    }
  }
  isSessionPinned(session) {
    return this._pinnedSessionIds.has(session.sessionId);
  }
  // -- Manual sort order --
  getNaturalSortKey(session, mode) {
    return mode === "updated" ? session.updatedAt.get().getTime() : session.createdAt.getTime();
  }
  getSortKey(session, mode) {
    const override = this._sortOverrides[mode].get(session.sessionId);
    return override ?? this.getNaturalSortKey(session, mode);
  }
  hasSortOverride(sessionId, mode) {
    return this._sortOverrides[mode].has(sessionId);
  }
  applySortChanges(mode, set, clear) {
    const map = this._sortOverrides[mode];
    const changes = [];
    for (const sessionId of clear) {
      if (map.delete(sessionId)) {
        changes.push({ sessionId, kind: "sort" /* Sort */ });
      }
    }
    for (const [sessionId, value] of set) {
      if (map.get(sessionId) !== value) {
        map.set(sessionId, value);
        changes.push({ sessionId, kind: "sort" /* Sort */ });
      }
    }
    if (changes.length > 0) {
      this.saveSortOverrides();
      this._onDidChange.fire({ changes });
    }
  }
  // -- Status icon --
  getStatusIcon(status, isRead, isArchived, completedStateIcon) {
    switch (status) {
      case SessionStatus.InProgress:
        return { ...Codicon.sessionInProgress, color: themeColorFromId("textLink.foreground") };
      case SessionStatus.NeedsInput:
        return { ...Codicon.circleFilled, color: themeColorFromId("list.warningForeground") };
      case SessionStatus.Error:
        return { ...Codicon.error, color: themeColorFromId("errorForeground") };
      default:
        if (isArchived) {
          return { ...Codicon.passFilled, color: themeColorFromId("agentSessionReadIndicator.foreground") };
        }
        if (!isRead) {
          return { ...Codicon.circleFilled, color: themeColorFromId("textLink.foreground") };
        }
        if (completedStateIcon) {
          return completedStateIcon;
        }
        return { ...Codicon.circleSmallFilled, color: themeColorFromId("agentSessionReadIndicator.foreground") };
    }
  }
  // -- Cleanup --
  deleteSession(session) {
    const changes = [];
    if (this._pinnedSessionIds.delete(session.sessionId)) {
      this.saveSet(SessionsListModelService.PINNED_SESSIONS_KEY, this._pinnedSessionIds);
      changes.push({ sessionId: session.sessionId, kind: "pinned" /* Pinned */ });
    }
    let sortChanged = false;
    if (this._sortOverrides.created.delete(session.sessionId)) {
      sortChanged = true;
    }
    if (this._sortOverrides.updated.delete(session.sessionId)) {
      sortChanged = true;
    }
    if (sortChanged) {
      this.saveSortOverrides();
      changes.push({ sessionId: session.sessionId, kind: "sort" /* Sort */ });
    }
    if (changes.length > 0) {
      this._onDidChange.fire({ changes });
    }
  }
  // -- Storage helpers --
  loadSet(key) {
    const raw = this.storageService.get(key, StorageScope.PROFILE);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      } catch {
      }
    }
    return /* @__PURE__ */ new Set();
  }
  saveSet(key, set) {
    if (set.size === 0) {
      this.storageService.remove(key, StorageScope.PROFILE);
    } else {
      this.storageService.store(key, JSON.stringify([...set]), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  loadSortOverrides() {
    const result = { created: /* @__PURE__ */ new Map(), updated: /* @__PURE__ */ new Map() };
    const raw = this.storageService.get(SessionsListModelService.SORT_OVERRIDES_KEY, StorageScope.PROFILE);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        for (const mode of ["created", "updated"]) {
          const entries = parsed[mode];
          if (entries) {
            for (const [sessionId, value] of Object.entries(entries)) {
              if (typeof value === "number") {
                result[mode].set(sessionId, value);
              }
            }
          }
        }
      } catch {
      }
    }
    return result;
  }
  saveSortOverrides() {
    if (this._sortOverrides.created.size === 0 && this._sortOverrides.updated.size === 0) {
      this.storageService.remove(SessionsListModelService.SORT_OVERRIDES_KEY, StorageScope.PROFILE);
      return;
    }
    const serialized = {
      created: Object.fromEntries(this._sortOverrides.created),
      updated: Object.fromEntries(this._sortOverrides.updated)
    };
    this.storageService.store(SessionsListModelService.SORT_OVERRIDES_KEY, JSON.stringify(serialized), StorageScope.PROFILE, StorageTarget.USER);
  }
};
SessionsListModelService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ISessionsManagementService)
], SessionsListModelService);
registerSingleton(ISessionsListModelService, SessionsListModelService, InstantiationType.Delayed);
export {
  ISessionsListModelService,
  SessionListModelChangeKind,
  SessionsListModelService
};
