import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { language } from "../../../../base/common/platform.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { safeIntl } from "../../../../base/common/date.js";
let localHistoryDateFormatter = void 0;
function getLocalHistoryDateFormatter() {
  if (!localHistoryDateFormatter) {
    const options = { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" };
    const formatter = safeIntl.DateTimeFormat(language, options).value;
    localHistoryDateFormatter = {
      format: (date) => formatter.format(date)
    };
  }
  return localHistoryDateFormatter;
}
const LOCAL_HISTORY_MENU_CONTEXT_VALUE = "localHistory:item";
const LOCAL_HISTORY_MENU_CONTEXT_KEY = ContextKeyExpr.equals("timelineItem", LOCAL_HISTORY_MENU_CONTEXT_VALUE);
const LOCAL_HISTORY_ICON_ENTRY = registerIcon("localHistory-icon", Codicon.circleOutline, localize("localHistoryIcon", "Icon for a local history entry in the timeline view."));
const LOCAL_HISTORY_ICON_RESTORE = registerIcon("localHistory-restore", Codicon.check, localize("localHistoryRestore", "Icon for restoring contents of a local history entry."));
export {
  LOCAL_HISTORY_ICON_ENTRY,
  LOCAL_HISTORY_ICON_RESTORE,
  LOCAL_HISTORY_MENU_CONTEXT_KEY,
  LOCAL_HISTORY_MENU_CONTEXT_VALUE,
  getLocalHistoryDateFormatter
};
