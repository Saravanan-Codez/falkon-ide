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
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
let ChatEditingTextModelContentProvider = class {
  constructor(_chatEditingService, _modelService) {
    this._chatEditingService = _chatEditingService;
    this._modelService = _modelService;
  }
  static {
    this.scheme = Schemas.chatEditingModel;
  }
  static getFileURI(chatSessionResource, documentId, path) {
    return URI.from({
      scheme: ChatEditingTextModelContentProvider.scheme,
      path,
      query: JSON.stringify({ kind: "doc", documentId, chatSessionResource })
    });
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    const data = JSON.parse(resource.query);
    const session = this._chatEditingService.getEditingSession(URI.revive(data.chatSessionResource));
    const entry = session?.entries.get().find((candidate) => candidate.entryId === data.documentId);
    if (!entry) {
      return null;
    }
    return this._modelService.getModel(entry.originalURI);
  }
};
ChatEditingTextModelContentProvider = __decorateClass([
  __decorateParam(1, IModelService)
], ChatEditingTextModelContentProvider);
let ChatEditingSnapshotTextModelContentProvider = class {
  constructor(_chatEditingService, _modelService) {
    this._chatEditingService = _chatEditingService;
    this._modelService = _modelService;
  }
  static getSnapshotFileURI(chatSessionResource, requestId, undoStop, path, scheme, authority) {
    return URI.from({
      scheme: Schemas.chatEditingSnapshotScheme,
      path,
      query: JSON.stringify({ session: chatSessionResource, requestId: requestId ?? "", undoStop: undoStop ?? "", scheme, authority })
    });
  }
  /**
   * Recovers the URI of the real file that a snapshot URI (as produced by
   * {@link getSnapshotFileURI}) was taken from, so callers can open the file
   * itself instead of a read-only snapshot. Returns the resource unchanged if
   * it is not a snapshot URI, or `undefined` if the origin cannot be recovered
   * (e.g. snapshot URIs persisted before the origin was recorded).
   */
  static getOriginalFileURI(resource) {
    if (resource.scheme !== Schemas.chatEditingSnapshotScheme) {
      return resource;
    }
    let data;
    try {
      data = JSON.parse(resource.query);
    } catch {
      return void 0;
    }
    if (typeof data.scheme !== "string" || !data.scheme || typeof data.authority !== "string") {
      return void 0;
    }
    return resource.with({ scheme: data.scheme, authority: data.authority, query: "", fragment: "" });
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    const data = JSON.parse(resource.query);
    const session = this._chatEditingService.getEditingSession(URI.revive(data.session));
    if (!session || !data.requestId) {
      return null;
    }
    return session.getSnapshotModel(data.requestId, data.undoStop || void 0, resource);
  }
};
ChatEditingSnapshotTextModelContentProvider = __decorateClass([
  __decorateParam(1, IModelService)
], ChatEditingSnapshotTextModelContentProvider);
export {
  ChatEditingSnapshotTextModelContentProvider,
  ChatEditingTextModelContentProvider
};
