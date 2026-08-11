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
import { Range } from "../../../../../../editor/common/core/range.js";
import { IChatModeService } from "../../chatModes.js";
import { PromptHeaderAttributes } from "../promptFileParser.js";
import { getPromptsTypeForLanguageId } from "../promptTypes.js";
import { IPromptsService } from "../service/promptsService.js";
let PromptHeaderDefinitionProvider = class {
  constructor(promptsService, chatModeService) {
    this.promptsService = promptsService;
    this.chatModeService = chatModeService;
    /**
     * Debug display name for this provider.
     */
    this._debugDisplayName = "PromptHeaderDefinitionProvider";
  }
  async provideDefinition(model, position, token) {
    const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
    if (!promptType) {
      return void 0;
    }
    const promptAST = this.promptsService.getParsedPromptFile(model);
    const header = promptAST.header;
    if (!header) {
      return void 0;
    }
    const agentAttr = header.getAttribute(PromptHeaderAttributes.agent) ?? header.getAttribute(PromptHeaderAttributes.mode);
    if (agentAttr && agentAttr.value.type === "scalar" && agentAttr.range.containsPosition(position)) {
      const agent = (await this.chatModeService.getLocalModes()).findModeByName(agentAttr.value.value);
      if (agent && agent.uri) {
        return {
          uri: agent.uri.get(),
          range: new Range(1, 1, 1, 1)
        };
      }
    }
    return void 0;
  }
};
PromptHeaderDefinitionProvider = __decorateClass([
  __decorateParam(0, IPromptsService),
  __decorateParam(1, IChatModeService)
], PromptHeaderDefinitionProvider);
export {
  PromptHeaderDefinitionProvider
};
