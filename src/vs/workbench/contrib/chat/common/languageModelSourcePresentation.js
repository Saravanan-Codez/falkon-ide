import { toDisposable } from "../../../../base/common/lifecycle.js";
class LanguageModelSourcePresentationRegistry {
  constructor() {
    this._presentations = /* @__PURE__ */ new Map();
  }
  register(presentation) {
    const key = this._key(presentation.ownerVendor, presentation.sourceId);
    if (this._presentations.has(key)) {
      throw new Error(`A language model source presentation is already registered for ${presentation.ownerVendor}/${presentation.sourceId}`);
    }
    this._presentations.set(key, presentation);
    return toDisposable(() => {
      if (this._presentations.get(key) === presentation) {
        this._presentations.delete(key);
      }
    });
  }
  get(ownerVendor, sourceId) {
    return this._presentations.get(this._key(ownerVendor, sourceId));
  }
  _key(ownerVendor, sourceId) {
    return `${ownerVendor}\0${sourceId}`;
  }
}
const languageModelSourcePresentationRegistry = new LanguageModelSourcePresentationRegistry();
export {
  languageModelSourcePresentationRegistry
};
