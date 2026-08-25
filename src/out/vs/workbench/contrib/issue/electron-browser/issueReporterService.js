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
import { $, reset } from "../../../../base/browser/dom.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { isRemoteDiagnosticError } from "../../../../platform/diagnostics/common/diagnostics.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProcessService } from "../../../../platform/process/common/process.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { applyZoom } from "../../../../platform/window/electron-browser/window.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { BaseIssueReporterService } from "../browser/baseIssueReporterService.js";
import { IIssueFormService, IssueType } from "../common/issue.js";
const MAX_URL_LENGTH = 7500;
const MAX_GITHUB_API_LENGTH = 65500;
let IssueReporter = class extends BaseIssueReporterService {
  constructor(disableExtensions, data, os, product, window, nativeHostService, issueFormService, processService, themeService, fileService, fileDialogService, updateService, contextKeyService, contextMenuService, authenticationService, openerService) {
    super(disableExtensions, data, os, product, window, false, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService);
    this.nativeHostService = nativeHostService;
    this.updateService = updateService;
    this.processService = processService;
    this.processService.getSystemInfo().then((info) => {
      this.issueReporterModel.update({ systemInfo: info });
      this.receivedSystemInfo = true;
      this.updateSystemInfo(this.issueReporterModel.getData());
      this.updateButtonStates();
    });
    if (this.data.issueType === IssueType.PerformanceIssue) {
      this.processService.getPerformanceInfo().then((info) => {
        this.updatePerformanceInfo(info);
      });
    }
    this.checkForUpdates();
    this.setEventHandlers();
    applyZoom(this.data.zoomLevel, this.window);
    this.updateExperimentsInfo(this.data.experiments);
    this.updateRestrictedMode(this.data.restrictedMode);
    this.updateInstallationPureMode(this.data.isInstallationPure);
  }
  async checkForUpdates() {
    const updateState = this.updateService.state;
    if (updateState.type === StateType.Ready || updateState.type === StateType.Downloaded) {
      this.needsUpdate = true;
      const includeAcknowledgement = this.getElementById("version-acknowledgements");
      const updateBanner = this.getElementById("update-banner");
      if (updateBanner && includeAcknowledgement) {
        includeAcknowledgement.classList.remove("hidden");
        updateBanner.classList.remove("hidden");
        updateBanner.textContent = localize("updateAvailable", "A new version of {0} is available.", this.product.nameLong);
      }
    }
  }
  setEventHandlers() {
    super.setEventHandlers();
    this.addEventListener("issue-type", "change", (event) => {
      const issueType = parseInt(event.target.value);
      this.issueReporterModel.update({ issueType });
      if (issueType === IssueType.PerformanceIssue && !this.receivedPerformanceInfo) {
        this.processService.getPerformanceInfo().then((info) => {
          this.updatePerformanceInfo(info);
        });
      }
      const descriptionTextArea = this.getElementById("issue-title");
      if (descriptionTextArea) {
        descriptionTextArea.placeholder = localize("undefinedPlaceholder", "Please enter a title");
      }
      this.updateButtonStates();
      this.setSourceOptions();
      this.render();
    });
  }
  async submitToGitHub(issueTitle, issueBody, gitHubDetails) {
    if (issueBody.length > MAX_GITHUB_API_LENGTH) {
      const extensionData = this.issueReporterModel.getData().extensionData;
      if (extensionData) {
        issueBody = issueBody.replace(extensionData, "");
        const date = /* @__PURE__ */ new Date();
        const formattedDate = date.toISOString().split("T")[0];
        const formattedTime = date.toTimeString().split(" ")[0].replace(/:/g, "-");
        const fileName = `extensionData_${formattedDate}_${formattedTime}.md`;
        try {
          const downloadPath = await this.fileDialogService.showSaveDialog({
            title: localize("saveExtensionData", "Save Extension Data"),
            availableFileSystems: [Schemas.file],
            defaultUri: joinPath(await this.fileDialogService.defaultFilePath(Schemas.file), fileName)
          });
          if (downloadPath) {
            await this.fileService.writeFile(downloadPath, VSBuffer.fromString(extensionData));
          }
        } catch (e) {
          console.error("Writing extension data to file failed");
          return false;
        }
      } else {
        console.error("Issue body too large to submit to GitHub");
        return false;
      }
    }
    const url = `https://api.github.com/repos/${gitHubDetails.owner}/${gitHubDetails.repositoryName}/issues`;
    const init = {
      method: "POST",
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody
      }),
      headers: new Headers({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.data.githubAccessToken}`
      })
    };
    const response = await fetch(url, init);
    if (!response.ok) {
      console.error("Invalid GitHub URL provided.");
      return false;
    }
    const result = await response.json();
    await this.openerService.open(result.html_url, { openExternal: true });
    this.close();
    return true;
  }
  async createIssue(shouldCreate, privateUri) {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    if (this.nonGitHubIssueUrl) {
      const url2 = this.getExtensionBugsUrl();
      if (url2) {
        this.hasBeenSubmitted = true;
        await this.openerService.open(url2, { openExternal: true });
        return true;
      }
    }
    if (!this.validateInputs()) {
      const invalidInput = this.window.document.getElementsByClassName("invalid-input");
      if (invalidInput.length) {
        invalidInput[0].focus();
      }
      this.addEventListener("issue-title", "input", (_) => {
        this.validateInput("issue-title");
      });
      this.addEventListener("description", "input", (_) => {
        this.validateInput("description");
      });
      this.addEventListener("issue-source", "change", (_) => {
        this.validateInput("issue-source");
      });
      if (this.issueReporterModel.fileOnExtension()) {
        this.addEventListener("extension-selector", "change", (_) => {
          this.validateInput("extension-selector");
          this.validateInput("description");
        });
      }
      return false;
    }
    this.hasBeenSubmitted = true;
    const issueTitle = this.getElementById("issue-title").value;
    const issueBody = this.issueReporterModel.serialize();
    let issueUrl = privateUri ? this.getPrivateIssueUrl() : this.getIssueUrl();
    if (!issueUrl && selectedExtension?.uri) {
      const uri = URI.revive(selectedExtension.uri);
      issueUrl = uri.toString();
    } else if (!issueUrl) {
      console.error(`No ${privateUri ? "private " : ""}issue url found`);
      return false;
    }
    const gitHubDetails = this.parseGitHubUrl(issueUrl);
    const baseUrl = this.getIssueUrlWithTitle(this.getElementById("issue-title").value, issueUrl);
    let url = baseUrl + `&body=${encodeURIComponent(issueBody)}`;
    url = this.addTemplateToUrl(url, gitHubDetails?.owner, gitHubDetails?.repositoryName);
    if (this.data.githubAccessToken && gitHubDetails && shouldCreate) {
      if (await this.submitToGitHub(issueTitle, issueBody, gitHubDetails)) {
        return true;
      }
    }
    try {
      if (url.length > MAX_URL_LENGTH || issueBody.length > MAX_GITHUB_API_LENGTH) {
        url = await this.writeToClipboard(baseUrl, issueBody);
        url = this.addTemplateToUrl(url, gitHubDetails?.owner, gitHubDetails?.repositoryName);
      }
    } catch (_) {
      console.error("Writing to clipboard failed");
      return false;
    }
    await this.openerService.open(url, { openExternal: true });
    return true;
  }
  async writeToClipboard(baseUrl, issueBody) {
    const shouldWrite = await this.issueFormService.showClipboardDialog();
    if (!shouldWrite) {
      throw new CancellationError();
    }
    await this.nativeHostService.writeClipboardText(issueBody);
    return baseUrl + `&body=${encodeURIComponent(localize("pasteData", "We have written the needed data into your clipboard because it was too large to send. Please paste."))}`;
  }
  updateSystemInfo(state) {
    const target = this.window.document.querySelector(".block-system .block-info");
    if (target) {
      const systemInfo = state.systemInfo;
      const renderedDataTable = $(
        "table",
        void 0,
        $(
          "tr",
          void 0,
          $("td", void 0, "CPUs"),
          $("td", void 0, systemInfo.cpus || "")
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "GPU Status"),
          $("td", void 0, Object.keys(systemInfo.gpuStatus).map((key) => `${key}: ${systemInfo.gpuStatus[key]}`).join("\n"))
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Load (avg)"),
          $("td", void 0, systemInfo.load || "")
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Memory (System)"),
          $("td", void 0, systemInfo.memory)
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Process Argv"),
          $("td", void 0, systemInfo.processArgs)
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Screen Reader"),
          $("td", void 0, systemInfo.screenReader)
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "VM"),
          $("td", void 0, systemInfo.vmHint)
        )
      );
      reset(target, renderedDataTable);
      systemInfo.remoteData.forEach((remote) => {
        target.appendChild($("hr"));
        if (isRemoteDiagnosticError(remote)) {
          const remoteDataTable = $(
            "table",
            void 0,
            $(
              "tr",
              void 0,
              $("td", void 0, "Remote"),
              $("td", void 0, remote.hostName)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, ""),
              $("td", void 0, remote.errorMessage)
            )
          );
          target.appendChild(remoteDataTable);
        } else {
          const remoteDataTable = $(
            "table",
            void 0,
            $(
              "tr",
              void 0,
              $("td", void 0, "Remote"),
              $("td", void 0, remote.latency ? `${remote.hostName} (latency: ${remote.latency.current.toFixed(2)}ms last, ${remote.latency.average.toFixed(2)}ms average)` : remote.hostName)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "OS"),
              $("td", void 0, remote.machineInfo.os)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "CPUs"),
              $("td", void 0, remote.machineInfo.cpus || "")
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "Memory (System)"),
              $("td", void 0, remote.machineInfo.memory)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "VM"),
              $("td", void 0, remote.machineInfo.vmHint)
            )
          );
          target.appendChild(remoteDataTable);
        }
      });
    }
  }
  updateRestrictedMode(restrictedMode) {
    this.issueReporterModel.update({ restrictedMode });
  }
  updateInstallationPureMode(isInstallationPure) {
    this.issueReporterModel.update({ isInstallationPure });
  }
  updateExperimentsInfo(experimentInfo) {
    this.issueReporterModel.update({ experimentInfo });
    const target = this.window.document.querySelector(".block-experiments .block-info");
    if (target) {
      target.textContent = experimentInfo ? experimentInfo : localize("noCurrentExperiments", "No current experiments.");
    }
  }
};
IssueReporter = __decorateClass([
  __decorateParam(5, INativeHostService),
  __decorateParam(6, IIssueFormService),
  __decorateParam(7, IProcessService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IFileDialogService),
  __decorateParam(11, IUpdateService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, IContextMenuService),
  __decorateParam(14, IAuthenticationService),
  __decorateParam(15, IOpenerService)
], IssueReporter);
export {
  IssueReporter
};
