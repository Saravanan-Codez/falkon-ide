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
import "./output.css";
import * as nls from "../../../../nls.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { AbstractTextResourceEditor } from "../../../browser/parts/editor/textResourceEditor.js";
import { OUTPUT_VIEW_ID, CONTEXT_IN_OUTPUT, CONTEXT_OUTPUT_SCROLL_LOCK, IOutputService, OUTPUT_FILTER_FOCUS_CONTEXT, HIDE_CATEGORY_FILTER_CONTEXT } from "../../../services/output/common/output.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { CursorChangeReason } from "../../../../editor/common/cursorEvents.js";
import { FilterViewPane } from "../../../browser/parts/views/viewPane.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { TextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Dimension } from "../../../../base/browser/dom.js";
import { createCancelablePromise } from "../../../../base/common/async.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { computeEditorAriaLabel } from "../../../browser/editor.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { localize } from "../../../../nls.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { LogLevel } from "../../../../platform/log/common/log.js";
import { EditorExtensionsRegistry, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { FindDecorations } from "../../../../editor/contrib/find/browser/findDecorations.js";
import { Memento } from "../../../common/memento.js";
import { Markers } from "../../markers/common/markers.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { viewFilterSubmenu } from "../../../browser/parts/views/viewFilter.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
let OutputViewPane = class extends FilterViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, outputService, storageService) {
    const memento = new Memento(Markers.MARKERS_VIEW_STORAGE_ID, storageService);
    const viewState = memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    super({
      ...options,
      filterOptions: {
        placeholder: localize("outputView.filter.placeholder", "Filter (e.g. text, !excludeText, text1,text2)"),
        focusContextKey: OUTPUT_FILTER_FOCUS_CONTEXT.key,
        text: viewState.filter || "",
        history: []
      }
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.outputService = outputService;
    this.editorPromise = null;
    this.memento = memento;
    this.panelState = viewState;
    const filters = outputService.filters;
    filters.text = this.panelState.filter || "";
    filters.trace = this.panelState.showTrace ?? true;
    filters.debug = this.panelState.showDebug ?? true;
    filters.info = this.panelState.showInfo ?? true;
    filters.warning = this.panelState.showWarning ?? true;
    filters.error = this.panelState.showError ?? true;
    filters.categories = this.panelState.categories ?? "";
    this.scrollLockContextKey = CONTEXT_OUTPUT_SCROLL_LOCK.bindTo(this.contextKeyService);
    const editorInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    this.editor = this._register(editorInstantiationService.createInstance(OutputEditor));
    this._register(this.editor.onTitleAreaUpdate(() => {
      this.updateTitle(this.editor.getTitle());
      this.updateActions();
    }));
    this._register(this.onDidChangeBodyVisibility(() => this.onDidChangeVisibility(this.isBodyVisible())));
    this._register(this.filterWidget.onDidChangeFilterText((text) => outputService.filters.text = text));
    this.checkMoreFilters();
    this._register(outputService.filters.onDidChange(() => this.checkMoreFilters()));
  }
  get scrollLock() {
    return !!this.scrollLockContextKey.get();
  }
  set scrollLock(scrollLock) {
    this.scrollLockContextKey.set(scrollLock);
  }
  showChannel(channel, preserveFocus) {
    if (this.channelId !== channel.id) {
      this.setInput(channel);
    }
    if (!preserveFocus) {
      this.focus();
    }
  }
  focus() {
    super.focus();
    this.editorPromise?.then(() => this.editor.focus());
  }
  clearFilterText() {
    this.filterWidget.setFilterText("");
  }
  renderBody(container) {
    super.renderBody(container);
    this.editor.create(container);
    container.classList.add("output-view");
    const codeEditor = this.editor.getControl();
    codeEditor.setAriaOptions({ role: "document", activeDescendant: void 0 });
    this._register(codeEditor.onDidChangeModelContent(() => {
      if (!this.scrollLock) {
        this.editor.revealLastLine();
      }
    }));
    this._register(codeEditor.onDidChangeCursorPosition((e) => {
      if (e.reason !== CursorChangeReason.Explicit) {
        return;
      }
      if (!this.configurationService.getValue("output.smartScroll.enabled")) {
        return;
      }
      const model = codeEditor.getModel();
      if (model) {
        const newPositionLine = e.position.lineNumber;
        const lastLine = model.getLineCount();
        this.scrollLock = lastLine !== newPositionLine;
      }
    }));
  }
  layoutBodyContent(height, width) {
    this.editor.layout(new Dimension(width, height));
  }
  onDidChangeVisibility(visible) {
    this.editor.setVisible(visible);
    if (!visible) {
      this.clearInput();
    }
  }
  setInput(channel) {
    this.channelId = channel.id;
    this.checkMoreFilters();
    const input = this.createInput(channel);
    if (!this.editor.input || !input.matches(this.editor.input)) {
      this.editorPromise?.cancel();
      this.editorPromise = createCancelablePromise((token) => this.editor.setInput(input, { preserveFocus: true }, /* @__PURE__ */ Object.create(null), token));
    }
  }
  checkMoreFilters() {
    const filters = this.outputService.filters;
    this.filterWidget.checkMoreFilters(!filters.trace || !filters.debug || !filters.info || !filters.warning || !filters.error || !!this.channelId && filters.categories.includes(`,${this.channelId}:`));
  }
  clearInput() {
    this.channelId = void 0;
    this.editor.clearInput();
    this.editorPromise = null;
  }
  createInput(channel) {
    return this.instantiationService.createInstance(TextResourceEditorInput, channel.uri, nls.localize("output model title", "{0} - Output", channel.label), nls.localize("channel", "Output channel for '{0}'", channel.label), void 0, void 0);
  }
  saveState() {
    const filters = this.outputService.filters;
    this.panelState.filter = filters.text;
    this.panelState.showTrace = filters.trace;
    this.panelState.showDebug = filters.debug;
    this.panelState.showInfo = filters.info;
    this.panelState.showWarning = filters.warning;
    this.panelState.showError = filters.error;
    this.panelState.categories = filters.categories;
    this.memento.saveMemento();
    super.saveState();
  }
};
OutputViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IOutputService),
  __decorateParam(11, IStorageService)
], OutputViewPane);
let OutputEditor = class extends AbstractTextResourceEditor {
  constructor(telemetryService, instantiationService, storageService, configurationService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService) {
    super(OUTPUT_VIEW_ID, editorGroupService.activeGroup, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService);
    this.configurationService = configurationService;
    this.resourceContext = this._register(instantiationService.createInstance(ResourceContextKey));
  }
  getId() {
    return OUTPUT_VIEW_ID;
  }
  getTitle() {
    return nls.localize("output", "Output");
  }
  getConfigurationOverrides(configuration) {
    const options = super.getConfigurationOverrides(configuration);
    options.wordWrap = "on";
    options.lineNumbers = "off";
    options.glyphMargin = false;
    options.lineDecorationsWidth = 20;
    options.rulers = [];
    options.folding = false;
    options.scrollBeyondLastLine = false;
    options.renderLineHighlight = "none";
    options.minimap = { enabled: false };
    options.renderValidationDecorations = "editable";
    options.colorDecorators = false;
    options.padding = void 0;
    options.readOnly = true;
    options.domReadOnly = true;
    options.roundedSelection = false;
    options.unicodeHighlight = {
      nonBasicASCII: false,
      invisibleCharacters: false,
      ambiguousCharacters: false
    };
    const outputConfig = this.configurationService.getValue("[Log]");
    if (outputConfig) {
      if (outputConfig["editor.minimap.enabled"]) {
        options.minimap = { enabled: true };
      }
      if (outputConfig["editor.wordWrap"]) {
        options.wordWrap = outputConfig["editor.wordWrap"];
      }
    }
    return options;
  }
  getAriaLabel() {
    return this.input ? this.input.getAriaLabel() : nls.localize("outputViewAriaLabel", "Output panel");
  }
  computeAriaLabel() {
    return this.input ? computeEditorAriaLabel(this.input, void 0, void 0, this.editorGroupService.count) : this.getAriaLabel();
  }
  async setInput(input, options, context, token) {
    const focus = !(options && options.preserveFocus);
    if (this.input && input.matches(this.input)) {
      return;
    }
    if (this.input) {
      this.input.dispose();
    }
    await super.setInput(input, options, context, token);
    this.resourceContext.set(input.resource);
    if (focus) {
      this.focus();
    }
    this.revealLastLine();
  }
  clearInput() {
    if (this.input) {
      this.input.dispose();
    }
    super.clearInput();
    this.resourceContext.reset();
  }
  createEditor(parent) {
    parent.setAttribute("role", "document");
    super.createEditor(parent);
    const scopedContextKeyService = this.scopedContextKeyService;
    if (scopedContextKeyService) {
      CONTEXT_IN_OUTPUT.bindTo(scopedContextKeyService).set(true);
    }
  }
  _getContributions() {
    return [
      ...EditorExtensionsRegistry.getEditorContributions(),
      {
        id: FilterController.ID,
        ctor: FilterController,
        instantiation: EditorContributionInstantiation.Eager
      }
    ];
  }
  getCodeEditorWidgetOptions() {
    return { contributions: this._getContributions() };
  }
};
OutputEditor = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ITextResourceConfigurationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IEditorGroupsService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IFileService)
], OutputEditor);
let FilterController = class extends Disposable {
  constructor(editor, outputService) {
    super();
    this.editor = editor;
    this.outputService = outputService;
    this.modelDisposables = this._register(new DisposableStore());
    this.hiddenAreas = [];
    this.categories = /* @__PURE__ */ new Map();
    this.decorationsCollection = editor.createDecorationsCollection();
    this._register(editor.onDidChangeModel(() => this.onDidChangeModel()));
    this._register(this.outputService.filters.onDidChange(() => editor.hasModel() && this.filter(editor.getModel())));
  }
  static {
    this.ID = "output.editor.contrib.filterController";
  }
  onDidChangeModel() {
    this.modelDisposables.clear();
    this.hiddenAreas = [];
    this.categories.clear();
    if (!this.editor.hasModel()) {
      return;
    }
    const model = this.editor.getModel();
    this.filter(model);
    const computeEndLineNumber = () => {
      const endLineNumber2 = model.getLineCount();
      return endLineNumber2 > 1 && model.getLineMaxColumn(endLineNumber2) === 1 ? endLineNumber2 - 1 : endLineNumber2;
    };
    let endLineNumber = computeEndLineNumber();
    this.modelDisposables.add(model.onDidChangeContent((e) => {
      if (e.changes.every((e2) => e2.range.startLineNumber > endLineNumber)) {
        this.filterIncremental(model, endLineNumber + 1);
      } else {
        this.filter(model);
      }
      endLineNumber = computeEndLineNumber();
    }));
  }
  filter(model) {
    this.hiddenAreas = [];
    this.decorationsCollection.clear();
    this.filterIncremental(model, 1);
  }
  filterIncremental(model, fromLineNumber) {
    const { findMatches, hiddenAreas, categories: sources } = this.compute(model, fromLineNumber);
    this.hiddenAreas.push(...hiddenAreas);
    this.editor.setHiddenAreas(this.hiddenAreas, this);
    if (findMatches.length) {
      this.decorationsCollection.append(findMatches);
    }
    if (sources.size) {
      const that = this;
      for (const [categoryFilter, categoryName] of sources) {
        if (this.categories.has(categoryFilter)) {
          continue;
        }
        this.categories.set(categoryFilter, categoryName);
        this.modelDisposables.add(registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.actions.${OUTPUT_VIEW_ID}.toggle.${categoryFilter}`,
              title: categoryName,
              toggled: ContextKeyExpr.regex(HIDE_CATEGORY_FILTER_CONTEXT.key, new RegExp(`.*,${escapeRegExpCharacters(categoryFilter)},.*`)).negate(),
              menu: {
                id: viewFilterSubmenu,
                group: "1_category_filter",
                when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID))
              }
            });
          }
          async run() {
            that.outputService.filters.toggleCategory(categoryFilter);
          }
        }));
      }
    }
  }
  shouldShowLine(model, range, positive, negative) {
    const matches = [];
    if (negative.length > 0) {
      for (const pattern of negative) {
        const negativeMatches = model.findMatches(pattern, range, false, false, null, false);
        if (negativeMatches.length > 0) {
          return { show: false, matches: [] };
        }
      }
    }
    if (positive.length > 0) {
      let hasPositiveMatch = false;
      for (const pattern of positive) {
        const positiveMatches = model.findMatches(pattern, range, false, false, null, false);
        if (positiveMatches.length > 0) {
          hasPositiveMatch = true;
          for (const match of positiveMatches) {
            matches.push({ range: match.range, options: FindDecorations._FIND_MATCH_DECORATION });
          }
        }
      }
      return { show: hasPositiveMatch, matches };
    }
    return { show: true, matches };
  }
  compute(model, fromLineNumber) {
    const filters = this.outputService.filters;
    const activeChannel = this.outputService.getActiveChannel();
    const findMatches = [];
    const hiddenAreas = [];
    const categories = /* @__PURE__ */ new Map();
    const logEntries = activeChannel?.getLogEntries();
    if (activeChannel && logEntries?.length) {
      const hasLogLevelFilter = !filters.trace || !filters.debug || !filters.info || !filters.warning || !filters.error;
      const fromLogLevelEntryIndex = logEntries.findIndex((entry) => fromLineNumber >= entry.range.startLineNumber && fromLineNumber <= entry.range.endLineNumber);
      if (fromLogLevelEntryIndex === -1) {
        return { findMatches, hiddenAreas, categories };
      }
      for (let i = fromLogLevelEntryIndex; i < logEntries.length; i++) {
        const entry = logEntries[i];
        if (entry.category) {
          categories.set(`${activeChannel.id}:${entry.category}`, entry.category);
        }
        if (hasLogLevelFilter && !this.shouldShowLogLevel(entry, filters)) {
          hiddenAreas.push(entry.range);
          continue;
        }
        if (!this.shouldShowCategory(activeChannel.id, entry, filters)) {
          hiddenAreas.push(entry.range);
          continue;
        }
        if (filters.includePatterns.length > 0 || filters.excludePatterns.length > 0) {
          const result = this.shouldShowLine(model, entry.range, filters.includePatterns, filters.excludePatterns);
          if (result.show) {
            findMatches.push(...result.matches);
          } else {
            hiddenAreas.push(entry.range);
          }
        }
      }
      return { findMatches, hiddenAreas, categories };
    }
    if (filters.includePatterns.length === 0 && filters.excludePatterns.length === 0) {
      return { findMatches, hiddenAreas, categories };
    }
    const lineCount = model.getLineCount();
    for (let lineNumber = fromLineNumber; lineNumber <= lineCount; lineNumber++) {
      const lineRange = new Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
      const result = this.shouldShowLine(model, lineRange, filters.includePatterns, filters.excludePatterns);
      if (result.show) {
        findMatches.push(...result.matches);
      } else {
        hiddenAreas.push(lineRange);
      }
    }
    return { findMatches, hiddenAreas, categories };
  }
  shouldShowLogLevel(entry, filters) {
    switch (entry.logLevel) {
      case LogLevel.Trace:
        return filters.trace;
      case LogLevel.Debug:
        return filters.debug;
      case LogLevel.Info:
        return filters.info;
      case LogLevel.Warning:
        return filters.warning;
      case LogLevel.Error:
        return filters.error;
    }
    return true;
  }
  shouldShowCategory(activeChannelId, entry, filters) {
    if (!entry.category) {
      return true;
    }
    return !filters.hasCategory(`${activeChannelId}:${entry.category}`);
  }
};
FilterController = __decorateClass([
  __decorateParam(1, IOutputService)
], FilterController);
export {
  FilterController,
  OutputEditor,
  OutputViewPane
};
