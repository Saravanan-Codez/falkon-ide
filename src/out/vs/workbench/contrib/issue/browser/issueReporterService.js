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
import { localize } from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IIssueFormService } from "../common/issue.js";
import { BaseIssueReporterService } from "./baseIssueReporterService.js";
let IssueWebReporter = class extends BaseIssueReporterService {
  constructor(disableExtensions, data, os, product, window, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService) {
    super(disableExtensions, data, os, product, window, true, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService);
    const target = this.window.document.querySelector(".block-system .block-info");
    const webInfo = this.window.navigator.userAgent;
    if (webInfo) {
      target?.appendChild(this.window.document.createTextNode(webInfo));
      this.receivedSystemInfo = true;
      this.issueReporterModel.update({ systemInfoWeb: webInfo });
    }
    this.setEventHandlers();
  }
  setEventHandlers() {
    super.setEventHandlers();
    this.addEventListener("issue-type", "change", (event) => {
      const issueType = parseInt(event.target.value);
      this.issueReporterModel.update({ issueType });
      const descriptionTextArea = this.getElementById("issue-title");
      if (descriptionTextArea) {
        descriptionTextArea.placeholder = localize("undefinedPlaceholder", "Please enter a title");
      }
      this.updateButtonStates();
      this.setSourceOptions();
      this.render();
    });
  }
};
IssueWebReporter = __decorateClass([
  __decorateParam(5, IIssueFormService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IFileDialogService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, IAuthenticationService),
  __decorateParam(11, IOpenerService)
], IssueWebReporter);
export {
  IssueWebReporter
};
