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
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { URI } from "../../../../../base/common/uri.js";
import { Schemas } from "../../../../../base/common/network.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { VSCODE_LSP_TERMINAL_PROMPT_TRACKER } from "./lspTerminalUtil.js";
let LspTerminalModelContentProvider = class extends Disposable {
  constructor(capabilityStore, terminalId, virtualTerminalDocument, shellType, textModelService, _modelService, _languageService) {
    super();
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._onCommandFinishedListener = this._register(new MutableDisposable());
    this._register(textModelService.registerTextModelContentProvider(LspTerminalModelContentProvider.scheme, this));
    this._capabilitiesStore = capabilityStore;
    this._commandDetection = this._capabilitiesStore.get(TerminalCapability.CommandDetection);
    this._registerTerminalCommandFinishedListener();
    this._virtualTerminalDocumentUri = virtualTerminalDocument;
    this._shellType = shellType;
  }
  static {
    this.scheme = Schemas.vscodeTerminal;
  }
  // Listens to onDidChangeShellType event from `terminal.suggest.contribution.ts`
  shellTypeChanged(shellType) {
    this._shellType = shellType;
  }
  /**
   * Sets or updates content for a terminal virtual document.
   * This is when user has executed succesful command in terminal.
   * Transfer the content to virtual document, and relocate delimiter to get terminal prompt ready for next prompt.
   */
  setContent(content) {
    const model = this._modelService.getModel(this._virtualTerminalDocumentUri);
    if (this._shellType) {
      if (model) {
        const existingContent = model.getValue();
        if (existingContent === "") {
          model.setValue(VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
        } else {
          const delimiterIndex = existingContent.lastIndexOf(VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
          const sanitizedExistingContent = delimiterIndex !== -1 ? existingContent.substring(0, delimiterIndex) : existingContent;
          const newContent = sanitizedExistingContent + "\n" + content + "\n" + VSCODE_LSP_TERMINAL_PROMPT_TRACKER;
          model.setValue(newContent);
        }
      }
    }
  }
  /**
   * Real-time conversion of terminal input to virtual document happens here.
   * This is when user types in terminal, and we want to track the input.
   * We want to track the input and update the virtual document.
   * Note: This is for non-executed command.
  */
  trackPromptInputToVirtualFile(content) {
    this._commandDetection = this._capabilitiesStore.get(TerminalCapability.CommandDetection);
    const model = this._modelService.getModel(this._virtualTerminalDocumentUri);
    if (this._shellType) {
      if (model) {
        const existingContent = model.getValue();
        const delimiterIndex = existingContent.lastIndexOf(VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
        const sanitizedExistingContent = delimiterIndex !== -1 ? existingContent.substring(0, delimiterIndex) : existingContent;
        const newContent = sanitizedExistingContent + VSCODE_LSP_TERMINAL_PROMPT_TRACKER + content;
        model.setValue(newContent);
      }
    }
  }
  _registerTerminalCommandFinishedListener() {
    const attachListener = () => {
      if (this._onCommandFinishedListener.value) {
        return;
      }
      if (this._commandDetection && this._commandDetection.onCommandFinished) {
        this._onCommandFinishedListener.value = this._register(this._commandDetection.onCommandFinished((e) => {
          if (e.exitCode === 0 && this._shellType) {
            this.setContent(e.command);
          }
        }));
      }
    };
    attachListener();
    this._register(this._capabilitiesStore.onDidAddCommandDetectionCapability((e) => {
      this._commandDetection = e;
      attachListener();
    }));
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    const languageId = this._languageService.guessLanguageIdByFilepathOrFirstLine(resource);
    const languageSelection = languageId ? this._languageService.createById(languageId) : this._languageService.createById("plaintext");
    return this._modelService.createModel("", languageSelection, resource, false);
  }
};
LspTerminalModelContentProvider = __decorateClass([
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IModelService),
  __decorateParam(6, ILanguageService)
], LspTerminalModelContentProvider);
function createTerminalLanguageVirtualUri(terminalId, languageExtension) {
  return URI.from({
    scheme: Schemas.vscodeTerminal,
    path: `/terminal${terminalId}.${languageExtension}`
  });
}
export {
  LspTerminalModelContentProvider,
  createTerminalLanguageVirtualUri
};
