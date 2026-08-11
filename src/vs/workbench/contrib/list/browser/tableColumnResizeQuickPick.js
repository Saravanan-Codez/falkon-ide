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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
let TableColumnResizeQuickPick = class extends Disposable {
  constructor(_table, _quickInputService) {
    super();
    this._table = _table;
    this._quickInputService = _quickInputService;
  }
  async show() {
    const items = [];
    this._table.getColumnLabels().forEach((label, index) => {
      if (label) {
        items.push({ label, index });
      }
    });
    const column = await this._quickInputService.pick(items, { placeHolder: localize("table.column.selection", "Select the column to resize, type to filter.") });
    if (!column) {
      return;
    }
    const value = await this._quickInputService.input({
      placeHolder: localize("table.column.resizeValue.placeHolder", "i.e. 20, 60, 100..."),
      prompt: localize("table.column.resizeValue.prompt", "Please enter a width in percentage for the '{0}' column.", column.label),
      validateInput: (input) => this._validateColumnResizeValue(input)
    });
    const percentageValue = value ? Number.parseInt(value) : void 0;
    if (!percentageValue) {
      return;
    }
    this._table.resizeColumn(column.index, percentageValue);
  }
  async _validateColumnResizeValue(input) {
    const percentage = Number.parseInt(input);
    if (input && !Number.isInteger(percentage)) {
      return localize("table.column.resizeValue.invalidType", "Please enter an integer.");
    } else if (percentage < 0 || percentage > 100) {
      return localize("table.column.resizeValue.invalidRange", "Please enter a number greater than 0 and less than or equal to 100.");
    }
    return null;
  }
};
TableColumnResizeQuickPick = __decorateClass([
  __decorateParam(1, IQuickInputService)
], TableColumnResizeQuickPick);
export {
  TableColumnResizeQuickPick
};
