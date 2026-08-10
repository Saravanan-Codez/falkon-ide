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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { resolveChatUri } from "../../common/state/sessionState.js";
import { ClaudeFileEditObserver } from "./claudeFileEditObserver.js";
import { ClaudeMapperState, mapSDKMessageToAgentSignals } from "./claudeMapSessionEvents.js";
let ClaudeSdkMessageRouter = class extends Disposable {
  constructor(sessionUri, _chatChannelUri, dbRef, _subagents, clientToolOwner = void 0, instantiationService, _logService) {
    super();
    this._chatChannelUri = _chatChannelUri;
    this._subagents = _subagents;
    this._logService = _logService;
    this._onDidProduceSignal = this._register(new Emitter());
    this.onDidProduceSignal = this._onDidProduceSignal.event;
    this._mapperState = new ClaudeMapperState();
    this._clientToolOwner = clientToolOwner;
    this._editObserver = this._register(
      instantiationService.createInstance(ClaudeFileEditObserver, resolveChatUri(sessionUri, this._chatChannelUri).toString(), dbRef)
    );
  }
  setClientToolOwner(clientToolOwner) {
    this._clientToolOwner = clientToolOwner;
  }
  async handle(message, turnId, context) {
    if (message.type === "assistant") {
      this._editObserver.observeAssistant(message, context?.mode);
    } else if (message.type === "user" && turnId !== void 0) {
      await this._editObserver.observeUser(message, turnId, this._mapperState);
    }
    if (turnId === void 0) {
      return;
    }
    try {
      const signals = mapSDKMessageToAgentSignals(
        message,
        this._chatChannelUri,
        turnId,
        this._mapperState,
        this._logService,
        this._subagents,
        this._clientToolOwner,
        context?.turnDuration
      );
      for (const signal of signals) {
        this._onDidProduceSignal.fire(signal);
      }
    } catch (mapperErr) {
      this._logService.warn(`[ClaudeSdkMessageRouter] mapper threw, skipping message: ${mapperErr}`);
    }
  }
};
ClaudeSdkMessageRouter = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILogService)
], ClaudeSdkMessageRouter);
export {
  ClaudeSdkMessageRouter
};
