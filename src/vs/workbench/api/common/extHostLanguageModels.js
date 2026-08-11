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
import { AsyncIterableProducer, AsyncIterableSource, RunOnceScheduler } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { transformErrorForSerialization, transformErrorFromSerialization } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Iterable } from "../../../base/common/iterator.js";
import { DisposableMap, toDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { ExtensionIdentifier, ExtensionIdentifierMap, ExtensionIdentifierSet } from "../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { Progress } from "../../../platform/progress/common/progress.js";
import { COPILOT_VENDOR_ID } from "../../contrib/chat/common/languageModels.js";
import { INTERNAL_AUTH_PROVIDER_PREFIX } from "../../services/authentication/common/authentication.js";
import { checkProposedApiEnabled, isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostAuthentication } from "./extHostAuthentication.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import * as typeConvert from "./extHostTypeConverters.js";
import * as extHostTypes from "./extHostTypes.js";
import { ChatAgentLocation } from "../../contrib/chat/common/constants.js";
const IExtHostLanguageModels = createDecorator("IExtHostLanguageModels");
class LanguageModelResponse {
  constructor() {
    this._defaultStream = new AsyncIterableSource();
    this._isDone = false;
    const that = this;
    const [stream1, stream2] = AsyncIterableProducer.tee(that._defaultStream.asyncIterable);
    this.apiObject = {
      // result: promise,
      get stream() {
        return stream1;
      },
      get text() {
        return stream2.map((part) => {
          if (part instanceof extHostTypes.LanguageModelTextPart) {
            return part.value;
          } else {
            return void 0;
          }
        }).coalesce();
      }
    };
  }
  handleResponsePart(parts) {
    if (this._isDone) {
      return;
    }
    const lmResponseParts = [];
    for (const part of Iterable.wrap(parts)) {
      let out;
      if (part.type === "text") {
        out = new extHostTypes.LanguageModelTextPart(part.value, part.audience);
      } else if (part.type === "thinking") {
        out = new extHostTypes.LanguageModelThinkingPart(part.value, part.id, part.metadata);
      } else if (part.type === "data") {
        out = new extHostTypes.LanguageModelDataPart(part.data.buffer, part.mimeType, part.audience);
      } else {
        out = new extHostTypes.LanguageModelToolCallPart(part.toolCallId, part.name, part.parameters);
      }
      lmResponseParts.push(out);
    }
    this._defaultStream.emitMany(lmResponseParts);
  }
  reject(err) {
    this._isDone = true;
    this._defaultStream.reject(err);
  }
  resolve() {
    this._isDone = true;
    this._defaultStream.resolve();
  }
}
let ExtHostLanguageModels = class {
  constructor(extHostRpc, _logService, _extHostAuthentication) {
    this._logService = _logService;
    this._extHostAuthentication = _extHostAuthentication;
    this._onDidChangeModelAccess = new Emitter();
    this._onDidChangeProviders = new Emitter();
    this.onDidChangeProviders = this._onDidChangeProviders.event;
    this._onDidChangeModelProxyAvailability = new Emitter();
    this.onDidChangeModelProxyAvailability = this._onDidChangeModelProxyAvailability.event;
    this._languageModelProviders = /* @__PURE__ */ new Map();
    // TODO @lramos15 - Remove the need for both info and metadata as it's a lot of redundancy. Should just need one
    this._localModels = /* @__PURE__ */ new Map();
    this._modelAccessList = new ExtensionIdentifierMap();
    this._pendingRequest = /* @__PURE__ */ new Map();
    this._pendingCancelCTS = new DisposableMap();
    this._ignoredFileProviders = /* @__PURE__ */ new Map();
    this._languageAccessInformationExtensions = /* @__PURE__ */ new Set();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadLanguageModels);
  }
  static {
    this._idPool = 1;
  }
  dispose() {
    this._onDidChangeModelAccess.dispose();
    this._onDidChangeProviders.dispose();
    this._onDidChangeModelProxyAvailability.dispose();
    this._pendingRequest.clear();
    this._pendingCancelCTS.dispose();
  }
  registerLanguageModelChatProvider(extension, vendor, provider) {
    this._languageModelProviders.set(vendor, { extension, provider });
    this._proxy.$registerLanguageModelProvider(vendor);
    let providerChangeEventDisposable;
    if (provider.onDidChangeLanguageModelChatInformation) {
      providerChangeEventDisposable = provider.onDidChangeLanguageModelChatInformation(() => {
        this._proxy.$onLMProviderChange(vendor);
      });
    }
    return toDisposable(() => {
      this._languageModelProviders.delete(vendor);
      this._localModels.forEach((value, key) => {
        if (value.metadata.vendor === vendor) {
          this._localModels.delete(key);
        }
      });
      providerChangeEventDisposable?.dispose();
      this._proxy.$unregisterProvider(vendor);
    });
  }
  toModelIdentifier(vendor, group, modelId) {
    return group ? `${vendor}/${group}/${modelId}` : `${vendor}/${modelId}`;
  }
  getVendorFromModelIdentifier(modelIdentifier) {
    const firstSlash = modelIdentifier.indexOf("/");
    return firstSlash === -1 ? void 0 : modelIdentifier.substring(0, firstSlash);
  }
  async $provideLanguageModelChatInfo(vendor, options, token) {
    const data = this._languageModelProviders.get(vendor);
    if (!data) {
      return [];
    }
    const modelInformation = await data.provider.provideLanguageModelChatInformation({ silent: options.silent, configuration: options.configuration }, token) ?? [];
    const modelMetadataAndIdentifier = modelInformation.map((m) => {
      let auth;
      if (m.requiresAuthorization && isProposedApiEnabled(data.extension, "chatProvider")) {
        auth = {
          providerLabel: data.extension.displayName || data.extension.name,
          accountLabel: typeof m.requiresAuthorization === "object" ? m.requiresAuthorization.label : void 0
        };
      }
      if (m.capabilities.editTools) {
        checkProposedApiEnabled(data.extension, "chatProvider");
      }
      const isDefaultForLocation = {};
      if (isProposedApiEnabled(data.extension, "chatProvider")) {
        if (m.isDefault === true) {
          for (const key of Object.values(ChatAgentLocation)) {
            if (typeof key === "string") {
              isDefaultForLocation[key] = true;
            }
          }
        } else if (typeof m.isDefault === "object") {
          for (const key of Object.keys(m.isDefault)) {
            const enumKey = parseInt(key);
            isDefaultForLocation[typeConvert.ChatLocation.from(enumKey)] = m.isDefault[enumKey];
          }
        }
      }
      return {
        metadata: {
          extension: data.extension.identifier,
          id: m.id,
          vendor,
          name: m.name ?? "",
          family: m.family ?? "",
          detail: m.detail,
          tooltip: m.tooltip,
          version: m.version,
          multiplierNumeric: m.multiplierNumeric,
          isBYOK: m.isBYOK,
          pricing: m.pricing,
          inputCost: m.inputCost,
          outputCost: m.outputCost,
          cacheCost: m.cacheCost,
          cacheWriteCost: m.cacheWriteCost,
          longContextInputCost: m.longContextInputCost,
          longContextOutputCost: m.longContextOutputCost,
          longContextCacheCost: m.longContextCacheCost,
          longContextCacheWriteCost: m.longContextCacheWriteCost,
          priceCategory: m.priceCategory,
          category: m.category,
          maxInputTokens: m.maxInputTokens,
          maxOutputTokens: m.maxOutputTokens,
          auth,
          isDefaultForLocation,
          isUserSelectable: m.isUserSelectable,
          statusIcon: m.statusIcon,
          targetChatSessionType: m.targetChatSessionType,
          configurationSchema: m.configurationSchema,
          warningText: m.warningText,
          promo: m.promo,
          capabilities: m.capabilities ? {
            vision: m.capabilities.imageInput,
            editTools: m.capabilities.editTools,
            toolCalling: !!m.capabilities.toolCalling,
            agentMode: !!m.capabilities.toolCalling
          } : void 0
        },
        identifier: this.toModelIdentifier(vendor, options.group, m.id)
      };
    });
    this._localModels.forEach((value, key) => {
      if (value.metadata.vendor === vendor && value.group === options.group) {
        this._localModels.delete(key);
      }
    });
    for (let i = 0; i < modelMetadataAndIdentifier.length; i++) {
      this._localModels.set(modelMetadataAndIdentifier[i].identifier, {
        group: options.group,
        metadata: modelMetadataAndIdentifier[i].metadata,
        info: modelInformation[i]
      });
    }
    return modelMetadataAndIdentifier;
  }
  async $startChatRequest(modelId, requestId, from, messages, options, token) {
    const knownModel = this._localModels.get(modelId);
    if (!knownModel) {
      throw new Error("Model not found");
    }
    const data = this._languageModelProviders.get(knownModel.metadata.vendor);
    if (!data) {
      throw new Error(`Language model provider for '${knownModel.metadata.id}' not found.`);
    }
    const cts = new CancellationTokenSource(token);
    this._pendingCancelCTS.set(requestId, cts);
    const providerToken = cts.token;
    const queue = [];
    const sendNow = () => {
      if (queue.length > 0) {
        this._proxy.$reportResponsePart(requestId, new SerializableObjectWithBuffers(queue));
        queue.length = 0;
      }
    };
    const queueScheduler = new RunOnceScheduler(sendNow, 30);
    const sendSoon = (part) => {
      const newLen = queue.push(part);
      if (newLen > 30) {
        sendNow();
        queueScheduler.cancel();
      } else {
        queueScheduler.schedule();
      }
    };
    const progress = new Progress(async (fragment) => {
      if (providerToken.isCancellationRequested) {
        this._logService.warn(`[CHAT](${data.extension.identifier.value}) CANNOT send progress because the REQUEST IS CANCELLED`);
        return;
      }
      let part;
      if (fragment instanceof extHostTypes.LanguageModelToolCallPart) {
        part = { type: "tool_use", name: fragment.name, parameters: fragment.input, toolCallId: fragment.callId };
      } else if (fragment instanceof extHostTypes.LanguageModelTextPart) {
        part = { type: "text", value: fragment.value, audience: fragment.audience };
      } else if (fragment instanceof extHostTypes.LanguageModelDataPart) {
        part = { type: "data", mimeType: fragment.mimeType, data: VSBuffer.wrap(fragment.data), audience: fragment.audience };
      } else if (fragment instanceof extHostTypes.LanguageModelThinkingPart) {
        part = { type: "thinking", value: fragment.value, id: fragment.id, metadata: fragment.metadata };
      }
      if (!part) {
        this._logService.warn(`[CHAT](${data.extension.identifier.value}) UNKNOWN part ${JSON.stringify(fragment)}`);
        return;
      }
      sendSoon(part);
    });
    let value;
    try {
      value = data.provider.provideLanguageModelChatResponse(
        knownModel.info,
        messages.value.map(typeConvert.LanguageModelChatMessage2.to),
        // todo@connor4312: move `core` -> `undefined` after 1.111 Insiders is out
        { ...options, modelOptions: options.modelOptions ?? {}, modelConfiguration: options.configuration, requestInitiator: from ? ExtensionIdentifier.toKey(from) : "core", toolMode: options.toolMode ?? extHostTypes.LanguageModelChatToolMode.Auto, includeEncryptedThinking: options.includeEncryptedThinking },
        progress,
        providerToken
      );
    } catch (err) {
      this._pendingCancelCTS.deleteAndDispose(requestId);
      throw err;
    }
    Promise.resolve(value).then(() => {
      sendNow();
      this._pendingCancelCTS.deleteAndDispose(requestId);
      this._proxy.$reportResponseDone(requestId, void 0);
    }, (err) => {
      sendNow();
      this._pendingCancelCTS.deleteAndDispose(requestId);
      this._proxy.$reportResponseDone(requestId, transformErrorForSerialization(err));
    });
  }
  //#region --- token counting
  $cancelLanguageModelChatRequest(requestId) {
    this._pendingCancelCTS.get(requestId)?.cancel();
  }
  $provideTokenLength(modelId, value, token) {
    const knownModel = this._localModels.get(modelId);
    if (!knownModel) {
      return Promise.resolve(0);
    }
    const data = this._languageModelProviders.get(knownModel.metadata.vendor);
    if (!data) {
      return Promise.resolve(0);
    }
    return Promise.resolve(data.provider.provideTokenCount(knownModel.info, value, token));
  }
  //#region --- making request
  async getDefaultLanguageModel(extension, forceResolveModels) {
    let defaultModelId;
    if (forceResolveModels) {
      await this.selectLanguageModels(extension, {});
    }
    for (const [modelIdentifier, modelData] of this._localModels) {
      if (modelData.metadata.isDefaultForLocation[ChatAgentLocation.Chat] && modelData.metadata.vendor === COPILOT_VENDOR_ID) {
        defaultModelId = modelIdentifier;
        break;
      }
    }
    if (!defaultModelId && !forceResolveModels) {
      return this.getDefaultLanguageModel(extension, true);
    }
    return this.getLanguageModelByIdentifier(extension, defaultModelId);
  }
  async getLanguageModelByIdentifier(extension, modelId) {
    if (!modelId) {
      return void 0;
    }
    if (!this._localModels.has(modelId)) {
      const vendor = this.getVendorFromModelIdentifier(modelId);
      if (!vendor) {
        this._logService.warn(`[LanguageModelProxy](${extension.identifier.value}) Could not extract vendor from model identifier '${modelId}'.`);
        return void 0;
      }
      this._logService.trace(`[LanguageModelProxy](${extension.identifier.value}) Could not find model '${modelId}' in local cache. Trying to resolve model again.`);
      await this._proxy.$selectChatModels({ vendor, extension: extension.identifier });
      if (!this._localModels.has(modelId)) {
        this._logService.warn(`[LanguageModelProxy](${extension.identifier.value}) Could not find model '${modelId}' in local cache after re-resolving models.`);
        return void 0;
      }
    }
    return this._createLanguageModelChatApi(extension, modelId);
  }
  async _createLanguageModelChatApi(extension, modelId) {
    const model = this._localModels.get(modelId);
    if (!model) {
      return void 0;
    }
    if (this._isUsingAuth(extension.identifier, model.metadata)) {
      await this._fakeAuthPopulate(model.metadata);
    }
    const that = this;
    const apiObject = {
      id: model.info.id,
      vendor: model.metadata.vendor,
      family: model.info.family,
      version: model.info.version,
      name: model.info.name,
      pricing: model.metadata.pricing,
      inputCost: model.metadata.inputCost,
      outputCost: model.metadata.outputCost,
      cacheCost: model.metadata.cacheCost,
      cacheWriteCost: model.metadata.cacheWriteCost,
      longContextInputCost: model.metadata.longContextInputCost,
      longContextOutputCost: model.metadata.longContextOutputCost,
      longContextCacheCost: model.metadata.longContextCacheCost,
      longContextCacheWriteCost: model.metadata.longContextCacheWriteCost,
      priceCategory: model.metadata.priceCategory,
      category: model.metadata.category,
      capabilities: {
        supportsImageToText: model.metadata.capabilities?.vision ?? false,
        supportsToolCalling: !!model.metadata.capabilities?.toolCalling,
        editToolsHint: model.metadata.capabilities?.editTools
      },
      maxInputTokens: model.metadata.maxInputTokens,
      countTokens(text, token) {
        if (!that._localModels.has(modelId)) {
          throw extHostTypes.LanguageModelError.NotFound(modelId);
        }
        return that._computeTokenLength(modelId, text, token ?? CancellationToken.None);
      },
      sendRequest(messages, options, token) {
        if (!that._localModels.has(modelId)) {
          throw extHostTypes.LanguageModelError.NotFound(modelId);
        }
        return that._sendChatRequest(extension, modelId, messages, options ?? {}, token ?? CancellationToken.None);
      }
    };
    Object.freeze(apiObject);
    return apiObject;
  }
  async selectLanguageModels(extension, selector) {
    const models = await this._proxy.$selectChatModels({ ...selector, extension: extension.identifier });
    const modelResults = await Promise.all(models.map((identifier) => this._createLanguageModelChatApi(extension, identifier)));
    return modelResults.filter((m) => !!m);
  }
  async _sendChatRequest(extension, languageModelId, messages, options, token) {
    const internalMessages = this._convertMessages(extension, messages);
    const from = extension.identifier;
    const metadata = this._localModels.get(languageModelId)?.metadata;
    if (!metadata || !this._localModels.has(languageModelId)) {
      throw extHostTypes.LanguageModelError.NotFound(`Language model '${languageModelId}' is unknown.`);
    }
    if (this._isUsingAuth(from, metadata)) {
      const success = await this._getAuthAccess(extension, { identifier: metadata.extension, displayName: metadata.auth.providerLabel }, options.justification, false);
      if (!success || !this._modelAccessList.get(from)?.has(metadata.extension)) {
        throw extHostTypes.LanguageModelError.NoPermissions(`Language model '${languageModelId}' cannot be used by '${from.value}'.`);
      }
    }
    const requestId = Math.random() * 1e6 | 0;
    const res = new LanguageModelResponse();
    this._pendingRequest.set(requestId, { languageModelId, res });
    const cts = new CancellationTokenSource(token);
    this._pendingCancelCTS.set(requestId, cts);
    cts.token.onCancellationRequested(() => {
      this._proxy.$cancelLanguageModelChatRequest(requestId);
    });
    try {
      await this._proxy.$tryStartChatRequest(from, languageModelId, requestId, new SerializableObjectWithBuffers(internalMessages), options, cts.token);
    } catch (error) {
      this._pendingRequest.delete(requestId);
      this._pendingCancelCTS.deleteAndDispose(requestId);
      throw extHostTypes.LanguageModelError.tryDeserialize(error) ?? error;
    }
    return res.apiObject;
  }
  _convertMessages(extension, messages) {
    const internalMessages = [];
    for (const message of messages) {
      if (message.role === extHostTypes.LanguageModelChatMessageRole.System) {
        checkProposedApiEnabled(extension, "languageModelSystem");
      }
      internalMessages.push(typeConvert.LanguageModelChatMessage2.from(message));
    }
    return internalMessages;
  }
  async $acceptResponsePart(requestId, chunk) {
    const data = this._pendingRequest.get(requestId);
    if (data) {
      data.res.handleResponsePart(chunk.value);
    }
  }
  $onChatModelsChange() {
    this._onDidChangeProviders.fire();
  }
  async $acceptResponseDone(requestId, error) {
    const data = this._pendingRequest.get(requestId);
    if (!data) {
      return;
    }
    this._pendingRequest.delete(requestId);
    this._pendingCancelCTS.deleteAndDispose(requestId);
    if (error) {
      data.res.reject(extHostTypes.LanguageModelError.tryDeserialize(error) ?? transformErrorFromSerialization(error));
    } else {
      data.res.resolve();
    }
  }
  // BIG HACK: Using AuthenticationProviders to check access to Language Models
  async _getAuthAccess(from, to, justification, silent) {
    const providerId = INTERNAL_AUTH_PROVIDER_PREFIX + to.identifier.value;
    const session = await this._extHostAuthentication.getSession(from, providerId, [], { silent: true });
    if (session) {
      this.$updateModelAccesslist([{ from: from.identifier, to: to.identifier, enabled: true }]);
      return true;
    }
    if (silent) {
      return false;
    }
    try {
      const detail = justification ? localize("chatAccessWithJustification", "Justification: {1}", to.displayName, justification) : void 0;
      await this._extHostAuthentication.getSession(from, providerId, [], { forceNewSession: { detail } });
      this.$updateModelAccesslist([{ from: from.identifier, to: to.identifier, enabled: true }]);
      return true;
    } catch (err) {
      return false;
    }
  }
  _isUsingAuth(from, toMetadata) {
    return !!toMetadata.auth && !ExtensionIdentifier.equals(toMetadata.extension, from);
  }
  async _fakeAuthPopulate(metadata) {
    if (!metadata.auth) {
      return;
    }
    for (const from of this._languageAccessInformationExtensions) {
      try {
        await this._getAuthAccess(from, { identifier: metadata.extension, displayName: "" }, void 0, true);
      } catch (err) {
        this._logService.error("Fake Auth request failed");
        this._logService.error(err);
      }
    }
  }
  async _computeTokenLength(modelId, value, token) {
    const data = this._localModels.get(modelId);
    if (!data) {
      throw extHostTypes.LanguageModelError.NotFound(`Language model '${modelId}' is unknown.`);
    }
    return this._languageModelProviders.get(data.metadata.vendor)?.provider.provideTokenCount(data.info, value, token) ?? 0;
  }
  $updateModelAccesslist(data) {
    const updated = new Array();
    for (const { from, to, enabled } of data) {
      const set = this._modelAccessList.get(from) ?? new ExtensionIdentifierSet();
      const oldValue = set.has(to);
      if (oldValue !== enabled) {
        if (enabled) {
          set.add(to);
        } else {
          set.delete(to);
        }
        this._modelAccessList.set(from, set);
        const newItem = { from, to };
        updated.push(newItem);
        this._onDidChangeModelAccess.fire(newItem);
      }
    }
  }
  createLanguageModelAccessInformation(from) {
    this._languageAccessInformationExtensions.add(from);
    const _onDidChangeAccess = Event.signal(Event.filter(this._onDidChangeModelAccess.event, (e) => ExtensionIdentifier.equals(e.from, from.identifier)));
    const _onDidAddRemove = Event.signal(this._onDidChangeProviders.event);
    return {
      get onDidChange() {
        return Event.any(_onDidChangeAccess, _onDidAddRemove);
      },
      canSendRequest(chat) {
        return true;
      }
    };
  }
  fileIsIgnored(extension, uri, token = CancellationToken.None) {
    checkProposedApiEnabled(extension, "chatParticipantAdditions");
    return this._proxy.$fileIsIgnored(uri, token);
  }
  get isModelProxyAvailable() {
    return !!this._languageModelProxyProvider;
  }
  async getModelProxy(extension) {
    checkProposedApiEnabled(extension, "languageModelProxy");
    if (!this._languageModelProxyProvider) {
      this._logService.trace("[LanguageModelProxy] No LanguageModelProxyProvider registered");
      throw new Error("No language model proxy provider is registered.");
    }
    const requestingExtensionId = ExtensionIdentifier.toKey(extension.identifier);
    try {
      const result = await Promise.resolve(this._languageModelProxyProvider.provideModelProxy(requestingExtensionId, CancellationToken.None));
      if (!result) {
        this._logService.warn(`[LanguageModelProxy] Provider returned no proxy for ${requestingExtensionId}`);
        throw new Error("Language model proxy is not available.");
      }
      return result;
    } catch (err) {
      this._logService.error(`[LanguageModelProxy] Provider failed to return proxy for ${requestingExtensionId}`, err);
      throw err;
    }
  }
  async $isFileIgnored(handle, uri, token) {
    const provider = this._ignoredFileProviders.get(handle);
    if (!provider) {
      throw new Error("Unknown LanguageModelIgnoredFileProvider");
    }
    return await provider.provideFileIgnored(URI.revive(uri), token) ?? false;
  }
  registerIgnoredFileProvider(extension, provider) {
    checkProposedApiEnabled(extension, "chatParticipantPrivate");
    const handle = ExtHostLanguageModels._idPool++;
    this._proxy.$registerFileIgnoreProvider(handle);
    this._ignoredFileProviders.set(handle, provider);
    return toDisposable(() => {
      this._proxy.$unregisterFileIgnoreProvider(handle);
      this._ignoredFileProviders.delete(handle);
    });
  }
  registerLanguageModelProxyProvider(extension, provider) {
    checkProposedApiEnabled(extension, "chatParticipantPrivate");
    this._languageModelProxyProvider = provider;
    this._onDidChangeModelProxyAvailability.fire();
    return toDisposable(() => {
      if (this._languageModelProxyProvider === provider) {
        this._languageModelProxyProvider = void 0;
        this._onDidChangeModelProxyAvailability.fire();
      }
    });
  }
};
ExtHostLanguageModels = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostAuthentication)
], ExtHostLanguageModels);
export {
  ExtHostLanguageModels,
  IExtHostLanguageModels
};
