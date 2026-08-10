import { Event } from "../../../../base/common/event.js";
import { compare } from "../../../../base/common/strings.js";
import { LanguageFeatureRegistry } from "../../../../editor/common/languageFeatureRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const ILanguageStatusService = createDecorator("ILanguageStatusService");
class LanguageStatusServiceImpl {
  constructor() {
    this._provider = new LanguageFeatureRegistry();
    this.onDidChange = Event.map(this._provider.onDidChange, () => void 0);
  }
  addStatus(status) {
    return this._provider.register(status.selector, status);
  }
  getLanguageStatus(model) {
    return this._provider.ordered(model).sort((a, b) => {
      let res = b.severity - a.severity;
      if (res === 0) {
        res = compare(a.source, b.source);
      }
      if (res === 0) {
        res = compare(a.id, b.id);
      }
      return res;
    });
  }
}
registerSingleton(ILanguageStatusService, LanguageStatusServiceImpl, InstantiationType.Delayed);
export {
  ILanguageStatusService
};
