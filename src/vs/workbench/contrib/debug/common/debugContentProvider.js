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
import { localize } from "../../../../nls.js";
import { getMimeTypes } from "../../../../editor/common/services/languagesAssociations.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { DEBUG_SCHEME, IDebugService } from "./debug.js";
import { Source } from "./debugSource.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { ErrorNoTelemetry } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
let DebugContentProvider = class extends Disposable {
  constructor(textModelResolverService, debugService, modelService, languageService, editorWorkerService) {
    super();
    this.debugService = debugService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.editorWorkerService = editorWorkerService;
    this.pendingUpdates = /* @__PURE__ */ new Map();
    this._store.add(textModelResolverService.registerTextModelContentProvider(DEBUG_SCHEME, this));
    DebugContentProvider.INSTANCE = this;
  }
  dispose() {
    this.pendingUpdates.forEach((cancellationSource) => cancellationSource.dispose());
    super.dispose();
  }
  provideTextContent(resource) {
    return this.createOrUpdateContentModel(resource, true);
  }
  /**
   * Reload the model content of the given resource.
   * If there is no model for the given resource, this method does nothing.
   */
  static refreshDebugContent(resource) {
    DebugContentProvider.INSTANCE?.createOrUpdateContentModel(resource, false);
  }
  /**
   * Create or reload the model content of the given resource.
   */
  createOrUpdateContentModel(resource, createIfNotExists) {
    const model = this.modelService.getModel(resource);
    if (!model && !createIfNotExists) {
      return null;
    }
    let session;
    if (resource.query) {
      const data = Source.getEncodedDebugData(resource);
      session = this.debugService.getModel().getSession(data.sessionId);
    }
    if (!session) {
      session = this.debugService.getViewModel().focusedSession;
    }
    if (!session) {
      return Promise.reject(new ErrorNoTelemetry(localize("unable", "Unable to resolve the resource without a debug session")));
    }
    const createErrModel = (errMsg) => {
      this.debugService.sourceIsNotAvailable(resource);
      const languageSelection = this.languageService.createById(PLAINTEXT_LANGUAGE_ID);
      const message = errMsg ? localize("canNotResolveSourceWithError", "Could not load source '{0}': {1}.", resource.path, errMsg) : localize("canNotResolveSource", "Could not load source '{0}'.", resource.path);
      return this.modelService.createModel(message, languageSelection, resource);
    };
    return session.loadSource(resource).then((response) => {
      if (response && response.body) {
        if (model) {
          const newContent = response.body.content;
          const cancellationSource = this.pendingUpdates.get(model.id);
          cancellationSource?.cancel();
          const myToken = new CancellationTokenSource();
          this.pendingUpdates.set(model.id, myToken);
          return this.editorWorkerService.computeMoreMinimalEdits(model.uri, [{ text: newContent, range: model.getFullModelRange() }]).then((edits) => {
            this.pendingUpdates.delete(model.id);
            if (!myToken.token.isCancellationRequested && edits && edits.length > 0) {
              model.applyEdits(edits.map((edit) => EditOperation.replace(Range.lift(edit.range), edit.text)));
            }
            return model;
          });
        } else {
          const mime = response.body.mimeType || getMimeTypes(resource)[0];
          const languageSelection = this.languageService.createByMimeType(mime);
          return this.modelService.createModel(response.body.content, languageSelection, resource);
        }
      }
      return createErrModel();
    }, (err) => createErrModel(err.message));
  }
};
DebugContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IDebugService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IEditorWorkerService)
], DebugContentProvider);
export {
  DebugContentProvider
};
