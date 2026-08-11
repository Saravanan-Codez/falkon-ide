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
import { EXTENSION_IDENTIFIER_PATTERN } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { distinct, equals } from "../../../../base/common/arrays.js";
import { ExtensionRecommendations } from "./extensionRecommendations.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ExtensionRecommendationReason } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { localize } from "../../../../nls.js";
import { Emitter } from "../../../../base/common/event.js";
import { IWorkspaceExtensionsConfigService } from "../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IWorkbenchExtensionManagementService } from "../../../services/extensionManagement/common/extensionManagement.js";
const WORKSPACE_EXTENSIONS_FOLDER = ".vscode/extensions";
let WorkspaceRecommendations = class extends ExtensionRecommendations {
  constructor(workspaceExtensionsConfigService, contextService, uriIdentityService, fileService, workbenchExtensionManagementService, notificationService) {
    super();
    this.workspaceExtensionsConfigService = workspaceExtensionsConfigService;
    this.contextService = contextService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.workbenchExtensionManagementService = workbenchExtensionManagementService;
    this.notificationService = notificationService;
    this._recommendations = [];
    this._onDidChangeRecommendations = this._register(new Emitter());
    this.onDidChangeRecommendations = this._onDidChangeRecommendations.event;
    this._ignoredRecommendations = [];
    this.workspaceExtensions = [];
    this.onDidChangeWorkspaceExtensionsScheduler = this._register(new RunOnceScheduler(() => this.onDidChangeWorkspaceExtensionsFolders(), 1e3));
  }
  get recommendations() {
    return this._recommendations;
  }
  get ignoredRecommendations() {
    return this._ignoredRecommendations;
  }
  async doActivate() {
    this.workspaceExtensions = await this.fetchWorkspaceExtensions();
    await this.fetch();
    this._register(this.workspaceExtensionsConfigService.onDidChangeExtensionsConfigs(() => this.onDidChangeExtensionsConfigs()));
    for (const folder of this.contextService.getWorkspace().folders) {
      this._register(this.fileService.watch(this.uriIdentityService.extUri.joinPath(folder.uri, WORKSPACE_EXTENSIONS_FOLDER)));
    }
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.onDidChangeWorkspaceExtensionsScheduler.schedule()));
    this._register(this.fileService.onDidFilesChange((e) => {
      if (this.contextService.getWorkspace().folders.some((folder) => e.affects(this.uriIdentityService.extUri.joinPath(folder.uri, WORKSPACE_EXTENSIONS_FOLDER), FileChangeType.ADDED, FileChangeType.DELETED))) {
        this.onDidChangeWorkspaceExtensionsScheduler.schedule();
      }
    }));
  }
  async onDidChangeWorkspaceExtensionsFolders() {
    const existing = this.workspaceExtensions;
    this.workspaceExtensions = await this.fetchWorkspaceExtensions();
    if (!equals(existing, this.workspaceExtensions, (a, b) => this.uriIdentityService.extUri.isEqual(a, b))) {
      this.onDidChangeExtensionsConfigs();
    }
  }
  async fetchWorkspaceExtensions() {
    const workspaceExtensions = [];
    for (const workspaceFolder of this.contextService.getWorkspace().folders) {
      const extensionsLocaiton = this.uriIdentityService.extUri.joinPath(workspaceFolder.uri, WORKSPACE_EXTENSIONS_FOLDER);
      try {
        const stat = await this.fileService.resolve(extensionsLocaiton);
        for (const extension of stat.children ?? []) {
          if (!extension.isDirectory) {
            continue;
          }
          workspaceExtensions.push(extension.resource);
        }
      } catch (error) {
      }
    }
    if (workspaceExtensions.length) {
      const resourceExtensions = await this.workbenchExtensionManagementService.getExtensions(workspaceExtensions);
      return resourceExtensions.map((extension) => extension.location);
    }
    return [];
  }
  /**
   * Parse all extensions.json files, fetch workspace recommendations, filter out invalid and unwanted ones
   */
  async fetch() {
    const extensionsConfigs = await this.workspaceExtensionsConfigService.getExtensionsConfigs();
    const { invalidRecommendations, message } = await this.validateExtensions(extensionsConfigs);
    if (invalidRecommendations.length) {
      this.notificationService.warn(`The ${invalidRecommendations.length} extension(s) below, in workspace recommendations have issues:
${message}`);
    }
    this._recommendations = [];
    this._ignoredRecommendations = [];
    for (const extensionsConfig of extensionsConfigs) {
      if (extensionsConfig.unwantedRecommendations) {
        for (const unwantedRecommendation of extensionsConfig.unwantedRecommendations) {
          if (invalidRecommendations.indexOf(unwantedRecommendation) === -1) {
            this._ignoredRecommendations.push(unwantedRecommendation);
          }
        }
      }
      if (extensionsConfig.recommendations) {
        for (const extensionId of extensionsConfig.recommendations) {
          if (invalidRecommendations.indexOf(extensionId) === -1) {
            this._recommendations.push({
              extension: extensionId,
              reason: {
                reasonId: ExtensionRecommendationReason.Workspace,
                reasonText: localize("workspaceRecommendation", "This extension is recommended by users of the current workspace.")
              }
            });
          }
        }
      }
    }
    for (const extension of this.workspaceExtensions) {
      this._recommendations.push({
        extension,
        reason: {
          reasonId: ExtensionRecommendationReason.Workspace,
          reasonText: localize("workspaceRecommendation", "This extension is recommended by users of the current workspace.")
        }
      });
    }
  }
  async validateExtensions(contents) {
    const validExtensions = [];
    const invalidExtensions = [];
    let message = "";
    const allRecommendations = distinct(contents.flatMap(({ recommendations }) => recommendations || []));
    const regEx = new RegExp(EXTENSION_IDENTIFIER_PATTERN);
    for (const extensionId of allRecommendations) {
      if (regEx.test(extensionId)) {
        validExtensions.push(extensionId);
      } else {
        invalidExtensions.push(extensionId);
        message += `${extensionId} (bad format) Expected: <provider>.<name>
`;
      }
    }
    return { validRecommendations: validExtensions, invalidRecommendations: invalidExtensions, message };
  }
  async onDidChangeExtensionsConfigs() {
    await this.fetch();
    this._onDidChangeRecommendations.fire();
  }
};
WorkspaceRecommendations = __decorateClass([
  __decorateParam(0, IWorkspaceExtensionsConfigService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IWorkbenchExtensionManagementService),
  __decorateParam(5, INotificationService)
], WorkspaceRecommendations);
export {
  WorkspaceRecommendations
};
