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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { revive } from "../../../base/common/marshalling.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { isUriComponents, URI } from "../../../base/common/uri.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { toToolSetKey } from "../../contrib/chat/common/tools/languageModelToolsContribution.js";
import { ILanguageModelToolsService, ToolDataSource, toolResultHasBuffers, ToolSet } from "../../contrib/chat/common/tools/languageModelToolsService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadLanguageModelTools = class extends Disposable {
  constructor(extHostContext, _languageModelToolsService, _logService, _productService) {
    super();
    this._languageModelToolsService = _languageModelToolsService;
    this._logService = _logService;
    this._productService = _productService;
    this._tools = this._register(new DisposableMap());
    this._runningToolCalls = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageModelTools);
    this._register(this._languageModelToolsService.onDidChangeTools((e) => this._proxy.$onDidChangeTools(this.getToolDtos())));
  }
  getToolDtos() {
    const fullReferenceNameMap = this._languageModelToolsService.getFullReferenceNameMap();
    return Array.from(this._languageModelToolsService.getAllToolsIncludingDisabled()).map((tool) => ({
      id: tool.id,
      displayName: tool.displayName,
      toolReferenceName: tool.toolReferenceName,
      legacyToolReferenceFullNames: tool.legacyToolReferenceFullNames,
      fullReferenceName: fullReferenceNameMap.get(tool) ?? void 0,
      tags: tool.tags,
      userDescription: tool.userDescription,
      modelDescription: tool.modelDescription,
      inputSchema: tool.inputSchema,
      source: tool.source
    }));
  }
  async $getTools() {
    return this.getToolDtos();
  }
  async $invokeTool(dto, token) {
    const result = await this._languageModelToolsService.invokeTool(
      revive(dto),
      (input, token2) => this._proxy.$countTokensForInvocation(dto.callId, input, token2),
      token ?? CancellationToken.None
    );
    const out = {
      content: result.content,
      toolMetadata: result.toolMetadata,
      toolResultError: result.toolResultError
    };
    return toolResultHasBuffers(result) ? new SerializableObjectWithBuffers(out) : out;
  }
  $acceptToolProgress(callId, progress) {
    this._runningToolCalls.get(callId)?.progress.report(progress);
  }
  $countTokensForInvocation(callId, input, token) {
    const fn = this._runningToolCalls.get(callId);
    if (!fn) {
      throw new Error(`Tool invocation call ${callId} not found`);
    }
    return fn.countTokens(input, token);
  }
  $registerTool(id, hasHandleToolStream) {
    const disposable = this._languageModelToolsService.registerToolImplementation(
      id,
      {
        invoke: async (dto, countTokens, progress, token) => {
          try {
            this._runningToolCalls.set(dto.callId, { countTokens, progress });
            const resultSerialized = await this._proxy.$invokeTool(dto, token);
            const resultDto = resultSerialized instanceof SerializableObjectWithBuffers ? resultSerialized.value : resultSerialized;
            return revive(resultDto);
          } finally {
            this._runningToolCalls.delete(dto.callId);
          }
        },
        prepareToolInvocation: (context, token) => this._proxy.$prepareToolInvocation(id, context, token),
        handleToolStream: hasHandleToolStream ? (context, token) => this._proxy.$handleToolStream(id, context, token) : void 0
      }
    );
    this._tools.set(id, disposable);
  }
  $registerToolWithDefinition(extensionId, definition, hasHandleToolStream) {
    let icon;
    if (definition.icon) {
      if (ThemeIcon.isThemeIcon(definition.icon)) {
        icon = definition.icon;
      } else if (typeof definition.icon === "object" && definition.icon !== null && isUriComponents(definition.icon)) {
        icon = { dark: URI.revive(definition.icon) };
      } else {
        const iconObj = definition.icon;
        icon = { dark: URI.revive(iconObj.dark), light: iconObj.light ? URI.revive(iconObj.light) : void 0 };
      }
    }
    const isBuiltinTool = this._productService.defaultChatAgent?.chatExtensionId ? ExtensionIdentifier.equals(extensionId, this._productService.defaultChatAgent.chatExtensionId) : false;
    const source = isBuiltinTool ? ToolDataSource.Internal : revive(definition.source);
    const toolData = {
      id: definition.id,
      displayName: definition.displayName,
      toolReferenceName: definition.toolReferenceName,
      legacyToolReferenceFullNames: definition.legacyToolReferenceFullNames,
      tags: definition.tags,
      userDescription: definition.userDescription,
      modelDescription: definition.modelDescription,
      inputSchema: definition.inputSchema,
      source,
      icon,
      models: definition.models,
      canBeReferencedInPrompt: !!definition.userDescription && !definition.toolSet
    };
    const id = definition.id;
    const store = new DisposableStore();
    store.add(this._languageModelToolsService.registerTool(
      toolData,
      {
        invoke: async (dto, countTokens, progress, token) => {
          try {
            this._runningToolCalls.set(dto.callId, { countTokens, progress });
            const resultSerialized = await this._proxy.$invokeTool(dto, token);
            const resultDto = resultSerialized instanceof SerializableObjectWithBuffers ? resultSerialized.value : resultSerialized;
            return revive(resultDto);
          } finally {
            this._runningToolCalls.delete(dto.callId);
          }
        },
        handleToolStream: hasHandleToolStream ? (context, token) => this._proxy.$handleToolStream(id, context, token) : void 0,
        prepareToolInvocation: (context, token) => this._proxy.$prepareToolInvocation(id, context, token)
      }
    ));
    if (definition.toolSet) {
      const ts = this._languageModelToolsService.getToolSet(toToolSetKey(extensionId, definition.toolSet)) || this._languageModelToolsService.getToolSet(definition.toolSet);
      if (!ts || !(ts instanceof ToolSet)) {
        this._logService.warn(`ToolSet ${definition.toolSet} not found for tool ${definition.id} from extension ${extensionId.value}`);
      } else {
        store.add(ts.addTool(toolData));
      }
    }
    this._tools.set(id, store);
  }
  $unregisterTool(name) {
    this._tools.deleteAndDispose(name);
  }
};
MainThreadLanguageModelTools = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadLanguageModelTools),
  __decorateParam(1, ILanguageModelToolsService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IProductService)
], MainThreadLanguageModelTools);
export {
  MainThreadLanguageModelTools
};
