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
import { clamp } from "../../../../base/common/numbers.js";
import { setGlobalSashSize, setGlobalHoverDelay } from "../../../../base/browser/ui/sash/sash.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
const minSize = 1;
const maxSize = 20;
let SashSettingsController = class extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this.styleSheet = createStyleSheet();
    const onDidChangeSize = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("workbench.sash.size"));
    onDidChangeSize(this.onDidChangeSize, this, this._store);
    this.onDidChangeSize();
    const onDidChangeHoverDelay = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("workbench.sash.hoverDelay"));
    onDidChangeHoverDelay(this.onDidChangeHoverDelay, this, this._store);
    this.onDidChangeHoverDelay();
  }
  static {
    this.ID = "workbench.contrib.sash";
  }
  onDidChangeSize() {
    const configuredSize = this.configurationService.getValue("workbench.sash.size");
    const size = clamp(configuredSize, 4, 20);
    const hoverSize = clamp(configuredSize, 1, 8);
    this.styleSheet.textContent = `
			.monaco-workbench {
				--vscode-sash-size: ${size}px;
				--vscode-sash-hover-size: ${hoverSize}px;
			}
		`;
    setGlobalSashSize(size);
  }
  onDidChangeHoverDelay() {
    setGlobalHoverDelay(this.configurationService.getValue("workbench.sash.hoverDelay"));
  }
};
SashSettingsController = __decorateClass([
  __decorateParam(0, IConfigurationService)
], SashSettingsController);
export {
  SashSettingsController,
  maxSize,
  minSize
};
