import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { isEditorGroup } from "./editorGroupsService.js";
const IEditorService = createDecorator("editorService");
const ACTIVE_GROUP = -1;
const SIDE_GROUP = -2;
const AUX_WINDOW_GROUP = -3;
const MODAL_GROUP = -4;
const USE_MODAL_EDITOR_SETTING = "workbench.editor.useModal";
function isPreferredGroup(obj) {
  const candidate = obj;
  return typeof obj === "number" || isEditorGroup(candidate);
}
export {
  ACTIVE_GROUP,
  AUX_WINDOW_GROUP,
  IEditorService,
  MODAL_GROUP,
  SIDE_GROUP,
  USE_MODAL_EDITOR_SETTING,
  isPreferredGroup
};
