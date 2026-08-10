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
import { VSBuffer } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { MainContext } from "./extHost.protocol.js";
import { ChatDebugGenericEvent, ChatDebugHookResult, ChatDebugMessageContentType, ChatDebugMessageSection, ChatDebugModelTurnEvent, ChatDebugSubagentInvocationEvent, ChatDebugSubagentStatus, ChatDebugToolCallEvent, ChatDebugToolCallResult, ChatDebugUserMessageEvent, ChatDebugAgentResponseEvent } from "./extHostTypes.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
let ExtHostChatDebug = class extends Disposable {
  constructor(extHostRpc) {
    super();
    this._nextHandle = 0;
    /** Progress pipelines keyed by `${handle}:${sessionResource}` so multiple sessions can stream concurrently. */
    this._activeProgress = /* @__PURE__ */ new Map();
    this._onDidAddCoreEvent = this._register(new Emitter({
      onWillAddFirstListener: () => this._proxy.$subscribeToCoreDebugEvents(),
      onDidRemoveLastListener: () => this._proxy.$unsubscribeFromCoreDebugEvents()
    }));
    this.onDidAddCoreEvent = this._onDidAddCoreEvent.event;
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadChatDebug);
  }
  _progressKey(handle, sessionResource) {
    return `${handle}:${URI.revive(sessionResource).toString()}`;
  }
  _cleanupProgress(key) {
    const store = this._activeProgress.get(key);
    if (store) {
      store.dispose();
      this._activeProgress.delete(key);
    }
  }
  registerChatDebugLogProvider(provider) {
    if (this._provider) {
      throw new Error("A ChatDebugLogProvider is already registered.");
    }
    this._provider = provider;
    const handle = this._nextHandle++;
    this._proxy.$registerChatDebugLogProvider(handle);
    return toDisposable(() => {
      this._provider = void 0;
      for (const [key, store] of this._activeProgress) {
        if (key.startsWith(`${handle}:`)) {
          store.dispose();
          this._activeProgress.delete(key);
        }
      }
      this._proxy.$unregisterChatDebugLogProvider(handle);
    });
  }
  async $provideChatDebugLog(handle, sessionResource, token) {
    if (!this._provider) {
      return void 0;
    }
    const key = this._progressKey(handle, sessionResource);
    this._cleanupProgress(key);
    const store = new DisposableStore();
    this._activeProgress.set(key, store);
    const emitter = store.add(new Emitter());
    store.add(emitter.event((event) => {
      const dto = this._serializeEvent(event);
      if (!dto.sessionResource) {
        dto.sessionResource = sessionResource;
      }
      this._proxy.$acceptChatDebugEvent(handle, dto);
    }));
    store.add(token.onCancellationRequested(() => {
      this._cleanupProgress(key);
    }));
    try {
      const progress = {
        report: (value) => emitter.fire(value)
      };
      const sessionUri = URI.revive(sessionResource);
      const result = await this._provider.provideChatDebugLog(sessionUri, progress, token);
      if (!result) {
        return void 0;
      }
      return result.map((event) => this._serializeEvent(event));
    } catch (err) {
      this._cleanupProgress(key);
      throw err;
    }
  }
  _serializeEvent(event) {
    const base = {
      id: event.id,
      sessionResource: event.sessionResource,
      created: event.created.getTime(),
      parentEventId: event.parentEventId
    };
    const kind = event._kind;
    switch (kind) {
      case "toolCall": {
        const e = event;
        return {
          ...base,
          kind: "toolCall",
          toolName: e.toolName,
          toolCallId: e.toolCallId,
          input: e.input,
          output: e.output,
          result: e.result === ChatDebugToolCallResult.Success ? "success" : e.result === ChatDebugToolCallResult.Error ? "error" : void 0,
          durationInMillis: e.durationInMillis
        };
      }
      case "modelTurn": {
        const e = event;
        return {
          ...base,
          kind: "modelTurn",
          model: e.model,
          requestName: e.requestName,
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          cachedTokens: e.cachedTokens,
          totalTokens: e.totalTokens,
          copilotUsageNanoAiu: e.copilotUsageNanoAiu,
          durationInMillis: e.durationInMillis
        };
      }
      case "generic": {
        const e = event;
        return {
          ...base,
          kind: "generic",
          name: e.name,
          details: e.details,
          level: e.level,
          category: e.category
        };
      }
      case "subagentInvocation": {
        const e = event;
        return {
          ...base,
          kind: "subagentInvocation",
          agentName: e.agentName,
          description: e.description,
          status: e.status === ChatDebugSubagentStatus.Running ? "running" : e.status === ChatDebugSubagentStatus.Completed ? "completed" : e.status === ChatDebugSubagentStatus.Failed ? "failed" : void 0,
          durationInMillis: e.durationInMillis,
          toolCallCount: e.toolCallCount,
          modelTurnCount: e.modelTurnCount
        };
      }
      case "userMessage": {
        const e = event;
        return {
          ...base,
          kind: "userMessage",
          message: e.message,
          sections: e.sections.map((s) => ({ name: s.name, content: s.content }))
        };
      }
      case "agentResponse": {
        const e = event;
        return {
          ...base,
          kind: "agentResponse",
          message: e.message,
          sections: e.sections.map((s) => ({ name: s.name, content: s.content }))
        };
      }
      default: {
        const generic = event;
        const rawName = generic.name;
        const rawDetails = generic.details;
        return {
          ...base,
          kind: "generic",
          name: typeof rawName === "string" ? rawName : "",
          details: typeof rawDetails === "string" ? rawDetails : void 0,
          level: generic.level ?? 1,
          category: generic.category
        };
      }
    }
  }
  async $resolveChatDebugLogEvent(_handle, eventId, token) {
    if (!this._provider?.resolveChatDebugLogEvent) {
      return void 0;
    }
    const result = await this._provider.resolveChatDebugLogEvent(eventId, token);
    if (!result) {
      return void 0;
    }
    const kind = result._kind;
    switch (kind) {
      case "text":
        return { kind: "text", value: result.value };
      case "messageContent": {
        const msg = result;
        return {
          kind: "message",
          type: msg.type === ChatDebugMessageContentType.User ? "user" : "agent",
          message: msg.message,
          sections: msg.sections.map((s) => ({ name: s.name, content: s.content }))
        };
      }
      case "userMessage": {
        const msg = result;
        return {
          kind: "message",
          type: "user",
          message: msg.message,
          sections: msg.sections.map((s) => ({ name: s.name, content: s.content }))
        };
      }
      case "agentResponse": {
        const msg = result;
        return {
          kind: "message",
          type: "agent",
          message: msg.message,
          sections: msg.sections.map((s) => ({ name: s.name, content: s.content }))
        };
      }
      case "toolCallContent": {
        const tc = result;
        return {
          kind: "toolCall",
          toolName: tc.toolName,
          result: tc.result === ChatDebugToolCallResult.Success ? "success" : tc.result === ChatDebugToolCallResult.Error ? "error" : void 0,
          durationInMillis: tc.durationInMillis,
          input: tc.input,
          output: tc.output
        };
      }
      case "modelTurnContent": {
        const mt = result;
        return {
          kind: "modelTurn",
          requestName: mt.requestName,
          model: mt.model,
          status: mt.status,
          durationInMillis: mt.durationInMillis,
          timeToFirstTokenInMillis: mt.timeToFirstTokenInMillis,
          requestId: mt.requestId,
          maxInputTokens: mt.maxInputTokens,
          maxOutputTokens: mt.maxOutputTokens,
          inputTokens: mt.inputTokens,
          outputTokens: mt.outputTokens,
          cachedTokens: mt.cachedTokens,
          totalTokens: mt.totalTokens,
          requestOptions: mt.requestOptions,
          errorMessage: mt.errorMessage,
          sections: mt.sections?.map((s) => ({ name: s.name, content: s.content }))
        };
      }
      case "hookContent": {
        const hk = result;
        return {
          kind: "hook",
          hookType: hk.hookType,
          command: hk.command,
          result: hk.result === ChatDebugHookResult.Success ? "success" : hk.result === ChatDebugHookResult.Error ? "error" : hk.result === ChatDebugHookResult.NonBlockingError ? "nonBlockingError" : void 0,
          durationInMillis: hk.durationInMillis,
          input: hk.input,
          output: hk.output,
          exitCode: hk.exitCode,
          errorMessage: hk.errorMessage
        };
      }
      default:
        return void 0;
    }
  }
  _deserializeEvent(dto) {
    const created = new Date(dto.created);
    const sessionResource = dto.sessionResource ? URI.revive(dto.sessionResource) : void 0;
    switch (dto.kind) {
      case "toolCall": {
        const evt = new ChatDebugToolCallEvent(dto.toolName, created);
        evt.id = dto.id;
        evt.sessionResource = sessionResource;
        evt.parentEventId = dto.parentEventId;
        evt.toolCallId = dto.toolCallId;
        evt.input = dto.input;
        evt.output = dto.output;
        evt.result = dto.result === "success" ? ChatDebugToolCallResult.Success : dto.result === "error" ? ChatDebugToolCallResult.Error : void 0;
        evt.durationInMillis = dto.durationInMillis;
        return evt;
      }
      case "modelTurn": {
        const evt = new ChatDebugModelTurnEvent(created);
        evt.id = dto.id;
        evt.sessionResource = sessionResource;
        evt.parentEventId = dto.parentEventId;
        evt.model = dto.model;
        evt.requestName = dto.requestName;
        evt.inputTokens = dto.inputTokens;
        evt.outputTokens = dto.outputTokens;
        evt.cachedTokens = dto.cachedTokens;
        evt.totalTokens = dto.totalTokens;
        evt.copilotUsageNanoAiu = dto.copilotUsageNanoAiu;
        evt.durationInMillis = dto.durationInMillis;
        return evt;
      }
      case "generic": {
        const evt = new ChatDebugGenericEvent(dto.name, dto.level, created);
        evt.id = dto.id;
        evt.sessionResource = sessionResource;
        evt.parentEventId = dto.parentEventId;
        evt.details = dto.details;
        evt.category = dto.category;
        return evt;
      }
      case "subagentInvocation": {
        const evt = new ChatDebugSubagentInvocationEvent(dto.agentName, created);
        evt.id = dto.id;
        evt.sessionResource = sessionResource;
        evt.parentEventId = dto.parentEventId;
        evt.description = dto.description;
        evt.status = dto.status === "running" ? ChatDebugSubagentStatus.Running : dto.status === "completed" ? ChatDebugSubagentStatus.Completed : dto.status === "failed" ? ChatDebugSubagentStatus.Failed : void 0;
        evt.durationInMillis = dto.durationInMillis;
        evt.toolCallCount = dto.toolCallCount;
        evt.modelTurnCount = dto.modelTurnCount;
        return evt;
      }
      case "userMessage": {
        const evt = new ChatDebugUserMessageEvent(dto.message, created);
        evt.id = dto.id;
        evt.sessionResource = sessionResource;
        evt.parentEventId = dto.parentEventId;
        evt.sections = dto.sections.map((s) => new ChatDebugMessageSection(s.name, s.content));
        return evt;
      }
      case "agentResponse": {
        const evt = new ChatDebugAgentResponseEvent(dto.message, created);
        evt.id = dto.id;
        evt.sessionResource = sessionResource;
        evt.parentEventId = dto.parentEventId;
        evt.sections = dto.sections.map((s) => new ChatDebugMessageSection(s.name, s.content));
        return evt;
      }
      default:
        return void 0;
    }
  }
  $onCoreDebugEvent(dto) {
    const event = this._deserializeEvent(dto);
    if (event) {
      this._onDidAddCoreEvent.fire(event);
    }
  }
  async $exportChatDebugLog(_handle, sessionResource, coreEventDtos, sessionTitle, token) {
    if (!this._provider?.provideChatDebugLogExport) {
      return void 0;
    }
    const sessionUri = URI.revive(sessionResource);
    const coreEvents = coreEventDtos.map((dto) => this._deserializeEvent(dto)).filter((e) => e !== void 0);
    const options = { coreEvents, sessionTitle };
    const result = await this._provider.provideChatDebugLogExport(sessionUri, options, token);
    if (!result) {
      return void 0;
    }
    return VSBuffer.wrap(result);
  }
  async $importChatDebugLog(_handle, data, token) {
    if (!this._provider?.resolveChatDebugLogImport) {
      return void 0;
    }
    const result = await this._provider.resolveChatDebugLogImport(data.buffer, token);
    if (!result) {
      return void 0;
    }
    return { uri: result.uri, sessionTitle: result.sessionTitle };
  }
  async $getAvailableDebugSessionResources(_handle, token) {
    if (!this._provider?.provideAvailableDebugSessionResources) {
      return [];
    }
    const result = await this._provider.provideAvailableDebugSessionResources(token);
    return result ?? [];
  }
  dispose() {
    for (const store of this._activeProgress.values()) {
      store.dispose();
    }
    this._activeProgress.clear();
    super.dispose();
  }
};
ExtHostChatDebug = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostChatDebug);
export {
  ExtHostChatDebug
};
