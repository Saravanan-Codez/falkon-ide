import { toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const INewChatModelPickerService = createDecorator("newChatModelPickerService");
class NewChatModelPickerService {
  constructor() {
    this._modelPickers = /* @__PURE__ */ new Set();
  }
  registerModelPicker(modelPicker) {
    this._modelPickers.add(modelPicker);
    return toDisposable(() => this._modelPickers.delete(modelPicker));
  }
  openModelPicker() {
    this._getActiveModelPicker()?.open();
  }
  switchToModel(modelIdentifier) {
    return this._getActiveModelPicker()?.switchToModel(modelIdentifier) ?? false;
  }
  _getActiveModelPicker() {
    let activeModelPicker;
    for (const modelPicker of this._modelPickers) {
      activeModelPicker = modelPicker;
    }
    return activeModelPicker;
  }
}
export {
  INewChatModelPickerService,
  NewChatModelPickerService
};
