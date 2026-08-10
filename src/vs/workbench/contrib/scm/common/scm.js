import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const VIEWLET_ID = "workbench.view.scm";
const VIEW_PANE_ID = "workbench.scm";
const REPOSITORIES_VIEW_PANE_ID = "workbench.scm.repositories";
const HISTORY_VIEW_PANE_ID = "workbench.scm.history";
var ViewMode = /* @__PURE__ */ ((ViewMode2) => {
  ViewMode2["List"] = "list";
  ViewMode2["Tree"] = "tree";
  return ViewMode2;
})(ViewMode || {});
const ISCMService = createDecorator("scm");
var InputValidationType = /* @__PURE__ */ ((InputValidationType2) => {
  InputValidationType2[InputValidationType2["Error"] = 0] = "Error";
  InputValidationType2[InputValidationType2["Warning"] = 1] = "Warning";
  InputValidationType2[InputValidationType2["Information"] = 2] = "Information";
  return InputValidationType2;
})(InputValidationType || {});
var SCMInputChangeReason = /* @__PURE__ */ ((SCMInputChangeReason2) => {
  SCMInputChangeReason2[SCMInputChangeReason2["HistoryPrevious"] = 0] = "HistoryPrevious";
  SCMInputChangeReason2[SCMInputChangeReason2["HistoryNext"] = 1] = "HistoryNext";
  return SCMInputChangeReason2;
})(SCMInputChangeReason || {});
var ISCMRepositorySortKey = /* @__PURE__ */ ((ISCMRepositorySortKey2) => {
  ISCMRepositorySortKey2["DiscoveryTime"] = "discoveryTime";
  ISCMRepositorySortKey2["Name"] = "name";
  ISCMRepositorySortKey2["Path"] = "path";
  return ISCMRepositorySortKey2;
})(ISCMRepositorySortKey || {});
var ISCMRepositorySelectionMode = /* @__PURE__ */ ((ISCMRepositorySelectionMode2) => {
  ISCMRepositorySelectionMode2["Single"] = "single";
  ISCMRepositorySelectionMode2["Multiple"] = "multiple";
  return ISCMRepositorySelectionMode2;
})(ISCMRepositorySelectionMode || {});
const ISCMViewService = createDecorator("scmView");
export {
  HISTORY_VIEW_PANE_ID,
  ISCMRepositorySelectionMode,
  ISCMRepositorySortKey,
  ISCMService,
  ISCMViewService,
  InputValidationType,
  REPOSITORIES_VIEW_PANE_ID,
  SCMInputChangeReason,
  VIEWLET_ID,
  VIEW_PANE_ID,
  ViewMode
};
