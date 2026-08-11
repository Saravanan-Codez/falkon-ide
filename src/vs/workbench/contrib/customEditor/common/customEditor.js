import { distinct } from "../../../../base/common/arrays.js";
import * as nls from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { globMatchesResource, priorityToRank, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
const ICustomEditorService = createDecorator("customEditorService");
const CONTEXT_ACTIVE_CUSTOM_EDITOR_ID = new RawContextKey("activeCustomEditorId", "", {
  type: "string",
  description: nls.localize("context.customEditor", "The viewType of the currently active custom editor.")
});
const CONTEXT_FOCUSED_CUSTOM_EDITOR_IS_EDITABLE = new RawContextKey("focusedCustomEditorIsEditable", false);
var CustomEditorPriority = /* @__PURE__ */ ((CustomEditorPriority2) => {
  CustomEditorPriority2["default"] = "default";
  CustomEditorPriority2["builtin"] = "builtin";
  CustomEditorPriority2["option"] = "option";
  CustomEditorPriority2["explicit"] = "explicit";
  return CustomEditorPriority2;
})(CustomEditorPriority || {});
var CustomEditorDiffEditorLayout = /* @__PURE__ */ ((CustomEditorDiffEditorLayout2) => {
  CustomEditorDiffEditorLayout2["Inline"] = "inline";
  CustomEditorDiffEditorLayout2["SideBySide"] = "sideBySide";
  return CustomEditorDiffEditorLayout2;
})(CustomEditorDiffEditorLayout || {});
class CustomEditorInfo {
  constructor(descriptor) {
    this.id = descriptor.id;
    this.displayName = descriptor.displayName;
    this.providerDisplayName = descriptor.providerDisplayName;
    this.priority = descriptor.priority;
    this.selector = descriptor.selector;
  }
  matches(resource) {
    return this.selector.some((selector) => selector.filenamePattern && globMatchesResource(selector.filenamePattern, resource));
  }
}
class CustomEditorInfoCollection {
  constructor(editors) {
    this.allEditors = distinct(editors, (editor) => editor.id);
  }
  get length() {
    return this.allEditors.length;
  }
  /**
   * Find the single default editor to use (if any) by looking at the editor's priority and the
   * other contributed editors.
   */
  get defaultEditor() {
    return this.allEditors.find((editor) => {
      switch (editor.priority.editor) {
        case RegisteredEditorPriority.default:
        case RegisteredEditorPriority.builtin:
          return this.allEditors.every((otherEditor) => otherEditor === editor || isLowerPriority(otherEditor, editor));
        default:
          return false;
      }
    });
  }
  /**
   * Find the best available editor to use.
   *
   * Unlike the `defaultEditor`, a bestAvailableEditor can exist even if there are other editors with
   * the same priority.
   */
  get bestAvailableEditor() {
    const editors = Array.from(this.allEditors).sort((a, b) => {
      return priorityToRank(a.priority.editor) - priorityToRank(b.priority.editor);
    });
    return editors[0];
  }
}
function isLowerPriority(otherEditor, editor) {
  return priorityToRank(otherEditor.priority.editor) < priorityToRank(editor.priority.editor);
}
export {
  CONTEXT_ACTIVE_CUSTOM_EDITOR_ID,
  CONTEXT_FOCUSED_CUSTOM_EDITOR_IS_EDITABLE,
  CustomEditorDiffEditorLayout,
  CustomEditorInfo,
  CustomEditorInfoCollection,
  CustomEditorPriority,
  ICustomEditorService
};
