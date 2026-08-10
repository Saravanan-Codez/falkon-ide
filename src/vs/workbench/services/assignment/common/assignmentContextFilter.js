import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
class AssignmentContextFilter extends Disposable {
  constructor(storageService) {
    super();
    this.storageService = storageService;
    this._filters = [];
    this._filterDisposables = this._register(new DisposableStore());
    /**
     * Ids of filters that have been registered this session. Once a filter is registered it
     * becomes authoritative for its own id and the persisted cache is repopulated from the
     * ids it actually excludes.
     */
    this._registeredFilterIds = /* @__PURE__ */ new Set();
    this._onDidChange = this._register(new Emitter());
    /** Fires when a filter is added or an already registered filter changes its exclusions. */
    this.onDidChange = this._onDidChange.event;
    this._cachedFilteredOutIds = this._loadFilteredOutIds();
  }
  static {
    this.STORAGE_KEY = "workbench.assignment.filteredOutAssignmentContextIds";
  }
  addFilter(filter) {
    this._filters.push(filter);
    this._registeredFilterIds.add(filter.id);
    if (this._cachedFilteredOutIds.has(filter.id)) {
      const next = new Map(this._cachedFilteredOutIds);
      next.delete(filter.id);
      this._storeFilteredOutIds(next);
    }
    this._filterDisposables.add(filter.onDidChange(() => this._onDidChange.fire()));
    this._onDidChange.fire();
  }
  /**
   * Removes the excluded assignment-context ids from the given context and persists the
   * reconciled per-filter cache.
   */
  filter(assignmentContext) {
    const assignments = assignmentContext.split(";");
    const freshFilteredOut = /* @__PURE__ */ new Map();
    const filteredAssignments = assignments.filter((assignment) => {
      let excluded = false;
      for (const filter of this._filters) {
        if (filter.exclude(assignment)) {
          let set = freshFilteredOut.get(filter.id);
          if (!set) {
            set = /* @__PURE__ */ new Set();
            freshFilteredOut.set(filter.id, set);
          }
          set.add(assignment);
          excluded = true;
        }
      }
      if (excluded) {
        return false;
      }
      for (const [filterId, ids] of this._cachedFilteredOutIds) {
        if (!this._registeredFilterIds.has(filterId) && ids.has(assignment)) {
          return false;
        }
      }
      return true;
    });
    const next = /* @__PURE__ */ new Map();
    for (const [filterId, ids] of this._cachedFilteredOutIds) {
      if (!this._registeredFilterIds.has(filterId)) {
        next.set(filterId, ids);
      }
    }
    for (const [filterId, ids] of freshFilteredOut) {
      next.set(filterId, ids);
    }
    this._storeFilteredOutIds(next);
    return filteredAssignments.join(";");
  }
  _loadFilteredOutIds() {
    const result = /* @__PURE__ */ new Map();
    const raw = this.storageService.get(AssignmentContextFilter.STORAGE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return result;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [filterId, ids] of Object.entries(parsed)) {
          if (Array.isArray(ids)) {
            const set = new Set(ids.filter((id) => typeof id === "string"));
            if (set.size > 0) {
              result.set(filterId, set);
            }
          }
        }
      }
    } catch {
    }
    return result;
  }
  _storeFilteredOutIds(next) {
    const normalized = /* @__PURE__ */ new Map();
    for (const [filterId, ids] of next) {
      if (ids.size > 0) {
        normalized.set(filterId, ids);
      }
    }
    if (areCachesEqual(normalized, this._cachedFilteredOutIds)) {
      return;
    }
    this._cachedFilteredOutIds = normalized;
    if (normalized.size === 0) {
      this.storageService.remove(AssignmentContextFilter.STORAGE_KEY, StorageScope.APPLICATION);
    } else {
      const serializable = {};
      for (const [filterId, ids] of normalized) {
        serializable[filterId] = Array.from(ids);
      }
      this.storageService.store(AssignmentContextFilter.STORAGE_KEY, JSON.stringify(serializable), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
}
function areCachesEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [filterId, ids] of a) {
    const other = b.get(filterId);
    if (!other || other.size !== ids.size) {
      return false;
    }
    for (const id of ids) {
      if (!other.has(id)) {
        return false;
      }
    }
  }
  return true;
}
export {
  AssignmentContextFilter
};
