import "./floatingMenu.css";
import { registerEditorContribution, EditorContributionInstantiation } from "../../../browser/editorExtensions.js";
import { FloatingEditorToolbar } from "./floatingMenu.js";
registerEditorContribution(FloatingEditorToolbar.ID, FloatingEditorToolbar, EditorContributionInstantiation.AfterFirstRender);
