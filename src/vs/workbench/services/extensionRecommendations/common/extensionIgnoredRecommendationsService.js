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
import { distinct } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionIgnoredRecommendationsService } from "./extensionRecommendations.js";
import { IWorkspaceExtensionsConfigService } from "./workspaceExtensionsConfig.js";
const ignoredRecommendationsStorageKey = "extensionsAssistant/ignored_recommendations";
let ExtensionIgnoredRecommendationsService = class extends Disposable {
  constructor(workspaceExtensionsConfigService, storageService) {
    super();
    this.workspaceExtensionsConfigService = workspaceExtensionsConfigService;
    this.storageService = storageService;
    this._onDidChangeIgnoredRecommendations = this._register(new Emitter());
    this.onDidChangeIgnoredRecommendations = this._onDidChangeIgnoredRecommendations.event;
    // Global Ignored Recommendations
    this._globalIgnoredRecommendations = [];
    this._onDidChangeGlobalIgnoredRecommendation = this._register(new Emitter());
    this.onDidChangeGlobalIgnoredRecommendation = this._onDidChangeGlobalIgnoredRecommendation.event;
    // Ignored Workspace Recommendations
    this.ignoredWorkspaceRecommendations = [];
    this._globalIgnoredRecommendations = this.getCachedIgnoredRecommendations();
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, ignoredRecommendationsStorageKey, this._store)(() => this.onDidStorageChange()));
    this.initIgnoredWorkspaceRecommendations();
  }
  get globalIgnoredRecommendations() {
    return [...this._globalIgnoredRecommendations];
  }
  get ignoredRecommendations() {
    return distinct([...this.globalIgnoredRecommendations, ...this.ignoredWorkspaceRecommendations]);
  }
  async initIgnoredWorkspaceRecommendations() {
    this.ignoredWorkspaceRecommendations = await this.workspaceExtensionsConfigService.getUnwantedRecommendations();
    this._onDidChangeIgnoredRecommendations.fire();
    this._register(this.workspaceExtensionsConfigService.onDidChangeExtensionsConfigs(async () => {
      this.ignoredWorkspaceRecommendations = await this.workspaceExtensionsConfigService.getUnwantedRecommendations();
      this._onDidChangeIgnoredRecommendations.fire();
    }));
  }
  toggleGlobalIgnoredRecommendation(extensionId, shouldIgnore) {
    extensionId = extensionId.toLowerCase();
    const ignored = this._globalIgnoredRecommendations.indexOf(extensionId) !== -1;
    if (ignored === shouldIgnore) {
      return;
    }
    this._globalIgnoredRecommendations = shouldIgnore ? [...this._globalIgnoredRecommendations, extensionId] : this._globalIgnoredRecommendations.filter((id) => id !== extensionId);
    this.storeCachedIgnoredRecommendations(this._globalIgnoredRecommendations);
    this._onDidChangeGlobalIgnoredRecommendation.fire({ extensionId, isRecommended: !shouldIgnore });
    this._onDidChangeIgnoredRecommendations.fire();
  }
  getCachedIgnoredRecommendations() {
    const ignoredRecommendations = JSON.parse(this.ignoredRecommendationsValue);
    return ignoredRecommendations.map((e) => e.toLowerCase());
  }
  onDidStorageChange() {
    if (this.ignoredRecommendationsValue !== this.getStoredIgnoredRecommendationsValue()) {
      this._ignoredRecommendationsValue = void 0;
      this._globalIgnoredRecommendations = this.getCachedIgnoredRecommendations();
      this._onDidChangeIgnoredRecommendations.fire();
    }
  }
  storeCachedIgnoredRecommendations(ignoredRecommendations) {
    this.ignoredRecommendationsValue = JSON.stringify(ignoredRecommendations);
  }
  get ignoredRecommendationsValue() {
    if (!this._ignoredRecommendationsValue) {
      this._ignoredRecommendationsValue = this.getStoredIgnoredRecommendationsValue();
    }
    return this._ignoredRecommendationsValue;
  }
  set ignoredRecommendationsValue(ignoredRecommendationsValue) {
    if (this.ignoredRecommendationsValue !== ignoredRecommendationsValue) {
      this._ignoredRecommendationsValue = ignoredRecommendationsValue;
      this.setStoredIgnoredRecommendationsValue(ignoredRecommendationsValue);
    }
  }
  getStoredIgnoredRecommendationsValue() {
    return this.storageService.get(ignoredRecommendationsStorageKey, StorageScope.PROFILE, "[]");
  }
  setStoredIgnoredRecommendationsValue(value) {
    this.storageService.store(ignoredRecommendationsStorageKey, value, StorageScope.PROFILE, StorageTarget.USER);
  }
};
ExtensionIgnoredRecommendationsService = __decorateClass([
  __decorateParam(0, IWorkspaceExtensionsConfigService),
  __decorateParam(1, IStorageService)
], ExtensionIgnoredRecommendationsService);
registerSingleton(IExtensionIgnoredRecommendationsService, ExtensionIgnoredRecommendationsService, InstantiationType.Delayed);
export {
  ExtensionIgnoredRecommendationsService
};
