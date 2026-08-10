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
import { getZoomLevel } from "../../../../base/browser/browser.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { userAgent } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { normalizeGitHubUrl } from "../common/issueReporterUtil.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { buttonBackground, buttonForeground, buttonHoverBackground, foreground, inputActiveOptionBorder, inputBackground, inputBorder, inputForeground, inputValidationErrorBackground, inputValidationErrorBorder, inputValidationErrorForeground, scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground, textLinkActiveForeground, textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { SIDE_BAR_BACKGROUND } from "../../../common/theme.js";
import { IIssueFormService, IWorkbenchIssueService } from "../common/issue.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IIntegrityService } from "../../../services/integrity/common/integrity.js";
let BrowserIssueService = class {
  constructor(extensionService, productService, issueFormService, themeService, experimentService, workspaceTrustManagementService, integrityService, extensionManagementService, extensionEnablementService, authenticationService, configurationService, openerService, environmentService) {
    this.extensionService = extensionService;
    this.productService = productService;
    this.issueFormService = issueFormService;
    this.themeService = themeService;
    this.experimentService = experimentService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.integrityService = integrityService;
    this.extensionManagementService = extensionManagementService;
    this.extensionEnablementService = extensionEnablementService;
    this.authenticationService = authenticationService;
    this.configurationService = configurationService;
    this.openerService = openerService;
    this.environmentService = environmentService;
  }
  async openReporter(options) {
    if (!this.configurationService.getValue("issueReporter.experimental.webReporter")) {
      const extensionId = options.extensionId;
      if (!extensionId) {
        if (this.productService.reportIssueUrl) {
          const uri2 = this.getIssueUriFromStaticContent(this.productService.reportIssueUrl);
          await this.openerService.open(uri2, { openExternal: true });
          return;
        }
        throw new Error(`No issue reporting URL configured for ${this.productService.nameLong}.`);
      }
      const selectedExtension = this.extensionService.extensions.filter((ext) => ext.identifier.value === options.extensionId)[0];
      const extensionGitHubUrl = this.getExtensionGitHubUrl(selectedExtension);
      if (!extensionGitHubUrl) {
        throw new Error(`Unable to find issue reporting url for ${extensionId}`);
      }
      const uri = this.getIssueUriFromStaticContent(`${extensionGitHubUrl}/issues/new`, selectedExtension);
      await this.openerService.open(uri, { openExternal: true });
    }
    if (this.productService.reportIssueUrl) {
      const theme = this.themeService.getColorTheme();
      const experiments = await this.experimentService.getCurrentExperiments();
      let githubAccessToken = "";
      try {
        const githubSessions = await this.authenticationService.getSessions("github");
        const potentialSessions = githubSessions.filter((session) => session.scopes.includes("repo"));
        githubAccessToken = potentialSessions[0]?.accessToken;
      } catch (e) {
      }
      let isInstallationPure = true;
      try {
        isInstallationPure = (await this.integrityService.isPure()).isPure;
      } catch (e) {
      }
      const extensionData = [];
      try {
        const extensions = await this.extensionManagementService.getInstalled();
        const enabledExtensions = extensions.filter((extension) => this.extensionEnablementService.isEnabled(extension) || options.extensionId && extension.identifier.id === options.extensionId);
        extensionData.push(...enabledExtensions.map((extension) => {
          const { manifest } = extension;
          const manifestKeys = manifest.contributes ? Object.keys(manifest.contributes) : [];
          const isTheme = !manifest.main && !manifest.browser && manifestKeys.length === 1 && manifestKeys[0] === "themes";
          const isBuiltin = extension.type === ExtensionType.System;
          return {
            name: manifest.name,
            publisher: manifest.publisher,
            version: manifest.version,
            repositoryUrl: manifest.repository && manifest.repository.url,
            bugsUrl: manifest.bugs && manifest.bugs.url,
            displayName: manifest.displayName,
            id: extension.identifier.id,
            data: options.data,
            uri: options.uri,
            isTheme,
            isBuiltin,
            extensionData: "Extensions data loading"
          };
        }));
      } catch (e) {
        extensionData.push({
          name: "Workbench Issue Service",
          publisher: "Unknown",
          version: "Unknown",
          repositoryUrl: void 0,
          bugsUrl: void 0,
          extensionData: `Extensions not loaded: ${e}`,
          displayName: `Extensions not loaded: ${e}`,
          id: "workbench.issue",
          isTheme: false,
          isBuiltin: true
        });
      }
      const issueReporterData = Object.assign({
        styles: getIssueReporterStyles(theme),
        zoomLevel: getZoomLevel(mainWindow),
        enabledExtensions: extensionData,
        experiments: experiments?.join("\n"),
        restrictedMode: !this.workspaceTrustManagementService.isWorkspaceTrusted(),
        isInstallationPure,
        isSessionsWindow: this.environmentService.isSessionsWindow,
        githubAccessToken
      }, options);
      return this.issueFormService.openReporter(issueReporterData);
    }
    throw new Error(`No issue reporting URL configured for ${this.productService.nameLong}.`);
  }
  getExtensionGitHubUrl(extension) {
    if (extension.isBuiltin && this.productService.reportIssueUrl) {
      return normalizeGitHubUrl(this.productService.reportIssueUrl);
    }
    let repositoryUrl = "";
    const bugsUrl = extension?.bugs?.url;
    const extensionUrl = extension?.repository?.url;
    if (bugsUrl && bugsUrl.match(/^https?:\/\/github\.com\/(.*)/)) {
      repositoryUrl = normalizeGitHubUrl(bugsUrl);
    } else if (extensionUrl && extensionUrl.match(/^https?:\/\/github\.com\/(.*)/)) {
      repositoryUrl = normalizeGitHubUrl(extensionUrl);
    }
    return repositoryUrl;
  }
  getIssueUriFromStaticContent(baseUri, extension) {
    const issueDescription = `ADD ISSUE DESCRIPTION HERE

Version: ${this.productService.version}
Commit: ${this.productService.commit ?? "unknown"}
User Agent: ${userAgent ?? "unknown"}
Embedder: ${this.productService.embedderIdentifier ?? "unknown"}
${extension?.version ? `
Extension version: ${extension.version}` : ""}
<!-- generated by web issue reporter -->`;
    return `${baseUri}?body=${encodeURIComponent(issueDescription)}&labels=web`;
  }
};
BrowserIssueService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IProductService),
  __decorateParam(2, IIssueFormService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IWorkbenchAssignmentService),
  __decorateParam(5, IWorkspaceTrustManagementService),
  __decorateParam(6, IIntegrityService),
  __decorateParam(7, IExtensionManagementService),
  __decorateParam(8, IWorkbenchExtensionEnablementService),
  __decorateParam(9, IAuthenticationService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IOpenerService),
  __decorateParam(12, IWorkbenchEnvironmentService)
], BrowserIssueService);
function getIssueReporterStyles(theme) {
  return {
    backgroundColor: getColor(theme, SIDE_BAR_BACKGROUND),
    color: getColor(theme, foreground),
    textLinkColor: getColor(theme, textLinkForeground),
    textLinkActiveForeground: getColor(theme, textLinkActiveForeground),
    inputBackground: getColor(theme, inputBackground),
    inputForeground: getColor(theme, inputForeground),
    inputBorder: getColor(theme, inputBorder),
    inputActiveBorder: getColor(theme, inputActiveOptionBorder),
    inputErrorBorder: getColor(theme, inputValidationErrorBorder),
    inputErrorBackground: getColor(theme, inputValidationErrorBackground),
    inputErrorForeground: getColor(theme, inputValidationErrorForeground),
    buttonBackground: getColor(theme, buttonBackground),
    buttonForeground: getColor(theme, buttonForeground),
    buttonHoverBackground: getColor(theme, buttonHoverBackground),
    sliderActiveColor: getColor(theme, scrollbarSliderActiveBackground),
    sliderBackgroundColor: getColor(theme, scrollbarSliderBackground),
    sliderHoverColor: getColor(theme, scrollbarSliderHoverBackground)
  };
}
function getColor(theme, key) {
  const color = theme.getColor(key);
  return color ? color.toString() : void 0;
}
registerSingleton(IWorkbenchIssueService, BrowserIssueService, InstantiationType.Delayed);
export {
  BrowserIssueService,
  getIssueReporterStyles
};
