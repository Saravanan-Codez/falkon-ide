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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { EditorsOrder } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { getNotebookEditorFromEditorPane } from "../../../notebook/browser/notebookBrowser.js";
import { WebviewInput } from "../../../webviewPanel/browser/webviewEditorInput.js";
import { IChatEditingService } from "../../common/editing/chatEditingService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { isStringImplicitContextValue } from "../../common/attachments/chatVariableEntries.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ILanguageModelIgnoredFilesService } from "../../common/ignoredFiles.js";
import { IChatWidgetService } from "../chat.js";
import { IChatContextService } from "../contextContrib/chatContextService.js";
import { BrowserEditorInput } from "../../../browserView/common/browserEditorInput.js";
let ChatImplicitContextContribution = class extends Disposable {
  constructor(codeEditorService, editorService, chatWidgetService, chatService, chatEditingService, configurationService, ignoredFilesService, chatContextService) {
    super();
    this.codeEditorService = codeEditorService;
    this.editorService = editorService;
    this.chatWidgetService = chatWidgetService;
    this.chatService = chatService;
    this.chatEditingService = chatEditingService;
    this.configurationService = configurationService;
    this.ignoredFilesService = ignoredFilesService;
    this.chatContextService = chatContextService;
    this._currentCancelTokenSource = this._register(new MutableDisposable());
    this._implicitContextEnablement = this.configurationService.getValue("chat.implicitContext.enabled");
    const activeEditorDisposables = this._register(new DisposableStore());
    this._register(Event.runAndSubscribe(
      editorService.onDidActiveEditorChange,
      (() => {
        activeEditorDisposables.clear();
        const codeEditor = this.findActiveCodeEditor();
        if (codeEditor) {
          activeEditorDisposables.add(Event.debounce(
            Event.any(
              codeEditor.onDidChangeModel,
              codeEditor.onDidChangeModelLanguage,
              codeEditor.onDidChangeCursorSelection,
              codeEditor.onDidScrollChange
            ),
            () => void 0,
            500
          )(() => this.updateImplicitContext()));
        }
        const notebookEditor = this.findActiveNotebookEditor();
        if (notebookEditor) {
          const activeCellDisposables = activeEditorDisposables.add(new DisposableStore());
          activeEditorDisposables.add(notebookEditor.onDidChangeActiveCell(() => {
            activeCellDisposables.clear();
            const codeEditor2 = this.codeEditorService.getActiveCodeEditor();
            if (codeEditor2 && codeEditor2.getModel()?.uri.scheme === Schemas.vscodeNotebookCell) {
              activeCellDisposables.add(Event.debounce(
                Event.any(
                  codeEditor2.onDidChangeModel,
                  codeEditor2.onDidChangeCursorSelection,
                  codeEditor2.onDidScrollChange
                ),
                () => void 0,
                500
              )(() => this.updateImplicitContext()));
            }
          }));
          activeEditorDisposables.add(Event.debounce(
            Event.any(
              notebookEditor.onDidChangeModel,
              notebookEditor.onDidChangeActiveCell
            ),
            () => void 0,
            500
          )(() => this.updateImplicitContext()));
        }
        const webviewEditor = this.findActiveWebviewEditor();
        if (webviewEditor) {
          activeEditorDisposables.add(Event.debounce(webviewEditor.input.webview.onMessage, () => void 0, 500)(() => {
            this.updateImplicitContext();
          }));
        }
        this.updateImplicitContext();
      })
    ));
    this._register(autorun((reader) => {
      this.chatEditingService.editingSessionsObs.read(reader);
      this.updateImplicitContext();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("chat.implicitContext.enabled")) {
        this._implicitContextEnablement = this.configurationService.getValue("chat.implicitContext.enabled");
        this.updateImplicitContext();
      }
    }));
    this._register(this.chatService.onDidSubmitRequest(({ chatSessionResource }) => {
      const widget = this.chatWidgetService.getWidgetBySessionResource(chatSessionResource);
      if (!widget?.input.implicitContext) {
        return;
      }
      if (this._implicitContextEnablement[widget.location] === "first" && widget.viewModel?.getItems().length !== 0) {
        widget.input.implicitContext.setValues([]);
      }
    }));
    this._register(this.chatWidgetService.onDidAddWidget(async (widget) => {
      await this.updateImplicitContext(widget);
    }));
  }
  static {
    this.ID = "chat.implicitContext";
  }
  findActiveCodeEditor() {
    const codeEditor = this.codeEditorService.getActiveCodeEditor();
    if (codeEditor) {
      const model = codeEditor.getModel();
      if (model?.uri.scheme === Schemas.vscodeNotebookCell) {
        return void 0;
      }
      if (model) {
        return codeEditor;
      }
    }
    for (const codeOrDiffEditor of this.editorService.getVisibleTextEditorControls(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
      const codeEditor2 = getCodeEditor(codeOrDiffEditor);
      if (!codeEditor2) {
        continue;
      }
      const model = codeEditor2.getModel();
      if (model) {
        return codeEditor2;
      }
    }
    return void 0;
  }
  findActiveWebviewEditor() {
    const activeEditorPane = this.editorService.activeEditorPane;
    if (activeEditorPane?.input instanceof WebviewInput) {
      return activeEditorPane;
    }
    return void 0;
  }
  findActiveBrowserEditor() {
    const activeEditorPane = this.editorService.activeEditorPane;
    if (activeEditorPane?.input instanceof BrowserEditorInput) {
      return activeEditorPane.input;
    }
    return void 0;
  }
  findActiveNotebookEditor() {
    return getNotebookEditorFromEditorPane(this.editorService.activeEditorPane);
  }
  async updateImplicitContext(updateWidget) {
    const cancelTokenSource = this._currentCancelTokenSource.value = new CancellationTokenSource();
    const codeEditor = this.findActiveCodeEditor();
    const model = codeEditor?.getModel();
    const selection = codeEditor?.getSelection();
    const useSuggestedContext = this.configurationService.getValue("chat.implicitContext.suggestedContext");
    let newValue;
    let isSelection = false;
    let languageId;
    let providerContext;
    if (model) {
      languageId = model.getLanguageId();
      if (selection && !selection.isEmpty()) {
        newValue = { uri: model.uri, range: selection };
        isSelection = true;
      } else {
        if (useSuggestedContext) {
          newValue = model.uri;
        } else {
          const visibleRanges = codeEditor?.getVisibleRanges();
          if (visibleRanges && visibleRanges.length > 0) {
            let range = visibleRanges[0];
            visibleRanges.slice(1).forEach((r) => {
              range = range.plusRange(r);
            });
            newValue = { uri: model.uri, range };
          } else {
            newValue = model.uri;
          }
        }
      }
      providerContext = await this.chatContextService.contextForResource(model.uri, languageId);
    }
    const notebookEditor = this.findActiveNotebookEditor();
    if (notebookEditor?.isReplHistory) {
      newValue = void 0;
    } else if (notebookEditor) {
      const activeCell = notebookEditor.getActiveCell();
      if (activeCell) {
        const codeEditor2 = this.codeEditorService.getActiveCodeEditor();
        const selection2 = codeEditor2?.getSelection();
        const visibleRanges = codeEditor2?.getVisibleRanges() || [];
        newValue = activeCell.uri;
        const cellModel = codeEditor2?.getModel();
        if (cellModel && isEqual(cellModel.uri, activeCell.uri)) {
          if (selection2 && !selection2.isEmpty()) {
            newValue = { uri: activeCell.uri, range: selection2 };
            isSelection = true;
          } else if (visibleRanges.length > 0) {
            if (!isEntireCellVisible(cellModel, visibleRanges)) {
              let range = visibleRanges[0];
              visibleRanges.slice(1).forEach((r) => {
                range = range.plusRange(r);
              });
              newValue = { uri: activeCell.uri, range };
            }
          }
        }
      } else {
        newValue = notebookEditor.textModel?.uri;
      }
    }
    const webviewEditor = this.findActiveWebviewEditor();
    if (webviewEditor?.input instanceof WebviewInput && webviewEditor.input.resource) {
      const webviewContext = await this.chatContextService.contextForResource(webviewEditor.input.resource, void 0, webviewEditor.input.viewType);
      if (webviewContext) {
        newValue = webviewContext;
      }
    }
    const browser = this.findActiveBrowserEditor();
    if (browser?.isSharingAvailable && useSuggestedContext) {
      newValue = browser.resource;
    }
    const uri = newValue instanceof URI ? newValue : isStringImplicitContextValue(newValue) ? void 0 : newValue?.uri;
    if (uri && (await this.ignoredFilesService.fileIsIgnored(uri, cancelTokenSource.token) || uri.path.endsWith(".copilotmd"))) {
      newValue = void 0;
    }
    if (cancelTokenSource.token.isCancellationRequested) {
      return;
    }
    const widgets = updateWidget ? [updateWidget] : [...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat), ...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.EditorInline)];
    for (const widget of widgets) {
      if (!widget.input.implicitContext) {
        continue;
      }
      const setting = this._implicitContextEnablement[widget.location];
      const isFirstInteraction = widget.viewModel?.getItems().length === 0;
      if (setting === "always" || setting === "first" && isFirstInteraction) {
        const hasActiveEditor = !!this.editorService.activeEditor;
        if (newValue !== void 0 || !widget.input.implicitContext.hasValue || !hasActiveEditor) {
          widget.input.implicitContext.setValues([{ value: newValue, isSelection }, { value: providerContext, isSelection: false }]);
        }
      } else {
        widget.input.implicitContext.setValues([]);
      }
    }
  }
};
ChatImplicitContextContribution = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatEditingService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILanguageModelIgnoredFilesService),
  __decorateParam(7, IChatContextService)
], ChatImplicitContextContribution);
function isEntireCellVisible(cellModel, visibleRanges) {
  if (visibleRanges.length === 1 && visibleRanges[0].startLineNumber === 1 && visibleRanges[0].startColumn === 1 && visibleRanges[0].endLineNumber === cellModel.getLineCount() && visibleRanges[0].endColumn === cellModel.getLineMaxColumn(visibleRanges[0].endLineNumber)) {
    return true;
  }
  return false;
}
class ChatImplicitContexts extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidChangeValue = this._register(new Emitter());
    this.onDidChangeValue = this._onDidChangeValue.event;
    this._values = this._register(new DisposableMap());
    this._valuesDisposables = this._register(new DisposableStore());
    this._enabled = false;
  }
  setValues(values) {
    this._valuesDisposables.clear();
    this._values.clearAndDisposeAll();
    if (!values || values.length === 0) {
      this._onDidChangeValue.fire();
      return;
    }
    const definedValues = values.filter((value) => value.value !== void 0);
    for (const value of definedValues) {
      const implicitContext = new ChatImplicitContext();
      implicitContext.setValue(value.value, value.isSelection);
      implicitContext.enabled = this._enabled;
      const disposableStore = new DisposableStore();
      disposableStore.add(implicitContext.onDidChangeValue(() => {
        this._onDidChangeValue.fire();
      }));
      disposableStore.add(implicitContext);
      this._values.set(implicitContext, disposableStore);
    }
    this._onDidChangeValue.fire();
  }
  get values() {
    return Array.from(this._values.keys());
  }
  get hasEnabled() {
    return Array.from(this._values.keys()).some((v) => v.enabled);
  }
  setEnabled(enabled) {
    this._enabled = enabled;
    this.values.forEach((v) => v.enabled = enabled);
  }
  get hasValue() {
    return this.values.some((v) => v.value !== void 0);
  }
  get hasNonUri() {
    return this.values.some((v) => v.value !== void 0 && !URI.isUri(v.value));
  }
  getLocations() {
    return this.values.filter((v) => isLocation(v.value)).map((v) => v.value);
  }
  getUris() {
    return this.values.filter((v) => URI.isUri(v.value)).map((v) => v.value);
  }
  get hasNonStringContext() {
    return this.values.some((v) => v.value !== void 0 && !isStringImplicitContextValue(v.value));
  }
  enabledBaseEntries(includeAllLocations) {
    return this.values.flatMap((v) => {
      if (v.enabled) {
        return v.toBaseEntries();
      } else if (includeAllLocations && isLocation(v.value)) {
        return v.toBaseEntries();
      }
      return [];
    });
  }
}
class ChatImplicitContext extends Disposable {
  constructor() {
    super(...arguments);
    this.kind = "implicit";
    this.isFile = true;
    this._isSelection = false;
    this._onDidChangeValue = this._register(new Emitter());
    this.onDidChangeValue = this._onDidChangeValue.event;
    this._enabled = false;
  }
  get id() {
    if (URI.isUri(this.value)) {
      return "vscode.implicit.file";
    } else if (isStringImplicitContextValue(this.value)) {
      return "vscode.implicit.string";
    } else if (this.value) {
      if (this._isSelection) {
        return "vscode.implicit.selection";
      } else {
        return "vscode.implicit.viewport";
      }
    } else {
      return "vscode.implicit";
    }
  }
  get name() {
    if (URI.isUri(this.value)) {
      if (this.value.scheme === Schemas.vscodeBrowser) {
        return `browser`;
      }
      return `file:${basename(this.value)}`;
    }
    if (isLocation(this.value)) {
      return `file:${basename(this.value.uri)}`;
    }
    if (isStringImplicitContextValue(this.value)) {
      if (this.value.name === void 0 && this.value.resourceUri === void 0) {
        throw new Error("ChatContextItem must have either a label or a resourceUri");
      }
      return this.value.name ?? basename(this.value.resourceUri);
    }
    return "implicit";
  }
  get modelDescription() {
    if (URI.isUri(this.value)) {
      return `User's active file`;
    } else if (isStringImplicitContextValue(this.value)) {
      if (this.value.name === void 0 && this.value.resourceUri === void 0) {
        throw new Error("ChatContextItem must have either a label or a resourceUri");
      }
      const contextName = this.value.name ?? basename(this.value.resourceUri);
      return this.value.modelDescription ?? `User's active context from ${contextName}`;
    } else if (this._isSelection) {
      return `User's active selection`;
    } else {
      return `User's current visible code`;
    }
  }
  get isSelection() {
    return this._isSelection;
  }
  get value() {
    return this._value;
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    this._enabled = value;
    this._onDidChangeValue.fire();
  }
  get uri() {
    if (isStringImplicitContextValue(this.value)) {
      return this.value.uri;
    }
    return this._uri;
  }
  get iconPath() {
    if (isStringImplicitContextValue(this.value)) {
      return this.value.iconPath;
    }
    return void 0;
  }
  setValue(value, isSelection) {
    if (isStringImplicitContextValue(value)) {
      this._value = value;
    } else {
      this._value = value;
      this._uri = URI.isUri(value) ? value : value?.uri;
    }
    this._isSelection = isSelection;
    this._onDidChangeValue.fire();
  }
  toBaseEntries() {
    if (!this.value) {
      return [];
    }
    if (URI.isUri(this.value) && this.value.scheme === Schemas.vscodeBrowser) {
      return [];
    }
    if (isStringImplicitContextValue(this.value)) {
      return [
        {
          kind: "string",
          id: this.id,
          name: this.name,
          value: this.value.value ?? this.name,
          modelDescription: this.modelDescription,
          iconPath: this.value.iconPath,
          uri: this.value.uri,
          resourceUri: this.value.resourceUri,
          handle: this.value.handle,
          commandId: this.value.commandId
        }
      ];
    }
    return [{
      kind: "file",
      id: this.id,
      name: this.name,
      value: this.value,
      modelDescription: this.modelDescription
    }];
  }
}
export {
  ChatImplicitContext,
  ChatImplicitContextContribution,
  ChatImplicitContexts
};
