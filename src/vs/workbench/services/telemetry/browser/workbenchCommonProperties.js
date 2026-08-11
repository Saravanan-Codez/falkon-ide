import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import * as Platform from "../../../../base/common/platform.js";
import * as uuid from "../../../../base/common/uuid.js";
import { cleanRemoteAuthority } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { mixin } from "../../../../base/common/objects.js";
import { firstSessionDateStorageKey, lastSessionDateStorageKey, machineIdKey } from "../../../../platform/telemetry/common/telemetry.js";
import { Gesture } from "../../../../base/browser/touch.js";
function cleanUserAgent(userAgent) {
  return userAgent.replace(/(\d+\.\d+)(\.\d+)+/g, "$1");
}
function resolveWorkbenchCommonProperties(storageService, productService, environmentService, isInternalTelemetry, resolveAdditionalProperties) {
  const { commit, version, embedderIdentifier: productIdentifier, removeTelemetryMachineId: removeMachineId } = productService ?? {};
  const result = /* @__PURE__ */ Object.create(null);
  const firstSessionDate = storageService.get(firstSessionDateStorageKey, StorageScope.APPLICATION);
  const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.APPLICATION);
  let machineId;
  if (!removeMachineId) {
    machineId = storageService.get(machineIdKey, StorageScope.APPLICATION);
    if (!machineId) {
      machineId = uuid.generateUuid();
      storageService.store(machineIdKey, machineId, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  } else {
    machineId = `Redacted-${productIdentifier ?? "web"}`;
  }
  result["common.firstSessionDate"] = firstSessionDate;
  result["common.lastSessionDate"] = lastSessionDate || "";
  result["common.isNewSession"] = !lastSessionDate ? "1" : "0";
  result["common.remoteAuthority"] = cleanRemoteAuthority(environmentService.remoteAuthority, productService);
  result["common.machineId"] = machineId;
  result["sessionID"] = uuid.generateUuid() + Date.now();
  result["commitHash"] = commit;
  result["version"] = version;
  result["common.platform"] = Platform.PlatformToString(Platform.platform);
  result["common.product"] = productIdentifier ?? "web";
  result["common.userAgent"] = Platform.userAgent ? cleanUserAgent(Platform.userAgent) : void 0;
  result["common.isTouchDevice"] = String(Gesture.isTouchDevice());
  if (isInternalTelemetry) {
    result["common.msftInternal"] = isInternalTelemetry;
  }
  let seq = 0;
  const startTime = Date.now();
  Object.defineProperties(result, {
    // __GDPR__COMMON__ "timestamp" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    "timestamp": {
      get: () => /* @__PURE__ */ new Date(),
      enumerable: true
    },
    // __GDPR__COMMON__ "common.timesincesessionstart" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
    "common.timesincesessionstart": {
      get: () => Date.now() - startTime,
      enumerable: true
    },
    // __GDPR__COMMON__ "common.sequence" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
    "common.sequence": {
      get: () => seq++,
      enumerable: true
    }
  });
  if (resolveAdditionalProperties) {
    mixin(result, resolveAdditionalProperties());
  }
  if (environmentService.isSessionsWindow) {
    result["common.isAgentsWindow"] = true;
  }
  return result;
}
export {
  resolveWorkbenchCommonProperties
};
