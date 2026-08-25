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
import { $, isHTMLInputElement, isHTMLTextAreaElement, reset } from "../../../../base/browser/dom.js";
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { Button, ButtonWithDropdown, unthemedButtonStyles } from "../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Delayer, RunOnceScheduler } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { groupBy } from "../../../../base/common/collections.js";
import { debounce } from "../../../../base/common/decorators.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isLinuxSnap, isMacintosh } from "../../../../base/common/platform.js";
import { joinPath } from "../../../../base/common/resources.js";
import { escape } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { Action } from "../../../../base/common/actions.js";
import { localize } from "../../../../nls.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { getIconsStyleSheet } from "../../../../platform/theme/browser/iconsStyleSheet.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IIssueFormService, IssueType } from "../common/issue.js";
import { normalizeGitHubUrl } from "../common/issueReporterUtil.js";
import { IssueReporterModel } from "./issueReporterModel.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
const MAX_URL_LENGTH = 7500;
const MAX_EXTENSION_DATA_LENGTH = 6e4;
var IssueSource = /* @__PURE__ */ ((IssueSource2) => {
  IssueSource2["VSCode"] = "vscode";
  IssueSource2["Extension"] = "extension";
  IssueSource2["Marketplace"] = "marketplace";
  IssueSource2["Unknown"] = "unknown";
  return IssueSource2;
})(IssueSource || {});
let BaseIssueReporterService = class extends Disposable {
  constructor(disableExtensions, data, os, product, window, isWeb, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService) {
    super();
    this.disableExtensions = disableExtensions;
    this.data = data;
    this.os = os;
    this.product = product;
    this.window = window;
    this.isWeb = isWeb;
    this.issueFormService = issueFormService;
    this.themeService = themeService;
    this.fileService = fileService;
    this.fileDialogService = fileDialogService;
    this.contextMenuService = contextMenuService;
    this.authenticationService = authenticationService;
    this.openerService = openerService;
    this.receivedSystemInfo = false;
    this.numberOfSearchResultsDisplayed = 0;
    this.receivedPerformanceInfo = false;
    this.shouldQueueSearch = false;
    this.hasBeenSubmitted = false;
    this.openReporter = false;
    this.loadingExtensionData = false;
    this.selectedExtension = "";
    this.delayedSubmit = new Delayer(300);
    this.nonGitHubIssueUrl = false;
    this.needsUpdate = false;
    this.acknowledged = false;
    const targetExtension = data.extensionId ? data.enabledExtensions.find((extension) => extension.id.toLocaleLowerCase() === data.extensionId?.toLocaleLowerCase()) : void 0;
    this.issueReporterModel = new IssueReporterModel({
      ...data,
      issueType: data.issueType || IssueType.Bug,
      versionInfo: {
        vscodeVersion: `${product.nameShort} ${!!product.darwinUniversalAssetId ? `${product.version} (Universal)` : product.version} (${product.commit || "Commit unknown"}, ${product.date || "Date unknown"})`,
        os: `${this.os.type} ${this.os.arch} ${this.os.release}${isLinuxSnap ? " snap" : ""}`
      },
      extensionsDisabled: !!this.disableExtensions,
      fileOnExtension: data.extensionId ? !targetExtension?.isBuiltin : void 0,
      selectedExtension: targetExtension
    });
    this._register(this.authenticationService.onDidChangeSessions(async () => {
      const previousAuthState = !!this.data.githubAccessToken;
      let githubAccessToken = "";
      try {
        const githubSessions = await this.authenticationService.getSessions("github");
        const potentialSessions = githubSessions.filter((session) => session.scopes.includes("repo"));
        githubAccessToken = potentialSessions[0]?.accessToken;
      } catch (e) {
      }
      this.data.githubAccessToken = githubAccessToken;
      const currentAuthState = !!githubAccessToken;
      if (previousAuthState !== currentAuthState) {
        this.updateButtonStates();
      }
    }));
    const fileOnMarketplace = data.issueSource === "marketplace" /* Marketplace */;
    const fileOnProduct = data.issueSource === "vscode" /* VSCode */;
    this.issueReporterModel.update({ fileOnMarketplace, fileOnProduct });
    this.createAction = this._register(new Action("issueReporter.create", localize("create", "Create on GitHub"), void 0, true, async () => {
      this.delayedSubmit.trigger(async () => {
        this.setSubmittingState(true);
        try {
          await this.createIssue(true);
        } finally {
          this.setSubmittingState(false);
        }
      });
    }));
    this.previewAction = this._register(new Action("issueReporter.preview", localize("preview", "Preview on GitHub"), void 0, true, async () => {
      this.delayedSubmit.trigger(async () => {
        this.setSubmittingState(true);
        try {
          await this.createIssue(false);
        } finally {
          this.setSubmittingState(false);
        }
      });
    }));
    this.privateAction = this._register(new Action("issueReporter.privateCreate", localize("privateCreate", "Create Internally"), void 0, true, async () => {
      this.delayedSubmit.trigger(async () => {
        this.setSubmittingState(true);
        try {
          await this.createIssue(true, true);
        } finally {
          this.setSubmittingState(false);
        }
      });
    }));
    const issueTitle = data.issueTitle;
    if (issueTitle) {
      const issueTitleElement = this.getElementById("issue-title");
      if (issueTitleElement) {
        issueTitleElement.value = issueTitle;
      }
    }
    const issueBody = data.issueBody;
    if (issueBody) {
      const description = this.getElementById("description");
      if (description) {
        description.value = issueBody;
        this.issueReporterModel.update({ issueDescription: issueBody });
      }
    }
    if (this.window.document.documentElement.lang !== "en") {
      show(this.getElementById("english"));
    }
    const codiconStyleSheet = createStyleSheet();
    codiconStyleSheet.id = "codiconStyles";
    const iconsStyleSheet = this._register(getIconsStyleSheet(this.themeService));
    function updateAll() {
      codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
    }
    const delayer = new RunOnceScheduler(updateAll, 0);
    this._register(iconsStyleSheet.onDidChange(() => delayer.schedule()));
    delayer.schedule();
    this.handleExtensionData(data.enabledExtensions);
    this.setUpTypes();
    if ((data.data || data.uri) && targetExtension) {
      this.updateExtensionStatus(targetExtension);
    }
    const issueReporterElement = this.getElementById("issue-reporter");
    if (issueReporterElement) {
      this.updateButtonStates();
    }
  }
  render() {
    this.renderBlocks();
  }
  setInitialFocus() {
    const { fileOnExtension } = this.issueReporterModel.getData();
    if (fileOnExtension) {
      const issueTitle = this.window.document.getElementById("issue-title");
      issueTitle?.focus();
    } else {
      const issueType = this.window.document.getElementById("issue-type");
      issueType?.focus();
    }
  }
  updateButtonStates() {
    const issueReporterElement = this.getElementById("issue-reporter");
    if (!issueReporterElement) {
      return;
    }
    let publicElements = this.getElementById("public-elements");
    if (!publicElements) {
      publicElements = document.createElement("div");
      publicElements.id = "public-elements";
      publicElements.classList.add("public-elements");
      issueReporterElement.appendChild(publicElements);
    }
    this.updatePublicGithubButton(publicElements);
    this.updatePublicRepoLink(publicElements);
    let internalElements = this.getElementById("internal-elements");
    if (!internalElements) {
      internalElements = document.createElement("div");
      internalElements.id = "internal-elements";
      internalElements.classList.add("internal-elements");
      internalElements.classList.add("hidden");
      issueReporterElement.appendChild(internalElements);
    }
    let filingRow = this.getElementById("internal-top-row");
    if (!filingRow) {
      filingRow = document.createElement("div");
      filingRow.id = "internal-top-row";
      filingRow.classList.add("internal-top-row");
      internalElements.appendChild(filingRow);
    }
    this.updateInternalFilingNote(filingRow);
    this.updateInternalGithubButton(filingRow);
    this.updateInternalElementsVisibility();
  }
  updateInternalFilingNote(container) {
    let filingNote = this.getElementById("internal-preview-message");
    if (!filingNote) {
      filingNote = document.createElement("span");
      filingNote.id = "internal-preview-message";
      filingNote.classList.add("internal-preview-message");
      container.appendChild(filingNote);
    }
    filingNote.textContent = escape(localize("internalPreviewMessage", "If your copilot debug logs contain private information:"));
  }
  updatePublicGithubButton(container) {
    const issueReporterElement = this.getElementById("issue-reporter");
    if (!issueReporterElement) {
      return;
    }
    if (this.publicGithubButton) {
      this.publicGithubButton.dispose();
    }
    if (!this.acknowledged && this.needsUpdate) {
      this.publicGithubButton = this._register(new Button(container, unthemedButtonStyles));
      this.publicGithubButton.label = localize("acknowledge", "Confirm Version Acknowledgement");
      this.publicGithubButton.enabled = false;
    } else if (this.data.githubAccessToken && this.isPreviewEnabled()) {
      this.publicGithubButton = this._register(new ButtonWithDropdown(container, {
        contextMenuProvider: this.contextMenuService,
        actions: [this.previewAction],
        addPrimaryActionToDropdown: false,
        ...unthemedButtonStyles
      }));
      this._register(this.publicGithubButton.onDidClick(() => {
        this.createAction.run();
      }));
      this.publicGithubButton.label = localize("createOnGitHub", "Create on GitHub");
      this.publicGithubButton.enabled = true;
    } else if (this.data.githubAccessToken && !this.isPreviewEnabled()) {
      this.publicGithubButton = this._register(new Button(container, unthemedButtonStyles));
      this._register(this.publicGithubButton.onDidClick(() => {
        this.createAction.run();
      }));
      this.publicGithubButton.label = localize("createOnGitHub", "Create on GitHub");
      this.publicGithubButton.enabled = true;
    } else {
      this.publicGithubButton = this._register(new Button(container, unthemedButtonStyles));
      this._register(this.publicGithubButton.onDidClick(() => {
        this.previewAction.run();
      }));
      this.publicGithubButton.label = localize("previewOnGitHub", "Preview on GitHub");
      this.publicGithubButton.enabled = true;
    }
    const repoLink = this.getElementById("show-repo-name");
    if (repoLink) {
      container.insertBefore(this.publicGithubButton.element, repoLink);
    }
  }
  updatePublicRepoLink(container) {
    let issueRepoName = this.getElementById("show-repo-name");
    if (!issueRepoName) {
      issueRepoName = document.createElement("a");
      issueRepoName.id = "show-repo-name";
      issueRepoName.classList.add("hidden");
      container.appendChild(issueRepoName);
    }
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    if (selectedExtension && selectedExtension.uri) {
      const urlString = URI.revive(selectedExtension.uri).toString();
      issueRepoName.href = urlString;
      issueRepoName.addEventListener("click", (e) => this.openLink(e));
      issueRepoName.addEventListener("auxclick", (e) => this.openLink(e));
      const gitHubInfo = this.parseGitHubUrl(urlString);
      issueRepoName.textContent = gitHubInfo ? gitHubInfo.owner + "/" + gitHubInfo.repositoryName : urlString;
      Object.assign(issueRepoName.style, {
        alignSelf: "flex-end",
        display: "block",
        fontSize: "13px",
        padding: "4px 0px",
        textDecoration: "none",
        width: "auto"
      });
      show(issueRepoName);
    } else if (issueRepoName) {
      issueRepoName.removeAttribute("style");
      hide(issueRepoName);
    }
  }
  updateInternalGithubButton(container) {
    const issueReporterElement = this.getElementById("issue-reporter");
    if (!issueReporterElement) {
      return;
    }
    if (this.internalGithubButton) {
      this.internalGithubButton.dispose();
    }
    if (this.data.githubAccessToken && this.data.privateUri) {
      this.internalGithubButton = this._register(new Button(container, unthemedButtonStyles));
      this._register(this.internalGithubButton.onDidClick(() => {
        this.privateAction.run();
      }));
      this.internalGithubButton.element.id = "internal-create-btn";
      this.internalGithubButton.element.classList.add("internal-create-subtle");
      this.internalGithubButton.label = localize("createInternally", "Create Internally");
      this.internalGithubButton.enabled = true;
      this.internalGithubButton.setTitle(this.data.privateUri.path.slice(1));
    }
  }
  updateInternalElementsVisibility() {
    const container = this.getElementById("internal-elements");
    if (!container) {
      return;
    }
    if (this.data.githubAccessToken && this.data.privateUri) {
      show(container);
      container.style.display = "";
      if (this.internalGithubButton) {
        this.internalGithubButton.enabled = this.publicGithubButton?.enabled ?? false;
      }
    } else {
      hide(container);
      container.style.display = "none";
    }
  }
  getSubmitButtonElement() {
    if (this.publicGithubButton instanceof ButtonWithDropdown) {
      return this.publicGithubButton.primaryButton.element;
    }
    return this.publicGithubButton.element;
  }
  setSubmittingState(submitting) {
    this.publicGithubButton.enabled = !submitting;
    if (this.internalGithubButton) {
      this.internalGithubButton.enabled = !submitting;
    }
    const buttonEl = this.getSubmitButtonElement();
    if (submitting) {
      const currentLabel = this.publicGithubButton instanceof ButtonWithDropdown ? this.publicGithubButton.primaryButton.label : this.publicGithubButton.label;
      this.preSubmitButtonLabel = typeof currentLabel === "string" ? currentLabel : "";
      this.publicGithubButton.label = localize("submittingIssue", "Submitting...");
      const spinnerIcon = renderIcon(ThemeIcon.modify(Codicon.loading, "spin"));
      buttonEl.prepend(spinnerIcon);
    } else {
      const spinnerEl = buttonEl.querySelector(".codicon-loading");
      spinnerEl?.remove();
      if (this.preSubmitButtonLabel !== void 0) {
        this.publicGithubButton.label = this.preSubmitButtonLabel;
        this.preSubmitButtonLabel = void 0;
      }
    }
  }
  async updateIssueReporterUri(extension) {
    try {
      if (extension.uri) {
        const uri = URI.revive(extension.uri);
        extension.bugsUrl = uri.toString();
      }
    } catch (e) {
      this.renderBlocks();
    }
  }
  handleExtensionData(extensions) {
    const installedExtensions = extensions.filter((x) => !x.isBuiltin);
    const { nonThemes, themes } = groupBy(installedExtensions, (ext) => {
      return ext.isTheme ? "themes" : "nonThemes";
    });
    const numberOfThemeExtesions = (themes && themes.length) ?? 0;
    this.issueReporterModel.update({ numberOfThemeExtesions, enabledNonThemeExtesions: nonThemes, allExtensions: installedExtensions });
    this.updateExtensionTable(nonThemes ?? [], numberOfThemeExtesions);
    if (this.disableExtensions || installedExtensions.length === 0) {
      this.getElementById("disableExtensions").disabled = true;
    }
    this.updateExtensionSelector(installedExtensions);
  }
  updateExtensionSelector(extensions) {
    const extensionOptions = extensions.map((extension) => {
      return {
        name: extension.displayName || extension.name || "",
        id: extension.id
      };
    });
    extensionOptions.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName > bName) {
        return 1;
      }
      if (aName < bName) {
        return -1;
      }
      return 0;
    });
    const makeOption = (extension, selectedExtension) => {
      const selected = selectedExtension && extension.id === selectedExtension.id;
      return $("option", {
        "value": extension.id,
        "selected": selected || ""
      }, extension.name);
    };
    const extensionsSelector = this.getElementById("extension-selector");
    if (extensionsSelector) {
      const { selectedExtension } = this.issueReporterModel.getData();
      reset(extensionsSelector, this.makeOption("", localize("selectExtension", "Select extension"), true), ...extensionOptions.map((extension) => makeOption(extension, selectedExtension)));
      if (!selectedExtension) {
        extensionsSelector.selectedIndex = 0;
      }
      this.addEventListener("extension-selector", "change", async (e) => {
        this.clearExtensionData();
        const selectedExtensionId = e.target.value;
        this.selectedExtension = selectedExtensionId;
        const extensions2 = this.issueReporterModel.getData().allExtensions;
        const matches = extensions2.filter((extension) => extension.id === selectedExtensionId);
        if (matches.length) {
          this.issueReporterModel.update({ selectedExtension: matches[0] });
          const selectedExtension2 = this.issueReporterModel.getData().selectedExtension;
          if (selectedExtension2) {
            const iconElement = document.createElement("span");
            iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
            this.setLoading(iconElement);
            const openReporterData = await this.sendReporterMenu(selectedExtension2);
            if (openReporterData) {
              if (this.selectedExtension === selectedExtensionId) {
                this.removeLoading(iconElement, true);
                this.data = openReporterData;
              }
            } else {
              if (!this.loadingExtensionData) {
                iconElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
              }
              this.removeLoading(iconElement);
              this.clearExtensionData();
              selectedExtension2.data = void 0;
              selectedExtension2.uri = void 0;
            }
            if (this.selectedExtension === selectedExtensionId) {
              this.updateExtensionStatus(matches[0]);
              this.openReporter = false;
            }
          } else {
            this.issueReporterModel.update({ selectedExtension: void 0 });
            this.clearSearchResults();
            this.clearExtensionData();
            this.validateSelectedExtension();
            this.updateExtensionStatus(matches[0]);
          }
        }
        this.updateInternalElementsVisibility();
      });
    }
    this.addEventListener("problem-source", "change", (_) => {
      this.clearExtensionData();
      this.validateSelectedExtension();
    });
  }
  async sendReporterMenu(extension) {
    try {
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("sendReporterMenu timed out")), 1e4)
      );
      const data = await Promise.race([
        this.issueFormService.sendReporterMenu(extension.id),
        timeoutPromise
      ]);
      return data;
    } catch (e) {
      console.error(e);
      return void 0;
    }
  }
  updateAcknowledgementState() {
    const acknowledgementCheckbox = this.getElementById("includeAcknowledgement");
    if (acknowledgementCheckbox) {
      this.acknowledged = acknowledgementCheckbox.checked;
      this.updateButtonStates();
    }
  }
  setEventHandlers() {
    ["includeSystemInfo", "includeProcessInfo", "includeWorkspaceInfo", "includeExtensions", "includeExperiments", "includeExtensionData"].forEach((elementId) => {
      this.addEventListener(elementId, "click", (event) => {
        event.stopPropagation();
        this.issueReporterModel.update({ [elementId]: !this.issueReporterModel.getData()[elementId] });
      });
    });
    this.addEventListener("includeAcknowledgement", "click", (event) => {
      event.stopPropagation();
      this.updateAcknowledgementState();
    });
    const showInfoElements = this.window.document.getElementsByClassName("showInfo");
    for (let i = 0; i < showInfoElements.length; i++) {
      const showInfo = showInfoElements.item(i);
      showInfo.addEventListener("click", (e) => {
        e.preventDefault();
        const label = e.target;
        if (label) {
          const containingElement = label.parentElement && label.parentElement.parentElement;
          const info = containingElement && containingElement.lastElementChild;
          if (info && info.classList.contains("hidden")) {
            show(info);
            label.textContent = localize("hide", "hide");
          } else {
            hide(info);
            label.textContent = localize("show", "show");
          }
        }
      });
    }
    this.addEventListener("issue-source", "change", (e) => {
      const value = e.target.value;
      const problemSourceHelpText = this.getElementById("problem-source-help-text");
      if (value === "") {
        this.issueReporterModel.update({ fileOnExtension: void 0 });
        show(problemSourceHelpText);
        this.clearSearchResults();
        this.render();
        return;
      } else {
        hide(problemSourceHelpText);
      }
      const descriptionTextArea = this.getElementById("issue-title");
      if (value === "vscode" /* VSCode */) {
        descriptionTextArea.placeholder = localize("vscodePlaceholder", "E.g Workbench is missing problems panel");
      } else if (value === "extension" /* Extension */) {
        descriptionTextArea.placeholder = localize("extensionPlaceholder", "E.g. Missing alt text on extension readme image");
      } else if (value === "marketplace" /* Marketplace */) {
        descriptionTextArea.placeholder = localize("marketplacePlaceholder", "E.g Cannot disable installed extension");
      } else {
        descriptionTextArea.placeholder = localize("undefinedPlaceholder", "Please enter a title");
      }
      let fileOnExtension, fileOnMarketplace, fileOnProduct = false;
      if (value === "extension" /* Extension */) {
        fileOnExtension = true;
      } else if (value === "marketplace" /* Marketplace */) {
        fileOnMarketplace = true;
      } else if (value === "vscode" /* VSCode */) {
        fileOnProduct = true;
      }
      this.issueReporterModel.update({ fileOnExtension, fileOnMarketplace, fileOnProduct });
      this.render();
      const title = this.getElementById("issue-title").value;
      this.searchIssues(title, fileOnExtension, fileOnMarketplace);
    });
    this.addEventListener("description", "input", (e) => {
      const issueDescription = e.target.value;
      this.issueReporterModel.update({ issueDescription });
      if (this.issueReporterModel.fileOnExtension() === false) {
        const title = this.getElementById("issue-title").value;
        this.searchVSCodeIssues(title, issueDescription);
      }
    });
    this.addEventListener("issue-title", "input", (_) => {
      const titleElement = this.getElementById("issue-title");
      if (titleElement) {
        const title = titleElement.value;
        this.issueReporterModel.update({ issueTitle: title });
      }
    });
    this.addEventListener("issue-title", "input", (e) => {
      const title = e.target.value;
      const lengthValidationMessage = this.getElementById("issue-title-length-validation-error");
      const issueUrl = this.getIssueUrl();
      if (title && this.getIssueUrlWithTitle(title, issueUrl).length > MAX_URL_LENGTH) {
        show(lengthValidationMessage);
      } else {
        hide(lengthValidationMessage);
      }
      const issueSource = this.getElementById("issue-source");
      if (!issueSource || issueSource.value === "") {
        return;
      }
      const { fileOnExtension, fileOnMarketplace } = this.issueReporterModel.getData();
      this.searchIssues(title, fileOnExtension, fileOnMarketplace);
    });
    this.addEventListener("disableExtensions", "click", () => {
      this.issueFormService.reloadWithExtensionsDisabled();
    });
    this.addEventListener("extensionBugsLink", "click", (e) => {
      const url = e.target.innerText;
      this.openLink(url);
    });
    this.addEventListener("disableExtensions", "keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " ") {
        this.issueFormService.reloadWithExtensionsDisabled();
      }
    });
    this.window.document.onkeydown = async (e) => {
      const cmdOrCtrlKey = isMacintosh ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrlKey && e.key === "Enter") {
        this.delayedSubmit.trigger(async () => {
          this.setSubmittingState(true);
          try {
            if (await this.createIssue()) {
              this.close();
            }
          } finally {
            this.setSubmittingState(false);
          }
        });
      }
      if (cmdOrCtrlKey && e.key === "w") {
        e.stopPropagation();
        e.preventDefault();
        const issueTitle = this.getElementById("issue-title").value;
        const { issueDescription } = this.issueReporterModel.getData();
        if (!this.hasBeenSubmitted && (issueTitle || issueDescription)) {
          this.issueFormService.showConfirmCloseDialog();
        } else {
          this.close();
        }
      }
      if (isMacintosh) {
        if (cmdOrCtrlKey && e.key === "a" && e.target) {
          if (isHTMLInputElement(e.target) || isHTMLTextAreaElement(e.target)) {
            e.target.select();
          }
        }
      }
    };
    this.addEventListener("review-guidance-help-text", "click", (e) => {
      const target = e.target;
      if (target.tagName === "A" && target.getAttribute("target") === "_blank") {
        this.openLink(e);
      }
    });
  }
  updatePerformanceInfo(info) {
    this.issueReporterModel.update(info);
    this.receivedPerformanceInfo = true;
    const state = this.issueReporterModel.getData();
    this.updateProcessInfo(state);
    this.updateWorkspaceInfo(state);
    this.updateButtonStates();
  }
  isPreviewEnabled() {
    const issueType = this.issueReporterModel.getData().issueType;
    if (this.loadingExtensionData) {
      return false;
    }
    if (this.isWeb) {
      if (issueType === IssueType.FeatureRequest || issueType === IssueType.PerformanceIssue || issueType === IssueType.Bug) {
        return true;
      }
    } else {
      if (issueType === IssueType.Bug && this.receivedSystemInfo) {
        return true;
      }
      if (issueType === IssueType.PerformanceIssue && this.receivedSystemInfo && this.receivedPerformanceInfo) {
        return true;
      }
      if (issueType === IssueType.FeatureRequest) {
        return true;
      }
    }
    return false;
  }
  getExtensionRepositoryUrl() {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    return selectedExtension && selectedExtension.repositoryUrl;
  }
  getExtensionBugsUrl() {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    return selectedExtension && selectedExtension.bugsUrl;
  }
  searchVSCodeIssues(title, issueDescription) {
    if (title) {
      this.searchDuplicates(title, issueDescription);
    } else {
      this.clearSearchResults();
    }
  }
  searchIssues(title, fileOnExtension, fileOnMarketplace) {
    if (fileOnExtension) {
      return this.searchExtensionIssues(title);
    }
    if (fileOnMarketplace) {
      return this.searchMarketplaceIssues(title);
    }
    const description = this.issueReporterModel.getData().issueDescription;
    this.searchVSCodeIssues(title, description);
  }
  searchExtensionIssues(title) {
    const url = this.getExtensionGitHubUrl();
    if (title) {
      const matches = /^https?:\/\/github\.com\/(.*)/.exec(url);
      if (matches && matches.length) {
        const repo = matches[1];
        return this.searchGitHub(repo, title);
      }
      if (this.issueReporterModel.getData().selectedExtension) {
        this.clearSearchResults();
        return this.displaySearchResults([]);
      }
    }
    this.clearSearchResults();
  }
  searchMarketplaceIssues(title) {
    if (title) {
      const gitHubInfo = this.parseGitHubUrl(this.product.reportMarketplaceIssueUrl);
      if (gitHubInfo) {
        return this.searchGitHub(`${gitHubInfo.owner}/${gitHubInfo.repositoryName}`, title);
      }
    }
  }
  async close() {
    await this.issueFormService.closeReporter();
  }
  clearSearchResults() {
    const similarIssues = this.getElementById("similar-issues");
    similarIssues.innerText = "";
    this.numberOfSearchResultsDisplayed = 0;
  }
  searchGitHub(repo, title) {
    const query = `is:issue+repo:${repo}+${title}`;
    const similarIssues = this.getElementById("similar-issues");
    fetch(`https://api.github.com/search/issues?q=${query}`).then((response) => {
      response.json().then((result) => {
        similarIssues.innerText = "";
        if (result && result.items) {
          this.displaySearchResults(result.items);
        }
      }).catch((_) => {
        console.warn("Timeout or query limit exceeded");
      });
    }).catch((_) => {
      console.warn("Error fetching GitHub issues");
    });
  }
  searchDuplicates(title, body) {
    const url = "https://vscode-probot.westus.cloudapp.azure.com:7890/duplicate_candidates";
    const init = {
      method: "POST",
      body: JSON.stringify({
        title,
        body
      }),
      headers: new Headers({
        "Content-Type": "application/json"
      })
    };
    fetch(url, init).then((response) => {
      response.json().then((result) => {
        this.clearSearchResults();
        if (result && result.candidates) {
          this.displaySearchResults(result.candidates);
        } else {
          throw new Error("Unexpected response, no candidates property");
        }
      }).catch((_) => {
      });
    }).catch((_) => {
    });
  }
  displaySearchResults(results) {
    const similarIssues = this.getElementById("similar-issues");
    if (results.length) {
      const issues = $("div.issues-container");
      const issuesText = $("div.list-title");
      issuesText.textContent = localize("similarIssues", "Similar issues");
      this.numberOfSearchResultsDisplayed = results.length < 5 ? results.length : 5;
      for (let i = 0; i < this.numberOfSearchResultsDisplayed; i++) {
        const issue = results[i];
        const link = $("a.issue-link", { href: issue.html_url });
        link.textContent = issue.title;
        link.title = issue.title;
        link.addEventListener("click", (e) => this.openLink(e));
        link.addEventListener("auxclick", (e) => this.openLink(e));
        let issueState;
        let item;
        if (issue.state) {
          issueState = $("span.issue-state");
          const issueIcon = $("span.issue-icon");
          issueIcon.appendChild(renderIcon(issue.state === "open" ? Codicon.issueOpened : Codicon.issueClosed));
          const issueStateLabel = $("span.issue-state.label");
          issueStateLabel.textContent = issue.state === "open" ? localize("open", "Open") : localize("closed", "Closed");
          issueState.title = issue.state === "open" ? localize("open", "Open") : localize("closed", "Closed");
          issueState.appendChild(issueIcon);
          issueState.appendChild(issueStateLabel);
          item = $("div.issue", void 0, issueState, link);
        } else {
          item = $("div.issue", void 0, link);
        }
        issues.appendChild(item);
      }
      similarIssues.appendChild(issuesText);
      similarIssues.appendChild(issues);
    }
  }
  setUpTypes() {
    const makeOption = (issueType2, description) => $("option", { "value": issueType2.valueOf() }, escape(description));
    const typeSelect = this.getElementById("issue-type");
    const { issueType } = this.issueReporterModel.getData();
    reset(
      typeSelect,
      makeOption(IssueType.Bug, localize("bugReporter", "Bug Report")),
      makeOption(IssueType.FeatureRequest, localize("featureRequest", "Feature Request")),
      makeOption(IssueType.PerformanceIssue, localize("performanceIssue", "Performance Issue (freeze, slow, crash)"))
    );
    typeSelect.value = issueType.toString();
    this.setSourceOptions();
  }
  makeOption(value, description, disabled) {
    const option = document.createElement("option");
    option.disabled = disabled;
    option.value = value;
    option.textContent = description;
    return option;
  }
  setSourceOptions() {
    const sourceSelect = this.getElementById("issue-source");
    const { issueType, fileOnExtension, selectedExtension, fileOnMarketplace, fileOnProduct } = this.issueReporterModel.getData();
    let selected = sourceSelect.selectedIndex;
    if (selected === -1) {
      if (fileOnExtension !== void 0) {
        selected = fileOnExtension ? 2 : 1;
      } else if (selectedExtension?.isBuiltin) {
        selected = 1;
      } else if (fileOnMarketplace) {
        selected = 3;
      } else if (fileOnProduct) {
        selected = 1;
      }
    }
    sourceSelect.innerText = "";
    sourceSelect.append(this.makeOption("", localize("selectSource", "Select source"), true));
    sourceSelect.append(this.makeOption("vscode" /* VSCode */, localize("vscode", "Visual Studio Code"), false));
    sourceSelect.append(this.makeOption("extension" /* Extension */, localize("extension", "A VS Code extension"), false));
    if (this.product.reportMarketplaceIssueUrl) {
      sourceSelect.append(this.makeOption("marketplace" /* Marketplace */, localize("marketplace", "Extensions Marketplace"), false));
    }
    if (issueType !== IssueType.FeatureRequest) {
      sourceSelect.append(this.makeOption("unknown" /* Unknown */, localize("unknown", "Don't know"), false));
    }
    if (selected !== -1 && selected < sourceSelect.options.length) {
      sourceSelect.selectedIndex = selected;
    } else {
      sourceSelect.selectedIndex = 0;
      hide(this.getElementById("problem-source-help-text"));
    }
  }
  async renderBlocks() {
    const { issueType, fileOnExtension, fileOnMarketplace, selectedExtension } = this.issueReporterModel.getData();
    const blockContainer = this.getElementById("block-container");
    const systemBlock = this.window.document.querySelector(".block-system");
    const processBlock = this.window.document.querySelector(".block-process");
    const workspaceBlock = this.window.document.querySelector(".block-workspace");
    const extensionsBlock = this.window.document.querySelector(".block-extensions");
    const experimentsBlock = this.window.document.querySelector(".block-experiments");
    const extensionDataBlock = this.window.document.querySelector(".block-extension-data");
    const problemSource = this.getElementById("problem-source");
    const descriptionTitle = this.getElementById("issue-description-label");
    const descriptionSubtitle = this.getElementById("issue-description-subtitle");
    const extensionSelector = this.getElementById("extension-selection");
    const downloadExtensionDataLink = this.getElementById("extension-data-download");
    const titleTextArea = this.getElementById("issue-title-container");
    const descriptionTextArea = this.getElementById("description");
    const extensionDataTextArea = this.getElementById("extension-data");
    hide(blockContainer);
    hide(systemBlock);
    hide(processBlock);
    hide(workspaceBlock);
    hide(extensionsBlock);
    hide(experimentsBlock);
    hide(extensionSelector);
    hide(extensionDataTextArea);
    hide(extensionDataBlock);
    hide(downloadExtensionDataLink);
    show(problemSource);
    show(titleTextArea);
    show(descriptionTextArea);
    if (fileOnExtension) {
      show(extensionSelector);
    }
    const extensionData = this.issueReporterModel.getData().extensionData;
    if (extensionData && extensionData.length > MAX_EXTENSION_DATA_LENGTH) {
      show(downloadExtensionDataLink);
      const date = /* @__PURE__ */ new Date();
      const formattedDate = date.toISOString().split("T")[0];
      const formattedTime = date.toTimeString().split(" ")[0].replace(/:/g, "-");
      const fileName = `extensionData_${formattedDate}_${formattedTime}.md`;
      const handleLinkClick = async () => {
        const downloadPath = await this.fileDialogService.showSaveDialog({
          title: localize("saveExtensionData", "Save Extension Data"),
          availableFileSystems: [Schemas.file],
          defaultUri: joinPath(await this.fileDialogService.defaultFilePath(Schemas.file), fileName)
        });
        if (downloadPath) {
          await this.fileService.writeFile(downloadPath, VSBuffer.fromString(extensionData));
        }
      };
      downloadExtensionDataLink.addEventListener("click", handleLinkClick);
      this._register({
        dispose: () => downloadExtensionDataLink.removeEventListener("click", handleLinkClick)
      });
    }
    if (selectedExtension && this.nonGitHubIssueUrl) {
      hide(titleTextArea);
      hide(descriptionTextArea);
      reset(descriptionTitle, localize("handlesIssuesElsewhere", "This extension handles issues outside of VS Code"));
      reset(descriptionSubtitle, localize("elsewhereDescription", "The '{0}' extension prefers to use an external issue reporter. To be taken to that issue reporting experience, click the button below.", selectedExtension.displayName));
      this.publicGithubButton.label = localize("openIssueReporter", "Open External Issue Reporter");
      return;
    }
    if (fileOnExtension && selectedExtension?.data) {
      const data = selectedExtension?.data;
      extensionDataTextArea.innerText = data.toString();
      extensionDataTextArea.readOnly = true;
      show(extensionDataBlock);
    }
    if (fileOnExtension && this.openReporter) {
      extensionDataTextArea.readOnly = true;
      setTimeout(() => {
        if (this.openReporter) {
          show(extensionDataBlock);
        }
      }, 100);
      show(extensionDataBlock);
    }
    if (issueType === IssueType.Bug) {
      if (!fileOnMarketplace) {
        show(blockContainer);
        show(systemBlock);
        show(experimentsBlock);
        if (!fileOnExtension) {
          show(extensionsBlock);
        }
      }
      reset(descriptionTitle, localize("stepsToReproduce", "Steps to Reproduce") + " ", $("span.required-input", void 0, "*"));
      reset(descriptionSubtitle, localize("bugDescription", "Share the steps needed to reliably reproduce the problem. Please include actual and expected results. We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
    } else if (issueType === IssueType.PerformanceIssue) {
      if (!fileOnMarketplace) {
        show(blockContainer);
        show(systemBlock);
        show(processBlock);
        show(workspaceBlock);
        show(experimentsBlock);
      }
      if (fileOnExtension) {
        show(extensionSelector);
      } else if (!fileOnMarketplace) {
        show(extensionsBlock);
      }
      reset(descriptionTitle, localize("stepsToReproduce", "Steps to Reproduce") + " ", $("span.required-input", void 0, "*"));
      reset(descriptionSubtitle, localize("performanceIssueDesciption", "When did this performance issue happen? Does it occur on startup or after a specific series of actions? We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
    } else if (issueType === IssueType.FeatureRequest) {
      reset(descriptionTitle, localize("description", "Description") + " ", $("span.required-input", void 0, "*"));
      reset(descriptionSubtitle, localize("featureRequestDescription", "Please describe the feature you would like to see. We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
    }
  }
  validateInput(inputId) {
    const inputElement = this.getElementById(inputId);
    const inputValidationMessage = this.getElementById(`${inputId}-empty-error`);
    const descriptionShortMessage = this.getElementById(`description-short-error`);
    if (inputId === "description" && this.nonGitHubIssueUrl && this.data.extensionId) {
      return true;
    } else if (!inputElement.value) {
      inputElement.classList.add("invalid-input");
      inputValidationMessage?.classList.remove("hidden");
      descriptionShortMessage?.classList.add("hidden");
      return false;
    } else if (inputId === "description" && inputElement.value.length < 10) {
      inputElement.classList.add("invalid-input");
      descriptionShortMessage?.classList.remove("hidden");
      inputValidationMessage?.classList.add("hidden");
      return false;
    } else {
      inputElement.classList.remove("invalid-input");
      inputValidationMessage?.classList.add("hidden");
      if (inputId === "description") {
        descriptionShortMessage?.classList.add("hidden");
      }
      return true;
    }
  }
  validateInputs() {
    let isValid = true;
    ["issue-title", "description", "issue-source"].forEach((elementId) => {
      isValid = this.validateInput(elementId) && isValid;
    });
    if (this.issueReporterModel.fileOnExtension()) {
      isValid = this.validateInput("extension-selector") && isValid;
    }
    return isValid;
  }
  async submitToGitHub(issueTitle, issueBody, gitHubDetails) {
    const url = `https://api.github.com/repos/${gitHubDetails.owner}/${gitHubDetails.repositoryName}/issues`;
    const init = {
      method: "POST",
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody
      }),
      headers: new Headers({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.data.githubAccessToken}`,
        "User-Agent": "request"
      })
    };
    const response = await fetch(url, init);
    if (!response.ok) {
      console.error("Invalid GitHub URL provided.");
      return false;
    }
    const result = await response.json();
    await this.openLink(result.html_url);
    this.close();
    return true;
  }
  async createIssue(shouldCreate, privateUri) {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    if (this.nonGitHubIssueUrl) {
      const url2 = this.getExtensionBugsUrl();
      if (url2) {
        this.hasBeenSubmitted = true;
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
        });
      }
      return false;
    }
    this.hasBeenSubmitted = true;
    const issueTitle = this.getElementById("issue-title").value;
    const issueBody = this.issueReporterModel.serialize();
    let issueUrl = privateUri ? this.getPrivateIssueUrl() : this.getIssueUrl();
    if (!issueUrl) {
      console.error(`No ${privateUri ? "private " : ""}issue url found`);
      return false;
    }
    if (selectedExtension?.uri) {
      const uri = URI.revive(selectedExtension.uri);
      issueUrl = uri.toString();
    }
    const gitHubDetails = this.parseGitHubUrl(issueUrl);
    if (this.data.githubAccessToken && gitHubDetails && shouldCreate) {
      return this.submitToGitHub(issueTitle, issueBody, gitHubDetails);
    }
    const baseUrl = this.getIssueUrlWithTitle(this.getElementById("issue-title").value, issueUrl);
    let url = baseUrl + `&body=${encodeURIComponent(issueBody)}`;
    url = this.addTemplateToUrl(url, gitHubDetails?.owner, gitHubDetails?.repositoryName);
    if (url.length > MAX_URL_LENGTH) {
      try {
        url = await this.writeToClipboard(baseUrl, issueBody);
        url = this.addTemplateToUrl(url, gitHubDetails?.owner, gitHubDetails?.repositoryName);
      } catch (_) {
        console.error("Writing to clipboard failed");
        return false;
      }
    }
    await this.openLink(url);
    return true;
  }
  async writeToClipboard(baseUrl, issueBody) {
    const shouldWrite = await this.issueFormService.showClipboardDialog();
    if (!shouldWrite) {
      throw new CancellationError();
    }
    return baseUrl + `&body=${encodeURIComponent(localize("pasteData", "We have written the needed data into your clipboard because it was too large to send. Please paste."))}`;
  }
  addTemplateToUrl(baseUrl, owner, repositoryName) {
    const isVscode = this.issueReporterModel.getData().fileOnProduct;
    const isMicrosoft = owner?.toLowerCase() === "microsoft";
    const needsTemplate = isVscode || isMicrosoft && (repositoryName === "vscode" || repositoryName === "vscode-python");
    if (needsTemplate) {
      try {
        const url = new URL(baseUrl);
        url.searchParams.set("template", "bug_report.md");
        return url.toString();
      } catch {
        return baseUrl + "&template=bug_report.md";
      }
    }
    return baseUrl;
  }
  getIssueUrl() {
    return this.issueReporterModel.fileOnExtension() ? this.getExtensionGitHubUrl() : this.issueReporterModel.getData().fileOnMarketplace ? this.product.reportMarketplaceIssueUrl : this.product.reportIssueUrl;
  }
  // for when command 'workbench.action.openIssueReporter' passes along a
  // `privateUri` UriComponents value
  getPrivateIssueUrl() {
    return URI.revive(this.data.privateUri)?.toString();
  }
  parseGitHubUrl(url) {
    const match = /^https?:\/\/github\.com\/([^\/]*)\/([^\/]*).*/.exec(url);
    if (match && match.length) {
      return {
        owner: match[1],
        repositoryName: match[2]
      };
    } else {
      console.error("No GitHub issues match");
    }
    return void 0;
  }
  getExtensionGitHubUrl() {
    let repositoryUrl = "";
    const bugsUrl = this.getExtensionBugsUrl();
    const extensionUrl = this.getExtensionRepositoryUrl();
    if (bugsUrl && bugsUrl.match(/^https?:\/\/github\.com\/([^\/]*)\/([^\/]*)\/?(\/issues)?$/)) {
      repositoryUrl = normalizeGitHubUrl(bugsUrl);
    } else if (extensionUrl && extensionUrl.match(/^https?:\/\/github\.com\/([^\/]*)\/([^\/]*)$/)) {
      repositoryUrl = normalizeGitHubUrl(extensionUrl);
    } else {
      this.nonGitHubIssueUrl = true;
      repositoryUrl = bugsUrl || extensionUrl || "";
    }
    return repositoryUrl;
  }
  getIssueUrlWithTitle(issueTitle, repositoryUrl) {
    if (this.issueReporterModel.fileOnExtension()) {
      repositoryUrl = repositoryUrl + "/issues/new";
    }
    const queryStringPrefix = repositoryUrl.indexOf("?") === -1 ? "?" : "&";
    return `${repositoryUrl}${queryStringPrefix}title=${encodeURIComponent(issueTitle)}`;
  }
  clearExtensionData() {
    this.nonGitHubIssueUrl = false;
    this.issueReporterModel.update({ extensionData: void 0 });
    this.data.issueBody = this.data.issueBody || "";
    this.data.data = void 0;
    this.data.uri = void 0;
    this.data.privateUri = void 0;
  }
  async updateExtensionStatus(extension) {
    this.issueReporterModel.update({ selectedExtension: extension });
    const template = this.data.issueBody;
    if (template) {
      const descriptionTextArea = this.getElementById("description");
      const descriptionText = descriptionTextArea.value;
      if (descriptionText === "" || !descriptionText.includes(template.toString())) {
        const fullTextArea = descriptionText + (descriptionText === "" ? "" : "\n") + template.toString();
        descriptionTextArea.value = fullTextArea;
        this.issueReporterModel.update({ issueDescription: fullTextArea });
      }
    }
    const data = this.data.data;
    if (data) {
      this.issueReporterModel.update({ extensionData: data });
      extension.data = data;
      const extensionDataBlock = this.window.document.querySelector(".block-extension-data");
      show(extensionDataBlock);
      this.renderBlocks();
    }
    const uri = this.data.uri;
    if (uri) {
      extension.uri = uri;
      this.updateIssueReporterUri(extension);
    }
    this.validateSelectedExtension();
    const title = this.getElementById("issue-title").value;
    this.searchExtensionIssues(title);
    this.updateButtonStates();
    this.renderBlocks();
  }
  validateSelectedExtension() {
    const extensionValidationMessage = this.getElementById("extension-selection-validation-error");
    const extensionValidationNoUrlsMessage = this.getElementById("extension-selection-validation-error-no-url");
    hide(extensionValidationMessage);
    hide(extensionValidationNoUrlsMessage);
    const extension = this.issueReporterModel.getData().selectedExtension;
    if (!extension) {
      this.publicGithubButton.enabled = true;
      return;
    }
    if (this.loadingExtensionData) {
      return;
    }
    const hasValidGitHubUrl = this.getExtensionGitHubUrl();
    if (hasValidGitHubUrl) {
      this.publicGithubButton.enabled = true;
    } else {
      this.setExtensionValidationMessage();
      this.publicGithubButton.enabled = false;
    }
  }
  setLoading(element) {
    this.openReporter = true;
    this.loadingExtensionData = true;
    this.updateButtonStates();
    const extensionDataCaption = this.getElementById("extension-id");
    hide(extensionDataCaption);
    const extensionDataCaption2 = Array.from(this.window.document.querySelectorAll(".ext-parens"));
    extensionDataCaption2.forEach((extensionDataCaption22) => hide(extensionDataCaption22));
    const showLoading = this.getElementById("ext-loading");
    show(showLoading);
    while (showLoading.firstChild) {
      showLoading.firstChild.remove();
    }
    showLoading.append(element);
    this.renderBlocks();
  }
  removeLoading(element, fromReporter = false) {
    this.openReporter = fromReporter;
    this.loadingExtensionData = false;
    this.updateButtonStates();
    const extensionDataCaption = this.getElementById("extension-id");
    show(extensionDataCaption);
    const extensionDataCaption2 = Array.from(this.window.document.querySelectorAll(".ext-parens"));
    extensionDataCaption2.forEach((extensionDataCaption22) => show(extensionDataCaption22));
    const hideLoading = this.getElementById("ext-loading");
    hide(hideLoading);
    if (hideLoading.firstChild) {
      element.remove();
    }
    this.renderBlocks();
  }
  setExtensionValidationMessage() {
    const extensionValidationMessage = this.getElementById("extension-selection-validation-error");
    const extensionValidationNoUrlsMessage = this.getElementById("extension-selection-validation-error-no-url");
    const bugsUrl = this.getExtensionBugsUrl();
    if (bugsUrl) {
      show(extensionValidationMessage);
      const link = this.getElementById("extensionBugsLink");
      link.textContent = bugsUrl;
      return;
    }
    const extensionUrl = this.getExtensionRepositoryUrl();
    if (extensionUrl) {
      show(extensionValidationMessage);
      const link = this.getElementById("extensionBugsLink");
      link.textContent = extensionUrl;
      return;
    }
    show(extensionValidationNoUrlsMessage);
  }
  updateProcessInfo(state) {
    const target = this.window.document.querySelector(".block-process .block-info");
    if (target) {
      reset(target, $("code", void 0, state.processInfo ?? ""));
    }
  }
  updateWorkspaceInfo(state) {
    this.window.document.querySelector(".block-workspace .block-info code").textContent = "\n" + state.workspaceInfo;
  }
  updateExtensionTable(extensions, numThemeExtensions) {
    const target = this.window.document.querySelector(".block-extensions .block-info");
    if (target) {
      if (this.disableExtensions) {
        reset(target, localize("disabledExtensions", "Extensions are disabled"));
        return;
      }
      const themeExclusionStr = numThemeExtensions ? `
(${numThemeExtensions} theme extensions excluded)` : "";
      extensions = extensions || [];
      if (!extensions.length) {
        target.innerText = "Extensions: none" + themeExclusionStr;
        return;
      }
      reset(target, this.getExtensionTableHtml(extensions), document.createTextNode(themeExclusionStr));
    }
  }
  getExtensionTableHtml(extensions) {
    return $(
      "table",
      void 0,
      $(
        "tr",
        void 0,
        $("th", void 0, "Extension"),
        $("th", void 0, "Author (truncated)"),
        $("th", void 0, "Version")
      ),
      ...extensions.map((extension) => $(
        "tr",
        void 0,
        $("td", void 0, extension.name),
        $("td", void 0, extension.publisher?.substr(0, 3) ?? "N/A"),
        $("td", void 0, extension.version)
      ))
    );
  }
  async openLink(eventOrUrl) {
    if (typeof eventOrUrl === "string") {
      await this.openerService.open(eventOrUrl, { openExternal: true });
    } else {
      const event = eventOrUrl;
      event.preventDefault();
      event.stopPropagation();
      if (event.which < 3) {
        await this.openerService.open(event.target.href, { openExternal: true });
      }
    }
  }
  getElementById(elementId) {
    const element = this.window.document.getElementById(elementId);
    if (element) {
      return element;
    } else {
      return void 0;
    }
  }
  addEventListener(elementId, eventType, handler) {
    const element = this.getElementById(elementId);
    element?.addEventListener(eventType, handler);
  }
};
__decorateClass([
  debounce(300)
], BaseIssueReporterService.prototype, "searchGitHub", 1);
__decorateClass([
  debounce(300)
], BaseIssueReporterService.prototype, "searchDuplicates", 1);
BaseIssueReporterService = __decorateClass([
  __decorateParam(6, IIssueFormService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IFileDialogService),
  __decorateParam(10, IContextMenuService),
  __decorateParam(11, IAuthenticationService),
  __decorateParam(12, IOpenerService)
], BaseIssueReporterService);
function hide(el) {
  el?.classList.add("hidden");
}
function show(el) {
  el?.classList.remove("hidden");
}
export {
  BaseIssueReporterService,
  hide,
  show
};
