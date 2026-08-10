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
import { ReferenceCollection } from "../../../../../../base/common/lifecycle.js";
import { createDecorator, IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { CellKind } from "../../../common/notebookCommon.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
const INotebookOriginalCellModelFactory = createDecorator("INotebookOriginalCellModelFactory");
let OriginalNotebookCellModelReferenceCollection = class extends ReferenceCollection {
  constructor(modelService, _languageService) {
    super();
    this.modelService = modelService;
    this._languageService = _languageService;
  }
  createReferencedObject(_key, uri, cellValue, language, cellKind) {
    const scheme = `${uri.scheme}-chat-edit`;
    const originalCellUri = URI.from({ scheme, fragment: uri.fragment, path: uri.path });
    const languageSelection = this._languageService.getLanguageIdByLanguageName(language) ? this._languageService.createById(language) : cellKind === CellKind.Markup ? this._languageService.createById("markdown") : null;
    return this.modelService.createModel(cellValue, languageSelection, originalCellUri);
  }
  destroyReferencedObject(_key, model) {
    model.dispose();
  }
};
OriginalNotebookCellModelReferenceCollection = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ILanguageService)
], OriginalNotebookCellModelReferenceCollection);
let OriginalNotebookCellModelFactory = class {
  constructor(instantiationService) {
    this._data = instantiationService.createInstance(OriginalNotebookCellModelReferenceCollection);
  }
  getOrCreate(uri, cellValue, language, cellKind) {
    return this._data.acquire(uri.toString(), uri, cellValue, language, cellKind);
  }
};
OriginalNotebookCellModelFactory = __decorateClass([
  __decorateParam(0, IInstantiationService)
], OriginalNotebookCellModelFactory);
export {
  INotebookOriginalCellModelFactory,
  OriginalNotebookCellModelFactory,
  OriginalNotebookCellModelReferenceCollection
};
