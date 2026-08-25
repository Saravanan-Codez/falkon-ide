import { Disposable } from "../../../../base/common/lifecycle.js";
import { constObservable } from "../../../../base/common/observable.js";
class AbstractCustomView extends Disposable {
  constructor() {
    super(...arguments);
    /** Optional secondary line below the title. */
    this.description = constObservable(void 0);
    /**
     * Width the content is capped to. Defaults to the same measure the session
     * views use.
     */
    this.maxWidth = void 0;
  }
  focus() {
  }
}
export {
  AbstractCustomView
};
