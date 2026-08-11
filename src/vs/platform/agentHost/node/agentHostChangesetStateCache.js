import { LinkedMap, Touch } from "../../../base/common/map.js";
import { ChangesetStatus } from "../common/state/sessionState.js";
const DEFAULT_CHANGESET_STATE_SOFT_LIMIT = 500;
class AgentHostChangesetStateCache {
  constructor(options = {}) {
    this._states = /* @__PURE__ */ new Map();
    this._lru = new LinkedMap();
    this._softLimit = Math.max(0, options.softLimit ?? DEFAULT_CHANGESET_STATE_SOFT_LIMIT);
    this._canEvict = options.canEvict ?? (() => true);
  }
  keys() {
    return this._states.keys();
  }
  has(changeset) {
    return this._states.has(changeset);
  }
  get(changeset) {
    this._touch(changeset);
    return this._states.get(changeset);
  }
  set(changeset, state) {
    this._states.set(changeset, state);
    this._touch(changeset);
    this._evictIfOverLimit();
  }
  delete(changeset) {
    this._states.delete(changeset);
    this._lru.delete(changeset);
  }
  register(changeset, initialStatus = ChangesetStatus.Computing) {
    if (this._states.has(changeset)) {
      this._touch(changeset);
      return;
    }
    this.set(changeset, { status: initialStatus, files: [] });
  }
  /** Re-runs eviction after external liveness changes, such as unsubscribe or compute completion. */
  trimEvictableEntries() {
    this._evictIfOverLimit();
  }
  _touch(changeset) {
    if (this._states.has(changeset)) {
      this._lru.set(changeset, true, Touch.AsNew);
    }
  }
  _evictIfOverLimit() {
    if (this._softLimit === 0) {
      for (const changeset of [...this._lru.keys()]) {
        if (this._canEvict(changeset)) {
          this.delete(changeset);
        }
      }
      return;
    }
    for (const changeset of [...this._lru.keys()]) {
      if (this._states.size <= this._softLimit) {
        return;
      }
      if (!this._states.has(changeset)) {
        this._lru.delete(changeset);
        continue;
      }
      if (this._canEvict(changeset)) {
        this.delete(changeset);
      }
    }
  }
}
export {
  AgentHostChangesetStateCache
};
