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
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IProcessService } from "../../../../platform/process/common/process.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Extensions as QuickAccessExtensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/contributions.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IssueQuickAccess } from "../browser/issueQuickAccess.js";
import "../browser/issueTroubleshoot.js";
import "./issueReporterKeybindings.js";
import { BaseIssueContribution } from "../common/issue.contribution.js";
import { IIssueFormService, IWorkbenchIssueService, IssueType } from "../common/issue.js";
import { NativeIssueService } from "./issueService.js";
import { NativeIssueFormService } from "./nativeIssueFormService.js";
import { IScreenshotService } from "../browser/screenshotService.js";
import { NativeScreenshotService } from "./nativeScreenshotService.js";
import { IRecordingService } from "../browser/recordingService.js";
import { NativeRecordingService } from "./nativeRecordingService.js";
import { IGitHubUploadService } from "../browser/githubUploadService.js";
import { NativeGitHubUploadService } from "./nativeGitHubUploadService.js";
import { IssueReporterEditorPane } from "./issueReporterEditorPane.js";
import { IssueReporterEditorInput } from "../browser/issueReporterEditorInput.js";
registerSingleton(IWorkbenchIssueService, NativeIssueService, InstantiationType.Delayed);
registerSingleton(IIssueFormService, NativeIssueFormService, InstantiationType.Delayed);
registerSingleton(IScreenshotService, NativeScreenshotService, InstantiationType.Delayed);
registerSingleton(IRecordingService, NativeRecordingService, InstantiationType.Delayed);
registerSingleton(IGitHubUploadService, NativeGitHubUploadService, InstantiationType.Delayed);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "issueReporter",
  title: localize("issueReporterConfigurationTitle", "Issue Reporter"),
  type: "object",
  properties: {
    "issueReporter.wizard.enabled": {
      type: "boolean",
      default: false,
      description: localize("issueReporter.wizard.enabled", "Enable the new issue reporter wizard instead of the classic issue reporter."),
      experiment: { mode: "auto" }
    },
    "issueReporter.wizard.fullWorkspaceScan": {
      type: "boolean",
      default: true,
      description: localize("issueReporter.wizard.fullWorkspaceScan", "When auto-collecting performance diagnostics for the issue reporter wizard, walk the full workspace instead of stopping at the default 20,000-file cap. Set to false on very large workspaces if the scan slows the initial wizard render."),
      experiment: { mode: "auto" }
    }
  }
});
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    IssueReporterEditorPane,
    IssueReporterEditorPane.ID,
    localize("issueReporterEditorPaneTitle", "Issue Reporter")
  ),
  [new SyncDescriptor(IssueReporterEditorInput)]
);
let NativeIssueContribution = class extends BaseIssueContribution {
  constructor(productService, configurationService) {
    super(productService, configurationService);
    if (!configurationService.getValue("telemetry.feedback.enabled")) {
      return;
    }
    if (productService.reportIssueUrl) {
      this._register(registerAction2(ReportPerformanceIssueUsingReporterAction));
    }
    let disposable;
    const registerQuickAccessProvider = () => {
      disposable = Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
        ctor: IssueQuickAccess,
        prefix: IssueQuickAccess.PREFIX,
        contextKey: "inReportIssuePicker",
        placeholder: localize("tasksQuickAccessPlaceholder", "Type the name of an extension to report on."),
        helpEntries: [{
          description: localize("openIssueReporter", "Open Issue Reporter"),
          commandId: "workbench.action.openIssueReporter"
        }]
      });
    };
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (!configurationService.getValue("extensions.experimental.issueQuickAccess") && disposable) {
        disposable.dispose();
        disposable = void 0;
      } else if (!disposable) {
        registerQuickAccessProvider();
      }
    }));
    if (configurationService.getValue("extensions.experimental.issueQuickAccess")) {
      registerQuickAccessProvider();
    }
  }
};
NativeIssueContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService)
], NativeIssueContribution);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(NativeIssueContribution, LifecyclePhase.Restored);
class ReportPerformanceIssueUsingReporterAction extends Action2 {
  static {
    this.ID = "workbench.action.reportPerformanceIssueUsingReporter";
  }
  constructor() {
    super({
      id: ReportPerformanceIssueUsingReporterAction.ID,
      title: localize2({ key: "reportPerformanceIssue", comment: [`Here, 'issue' means problem or bug`] }, "Report Performance Issue..."),
      category: Categories.Help,
      f1: true
    });
  }
  async run(accessor) {
    const issueService = accessor.get(IWorkbenchIssueService);
    return issueService.openReporter({ issueType: IssueType.PerformanceIssue });
  }
}
CommandsRegistry.registerCommand("_issues.getSystemStatus", (accessor) => {
  return accessor.get(IProcessService).getSystemStatus();
});
