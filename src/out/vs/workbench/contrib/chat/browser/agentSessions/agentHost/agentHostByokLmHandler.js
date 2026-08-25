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
import { Emitter, Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { decodeBase64, VSBuffer } from "../../../../../../base/common/buffer.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { ChatEntitlementContextKeys, IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import {
  ChatImageMimeType,
  ChatMessageRole,
  ILanguageModelsService
} from "../../../common/languageModels.js";
const STATEFUL_MARKER_MIME_TYPE = "stateful_marker";
const USAGE_MIME_TYPE = "usage";
const REASONING_METADATA_PREFIX = "vscode-reasoning-metadata:";
const CLIENT_BYOK_CONTEXT_KEYS = /* @__PURE__ */ new Set([ChatEntitlementContextKeys.clientByokEnabled.key]);
let AgentHostByokLmHandler = class extends Disposable {
  constructor(_languageModelsService, _logService, _chatEntitlementService, contextKeyService) {
    super();
    this._languageModelsService = _languageModelsService;
    this._logService = _logService;
    this._chatEntitlementService = _chatEntitlementService;
    this._onDidChangeModels = this._register(new Emitter());
    /** Fires when the renderer's BYOK models change, so the node agent host re-enumerates. */
    this.onDidChangeModels = this._onDidChangeModels.event;
    this._register(Event.debounce(this._languageModelsService.onDidChangeLanguageModels, () => void 0, 500)(() => {
      this._onDidChangeModels.fire();
    }));
    this._register(Event.filter(contextKeyService.onDidChangeContext, (event) => event.affectsSome(CLIENT_BYOK_CONTEXT_KEYS))(() => {
      this._onDidChangeModels.fire();
    }));
  }
  async chat(request, token) {
    if (!this._chatEntitlementService.clientByokEnabled) {
      return { output: [], error: "BYOK models are disabled by policy." };
    }
    const modelIdentifier = this._resolveModelIdentifier(request.vendor, request.modelId);
    if (!modelIdentifier) {
      return { output: [], error: `No BYOK model found for ${request.vendor}/${request.modelId}` };
    }
    const messages = this._toChatMessages(request);
    const tools = request.tools?.length ? request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      inputSchema: tool.type === "function" ? tool.parametersSchema : { type: "object", properties: { input: { type: "string" } }, required: ["input"] }
    })) : void 0;
    const options = {
      modelOptions: request.modelOptions,
      includeEncryptedThinking: true,
      ...request.reasoningEffort ? { configuration: { reasoningEffort: request.reasoningEffort } } : {},
      ...tools ? { tools } : {}
    };
    try {
      const response = await this._languageModelsService.sendChatRequest(modelIdentifier, void 0, messages, options, token);
      const output = [];
      const customToolNames = new Set(request.tools?.filter((tool) => tool.type === "custom").map((tool) => tool.name));
      let responseId;
      let usage;
      const streaming = (async () => {
        for await (const part of response.stream) {
          const parts = Array.isArray(part) ? part : [part];
          for (const p of parts) {
            if (p.type === "text") {
              this._appendTextOutput(output, p.value);
            } else if (p.type === "thinking") {
              this._appendReasoningOutput(output, p);
            } else if (p.type === "tool_use") {
              if (customToolNames.has(p.name)) {
                output.push({
                  type: "custom_tool_call",
                  callId: p.toolCallId,
                  name: p.name,
                  input: this._customToolInput(p.parameters)
                });
              } else {
                output.push({
                  type: "function_call",
                  callId: p.toolCallId,
                  name: p.name,
                  argumentsJson: JSON.stringify(p.parameters ?? {})
                });
              }
            } else if (p.type === "data" && p.mimeType === STATEFUL_MARKER_MIME_TYPE) {
              responseId = this._decodeStatefulMarker(p.data, request.modelId);
            } else if (p.type === "data" && p.mimeType === USAGE_MIME_TYPE) {
              usage = this._decodeUsage(p.data);
            }
          }
        }
      })();
      await Promise.all([response.result, streaming]);
      return { output, responseId, usage };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._logService.warn(`[AgentHostByokLmHandler] chat request failed for ${request.vendor}/${request.modelId}: ${message}`);
      return { output: [], error: message };
    }
  }
  async listModels(_token) {
    if (!this._chatEntitlementService.clientByokEnabled) {
      return [];
    }
    const models = [];
    for (const identifier of this._languageModelsService.getLanguageModelIds()) {
      const metadata = this._languageModelsService.lookupLanguageModel(identifier);
      if (metadata?.isBYOK && !metadata.targetChatSessionType) {
        const reasoningEffortSchema = metadata.configurationSchema?.properties?.reasoningEffort;
        const supportedReasoningEfforts = reasoningEffortSchema?.enum?.filter((value) => typeof value === "string");
        const defaultReasoningEffort = typeof reasoningEffortSchema?.default === "string" ? reasoningEffortSchema.default : void 0;
        models.push({
          vendor: metadata.vendor,
          id: metadata.id,
          name: metadata.name,
          modelIdentifier: identifier,
          maxContextWindowTokens: metadata.maxInputTokens + metadata.maxOutputTokens,
          supportsVision: !!metadata.capabilities?.vision,
          ...supportedReasoningEfforts?.length ? { supportedReasoningEfforts } : {},
          ...defaultReasoningEffort !== void 0 ? { defaultReasoningEffort } : {}
        });
      }
    }
    return models;
  }
  /**
   * Find the LM API identifier for a BYOK model addressed by its vendor and
   * provider-local id (the `provider/id` selection id the picker surfaced).
   */
  _resolveModelIdentifier(vendor, modelId) {
    const exactIdentifier = `${vendor}/${modelId}`;
    const exactMetadata = this._languageModelsService.lookupLanguageModel(exactIdentifier);
    if (exactMetadata?.isBYOK && exactMetadata.vendor === vendor) {
      return exactIdentifier;
    }
    for (const identifier of this._languageModelsService.getLanguageModelIds()) {
      const metadata = this._languageModelsService.lookupLanguageModel(identifier);
      if (metadata?.isBYOK && metadata.vendor === vendor && metadata.id === modelId) {
        return identifier;
      }
    }
    return void 0;
  }
  _toChatMessages(request) {
    const messages = [];
    if (request.previousResponseId) {
      messages.push({
        role: ChatMessageRole.Assistant,
        content: [{
          type: "data",
          mimeType: STATEFUL_MARKER_MIME_TYPE,
          data: VSBuffer.fromString(`${request.modelId}\\${request.previousResponseId}`)
        }]
      });
    }
    if (request.instructions) {
      messages.push({
        role: ChatMessageRole.System,
        content: [{ type: "text", value: request.instructions }]
      });
    }
    for (const item of request.input) {
      const message = this._toChatMessage(item);
      const previous = messages.at(-1);
      if (message.role === ChatMessageRole.Assistant && previous?.role === ChatMessageRole.Assistant) {
        messages[messages.length - 1] = {
          ...previous,
          content: [...previous.content, ...message.content]
        };
      } else {
        messages.push(message);
      }
    }
    return messages;
  }
  _toChatMessage(item) {
    switch (item.type) {
      case "message":
        return {
          role: this._toChatRole(item.role),
          content: this._toChatMessageParts(item.content)
        };
      case "reasoning": {
        return {
          role: ChatMessageRole.Assistant,
          content: [{
            type: "thinking",
            value: item.summary,
            id: item.id,
            metadata: {
              ...item.metadata,
              ...item.encryptedContent ? this._decodeReasoningMetadata(item.encryptedContent) : {}
            }
          }]
        };
      }
      case "function_call":
        return {
          role: ChatMessageRole.Assistant,
          content: [{
            type: "tool_use",
            name: item.name,
            toolCallId: item.callId,
            parameters: this._safeParseJson(item.argumentsJson)
          }]
        };
      case "custom_tool_call":
        return {
          role: ChatMessageRole.Assistant,
          content: [{
            type: "tool_use",
            name: item.name,
            toolCallId: item.callId,
            parameters: { input: item.input }
          }]
        };
      case "function_call_output":
      case "custom_tool_call_output":
        return {
          role: ChatMessageRole.User,
          content: [{
            type: "tool_result",
            toolCallId: item.callId,
            value: [{ type: "text", value: item.output }]
          }]
        };
    }
  }
  _toChatMessageParts(parts) {
    const result = [];
    for (const part of parts) {
      if (part.type === "text") {
        const previous = result.at(-1);
        if (previous?.type === "text") {
          previous.value += part.text;
        } else {
          result.push({ type: "text", value: part.text });
        }
      } else {
        result.push({ type: "image_url", value: { mimeType: this._toChatImageMimeType(part.mimeType), data: decodeBase64(part.data) } });
      }
    }
    return result.length ? result : [{ type: "text", value: "" }];
  }
  _toChatImageMimeType(mimeType) {
    switch (mimeType) {
      case "image/png":
        return ChatImageMimeType.PNG;
      case "image/jpeg":
        return ChatImageMimeType.JPEG;
      case "image/gif":
        return ChatImageMimeType.GIF;
      case "image/webp":
        return ChatImageMimeType.WEBP;
      case "image/bmp":
        return ChatImageMimeType.BMP;
    }
  }
  _appendTextOutput(output, value) {
    const previous = output.at(-1);
    if (previous?.type === "message") {
      output[output.length - 1] = {
        ...previous,
        content: [{ type: "text", text: previous.content.map((part) => part.text).join("") + value }]
      };
    } else {
      output.push({ type: "message", content: [{ type: "text", text: value }] });
    }
  }
  _appendReasoningOutput(output, part) {
    if (part.metadata?.vscode_reasoning_done === true) {
      return;
    }
    const summary = Array.isArray(part.value) ? part.value : [part.value];
    const encryptedContent = this._encodeReasoningMetadata(part.metadata);
    const reasoning = {
      type: "reasoning",
      id: part.id,
      summary,
      encryptedContent,
      metadata: part.metadata
    };
    const previous = output.at(-1);
    if (previous?.type === "reasoning" && previous.id === reasoning.id) {
      output[output.length - 1] = {
        ...previous,
        summary: [...previous.summary, ...reasoning.summary],
        encryptedContent: reasoning.encryptedContent ?? previous.encryptedContent,
        metadata: previous.metadata || reasoning.metadata ? { ...previous.metadata, ...reasoning.metadata } : void 0
      };
    } else {
      output.push(reasoning);
    }
  }
  _encodeReasoningMetadata(metadata) {
    const encryptedContent = this._stringMetadata(metadata, "encrypted_content") ?? this._stringMetadata(metadata, "encrypted");
    if (encryptedContent) {
      return encryptedContent;
    }
    const continuationMetadata = {
      ...this._stringMetadata(metadata, "signature") ? { signature: this._stringMetadata(metadata, "signature") } : {},
      ...this._stringMetadata(metadata, "_completeThinking") ? { _completeThinking: this._stringMetadata(metadata, "_completeThinking") } : {},
      ...this._stringMetadata(metadata, "redactedData") ? { redactedData: this._stringMetadata(metadata, "redactedData") } : {}
    };
    return Object.keys(continuationMetadata).length > 0 ? `${REASONING_METADATA_PREFIX}${JSON.stringify(continuationMetadata)}` : void 0;
  }
  _decodeReasoningMetadata(value) {
    if (!value.startsWith(REASONING_METADATA_PREFIX)) {
      return { encrypted_content: value };
    }
    const metadata = JSON.parse(value.slice(REASONING_METADATA_PREFIX.length));
    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
      throw new Error("Invalid Agent Host BYOK reasoning metadata");
    }
    return metadata;
  }
  _customToolInput(parameters) {
    if (typeof parameters === "object" && parameters !== null) {
      const input = Object.getOwnPropertyDescriptor(parameters, "input")?.value;
      if (typeof input === "string") {
        return input;
      }
    }
    return typeof parameters === "string" ? parameters : JSON.stringify(parameters ?? {});
  }
  _decodeStatefulMarker(data, expectedModelId) {
    const decoded = data.toString();
    const separator = decoded.indexOf("\\");
    if (separator === -1 || decoded.slice(0, separator) !== expectedModelId) {
      return void 0;
    }
    return decoded.slice(separator + 1) || void 0;
  }
  _decodeUsage(data) {
    try {
      const value = JSON.parse(data.toString());
      const outputDetails = typeof value.completion_tokens_details === "object" && value.completion_tokens_details !== null ? value.completion_tokens_details : void 0;
      return {
        inputTokens: this._numberProperty(value, "prompt_tokens"),
        outputTokens: this._numberProperty(value, "completion_tokens"),
        reasoningTokens: outputDetails ? this._numberProperty(outputDetails, "reasoning_tokens") : void 0
      };
    } catch {
      return void 0;
    }
  }
  _numberProperty(value, key) {
    const property = value[key];
    return typeof property === "number" ? property : void 0;
  }
  _stringMetadata(metadata, key) {
    const value = metadata?.[key];
    return typeof value === "string" ? value : void 0;
  }
  _toChatRole(role) {
    switch (role) {
      case "system":
      case "developer":
        return ChatMessageRole.System;
      case "assistant":
        return ChatMessageRole.Assistant;
      case "user":
        return ChatMessageRole.User;
    }
  }
  _safeParseJson(json) {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
};
AgentHostByokLmHandler = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IChatEntitlementService),
  __decorateParam(3, IContextKeyService)
], AgentHostByokLmHandler);
export {
  AgentHostByokLmHandler
};
