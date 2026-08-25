import { registerSharedProcessRemoteService } from "../../ipc/electron-browser/services.js";
import { ICustomEndpointTelemetryService } from "../common/telemetry.js";
registerSharedProcessRemoteService(ICustomEndpointTelemetryService, "customEndpointTelemetry");
