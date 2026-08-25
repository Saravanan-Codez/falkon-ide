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
import * as DOM from "../../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { EXPAND_CELL_OUTPUT_COMMAND_ID } from "../../notebookBrowser.js";
import { CellContentPart } from "../cellPart.js";
const $ = DOM.$;
let CollapsedCellOutput = class extends CellContentPart {
  constructor(notebookEditor, cellOutputCollapseContainer, keybindingService) {
    super();
    this.notebookEditor = notebookEditor;
    const placeholder = DOM.append(cellOutputCollapseContainer, $("span.expandOutputPlaceholder"));
    placeholder.textContent = localize("cellOutputsCollapsedMsg", "Outputs are collapsed");
    const expandIcon = DOM.append(cellOutputCollapseContainer, $("span.expandOutputIcon"));
    expandIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.more));
    const keybinding = keybindingService.lookupKeybinding(EXPAND_CELL_OUTPUT_COMMAND_ID);
    if (keybinding) {
      placeholder.title = localize("cellExpandOutputButtonLabelWithDoubleClick", "Double-click to expand cell output ({0})", keybinding.getLabel());
      cellOutputCollapseContainer.title = localize("cellExpandOutputButtonLabel", "Expand Cell Output (${0})", keybinding.getLabel());
    }
    DOM.hide(cellOutputCollapseContainer);
    this._register(DOM.addDisposableListener(expandIcon, DOM.EventType.CLICK, () => this.expand()));
    this._register(DOM.addDisposableListener(cellOutputCollapseContainer, DOM.EventType.DBLCLICK, () => this.expand()));
  }
  expand() {
    if (!this.currentCell) {
      return;
    }
    if (!this.currentCell) {
      return;
    }
    const textModel = this.notebookEditor.textModel;
    const index = textModel.cells.indexOf(this.currentCell.model);
    if (index < 0) {
      return;
    }
    this.currentCell.isOutputCollapsed = !this.currentCell.isOutputCollapsed;
  }
};
CollapsedCellOutput = __decorateClass([
  __decorateParam(2, IKeybindingService)
], CollapsedCellOutput);
export {
  CollapsedCellOutput
};
