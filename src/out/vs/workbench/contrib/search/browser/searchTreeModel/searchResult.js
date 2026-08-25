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
import { PauseableEmitter } from "../../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { NotebookEditorWidget } from "../../../notebook/browser/notebookEditorWidget.js";
import { INotebookEditorService } from "../../../notebook/browser/services/notebookEditorService.js";
import { QueryType } from "../../../../services/search/common/search.js";
import { arrayContainsElementOrParent, isSearchTreeFileMatch, isSearchTreeFolderMatch, isSearchTreeFolderMatchNoRoot, isSearchTreeFolderMatchWithResource, isSearchTreeMatch, isTextSearchHeading, mergeSearchResultEvents, SEARCH_RESULT_PREFIX } from "./searchTreeCommon.js";
import { PlainTextSearchHeadingImpl } from "./textSearchHeading.js";
import { AITextSearchHeadingImpl } from "../AISearch/aiSearchModel.js";
let SearchResultImpl = class extends Disposable {
  constructor(searchModel, instantiationService, modelService, notebookEditorService) {
    super();
    this.searchModel = searchModel;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.notebookEditorService = notebookEditorService;
    this._onChange = this._register(new PauseableEmitter({
      merge: mergeSearchResultEvents
    }));
    this.onChange = this._onChange.event;
    this._onWillChangeModelListener = this._register(new MutableDisposable());
    this._onDidChangeModelListener = this._register(new MutableDisposable());
    this._plainTextSearchResult = this._register(this.instantiationService.createInstance(PlainTextSearchHeadingImpl, this));
    this._aiTextSearchResult = this._register(this.instantiationService.createInstance(AITextSearchHeadingImpl, this));
    this._register(this._plainTextSearchResult.onChange((e) => this._onChange.fire(e)));
    this._register(this._aiTextSearchResult.onChange((e) => this._onChange.fire(e)));
    this.modelService.getModels().forEach((model) => this.onModelAdded(model));
    this._register(this.modelService.onModelAdded((model) => this.onModelAdded(model)));
    this._register(this.notebookEditorService.onDidAddNotebookEditor((widget) => {
      if (widget instanceof NotebookEditorWidget) {
        this.onDidAddNotebookEditorWidget(widget);
      }
    }));
    this._id = SEARCH_RESULT_PREFIX + Date.now().toString();
  }
  id() {
    return this._id;
  }
  get plainTextSearchResult() {
    return this._plainTextSearchResult;
  }
  get aiTextSearchResult() {
    return this._aiTextSearchResult;
  }
  get children() {
    return this.textSearchResults;
  }
  get hasChildren() {
    return true;
  }
  get textSearchResults() {
    return [this._plainTextSearchResult, this._aiTextSearchResult];
  }
  async batchReplace(elementsToReplace) {
    try {
      this._onChange.pause();
      await Promise.all(elementsToReplace.map(async (elem) => {
        const parent = elem.parent();
        if ((isSearchTreeFolderMatch(parent) || isSearchTreeFileMatch(parent)) && arrayContainsElementOrParent(parent, elementsToReplace)) {
          return;
        }
        if (isSearchTreeFileMatch(elem)) {
          await elem.parent().replace(elem);
        } else if (isSearchTreeMatch(elem)) {
          await elem.parent().replace(elem);
        } else if (isSearchTreeFolderMatch(elem)) {
          await elem.replaceAll();
        }
      }));
    } finally {
      this._onChange.resume();
    }
  }
  batchRemove(elementsToRemove) {
    const removedElems = [];
    try {
      this._onChange.pause();
      elementsToRemove.forEach(
        (currentElement) => {
          if (!arrayContainsElementOrParent(currentElement, removedElems)) {
            if (isTextSearchHeading(currentElement)) {
              currentElement.hide();
            } else if (!isSearchTreeFolderMatch(currentElement) || isSearchTreeFolderMatchWithResource(currentElement) || isSearchTreeFolderMatchNoRoot(currentElement)) {
              if (isSearchTreeFileMatch(currentElement)) {
                currentElement.parent().remove(currentElement);
              } else if (isSearchTreeMatch(currentElement)) {
                currentElement.parent().remove(currentElement);
              } else if (isSearchTreeFolderMatchWithResource(currentElement)) {
                currentElement.parent().remove(currentElement);
              } else if (isSearchTreeFolderMatchNoRoot(currentElement)) {
                const parent = currentElement.parent();
                if (isTextSearchHeading(parent)) {
                  parent.remove(currentElement);
                }
              }
              removedElems.push(currentElement);
            }
          }
        }
      );
    } finally {
      this._onChange.resume();
    }
  }
  get isDirty() {
    return this._aiTextSearchResult.isDirty || this._plainTextSearchResult.isDirty;
  }
  get query() {
    return this._plainTextSearchResult.query;
  }
  set query(query) {
    this._plainTextSearchResult.query = query;
  }
  setAIQueryUsingTextQuery(query) {
    if (!query) {
      query = this.query;
    }
    this.aiTextSearchResult.query = aiTextQueryFromTextQuery(query);
  }
  onDidAddNotebookEditorWidget(widget) {
    this._onWillChangeModelListener.value = widget.onWillChangeModel(
      (model) => {
        if (model) {
          this.onNotebookEditorWidgetRemoved(widget, model?.uri);
        }
      }
    );
    this._onDidChangeModelListener.value = widget.onDidAttachViewModel(
      () => {
        if (widget.hasModel()) {
          this.onNotebookEditorWidgetAdded(widget, widget.textModel.uri);
        }
      }
    );
  }
  folderMatches(ai = false) {
    if (ai) {
      return this._aiTextSearchResult.folderMatches();
    }
    return this._plainTextSearchResult.folderMatches();
  }
  onModelAdded(model) {
    const folderMatch = this._plainTextSearchResult.findFolderSubstr(model.uri);
    folderMatch?.bindModel(model);
  }
  async onNotebookEditorWidgetAdded(editor, resource) {
    const folderMatch = this._plainTextSearchResult.findFolderSubstr(resource);
    await folderMatch?.bindNotebookEditorWidget(editor, resource);
  }
  onNotebookEditorWidgetRemoved(editor, resource) {
    const folderMatch = this._plainTextSearchResult.findFolderSubstr(resource);
    folderMatch?.unbindNotebookEditorWidget(editor, resource);
  }
  add(allRaw, searchInstanceID, ai, silent = false) {
    this._plainTextSearchResult.hidden = false;
    if (ai) {
      this._aiTextSearchResult.add(allRaw, searchInstanceID, silent);
    } else {
      this._plainTextSearchResult.add(allRaw, searchInstanceID, silent);
    }
  }
  clear() {
    this._plainTextSearchResult.clear();
    this._aiTextSearchResult.clear();
  }
  remove(matches, ai = false) {
    if (ai) {
      this._aiTextSearchResult.remove(matches, ai);
    }
    this._plainTextSearchResult.remove(matches, ai);
  }
  replace(match) {
    return this._plainTextSearchResult.replace(match);
  }
  matches(ai) {
    if (ai === void 0) {
      return this._plainTextSearchResult.matches().concat(this._aiTextSearchResult.matches());
    } else if (ai === true) {
      return this._aiTextSearchResult.matches();
    }
    return this._plainTextSearchResult.matches();
  }
  isEmpty() {
    return this._plainTextSearchResult.isEmpty() && this._aiTextSearchResult.isEmpty();
  }
  fileCount(ignoreSemanticSearchResults = false) {
    if (ignoreSemanticSearchResults) {
      return this._plainTextSearchResult.fileCount();
    }
    return this._plainTextSearchResult.fileCount() + this._aiTextSearchResult.fileCount();
  }
  count(ignoreSemanticSearchResults = false) {
    if (ignoreSemanticSearchResults) {
      return this._plainTextSearchResult.count();
    }
    return this._plainTextSearchResult.count() + this._aiTextSearchResult.count();
  }
  setCachedSearchComplete(cachedSearchComplete, ai) {
    if (ai) {
      this._aiTextSearchResult.cachedSearchComplete = cachedSearchComplete;
    } else {
      this._plainTextSearchResult.cachedSearchComplete = cachedSearchComplete;
    }
  }
  getCachedSearchComplete(ai) {
    if (ai) {
      return this._aiTextSearchResult.cachedSearchComplete;
    }
    return this._plainTextSearchResult.cachedSearchComplete;
  }
  toggleHighlights(value, ai = false) {
    if (ai) {
      this._aiTextSearchResult.toggleHighlights(value);
    } else {
      this._plainTextSearchResult.toggleHighlights(value);
    }
  }
  getRangeHighlightDecorations(ai = false) {
    if (ai) {
      return this._aiTextSearchResult.rangeHighlightDecorations;
    }
    return this._plainTextSearchResult.rangeHighlightDecorations;
  }
  replaceAll(progress) {
    return this._plainTextSearchResult.replaceAll(progress);
  }
  async dispose() {
    this._aiTextSearchResult?.dispose();
    this._plainTextSearchResult?.dispose();
    super.dispose();
  }
};
SearchResultImpl = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IModelService),
  __decorateParam(3, INotebookEditorService)
], SearchResultImpl);
function aiTextQueryFromTextQuery(query) {
  return query === null ? null : { ...query, contentPattern: query.contentPattern.pattern, type: QueryType.aiText };
}
export {
  SearchResultImpl
};
