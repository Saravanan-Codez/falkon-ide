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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { createDecorator, IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { AgentSessionsModel } from "./agentSessionsModel.js";
let AgentSessionsService = class extends Disposable {
  constructor(instantiationService, chatService) {
    super();
    this.instantiationService = instantiationService;
    this.chatService = chatService;
    this._onDidChangeSessionArchivedState = this._register(new Emitter());
    this.onDidChangeSessionArchivedState = this._onDidChangeSessionArchivedState.event;
  }
  get model() {
    if (!this._model) {
      this._model = this._register(this.instantiationService.createInstance(AgentSessionsModel));
      this._register(this._model.onDidChangeSessionArchivedState((session) => {
        if (session.isArchived()) {
          void this.chatService.cancelCurrentRequestForSession(session.resource, "archive");
        }
        this._onDidChangeSessionArchivedState.fire(session);
      }));
      this._model.resolve(
        void 0
        /* all providers */
      );
    }
    return this._model;
  }
  getSession(resource) {
    return this.model.getSession(resource);
  }
};
AgentSessionsService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IChatService)
], AgentSessionsService);
const IAgentSessionsService = createDecorator("agentSessions");
export {
  AgentSessionsService,
  IAgentSessionsService
};
