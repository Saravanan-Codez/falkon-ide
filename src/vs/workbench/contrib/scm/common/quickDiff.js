import * as nls from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Color } from "../../../../base/common/color.js";
import {
  darken,
  editorBackground,
  editorForeground,
  listInactiveSelectionBackground,
  opaque,
  editorErrorForeground,
  registerColor,
  transparent,
  lighten
} from "../../../../platform/theme/common/colorRegistry.js";
const IQuickDiffService = createDecorator("quickDiff");
const editorGutterModifiedBackground = registerColor("editorGutter.modifiedBackground", {
  dark: "#1B81A8",
  light: "#2090D3",
  hcDark: "#1B81A8",
  hcLight: "#2090D3"
}, nls.localize("editorGutterModifiedBackground", "Editor gutter background color for lines that are modified."));
registerColor(
  "editorGutter.modifiedSecondaryBackground",
  { dark: darken(editorGutterModifiedBackground, 0.5), light: lighten(editorGutterModifiedBackground, 0.7), hcDark: "#1B81A8", hcLight: "#2090D3" },
  nls.localize("editorGutterModifiedSecondaryBackground", "Editor gutter secondary background color for lines that are modified.")
);
const editorGutterAddedBackground = registerColor("editorGutter.addedBackground", {
  dark: "#487E02",
  light: "#48985D",
  hcDark: "#487E02",
  hcLight: "#48985D"
}, nls.localize("editorGutterAddedBackground", "Editor gutter background color for lines that are added."));
registerColor(
  "editorGutter.addedSecondaryBackground",
  { dark: darken(editorGutterAddedBackground, 0.5), light: lighten(editorGutterAddedBackground, 0.7), hcDark: "#487E02", hcLight: "#48985D" },
  nls.localize("editorGutterAddedSecondaryBackground", "Editor gutter secondary background color for lines that are added.")
);
const editorGutterDeletedBackground = registerColor(
  "editorGutter.deletedBackground",
  editorErrorForeground,
  nls.localize("editorGutterDeletedBackground", "Editor gutter background color for lines that are deleted.")
);
registerColor(
  "editorGutter.deletedSecondaryBackground",
  { dark: darken(editorGutterDeletedBackground, 0.4), light: lighten(editorGutterDeletedBackground, 0.3), hcDark: "#F48771", hcLight: "#B5200D" },
  nls.localize("editorGutterDeletedSecondaryBackground", "Editor gutter secondary background color for lines that are deleted.")
);
const minimapGutterModifiedBackground = registerColor(
  "minimapGutter.modifiedBackground",
  editorGutterModifiedBackground,
  nls.localize("minimapGutterModifiedBackground", "Minimap gutter background color for lines that are modified.")
);
const minimapGutterAddedBackground = registerColor(
  "minimapGutter.addedBackground",
  editorGutterAddedBackground,
  nls.localize("minimapGutterAddedBackground", "Minimap gutter background color for lines that are added.")
);
const minimapGutterDeletedBackground = registerColor(
  "minimapGutter.deletedBackground",
  editorGutterDeletedBackground,
  nls.localize("minimapGutterDeletedBackground", "Minimap gutter background color for lines that are deleted.")
);
const overviewRulerModifiedForeground = registerColor(
  "editorOverviewRuler.modifiedForeground",
  transparent(editorGutterModifiedBackground, 0.6),
  nls.localize("overviewRulerModifiedForeground", "Overview ruler marker color for modified content.")
);
const overviewRulerAddedForeground = registerColor(
  "editorOverviewRuler.addedForeground",
  transparent(editorGutterAddedBackground, 0.6),
  nls.localize("overviewRulerAddedForeground", "Overview ruler marker color for added content.")
);
const overviewRulerDeletedForeground = registerColor(
  "editorOverviewRuler.deletedForeground",
  transparent(editorGutterDeletedBackground, 0.6),
  nls.localize("overviewRulerDeletedForeground", "Overview ruler marker color for deleted content.")
);
const editorGutterItemGlyphForeground = registerColor(
  "editorGutter.itemGlyphForeground",
  { dark: editorForeground, light: editorForeground, hcDark: Color.black, hcLight: Color.white },
  nls.localize("editorGutterItemGlyphForeground", "Editor gutter decoration color for gutter item glyphs.")
);
const editorGutterItemBackground = registerColor("editorGutter.itemBackground", { dark: opaque(listInactiveSelectionBackground, editorBackground), light: darken(opaque(listInactiveSelectionBackground, editorBackground), 0.05), hcDark: Color.white, hcLight: Color.black }, nls.localize("editorGutterItemBackground", "Editor gutter decoration color for gutter item background. This color should be opaque."));
var ChangeType = /* @__PURE__ */ ((ChangeType2) => {
  ChangeType2[ChangeType2["Modify"] = 0] = "Modify";
  ChangeType2[ChangeType2["Add"] = 1] = "Add";
  ChangeType2[ChangeType2["Delete"] = 2] = "Delete";
  return ChangeType2;
})(ChangeType || {});
function getChangeType(change) {
  if (change.originalEndLineNumber === 0) {
    return 1 /* Add */;
  } else if (change.modifiedEndLineNumber === 0) {
    return 2 /* Delete */;
  } else {
    return 0 /* Modify */;
  }
}
function getChangeTypeColor(theme, changeType) {
  switch (changeType) {
    case 0 /* Modify */:
      return theme.getColor(editorGutterModifiedBackground);
    case 1 /* Add */:
      return theme.getColor(editorGutterAddedBackground);
    case 2 /* Delete */:
      return theme.getColor(editorGutterDeletedBackground);
  }
}
function compareChanges(a, b) {
  let result = a.modifiedStartLineNumber - b.modifiedStartLineNumber;
  if (result !== 0) {
    return result;
  }
  result = a.modifiedEndLineNumber - b.modifiedEndLineNumber;
  if (result !== 0) {
    return result;
  }
  result = a.originalStartLineNumber - b.originalStartLineNumber;
  if (result !== 0) {
    return result;
  }
  return a.originalEndLineNumber - b.originalEndLineNumber;
}
function getChangeHeight(change) {
  const modified = change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
  const original = change.originalEndLineNumber - change.originalStartLineNumber + 1;
  if (change.originalEndLineNumber === 0) {
    return modified;
  } else if (change.modifiedEndLineNumber === 0) {
    return original;
  } else {
    return modified + original;
  }
}
function getModifiedEndLineNumber(change) {
  if (change.modifiedEndLineNumber === 0) {
    return change.modifiedStartLineNumber === 0 ? 1 : change.modifiedStartLineNumber;
  } else {
    return change.modifiedEndLineNumber;
  }
}
function lineIntersectsChange(lineNumber, change) {
  if (lineNumber === 1 && change.modifiedStartLineNumber === 0 && change.modifiedEndLineNumber === 0) {
    return true;
  }
  return lineNumber >= change.modifiedStartLineNumber && lineNumber <= (change.modifiedEndLineNumber || change.modifiedStartLineNumber);
}
export {
  ChangeType,
  IQuickDiffService,
  compareChanges,
  editorGutterItemBackground,
  editorGutterItemGlyphForeground,
  getChangeHeight,
  getChangeType,
  getChangeTypeColor,
  getModifiedEndLineNumber,
  lineIntersectsChange,
  minimapGutterAddedBackground,
  minimapGutterDeletedBackground,
  minimapGutterModifiedBackground,
  overviewRulerAddedForeground,
  overviewRulerDeletedForeground,
  overviewRulerModifiedForeground
};
