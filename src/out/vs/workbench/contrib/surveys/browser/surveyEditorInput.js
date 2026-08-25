import { URI } from "../../../../base/common/uri.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
const surveyIcon = registerIcon("survey", Codicon.feedback, localize("surveyIcon", "Icon for the survey editor."));
class SurveyEditorInput extends EditorInput {
  constructor(survey, source) {
    super();
    this.survey = survey;
    this._source = source;
  }
  static {
    this.ID = "workbench.input.survey";
  }
  get source() {
    return this._source;
  }
  /** Update the source when re-triggered while already open. */
  updateSource(source) {
    this._source = source;
  }
  get typeId() {
    return SurveyEditorInput.ID;
  }
  get editorId() {
    return this.typeId;
  }
  get resource() {
    return URI.from({ scheme: "vscode-survey", path: `/${this.survey.id}` });
  }
  getName() {
    return this.survey.title;
  }
  getIcon() {
    return surveyIcon;
  }
  matches(other) {
    return other instanceof SurveyEditorInput && other.survey.id === this.survey.id;
  }
  get capabilities() {
    return EditorInputCapabilities.Singleton | EditorInputCapabilities.Readonly;
  }
}
export {
  SurveyEditorInput
};
