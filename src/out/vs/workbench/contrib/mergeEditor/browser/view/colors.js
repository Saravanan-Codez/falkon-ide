import { localize } from "../../../../../nls.js";
import { mergeCurrentHeaderBackground, mergeIncomingHeaderBackground, registerColor, transparent } from "../../../../../platform/theme/common/colorRegistry.js";
const diff = registerColor(
  "mergeEditor.change.background",
  "#9bb95533",
  localize("mergeEditor.change.background", "The background color for changes.")
);
const diffWord = registerColor(
  "mergeEditor.change.word.background",
  { dark: "#9ccc2c33", light: "#9ccc2c66", hcDark: "#9ccc2c33", hcLight: "#9ccc2c66" },
  localize("mergeEditor.change.word.background", "The background color for word changes.")
);
const diffBase = registerColor(
  "mergeEditor.changeBase.background",
  { dark: "#4B1818FF", light: "#FFCCCCFF", hcDark: "#4B1818FF", hcLight: "#FFCCCCFF" },
  localize("mergeEditor.changeBase.background", "The background color for changes in base.")
);
const diffWordBase = registerColor(
  "mergeEditor.changeBase.word.background",
  { dark: "#6F1313FF", light: "#FFA3A3FF", hcDark: "#6F1313FF", hcLight: "#FFA3A3FF" },
  localize("mergeEditor.changeBase.word.background", "The background color for word changes in base.")
);
const conflictBorderUnhandledUnfocused = registerColor(
  "mergeEditor.conflict.unhandledUnfocused.border",
  { dark: "#ffa6007a", light: "#ffa600FF", hcDark: "#ffa6007a", hcLight: "#ffa6007a" },
  localize("mergeEditor.conflict.unhandledUnfocused.border", "The border color of unhandled unfocused conflicts.")
);
const conflictBorderUnhandledFocused = registerColor(
  "mergeEditor.conflict.unhandledFocused.border",
  "#ffa600",
  localize("mergeEditor.conflict.unhandledFocused.border", "The border color of unhandled focused conflicts.")
);
const conflictBorderHandledUnfocused = registerColor(
  "mergeEditor.conflict.handledUnfocused.border",
  "#86868649",
  localize("mergeEditor.conflict.handledUnfocused.border", "The border color of handled unfocused conflicts.")
);
const conflictBorderHandledFocused = registerColor(
  "mergeEditor.conflict.handledFocused.border",
  "#c1c1c1cc",
  localize("mergeEditor.conflict.handledFocused.border", "The border color of handled focused conflicts.")
);
const handledConflictMinimapOverViewRulerColor = registerColor(
  "mergeEditor.conflict.handled.minimapOverViewRuler",
  "#adaca8ee",
  localize("mergeEditor.conflict.handled.minimapOverViewRuler", "The foreground color for changes in input 1.")
);
const unhandledConflictMinimapOverViewRulerColor = registerColor(
  "mergeEditor.conflict.unhandled.minimapOverViewRuler",
  "#fcba03FF",
  localize("mergeEditor.conflict.unhandled.minimapOverViewRuler", "The foreground color for changes in input 1.")
);
const conflictingLinesBackground = registerColor(
  "mergeEditor.conflictingLines.background",
  "#ffea0047",
  localize("mergeEditor.conflictingLines.background", 'The background of the "Conflicting Lines" text.')
);
const contentTransparency = 0.4;
const conflictInput1Background = registerColor(
  "mergeEditor.conflict.input1.background",
  transparent(mergeCurrentHeaderBackground, contentTransparency),
  localize("mergeEditor.conflict.input1.background", "The background color of decorations in input 1.")
);
const conflictInput2Background = registerColor(
  "mergeEditor.conflict.input2.background",
  transparent(mergeIncomingHeaderBackground, contentTransparency),
  localize("mergeEditor.conflict.input2.background", "The background color of decorations in input 2.")
);
export {
  conflictBorderHandledFocused,
  conflictBorderHandledUnfocused,
  conflictBorderUnhandledFocused,
  conflictBorderUnhandledUnfocused,
  conflictInput1Background,
  conflictInput2Background,
  conflictingLinesBackground,
  diff,
  diffBase,
  diffWord,
  diffWordBase,
  handledConflictMinimapOverViewRulerColor,
  unhandledConflictMinimapOverViewRulerColor
};
