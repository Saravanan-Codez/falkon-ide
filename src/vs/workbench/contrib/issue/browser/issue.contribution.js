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
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/contributions.js";
import { IssueFormService } from "./issueFormService.js";
import { BrowserIssueService } from "./issueService.js";
import "./issueTroubleshoot.js";
import { IIssueFormService, IWorkbenchIssueService } from "../common/issue.js";
import { BaseIssueContribution } from "../common/issue.contribution.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { BrowserScreenshotService, IScreenshotService } from "./screenshotService.js";
import { BrowserRecordingService, IRecordingService } from "./recordingService.js";
import { BrowserGitHubUploadService, IGitHubUploadService } from "./githubUploadService.js";
let WebIssueContribution = class extends BaseIssueContribution {
  constructor(productService, configurationService) {
    super(productService, configurationService);
    Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
      properties: {
        "issueReporter.experimental.webReporter": {
          type: "boolean",
          default: productService.quality !== "stable",
          description: "Enable experimental issue reporter for web."
        }
      }
    });
  }
};
WebIssueContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService)
], WebIssueContribution);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(WebIssueContribution, LifecyclePhase.Restored);
registerSingleton(IWorkbenchIssueService, BrowserIssueService, InstantiationType.Delayed);
registerSingleton(IIssueFormService, IssueFormService, InstantiationType.Delayed);
registerSingleton(IScreenshotService, BrowserScreenshotService, InstantiationType.Delayed);
registerSingleton(IRecordingService, BrowserRecordingService, InstantiationType.Delayed);
registerSingleton(IGitHubUploadService, BrowserGitHubUploadService, InstantiationType.Delayed);
CommandsRegistry.registerCommand("_issues.getSystemStatus", (accessor) => {
  return nls.localize("statusUnsupported", "The --status argument is not yet supported in browsers.");
});
