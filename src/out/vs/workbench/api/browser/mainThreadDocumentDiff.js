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
import { URI } from "../../../base/common/uri.js";
import { IEditorWorkerService } from "../../../editor/common/services/editorWorker.js";
import { MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadDocumentDiff = class {
  constructor(_extHostContext, _editorWorkerService) {
    this._editorWorkerService = _editorWorkerService;
  }
  async $computeDocumentDiff(originalUri, modifiedUri, ignoreTrimWhitespace, maxComputationTimeMs, computeMoves) {
    const original = URI.revive(originalUri);
    const modified = URI.revive(modifiedUri);
    const result = await this._editorWorkerService.computeDiff(original, modified, {
      ignoreTrimWhitespace,
      maxComputationTimeMs,
      computeMoves
    }, "advanced");
    if (!result) {
      return null;
    }
    const toLineRange = (r) => ({
      startLineNumber: r.startLineNumber,
      startColumn: 1,
      endLineNumber: r.endLineNumberExclusive,
      endColumn: 1
    });
    const mapChange = (c) => ({
      originalRange: toLineRange(c.original),
      modifiedRange: toLineRange(c.modified),
      innerChanges: c.innerChanges?.map((ic) => ({
        originalRange: ic.originalRange,
        modifiedRange: ic.modifiedRange
      }))
    });
    return {
      identical: result.identical,
      quitEarly: result.quitEarly,
      changes: result.changes.map(mapChange),
      moves: result.moves.map((m) => ({
        originalRange: toLineRange(m.lineRangeMapping.original),
        modifiedRange: toLineRange(m.lineRangeMapping.modified),
        changes: m.changes.map(mapChange)
      }))
    };
  }
  dispose() {
  }
};
MainThreadDocumentDiff = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDocumentDiff),
  __decorateParam(1, IEditorWorkerService)
], MainThreadDocumentDiff);
export {
  MainThreadDocumentDiff
};
