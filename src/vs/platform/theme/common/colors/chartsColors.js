import * as nls from "../../../../nls.js";
import { registerColor, transparent } from "../colorUtils.js";
import { foreground } from "./baseColors.js";
import { editorErrorForeground, editorInfoForeground, editorWarningForeground } from "./editorColors.js";
import { minimapFindMatch } from "./minimapColors.js";
const chartsForeground = registerColor(
  "charts.foreground",
  foreground,
  nls.localize("chartsForeground", "The foreground color used in charts.")
);
const chartsLines = registerColor(
  "charts.lines",
  transparent(foreground, 0.5),
  nls.localize("chartsLines", "The color used for horizontal lines in charts.")
);
const chartsRed = registerColor(
  "charts.red",
  editorErrorForeground,
  nls.localize("chartsRed", "The red color used in chart visualizations.")
);
const chartsBlue = registerColor(
  "charts.blue",
  editorInfoForeground,
  nls.localize("chartsBlue", "The blue color used in chart visualizations.")
);
const chartsYellow = registerColor(
  "charts.yellow",
  editorWarningForeground,
  nls.localize("chartsYellow", "The yellow color used in chart visualizations.")
);
const chartsOrange = registerColor(
  "charts.orange",
  minimapFindMatch,
  nls.localize("chartsOrange", "The orange color used in chart visualizations.")
);
const chartsGreen = registerColor(
  "charts.green",
  { dark: "#89D185", light: "#388A34", hcDark: "#89D185", hcLight: "#374e06" },
  nls.localize("chartsGreen", "The green color used in chart visualizations.")
);
const chartsPurple = registerColor(
  "charts.purple",
  { dark: "#B180D7", light: "#652D90", hcDark: "#B180D7", hcLight: "#652D90" },
  nls.localize("chartsPurple", "The purple color used in chart visualizations.")
);
export {
  chartsBlue,
  chartsForeground,
  chartsGreen,
  chartsLines,
  chartsOrange,
  chartsPurple,
  chartsRed,
  chartsYellow
};
