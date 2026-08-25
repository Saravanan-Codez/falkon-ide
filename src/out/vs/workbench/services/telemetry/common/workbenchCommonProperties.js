import { StorageScope } from "../../../../platform/storage/common/storage.js";
import { resolveCommonProperties } from "../../../../platform/telemetry/common/commonProperties.js";
import { firstSessionDateStorageKey, lastSessionDateStorageKey } from "../../../../platform/telemetry/common/telemetry.js";
import { cleanRemoteAuthority } from "../../../../platform/telemetry/common/telemetryUtils.js";
function resolveWorkbenchCommonProperties(storageService, productService, environmentService, release, hostname, machineId, sqmId, devDeviceId, isInternalTelemetry, process) {
  const { commit, version, date: releaseDate } = productService ?? {};
  const result = resolveCommonProperties(release, hostname, process.arch, commit, version, machineId, sqmId, devDeviceId, isInternalTelemetry, releaseDate);
  const firstSessionDate = storageService.get(firstSessionDateStorageKey, StorageScope.APPLICATION);
  const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.APPLICATION);
  result["common.version.shell"] = process.versions?.["electron"];
  result["common.version.renderer"] = process.versions?.["chrome"];
  result["common.firstSessionDate"] = firstSessionDate;
  result["common.lastSessionDate"] = lastSessionDate || "";
  result["common.isNewSession"] = !lastSessionDate ? "1" : "0";
  result["common.remoteAuthority"] = cleanRemoteAuthority(environmentService.remoteAuthority, productService);
  result["common.cli"] = !!process.env["VSCODE_CLI"];
  if (environmentService.isSessionsWindow) {
    result["common.isAgentsWindow"] = true;
  }
  return result;
}
export {
  resolveWorkbenchCommonProperties
};
