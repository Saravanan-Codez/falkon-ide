import { DiffEditorModel } from "./diffEditorModel.js";
class TextDiffEditorModel extends DiffEditorModel {
  constructor(originalModel, modifiedModel) {
    super(originalModel, modifiedModel);
    this._textDiffEditorModel = void 0;
    this._originalModel = originalModel;
    this._modifiedModel = modifiedModel;
    this.updateTextDiffEditorModel();
  }
  get originalModel() {
    return this._originalModel;
  }
  get modifiedModel() {
    return this._modifiedModel;
  }
  get textDiffEditorModel() {
    return this._textDiffEditorModel;
  }
  async resolve() {
    await super.resolve();
    this.updateTextDiffEditorModel();
  }
  updateTextDiffEditorModel() {
    if (this.originalModel?.isResolved() && this.modifiedModel?.isResolved()) {
      if (!this._textDiffEditorModel) {
        this._textDiffEditorModel = {
          original: this.originalModel.textEditorModel,
          modified: this.modifiedModel.textEditorModel
        };
      } else {
        this._textDiffEditorModel.original = this.originalModel.textEditorModel;
        this._textDiffEditorModel.modified = this.modifiedModel.textEditorModel;
      }
    }
  }
  isResolved() {
    return !!this._textDiffEditorModel;
  }
  isReadonly() {
    return !!this.modifiedModel && this.modifiedModel.isReadonly();
  }
  dispose() {
    this._textDiffEditorModel = void 0;
    super.dispose();
  }
}
export {
  TextDiffEditorModel
};
