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
import { decodeBase64 } from "../../../base/common/buffer.js";
import { revive } from "../../../base/common/marshalling.js";
import { IBulkEditService, ResourceFileEdit, ResourceTextEdit } from "../../../editor/browser/services/bulkEditService.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { MainContext } from "../common/extHost.protocol.js";
import { ResourceNotebookCellEdit } from "../../contrib/bulkEdit/browser/bulkCellEdits.js";
import { CellEditType } from "../../contrib/notebook/common/notebookCommon.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadBulkEdits = class {
  constructor(_extHostContext, _bulkEditService, _logService, _uriIdentService) {
    this._bulkEditService = _bulkEditService;
    this._logService = _logService;
    this._uriIdentService = _uriIdentService;
  }
  dispose() {
  }
  $tryApplyWorkspaceEdit(dto, undoRedoGroupId, isRefactoring) {
    const edits = reviveWorkspaceEditDto(dto.value, this._uriIdentService);
    return this._bulkEditService.apply(edits, { undoRedoGroupId, respectAutoSaveConfig: isRefactoring }).then((res) => res.isApplied, (err) => {
      this._logService.warn(`IGNORING workspace edit: ${err}`);
      return false;
    });
  }
};
MainThreadBulkEdits = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadBulkEdits),
  __decorateParam(1, IBulkEditService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IUriIdentityService)
], MainThreadBulkEdits);
function reviveWorkspaceEditDto(data, uriIdentityService, resolveDataTransferFile) {
  if (!data || !data.edits) {
    return data;
  }
  const result = revive(data);
  for (const edit of result.edits) {
    if (ResourceTextEdit.is(edit)) {
      edit.resource = uriIdentityService.asCanonicalUri(edit.resource);
    }
    if (ResourceFileEdit.is(edit)) {
      if (edit.options) {
        const inContents = edit.options?.contents;
        if (inContents) {
          if (inContents.type === "base64") {
            edit.options.contents = Promise.resolve(decodeBase64(inContents.value));
          } else {
            if (resolveDataTransferFile) {
              edit.options.contents = resolveDataTransferFile(inContents.id);
            } else {
              throw new Error("Could not revive data transfer file");
            }
          }
        }
      }
      edit.newResource = edit.newResource && uriIdentityService.asCanonicalUri(edit.newResource);
      edit.oldResource = edit.oldResource && uriIdentityService.asCanonicalUri(edit.oldResource);
    }
    if (ResourceNotebookCellEdit.is(edit)) {
      edit.resource = uriIdentityService.asCanonicalUri(edit.resource);
      const cellEdit = edit.cellEdit;
      if (cellEdit.editType === CellEditType.Replace) {
        edit.cellEdit = {
          ...cellEdit,
          cells: cellEdit.cells.map((cell) => ({
            ...cell,
            outputs: cell.outputs.map((output) => ({
              ...output,
              outputs: output.items.map((item) => {
                return {
                  mime: item.mime,
                  data: item.valueBytes
                };
              })
            }))
          }))
        };
      }
    }
  }
  return data;
}
export {
  MainThreadBulkEdits,
  reviveWorkspaceEditDto
};
