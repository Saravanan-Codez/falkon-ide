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
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { CodeActionKind } from "../../../../editor/contrib/codeAction/common/types.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ApplyFileSnippetAction } from "./commands/fileTemplateSnippets.js";
import { getSurroundableSnippets, SurroundWithSnippetEditorAction } from "./commands/surroundWithSnippet.js";
import { ISnippetsService } from "./snippets.js";
let SurroundWithSnippetCodeActionProvider = class {
  constructor(_snippetService) {
    this._snippetService = _snippetService;
  }
  static {
    this._MAX_CODE_ACTIONS = 4;
  }
  static {
    this._overflowCommandCodeAction = {
      kind: CodeActionKind.SurroundWith.value,
      title: localize("more", "More..."),
      command: {
        id: SurroundWithSnippetEditorAction.options.id,
        title: SurroundWithSnippetEditorAction.options.title.value
      }
    };
  }
  async provideCodeActions(model, range) {
    if (range.isEmpty()) {
      return void 0;
    }
    const position = Selection.isISelection(range) ? range.getPosition() : range.getStartPosition();
    const snippets = await getSurroundableSnippets(this._snippetService, model, position, false);
    if (!snippets.length) {
      return void 0;
    }
    const actions = [];
    for (const snippet of snippets) {
      if (actions.length >= SurroundWithSnippetCodeActionProvider._MAX_CODE_ACTIONS) {
        actions.push(SurroundWithSnippetCodeActionProvider._overflowCommandCodeAction);
        break;
      }
      actions.push({
        title: localize("codeAction", "{0}", snippet.name),
        kind: CodeActionKind.SurroundWith.value,
        edit: asWorkspaceEdit(model, range, snippet)
      });
    }
    return {
      actions,
      dispose() {
      }
    };
  }
};
SurroundWithSnippetCodeActionProvider = __decorateClass([
  __decorateParam(0, ISnippetsService)
], SurroundWithSnippetCodeActionProvider);
let FileTemplateCodeActionProvider = class {
  constructor(_snippetService) {
    this._snippetService = _snippetService;
    this.providedCodeActionKinds = [CodeActionKind.SurroundWith.value];
  }
  static {
    this._MAX_CODE_ACTIONS = 4;
  }
  static {
    this._overflowCommandCodeAction = {
      title: localize("overflow.start.title", "Start with Snippet"),
      kind: CodeActionKind.SurroundWith.value,
      command: {
        id: ApplyFileSnippetAction.Id,
        title: ""
      }
    };
  }
  async provideCodeActions(model) {
    if (model.getValueLength() !== 0) {
      return void 0;
    }
    const snippets = await this._snippetService.getSnippets(model.getLanguageId(), model.uri, { fileTemplateSnippets: true, includeNoPrefixSnippets: true });
    const actions = [];
    for (const snippet of snippets) {
      if (actions.length >= FileTemplateCodeActionProvider._MAX_CODE_ACTIONS) {
        actions.push(FileTemplateCodeActionProvider._overflowCommandCodeAction);
        break;
      }
      actions.push({
        title: localize("title", "Start with: {0}", snippet.name),
        kind: CodeActionKind.SurroundWith.value,
        edit: asWorkspaceEdit(model, model.getFullModelRange(), snippet)
      });
    }
    return {
      actions,
      dispose() {
      }
    };
  }
};
FileTemplateCodeActionProvider = __decorateClass([
  __decorateParam(0, ISnippetsService)
], FileTemplateCodeActionProvider);
function asWorkspaceEdit(model, range, snippet) {
  return {
    edits: [{
      versionId: model.getVersionId(),
      resource: model.uri,
      textEdit: {
        range,
        text: snippet.body,
        insertAsSnippet: true
      }
    }]
  };
}
let SnippetCodeActions = class {
  constructor(instantiationService, languageFeaturesService, configService) {
    this._store = new DisposableStore();
    const setting = "editor.snippets.codeActions.enabled";
    const sessionStore = new DisposableStore();
    const update = () => {
      sessionStore.clear();
      if (configService.getValue(setting)) {
        sessionStore.add(languageFeaturesService.codeActionProvider.register("*", instantiationService.createInstance(SurroundWithSnippetCodeActionProvider)));
        sessionStore.add(languageFeaturesService.codeActionProvider.register("*", instantiationService.createInstance(FileTemplateCodeActionProvider)));
      }
    };
    update();
    this._store.add(configService.onDidChangeConfiguration((e) => e.affectsConfiguration(setting) && update()));
    this._store.add(sessionStore);
  }
  dispose() {
    this._store.dispose();
  }
};
SnippetCodeActions = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IConfigurationService)
], SnippetCodeActions);
export {
  SnippetCodeActions
};
