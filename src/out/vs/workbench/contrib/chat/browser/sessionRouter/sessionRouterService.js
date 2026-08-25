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
import { CancellationError } from "../../../../../base/common/errors.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ChatMessageRole, getTextResponseFromStream, ILanguageModelsService } from "../../common/languageModels.js";
import { buildRouterMessages, parseRouterResponse } from "../../common/sessionRouter.js";
let SessionRouterService = class {
  constructor(languageModelsService, logService) {
    this.languageModelsService = languageModelsService;
    this.logService = logService;
  }
  async route(request, token) {
    if (!request.sessions.length) {
      return [];
    }
    const scored = await this.scoreWithModel(request, token);
    return scored ?? [];
  }
  async scoreWithModel(request, token) {
    let modelId;
    try {
      const models = await this.languageModelsService.selectLanguageModels({ vendor: "copilot", id: "copilot-utility-small" });
      modelId = models.at(0);
    } catch (err) {
      this.logService.trace("[SessionRouter] model selection failed, routing to a new session", err);
    }
    if (!modelId) {
      return void 0;
    }
    const messages = buildRouterMessages(request).map((message) => ({
      role: message.role === "system" ? ChatMessageRole.System : ChatMessageRole.User,
      content: [{ type: "text", value: message.content }]
    }));
    try {
      const response = await this.languageModelsService.sendChatRequest(modelId, void 0, messages, {}, token);
      const text = await getTextResponseFromStream(response);
      const validIds = new Set(request.sessions.map((session) => session.sessionId));
      return parseRouterResponse(text, validIds);
    } catch (err) {
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      this.logService.trace("[SessionRouter] scoring request failed, routing to a new session", err);
      return void 0;
    }
  }
};
SessionRouterService = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILogService)
], SessionRouterService);
export {
  SessionRouterService
};
