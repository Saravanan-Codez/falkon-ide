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
import { localize } from "../../../../nls.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Memento } from "../../../common/memento.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ASSIGNMENT_REFETCH_INTERVAL, ASSIGNMENT_STORAGE_KEY, AssignmentFilterProvider, TargetPopulation, VSCodeCoreAssignmentsFilterProvider, WindowKind } from "../../../../platform/assignment/common/assignment.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { resolveAmdNodeModulePath } from "../../../../amdX.js";
import { asJson, IRequestService } from "../../../../platform/request/common/request.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { timeout } from "../../../../base/common/async.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { CopilotAssignmentFilterProvider, GitHubCoreAssignmentsFilterProvider } from "./assignmentFilters.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { AssignmentContextFilter } from "./assignmentContextFilter.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { experimentsEnabled } from "../../telemetry/common/workbenchTelemetryUtils.js";
const IWorkbenchAssignmentService = createDecorator("assignmentService");
class MementoKeyValueStorage {
  constructor(memento) {
    this.memento = memento;
    this.mementoObj = memento.getMemento(StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  async getValue(key, defaultValue) {
    const value = await this.mementoObj[key];
    return value || defaultValue;
  }
  setValue(key, value) {
    this.mementoObj[key] = value;
    this.memento.saveMemento();
  }
}
class WorkbenchAssignmentServiceTelemetry extends Disposable {
  constructor(telemetryService, productService, contextFilter) {
    super();
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.contextFilter = contextFilter;
    this._onDidUpdateAssignmentContext = this._register(new Emitter());
    this.onDidUpdateAssignmentContext = this._onDidUpdateAssignmentContext.event;
    this._register(this.contextFilter.onDidChange(() => {
      if (this._previousAssignmentContext) {
        this._setAssignmentContext(this._previousAssignmentContext);
      }
    }));
  }
  get assignmentContext() {
    return this._lastAssignmentContext?.split(";");
  }
  _setAssignmentContext(value) {
    const filteredValue = this.contextFilter.filter(value);
    this._lastAssignmentContext = filteredValue;
    this._onDidUpdateAssignmentContext.fire();
    if (this.productService.tasConfig?.assignmentContextTelemetryPropertyName) {
      this.telemetryService.setExperimentProperty(this.productService.tasConfig.assignmentContextTelemetryPropertyName, filteredValue);
    }
  }
  // __GDPR__COMMON__ "abexp.assignmentcontext" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
  setSharedProperty(name, value) {
    if (name === this.productService.tasConfig?.assignmentContextTelemetryPropertyName) {
      this._previousAssignmentContext = value;
      return this._setAssignmentContext(value);
    }
    this.telemetryService.setExperimentProperty(name, value);
  }
  postEvent(eventName, props) {
    const data = {};
    for (const [key, value] of props.entries()) {
      data[key] = value;
    }
    this.telemetryService.publicLog(eventName, data);
  }
}
let WorkbenchAssignmentService = class extends Disposable {
  constructor(telemetryService, storageService, configurationService, productService, environmentService, instantiationService, defaultAccountService, requestService) {
    super();
    this.telemetryService = telemetryService;
    this.configurationService = configurationService;
    this.productService = productService;
    this.environmentService = environmentService;
    this.instantiationService = instantiationService;
    this.defaultAccountService = defaultAccountService;
    this.requestService = requestService;
    this.tasSetupDisposables = this._register(new DisposableStore());
    this.networkInitialized = false;
    this.setupGeneration = 0;
    this._onDidRefetchAssignments = this._register(new Emitter());
    this.onDidRefetchAssignments = this._onDidRefetchAssignments.event;
    /**
     * Transport for the new assignments endpoint, backed by the main-process request service
     * (avoids renderer CORS). Shape matches tas-client's injectable `assignmentsFetch`.
     */
    this.assignmentsFetch = async (url, init) => {
      const context = await this.requestService.request({
        type: init.method,
        url,
        data: init.body,
        headers: init.headers,
        disableCache: true,
        callSite: "assignmentService.assignments"
      }, CancellationToken.None);
      return {
        status: context.res.statusCode ?? 0,
        json: async () => await asJson(context) ?? {}
      };
    };
    this.experimentsEnabled = experimentsEnabled(configurationService, productService, this.environmentService);
    if (this.experimentsEnabled) {
      this.tasClient = this.setupTASClient();
      this.defaultAccountService.getDefaultAccount().then(() => this.recreateTasClientIfEndpointChanged());
      this._register(this.defaultAccountService.onDidChangeDefaultAccount(() => this.recreateTasClientIfEndpointChanged()));
      this._register(toDisposable(() => {
        this.revokeCurrentSetup?.();
        WorkbenchAssignmentService.disposeTasClient(this.tasClient);
      }));
    }
    this.contextFilter = this._register(new AssignmentContextFilter(storageService));
    this.telemetry = this._register(new WorkbenchAssignmentServiceTelemetry(telemetryService, productService, this.contextFilter));
    this._register(this.telemetry.onDidUpdateAssignmentContext(() => this._onDidRefetchAssignments.fire()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("experiments.override")) {
        this._onDidRefetchAssignments.fire();
      }
    }));
    this.keyValueStorage = new MementoKeyValueStorage(new Memento("experiment.service.memento", storageService));
    const overrideDelaySetting = configurationService.getValue("experiments.overrideDelay");
    const overrideDelay = typeof overrideDelaySetting === "number" ? overrideDelaySetting : 0;
    this.overrideInitDelay = timeout(overrideDelay);
  }
  async getTreatment(name) {
    const result = await this.doGetTreatment(name);
    this.telemetryService.publicLog2("tasClientReadTreatmentComplete", {
      treatmentName: name,
      treatmentValue: JSON.stringify(result)
    });
    return result;
  }
  async doGetTreatment(name) {
    await this.overrideInitDelay;
    const override = this.configurationService.getValue(`experiments.override.${name}`);
    if (override !== void 0) {
      return override;
    }
    if (!this.tasClient) {
      return void 0;
    }
    if (!this.experimentsEnabled) {
      return void 0;
    }
    let result;
    const client = await this.tasClient;
    if (this.networkInitialized) {
      result = client.getTreatmentVariable("vscode", name);
    } else {
      result = await client.getTreatmentVariableAsync("vscode", name, true);
    }
    result = client.getTreatmentVariable("vscode", name);
    return result;
  }
  /**
   * Resolves the new TAS assignments API URL from the account entitlements `exp` endpoint,
   * or `undefined` when no account/endpoint is available.
   */
  getAssignmentsEndpoint() {
    const account = this.defaultAccountService.currentDefaultAccount;
    const endpoints = account?.entitlementsData?.endpoints;
    const exp = endpoints?.exp;
    if (!exp) {
      return void 0;
    }
    return `${exp.replace(/\/+$/, "")}/api/v1/assignments`;
  }
  /** Recreates the TAS client when the resolved assignments endpoint has changed. */
  recreateTasClientIfEndpointChanged() {
    if (this._store.isDisposed) {
      return;
    }
    const next = this.getAssignmentsEndpoint();
    if (next !== this.assignmentsEndpoint) {
      this.tasClient = this.setupTASClient();
    }
  }
  async setupTASClient() {
    this.tasSetupDisposables.clear();
    const generation = ++this.setupGeneration;
    this.networkInitialized = false;
    this.revokeCurrentSetup?.();
    WorkbenchAssignmentService.disposeTasClient(this.tasClient);
    let revoked = false;
    this.revokeCurrentSetup = () => {
      revoked = true;
    };
    const service = this;
    const keyValueStorage = {
      getValue(key, defaultValue) {
        return service.keyValueStorage.getValue(key, defaultValue);
      },
      setValue(key, value) {
        if (!revoked) {
          service.keyValueStorage.setValue(key, value);
        }
      }
    };
    const telemetry = {
      setSharedProperty(name, value) {
        if (!revoked) {
          service.telemetry.setSharedProperty(name, value);
        }
      },
      postEvent(eventName, props) {
        if (!revoked) {
          service.telemetry.postEvent(eventName, props);
        }
      }
    };
    const targetPopulation = this.productService.quality === "stable" ? TargetPopulation.Public : this.productService.quality === "exploration" ? TargetPopulation.Exploration : TargetPopulation.Insiders;
    const filterProvider = new AssignmentFilterProvider(
      this.productService.version,
      this.productService.nameLong,
      this.telemetryService.machineId,
      this.telemetryService.devDeviceId,
      targetPopulation,
      this.productService.date ?? "",
      this.environmentService.isSessionsWindow ? WindowKind.Agents : WindowKind.Editor
    );
    const extensionsFilterProvider = this.instantiationService.createInstance(CopilotAssignmentFilterProvider);
    this.tasSetupDisposables.add(extensionsFilterProvider);
    this.tasSetupDisposables.add(extensionsFilterProvider.onDidChangeFilters(() => this.refetchAssignments()));
    const assignmentsEndpoint = this.getAssignmentsEndpoint();
    this.assignmentsEndpoint = assignmentsEndpoint;
    let assignmentsFilterProviders;
    if (assignmentsEndpoint) {
      const coreAssignmentsFilterProvider = new VSCodeCoreAssignmentsFilterProvider(
        this.productService.version,
        this.productService.nameLong,
        this.telemetryService.devDeviceId,
        targetPopulation,
        this.productService.date ?? "",
        this.environmentService.isSessionsWindow ? WindowKind.Agents : WindowKind.Editor
      );
      const githubAssignmentsFilterProvider = this.instantiationService.createInstance(GitHubCoreAssignmentsFilterProvider);
      this.tasSetupDisposables.add(githubAssignmentsFilterProvider);
      this.tasSetupDisposables.add(githubAssignmentsFilterProvider.onDidChangeFilters(() => this.refetchAssignments()));
      assignmentsFilterProviders = [coreAssignmentsFilterProvider, githubAssignmentsFilterProvider];
    }
    const tasConfig = this.productService.tasConfig;
    const tasClientUrl = resolveAmdNodeModulePath("tas-client", "dist/tas-client.min.js");
    const tasClientModule = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      `${tasClientUrl}`
    );
    const fetchStopWatch = StopWatch.create();
    const tasClient = new tasClientModule.ExperimentationService({
      filterProviders: [filterProvider, extensionsFilterProvider],
      telemetry,
      storageKey: ASSIGNMENT_STORAGE_KEY,
      keyValueStorage,
      assignmentContextTelemetryPropertyName: tasConfig.assignmentContextTelemetryPropertyName,
      telemetryEventName: tasConfig.telemetryEventName,
      endpoint: tasConfig.endpoint,
      assignmentsEndpoint,
      assignmentsFilterProviders,
      // Route the assignments request through the main-process request service so it is
      // not subject to renderer CORS (parity with how core reaches api.github.com).
      assignmentsFetch: assignmentsEndpoint ? (url, init) => revoked ? Promise.resolve({ status: 0, json: async () => ({}) }) : service.assignmentsFetch(url, init) : void 0,
      refetchInterval: ASSIGNMENT_REFETCH_INTERVAL
    });
    await tasClient.initializePromise;
    tasClient.initialFetch.then(() => {
      if (generation !== this.setupGeneration) {
        return;
      }
      this.networkInitialized = true;
      this.logFetchLatency("initial", fetchStopWatch.elapsed());
    }).catch(() => void 0);
    return tasClient;
  }
  logFetchLatency(fetchType, durationMs) {
    this.telemetryService.publicLog2("tasClientFetchLatency", {
      fetchType,
      durationMs
    });
  }
  async refetchAssignments() {
    if (!this.tasClient) {
      return;
    }
    const tasClient = await this.tasClient;
    await tasClient.initialFetch;
    const refetchStopWatch = StopWatch.create();
    await tasClient.getTreatmentVariableAsync("vscode", "refresh", false);
    this.logFetchLatency("refetch", refetchStopWatch.elapsed());
  }
  async getCurrentExperiments() {
    if (!this.tasClient) {
      return void 0;
    }
    if (!this.experimentsEnabled) {
      return void 0;
    }
    await this.tasClient;
    return this.telemetry.assignmentContext;
  }
  addTelemetryAssignmentFilter(filter) {
    this.contextFilter.addFilter(filter);
  }
  /** Stops a TAS client's auto-polling once it resolves. Safe to call with `undefined`. */
  static disposeTasClient(client) {
    client?.then((c) => c.dispose()).catch(() => void 0);
  }
};
WorkbenchAssignmentService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IDefaultAccountService),
  __decorateParam(7, IRequestService)
], WorkbenchAssignmentService);
registerSingleton(IWorkbenchAssignmentService, WorkbenchAssignmentService, InstantiationType.Delayed);
const registry = Registry.as(ConfigurationExtensions.Configuration);
registry.registerConfiguration({
  ...workbenchConfigurationNodeBase,
  "properties": {
    "workbench.enableExperiments": {
      "type": "boolean",
      "description": localize("workbench.enableExperiments", "Fetches experiments to run from a Microsoft online service."),
      "default": true,
      "scope": ConfigurationScope.APPLICATION,
      "restricted": true,
      "tags": ["usesOnlineServices"]
    }
  }
});
export {
  IWorkbenchAssignmentService,
  WorkbenchAssignmentService
};
