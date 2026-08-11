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
import * as dom from "../../../../base/browser/dom.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import * as nls from "../../../../nls.js";
import { ContextScopedHistoryInputBox } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { showHistoryKeybindingHint } from "../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
let PatternInputWidget = class extends Widget {
  constructor(parent, contextViewProvider, options, contextKeyService, configurationService, keybindingService) {
    super();
    this.contextViewProvider = contextViewProvider;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this._onSubmit = this._register(new Emitter());
    this.onSubmit = this._onSubmit.event;
    this._onCancel = this._register(new Emitter());
    this.onCancel = this._onCancel.event;
    options = {
      ...{
        ariaLabel: nls.localize("defaultLabel", "input")
      },
      ...options
    };
    this.width = options.width ?? 100;
    this.render(options);
    parent.appendChild(this.domNode);
  }
  static {
    this.OPTION_CHANGE = "optionChange";
  }
  dispose() {
    super.dispose();
    this.inputFocusTracker?.dispose();
  }
  setWidth(newWidth) {
    this.width = newWidth;
    this.contextViewProvider.layout();
    this.setInputWidth();
  }
  getValue() {
    return this.inputBox.value;
  }
  setValue(value) {
    if (this.inputBox.value !== value) {
      this.inputBox.value = value;
    }
  }
  select() {
    this.inputBox.select();
  }
  focus() {
    this.inputBox.focus();
  }
  inputHasFocus() {
    return this.inputBox.hasFocus();
  }
  setInputWidth() {
    this.inputBox.width = this.width - this.getSubcontrolsWidth() - 2;
  }
  getSubcontrolsWidth() {
    return 0;
  }
  getHistory() {
    return this.inputBox.getHistory();
  }
  clearHistory() {
    this.inputBox.clearHistory();
  }
  prependHistory(history) {
    this.inputBox.prependHistory(history);
  }
  clear() {
    this.setValue("");
  }
  onSearchSubmit() {
    this.inputBox.addToHistory();
  }
  showNextTerm() {
    this.inputBox.showNextValue();
  }
  showPreviousTerm() {
    this.inputBox.showPreviousValue();
  }
  render(options) {
    this.domNode = document.createElement("div");
    this.domNode.classList.add("monaco-findInput");
    const history = options.history || [];
    this.inputBox = this._register(new ContextScopedHistoryInputBox(this.domNode, this.contextViewProvider, {
      placeholder: options.placeholder,
      showPlaceholderOnFocus: options.showPlaceholderOnFocus,
      tooltip: options.tooltip,
      ariaLabel: options.ariaLabel,
      validationOptions: {
        validation: void 0
      },
      history: new Set(history),
      showHistoryHint: () => showHistoryKeybindingHint(this.keybindingService),
      inputBoxStyles: options.inputBoxStyles
    }, this.contextKeyService));
    this._register(this.inputBox.onDidChange(() => this._onSubmit.fire(true)));
    this.inputFocusTracker = dom.trackFocus(this.inputBox.inputElement);
    this.onkeyup(this.inputBox.inputElement, (keyboardEvent) => this.onInputKeyUp(keyboardEvent));
    const controls = document.createElement("div");
    controls.className = "controls";
    this.renderSubcontrols(controls);
    this.domNode.appendChild(controls);
    this.setInputWidth();
  }
  renderSubcontrols(_controlsDiv) {
  }
  onInputKeyUp(keyboardEvent) {
    switch (keyboardEvent.keyCode) {
      case KeyCode.Enter:
        this.onSearchSubmit();
        this._onSubmit.fire(false);
        return;
      case KeyCode.Escape:
        this._onCancel.fire();
        return;
    }
  }
};
PatternInputWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IKeybindingService)
], PatternInputWidget);
let IncludePatternInputWidget = class extends PatternInputWidget {
  constructor(parent, contextViewProvider, options, contextKeyService, configurationService, keybindingService) {
    super(parent, contextViewProvider, options, contextKeyService, configurationService, keybindingService);
    this._onChangeSearchInEditorsBoxEmitter = this._register(new Emitter());
    this.onChangeSearchInEditorsBox = this._onChangeSearchInEditorsBoxEmitter.event;
    this._onChangeSearchInChangedFilesBoxEmitter = this._register(new Emitter());
    this.onChangeSearchInChangedFilesBox = this._onChangeSearchInChangedFilesBoxEmitter.event;
  }
  dispose() {
    super.dispose();
    this.useSearchInEditorsBox.dispose();
    this.useSearchInChangedFilesBox.dispose();
  }
  onlySearchInOpenEditors() {
    return this.useSearchInEditorsBox.checked;
  }
  setOnlySearchInOpenEditors(value) {
    this.useSearchInEditorsBox.checked = value;
    this._onChangeSearchInEditorsBoxEmitter.fire();
  }
  onlySearchInChangedFiles() {
    return this.useSearchInChangedFilesBox.checked;
  }
  setOnlySearchInChangedFiles(value) {
    this.useSearchInChangedFilesBox.checked = value;
    this._onChangeSearchInChangedFilesBoxEmitter.fire();
  }
  setOnlySearchInChangedFilesEnabled(enabled) {
    if (enabled) {
      this.useSearchInChangedFilesBox.enable();
    } else {
      this.useSearchInChangedFilesBox.checked = false;
      this.useSearchInChangedFilesBox.disable();
    }
  }
  getSubcontrolsWidth() {
    return super.getSubcontrolsWidth() + this.useSearchInEditorsBox.width() + this.useSearchInChangedFilesBox.width();
  }
  renderSubcontrols(controlsDiv) {
    this.useSearchInChangedFilesBox = this._register(new Toggle({
      icon: Codicon.editCode,
      title: nls.localize("onlySearchInChangedFiles", "Search only in Changed Files (Source Control)"),
      isChecked: false,
      ...defaultToggleStyles
    }));
    this.useSearchInChangedFilesBox.disable();
    this._register(this.useSearchInChangedFilesBox.onChange((viaKeyboard) => {
      if (this.useSearchInChangedFilesBox.checked) {
        this.useSearchInEditorsBox.checked = false;
      }
      this._onChangeSearchInChangedFilesBoxEmitter.fire();
      if (!viaKeyboard) {
        this.inputBox.focus();
      }
    }));
    this.useSearchInEditorsBox = this._register(new Toggle({
      icon: Codicon.book,
      title: nls.localize("onlySearchInOpenEditors", "Search only in Open Editors"),
      isChecked: false,
      ...defaultToggleStyles
    }));
    this._register(this.useSearchInEditorsBox.onChange((viaKeyboard) => {
      if (this.useSearchInEditorsBox.checked) {
        this.useSearchInChangedFilesBox.checked = false;
      }
      this._onChangeSearchInEditorsBoxEmitter.fire();
      if (!viaKeyboard) {
        this.inputBox.focus();
      }
    }));
    controlsDiv.appendChild(this.useSearchInChangedFilesBox.domNode);
    controlsDiv.appendChild(this.useSearchInEditorsBox.domNode);
    super.renderSubcontrols(controlsDiv);
  }
};
IncludePatternInputWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IKeybindingService)
], IncludePatternInputWidget);
let ExcludePatternInputWidget = class extends PatternInputWidget {
  constructor(parent, contextViewProvider, options, contextKeyService, configurationService, keybindingService) {
    super(parent, contextViewProvider, options, contextKeyService, configurationService, keybindingService);
    this._onChangeIgnoreBoxEmitter = this._register(new Emitter());
    this.onChangeIgnoreBox = this._onChangeIgnoreBoxEmitter.event;
  }
  dispose() {
    super.dispose();
    this.useExcludesAndIgnoreFilesBox.dispose();
  }
  useExcludesAndIgnoreFiles() {
    return this.useExcludesAndIgnoreFilesBox.checked;
  }
  setUseExcludesAndIgnoreFiles(value) {
    this.useExcludesAndIgnoreFilesBox.checked = value;
    this._onChangeIgnoreBoxEmitter.fire();
  }
  getSubcontrolsWidth() {
    return super.getSubcontrolsWidth() + this.useExcludesAndIgnoreFilesBox.width();
  }
  renderSubcontrols(controlsDiv) {
    this.useExcludesAndIgnoreFilesBox = this._register(new Toggle({
      icon: Codicon.exclude,
      actionClassName: "useExcludesAndIgnoreFiles",
      title: nls.localize("useExcludesAndIgnoreFilesDescription", "Use Exclude Settings and Ignore Files"),
      isChecked: true,
      ...defaultToggleStyles
    }));
    this._register(this.useExcludesAndIgnoreFilesBox.onChange((viaKeyboard) => {
      this._onChangeIgnoreBoxEmitter.fire();
      if (!viaKeyboard) {
        this.inputBox.focus();
      }
    }));
    controlsDiv.appendChild(this.useExcludesAndIgnoreFilesBox.domNode);
    super.renderSubcontrols(controlsDiv);
  }
};
ExcludePatternInputWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IKeybindingService)
], ExcludePatternInputWidget);
export {
  ExcludePatternInputWidget,
  IncludePatternInputWidget,
  PatternInputWidget
};
