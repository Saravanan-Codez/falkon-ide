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
import { AsyncReferenceCollection, ReferenceCollection } from "../../../../../../base/common/lifecycle.js";
import { INotebookService } from "../../../common/notebookService.js";
import { bufferToStream, VSBuffer } from "../../../../../../base/common/buffer.js";
import { createDecorator, IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
const INotebookOriginalModelReferenceFactory = createDecorator("INotebookOriginalModelReferenceFactory");
let OriginalNotebookModelReferenceCollection = class extends ReferenceCollection {
  constructor(notebookService, modelService) {
    super();
    this.notebookService = notebookService;
    this.modelService = modelService;
    this.modelsToDispose = /* @__PURE__ */ new Set();
  }
  async createReferencedObject(key, fileEntry, viewType) {
    this.modelsToDispose.delete(key);
    const uri = fileEntry.originalURI;
    const model = this.notebookService.getNotebookTextModel(uri);
    if (model) {
      return model;
    }
    const modelRef = await this.modelService.createModelReference(uri);
    const bytes = VSBuffer.fromString(modelRef.object.textEditorModel.getValue());
    const stream = bufferToStream(bytes);
    modelRef.dispose();
    return this.notebookService.createNotebookTextModel(viewType, uri, stream);
  }
  destroyReferencedObject(key, modelPromise) {
    this.modelsToDispose.add(key);
    (async () => {
      try {
        const model = await modelPromise;
        if (!this.modelsToDispose.has(key)) {
          return;
        }
        model.dispose();
      } catch (error) {
      } finally {
        this.modelsToDispose.delete(key);
      }
    })();
  }
};
OriginalNotebookModelReferenceCollection = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, ITextModelService)
], OriginalNotebookModelReferenceCollection);
let NotebookOriginalModelReferenceFactory = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this._resourceModelCollection = void 0;
    this._asyncModelCollection = void 0;
  }
  get resourceModelCollection() {
    if (!this._resourceModelCollection) {
      this._resourceModelCollection = this.instantiationService.createInstance(OriginalNotebookModelReferenceCollection);
    }
    return this._resourceModelCollection;
  }
  get asyncModelCollection() {
    if (!this._asyncModelCollection) {
      this._asyncModelCollection = new AsyncReferenceCollection(this.resourceModelCollection);
    }
    return this._asyncModelCollection;
  }
  getOrCreate(fileEntry, viewType) {
    return this.asyncModelCollection.acquire(fileEntry.originalURI.toString(), fileEntry, viewType);
  }
};
NotebookOriginalModelReferenceFactory = __decorateClass([
  __decorateParam(0, IInstantiationService)
], NotebookOriginalModelReferenceFactory);
export {
  INotebookOriginalModelReferenceFactory,
  NotebookOriginalModelReferenceFactory,
  OriginalNotebookModelReferenceCollection
};
