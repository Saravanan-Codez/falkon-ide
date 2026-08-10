import { localize } from "../../../../nls.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { NativeProcessExplorerEditor } from "./processExplorerEditor.js";
import { ProcessExplorerEditorInput } from "../browser/processExplorerEditorInput.js";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(NativeProcessExplorerEditor, NativeProcessExplorerEditor.ID, localize("processExplorer", "Process Explorer")),
  [new SyncDescriptor(ProcessExplorerEditorInput)]
);
