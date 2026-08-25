import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const NEW_SESSION_PROMPT_TYPING_DURATION_MS = 2500;
const INewSessionComposerService = createDecorator("newSessionComposerService");
class NewSessionComposerService extends Disposable {
  constructor() {
    super(...arguments);
    this._composers = /* @__PURE__ */ new Set();
    this._activeComposer = observableValue(this, void 0);
    this.activeComposer = this._activeComposer;
  }
  registerComposer(composer) {
    this._composers.add(composer);
    this._activeComposer.set(composer, void 0);
    return toDisposable(() => {
      this._composers.delete(composer);
      if (this._activeComposer.get() === composer) {
        this._activeComposer.set(Array.from(this._composers).at(-1), void 0);
      }
    });
  }
}
registerSingleton(INewSessionComposerService, NewSessionComposerService, InstantiationType.Delayed);
export {
  INewSessionComposerService,
  NEW_SESSION_PROMPT_TYPING_DURATION_MS,
  NewSessionComposerService
};
