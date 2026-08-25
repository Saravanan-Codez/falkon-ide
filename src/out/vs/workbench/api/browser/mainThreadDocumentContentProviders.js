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
import { onUnexpectedError } from "../../../base/common/errors.js";
import { dispose, DisposableMap } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { EditOperation } from "../../../editor/common/core/editOperation.js";
import { Range } from "../../../editor/common/core/range.js";
import { IEditorWorkerService } from "../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
let MainThreadDocumentContentProviders = class {
  constructor(extHostContext, _textModelResolverService, _languageService, _modelService, _editorWorkerService) {
    this._textModelResolverService = _textModelResolverService;
    this._languageService = _languageService;
    this._modelService = _modelService;
    this._editorWorkerService = _editorWorkerService;
    this._resourceContentProvider = new DisposableMap();
    this._pendingUpdate = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDocumentContentProviders);
  }
  dispose() {
    this._resourceContentProvider.dispose();
    dispose(this._pendingUpdate.values());
  }
  $registerTextContentProvider(handle, scheme) {
    const registration = this._textModelResolverService.registerTextModelContentProvider(scheme, {
      provideTextContent: (uri) => {
        return this._proxy.$provideTextDocumentContent(handle, uri).then((value) => {
          if (typeof value === "string") {
            const firstLineText = value.substr(0, 1 + value.search(/\r?\n/));
            const languageSelection = this._languageService.createByFilepathOrFirstLine(uri, firstLineText);
            return this._modelService.createModel(value, languageSelection, uri);
          }
          return null;
        });
      }
    });
    this._resourceContentProvider.set(handle, registration);
  }
  $unregisterTextContentProvider(handle) {
    this._resourceContentProvider.deleteAndDispose(handle);
  }
  async $onVirtualDocumentChange(uri, value) {
    const model = this._modelService.getModel(URI.revive(uri));
    if (!model) {
      return;
    }
    const pending = this._pendingUpdate.get(model.id);
    pending?.cancel();
    const myToken = new CancellationTokenSource();
    this._pendingUpdate.set(model.id, myToken);
    try {
      const edits = await this._editorWorkerService.computeMoreMinimalEdits(model.uri, [{ text: value, range: model.getFullModelRange() }]);
      this._pendingUpdate.delete(model.id);
      if (myToken.token.isCancellationRequested) {
        return;
      }
      if (model.isDisposed()) {
        return;
      }
      if (edits && edits.length > 0) {
        model.applyEdits(edits.map((edit) => EditOperation.replace(Range.lift(edit.range), edit.text)));
      }
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
MainThreadDocumentContentProviders = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDocumentContentProviders),
  __decorateParam(1, ITextModelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IEditorWorkerService)
], MainThreadDocumentContentProviders);
export {
  MainThreadDocumentContentProviders
};
