import { hostname, release } from "os";
import { Disposable, isDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { joinPath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { getDevDeviceId, getMachineId, getSqmMachineId } from "../../../base/node/id.js";
import { ConfigurationService } from "../../configuration/common/configurationService.js";
import { NullPolicyService } from "../../policy/common/policy.js";
import { OneDataSystemAppender } from "../../telemetry/node/1dsAppender.js";
import { resolveCommonProperties } from "../../telemetry/common/commonProperties.js";
import { TelemetryLevel } from "../../telemetry/common/telemetry.js";
import { TelemetryLogAppender } from "../../telemetry/common/telemetryLogAppender.js";
import { TelemetryService } from "../../telemetry/common/telemetryService.js";
import { getPiiPathsFromEnvironment, isInternalTelemetry, isLoggingOnly, NullTelemetryService, supportsTelemetry } from "../../telemetry/common/telemetryUtils.js";
import { AgentHostTelemetryLevelConfigKey, agentHostConfigValueToTelemetryLevel } from "../common/agentHostSchema.js";
import { AgentHostDevDeviceIdEnvKey, AgentHostMachineIdEnvKey, AgentHostSqmIdEnvKey } from "../common/agentHostTelemetryEnv.js";
import { AgentHostRestrictedTelemetrySender } from "./agentHostRestrictedTelemetry.js";
import { AgentHostInternalTelemetrySender } from "./agentHostMicrosoftTelemetry.js";
class AgentHostTelemetryService extends Disposable {
  constructor(_delegate, _restricted, copilotSdkVersion, copilotRuntimeVersion) {
    super();
    this._delegate = _delegate;
    this._restricted = _restricted;
    this._telemetryLevel = TelemetryLevel.USAGE;
    /**
     * Whether the current Copilot token opts into enhanced/restricted telemetry (`rt=1`). Defaults
     * to `false` so nothing restricted is sent until an authenticated token confirms the opt-in,
     * keeping public users off the enhanced pipeline the way the Copilot extension does.
     */
    this._restrictedTelemetryEnabled = false;
    this._internalTelemetryEnabled = false;
    if (isDisposable(_delegate)) {
      this._register(_delegate);
    }
    if (copilotSdkVersion) {
      this._delegate.setCommonProperty("common.copilotSdkVersion", copilotSdkVersion);
    }
    if (copilotRuntimeVersion) {
      this._delegate.setCommonProperty("common.copilotRuntimeVersion", copilotRuntimeVersion);
    }
  }
  get telemetryLevel() {
    return Math.min(this._delegate.telemetryLevel, this._telemetryLevel);
  }
  get sendErrorTelemetry() {
    return this.telemetryLevel >= TelemetryLevel.ERROR && this._delegate.sendErrorTelemetry;
  }
  get sessionId() {
    return this._delegate.sessionId;
  }
  get machineId() {
    return this._delegate.machineId;
  }
  get sqmId() {
    return this._delegate.sqmId;
  }
  get devDeviceId() {
    return this._delegate.devDeviceId;
  }
  get firstSessionDate() {
    return this._delegate.firstSessionDate;
  }
  get msftInternal() {
    return this._delegate.msftInternal;
  }
  publicLog(eventName, data) {
    if (this.telemetryLevel < TelemetryLevel.USAGE) {
      return;
    }
    this._delegate.publicLog(eventName, data);
  }
  publicLogError(eventName, data) {
    if (this.telemetryLevel < TelemetryLevel.ERROR) {
      return;
    }
    this._delegate.publicLogError(eventName, data);
  }
  publicLog2(eventName, data) {
    if (this.telemetryLevel < TelemetryLevel.USAGE) {
      return;
    }
    this._delegate.publicLog2(eventName, data);
  }
  publicLogError2(eventName, data) {
    if (this.telemetryLevel < TelemetryLevel.ERROR) {
      return;
    }
    this._delegate.publicLogError2(eventName, data);
  }
  sendGHTelemetryEvent(eventName, properties, measurements) {
    if (this.telemetryLevel < TelemetryLevel.USAGE) {
      return;
    }
    this._restricted?.sendGHTelemetryEvent(eventName, properties, measurements);
  }
  sendEnhancedGHTelemetryEvent(eventName, properties, measurements) {
    if (this.telemetryLevel < TelemetryLevel.USAGE || !this._restrictedTelemetryEnabled) {
      return;
    }
    this._restricted?.sendEnhancedGHTelemetryEvent(eventName, properties, measurements);
  }
  sendEnhancedGHTelemetryEventForContext(context, eventName, properties, measurements) {
    if (this.telemetryLevel < TelemetryLevel.USAGE || !context.restrictedTelemetryEnabled) {
      return;
    }
    this._restricted?.sendEnhancedGHTelemetryEventForContext(context, eventName, properties, measurements);
  }
  sendInternalMSFTTelemetryEvent(eventName, properties, measurements) {
    if (this.telemetryLevel < TelemetryLevel.USAGE || !this._internalTelemetryEnabled) {
      return;
    }
    this._restricted?.sendInternalMSFTTelemetryEvent(eventName, properties, measurements);
  }
  sendInternalMSFTTelemetryEventForContext(context, eventName, properties, measurements) {
    if (this.telemetryLevel < TelemetryLevel.USAGE || !context.isInternal) {
      return;
    }
    this._restricted?.sendInternalMSFTTelemetryEventForContext(context, eventName, properties, measurements);
  }
  setCopilotTrackingId(trackingId) {
    this._restricted?.setCopilotTrackingId(trackingId);
  }
  setRestrictedTelemetryEndpoint(endpointUrl) {
    this._restricted?.setRestrictedTelemetryEndpoint(endpointUrl);
  }
  setRestrictedTelemetryEnabled(enabled) {
    this._restrictedTelemetryEnabled = enabled;
    this._restricted?.setRestrictedTelemetryEnabled(enabled);
  }
  setInternalTelemetryContext(context) {
    this._internalTelemetryEnabled = context?.isInternal === true;
    this._restricted?.setInternalTelemetryContext(context);
  }
  setExperimentProperty(name, value) {
    this._delegate.setExperimentProperty(name, value);
  }
  setCommonProperty(name, value) {
    this._delegate.setCommonProperty(name, value);
  }
  updateTelemetryLevel(telemetryLevel) {
    this._telemetryLevel = Math.min(this._telemetryLevel, telemetryLevel);
  }
}
function updateAgentHostTelemetryLevelFromConfig(telemetryService, config) {
  const telemetryLevel = config?.[AgentHostTelemetryLevelConfigKey];
  const telemetryLevelValue = agentHostConfigValueToTelemetryLevel(telemetryLevel);
  if (!isAgentHostTelemetryService(telemetryService) || telemetryLevelValue === void 0) {
    return;
  }
  telemetryService.updateTelemetryLevel(telemetryLevelValue);
}
function isAgentHostTelemetryService(telemetryService) {
  return typeof telemetryService.updateTelemetryLevel === "function";
}
async function resolveCopilotExtensionVersion(environmentService, fileService, logService) {
  if (!environmentService.builtinExtensionsPath) {
    return void 0;
  }
  try {
    const manifest = JSON.parse((await fileService.readFile(joinPath(URI.file(environmentService.builtinExtensionsPath), "copilot", "package.json"))).value.toString());
    return typeof manifest.version === "string" ? manifest.version : void 0;
  } catch (error) {
    logService.debug(`[agentHostTelemetry] Failed to resolve Copilot extension version: ${error instanceof Error ? error.message : String(error)}`);
    return void 0;
  }
}
async function createAgentHostTelemetryService(options) {
  const { environmentService, productService, fileService, loggerService, logService, disposables } = options;
  if (options.disableTelemetry || !loggerService || !supportsTelemetry(productService, environmentService)) {
    return disposables.add(new AgentHostTelemetryService(NullTelemetryService));
  }
  const configurationService = disposables.add(new ConfigurationService(joinPath(environmentService.appSettingsHome, "settings.json"), fileService, new NullPolicyService(), logService));
  await configurationService.initialize();
  const appenders = [
    disposables.add(new TelemetryLogAppender("", false, loggerService, environmentService, productService))
  ];
  const internalTelemetry = isInternalTelemetry(productService, configurationService);
  const loggingOnly = isLoggingOnly(productService, environmentService);
  if (!loggingOnly && productService.aiConfig?.ariaKey) {
    const collectorAppender = new OneDataSystemAppender(options.requestService, internalTelemetry, "monacoworkbench", null, productService.aiConfig.ariaKey);
    disposables.add(toDisposable(() => {
      void collectorAppender.flush();
    }));
    appenders.push(collectorAppender);
  }
  const [machineId, sqmId, devDeviceId] = await Promise.all([
    process.env[AgentHostMachineIdEnvKey] || getMachineId((error) => logService.error(error)),
    process.env[AgentHostSqmIdEnvKey] || getSqmMachineId((error) => logService.error(error)),
    process.env[AgentHostDevDeviceIdEnvKey] || getDevDeviceId((error) => logService.error(error))
  ]);
  const commonProperties = resolveCommonProperties(release(), hostname(), process.arch, productService.commit, productService.version, machineId, sqmId, devDeviceId, internalTelemetry, productService.date);
  const telemetryService = new TelemetryService({
    appenders,
    sendErrorTelemetry: true,
    commonProperties,
    piiPaths: getPiiPathsFromEnvironment(environmentService)
  }, configurationService, productService);
  const extensionVersion = loggingOnly ? void 0 : await resolveCopilotExtensionVersion(environmentService, fileService, logService);
  const internalSender = loggingOnly ? void 0 : disposables.add(new AgentHostInternalTelemetrySender({ requestService: options.requestService, commonProperties, extensionVersion }));
  const restricted = loggingOnly ? void 0 : new AgentHostRestrictedTelemetrySender(commonProperties, logService, void 0, internalSender, options.fetchFn);
  return disposables.add(new AgentHostTelemetryService(telemetryService, restricted, productService.copilotVersions?.sdk, productService.copilotVersions?.runtime));
}
export {
  AgentHostTelemetryService,
  createAgentHostTelemetryService,
  isAgentHostTelemetryService,
  updateAgentHostTelemetryLevelFromConfig
};
