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
import { assertNever } from "../../../../base/common/assert.js";
import { disposableTimeout, RunOnceScheduler, timeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, ObservablePromise, observableSignalFromEvent, observableValue } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { localize } from "../../../../nls.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { QueryBuilder } from "../../../services/search/common/queryBuilder.js";
import { ISearchService } from "../../../services/search/common/search.js";
import { ITerminalGroupService, ITerminalService } from "../../terminal/browser/terminal.js";
const SHELL_INTEGRATION_TIMEOUT = 5e3;
const NO_SHELL_INTEGRATION_IDLE = 1e3;
const SUGGEST_DEBOUNCE = 200;
let McpPromptArgumentPick = class extends Disposable {
  constructor(prompt, _quickInputService, _terminalService, _searchService, _workspaceContextService, _labelService, _fileService, _modelService, _languageService, _terminalGroupService, _instantiationService, _codeEditorService, _editorService) {
    super();
    this.prompt = prompt;
    this._quickInputService = _quickInputService;
    this._terminalService = _terminalService;
    this._searchService = _searchService;
    this._workspaceContextService = _workspaceContextService;
    this._labelService = _labelService;
    this._fileService = _fileService;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._terminalGroupService = _terminalGroupService;
    this._instantiationService = _instantiationService;
    this._codeEditorService = _codeEditorService;
    this._editorService = _editorService;
    this.quickPick = this._register(_quickInputService.createQuickPick({ useSeparators: true }));
  }
  async createArgs(token) {
    const { quickPick, prompt } = this;
    quickPick.totalSteps = prompt.arguments.length;
    quickPick.step = 0;
    quickPick.ignoreFocusOut = true;
    quickPick.sortByLabel = false;
    const args = {};
    const backSnapshots = [];
    for (let i = 0; i < prompt.arguments.length; i++) {
      const arg = prompt.arguments[i];
      const restore = backSnapshots.at(i);
      quickPick.step = i + 1;
      quickPick.placeholder = arg.required ? arg.description : `${arg.description || ""} (${localize("optional", "Optional")})`;
      quickPick.title = localize("mcp.prompt.pick.title", "Value for: {0}", arg.title || arg.name);
      quickPick.value = restore?.value ?? (args.hasOwnProperty(arg.name) && args[arg.name] || "");
      quickPick.items = restore?.items ?? [];
      quickPick.activeItems = restore?.activeItems ?? [];
      quickPick.buttons = i > 0 ? [this._quickInputService.backButton] : [];
      const value = await this._getArg(arg, !!restore, args, token);
      if (value.type === "back") {
        i -= 2;
      } else if (value.type === "cancel") {
        return void 0;
      } else if (value.type === "arg") {
        backSnapshots[i] = { value: quickPick.value, items: quickPick.items.slice(), activeItems: quickPick.activeItems.slice() };
        args[arg.name] = value.value;
      } else {
        assertNever(value);
      }
    }
    quickPick.value = "";
    quickPick.placeholder = localize("loading", "Loading...");
    quickPick.busy = true;
    return args;
  }
  async _getArg(arg, didRestoreState, argsSoFar, token) {
    const { quickPick } = this;
    const store = new DisposableStore();
    const input$ = observableValue(this, quickPick.value);
    const asyncPicks = [
      {
        name: localize("mcp.arg.suggestions", "Suggestions"),
        observer: this._promptCompletions(arg, input$, argsSoFar)
      },
      {
        name: localize("mcp.arg.activeFiles", "Active File"),
        observer: this._activeFileCompletions()
      },
      {
        name: localize("mcp.arg.files", "Files"),
        observer: this._fileCompletions(input$)
      }
    ];
    store.add(autorun((reader) => {
      if (didRestoreState) {
        input$.read(reader);
        return;
      }
      let items = [];
      items.push({ id: "insert-text", label: localize("mcp.arg.asText", "Insert as text"), iconClass: ThemeIcon.asClassName(Codicon.textSize), action: "text", alwaysShow: true });
      items.push({ id: "run-command", label: localize("mcp.arg.asCommand", "Run as Command"), description: localize("mcp.arg.asCommand.description", "Inserts the command output as the prompt argument"), iconClass: ThemeIcon.asClassName(Codicon.terminal), action: "command", alwaysShow: true });
      let busy = false;
      for (const pick of asyncPicks) {
        const state = pick.observer.read(reader);
        busy ||= state.busy;
        if (state.picks) {
          items.push({ label: pick.name, type: "separator" });
          items = items.concat(state.picks);
        }
      }
      const previouslyActive = quickPick.activeItems;
      quickPick.busy = busy;
      quickPick.items = items;
      const lastActive = items.find((i) => previouslyActive.some((a) => a.id === i.id));
      const serverSuggestions = asyncPicks[0].observer;
      if (lastActive) {
        quickPick.activeItems = [lastActive];
      } else if (serverSuggestions.read(reader).picks?.length) {
        quickPick.activeItems = [items[3]];
      } else if (busy) {
        quickPick.activeItems = [];
      } else {
        quickPick.activeItems = [items[0]];
      }
    }));
    try {
      const value = await new Promise((resolve) => {
        if (token) {
          store.add(token.onCancellationRequested(() => {
            resolve(void 0);
          }));
        }
        store.add(quickPick.onDidChangeValue((value2) => {
          quickPick.validationMessage = void 0;
          input$.set(value2, void 0);
        }));
        store.add(quickPick.onDidAccept(() => {
          const item = quickPick.selectedItems[0];
          if (!quickPick.value && arg.required && (!item || item.action === "text" || item.action === "command")) {
            quickPick.validationMessage = localize("mcp.arg.required", "This argument is required");
          } else if (!item) {
            resolve({ id: "insert-text", label: "", action: "text" });
          } else {
            resolve(item);
          }
        }));
        store.add(quickPick.onDidTriggerButton(() => {
          resolve("back");
        }));
        store.add(quickPick.onDidHide(() => {
          resolve(void 0);
        }));
        quickPick.show();
      });
      if (value === "back") {
        return { type: "back" };
      }
      if (value === void 0) {
        return { type: "cancel" };
      }
      store.clear();
      const cts = new CancellationTokenSource();
      store.add(toDisposable(() => cts.dispose(true)));
      store.add(quickPick.onDidHide(() => store.dispose()));
      switch (value.action) {
        case "text":
          return { type: "arg", value: quickPick.value || void 0 };
        case "command":
          if (!quickPick.value) {
            return { type: "arg", value: void 0 };
          }
          quickPick.busy = true;
          return { type: "arg", value: await this._getTerminalOutput(quickPick.value, cts.token) };
        case "suggest":
          return { type: "arg", value: value.label };
        case "file":
          quickPick.busy = true;
          return { type: "arg", value: await this._fileService.readFile(value.uri).then((c) => c.value.toString()) };
        case "selectedText":
          return { type: "arg", value: value.selectedText };
        default:
          assertNever(value);
      }
    } finally {
      store.dispose();
    }
  }
  _promptCompletions(arg, input, argsSoFar) {
    const alreadyResolved = {};
    for (const [key, value] of Object.entries(argsSoFar)) {
      if (value) {
        alreadyResolved[key] = value;
      }
    }
    return this._asyncCompletions(input, async (i, t) => {
      const items = await this.prompt.complete(arg.name, i, alreadyResolved, t);
      return items.map((i2) => ({ id: `suggest:${i2}`, label: i2, action: "suggest" }));
    });
  }
  _fileCompletions(input) {
    const qb = this._instantiationService.createInstance(QueryBuilder);
    return this._asyncCompletions(input, async (i, token) => {
      if (!i) {
        return [];
      }
      const query = qb.file(this._workspaceContextService.getWorkspace().folders, {
        filePattern: i,
        maxResults: 10
      });
      const { results } = await this._searchService.fileSearch(query, token);
      return results.map((i2) => ({
        id: i2.resource.toString(),
        label: basename(i2.resource),
        description: this._labelService.getUriLabel(i2.resource),
        iconClasses: getIconClasses(this._modelService, this._languageService, i2.resource),
        uri: i2.resource,
        action: "file"
      }));
    });
  }
  _activeFileCompletions() {
    const activeEditorChange = observableSignalFromEvent(this, this._editorService.onDidActiveEditorChange);
    const activeEditor = derived((reader) => {
      activeEditorChange.read(reader);
      return this._codeEditorService.getActiveCodeEditor();
    });
    const resourceObs = activeEditor.map((e) => e ? observableSignalFromEvent(this, e.onDidChangeModel).map(() => e.getModel()?.uri) : void 0).map((o, reader) => o?.read(reader));
    const selectionObs = activeEditor.map((e) => e ? observableSignalFromEvent(this, e.onDidChangeCursorSelection).map(() => ({ range: e.getSelection(), model: e.getModel() })) : void 0).map((o, reader) => o?.read(reader));
    return derived((reader) => {
      const resource = resourceObs.read(reader);
      if (!resource) {
        return { busy: false, picks: [] };
      }
      const items = [];
      items.push({
        id: "active-file",
        label: localize("mcp.arg.activeFile", "Active File"),
        description: this._labelService.getUriLabel(resource),
        iconClasses: getIconClasses(this._modelService, this._languageService, resource),
        uri: resource,
        action: "file"
      });
      const selection = selectionObs.read(reader);
      if (selection && selection.model && selection.range && !selection.range.isEmpty()) {
        const selectedText = selection.model.getValueInRange(selection.range);
        const lineCount = selection.range.endLineNumber - selection.range.startLineNumber + 1;
        const description = lineCount === 1 ? localize("mcp.arg.selectedText.singleLine", "line {0}", selection.range.startLineNumber) : localize("mcp.arg.selectedText.multiLine", "{0} lines", lineCount);
        items.push({
          id: "selected-text",
          label: localize("mcp.arg.selectedText", "Selected Text"),
          description,
          selectedText,
          iconClass: ThemeIcon.asClassName(Codicon.selection),
          uri: resource,
          action: "selectedText"
        });
      }
      return { picks: items, busy: false };
    });
  }
  _asyncCompletions(input, mapper) {
    const promise = derived((reader) => {
      const queryValue = input.read(reader);
      const cts = new CancellationTokenSource();
      reader.store.add(toDisposable(() => cts.dispose(true)));
      return new ObservablePromise(
        timeout(SUGGEST_DEBOUNCE, cts.token).then(() => mapper(queryValue, cts.token)).catch(() => [])
      );
    });
    return promise.map((value, reader) => {
      const result = value.promiseResult.read(reader);
      return { picks: result?.data || [], busy: result === void 0 };
    });
  }
  async _getTerminalOutput(command, token) {
    const terminal = this._terminal ??= this._register(await this._terminalService.createTerminal({
      config: {
        name: localize("mcp.terminal.name", "MCP Terminal"),
        isTransient: true,
        forceShellIntegration: true,
        isFeatureTerminal: true
      },
      location: TerminalLocation.Panel
    }));
    this._terminalService.setActiveInstance(terminal);
    this._terminalGroupService.showPanel(false);
    const shellIntegration = terminal.capabilities.get(TerminalCapability.CommandDetection);
    if (shellIntegration) {
      return this._getTerminalOutputInner(terminal, command, shellIntegration, token);
    }
    const store = new DisposableStore();
    return await new Promise((resolve) => {
      store.add(terminal.capabilities.onDidAddCapability((e) => {
        if (e.id === TerminalCapability.CommandDetection) {
          store.dispose();
          resolve(this._getTerminalOutputInner(terminal, command, e.capability, token));
        }
      }));
      store.add(token.onCancellationRequested(() => {
        store.dispose();
        resolve(void 0);
      }));
      store.add(disposableTimeout(() => {
        store.dispose();
        resolve(this._getTerminalOutputInner(terminal, command, void 0, token));
      }, SHELL_INTEGRATION_TIMEOUT));
    });
  }
  async _getTerminalOutputInner(terminal, command, shellIntegration, token) {
    const store = new DisposableStore();
    return new Promise((resolve) => {
      let allData = "";
      store.add(terminal.onLineData((d) => allData += d + "\n"));
      if (shellIntegration) {
        store.add(shellIntegration.onCommandFinished((e) => resolve(e.getOutput() || allData)));
      } else {
        const done = store.add(new RunOnceScheduler(() => resolve(allData), NO_SHELL_INTEGRATION_IDLE));
        store.add(terminal.onData(() => done.schedule()));
      }
      store.add(token.onCancellationRequested(() => resolve(void 0)));
      store.add(terminal.onDisposed(() => resolve(void 0)));
      terminal.runCommand(command, true);
    }).finally(() => {
      store.dispose();
    });
  }
};
McpPromptArgumentPick = __decorateClass([
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, ITerminalService),
  __decorateParam(3, ISearchService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IModelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, ITerminalGroupService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, ICodeEditorService),
  __decorateParam(12, IEditorService)
], McpPromptArgumentPick);
export {
  McpPromptArgumentPick
};
