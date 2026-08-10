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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ISessionsManagementService } from "../common/sessionsManagement.js";
const ISessionGroupsService = createDecorator("sessionGroupsService");
let SessionGroupsService = class extends Disposable {
  constructor(storageService, sessionsManagementService) {
    super();
    this.storageService = storageService;
    this.sessionsManagementService = sessionsManagementService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._groups = /* @__PURE__ */ new Map();
    /** sessionId -> groupId */
    this._membership = /* @__PURE__ */ new Map();
    /**
     * Sends in flight: draft (or, after graduation, committed) sessionId ->
     * groupId. A grouped send is locked here the moment it is dispatched, so a
     * later intent or a failed/concurrent send can never rebind it. Consumed
     * when the session is started.
     */
    this._inFlightSessionGroups = /* @__PURE__ */ new Map();
    this.load();
    const archivedMembershipChanged = /* @__PURE__ */ new Set();
    this.removeArchivedMembership(this.sessionsManagementService.getSessions(), archivedMembershipChanged);
    if (archivedMembershipChanged.size > 0) {
      this.save();
    }
    this._register(this.sessionsManagementService.onDidChangeSessions((e) => {
      for (const session of e.removed) {
        this._inFlightSessionGroups.delete(session.sessionId);
      }
      const changed = /* @__PURE__ */ new Set();
      this.removeArchivedMembership(e.added, changed);
      this.removeArchivedMembership(e.changed, changed);
      if (changed.size > 0) {
        this.save();
        this._onDidChange.fire({ groupsChanged: false, membershipChanged: changed });
      }
    }));
    this._register(this.sessionsManagementService.onDidDeleteSession((session) => {
      this.removeFromGroup(session.sessionId);
    }));
    this._register(this.sessionsManagementService.onDidArchiveSession((session) => {
      this.removeFromGroup(session.sessionId);
    }));
    this._register(this.sessionsManagementService.onWillSendRequest((session) => {
      if (this._pendingNewSessionGroupId === void 0) {
        return;
      }
      this._inFlightSessionGroups.set(session.sessionId, this._pendingNewSessionGroupId);
      this._pendingNewSessionGroupId = void 0;
    }));
    this._register(this.sessionsManagementService.onDidReplaceSession(({ from, to }) => {
      if (from.sessionId === to.sessionId) {
        return;
      }
      const groupId = this._inFlightSessionGroups.get(from.sessionId);
      if (groupId !== void 0) {
        this._inFlightSessionGroups.delete(from.sessionId);
        this._inFlightSessionGroups.set(to.sessionId, groupId);
      }
    }));
    this._register(this.sessionsManagementService.onDidStartSession((session) => {
      const groupId = this._inFlightSessionGroups.get(session.sessionId);
      if (groupId === void 0) {
        return;
      }
      this._inFlightSessionGroups.delete(session.sessionId);
      if (this._groups.has(groupId)) {
        this.addToGroup(session.sessionId, groupId);
      }
    }));
    this._register(this.sessionsManagementService.onDidDiscardNewSession(() => {
      this._pendingNewSessionGroupId = void 0;
    }));
  }
  static {
    this.STORAGE_KEY = "sessionsListControl.groups";
  }
  getGroups() {
    return this.sortGroups([...this._groups.values()]);
  }
  getGroup(groupId) {
    return this._groups.get(groupId);
  }
  createGroup(name, memberSessionIds) {
    const group = { id: generateUuid(), name, createdAt: Date.now() };
    this._groups.set(group.id, group);
    const membershipChanged = /* @__PURE__ */ new Set();
    if (memberSessionIds) {
      for (const sessionId of memberSessionIds) {
        this.setMembership(sessionId, group.id, membershipChanged);
      }
    }
    this.save();
    this._onDidChange.fire({ groupsChanged: true, membershipChanged });
    return group;
  }
  renameGroup(groupId, name) {
    const group = this._groups.get(groupId);
    if (!group || group.name === name) {
      return;
    }
    this._groups.set(groupId, { ...group, name });
    this.save();
    this._onDidChange.fire({ groupsChanged: true, membershipChanged: /* @__PURE__ */ new Set() });
  }
  deleteGroup(groupId) {
    if (!this._groups.delete(groupId)) {
      return;
    }
    if (this._pendingNewSessionGroupId === groupId) {
      this._pendingNewSessionGroupId = void 0;
    }
    for (const [sessionId, gid] of this._inFlightSessionGroups) {
      if (gid === groupId) {
        this._inFlightSessionGroups.delete(sessionId);
      }
    }
    const membershipChanged = /* @__PURE__ */ new Set();
    for (const [sessionId, gid] of this._membership) {
      if (gid === groupId) {
        this._membership.delete(sessionId);
        membershipChanged.add(sessionId);
      }
    }
    this.save();
    this._onDidChange.fire({ groupsChanged: true, membershipChanged });
  }
  addToGroup(sessionIdOrIds, groupId) {
    if (!this._groups.has(groupId)) {
      return;
    }
    const sessionIds = typeof sessionIdOrIds === "string" ? [sessionIdOrIds] : sessionIdOrIds;
    const membershipChanged = /* @__PURE__ */ new Set();
    for (const sessionId of sessionIds) {
      this.setMembership(sessionId, groupId, membershipChanged);
    }
    if (membershipChanged.size === 0) {
      return;
    }
    this.save();
    this._onDidChange.fire({ groupsChanged: false, membershipChanged });
  }
  removeFromGroup(sessionId) {
    if (!this._membership.delete(sessionId)) {
      return;
    }
    this.save();
    this._onDidChange.fire({ groupsChanged: false, membershipChanged: /* @__PURE__ */ new Set([sessionId]) });
  }
  getGroupOfSession(sessionId) {
    return this._membership.get(sessionId);
  }
  getSessionIdsInGroup(groupId) {
    const result = [];
    for (const [sessionId, gid] of this._membership) {
      if (gid === groupId) {
        result.push(sessionId);
      }
    }
    return result;
  }
  setPendingNewSessionGroup(groupId) {
    this._pendingNewSessionGroupId = this._groups.has(groupId) ? groupId : void 0;
  }
  // -- Helpers --
  setMembership(sessionId, groupId, changed) {
    if (this._membership.get(sessionId) !== groupId) {
      this._membership.set(sessionId, groupId);
      changed.add(sessionId);
    }
  }
  removeArchivedMembership(sessions, changed) {
    for (const session of sessions) {
      if (session.isArchived.get() && this._membership.delete(session.sessionId)) {
        changed.add(session.sessionId);
      }
    }
  }
  /**
   * Sort groups for display as a stable baseline: newest first (by creation
   * time). The final user-managed order is applied by the section-order
   * service; this baseline is used where that order is not available.
   */
  sortGroups(groups) {
    return groups.sort((a, b) => b.createdAt - a.createdAt);
  }
  // -- Storage --
  load() {
    const raw = this.storageService.get(SessionGroupsService.STORAGE_KEY, StorageScope.PROFILE);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.groups)) {
        for (const group of parsed.groups) {
          if (group && typeof group.id === "string" && typeof group.name === "string") {
            this._groups.set(group.id, {
              id: group.id,
              name: group.name,
              createdAt: typeof group.createdAt === "number" ? group.createdAt : Date.now()
            });
          }
        }
      }
      if (parsed.membership && typeof parsed.membership === "object") {
        for (const [sessionId, groupId] of Object.entries(parsed.membership)) {
          if (typeof groupId === "string" && this._groups.has(groupId)) {
            this._membership.set(sessionId, groupId);
          }
        }
      }
    } catch {
    }
  }
  save() {
    if (this._groups.size === 0) {
      this.storageService.remove(SessionGroupsService.STORAGE_KEY, StorageScope.PROFILE);
      return;
    }
    const state = {
      groups: [...this._groups.values()],
      membership: Object.fromEntries(this._membership)
    };
    this.storageService.store(SessionGroupsService.STORAGE_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.USER);
  }
};
SessionGroupsService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ISessionsManagementService)
], SessionGroupsService);
registerSingleton(ISessionGroupsService, SessionGroupsService, InstantiationType.Delayed);
export {
  ISessionGroupsService,
  SessionGroupsService
};
