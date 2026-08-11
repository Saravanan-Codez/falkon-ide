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
import { IModelService } from "./model.js";
import { ITextModelService } from "./resolverService.js";
import { Disposable, dispose } from "../../../base/common/lifecycle.js";
import { IUndoRedoService } from "../../../platform/undoRedo/common/undoRedo.js";
import { MultiModelEditStackElement } from "../model/editStack.js";
let ModelUndoRedoParticipant = class extends Disposable {
  constructor(_modelService, _textModelService, _undoRedoService) {
    super();
    this._modelService = _modelService;
    this._textModelService = _textModelService;
    this._undoRedoService = _undoRedoService;
    this._register(this._modelService.onModelRemoved((model) => {
      const elements = this._undoRedoService.getElements(model.uri);
      if (elements.past.length === 0 && elements.future.length === 0) {
        return;
      }
      for (const element of elements.past) {
        if (element instanceof MultiModelEditStackElement) {
          element.setDelegate(this);
        }
      }
      for (const element of elements.future) {
        if (element instanceof MultiModelEditStackElement) {
          element.setDelegate(this);
        }
      }
    }));
  }
  prepareUndoRedo(element) {
    const missingModels = element.getMissingModels();
    if (missingModels.length === 0) {
      return Disposable.None;
    }
    const disposablesPromises = missingModels.map(async (uri) => {
      try {
        const reference = await this._textModelService.createModelReference(uri);
        return reference;
      } catch (err) {
        return Disposable.None;
      }
    });
    return Promise.all(disposablesPromises).then((disposables) => {
      return {
        dispose: () => dispose(disposables)
      };
    });
  }
};
ModelUndoRedoParticipant = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ITextModelService),
  __decorateParam(2, IUndoRedoService)
], ModelUndoRedoParticipant);
export {
  ModelUndoRedoParticipant
};
