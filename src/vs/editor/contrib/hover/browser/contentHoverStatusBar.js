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
import { HoverAction } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
const $ = dom.$;
let EditorHoverStatusBar = class extends Disposable {
  constructor(_keybindingService, _hoverService) {
    super();
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this.actions = [];
    this._hasContent = false;
    this.hoverElement = $("div.hover-row.status-bar");
    this.hoverElement.tabIndex = 0;
    this.actionsElement = dom.append(this.hoverElement, $("div.actions"));
  }
  get hasContent() {
    return this._hasContent;
  }
  addAction(actionOptions) {
    const keybinding = this._keybindingService.lookupKeybinding(actionOptions.commandId);
    const keybindingLabel = keybinding ? keybinding.getLabel() : null;
    this._hasContent = true;
    const action = this._register(HoverAction.render(this.actionsElement, actionOptions, keybindingLabel));
    this._register(this._hoverService.setupManagedHover(getDefaultHoverDelegate("element"), action.actionContainer, action.actionRenderedLabel));
    this.actions.push(action);
    return action;
  }
  append(element) {
    const result = dom.append(this.actionsElement, element);
    this._hasContent = true;
    return result;
  }
};
EditorHoverStatusBar = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, IHoverService)
], EditorHoverStatusBar);
export {
  EditorHoverStatusBar
};
