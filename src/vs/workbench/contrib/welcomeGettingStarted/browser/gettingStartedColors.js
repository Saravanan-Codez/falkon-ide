import { darken, inputBackground, editorWidgetBackground, lighten, registerColor, textLinkForeground, contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { localize } from "../../../../nls.js";
const welcomePageBackground = registerColor("welcomePage.background", null, localize("welcomePage.background", "Background color for the Welcome page."));
const welcomePageTileBackground = registerColor("welcomePage.tileBackground", { dark: editorWidgetBackground, light: editorWidgetBackground, hcDark: "#000", hcLight: editorWidgetBackground }, localize("welcomePage.tileBackground", "Background color for the tiles on the Welcome page."));
const welcomePageTileHoverBackground = registerColor("welcomePage.tileHoverBackground", { dark: lighten(editorWidgetBackground, 0.2), light: darken(editorWidgetBackground, 0.1), hcDark: null, hcLight: null }, localize("welcomePage.tileHoverBackground", "Hover background color for the tiles on the Welcome."));
const welcomePageTileBorder = registerColor("welcomePage.tileBorder", { dark: "#ffffff1a", light: "#0000001a", hcDark: contrastBorder, hcLight: contrastBorder }, localize("welcomePage.tileBorder", "Border color for the tiles on the Welcome page."));
const welcomePageProgressBackground = registerColor("welcomePage.progress.background", inputBackground, localize("welcomePage.progress.background", "Foreground color for the Welcome page progress bars."));
const welcomePageProgressForeground = registerColor("welcomePage.progress.foreground", textLinkForeground, localize("welcomePage.progress.foreground", "Background color for the Welcome page progress bars."));
const walkthroughStepTitleForeground = registerColor("walkthrough.stepTitle.foreground", { light: "#000000", dark: "#ffffff", hcDark: null, hcLight: null }, localize("walkthrough.stepTitle.foreground", "Foreground color of the heading of each walkthrough step"));
export {
  walkthroughStepTitleForeground,
  welcomePageBackground,
  welcomePageProgressBackground,
  welcomePageProgressForeground,
  welcomePageTileBackground,
  welcomePageTileBorder,
  welcomePageTileHoverBackground
};
