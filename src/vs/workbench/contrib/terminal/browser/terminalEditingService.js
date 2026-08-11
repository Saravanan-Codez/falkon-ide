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
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { TERMINAL_VIEW_ID } from "../common/terminal.js";
let TerminalEditingService = class {
  constructor(_viewsService) {
    this._viewsService = _viewsService;
  }
  getEditableData(instance) {
    return this._editable && this._editable.instance === instance ? this._editable.data : void 0;
  }
  setEditable(instance, data) {
    if (!data) {
      this._editable = void 0;
    } else {
      this._editable = { instance, data };
    }
    const pane = this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    const isEditing = this.isEditable(instance);
    pane?.terminalTabbedView?.setEditable(isEditing);
  }
  isEditable(instance) {
    return !!this._editable && (this._editable.instance === instance || !instance);
  }
  getEditingTerminal() {
    return this._editingTerminal;
  }
  setEditingTerminal(instance) {
    this._editingTerminal = instance;
  }
};
TerminalEditingService = __decorateClass([
  __decorateParam(0, IViewsService)
], TerminalEditingService);
export {
  TerminalEditingService
};
