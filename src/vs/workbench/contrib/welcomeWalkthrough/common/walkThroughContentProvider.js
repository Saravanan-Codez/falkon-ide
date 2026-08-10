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
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { DefaultEndOfLine, EndOfLinePreference } from "../../../../editor/common/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import * as marked from "../../../../base/common/marked/marked.js";
import { Schemas } from "../../../../base/common/network.js";
import { Range } from "../../../../editor/common/core/range.js";
import { createTextBufferFactory } from "../../../../editor/common/model/textModel.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
class WalkThroughContentProviderRegistry {
  constructor() {
    this.providers = /* @__PURE__ */ new Map();
  }
  registerProvider(moduleId, provider) {
    this.providers.set(moduleId, provider);
  }
  getProvider(moduleId) {
    return this.providers.get(moduleId);
  }
}
const walkThroughContentRegistry = new WalkThroughContentProviderRegistry();
async function moduleToContent(instantiationService, resource) {
  if (!resource.query) {
    throw new Error("Walkthrough: invalid resource");
  }
  const query = JSON.parse(resource.query);
  if (!query.moduleId) {
    throw new Error("Walkthrough: invalid resource");
  }
  const provider = walkThroughContentRegistry.getProvider(query.moduleId);
  if (!provider) {
    throw new Error(`Walkthrough: no provider registered for ${query.moduleId}`);
  }
  return instantiationService.invokeFunction(provider);
}
let WalkThroughSnippetContentProvider = class {
  constructor(textModelResolverService, languageService, modelService, instantiationService) {
    this.textModelResolverService = textModelResolverService;
    this.languageService = languageService;
    this.modelService = modelService;
    this.instantiationService = instantiationService;
    this.loads = /* @__PURE__ */ new Map();
    this.textModelResolverService.registerTextModelContentProvider(Schemas.walkThroughSnippet, this);
  }
  static {
    this.ID = "workbench.contrib.walkThroughSnippetContentProvider";
  }
  async textBufferFactoryFromResource(resource) {
    let ongoing = this.loads.get(resource.toString());
    if (!ongoing) {
      ongoing = moduleToContent(this.instantiationService, resource).then((content) => createTextBufferFactory(content)).finally(() => this.loads.delete(resource.toString()));
      this.loads.set(resource.toString(), ongoing);
    }
    return ongoing;
  }
  async provideTextContent(resource) {
    const factory = await this.textBufferFactoryFromResource(resource.with({ fragment: "" }));
    let codeEditorModel = this.modelService.getModel(resource);
    if (!codeEditorModel) {
      const j = parseInt(resource.fragment);
      let i = 0;
      const renderer = new marked.marked.Renderer();
      renderer.code = ({ text, lang }) => {
        i++;
        const languageId = typeof lang === "string" ? this.languageService.getLanguageIdByLanguageName(lang) || "" : "";
        const languageSelection = this.languageService.createById(languageId);
        const model = this.modelService.createModel(text, languageSelection, resource.with({ fragment: `${i}.${lang}` }));
        if (i === j) {
          codeEditorModel = model;
        }
        return "";
      };
      const textBuffer = factory.create(DefaultEndOfLine.LF).textBuffer;
      const lineCount = textBuffer.getLineCount();
      const range = new Range(1, 1, lineCount, textBuffer.getLineLength(lineCount) + 1);
      const markdown = textBuffer.getValueInRange(range, EndOfLinePreference.TextDefined);
      marked.marked(markdown, { renderer });
    }
    return assertReturnsDefined(codeEditorModel);
  }
};
WalkThroughSnippetContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IInstantiationService)
], WalkThroughSnippetContentProvider);
export {
  WalkThroughSnippetContentProvider,
  moduleToContent,
  walkThroughContentRegistry
};
