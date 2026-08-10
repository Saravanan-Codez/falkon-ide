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
import { withoutDuplicates } from "../../../../base/common/arrays.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../base/common/observable.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { inlineCompletionProviderGetMatcher, providerIdSchemaUri } from "../../../../editor/contrib/inlineCompletions/browser/controller/commands.js";
import { Extensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { wrapInHotClass1 } from "../../../../platform/observable/common/wrapInHotClass.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { InlineCompletionLanguageStatusBarContribution } from "./inlineCompletionLanguageStatusBarContribution.js";
registerWorkbenchContribution2(InlineCompletionLanguageStatusBarContribution.Id, wrapInHotClass1(InlineCompletionLanguageStatusBarContribution.hot), WorkbenchPhase.Eventually);
let InlineCompletionSchemaContribution = class extends Disposable {
  constructor(_languageFeaturesService) {
    super();
    this._languageFeaturesService = _languageFeaturesService;
    const registry = Registry.as(Extensions.JSONContribution);
    const inlineCompletionsProvider = observableFromEvent(
      this,
      this._languageFeaturesService.inlineCompletionsProvider.onDidChange,
      () => this._languageFeaturesService.inlineCompletionsProvider.allNoModel()
    );
    this._register(autorun((reader) => {
      const provider = inlineCompletionsProvider.read(reader);
      registry.registerSchema(providerIdSchemaUri, {
        enum: withoutDuplicates(provider.flatMap((p) => inlineCompletionProviderGetMatcher(p)))
      }, reader.store);
    }));
  }
  static {
    this.Id = "vs.contrib.InlineCompletionSchemaContribution";
  }
};
InlineCompletionSchemaContribution = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService)
], InlineCompletionSchemaContribution);
registerWorkbenchContribution2(InlineCompletionSchemaContribution.Id, InlineCompletionSchemaContribution, WorkbenchPhase.Eventually);
export {
  InlineCompletionSchemaContribution
};
