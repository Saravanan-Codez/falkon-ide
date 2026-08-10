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
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { computeDiff } from "../../../../notebook/common/notebookDiff.js";
import { INotebookEditorModelResolverService } from "../../../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookLoggingService } from "../../../../notebook/common/notebookLoggingService.js";
import { INotebookEditorWorkerService } from "../../../../notebook/common/services/notebookWorkerService.js";
let ChatEditingModifiedNotebookDiff = class {
  constructor(original, modified, notebookEditorWorkerService, notebookLoggingService, notebookEditorModelService) {
    this.original = original;
    this.modified = modified;
    this.notebookEditorWorkerService = notebookEditorWorkerService;
    this.notebookLoggingService = notebookLoggingService;
    this.notebookEditorModelService = notebookEditorModelService;
  }
  static {
    this.NewModelCounter = 0;
  }
  async computeDiff() {
    let added = 0;
    let removed = 0;
    const disposables = new DisposableStore();
    try {
      const [modifiedRef, originalRef] = await Promise.all([
        this.notebookEditorModelService.resolve(this.modified.snapshotUri),
        this.notebookEditorModelService.resolve(this.original.snapshotUri)
      ]);
      disposables.add(modifiedRef);
      disposables.add(originalRef);
      const notebookDiff = await this.notebookEditorWorkerService.computeDiff(this.original.snapshotUri, this.modified.snapshotUri);
      const result = computeDiff(originalRef.object.notebook, modifiedRef.object.notebook, notebookDiff);
      result.cellDiffInfo.forEach((diff) => {
        switch (diff.type) {
          case "modified":
          case "insert":
            added++;
            break;
          case "delete":
            removed++;
            break;
          default:
            break;
        }
      });
    } catch (e) {
      this.notebookLoggingService.error("Notebook Chat", "Error computing diff:\n" + e);
    } finally {
      disposables.dispose();
    }
    return {
      added,
      removed,
      identical: added === 0 && removed === 0,
      quitEarly: false,
      isFinal: true,
      modifiedURI: this.modified.snapshotUri,
      originalURI: this.original.snapshotUri,
      isBusy: false
    };
  }
};
ChatEditingModifiedNotebookDiff = __decorateClass([
  __decorateParam(2, INotebookEditorWorkerService),
  __decorateParam(3, INotebookLoggingService),
  __decorateParam(4, INotebookEditorModelResolverService)
], ChatEditingModifiedNotebookDiff);
export {
  ChatEditingModifiedNotebookDiff
};
