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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILanguageDetectionService, LanguageDetectionStatsId } from "../common/languageDetectionWorkerService.js";
import { FileAccess, nodeModulesAsarPath, nodeModulesPath, Schemas } from "../../../../base/common/network.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { URI } from "../../../../base/common/uri.js";
import { isWeb } from "../../../../base/common/platform.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IDiagnosticsService } from "../../../../platform/diagnostics/common/diagnostics.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { LRUCache } from "../../../../base/common/map.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { WebWorkerDescriptor } from "../../../../platform/webWorker/browser/webWorkerDescriptor.js";
import { IWebWorkerService } from "../../../../platform/webWorker/browser/webWorkerService.js";
import { WorkerTextModelSyncClient } from "../../../../editor/common/services/textModelSync/textModelSync.impl.js";
import { LanguageDetectionWorkerHost } from "./languageDetectionWorker.protocol.js";
const TOP_LANG_COUNTS = 12;
const regexpModuleLocation = `${nodeModulesPath}/vscode-regexp-languagedetection`;
const regexpModuleLocationAsar = `${nodeModulesAsarPath}/vscode-regexp-languagedetection`;
const moduleLocation = `${nodeModulesPath}/@vscode/vscode-languagedetection`;
const moduleLocationAsar = `${nodeModulesAsarPath}/@vscode/vscode-languagedetection`;
let LanguageDetectionService = class extends Disposable {
  constructor(_environmentService, languageService, _configurationService, _diagnosticsService, _workspaceContextService, modelService, _editorService, telemetryService, storageService, _logService, webWorkerService) {
    super();
    this._environmentService = _environmentService;
    this._configurationService = _configurationService;
    this._diagnosticsService = _diagnosticsService;
    this._workspaceContextService = _workspaceContextService;
    this._editorService = _editorService;
    this._logService = _logService;
    this.hasResolvedWorkspaceLanguageIds = false;
    this.workspaceLanguageIds = /* @__PURE__ */ new Set();
    this.sessionOpenedLanguageIds = /* @__PURE__ */ new Set();
    this.historicalGlobalOpenedLanguageIds = new LRUCache(TOP_LANG_COUNTS);
    this.historicalWorkspaceOpenedLanguageIds = new LRUCache(TOP_LANG_COUNTS);
    this.dirtyBiases = true;
    this.langBiases = {};
    const useAsar = this._environmentService.isBuilt && !isWeb;
    this._languageDetectionWorkerClient = this._register(new LanguageDetectionWorkerClient(
      modelService,
      languageService,
      telemetryService,
      webWorkerService,
      // TODO See if it's possible to bundle vscode-languagedetection
      useAsar ? FileAccess.asBrowserUri(`${moduleLocationAsar}/dist/lib/index.js`).toString(true) : FileAccess.asBrowserUri(`${moduleLocation}/dist/lib/index.js`).toString(true),
      useAsar ? FileAccess.asBrowserUri(`${moduleLocationAsar}/model/model.json`).toString(true) : FileAccess.asBrowserUri(`${moduleLocation}/model/model.json`).toString(true),
      useAsar ? FileAccess.asBrowserUri(`${moduleLocationAsar}/model/group1-shard1of1.bin`).toString(true) : FileAccess.asBrowserUri(`${moduleLocation}/model/group1-shard1of1.bin`).toString(true),
      useAsar ? FileAccess.asBrowserUri(`${regexpModuleLocationAsar}/dist/index.js`).toString(true) : FileAccess.asBrowserUri(`${regexpModuleLocation}/dist/index.js`).toString(true)
    ));
    this.initEditorOpenedListeners(storageService);
  }
  static {
    this.enablementSettingKey = "workbench.editor.languageDetection";
  }
  static {
    this.historyBasedEnablementConfig = "workbench.editor.historyBasedLanguageDetection";
  }
  static {
    this.preferHistoryConfig = "workbench.editor.preferHistoryBasedLanguageDetection";
  }
  static {
    this.workspaceOpenedLanguagesStorageKey = "workbench.editor.languageDetectionOpenedLanguages.workspace";
  }
  static {
    this.globalOpenedLanguagesStorageKey = "workbench.editor.languageDetectionOpenedLanguages.global";
  }
  async resolveWorkspaceLanguageIds() {
    if (this.hasResolvedWorkspaceLanguageIds) {
      return;
    }
    this.hasResolvedWorkspaceLanguageIds = true;
    const fileExtensions = await this._diagnosticsService.getWorkspaceFileExtensions(this._workspaceContextService.getWorkspace());
    let count = 0;
    for (const ext of fileExtensions.extensions) {
      const langId = this._languageDetectionWorkerClient.getLanguageId(ext);
      if (langId && count < TOP_LANG_COUNTS) {
        this.workspaceLanguageIds.add(langId);
        count++;
        if (count > TOP_LANG_COUNTS) {
          break;
        }
      }
    }
    this.dirtyBiases = true;
  }
  isEnabledForLanguage(languageId) {
    return !!languageId && this._configurationService.getValue(LanguageDetectionService.enablementSettingKey, { overrideIdentifier: languageId });
  }
  getLanguageBiases() {
    if (!this.dirtyBiases) {
      return this.langBiases;
    }
    const biases = {};
    this.sessionOpenedLanguageIds.forEach((lang) => biases[lang] = (biases[lang] ?? 0) + 7);
    this.workspaceLanguageIds.forEach((lang) => biases[lang] = (biases[lang] ?? 0) + 5);
    [...this.historicalWorkspaceOpenedLanguageIds.keys()].forEach((lang) => biases[lang] = (biases[lang] ?? 0) + 3);
    [...this.historicalGlobalOpenedLanguageIds.keys()].forEach((lang) => biases[lang] = (biases[lang] ?? 0) + 1);
    this._logService.trace("Session Languages:", JSON.stringify([...this.sessionOpenedLanguageIds]));
    this._logService.trace("Workspace Languages:", JSON.stringify([...this.workspaceLanguageIds]));
    this._logService.trace("Historical Workspace Opened Languages:", JSON.stringify([...this.historicalWorkspaceOpenedLanguageIds.keys()]));
    this._logService.trace("Historical Globally Opened Languages:", JSON.stringify([...this.historicalGlobalOpenedLanguageIds.keys()]));
    this._logService.trace("Computed Language Detection Biases:", JSON.stringify(biases));
    this.dirtyBiases = false;
    this.langBiases = biases;
    return biases;
  }
  async detectLanguage(resource, supportedLangs) {
    const useHistory = this._configurationService.getValue(LanguageDetectionService.historyBasedEnablementConfig);
    const preferHistory = this._configurationService.getValue(LanguageDetectionService.preferHistoryConfig);
    if (useHistory) {
      await this.resolveWorkspaceLanguageIds();
    }
    const biases = useHistory ? this.getLanguageBiases() : void 0;
    return this._languageDetectionWorkerClient.detectLanguage(resource, biases, preferHistory, supportedLangs);
  }
  // TODO: explore using the history service or something similar to provide this list of opened editors
  // so this service can support delayed instantiation. This may be tricky since it seems the IHistoryService
  // only gives history for a workspace... where this takes advantage of history at a global level as well.
  initEditorOpenedListeners(storageService) {
    try {
      const globalLangHistoryData = JSON.parse(storageService.get(LanguageDetectionService.globalOpenedLanguagesStorageKey, StorageScope.PROFILE, "[]"));
      this.historicalGlobalOpenedLanguageIds.fromJSON(globalLangHistoryData);
    } catch (e) {
      console.error(e);
    }
    try {
      const workspaceLangHistoryData = JSON.parse(storageService.get(LanguageDetectionService.workspaceOpenedLanguagesStorageKey, StorageScope.WORKSPACE, "[]"));
      this.historicalWorkspaceOpenedLanguageIds.fromJSON(workspaceLangHistoryData);
    } catch (e) {
      console.error(e);
    }
    this._register(this._editorService.onDidActiveEditorChange(() => {
      const activeLanguage = this._editorService.activeTextEditorLanguageId;
      if (activeLanguage && this._editorService.activeEditor?.resource?.scheme !== Schemas.untitled) {
        this.sessionOpenedLanguageIds.add(activeLanguage);
        this.historicalGlobalOpenedLanguageIds.set(activeLanguage, true);
        this.historicalWorkspaceOpenedLanguageIds.set(activeLanguage, true);
        storageService.store(LanguageDetectionService.globalOpenedLanguagesStorageKey, JSON.stringify(this.historicalGlobalOpenedLanguageIds.toJSON()), StorageScope.PROFILE, StorageTarget.MACHINE);
        storageService.store(LanguageDetectionService.workspaceOpenedLanguagesStorageKey, JSON.stringify(this.historicalWorkspaceOpenedLanguageIds.toJSON()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
        this.dirtyBiases = true;
      }
    }));
  }
};
LanguageDetectionService = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IDiagnosticsService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IModelService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, ILogService),
  __decorateParam(10, IWebWorkerService)
], LanguageDetectionService);
class LanguageDetectionWorkerClient extends Disposable {
  constructor(_modelService, _languageService, _telemetryService, _webWorkerService, _indexJsUri, _modelJsonUri, _weightsUri, _regexpModelUri) {
    super();
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._telemetryService = _telemetryService;
    this._webWorkerService = _webWorkerService;
    this._indexJsUri = _indexJsUri;
    this._modelJsonUri = _modelJsonUri;
    this._weightsUri = _weightsUri;
    this._regexpModelUri = _regexpModelUri;
  }
  _getOrCreateLanguageDetectionWorker() {
    if (!this.worker) {
      const workerClient = this._register(this._webWorkerService.createWorkerClient(
        new WebWorkerDescriptor({
          esmModuleLocation: FileAccess.asBrowserUri("vs/workbench/services/languageDetection/browser/languageDetectionWebWorkerMain.js"),
          label: "LanguageDetectionWorker"
        })
      ));
      LanguageDetectionWorkerHost.setChannel(workerClient, {
        $getIndexJsUri: async () => this.getIndexJsUri(),
        $getLanguageId: async (languageIdOrExt) => this.getLanguageId(languageIdOrExt),
        $sendTelemetryEvent: async (languages, confidences, timeSpent) => this.sendTelemetryEvent(languages, confidences, timeSpent),
        $getRegexpModelUri: async () => this.getRegexpModelUri(),
        $getModelJsonUri: async () => this.getModelJsonUri(),
        $getWeightsUri: async () => this.getWeightsUri()
      });
      const workerTextModelSyncClient = this._register(WorkerTextModelSyncClient.create(workerClient, this._modelService));
      this.worker = { workerClient, workerTextModelSyncClient };
    }
    return this.worker;
  }
  _guessLanguageIdByUri(uri) {
    const guess = this._languageService.guessLanguageIdByFilepathOrFirstLine(uri);
    if (guess && guess !== "unknown") {
      return guess;
    }
    return void 0;
  }
  async getIndexJsUri() {
    return this._indexJsUri;
  }
  getLanguageId(languageIdOrExt) {
    if (!languageIdOrExt) {
      return void 0;
    }
    if (this._languageService.isRegisteredLanguageId(languageIdOrExt)) {
      return languageIdOrExt;
    }
    const guessed = this._guessLanguageIdByUri(URI.file(`file.${languageIdOrExt}`));
    if (!guessed || guessed === "unknown") {
      return void 0;
    }
    return guessed;
  }
  async getModelJsonUri() {
    return this._modelJsonUri;
  }
  async getWeightsUri() {
    return this._weightsUri;
  }
  async getRegexpModelUri() {
    return this._regexpModelUri;
  }
  async sendTelemetryEvent(languages, confidences, timeSpent) {
    this._telemetryService.publicLog2(LanguageDetectionStatsId, {
      languages: languages.join(","),
      confidences: confidences.join(","),
      timeSpent
    });
  }
  async detectLanguage(resource, langBiases, preferHistory, supportedLangs) {
    const startTime = Date.now();
    const quickGuess = this._guessLanguageIdByUri(resource);
    if (quickGuess) {
      return quickGuess;
    }
    const { workerClient, workerTextModelSyncClient } = this._getOrCreateLanguageDetectionWorker();
    workerTextModelSyncClient.ensureSyncedResources([resource]);
    const modelId = await workerClient.proxy.$detectLanguage(resource.toString(), langBiases, preferHistory, supportedLangs);
    const languageId = this.getLanguageId(modelId);
    const LanguageDetectionStatsId2 = "automaticlanguagedetection.perf";
    this._telemetryService.publicLog2(LanguageDetectionStatsId2, {
      timeSpent: Date.now() - startTime,
      detection: languageId || "unknown"
    });
    return languageId;
  }
}
registerSingleton(ILanguageDetectionService, LanguageDetectionService, InstantiationType.Eager);
export {
  LanguageDetectionService,
  LanguageDetectionWorkerClient
};
