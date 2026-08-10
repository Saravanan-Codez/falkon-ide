import { EditorContributionInstantiation, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { MiddleScrollController } from "./middleScrollController.js";
registerEditorContribution(MiddleScrollController.ID, MiddleScrollController, EditorContributionInstantiation.BeforeFirstInteraction);
