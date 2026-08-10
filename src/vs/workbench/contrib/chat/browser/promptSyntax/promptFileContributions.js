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
import { PromptLinkProvider } from "../../common/promptSyntax/languageProviders/promptLinkProvider.js";
import { PromptBodyAutocompletion } from "../../common/promptSyntax/languageProviders/promptBodyAutocompletion.js";
import { PromptHeaderAutocompletion } from "../../common/promptSyntax/languageProviders/promptHeaderAutocompletion.js";
import { PromptHoverProvider } from "../../common/promptSyntax/languageProviders/promptHovers.js";
import { PromptHeaderDefinitionProvider } from "../../common/promptSyntax/languageProviders/PromptHeaderDefinitionProvider.js";
import { MARKERS_OWNER_ID, PromptValidator } from "../../common/promptSyntax/languageProviders/promptValidator.js";
import { PromptDocumentSemanticTokensProvider } from "../../common/promptSyntax/languageProviders/promptDocumentSemanticTokensProvider.js";
import { PromptCodeActionProvider } from "../../common/promptSyntax/languageProviders/promptCodeActions.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ALL_PROMPTS_LANGUAGE_SELECTOR, getPromptsTypeForLanguageId } from "../../common/promptSyntax/promptTypes.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { ILanguageModelsService } from "../../common/languageModels.js";
import { ILanguageModelToolsService } from "../../common/tools/languageModelToolsService.js";
import { IChatModeService } from "../../common/chatModes.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { Delayer } from "../../../../../base/common/async.js";
import { ResourceMap } from "../../../../../base/common/map.js";
let PromptLanguageFeaturesProvider = class extends Disposable {
  static {
    this.ID = "chat.promptLanguageFeatures";
  }
  constructor(languageService, instantiationService) {
    super();
    this._register(languageService.linkProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptLinkProvider)));
    this._register(languageService.completionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptBodyAutocompletion)));
    this._register(languageService.completionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptHeaderAutocompletion)));
    this._register(languageService.hoverProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptHoverProvider)));
    this._register(languageService.definitionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptHeaderDefinitionProvider)));
    this._register(languageService.documentSemanticTokensProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptDocumentSemanticTokensProvider)));
    this._register(languageService.codeActionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptCodeActionProvider)));
    this._register(instantiationService.createInstance(PromptValidatorContribution));
  }
};
PromptLanguageFeaturesProvider = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IInstantiationService)
], PromptLanguageFeaturesProvider);
let PromptValidatorContribution = class extends Disposable {
  constructor(codeEditorService, instantiationService, markerService, promptsService, languageModelsService, languageModelToolsService, chatModeService) {
    super();
    this.codeEditorService = codeEditorService;
    this.markerService = markerService;
    this.promptsService = promptsService;
    this.languageModelsService = languageModelsService;
    this.languageModelToolsService = languageModelToolsService;
    this.chatModeService = chatModeService;
    this.localDisposables = this._register(new DisposableStore());
    this.validator = instantiationService.createInstance(PromptValidator);
    void this.updateRegistration();
  }
  async updateRegistration() {
    this.localDisposables.clear();
    const trackers = new ResourceMap();
    this.localDisposables.add(toDisposable(() => {
      trackers.forEach((tracker) => tracker.dispose());
      trackers.clear();
    }));
    const acquire = (editor) => {
      const model = editor.getModel();
      if (!model) {
        return;
      }
      const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
      if (promptType) {
        const existing = trackers.get(model.uri);
        if (existing) {
          existing.refCount++;
          return;
        }
        trackers.set(model.uri, new ModelTracker(model, promptType, this.validator, this.promptsService, this.markerService));
      }
    };
    const release = (uri) => {
      const tracker = trackers.get(uri);
      if (tracker && --tracker.refCount === 0) {
        tracker.dispose();
        trackers.delete(uri);
      }
    };
    const perEditorDisposables = new DisposableMap();
    this.localDisposables.add(perEditorDisposables);
    const onCodeEditorAdd = (editor) => {
      acquire(editor);
      const store = new DisposableStore();
      store.add(editor.onDidChangeModel((e) => {
        if (e.oldModelUrl) {
          release(e.oldModelUrl);
        }
        acquire(editor);
      }));
      store.add(editor.onDidChangeModelLanguage((e) => {
        const model = editor.getModel();
        if (model) {
          release(model.uri);
          acquire(editor);
        }
      }));
      perEditorDisposables.set(editor.getId(), store);
    };
    for (const editor of this.codeEditorService.listCodeEditors()) {
      onCodeEditorAdd(editor);
    }
    this.localDisposables.add(this.codeEditorService.onCodeEditorAdd((editor) => {
      onCodeEditorAdd(editor);
    }));
    this.localDisposables.add(this.codeEditorService.onCodeEditorRemove((editor) => {
      perEditorDisposables.deleteAndDispose(editor.getId());
      const model = editor.getModel();
      if (model) {
        release(model.uri);
      }
    }));
    const validateAll = () => trackers.forEach((tracker) => tracker.validate());
    const localModes = await this.chatModeService.getLocalModes();
    this.localDisposables.add(this.languageModelToolsService.onDidChangeTools(() => validateAll()));
    this.localDisposables.add(localModes.onDidChange(() => validateAll()));
    this.localDisposables.add(this.languageModelsService.onDidChangeLanguageModels(() => validateAll()));
  }
};
PromptValidatorContribution = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IMarkerService),
  __decorateParam(3, IPromptsService),
  __decorateParam(4, ILanguageModelsService),
  __decorateParam(5, ILanguageModelToolsService),
  __decorateParam(6, IChatModeService)
], PromptValidatorContribution);
class ModelTracker extends Disposable {
  constructor(textModel, promptType, validator, promptsService, markerService) {
    super();
    this.textModel = textModel;
    this.promptType = promptType;
    this.validator = validator;
    this.promptsService = promptsService;
    this.markerService = markerService;
    this.refCount = 1;
    this.delayer = this._register(new Delayer(200));
    this._register(textModel.onDidChangeContent(() => this.validate()));
    this.validate();
  }
  validate() {
    this.delayer.trigger(async () => {
      const markers = [];
      const ast = this.promptsService.getParsedPromptFile(this.textModel);
      await this.validator.validate(ast, this.promptType, (m) => markers.push(m));
      if (!this._store.isDisposed) {
        this.markerService.changeOne(MARKERS_OWNER_ID, this.textModel.uri, markers);
      }
    });
  }
  dispose() {
    this.markerService.remove(MARKERS_OWNER_ID, [this.textModel.uri]);
    super.dispose();
  }
}
export {
  PromptLanguageFeaturesProvider
};
