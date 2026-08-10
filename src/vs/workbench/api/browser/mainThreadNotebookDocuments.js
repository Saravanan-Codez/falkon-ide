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
import { Event } from "../../../base/common/event.js";
import { DisposableStore, dispose } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { URI } from "../../../base/common/uri.js";
import { BoundModelReferenceCollection } from "./mainThreadDocuments.js";
import { NotebookCellsChangeType } from "../../contrib/notebook/common/notebookCommon.js";
import { INotebookEditorModelResolverService } from "../../contrib/notebook/common/notebookEditorModelResolverService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { ExtHostContext } from "../common/extHost.protocol.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
let MainThreadNotebookDocuments = class {
  constructor(extHostContext, _notebookEditorModelResolverService, _uriIdentityService) {
    this._notebookEditorModelResolverService = _notebookEditorModelResolverService;
    this._uriIdentityService = _uriIdentityService;
    this._disposables = new DisposableStore();
    this._documentEventListenersMapping = new ResourceMap();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookDocuments);
    this._modelReferenceCollection = new BoundModelReferenceCollection(this._uriIdentityService.extUri);
    this._disposables.add(this._notebookEditorModelResolverService.onDidChangeDirty((model) => this._proxy.$acceptDirtyStateChanged(model.resource, model.isDirty())));
    this._disposables.add(this._notebookEditorModelResolverService.onDidSaveNotebook((e) => this._proxy.$acceptModelSaved(e)));
    this._disposables.add(_notebookEditorModelResolverService.onWillFailWithConflict((e) => {
      this._modelReferenceCollection.remove(e.resource);
    }));
  }
  dispose() {
    this._disposables.dispose();
    this._modelReferenceCollection.dispose();
    dispose(this._documentEventListenersMapping.values());
  }
  handleNotebooksAdded(notebooks) {
    for (const textModel of notebooks) {
      const disposableStore = new DisposableStore();
      disposableStore.add(textModel.onDidChangeContent((event) => {
        const eventDto = {
          versionId: event.versionId,
          rawEvents: []
        };
        for (const e of event.rawEvents) {
          switch (e.kind) {
            case NotebookCellsChangeType.ModelChange:
              eventDto.rawEvents.push({
                kind: e.kind,
                changes: e.changes.map((diff) => [diff[0], diff[1], diff[2].map((cell) => NotebookDto.toNotebookCellDto(cell))])
              });
              break;
            case NotebookCellsChangeType.Move:
              eventDto.rawEvents.push({
                kind: e.kind,
                index: e.index,
                length: e.length,
                newIdx: e.newIdx
              });
              break;
            case NotebookCellsChangeType.Output:
              eventDto.rawEvents.push({
                kind: e.kind,
                index: e.index,
                outputs: e.outputs.map(NotebookDto.toNotebookOutputDto)
              });
              break;
            case NotebookCellsChangeType.OutputItem:
              eventDto.rawEvents.push({
                kind: e.kind,
                index: e.index,
                outputId: e.outputId,
                outputItems: e.outputItems.map(NotebookDto.toNotebookOutputItemDto),
                append: e.append
              });
              break;
            case NotebookCellsChangeType.ChangeCellLanguage:
            case NotebookCellsChangeType.ChangeCellContent:
            case NotebookCellsChangeType.ChangeCellMetadata:
            case NotebookCellsChangeType.ChangeCellInternalMetadata:
              eventDto.rawEvents.push(e);
              break;
          }
        }
        const hasDocumentMetadataChangeEvent = event.rawEvents.find((e) => e.kind === NotebookCellsChangeType.ChangeDocumentMetadata);
        this._proxy.$acceptModelChanged(
          textModel.uri,
          new SerializableObjectWithBuffers(eventDto),
          this._notebookEditorModelResolverService.isDirty(textModel.uri),
          hasDocumentMetadataChangeEvent ? textModel.metadata : void 0
        );
      }));
      this._documentEventListenersMapping.set(textModel.uri, disposableStore);
    }
  }
  handleNotebooksRemoved(uris) {
    for (const uri of uris) {
      this._documentEventListenersMapping.get(uri)?.dispose();
      this._documentEventListenersMapping.delete(uri);
    }
  }
  async $tryCreateNotebook(options) {
    if (options.content) {
      const ref = await this._notebookEditorModelResolverService.resolve({ untitledResource: void 0 }, options.viewType);
      Event.once(ref.object.notebook.onWillDispose)(() => {
        ref.dispose();
      });
      this._proxy.$acceptDirtyStateChanged(ref.object.resource, true);
      if (options.content) {
        const data = NotebookDto.fromNotebookDataDto(options.content);
        ref.object.notebook.reset(data.cells, data.metadata, ref.object.notebook.transientOptions);
      }
      return ref.object.notebook.uri;
    } else {
      const notebook = await this._notebookEditorModelResolverService.createUntitledNotebookTextModel(options.viewType);
      return notebook.uri;
    }
  }
  async $tryOpenNotebook(uriComponents) {
    const uri = URI.revive(uriComponents);
    const ref = await this._notebookEditorModelResolverService.resolve(uri, void 0);
    if (uriComponents.scheme === "untitled") {
      ref.object.notebook.onWillDispose(() => {
        ref.dispose();
      });
    }
    this._modelReferenceCollection.add(uri, ref);
    return uri;
  }
  async $trySaveNotebook(uriComponents) {
    const uri = URI.revive(uriComponents);
    const ref = await this._notebookEditorModelResolverService.resolve(uri);
    const saveResult = await ref.object.save();
    ref.dispose();
    return saveResult;
  }
};
MainThreadNotebookDocuments = __decorateClass([
  __decorateParam(1, INotebookEditorModelResolverService),
  __decorateParam(2, IUriIdentityService)
], MainThreadNotebookDocuments);
export {
  MainThreadNotebookDocuments
};
