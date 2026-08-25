import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
CommandsRegistry.registerCommand("_agentsVoice.setWindowAlwaysOnTop", async (accessor, alwaysOnTop, targetWindowId) => {
  const nativeHostService = accessor.get(INativeHostService);
  await nativeHostService.setWindowAlwaysOnTop(alwaysOnTop, { targetWindowId });
});
CommandsRegistry.registerCommand("_agentsVoice.minimizeWindow", async (accessor, targetWindowId) => {
  const nativeHostService = accessor.get(INativeHostService);
  await nativeHostService.minimizeWindow({ targetWindowId });
});
