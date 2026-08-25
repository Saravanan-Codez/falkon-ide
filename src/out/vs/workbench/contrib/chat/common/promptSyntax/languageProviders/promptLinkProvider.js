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
import { IPromptsService } from "../service/promptsService.js";
let PromptLinkProvider = class {
  constructor(promptsService) {
    this.promptsService = promptsService;
  }
  /**
   * Provide list of links for the provided text model.
   */
  async provideLinks(model, token) {
    const promptAST = this.promptsService.getParsedPromptFile(model);
    if (!promptAST.body) {
      return;
    }
    const links = [];
    for (const ref of promptAST.body.fileReferences) {
      if (!ref.isMarkdownLink) {
        const url = promptAST.body.resolveFilePath(ref.content);
        if (url) {
          links.push({ range: ref.range, url });
        }
      }
    }
    return { links };
  }
};
PromptLinkProvider = __decorateClass([
  __decorateParam(0, IPromptsService)
], PromptLinkProvider);
export {
  PromptLinkProvider
};
