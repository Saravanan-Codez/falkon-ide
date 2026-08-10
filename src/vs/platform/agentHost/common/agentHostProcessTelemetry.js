import { packErrorForTelemetry } from "../../telemetry/common/errorTelemetry.js";
function reportAgentHostProcessError(telemetryService, data, error) {
  const errorData = error === void 0 ? void 0 : packErrorForTelemetry(error);
  telemetryService.publicLogError2("agentHost.processError", {
    ...data,
    isError: true,
    ...errorData ? { callstack: errorData.callstack, msg: errorData.msg } : {}
  });
}
export {
  reportAgentHostProcessError
};
