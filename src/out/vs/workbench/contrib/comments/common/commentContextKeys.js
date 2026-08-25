import * as nls from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
var CommentContextKeys;
((CommentContextKeys2) => {
  CommentContextKeys2.activeCursorHasCommentingRange = new RawContextKey("activeCursorHasCommentingRange", false, {
    description: nls.localize("hasCommentingRange", "Whether the position at the active cursor has a commenting range"),
    type: "boolean"
  });
  CommentContextKeys2.activeCursorHasComment = new RawContextKey("activeCursorHasComment", false, {
    description: nls.localize("hasComment", "Whether the position at the active cursor has a comment"),
    type: "boolean"
  });
  CommentContextKeys2.activeEditorHasCommentingRange = new RawContextKey("activeEditorHasCommentingRange", false, {
    description: nls.localize("editorHasCommentingRange", "Whether the active editor has a commenting range"),
    type: "boolean"
  });
  CommentContextKeys2.WorkspaceHasCommenting = new RawContextKey("workspaceHasCommenting", false, {
    description: nls.localize("hasCommentingProvider", "Whether the open workspace has either comments or commenting ranges."),
    type: "boolean"
  });
  CommentContextKeys2.commentThreadIsEmpty = new RawContextKey("commentThreadIsEmpty", false, { type: "boolean", description: nls.localize("commentThreadIsEmpty", "Set when the comment thread has no comments") });
  CommentContextKeys2.commentIsEmpty = new RawContextKey("commentIsEmpty", false, { type: "boolean", description: nls.localize("commentIsEmpty", "Set when the comment has no input") });
  CommentContextKeys2.commentContext = new RawContextKey("comment", void 0, { type: "string", description: nls.localize("comment", "The context value of the comment") });
  CommentContextKeys2.commentThreadContext = new RawContextKey("commentThread", void 0, { type: "string", description: nls.localize("commentThread", "The context value of the comment thread") });
  CommentContextKeys2.commentControllerContext = new RawContextKey("commentController", void 0, { type: "string", description: nls.localize("commentController", "The comment controller id associated with a comment thread") });
  CommentContextKeys2.commentFocused = new RawContextKey("commentFocused", false, { type: "boolean", description: nls.localize("commentFocused", "Set when the comment is focused") });
  CommentContextKeys2.commentWidgetVisible = new RawContextKey("commentWidgetVisible", false, { type: "boolean", description: nls.localize("commentWidgetVisible", "Set when a comment widget is visible in the editor") });
  CommentContextKeys2.commentingEnabled = new RawContextKey("commentingEnabled", true, {
    description: nls.localize("commentingEnabled", "Whether commenting functionality is enabled"),
    type: "boolean"
  });
})(CommentContextKeys || (CommentContextKeys = {}));
export {
  CommentContextKeys
};
