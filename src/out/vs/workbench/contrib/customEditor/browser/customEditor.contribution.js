import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { ComplexCustomWorkingCopyEditorHandler, CustomEditorDiffInputSerializer, CustomEditorInputSerializer, CustomEditorSideBySideDiffInputSerializer } from "./customEditorInputFactory.js";
import { ICustomEditorService } from "../common/customEditor.js";
import { WebviewEditor } from "../../webviewPanel/browser/webviewEditor.js";
import { CustomEditorInput } from "./customEditorInput.js";
import { CustomEditorDiffInput, CustomEditorSideBySideDiffInput } from "./customEditorDiffInput.js";
import { CustomEditorService } from "./customEditors.js";
registerSingleton(ICustomEditorService, CustomEditorService, InstantiationType.Delayed);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    WebviewEditor,
    WebviewEditor.ID,
    "Webview Editor"
  ),
  [
    new SyncDescriptor(CustomEditorInput),
    new SyncDescriptor(CustomEditorDiffInput),
    new SyncDescriptor(CustomEditorSideBySideDiffInput)
  ]
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(CustomEditorInputSerializer.ID, CustomEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(CustomEditorDiffInputSerializer.ID, CustomEditorDiffInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(CustomEditorSideBySideDiffInputSerializer.ID, CustomEditorSideBySideDiffInputSerializer);
registerWorkbenchContribution2(ComplexCustomWorkingCopyEditorHandler.ID, ComplexCustomWorkingCopyEditorHandler, WorkbenchPhase.BlockStartup);
