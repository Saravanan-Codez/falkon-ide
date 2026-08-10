import { localize } from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { diffInserted, diffRemoved, editorWidgetBackground, editorWidgetBorder, editorWidgetForeground, focusBorder, inputBackground, inputPlaceholderForeground, registerColor, transparent, widgetShadow } from "../../../../platform/theme/common/colorRegistry.js";
import { NOTEBOOK_IS_ACTIVE_EDITOR } from "../../notebook/common/notebookContextKeys.js";
var InlineChatConfigKeys = /* @__PURE__ */ ((InlineChatConfigKeys2) => {
  InlineChatConfigKeys2["NotebookAgent"] = "inlineChat.notebookAgent";
  InlineChatConfigKeys2["DefaultModel"] = "inlineChat.defaultModel";
  InlineChatConfigKeys2["Affordance"] = "inlineChat.affordance";
  InlineChatConfigKeys2["FixDiagnostics"] = "inlineChat.fixDiagnostics";
  InlineChatConfigKeys2["AskInChat"] = "inlineChat.askInChat";
  return InlineChatConfigKeys2;
})(InlineChatConfigKeys || {});
Registry.as(Extensions.Configuration).registerConfiguration({
  id: "editor",
  properties: {
    ["inlineChat.notebookAgent" /* NotebookAgent */]: {
      markdownDescription: localize("notebookAgent", "Enable agent-like behavior for inline chat widget in notebooks."),
      default: false,
      type: "boolean",
      tags: ["experimental"],
      experiment: {
        mode: "startup"
      }
    },
    ["inlineChat.affordance" /* Affordance */]: {
      description: localize("affordance", "Controls whether an inline chat affordance is shown when text is selected."),
      default: "off",
      type: "string",
      enum: ["off", "editor"],
      enumDescriptions: [
        localize("affordance.off", "No affordance is shown."),
        localize("affordance.editor", "Show an affordance in the editor at the cursor position.")
      ],
      experiment: {
        mode: "auto"
      },
      tags: ["experimental"],
      agentsWindow: { default: "editor" }
    },
    ["inlineChat.fixDiagnostics" /* FixDiagnostics */]: {
      description: localize("fixDiagnostics", "Controls whether the Fix action is shown for diagnostics in the editor."),
      default: true,
      type: "boolean",
      experiment: {
        mode: "auto"
      },
      tags: ["experimental"]
    },
    ["inlineChat.askInChat" /* AskInChat */]: {
      description: localize("askInChat", "Controls whether files in a chat editing session use Ask in Chat instead of Inline Chat."),
      default: true,
      type: "boolean"
    }
  }
});
const INLINE_CHAT_ID = "editor.contrib.inlineChatController";
const CTX_INLINE_CHAT_POSSIBLE = new RawContextKey("inlineChatPossible", false, localize("inlineChatHasPossible", "Whether a provider for inline chat exists and whether an editor for inline chat is open"));
const CTX_INLINE_CHAT_HAS_AGENT = new RawContextKey("inlineChatHasEditsAgent", false, localize("inlineChatHasEditsAgent", "Whether an agent for inline chat in interactive editors exists"));
const CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE = new RawContextKey("inlineChatHasNotebookInline", false, localize("inlineChatHasNotebookInline", "Whether an agent for notebook cells exists"));
const CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT = new RawContextKey("inlineChatHasNotebookAgent", false, localize("inlineChatHasNotebookAgent", "Whether an agent for notebook cells exists"));
const CTX_INLINE_CHAT_VISIBLE = new RawContextKey("inlineChatVisible", false, localize("inlineChatVisible", "Whether the interactive editor input is visible"));
const CTX_INLINE_CHAT_FOCUSED = new RawContextKey("inlineChatFocused", false, localize("inlineChatFocused", "Whether the interactive editor input is focused"));
const CTX_INLINE_CHAT_EDITING = new RawContextKey("inlineChatEditing", true, localize("inlineChatEditing", "Whether the user is currently editing or generating code in the inline chat"));
const CTX_INLINE_CHAT_RESPONSE_FOCUSED = new RawContextKey("inlineChatResponseFocused", false, localize("inlineChatResponseFocused", "Whether the interactive widget's response is focused"));
const CTX_INLINE_CHAT_EMPTY = new RawContextKey("inlineChatEmpty", false, localize("inlineChatEmpty", "Whether the interactive editor input is empty"));
const CTX_INLINE_CHAT_OUTER_CURSOR_POSITION = new RawContextKey("inlineChatOuterCursorPosition", "", localize("inlineChatOuterCursorPosition", "Whether the cursor of the outer editor is above or below the interactive editor input"));
const CTX_INLINE_CHAT_REQUEST_IN_PROGRESS = new RawContextKey("inlineChatRequestInProgress", false, localize("inlineChatRequestInProgress", "Whether an inline chat request is currently in progress"));
const CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT = new RawContextKey("inlineChatFileBelongsToChat", false, localize("inlineChatFileBelongsToChat", "Whether the current file belongs to a chat editing session"));
const CTX_INLINE_CHAT_TERMINATED = new RawContextKey("inlineChatTerminated", false, localize("inlineChatTerminated", "Whether the current inline chat session is terminated"));
const CTX_INLINE_CHAT_AFFORDANCE_VISIBLE = new RawContextKey("inlineChatAffordanceVisible", false, localize("inlineChatAffordanceVisible", "Whether an inline chat affordance widget is visible"));
const CTX_INLINE_CHAT_V2_ENABLED = ContextKeyExpr.or(
  CTX_INLINE_CHAT_HAS_AGENT,
  ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT)
);
const CTX_FIX_DIAGNOSTICS_ENABLED = ContextKeyExpr.equals("config.inlineChat.fixDiagnostics", true);
const CTX_ASK_IN_CHAT_ENABLED = ContextKeyExpr.equals("config.inlineChat.askInChat", true);
const ACTION_START = "inlineChat.start";
const ACTION_ASK_IN_CHAT = "inlineChat.askInChat";
const MENU_INLINE_CHAT_WIDGET_SECONDARY = MenuId.for("inlineChatWidget.secondary");
const MENU_INLINE_CHAT_SIDE = MenuId.for("inlineChatWidget.side");
const inlineChatForeground = registerColor("inlineChat.foreground", editorWidgetForeground, localize("inlineChat.foreground", "Foreground color of the interactive editor widget"));
const inlineChatBackground = registerColor("inlineChat.background", editorWidgetBackground, localize("inlineChat.background", "Background color of the interactive editor widget"));
const inlineChatBorder = registerColor("inlineChat.border", editorWidgetBorder, localize("inlineChat.border", "Border color of the interactive editor widget"));
const inlineChatShadow = registerColor("inlineChat.shadow", widgetShadow, localize("inlineChat.shadow", "Shadow color of the interactive editor widget"));
const inlineChatInputBorder = registerColor("inlineChatInput.border", editorWidgetBorder, localize("inlineChatInput.border", "Border color of the interactive editor input"));
const inlineChatInputFocusBorder = registerColor("inlineChatInput.focusBorder", focusBorder, localize("inlineChatInput.focusBorder", "Border color of the interactive editor input when focused"));
const inlineChatInputPlaceholderForeground = registerColor("inlineChatInput.placeholderForeground", inputPlaceholderForeground, localize("inlineChatInput.placeholderForeground", "Foreground color of the interactive editor input placeholder"));
const inlineChatInputBackground = registerColor("inlineChatInput.background", inputBackground, localize("inlineChatInput.background", "Background color of the interactive editor input"));
const inlineChatDiffInserted = registerColor("inlineChatDiff.inserted", transparent(diffInserted, 0.5), localize("inlineChatDiff.inserted", "Background color of inserted text in the interactive editor input"));
const overviewRulerInlineChatDiffInserted = registerColor("editorOverviewRuler.inlineChatInserted", { dark: transparent(diffInserted, 0.6), light: transparent(diffInserted, 0.8), hcDark: transparent(diffInserted, 0.6), hcLight: transparent(diffInserted, 0.8) }, localize("editorOverviewRuler.inlineChatInserted", "Overview ruler marker color for inline chat inserted content."));
const minimapInlineChatDiffInserted = registerColor("editorMinimap.inlineChatInserted", { dark: transparent(diffInserted, 0.6), light: transparent(diffInserted, 0.8), hcDark: transparent(diffInserted, 0.6), hcLight: transparent(diffInserted, 0.8) }, localize("editorMinimap.inlineChatInserted", "Minimap marker color for inline chat inserted content."));
const inlineChatDiffRemoved = registerColor("inlineChatDiff.removed", transparent(diffRemoved, 0.5), localize("inlineChatDiff.removed", "Background color of removed text in the interactive editor input"));
const overviewRulerInlineChatDiffRemoved = registerColor("editorOverviewRuler.inlineChatRemoved", { dark: transparent(diffRemoved, 0.6), light: transparent(diffRemoved, 0.8), hcDark: transparent(diffRemoved, 0.6), hcLight: transparent(diffRemoved, 0.8) }, localize("editorOverviewRuler.inlineChatRemoved", "Overview ruler marker color for inline chat removed content."));
export {
  ACTION_ASK_IN_CHAT,
  ACTION_START,
  CTX_ASK_IN_CHAT_ENABLED,
  CTX_FIX_DIAGNOSTICS_ENABLED,
  CTX_INLINE_CHAT_AFFORDANCE_VISIBLE,
  CTX_INLINE_CHAT_EDITING,
  CTX_INLINE_CHAT_EMPTY,
  CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT,
  CTX_INLINE_CHAT_FOCUSED,
  CTX_INLINE_CHAT_HAS_AGENT,
  CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT,
  CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE,
  CTX_INLINE_CHAT_OUTER_CURSOR_POSITION,
  CTX_INLINE_CHAT_POSSIBLE,
  CTX_INLINE_CHAT_REQUEST_IN_PROGRESS,
  CTX_INLINE_CHAT_RESPONSE_FOCUSED,
  CTX_INLINE_CHAT_TERMINATED,
  CTX_INLINE_CHAT_V2_ENABLED,
  CTX_INLINE_CHAT_VISIBLE,
  INLINE_CHAT_ID,
  InlineChatConfigKeys,
  MENU_INLINE_CHAT_SIDE,
  MENU_INLINE_CHAT_WIDGET_SECONDARY,
  inlineChatBackground,
  inlineChatBorder,
  inlineChatDiffInserted,
  inlineChatDiffRemoved,
  inlineChatForeground,
  inlineChatInputBackground,
  inlineChatInputBorder,
  inlineChatInputFocusBorder,
  inlineChatInputPlaceholderForeground,
  inlineChatShadow,
  minimapInlineChatDiffInserted,
  overviewRulerInlineChatDiffInserted,
  overviewRulerInlineChatDiffRemoved
};
