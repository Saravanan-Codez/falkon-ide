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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { mapObservableArrayCached, derived, derivedObservableWithCache, observableFromEvent, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { isDefined } from "../../../../../base/common/types.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorResourceAccessor } from "../../../../common/editor.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { DocumentWithSourceAnnotatedEdits, CombineStreamedChanges, MinimizeEditsProcessor } from "./documentWithAnnotatedEdits.js";
let AnnotatedDocuments = class extends Disposable {
  constructor(_workspace, _instantiationService) {
    super();
    this._workspace = _workspace;
    this._instantiationService = _instantiationService;
    const uriVisibilityProvider = this._instantiationService.createInstance(UriVisibilityProvider);
    this._states = mapObservableArrayCached(this, this._workspace.documents, (doc, store) => {
      const docIsVisible = derived((reader) => uriVisibilityProvider.isVisible(doc.uri, reader));
      const wasEverVisible = derivedObservableWithCache(this, (reader, lastVal) => lastVal || docIsVisible.read(reader));
      return wasEverVisible.map((v) => v ? store.add(this._instantiationService.createInstance(AnnotatedDocument, doc, docIsVisible)) : void 0);
    });
    this.documents = this._states.map((vals, reader) => vals.map((v) => v.read(reader)).filter(isDefined));
    this.documents.recomputeInitiallyAndOnChange(this._store);
  }
};
AnnotatedDocuments = __decorateClass([
  __decorateParam(1, IInstantiationService)
], AnnotatedDocuments);
let UriVisibilityProvider = class {
  constructor(_editorGroupsService) {
    this._editorGroupsService = _editorGroupsService;
    const onDidAddGroupSignal = observableSignalFromEvent(this, this._editorGroupsService.onDidAddGroup);
    const onDidRemoveGroupSignal = observableSignalFromEvent(this, this._editorGroupsService.onDidRemoveGroup);
    const groups = derived(this, (reader) => {
      onDidAddGroupSignal.read(reader);
      onDidRemoveGroupSignal.read(reader);
      return this._editorGroupsService.groups;
    });
    this.visibleUris = mapObservableArrayCached(this, groups, (g) => {
      const editors = observableFromEvent(this, g.onDidModelChange, () => g.editors);
      return editors.map((e) => e.map((editor) => EditorResourceAccessor.getCanonicalUri(editor)));
    }).map((editors, reader) => {
      const map = /* @__PURE__ */ new Map();
      for (const urisObs of editors) {
        for (const uri of urisObs.read(reader)) {
          if (isDefined(uri)) {
            map.set(uri.toString(), uri);
          }
        }
      }
      return map;
    });
  }
  isVisible(uri, reader) {
    return this.visibleUris.read(reader).has(uri.toString());
  }
};
UriVisibilityProvider = __decorateClass([
  __decorateParam(0, IEditorGroupsService)
], UriVisibilityProvider);
let AnnotatedDocument = class extends Disposable {
  constructor(document, isVisible, _instantiationService) {
    super();
    this.document = document;
    this.isVisible = isVisible;
    this._instantiationService = _instantiationService;
    let processedDoc = this._store.add(new DocumentWithSourceAnnotatedEdits(document));
    processedDoc = this._store.add(this._instantiationService.createInstance(CombineStreamedChanges, processedDoc));
    processedDoc = this._store.add(new MinimizeEditsProcessor(processedDoc));
    this.documentWithAnnotations = processedDoc;
  }
};
AnnotatedDocument = __decorateClass([
  __decorateParam(2, IInstantiationService)
], AnnotatedDocument);
export {
  AnnotatedDocument,
  AnnotatedDocuments,
  UriVisibilityProvider
};
