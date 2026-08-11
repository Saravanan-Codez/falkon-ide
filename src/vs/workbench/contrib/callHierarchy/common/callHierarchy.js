import { CancellationToken } from "../../../../base/common/cancellation.js";
import { LanguageFeatureRegistry } from "../../../../editor/common/languageFeatureRegistry.js";
import { URI } from "../../../../base/common/uri.js";
import { Position } from "../../../../editor/common/core/position.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { RefCountedDisposable } from "../../../../base/common/lifecycle.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { assertType } from "../../../../base/common/types.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
var CallHierarchyDirection = /* @__PURE__ */ ((CallHierarchyDirection2) => {
  CallHierarchyDirection2["CallsTo"] = "incomingCalls";
  CallHierarchyDirection2["CallsFrom"] = "outgoingCalls";
  return CallHierarchyDirection2;
})(CallHierarchyDirection || {});
const CallHierarchyProviderRegistry = new LanguageFeatureRegistry();
class CallHierarchyModel {
  constructor(id, provider, roots, ref) {
    this.id = id;
    this.provider = provider;
    this.roots = roots;
    this.ref = ref;
    this.root = roots[0];
  }
  static async create(model, position, token) {
    const [provider] = CallHierarchyProviderRegistry.ordered(model);
    if (!provider) {
      return void 0;
    }
    const session = await provider.prepareCallHierarchy(model, position, token);
    if (!session) {
      return void 0;
    }
    return new CallHierarchyModel(session.roots.reduce((p, c) => p + c._sessionId, ""), provider, session.roots, new RefCountedDisposable(session));
  }
  dispose() {
    this.ref.release();
  }
  fork(item) {
    const that = this;
    return new class extends CallHierarchyModel {
      constructor() {
        super(that.id, that.provider, [item], that.ref.acquire());
      }
    }();
  }
  async resolveIncomingCalls(item, token) {
    try {
      const result = await this.provider.provideIncomingCalls(item, token);
      if (isNonEmptyArray(result)) {
        return result;
      }
    } catch (e) {
      onUnexpectedExternalError(e);
    }
    return [];
  }
  async resolveOutgoingCalls(item, token) {
    try {
      const result = await this.provider.provideOutgoingCalls(item, token);
      if (isNonEmptyArray(result)) {
        return result;
      }
    } catch (e) {
      onUnexpectedExternalError(e);
    }
    return [];
  }
}
const _models = /* @__PURE__ */ new Map();
CommandsRegistry.registerCommand("_executePrepareCallHierarchy", async (accessor, ...args) => {
  const [resource, position] = args;
  assertType(URI.isUri(resource));
  assertType(Position.isIPosition(position));
  const modelService = accessor.get(IModelService);
  let textModel = modelService.getModel(resource);
  let textModelReference;
  if (!textModel) {
    const textModelService = accessor.get(ITextModelService);
    const result = await textModelService.createModelReference(resource);
    textModel = result.object.textEditorModel;
    textModelReference = result;
  }
  try {
    const model = await CallHierarchyModel.create(textModel, position, CancellationToken.None);
    if (!model) {
      return [];
    }
    _models.set(model.id, model);
    _models.forEach((value, key, map) => {
      if (map.size > 10) {
        value.dispose();
        _models.delete(key);
      }
    });
    return [model.root];
  } finally {
    textModelReference?.dispose();
  }
});
function isCallHierarchyItemDto(obj) {
  return true;
}
CommandsRegistry.registerCommand("_executeProvideIncomingCalls", async (_accessor, ...args) => {
  const [item] = args;
  assertType(isCallHierarchyItemDto(item));
  const model = _models.get(item._sessionId);
  if (!model) {
    return [];
  }
  return model.resolveIncomingCalls(item, CancellationToken.None);
});
CommandsRegistry.registerCommand("_executeProvideOutgoingCalls", async (_accessor, ...args) => {
  const [item] = args;
  assertType(isCallHierarchyItemDto(item));
  const model = _models.get(item._sessionId);
  if (!model) {
    return [];
  }
  return model.resolveOutgoingCalls(item, CancellationToken.None);
});
export {
  CallHierarchyDirection,
  CallHierarchyModel,
  CallHierarchyProviderRegistry
};
