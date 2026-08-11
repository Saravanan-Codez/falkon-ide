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
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { clamp } from "../../../../base/common/numbers.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AccessibilityWorkbenchSettingId, ViewDimUnfocusedOpacityProperties } from "./accessibilityConfiguration.js";
let UnfocusedViewDimmingContribution = class extends Disposable {
  constructor(configurationService) {
    super();
    this._styleElementDisposables = void 0;
    this._register(toDisposable(() => this._removeStyleElement()));
    this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, (e) => {
      if (e && !e.affectsConfiguration(AccessibilityWorkbenchSettingId.DimUnfocusedEnabled) && !e.affectsConfiguration(AccessibilityWorkbenchSettingId.DimUnfocusedOpacity)) {
        return;
      }
      let cssTextContent = "";
      const enabled = ensureBoolean(configurationService.getValue(AccessibilityWorkbenchSettingId.DimUnfocusedEnabled), false);
      if (enabled) {
        const opacity = clamp(
          ensureNumber(configurationService.getValue(AccessibilityWorkbenchSettingId.DimUnfocusedOpacity), ViewDimUnfocusedOpacityProperties.Default),
          ViewDimUnfocusedOpacityProperties.Minimum,
          ViewDimUnfocusedOpacityProperties.Maximum
        );
        if (opacity !== 1) {
          const rules = /* @__PURE__ */ new Set();
          const filterRule = `filter: opacity(${opacity});`;
          rules.add(`.monaco-workbench .pane-body.integrated-terminal:not(:focus-within) .tabs-container { ${filterRule} }`);
          rules.add(`.monaco-workbench .pane-body.integrated-terminal .terminal-wrapper:not(:focus-within) { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .monaco-editor { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .breadcrumbs-below-tabs { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .terminal-wrapper { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .settings-editor { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .keybindings-editor { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .monaco-editor-pane-placeholder { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .gettingStartedContainer { ${filterRule} }`);
          cssTextContent = [...rules].join("\n");
        }
      }
      if (cssTextContent.length === 0) {
        this._removeStyleElement();
      } else {
        this._getStyleElement().textContent = cssTextContent;
      }
    }));
  }
  _getStyleElement() {
    if (!this._styleElement) {
      this._styleElementDisposables = new DisposableStore();
      this._styleElement = createStyleSheet(void 0, void 0, this._styleElementDisposables);
      this._styleElement.className = "accessibilityUnfocusedViewOpacity";
    }
    return this._styleElement;
  }
  _removeStyleElement() {
    this._styleElementDisposables?.dispose();
    this._styleElementDisposables = void 0;
    this._styleElement = void 0;
  }
};
UnfocusedViewDimmingContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], UnfocusedViewDimmingContribution);
function ensureBoolean(value, defaultValue) {
  return typeof value === "boolean" ? value : defaultValue;
}
function ensureNumber(value, defaultValue) {
  return typeof value === "number" ? value : defaultValue;
}
export {
  UnfocusedViewDimmingContribution
};
