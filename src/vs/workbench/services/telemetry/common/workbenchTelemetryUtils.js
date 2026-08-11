import { TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { getTelemetryLevel } from "../../../../platform/telemetry/common/telemetryUtils.js";
function experimentsEnabled(configurationService, productService, environmentService) {
  return getTelemetryLevel(configurationService) === TelemetryLevel.USAGE && !!productService.tasConfig && !environmentService.disableExperiments && !environmentService.extensionTestsLocationURI && !environmentService.enableSmokeTestDriver && configurationService.getValue("workbench.enableExperiments") === true;
}
export {
  experimentsEnabled
};
