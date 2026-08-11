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
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { derived, mapObservableArrayCached, observableSignalFromEvent, observableValue, transaction } from "../../../../../base/common/observable.js";
import { isDefined } from "../../../../../base/common/types.js";
import { StringText } from "../../../../../editor/common/core/text/abstractText.js";
import { offsetEditFromContentChanges } from "../../../../../editor/common/model/textModelStringEdit.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ObservableWorkspace, StringEditWithReason } from "./observableWorkspace.js";
let VSCodeWorkspace = class extends ObservableWorkspace {
  constructor(_textModelService) {
    super();
    this._textModelService = _textModelService;
    this._store = new DisposableStore();
    const onModelAdded = observableSignalFromEvent(this, this._textModelService.onModelAdded);
    const onModelRemoved = observableSignalFromEvent(this, this._textModelService.onModelRemoved);
    const models = derived(this, (reader) => {
      onModelAdded.read(reader);
      onModelRemoved.read(reader);
      const models2 = this._textModelService.getModels();
      return models2;
    });
    const documents = mapObservableArrayCached(this, models, (m, store) => {
      if (m.isTooLargeForSyncing()) {
        return void 0;
      }
      return store.add(new VSCodeDocument(m));
    }).recomputeInitiallyAndOnChange(this._store).map((d) => d.filter(isDefined));
    this._documents = documents;
  }
  get documents() {
    return this._documents;
  }
  dispose() {
    this._store.dispose();
  }
};
VSCodeWorkspace = __decorateClass([
  __decorateParam(0, IModelService)
], VSCodeWorkspace);
class VSCodeDocument extends Disposable {
  constructor(textModel) {
    super();
    this.textModel = textModel;
    this._value = observableValue(this, new StringText(this.textModel.getValue()));
    this._version = observableValue(this, this.textModel.getVersionId());
    this._languageId = observableValue(this, this.textModel.getLanguageId());
    this._register(this.textModel.onDidChangeContent((e) => {
      transaction((tx) => {
        const edit = offsetEditFromContentChanges(e.changes);
        if (e.detailedReasons.length !== 1) {
          onUnexpectedError(new Error(`Unexpected number of detailed reasons: ${e.detailedReasons.length}`));
        }
        const change = new StringEditWithReason(edit.replacements, e.detailedReasons[0]);
        this._value.set(new StringText(this.textModel.getValue()), tx, change);
        this._version.set(this.textModel.getVersionId(), tx);
      });
    }));
    this._register(this.textModel.onDidChangeLanguage((e) => {
      transaction((tx) => {
        this._languageId.set(this.textModel.getLanguageId(), tx);
      });
    }));
  }
  get uri() {
    return this.textModel.uri;
  }
  get value() {
    return this._value;
  }
  get version() {
    return this._version;
  }
  get languageId() {
    return this._languageId;
  }
}
export {
  VSCodeDocument,
  VSCodeWorkspace
};
