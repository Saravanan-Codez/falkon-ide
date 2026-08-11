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
import { timeout } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { TernarySearchTree } from "../../../../base/common/ternarySearchTree.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ExtensionIdentifier, ExtensionIdentifierSet } from "../../../../platform/extensions/common/extensions.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IProfileAnalysisWorkerService } from "../../../../platform/profiling/electron-browser/profileAnalysisWorkerService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { RuntimeExtensionsInput } from "../common/runtimeExtensionsInput.js";
import { createSlowExtensionAction } from "./extensionsSlowActions.js";
import { IExtensionHostProfileService } from "./runtimeExtensionsEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { ExtensionHostKind } from "../../../services/extensions/common/extensionHostKind.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ExtensionHostProfiler } from "../../../services/extensions/electron-browser/extensionHostProfiler.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
let ExtensionsAutoProfiler = class {
  constructor(_extensionService, _extensionProfileService, _telemetryService, _logService, _notificationService, _editorService, _instantiationService, _environmentServie, _profileAnalysisService, _configService, _fileService, timerService) {
    this._extensionService = _extensionService;
    this._extensionProfileService = _extensionProfileService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._environmentServie = _environmentServie;
    this._profileAnalysisService = _profileAnalysisService;
    this._configService = _configService;
    this._fileService = _fileService;
    this._blame = new ExtensionIdentifierSet();
    this._perfBaseline = -1;
    timerService.perfBaseline.then((value) => {
      if (value < 0) {
        return;
      }
      this._perfBaseline = value;
      this._unresponsiveListener = _extensionService.onDidChangeResponsiveChange(this._onDidChangeResponsiveChange, this);
    });
  }
  dispose() {
    this._unresponsiveListener?.dispose();
    this._session?.dispose(true);
  }
  async _onDidChangeResponsiveChange(event) {
    if (event.extensionHostKind !== ExtensionHostKind.LocalProcess) {
      return;
    }
    const listener = await event.getInspectListener(true);
    if (!listener) {
      return;
    }
    if (event.isResponsive && this._session) {
      this._session.cancel();
      this._logService.info("UNRESPONSIVE extension host: received responsive event and cancelling profiling session");
    } else if (!event.isResponsive && !this._session) {
      const cts = new CancellationTokenSource();
      this._session = cts;
      let session;
      try {
        session = await this._instantiationService.createInstance(ExtensionHostProfiler, listener.host, listener.port).start();
      } catch (err) {
        this._session = void 0;
        return;
      }
      this._logService.info("UNRESPONSIVE extension host: starting to profile NOW");
      try {
        await timeout(5e3, cts.token);
      } catch {
      }
      try {
        this._processCpuProfile(await session.stop());
      } catch (err) {
        onUnexpectedError(err);
      } finally {
        this._session = void 0;
      }
    }
  }
  async _processCpuProfile(profile) {
    await this._extensionService.whenInstalledExtensionsRegistered();
    if (this._configService.getValue("application.experimental.rendererProfiling")) {
      const searchTree = TernarySearchTree.forUris();
      searchTree.fill(this._extensionService.extensions.map((e) => [e.extensionLocation, e]));
      await this._profileAnalysisService.analyseBottomUp(
        profile.data,
        (url) => searchTree.findSubstr(URI.parse(url))?.identifier.value ?? "<<not-found>>",
        this._perfBaseline,
        false
      );
    }
    const categories = this._extensionService.extensions.filter((e) => e.extensionLocation.scheme === Schemas.file).map((e) => [e.extensionLocation, ExtensionIdentifier.toKey(e.identifier)]);
    const data = await this._profileAnalysisService.analyseByLocation(profile.data, categories);
    let overall = 0;
    let top = "";
    let topAggregated = -1;
    for (const [category, aggregated] of data) {
      overall += aggregated;
      if (aggregated > topAggregated) {
        topAggregated = aggregated;
        top = category;
      }
    }
    const topPercentage = topAggregated / (overall / 100);
    const extension = await this._extensionService.getExtension(top);
    if (!extension) {
      return;
    }
    const profilingSessionId = generateUuid();
    const path = joinPath(this._environmentServie.tmpDir, `exthost-${Math.random().toString(16).slice(2, 8)}.cpuprofile`);
    await this._fileService.writeFile(path, VSBuffer.fromString(JSON.stringify(profile.data)));
    this._logService.warn(`UNRESPONSIVE extension host: '${top}' took ${topPercentage}% of ${topAggregated / 1e3}ms, saved PROFILE here: '${path}'`);
    this._telemetryService.publicLog2("exthostunresponsive", {
      profilingSessionId,
      duration: overall,
      data: data.map((tuple) => tuple[0]).flat(),
      id: ExtensionIdentifier.toKey(extension.identifier)
    });
    this._extensionProfileService.setUnresponsiveProfile(extension.identifier, profile);
    if (!(topPercentage >= 95 && topAggregated >= 5e6)) {
      return;
    }
    const action = await this._instantiationService.invokeFunction(createSlowExtensionAction, extension, profile);
    if (!action) {
      return;
    }
    if (this._blame.has(extension.identifier) || this._blame.size >= 3) {
      return;
    }
    this._blame.add(extension.identifier);
    this._notificationService.prompt(
      Severity.Warning,
      localize(
        "unresponsive-exthost",
        "The extension '{0}' took a very long time to complete its last operation and it has prevented other extensions from running.",
        extension.displayName || extension.name
      ),
      [
        {
          label: localize("show", "Show Extensions"),
          run: () => this._editorService.openEditor(RuntimeExtensionsInput.instance, { pinned: true })
        },
        action
      ],
      { priority: NotificationPriority.SILENT }
    );
  }
};
ExtensionsAutoProfiler = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IExtensionHostProfileService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, ILogService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, INativeWorkbenchEnvironmentService),
  __decorateParam(8, IProfileAnalysisWorkerService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IFileService),
  __decorateParam(11, ITimerService)
], ExtensionsAutoProfiler);
export {
  ExtensionsAutoProfiler
};
