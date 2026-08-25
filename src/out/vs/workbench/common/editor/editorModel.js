import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
class EditorModel extends Disposable {
  constructor() {
    super(...arguments);
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.resolved = false;
  }
  /**
   * Causes this model to resolve returning a promise when loading is completed.
   */
  async resolve() {
    this.resolved = true;
  }
  /**
   * Returns whether this model was loaded or not.
   */
  isResolved() {
    return this.resolved;
  }
  /**
   * Find out if this model has been disposed.
   */
  isDisposed() {
    return this._store.isDisposed;
  }
  /**
   * Subclasses should implement to free resources that have been claimed through loading.
   */
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
}
export {
  EditorModel
};
