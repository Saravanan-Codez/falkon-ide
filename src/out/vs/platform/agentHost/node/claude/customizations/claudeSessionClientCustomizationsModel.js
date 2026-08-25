import { Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { equals as arraysEqual } from "../../../../../base/common/arrays.js";
import { autorun, observableValueOpts } from "../../../../../base/common/observable.js";
const INITIAL_STATE = { synced: [] };
class SessionClientCustomizationsModel {
  constructor() {
    /** Per-client synced customizations, keyed by `clientId`, merged into `state.synced`. */
    this._byClient = /* @__PURE__ */ new Map();
    this._state = observableValueOpts(
      { owner: this, equalsFn: stateEqual },
      INITIAL_STATE
    );
    this.state = this._state;
  }
  /**
   * The union of every client's synced customizations, deduplicated by
   * customization `id` with the first-inserted client winning. Order
   * follows client insertion order.
   */
  _mergedSynced() {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const synced of this._byClient.values()) {
      for (const item of synced) {
        if (seen.has(item.customization.id)) {
          continue;
        }
        seen.add(item.customization.id);
        result.push(item);
      }
    }
    return result;
  }
  /** Replace a single client's pushed customization snapshot for this session. */
  setSyncedCustomizations(clientId, synced) {
    this._byClient.set(clientId, synced);
    this._state.set({ synced: this._mergedSynced() }, void 0);
  }
  /** Remove a client's pushed customizations from this session. */
  removeClient(clientId) {
    if (!this._byClient.delete(clientId)) {
      return;
    }
    this._state.set({ synced: this._mergedSynced() }, void 0);
  }
}
class SessionClientCustomizationsDiff extends Disposable {
  constructor() {
    super();
    this.model = new SessionClientCustomizationsModel();
    this._dirty = false;
    this._appliedPluginPaths = [];
    // `autorun` invokes its callback once at registration for dependency
    // tracking. Skip that initial run so a brand-new diff doesn't
    // report dirty before any mutation has happened.
    this._ignoreNextFire = true;
    /**
     * Outward fire-and-forget signal that the underlying state
     * changed. Derived from the observable so external listeners
     * (e.g. agent-level event aggregation) don't have to subscribe to
     * the observable directly.
     */
    this.onDidChange = Event.fromObservableLight(this.model.state);
    this._register(autorun((reader) => {
      this.model.state.read(reader);
      if (this._ignoreNextFire) {
        this._ignoreNextFire = false;
        return;
      }
      this._dirty = true;
    }));
  }
  get hasDifference() {
    return this._dirty;
  }
  hasDifferenceFrom(pluginPaths) {
    return this._dirty || !pluginPathsEqual(this._appliedPluginPaths, pluginPaths);
  }
  /**
   * Record the resolved desired plugin paths and mark the current
   * snapshot as applied. A subsequent write that changes any
   * meaningful field re-flips dirty via the autorun. If the caller's
   * downstream work (e.g. SDK rebind) fails, call {@link markDirty}
   * to surface the stale state.
   */
  consume(paths) {
    this._appliedPluginPaths = paths;
    this._dirty = false;
    return paths;
  }
  /**
   * Force the dirty bit on. Use when async work that followed
   * {@link consume} failed and the SDK is therefore still on the
   * previous plugin set.
   */
  markDirty() {
    this._dirty = true;
  }
}
function stateEqual(a, b) {
  return syncedListEqual(a.synced, b.synced);
}
function syncedListEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const ai = a[i].customization;
    const bi = b[i].customization;
    if (ai.id !== bi.id) {
      return false;
    }
    if (ai.uri !== bi.uri) {
      return false;
    }
    if (ai.nonce !== bi.nonce) {
      return false;
    }
    if (ai.name !== bi.name) {
      return false;
    }
    if (ai.enabled !== bi.enabled) {
      return false;
    }
    if (ai.load?.kind !== bi.load?.kind) {
      return false;
    }
    if (loadMessageOf(ai.load) !== loadMessageOf(bi.load)) {
      return false;
    }
    if (!childrenEqual(ai.children, bi.children)) {
      return false;
    }
    if (a[i].pluginDir?.toString() !== b[i].pluginDir?.toString()) {
      return false;
    }
  }
  return true;
}
function loadMessageOf(load) {
  return load && load.message ? load.message : void 0;
}
function childrenEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].name !== b[i].name) {
      return false;
    }
  }
  return true;
}
function pluginPathsEqual(a, b) {
  return arraysEqual(a, b, (x, y) => x.toString() === y.toString());
}
export {
  SessionClientCustomizationsDiff,
  SessionClientCustomizationsModel
};
