var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as nls from "../../../../nls.js";
import { Action } from "../../../../base/common/actions.js";
import { IWorkbenchIssueService } from "../../issue/common/issue.js";
let ReportExtensionIssueAction = class extends Action {
  // TODO: Consider passing in IExtensionStatus or IExtensionHostProfile for additional data
  constructor(extension, issueService) {
    super(ReportExtensionIssueAction._id, ReportExtensionIssueAction._label, "extension-action report-issue");
    this.extension = extension;
    this.issueService = issueService;
    this.enabled = extension.isBuiltin || !!extension.repository && !!extension.repository.url;
  }
  static {
    this._id = "workbench.extensions.action.reportExtensionIssue";
  }
  static {
    this._label = nls.localize("reportExtensionIssue", "Report Issue");
  }
  async run() {
    await this.issueService.openReporter({
      extensionId: this.extension.identifier.value
    });
  }
};
ReportExtensionIssueAction = __decorateClass([
  __decorateParam(1, IWorkbenchIssueService)
], ReportExtensionIssueAction);
export {
  ReportExtensionIssueAction
};
