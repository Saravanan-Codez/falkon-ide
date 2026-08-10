import { EditArcTracker } from "../../../../base/common/editArcTracker.js";
class ArcTracker {
  constructor(valueBeforeTrackedEdit, trackedEdit) {
    this._tracker = new EditArcTracker(valueBeforeTrackedEdit.getValue(), toArcTextEdit(trackedEdit));
  }
  getOriginalCharacterCount() {
    return this._tracker.getOriginalCharacterCount();
  }
  /**
   * edit must apply to _updatedTrackedEdit.apply(_valueBeforeTrackedEdit)
  */
  handleEdits(edit) {
    this._tracker.handleEdits(toArcTextEdit(edit));
  }
  getAcceptedRestrainedCharactersCount() {
    return this._tracker.getAcceptedRestrainedCharactersCount();
  }
  getLineCountInfo() {
    return this._tracker.getLineCountInfo();
  }
  getValues() {
    return this._tracker.getValues();
  }
}
function toArcTextEdit(edit) {
  return {
    replacements: edit.replacements.map((replacement) => ({
      start: replacement.replaceRange.start,
      endExclusive: replacement.replaceRange.endExclusive,
      text: replacement.newText
    }))
  };
}
export {
  ArcTracker
};
