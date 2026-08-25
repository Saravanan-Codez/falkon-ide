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
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { URI } from "../../../../../base/common/uri.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../../editor/common/model/textModel.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { coalesceInPlace } from "../../../../../base/common/arrays.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { ConflictDetector } from "../conflicts.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { localize } from "../../../../../nls.js";
import { extUri } from "../../../../../base/common/resources.js";
import { ResourceFileEdit, ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { SnippetParser } from "../../../../../editor/contrib/snippet/browser/snippetParser.js";
import { MicrotaskDelay } from "../../../../../base/common/symbols.js";
import { Schemas } from "../../../../../base/common/network.js";
class CheckedStates {
  constructor() {
    this._states = /* @__PURE__ */ new WeakMap();
    this._checkedCount = 0;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  dispose() {
    this._onDidChange.dispose();
  }
  get checkedCount() {
    return this._checkedCount;
  }
  isChecked(obj) {
    return this._states.get(obj) ?? false;
  }
  updateChecked(obj, value) {
    const valueNow = this._states.get(obj);
    if (valueNow === value) {
      return;
    }
    if (valueNow === void 0) {
      if (value) {
        this._checkedCount += 1;
      }
    } else {
      if (value) {
        this._checkedCount += 1;
      } else {
        this._checkedCount -= 1;
      }
    }
    this._states.set(obj, value);
    this._onDidChange.fire(obj);
  }
}
class BulkTextEdit {
  constructor(parent, textEdit) {
    this.parent = parent;
    this.textEdit = textEdit;
  }
}
var BulkFileOperationType = /* @__PURE__ */ ((BulkFileOperationType2) => {
  BulkFileOperationType2[BulkFileOperationType2["TextEdit"] = 1] = "TextEdit";
  BulkFileOperationType2[BulkFileOperationType2["Create"] = 2] = "Create";
  BulkFileOperationType2[BulkFileOperationType2["Delete"] = 4] = "Delete";
  BulkFileOperationType2[BulkFileOperationType2["Rename"] = 8] = "Rename";
  return BulkFileOperationType2;
})(BulkFileOperationType || {});
class BulkFileOperation {
  constructor(uri, parent) {
    this.uri = uri;
    this.parent = parent;
    this.type = 0;
    this.textEdits = [];
    this.originalEdits = /* @__PURE__ */ new Map();
  }
  addEdit(index, type, edit) {
    this.type |= type;
    this.originalEdits.set(index, edit);
    if (edit instanceof ResourceTextEdit) {
      this.textEdits.push(new BulkTextEdit(this, edit));
    } else if (type === 8 /* Rename */) {
      this.newUri = edit.newResource;
    }
  }
  needsConfirmation() {
    for (const [, edit] of this.originalEdits) {
      if (!this.parent.checked.isChecked(edit)) {
        return true;
      }
    }
    return false;
  }
}
class BulkCategory {
  constructor(metadata = BulkCategory._defaultMetadata) {
    this.metadata = metadata;
    this.operationByResource = /* @__PURE__ */ new Map();
  }
  static {
    this._defaultMetadata = Object.freeze({
      label: localize("default", "Other"),
      icon: Codicon.symbolFile,
      needsConfirmation: false
    });
  }
  static keyOf(metadata) {
    return metadata?.label || "<default>";
  }
  get fileOperations() {
    return this.operationByResource.values();
  }
}
let BulkFileOperations = class {
  constructor(_bulkEdit, _fileService, instaService) {
    this._bulkEdit = _bulkEdit;
    this._fileService = _fileService;
    this.checked = new CheckedStates();
    this.fileOperations = [];
    this.categories = [];
    this.conflicts = instaService.createInstance(ConflictDetector, _bulkEdit);
  }
  static async create(accessor, bulkEdit) {
    const result = accessor.get(IInstantiationService).createInstance(BulkFileOperations, bulkEdit);
    return await result._init();
  }
  dispose() {
    this.checked.dispose();
    this.conflicts.dispose();
  }
  async _init() {
    const operationByResource = /* @__PURE__ */ new Map();
    const operationByCategory = /* @__PURE__ */ new Map();
    const newToOldUri = new ResourceMap();
    for (let idx = 0; idx < this._bulkEdit.length; idx++) {
      const edit = this._bulkEdit[idx];
      let uri;
      let type;
      this.checked.updateChecked(edit, !edit.metadata?.needsConfirmation);
      if (edit instanceof ResourceTextEdit) {
        type = 1 /* TextEdit */;
        uri = edit.resource;
      } else if (edit instanceof ResourceFileEdit) {
        if (edit.newResource && edit.oldResource) {
          type = 8 /* Rename */;
          uri = edit.oldResource;
          if (edit.options?.overwrite === void 0 && edit.options?.ignoreIfExists && await this._fileService.exists(uri)) {
            continue;
          }
          newToOldUri.set(edit.newResource, uri);
        } else if (edit.oldResource) {
          type = 4 /* Delete */;
          uri = edit.oldResource;
          if (edit.options?.ignoreIfNotExists && !await this._fileService.exists(uri)) {
            continue;
          }
        } else if (edit.newResource) {
          type = 2 /* Create */;
          uri = edit.newResource;
          if (edit.options?.overwrite === void 0 && edit.options?.ignoreIfExists && await this._fileService.exists(uri)) {
            continue;
          }
        } else {
          continue;
        }
      } else {
        continue;
      }
      const insert = (uri2, map) => {
        let key2 = extUri.getComparisonKey(uri2, true);
        let operation = map.get(key2);
        if (!operation && newToOldUri.has(uri2)) {
          uri2 = newToOldUri.get(uri2);
          key2 = extUri.getComparisonKey(uri2, true);
          operation = map.get(key2);
        }
        if (!operation) {
          operation = new BulkFileOperation(uri2, this);
          map.set(key2, operation);
        }
        operation.addEdit(idx, type, edit);
      };
      insert(uri, operationByResource);
      const key = BulkCategory.keyOf(edit.metadata);
      let category = operationByCategory.get(key);
      if (!category) {
        category = new BulkCategory(edit.metadata);
        operationByCategory.set(key, category);
      }
      insert(uri, category.operationByResource);
    }
    operationByResource.forEach((value) => this.fileOperations.push(value));
    operationByCategory.forEach((value) => this.categories.push(value));
    for (const file of this.fileOperations) {
      if (file.type !== 1 /* TextEdit */) {
        let checked = true;
        for (const edit of file.originalEdits.values()) {
          if (edit instanceof ResourceFileEdit) {
            checked = checked && this.checked.isChecked(edit);
          }
        }
        if (!checked) {
          for (const edit of file.originalEdits.values()) {
            this.checked.updateChecked(edit, checked);
          }
        }
      }
    }
    this.categories.sort((a, b) => {
      if (a.metadata.needsConfirmation === b.metadata.needsConfirmation) {
        return a.metadata.label.localeCompare(b.metadata.label);
      } else if (a.metadata.needsConfirmation) {
        return -1;
      } else {
        return 1;
      }
    });
    return this;
  }
  getWorkspaceEdit() {
    const result = [];
    let allAccepted = true;
    for (let i = 0; i < this._bulkEdit.length; i++) {
      const edit = this._bulkEdit[i];
      if (this.checked.isChecked(edit)) {
        result[i] = edit;
        continue;
      }
      allAccepted = false;
    }
    if (allAccepted) {
      return this._bulkEdit;
    }
    coalesceInPlace(result);
    return result;
  }
  async getFileEditOperation(edit) {
    const content = await edit.options.contents;
    if (!content) {
      return void 0;
    }
    return EditOperation.replaceMove(Range.lift({ startLineNumber: 0, startColumn: 0, endLineNumber: Number.MAX_VALUE, endColumn: 0 }), content.toString());
  }
  async getFileEdits(uri) {
    for (const file of this.fileOperations) {
      if (file.uri.toString() === uri.toString()) {
        const result = [];
        let ignoreAll = false;
        for (const edit of file.originalEdits.values()) {
          if (edit instanceof ResourceFileEdit) {
            result.push(this.getFileEditOperation(edit));
          } else if (edit instanceof ResourceTextEdit) {
            if (this.checked.isChecked(edit)) {
              result.push(Promise.resolve(EditOperation.replaceMove(Range.lift(edit.textEdit.range), !edit.textEdit.insertAsSnippet ? edit.textEdit.text : SnippetParser.asInsertText(edit.textEdit.text))));
            }
          } else if (!this.checked.isChecked(edit)) {
            ignoreAll = true;
          }
        }
        if (ignoreAll) {
          return [];
        }
        return (await Promise.all(result)).filter((r) => r !== void 0).sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
      }
    }
    return [];
  }
  getUriOfEdit(edit) {
    for (const file of this.fileOperations) {
      for (const value of file.originalEdits.values()) {
        if (value === edit) {
          return file.uri;
        }
      }
    }
    throw new Error("invalid edit");
  }
};
BulkFileOperations = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IInstantiationService)
], BulkFileOperations);
let BulkEditPreviewProvider = class {
  constructor(_operations, _languageService, _modelService, _textModelResolverService) {
    this._operations = _operations;
    this._languageService = _languageService;
    this._modelService = _modelService;
    this._textModelResolverService = _textModelResolverService;
    this._disposables = new DisposableStore();
    this._modelPreviewEdits = /* @__PURE__ */ new Map();
    this._instanceId = generateUuid();
    this._disposables.add(this._textModelResolverService.registerTextModelContentProvider(BulkEditPreviewProvider.Schema, this));
    this._ready = this._init();
  }
  static {
    this.Schema = "vscode-bulkeditpreview-editor";
  }
  static {
    this.emptyPreview = URI.from({ scheme: this.Schema, fragment: "empty" });
  }
  static fromPreviewUri(uri) {
    return URI.parse(uri.query);
  }
  dispose() {
    this._disposables.dispose();
  }
  asPreviewUri(uri) {
    const path = uri.scheme === Schemas.untitled ? `/${uri.path}` : uri.path;
    return URI.from({ scheme: BulkEditPreviewProvider.Schema, authority: this._instanceId, path, query: uri.toString() });
  }
  async _init() {
    for (const operation of this._operations.fileOperations) {
      await this._applyTextEditsToPreviewModel(operation.uri);
    }
    this._disposables.add(Event.debounce(this._operations.checked.onDidChange, (_last, e) => e, MicrotaskDelay)((e) => {
      const uri = this._operations.getUriOfEdit(e);
      this._applyTextEditsToPreviewModel(uri);
    }));
  }
  async _applyTextEditsToPreviewModel(uri) {
    const model = await this._getOrCreatePreviewModel(uri);
    const undoEdits = this._modelPreviewEdits.get(model.id);
    if (undoEdits) {
      model.applyEdits(undoEdits);
    }
    const newEdits = await this._operations.getFileEdits(uri);
    const newUndoEdits = model.applyEdits(newEdits, true);
    this._modelPreviewEdits.set(model.id, newUndoEdits);
  }
  async _getOrCreatePreviewModel(uri) {
    const previewUri = this.asPreviewUri(uri);
    let model = this._modelService.getModel(previewUri);
    if (!model) {
      try {
        const ref = await this._textModelResolverService.createModelReference(uri);
        const sourceModel = ref.object.textEditorModel;
        model = this._modelService.createModel(
          createTextBufferFactoryFromSnapshot(sourceModel.createSnapshot()),
          this._languageService.createById(sourceModel.getLanguageId()),
          previewUri
        );
        ref.dispose();
      } catch {
        model = this._modelService.createModel(
          "",
          this._languageService.createByFilepathOrFirstLine(previewUri),
          previewUri
        );
      }
      queueMicrotask(async () => {
        this._disposables.add(await this._textModelResolverService.createModelReference(model.uri));
      });
    }
    return model;
  }
  async provideTextContent(previewUri) {
    if (previewUri.toString() === BulkEditPreviewProvider.emptyPreview.toString()) {
      return this._modelService.createModel("", null, previewUri);
    }
    await this._ready;
    return this._modelService.getModel(previewUri);
  }
};
BulkEditPreviewProvider = __decorateClass([
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ITextModelService)
], BulkEditPreviewProvider);
export {
  BulkCategory,
  BulkEditPreviewProvider,
  BulkFileOperation,
  BulkFileOperationType,
  BulkFileOperations,
  BulkTextEdit,
  CheckedStates
};
