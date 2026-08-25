import * as languages from "../../../../editor/common/languages.js";
import { peekViewTitleBackground } from "../../../../editor/contrib/peekView/browser/peekView.js";
import * as nls from "../../../../nls.js";
import { contrastBorder, disabledForeground, listFocusOutline, registerColor, transparent } from "../../../../platform/theme/common/colorRegistry.js";
const resolvedCommentViewIcon = registerColor("commentsView.resolvedIcon", { dark: disabledForeground, light: disabledForeground, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize("resolvedCommentIcon", "Icon color for resolved comments."));
const unresolvedCommentViewIcon = registerColor("commentsView.unresolvedIcon", { dark: listFocusOutline, light: listFocusOutline, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize("unresolvedCommentIcon", "Icon color for unresolved comments."));
registerColor("editorCommentsWidget.replyInputBackground", peekViewTitleBackground, nls.localize("commentReplyInputBackground", "Background color for comment reply input box."));
const resolvedCommentBorder = registerColor("editorCommentsWidget.resolvedBorder", { dark: resolvedCommentViewIcon, light: resolvedCommentViewIcon, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize("resolvedCommentBorder", "Color of borders and arrow for resolved comments."));
const unresolvedCommentBorder = registerColor("editorCommentsWidget.unresolvedBorder", { dark: unresolvedCommentViewIcon, light: unresolvedCommentViewIcon, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize("unresolvedCommentBorder", "Color of borders and arrow for unresolved comments."));
const commentThreadRangeBackground = registerColor("editorCommentsWidget.rangeBackground", transparent(unresolvedCommentBorder, 0.1), nls.localize("commentThreadRangeBackground", "Color of background for comment ranges."));
const commentThreadRangeActiveBackground = registerColor("editorCommentsWidget.rangeActiveBackground", transparent(unresolvedCommentBorder, 0.1), nls.localize("commentThreadActiveRangeBackground", "Color of background for currently selected or hovered comment range."));
const commentThreadStateBorderColors = /* @__PURE__ */ new Map([
  [languages.CommentThreadState.Unresolved, unresolvedCommentBorder],
  [languages.CommentThreadState.Resolved, resolvedCommentBorder]
]);
const commentThreadStateIconColors = /* @__PURE__ */ new Map([
  [languages.CommentThreadState.Unresolved, unresolvedCommentViewIcon],
  [languages.CommentThreadState.Resolved, resolvedCommentViewIcon]
]);
const commentThreadStateColorVar = "--comment-thread-state-color";
const commentViewThreadStateColorVar = "--comment-view-thread-state-color";
const commentThreadStateBackgroundColorVar = "--comment-thread-state-background-color";
function getCommentThreadStateColor(state, theme, map) {
  const colorId = state !== void 0 ? map.get(state) : void 0;
  return colorId !== void 0 ? theme.getColor(colorId) : void 0;
}
function getCommentThreadStateBorderColor(state, theme) {
  return getCommentThreadStateColor(state, theme, commentThreadStateBorderColors);
}
function getCommentThreadStateIconColor(state, theme) {
  return getCommentThreadStateColor(state, theme, commentThreadStateIconColors);
}
export {
  commentThreadRangeActiveBackground,
  commentThreadRangeBackground,
  commentThreadStateBackgroundColorVar,
  commentThreadStateColorVar,
  commentViewThreadStateColorVar,
  getCommentThreadStateBorderColor,
  getCommentThreadStateIconColor
};
