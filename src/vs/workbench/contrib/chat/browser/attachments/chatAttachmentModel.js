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
import { URI } from "../../../../../base/common/uri.js";
import { Emitter } from "../../../../../base/common/event.js";
import { basename } from "../../../../../base/common/resources.js";
import { combinedDisposable, Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { IChatRequestVariableEntry, isPromptFileVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { FileChangeType, IFileService } from "../../../../../platform/files/common/files.js";
import { ISharedWebContentExtractorService } from "../../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IChatAttachmentResolveService } from "./chatAttachmentResolveService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { equals } from "../../../../../base/common/objects.js";
import { Iterable } from "../../../../../base/common/iterator.js";
let ChatAttachmentModel = class extends Disposable {
  constructor(fileService, webContentExtractorService, chatAttachmentResolveService) {
    super();
    this.fileService = fileService;
    this.webContentExtractorService = webContentExtractorService;
    this.chatAttachmentResolveService = chatAttachmentResolveService;
    this._attachments = /* @__PURE__ */ new Map();
    this._fileWatchers = this._register(new DisposableMap());
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
  }
  get attachments() {
    return Array.from(this._attachments.values());
  }
  get size() {
    return this._attachments.size;
  }
  get fileAttachments() {
    return this.attachments.filter((file) => file.kind === "file" && URI.isUri(file.value)).map((file) => file.value);
  }
  getAttachmentIDs() {
    return new Set(this._attachments.keys());
  }
  async addFile(uri, range) {
    if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(uri.path)) {
      const context = await this.asImageVariableEntry(uri);
      if (context) {
        this.addContext(context);
      }
      return;
    } else if (uri.scheme === Schemas.vscodeBrowser) {
      const entry = await this.chatAttachmentResolveService.resolveEditorAttachContext({ resource: uri });
      if (entry) {
        this.addContext(entry);
      }
      return;
    } else {
      this.addContext(this.asFileVariableEntry(uri, range));
    }
  }
  addFolder(uri) {
    const entry = {
      kind: "directory",
      value: uri,
      id: uri.toString(),
      name: basename(uri)
    };
    this.addContext(entry);
  }
  clear(clearStickyAttachments = false) {
    if (clearStickyAttachments) {
      const deleted = Array.from(this._attachments.keys());
      this._attachments.clear();
      this._fileWatchers.clearAndDisposeAll();
      this._onDidChange.fire({ deleted, added: [], updated: [] });
    } else {
      const deleted = [];
      const allIds = Array.from(this._attachments.keys());
      for (const id of allIds) {
        const entry = this._attachments.get(id);
        if (entry && !isPromptFileVariableEntry(entry)) {
          this._attachments.delete(id);
          this._fileWatchers.deleteAndDispose(id);
          deleted.push(id);
        }
      }
      this._onDidChange.fire({ deleted, added: [], updated: [] });
    }
  }
  addContext(...attachments) {
    attachments = attachments.filter((attachment) => !this._attachments.has(attachment.id));
    this.updateContext(Iterable.empty(), attachments);
  }
  clearAndSetContext(...attachments) {
    this.updateContext(Array.from(this._attachments.keys()), attachments);
  }
  delete(...variableEntryIds) {
    this.updateContext(variableEntryIds, Iterable.empty());
  }
  updateContext(toDelete, upsert) {
    const deleted = [];
    const added = [];
    const updated = [];
    for (const id of toDelete) {
      const item = this._attachments.get(id);
      if (item) {
        this._attachments.delete(id);
        deleted.push(id);
        this._fileWatchers.deleteAndDispose(id);
      }
    }
    for (const item of upsert) {
      const oldItem = this._attachments.get(item.id);
      if (!oldItem) {
        this._attachments.set(item.id, item);
        added.push(item);
        this._watchAttachment(item);
        this._maybeResolveDirectoryImageCount(item);
      } else if (!equals(oldItem, item)) {
        this._fileWatchers.deleteAndDispose(item.id);
        this._attachments.set(item.id, item);
        updated.push(item);
        this._watchAttachment(item);
        this._maybeResolveDirectoryImageCount(item);
      }
    }
    if (deleted.length > 0 || added.length > 0 || updated.length > 0) {
      this._onDidChange.fire({ deleted, added, updated });
    }
  }
  _maybeResolveDirectoryImageCount(attachment) {
    if (attachment.kind !== "directory" || typeof attachment.imageCount === "number" || !URI.isUri(attachment.value)) {
      return;
    }
    const uri = attachment.value;
    this.chatAttachmentResolveService.resolveDirectoryImages(uri).then((images) => {
      const current = this._attachments.get(attachment.id);
      if (current && current.kind === "directory" && current.value?.toString() === uri.toString()) {
        this.updateContext(Iterable.empty(), [{ ...current, imageCount: images.length }]);
      }
    }, () => {
    });
  }
  _watchAttachment(attachment) {
    const uri = IChatRequestVariableEntry.toUri(attachment);
    if (!uri || uri.scheme !== Schemas.file) {
      return;
    }
    const watcher = this.fileService.createWatcher(uri, { recursive: false, excludes: [] });
    const onDidChangeListener = watcher.onDidChange((e) => {
      if (e.contains(uri, FileChangeType.DELETED)) {
        this.updateContext([attachment.id], Iterable.empty());
      }
    });
    this._fileWatchers.set(attachment.id, combinedDisposable(onDidChangeListener, watcher));
  }
  // ---- create utils
  asFileVariableEntry(uri, range) {
    return {
      kind: "file",
      value: range ? { uri, range } : uri,
      id: uri.toString() + (range?.toString() ?? ""),
      name: basename(uri)
    };
  }
  // Gets an image variable for a given URI, which may be a file or a web URL
  async asImageVariableEntry(uri) {
    if (uri.scheme === Schemas.file && await this.fileService.canHandleResource(uri)) {
      return await this.chatAttachmentResolveService.resolveImageEditorAttachContext(uri);
    } else if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
      const extractedImages = await this.webContentExtractorService.readImage(uri, CancellationToken.None);
      if (extractedImages) {
        return await this.chatAttachmentResolveService.resolveImageEditorAttachContext(uri, extractedImages);
      }
    }
    return void 0;
  }
};
ChatAttachmentModel = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ISharedWebContentExtractorService),
  __decorateParam(2, IChatAttachmentResolveService)
], ChatAttachmentModel);
export {
  ChatAttachmentModel
};
