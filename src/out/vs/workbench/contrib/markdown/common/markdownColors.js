import { localize } from "../../../../nls.js";
import { registerColor, editorInfoForeground, editorWarningForeground, editorErrorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { chartsGreen, chartsPurple } from "../../../../platform/theme/common/colors/chartsColors.js";
const markdownAlertNoteColor = registerColor(
  "markdownAlert.note.foreground",
  editorInfoForeground,
  localize("markdownAlertNoteForeground", "Foreground color for note alerts in markdown.")
);
const markdownAlertTipColor = registerColor(
  "markdownAlert.tip.foreground",
  chartsGreen,
  localize("markdownAlertTipForeground", "Foreground color for tip alerts in markdown.")
);
const markdownAlertImportantColor = registerColor(
  "markdownAlert.important.foreground",
  chartsPurple,
  localize("markdownAlertImportantForeground", "Foreground color for important alerts in markdown.")
);
const markdownAlertWarningColor = registerColor(
  "markdownAlert.warning.foreground",
  editorWarningForeground,
  localize("markdownAlertWarningForeground", "Foreground color for warning alerts in markdown.")
);
const markdownAlertCautionColor = registerColor(
  "markdownAlert.caution.foreground",
  editorErrorForeground,
  localize("markdownAlertCautionForeground", "Foreground color for caution alerts in markdown.")
);
export {
  markdownAlertCautionColor,
  markdownAlertImportantColor,
  markdownAlertNoteColor,
  markdownAlertTipColor,
  markdownAlertWarningColor
};
