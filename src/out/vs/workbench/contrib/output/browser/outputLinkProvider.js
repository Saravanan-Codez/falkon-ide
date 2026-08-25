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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { OUTPUT_MODE_ID, LOG_MODE_ID } from "../../../services/output/common/output.js";
import { dispose, Disposable } from "../../../../base/common/lifecycle.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { WebWorkerDescriptor } from "../../../../platform/webWorker/browser/webWorkerDescriptor.js";
import { IWebWorkerService } from "../../../../platform/webWorker/browser/webWorkerService.js";
import { WorkerTextModelSyncClient } from "../../../../editor/common/services/textModelSync/textModelSync.impl.js";
import { FileAccess } from "../../../../base/common/network.js";
let OutputLinkProvider = class extends Disposable {
  constructor(contextService, modelService, languageFeaturesService, webWorkerService) {
    super();
    this.contextService = contextService;
    this.modelService = modelService;
    this.languageFeaturesService = languageFeaturesService;
    this.webWorkerService = webWorkerService;
    this.disposeWorkerScheduler = this._register(new RunOnceScheduler(() => this.disposeWorker(), OutputLinkProvider.DISPOSE_WORKER_TIME));
    this.registerListeners();
    this.updateLinkProviderWorker();
  }
  static {
    this.DISPOSE_WORKER_TIME = 3 * 60 * 1e3;
  }
  registerListeners() {
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.updateLinkProviderWorker()));
  }
  updateLinkProviderWorker() {
    const folders = this.contextService.getWorkspace().folders;
    if (folders.length > 0) {
      if (!this.linkProviderRegistration) {
        this.linkProviderRegistration = this.languageFeaturesService.linkProvider.register([{ language: OUTPUT_MODE_ID, scheme: "*" }, { language: LOG_MODE_ID, scheme: "*" }], {
          provideLinks: async (model) => {
            const links = await this.provideLinks(model.uri);
            return links && { links };
          }
        });
      }
    } else {
      dispose(this.linkProviderRegistration);
      this.linkProviderRegistration = void 0;
    }
    this.disposeWorker();
    this.disposeWorkerScheduler.cancel();
  }
  getOrCreateWorker() {
    this.disposeWorkerScheduler.schedule();
    if (!this.worker) {
      this.worker = new OutputLinkWorkerClient(this.contextService, this.modelService, this.webWorkerService);
    }
    return this.worker;
  }
  async provideLinks(modelUri) {
    return this.getOrCreateWorker().provideLinks(modelUri);
  }
  disposeWorker() {
    if (this.worker) {
      this.worker.dispose();
      this.worker = void 0;
    }
  }
};
OutputLinkProvider = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, IWebWorkerService)
], OutputLinkProvider);
let OutputLinkWorkerClient = class extends Disposable {
  constructor(contextService, modelService, webWorkerService) {
    super();
    this.contextService = contextService;
    this._workerClient = this._register(webWorkerService.createWorkerClient(
      new WebWorkerDescriptor({
        esmModuleLocation: FileAccess.asBrowserUri("vs/workbench/contrib/output/common/outputLinkComputerMain.js"),
        label: "OutputLinkDetectionWorker"
      })
    ));
    this._workerTextModelSyncClient = this._register(WorkerTextModelSyncClient.create(this._workerClient, modelService));
    this._initializeBarrier = this._ensureWorkspaceFolders();
  }
  async _ensureWorkspaceFolders() {
    await this._workerClient.proxy.$setWorkspaceFolders(this.contextService.getWorkspace().folders.map((folder) => folder.uri.toString()));
  }
  async provideLinks(modelUri) {
    await this._initializeBarrier;
    this._workerTextModelSyncClient.ensureSyncedResources([modelUri]);
    return this._workerClient.proxy.$computeLinks(modelUri.toString());
  }
};
OutputLinkWorkerClient = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IModelService),
  __decorateParam(2, IWebWorkerService)
], OutputLinkWorkerClient);
export {
  OutputLinkProvider
};
