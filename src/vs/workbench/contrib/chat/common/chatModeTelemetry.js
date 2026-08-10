import { getModeNameForTelemetry } from "./chatModes.js";
import { isInClaudeAgentsFolder } from "./promptSyntax/config/promptFileLocations.js";
function reportChatModeChange(telemetryService, currentMode, targetMode, requestCount) {
  if (currentMode.id === targetMode.id) {
    return;
  }
  const storage = targetMode.source?.storage ?? "builtin";
  const extensionId = targetMode.source?.storage === "extension" ? targetMode.source.extensionId.value : void 0;
  const modeUri = targetMode.uri?.get();
  telemetryService.publicLog2("chat.modeChange", {
    fromMode: getModeNameForTelemetry(currentMode),
    mode: getModeNameForTelemetry(targetMode),
    requestCount,
    storage,
    extensionId,
    toolsCount: targetMode.customTools?.get()?.length ?? 0,
    handoffsCount: targetMode.handOffs?.get()?.length ?? 0,
    isClaudeAgent: modeUri ? isInClaudeAgentsFolder(modeUri) : void 0
  });
}
export {
  reportChatModeChange
};
