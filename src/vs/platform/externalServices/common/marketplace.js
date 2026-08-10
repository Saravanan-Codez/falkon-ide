import { getServiceMachineId } from "./serviceMachineId.js";
import { TelemetryLevel } from "../../telemetry/common/telemetry.js";
import { getTelemetryLevel, supportsTelemetry } from "../../telemetry/common/telemetryUtils.js";
async function resolveMarketplaceHeaders(version, productService, environmentService, configurationService, fileService, storageService, telemetryService) {
  const headers = {
    "X-Market-Client-Id": `VSCode ${version}`,
    "User-Agent": `VSCode ${version} (${productService.nameShort})`
  };
  if (supportsTelemetry(productService, environmentService) && getTelemetryLevel(configurationService) === TelemetryLevel.USAGE) {
    const serviceMachineId = await getServiceMachineId(environmentService, fileService, storageService);
    headers["X-Market-User-Id"] = serviceMachineId;
    headers["VSCode-SessionId"] = telemetryService.machineId || serviceMachineId;
  }
  return headers;
}
export {
  resolveMarketplaceHeaders
};
