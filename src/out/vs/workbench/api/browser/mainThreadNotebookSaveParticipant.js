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
import { localize } from "../../../nls.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { extHostCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext } from "../common/extHost.protocol.js";
import { raceCancellationError } from "../../../base/common/async.js";
import { IWorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { NotebookFileWorkingCopyModel } from "../../contrib/notebook/common/notebookEditorModel.js";
class ExtHostNotebookDocumentSaveParticipant {
  constructor(extHostContext) {
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookDocumentSaveParticipant);
  }
  async participate(workingCopy, context, _progress, token) {
    if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
      return void 0;
    }
    let _warningTimeout;
    const p = new Promise((resolve, reject) => {
      _warningTimeout = setTimeout(
        () => reject(new Error(localize("timeout.onWillSave", "Aborted onWillSaveNotebookDocument-event after 1750ms"))),
        1750
      );
      this._proxy.$participateInSave(workingCopy.resource, context.reason, token).then((_) => {
        clearTimeout(_warningTimeout);
        return void 0;
      }).then(resolve, reject);
    });
    return raceCancellationError(p, token);
  }
}
let SaveParticipant = class {
  constructor(extHostContext, instantiationService, workingCopyFileService) {
    this.workingCopyFileService = workingCopyFileService;
    this._saveParticipantDisposable = this.workingCopyFileService.addSaveParticipant(instantiationService.createInstance(ExtHostNotebookDocumentSaveParticipant, extHostContext));
  }
  dispose() {
    this._saveParticipantDisposable.dispose();
  }
};
SaveParticipant = __decorateClass([
  extHostCustomer,
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkingCopyFileService)
], SaveParticipant);
export {
  SaveParticipant
};
