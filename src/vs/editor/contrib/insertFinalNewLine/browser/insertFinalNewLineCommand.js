import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
class InsertFinalNewLineCommand {
  constructor(selection) {
    this._selection = selection;
    this._selectionId = null;
  }
  getEditOperations(model, builder) {
    const op = insertFinalNewLine(model);
    if (op) {
      builder.addEditOperation(op.range, op.text);
    }
    this._selectionId = builder.trackSelection(this._selection);
  }
  computeCursorState(model, helper) {
    return helper.getTrackedSelection(this._selectionId);
  }
}
function insertFinalNewLine(model) {
  const lineCount = model.getLineCount();
  return EditOperation.insert(
    new Position(lineCount, model.getLineMaxColumn(lineCount)),
    model.getEOL()
  );
}
export {
  InsertFinalNewLineCommand,
  insertFinalNewLine
};
