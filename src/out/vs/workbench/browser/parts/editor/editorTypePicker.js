import { Separator, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { extUri } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorResourceAccessor, SideBySideEditor, isDiffEditorInput, isEditorInputWithDiffResources } from "../../../common/editor.js";
import { RegisteredEditorPriority, priorityToRank } from "../../../services/editor/common/editorResolverService.js";
import { REOPEN_ACTIVE_EDITOR_WITH_COMMAND_ID } from "./editorCommands.js";
function getAvailableEditorTypes(activeEditor, editorResolverService) {
  const standardDiffResources = isDiffEditorInput(activeEditor) ? {
    original: activeEditor.original.resource,
    modified: activeEditor.modified.resource
  } : void 0;
  const diffResources = standardDiffResources ?? (isEditorInputWithDiffResources(activeEditor) ? activeEditor.diffResources : void 0);
  const resource = diffResources?.modified ?? EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
  if (!resource) {
    return void 0;
  }
  const editors = editorResolverService.getEditors(resource);
  if (editors.length <= 1) {
    return void 0;
  }
  return {
    resource,
    isDiffEditor: !!diffResources,
    originalResource: diffResources?.original,
    modifiedResource: diffResources?.modified,
    currentId: activeEditor?.editorId ?? DEFAULT_EDITOR_ASSOCIATION.id,
    editors
  };
}
function hasDefaultEditorAssociation(available, configuredDefaultEditor) {
  if (configuredDefaultEditor !== void 0 && configuredDefaultEditor !== DEFAULT_EDITOR_ASSOCIATION.id) {
    return true;
  }
  return available.editors.some((editor) => {
    if (editor.id === DEFAULT_EDITOR_ASSOCIATION.id) {
      return false;
    }
    const priority = available.isDiffEditor ? editor.priority.diff : editor.priority.editor;
    return priorityToRank(priority) >= priorityToRank(RegisteredEditorPriority.builtin);
  });
}
function editorTypeDisplayLabel(editor, isDiffEditor) {
  if (isDiffEditor && editor.id === DEFAULT_EDITOR_ASSOCIATION.id) {
    return localize("textDiffEditor", "Text Diff Editor");
  }
  return editor.label;
}
function createEditorTypeActions(available, editorResolverService, commandService, editorService) {
  const glob = `*${extUri.extname(available.resource)}`;
  const builtinProviderLabel = localize("builtinProviderDisplayName", "Built-in");
  const labelWithSource = (editor) => {
    const label = editorTypeDisplayLabel(editor, available.isDiffEditor);
    return editor.detail && editor.detail !== builtinProviderLabel ? localize("editorType.labelWithSource", "{0} - {1}", label, editor.detail) : label;
  };
  const reopenActions = available.editors.map((editor) => toAction({
    id: editor.id,
    label: labelWithSource(editor),
    checked: editor.id === available.currentId,
    run: () => commandService.executeCommand(REOPEN_ACTIVE_EDITOR_WITH_COMMAND_ID, editor.id)
  }));
  const configuredDefault = editorResolverService.getConfiguredDefaultEditor(available.resource, available.isDiffEditor);
  const setDefaultActions = available.editors.map((editor) => toAction({
    id: `setDefault.${editor.id}`,
    label: labelWithSource(editor),
    checked: editor.id === configuredDefault,
    run: () => {
      editorResolverService.updateUserAssociations(glob, editor.id, available.isDiffEditor);
      return commandService.executeCommand(REOPEN_ACTIVE_EDITOR_WITH_COMMAND_ID, editor.id);
    }
  }));
  const setDefaultSubmenu = new SubmenuAction(
    "editorType.setDefault",
    available.isDiffEditor ? localize("editorType.setDefaultDiff", "Set Default (Diff Only) for '{0}'", glob) : localize("editorType.setDefault", "Set Default for '{0}'", glob),
    setDefaultActions
  );
  const actions = [...reopenActions, new Separator(), setDefaultSubmenu];
  if (available.isDiffEditor) {
    actions.push(new Separator());
    if (available.originalResource) {
      actions.push(toAction({
        id: "editorType.openOriginal",
        label: localize("editorType.openOriginal", "Open Original"),
        run: () => editorService.openEditor({ resource: available.originalResource })
      }));
    }
    if (available.modifiedResource) {
      actions.push(toAction({
        id: "editorType.openModified",
        label: localize("editorType.openModified", "Open Modified"),
        run: () => editorService.openEditor({ resource: available.modifiedResource })
      }));
    }
  }
  return actions;
}
export {
  createEditorTypeActions,
  editorTypeDisplayLabel,
  getAvailableEditorTypes,
  hasDefaultEditorAssociation
};
