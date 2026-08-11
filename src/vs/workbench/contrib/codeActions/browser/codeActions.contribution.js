import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { CodeActionsContribution, editorConfiguration, notebookEditorConfiguration } from "./codeActionsContribution.js";
Registry.as(Extensions.Configuration).registerConfiguration(editorConfiguration);
Registry.as(Extensions.Configuration).registerConfiguration(notebookEditorConfiguration);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(CodeActionsContribution, LifecyclePhase.Eventually);
