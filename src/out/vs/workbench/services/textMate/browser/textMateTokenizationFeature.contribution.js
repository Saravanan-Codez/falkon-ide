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
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { ITextMateTokenizationService } from "./textMateTokenizationFeature.js";
import { TextMateTokenizationFeature } from "./textMateTokenizationFeatureImpl.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { TokenizationRegistry } from "../../../../editor/common/languages.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
let TextMateTokenizationInstantiator = class {
  static {
    this.ID = "workbench.contrib.textMateTokenizationInstantiator";
  }
  constructor(_textMateTokenizationService) {
  }
};
TextMateTokenizationInstantiator = __decorateClass([
  __decorateParam(0, ITextMateTokenizationService)
], TextMateTokenizationInstantiator);
registerSingleton(ITextMateTokenizationService, TextMateTokenizationFeature, InstantiationType.Eager);
registerWorkbenchContribution2(TextMateTokenizationInstantiator.ID, TextMateTokenizationInstantiator, WorkbenchPhase.BlockRestore);
CommandsRegistry.registerCommand("_workbench.colorizeTextMateTokens", async (accessor, resource) => {
  const textModelService = accessor.get(ITextFileService);
  const textModel = resource ? (await textModelService.files.resolve(resource)).textEditorModel : void 0;
  if (!textModel) {
    throw new Error(`Cannot resolve text model for resource ${resource}`);
  }
  const tokenizer = await TokenizationRegistry.getOrCreate(textModel.getLanguageId());
  if (!tokenizer) {
    throw new Error(`Cannot resolve tokenizer for language ${textModel.getLanguageId()}`);
  }
  const stopwatch = new StopWatch();
  let state = tokenizer.getInitialState();
  for (let i = 1; i <= textModel.getLineCount(); i++) {
    state = tokenizer.tokenizeEncoded(textModel.getLineContent(i), true, state).endState;
  }
  stopwatch.stop();
  return { tokenizeTime: stopwatch.elapsed() };
});
