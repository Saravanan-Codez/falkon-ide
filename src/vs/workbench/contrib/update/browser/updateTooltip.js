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
import * as dom from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IMeteredConnectionService } from "../../../../platform/meteredConnection/common/meteredConnection.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { DisablementReason, StateType } from "../../../../platform/update/common/update.js";
import { ShowCurrentReleaseNotesActionId } from "../common/update.js";
import { computeDownloadSpeed, computeDownloadTimeRemaining, computeProgressPercent, formatBytes, formatDate, formatTimeRemaining, tryParseDate } from "../common/updateUtils.js";
import "./media/updateTooltip.css";
let UpdateTooltip = class extends Disposable {
  constructor(clipboardService, commandService, configurationService, hoverService, meteredConnectionService, productService) {
    super();
    this.clipboardService = clipboardService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.meteredConnectionService = meteredConnectionService;
    this.productService = productService;
    this.domNode = dom.$(".update-tooltip");
    const header = dom.append(this.domNode, dom.$(".header"));
    this.titleNode = dom.append(header, dom.$(".title"));
    this.productInfoNode = dom.append(this.domNode, dom.$(".product-info"));
    const logoContainer = dom.append(this.productInfoNode, dom.$(".product-logo"));
    logoContainer.setAttribute("role", "img");
    logoContainer.setAttribute("aria-label", this.productService.nameLong);
    const details = dom.append(this.productInfoNode, dom.$(".product-details"));
    this.productNameNode = dom.append(details, dom.$(".product-name"));
    this.productNameNode.textContent = this.productService.nameLong;
    const currentVersionRow = this.createVersionRow(details);
    this.currentVersionNode = currentVersionRow.label;
    this.currentVersionCopyValue = currentVersionRow.copyValue;
    const latestVersionRow = this.createVersionRow(details);
    this.latestVersionNode = latestVersionRow.label;
    this.latestVersionCopyValue = latestVersionRow.copyValue;
    this.releaseDateNode = dom.append(details, dom.$(".product-release-date"));
    this.progressContainer = dom.append(this.domNode, dom.$(".progress-container"));
    const progressBar = dom.append(this.progressContainer, dom.$(".progress-bar"));
    this.progressFill = dom.append(progressBar, dom.$(".progress-fill"));
    const progressText = dom.append(this.progressContainer, dom.$(".progress-text"));
    this.progressPercentNode = dom.append(progressText, dom.$("span"));
    this.progressSizeNode = dom.append(progressText, dom.$("span"));
    this.downloadStatsContainer = dom.append(this.progressContainer, dom.$(".download-stats"));
    this.timeRemainingNode = dom.append(this.downloadStatsContainer, dom.$(".time-remaining"));
    this.speedInfoNode = dom.append(this.downloadStatsContainer, dom.$(".speed-info"));
    this.messageNode = dom.append(this.domNode, dom.$(".state-message"));
    this.buttonBar = dom.append(this.domNode, dom.$(".button-bar"));
    this.releaseNotesButton = dom.append(this.buttonBar, dom.$("button.release-notes-button"));
    this.releaseNotesButton.textContent = localize("updateTooltip.viewReleaseNotes", "Release Notes");
    this._register(dom.addDisposableListener(this.releaseNotesButton, "click", () => {
      if (this.releaseNotesVersion) {
        this.runCommandAndClose(ShowCurrentReleaseNotesActionId, this.releaseNotesVersion);
      }
    }));
    this.actionButton = dom.append(this.buttonBar, dom.$("button.action-button"));
    this._register(dom.addDisposableListener(this.actionButton, "click", () => {
      const commandId = this.actionButton.dataset.commandId;
      if (commandId) {
        this.runCommandAndClose(commandId);
      }
    }));
    this.updateCurrentVersion();
  }
  updateCurrentVersion() {
    const productVersion = this.productService.version;
    if (productVersion) {
      const currentCommitId = this.productService.commit?.substring(0, 7);
      this.currentVersionNode.textContent = currentCommitId ? localize("updateTooltip.currentVersionLabelWithCommit", "Current Version: {0} ({1})", productVersion, currentCommitId) : localize("updateTooltip.currentVersionLabel", "Current Version: {0}", productVersion);
      this.currentVersionCopyValue.value = currentCommitId ? `${productVersion} (${this.productService.commit})` : productVersion;
      this.currentVersionNode.parentElement.style.display = "";
    } else {
      this.currentVersionNode.parentElement.style.display = "none";
    }
  }
  hideAll() {
    this.productInfoNode.style.display = "";
    this.progressContainer.style.display = "none";
    this.speedInfoNode.textContent = "";
    this.timeRemainingNode.textContent = "";
    this.messageNode.style.display = "none";
    this.actionButton.style.display = "none";
    this.actionButton.dataset.commandId = "";
    this.releaseNotesButton.style.marginRight = "";
  }
  renderState(state) {
    this.hideAll();
    switch (state.type) {
      case StateType.Uninitialized:
        this.renderUninitialized();
        break;
      case StateType.Disabled:
        this.renderDisabled(state);
        break;
      case StateType.Idle:
        this.renderIdle(state);
        break;
      case StateType.CheckingForUpdates:
        this.renderCheckingForUpdates();
        break;
      case StateType.AvailableForDownload:
        this.renderAvailableForDownload(state);
        break;
      case StateType.Downloading:
        this.renderDownloading(state);
        break;
      case StateType.Downloaded:
        this.renderDownloaded(state);
        break;
      case StateType.Updating:
        this.renderUpdating(state);
        break;
      case StateType.Ready:
        this.renderReady(state);
        break;
      case StateType.Overwriting:
        this.renderOverwriting(state);
        break;
      case StateType.Cancelling:
        this.renderCancelling();
        break;
      case StateType.Restarting:
        this.renderRestarting(state);
        break;
    }
  }
  renderUninitialized() {
    this.renderTitleAndInfo(localize("updateTooltip.initializingTitle", "Initializing"));
    this.renderMessage(localize("updateTooltip.initializingMessage", "Initializing update service..."));
  }
  renderDisabled({ reason }) {
    this.renderTitleAndInfo(localize("updateTooltip.updatesDisabledTitle", "Updates Disabled"));
    switch (reason) {
      case DisablementReason.NotBuilt:
        this.renderMessage(
          localize("updateTooltip.disabledNotBuilt", "Updates are not available for this build."),
          Codicon.info
        );
        break;
      case DisablementReason.DisabledByEnvironment:
        this.renderMessage(
          localize("updateTooltip.disabledByEnvironment", "Updates are disabled by the --disable-updates command line flag."),
          Codicon.warning
        );
        break;
      case DisablementReason.ManuallyDisabled:
        this.renderMessage(
          localize("updateTooltip.disabledManually", 'Updates are manually disabled. Change the "update.mode" setting to enable.'),
          Codicon.warning
        );
        break;
      case DisablementReason.Policy:
        this.renderMessage(
          localize("updateTooltip.disabledByPolicy", "Updates are disabled by organization policy."),
          Codicon.info
        );
        break;
      case DisablementReason.MissingConfiguration:
        this.renderMessage(
          localize("updateTooltip.disabledMissingConfig", "Updates are disabled because no update URL is configured."),
          Codicon.info
        );
        break;
      case DisablementReason.InvalidConfiguration:
        this.renderMessage(
          localize("updateTooltip.disabledInvalidConfig", "Updates are disabled because the update URL is invalid."),
          Codicon.error
        );
        break;
      case DisablementReason.RunningAsAdmin:
        this.renderMessage(
          localize(
            "updateTooltip.disabledRunningAsAdmin",
            "Updates are not available when running a user install of {0} as administrator.",
            this.productService.nameShort
          ),
          Codicon.warning
        );
        break;
      default:
        this.renderMessage(localize("updateTooltip.disabledGeneric", "Updates are disabled."), Codicon.warning);
        break;
    }
  }
  renderIdle({ error, notAvailable }) {
    if (error) {
      this.renderTitleAndInfo(localize("updateTooltip.updateErrorTitle", "Update Error"));
      this.renderMessage(error, Codicon.error);
      return;
    }
    if (notAvailable) {
      this.renderTitleAndInfo(localize("updateTooltip.noUpdateAvailableTitle", "No Update Available"));
      this.renderMessage(localize("updateTooltip.noUpdateAvailableMessage", "There are no updates currently available."), Codicon.info);
      return;
    }
    this.renderTitleAndInfo(localize("updateTooltip.upToDateTitle", "Up to Date"));
    switch (this.configurationService.getValue("update.mode")) {
      case "none":
        this.renderMessage(localize("updateTooltip.autoUpdateNone", "Automatic updates are disabled."), Codicon.warning);
        break;
      case "manual":
        this.renderMessage(localize("updateTooltip.autoUpdateManual", "Automatic updates will be checked but not installed automatically."));
        break;
      case "start":
        this.renderMessage(localize("updateTooltip.autoUpdateStart", "Updates will be applied on restart."));
        break;
      case "default":
        if (this.meteredConnectionService.isConnectionMetered) {
          this.renderMessage(
            localize("updateTooltip.meteredConnectionMessage", "Automatic updates are paused because the network connection is metered."),
            Codicon.radioTower
          );
        } else {
          this.renderMessage(
            localize("updateTooltip.autoUpdateDefault", "Automatic updates are enabled. Happy Coding!"),
            Codicon.smiley
          );
        }
        break;
    }
  }
  renderCheckingForUpdates() {
    this.renderTitleAndInfo(localize("updateTooltip.checkingForUpdatesTitle", "Checking for Updates"));
    this.renderMessage(localize("updateTooltip.checkingPleaseWait", "Checking for updates, please wait..."));
  }
  renderAvailableForDownload({ update }) {
    this.renderTitleAndInfo(localize("updateTooltip.updateAvailableTitle", "Update Available"), update);
    this.renderActionButton(localize("updateTooltip.downloadButton", "Download"), "update.downloadNow");
  }
  renderDownloading(state) {
    this.renderTitleAndInfo(localize("updateTooltip.downloadingUpdateTitle", "Downloading Update"), state.update);
    const { downloadedBytes, totalBytes } = state;
    if (downloadedBytes !== void 0 && totalBytes !== void 0 && totalBytes > 0) {
      const percentage = computeProgressPercent(downloadedBytes, totalBytes) ?? 0;
      this.progressFill.style.width = `${percentage}%`;
      this.progressPercentNode.textContent = `${percentage}%`;
      this.progressSizeNode.textContent = `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`;
      this.progressContainer.style.display = "";
      const speed = computeDownloadSpeed(state);
      if (speed !== void 0 && speed > 0) {
        this.speedInfoNode.textContent = localize("updateTooltip.downloadSpeed", "{0}/s", formatBytes(speed));
      }
      const timeRemaining = computeDownloadTimeRemaining(state);
      if (timeRemaining !== void 0 && timeRemaining > 0) {
        this.timeRemainingNode.textContent = `~${formatTimeRemaining(timeRemaining)} ${localize("updateTooltip.timeRemaining", "remaining")}`;
      }
      this.downloadStatsContainer.style.display = "";
    } else {
      this.renderMessage(localize("updateTooltip.downloadingPleaseWait", "Downloading update, please wait..."));
    }
  }
  renderDownloaded({ update }) {
    this.renderTitleAndInfo(localize("updateTooltip.updateReadyTitle", "Update is Ready to Install"), update);
    this.renderActionButton(localize("updateTooltip.installButton", "Install"), "update.install");
  }
  renderUpdating({ update, currentProgress, maxProgress }) {
    this.renderTitleAndInfo(localize("updateTooltip.installingUpdateTitle", "Installing Update"), update);
    const percentage = computeProgressPercent(currentProgress, maxProgress);
    if (percentage !== void 0) {
      this.progressFill.style.width = `${percentage}%`;
      this.progressPercentNode.textContent = `${percentage}%`;
      this.progressSizeNode.textContent = "";
      this.progressContainer.style.display = "";
    } else {
      this.renderMessage(localize("updateTooltip.installingPleaseWait", "Installing update, please wait..."));
    }
  }
  renderReady({ update }) {
    if (this.configurationService.getValue("update.mode") === "manual") {
      this.renderTitleAndInfo(localize("updateTooltip.updateInstalledTitle", "Update Installed"), update);
      this.renderActionButton(localize("updateTooltip.restartButton", "Restart"), "update.restart");
    } else {
      this.renderTitleAndInfo(localize("updateTooltip.restartToUpdateTitle", "Restart to Update"), update);
    }
  }
  renderOverwriting({ update }) {
    this.renderTitleAndInfo(localize("updateTooltip.downloadingNewerUpdateTitle", "Downloading Newer Update"), update);
    this.renderMessage(localize("updateTooltip.downloadingNewerPleaseWait", "A newer update was released. Downloading, please wait..."));
  }
  renderRestarting({ update }) {
    this.renderTitleAndInfo(localize("updateTooltip.restartingTitle", "Restarting {0}", this.productService.nameShort), update);
    this.renderMessage(localize("updateTooltip.restartingPleaseWait", "Restarting to update, please wait..."));
  }
  renderCancelling() {
    this.renderTitleAndInfo(localize("updateTooltip.cancellingTitle", "Cancelling Update"));
    this.renderMessage(localize("updateTooltip.cancellingPleaseWait", "Cancelling update, please wait..."));
  }
  renderTitleAndInfo(title, update) {
    this.titleNode.textContent = title;
    const version = update?.productVersion;
    if (version) {
      const updateCommitId = update.version?.substring(0, 7);
      this.latestVersionNode.textContent = updateCommitId ? localize("updateTooltip.latestVersionLabelWithCommit", "Latest Version: {0} ({1})", version, updateCommitId) : localize("updateTooltip.latestVersionLabel", "Latest Version: {0}", version);
      this.latestVersionCopyValue.value = updateCommitId ? `${version} (${update.version})` : version;
      this.latestVersionNode.parentElement.style.display = "";
    } else {
      this.latestVersionNode.parentElement.style.display = "none";
    }
    const releaseDate = update?.timestamp ?? tryParseDate(this.productService.date);
    if (typeof releaseDate === "number" && releaseDate > 0) {
      this.releaseDateNode.textContent = localize("updateTooltip.releasedLabel", "Released {0}", formatDate(releaseDate));
      this.releaseDateNode.style.display = "";
    } else {
      this.releaseDateNode.style.display = "none";
    }
    this.releaseNotesVersion = version ?? this.productService.version;
    this.releaseNotesButton.style.display = this.releaseNotesVersion ? "" : "none";
    this.releaseNotesButton.style.marginRight = this.releaseNotesVersion ? "auto" : "";
    this.buttonBar.style.display = this.releaseNotesVersion ? "" : "none";
  }
  renderActionButton(label, commandId) {
    this.actionButton.textContent = label;
    this.actionButton.dataset.commandId = commandId;
    this.actionButton.style.display = "";
  }
  renderMessage(message, icon) {
    dom.clearNode(this.messageNode);
    if (icon) {
      const iconNode = dom.append(this.messageNode, dom.$(".state-message-icon"));
      iconNode.classList.add(...ThemeIcon.asClassNameArray(icon));
    }
    dom.append(this.messageNode, document.createTextNode(message));
    this.messageNode.style.display = "";
  }
  createVersionRow(parent) {
    const row = dom.append(parent, dom.$(".product-version"));
    const label = dom.append(row, dom.$("span"));
    const copyValue = { value: "" };
    const copyButton = dom.append(row, dom.$("a.copy-version-button"));
    copyButton.setAttribute("role", "button");
    copyButton.setAttribute("tabindex", "0");
    const title = localize("updateTooltip.copyVersion", "Copy");
    copyButton.title = title;
    copyButton.setAttribute("aria-label", title);
    const copyIcon = dom.append(copyButton, dom.$(".copy-icon"));
    copyIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.copy));
    this._register(dom.addDisposableListener(copyButton, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (copyValue.value) {
        this.clipboardService.writeText(copyValue.value);
      }
    }));
    return { label, copyValue };
  }
  runCommandAndClose(command, ...args) {
    this.commandService.executeCommand(command, ...args);
    this.hoverService.hideHover(true);
  }
};
UpdateTooltip = __decorateClass([
  __decorateParam(0, IClipboardService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IMeteredConnectionService),
  __decorateParam(5, IProductService)
], UpdateTooltip);
export {
  UpdateTooltip
};
