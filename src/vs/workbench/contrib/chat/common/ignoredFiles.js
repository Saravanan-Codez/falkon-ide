import { toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const ILanguageModelIgnoredFilesService = createDecorator("languageModelIgnoredFilesService");
class LanguageModelIgnoredFilesService {
  constructor() {
    this._providers = /* @__PURE__ */ new Set();
  }
  async fileIsIgnored(uri, token) {
    const provider = this._providers.values().next().value;
    return provider ? provider.isFileIgnored(uri, token) : false;
  }
  registerIgnoredFileProvider(provider) {
    this._providers.add(provider);
    return toDisposable(() => {
      this._providers.delete(provider);
    });
  }
}
export {
  ILanguageModelIgnoredFilesService,
  LanguageModelIgnoredFilesService
};
