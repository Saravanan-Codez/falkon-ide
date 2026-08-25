var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable, ReferenceCollection } from "../../../../../../base/common/lifecycle.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
let InlineTextModelCollection = class extends Disposable {
  constructor(modelService) {
    super();
    this._collection = new InlineTextModelReferenceCollection(modelService);
  }
  acquire(uri, value, languageSelection, isForSimpleWidget) {
    return this._collection.acquire(uri.toString(), uri, value, languageSelection, isForSimpleWidget);
  }
};
InlineTextModelCollection = __decorateClass([
  __decorateParam(0, IModelService)
], InlineTextModelCollection);
class InlineTextModelReferenceCollection extends ReferenceCollection {
  constructor(modelService) {
    super();
    this.modelService = modelService;
  }
  createReferencedObject(key, uri, value, languageSelection, isForSimpleWidget) {
    return this.modelService.createModel(value, languageSelection, uri, isForSimpleWidget);
  }
  destroyReferencedObject(_key, model) {
    model.dispose();
  }
}
export {
  InlineTextModelCollection
};
