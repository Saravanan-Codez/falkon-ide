import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableValueOpts } from "../../../../../base/common/observable.js";
import { ActiveClientToolSet, structuralToolsEqual } from "../../activeClientState.js";
class SessionClientToolsModel {
  constructor() {
    this._toolSet = new ActiveClientToolSet();
    this._merged = observableValueOpts(
      { owner: this, equalsFn: (a, b) => structuralToolsEqual(a, b) },
      []
    );
    this.merged = this._merged;
  }
  /** Replace `clientId`'s contributed tools (full replacement). */
  setTools(clientId, tools) {
    this._toolSet.set(clientId, tools);
    this._merged.set(this._toolSet.merged(), void 0);
  }
  /** This client's contributed tools (empty when absent). */
  getTools(clientId) {
    return this._toolSet.get(clientId);
  }
  /** Remove a client's tool contribution. */
  removeClient(clientId) {
    if (this._toolSet.delete(clientId)) {
      this._merged.set(this._toolSet.merged(), void 0);
    }
  }
  /** The `clientId` that owns the tool named `toolName`, or `undefined`. */
  ownerOf(toolName, preferredClientId) {
    return this._toolSet.ownerOf(toolName, preferredClientId);
  }
}
class SessionClientToolsDiff extends Disposable {
  constructor() {
    super();
    this.model = new SessionClientToolsModel();
    this._dirty = false;
    // `autorun` invokes its callback once at registration for dependency
    // tracking. Skip that initial run so a brand-new diff doesn't report
    // dirty before any `setTools` has happened.
    this._ignoreNextFire = true;
    // Structural tool snapshot last marked applied (via {@link consume}).
    this._lastAppliedTools = [];
    this._register(autorun((reader) => {
      const merged = this.model.merged.read(reader);
      if (this._ignoreNextFire) {
        this._ignoreNextFire = false;
        this._lastAppliedTools = merged;
        return;
      }
      if (!structuralToolsEqual(merged, this._lastAppliedTools)) {
        this._dirty = true;
      }
    }));
  }
  get hasDifference() {
    return this._dirty;
  }
  /**
   * Read the current merged tool set and mark it as the applied snapshot.
   * A subsequent {@link SessionClientToolsModel.setTools} re-flips dirty
   * via the autorun, so callers do NOT need to compare snapshots
   * themselves to detect a race. If the caller's downstream work
   * (e.g. SDK rebuild) fails, call {@link markDirty} to surface the
   * stale state so the next sendMessage retries.
   */
  consume() {
    const merged = this.model.merged.get();
    this._dirty = false;
    this._lastAppliedTools = merged;
    return merged;
  }
  /**
   * Force the dirty bit on. Use when a caller's async work that
   * followed {@link consume} failed and the SDK is therefore still on
   * the previous snapshot.
   */
  markDirty() {
    this._dirty = true;
  }
}
export {
  SessionClientToolsDiff,
  SessionClientToolsModel
};
