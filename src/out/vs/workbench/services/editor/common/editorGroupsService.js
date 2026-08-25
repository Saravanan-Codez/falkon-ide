import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { isEditorInput } from "../../../common/editor.js";
const IEditorGroupsService = createDecorator("editorGroupsService");
var GroupActivationReason = /* @__PURE__ */ ((GroupActivationReason2) => {
  GroupActivationReason2[GroupActivationReason2["DEFAULT"] = 0] = "DEFAULT";
  GroupActivationReason2[GroupActivationReason2["PART_CLOSE"] = 1] = "PART_CLOSE";
  return GroupActivationReason2;
})(GroupActivationReason || {});
var GroupDirection = /* @__PURE__ */ ((GroupDirection2) => {
  GroupDirection2[GroupDirection2["UP"] = 0] = "UP";
  GroupDirection2[GroupDirection2["DOWN"] = 1] = "DOWN";
  GroupDirection2[GroupDirection2["LEFT"] = 2] = "LEFT";
  GroupDirection2[GroupDirection2["RIGHT"] = 3] = "RIGHT";
  return GroupDirection2;
})(GroupDirection || {});
var GroupOrientation = /* @__PURE__ */ ((GroupOrientation2) => {
  GroupOrientation2[GroupOrientation2["HORIZONTAL"] = 0] = "HORIZONTAL";
  GroupOrientation2[GroupOrientation2["VERTICAL"] = 1] = "VERTICAL";
  return GroupOrientation2;
})(GroupOrientation || {});
var GroupLocation = /* @__PURE__ */ ((GroupLocation2) => {
  GroupLocation2[GroupLocation2["FIRST"] = 0] = "FIRST";
  GroupLocation2[GroupLocation2["LAST"] = 1] = "LAST";
  GroupLocation2[GroupLocation2["NEXT"] = 2] = "NEXT";
  GroupLocation2[GroupLocation2["PREVIOUS"] = 3] = "PREVIOUS";
  return GroupLocation2;
})(GroupLocation || {});
var GroupsArrangement = /* @__PURE__ */ ((GroupsArrangement2) => {
  GroupsArrangement2[GroupsArrangement2["MAXIMIZE"] = 0] = "MAXIMIZE";
  GroupsArrangement2[GroupsArrangement2["EXPAND"] = 1] = "EXPAND";
  GroupsArrangement2[GroupsArrangement2["EVEN"] = 2] = "EVEN";
  return GroupsArrangement2;
})(GroupsArrangement || {});
var MergeGroupMode = /* @__PURE__ */ ((MergeGroupMode2) => {
  MergeGroupMode2[MergeGroupMode2["COPY_EDITORS"] = 0] = "COPY_EDITORS";
  MergeGroupMode2[MergeGroupMode2["MOVE_EDITORS"] = 1] = "MOVE_EDITORS";
  return MergeGroupMode2;
})(MergeGroupMode || {});
function isEditorReplacement(replacement) {
  const candidate = replacement;
  return isEditorInput(candidate?.editor) && isEditorInput(candidate?.replacement);
}
var GroupsOrder = /* @__PURE__ */ ((GroupsOrder2) => {
  GroupsOrder2[GroupsOrder2["CREATION_TIME"] = 0] = "CREATION_TIME";
  GroupsOrder2[GroupsOrder2["MOST_RECENTLY_ACTIVE"] = 1] = "MOST_RECENTLY_ACTIVE";
  GroupsOrder2[GroupsOrder2["GRID_APPEARANCE"] = 2] = "GRID_APPEARANCE";
  return GroupsOrder2;
})(GroupsOrder || {});
var OpenEditorContext = /* @__PURE__ */ ((OpenEditorContext2) => {
  OpenEditorContext2[OpenEditorContext2["NEW_EDITOR"] = 1] = "NEW_EDITOR";
  OpenEditorContext2[OpenEditorContext2["MOVE_EDITOR"] = 2] = "MOVE_EDITOR";
  OpenEditorContext2[OpenEditorContext2["COPY_EDITOR"] = 3] = "COPY_EDITOR";
  return OpenEditorContext2;
})(OpenEditorContext || {});
function isEditorGroup(obj) {
  const group = obj;
  return !!group && typeof group.id === "number" && Array.isArray(group.editors);
}
function preferredSideBySideGroupDirection(configurationService) {
  const openSideBySideDirection = configurationService.getValue("workbench.editor.openSideBySideDirection");
  if (openSideBySideDirection === "down") {
    return 1 /* DOWN */;
  }
  return 3 /* RIGHT */;
}
export {
  GroupActivationReason,
  GroupDirection,
  GroupLocation,
  GroupOrientation,
  GroupsArrangement,
  GroupsOrder,
  IEditorGroupsService,
  MergeGroupMode,
  OpenEditorContext,
  isEditorGroup,
  isEditorReplacement,
  preferredSideBySideGroupDirection
};
