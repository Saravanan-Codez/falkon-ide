import "./media/aquarium.css";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { AquariumService, IAquariumService, SESSIONS_DEVELOPER_JOY_ENABLED_SETTING } from "./aquariumOverlay.js";
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "sessions",
  properties: {
    [SESSIONS_DEVELOPER_JOY_ENABLED_SETTING]: {
      type: "boolean",
      default: true,
      description: localize("sessions.developerJoy.enabled", "Adds an easter egg to the Agents window."),
      tags: ["experimental"]
    }
  }
});
registerSingleton(IAquariumService, AquariumService, InstantiationType.Delayed);
class SimulateFishFeedingStreakAction extends Action2 {
  static {
    this.ID = "sessions.aquarium.simulateStreak";
  }
  constructor() {
    super({
      id: SimulateFishFeedingStreakAction.ID,
      title: localize2("aquarium.simulateStreak", "Simulate Fish Feeding Streak"),
      f1: true,
      category: Categories.Developer
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const aquariumService = accessor.get(IAquariumService);
    const aliveItem = { id: "alive", label: localize("aquarium.simulateStreak.alive", "Alive streak"), detail: localize("aquarium.simulateStreak.aliveDetail", "Show a live feeding streak in the toggle tooltip.") };
    const diedItem = { id: "died", label: localize("aquarium.simulateStreak.died", "Died streak (revivable)"), detail: localize("aquarium.simulateStreak.diedDetail", "Park a died streak and offer the revival prompt.") };
    const clearItem = { id: "clear", label: localize("aquarium.simulateStreak.clear", "Clear streak"), detail: localize("aquarium.simulateStreak.clearDetail", "Remove all streak state.") };
    const scenario = await quickInputService.pick([aliveItem, diedItem, clearItem], {
      placeHolder: localize("aquarium.simulateStreak.placeholder", "Pick a streak scenario to simulate")
    });
    if (!scenario) {
      return;
    }
    if (scenario.id === "clear") {
      aquariumService.simulateStreak(0, true);
      return;
    }
    const raw = await quickInputService.input({
      value: "30",
      prompt: localize("aquarium.simulateStreak.countPrompt", "How many days should the streak be?"),
      validateInput: async (value) => {
        const n = Number(value);
        return !Number.isInteger(n) || n <= 0 ? localize("aquarium.simulateStreak.countInvalid", "Enter a whole number greater than 0.") : void 0;
      }
    });
    if (raw === void 0) {
      return;
    }
    aquariumService.simulateStreak(Number(raw), scenario.id === "alive");
  }
}
registerAction2(SimulateFishFeedingStreakAction);
class ToggleAquariumActionVisibilityAction extends Action2 {
  static {
    this.ID = "sessions.aquarium.toggleActionVisibility";
  }
  constructor() {
    super({
      id: ToggleAquariumActionVisibilityAction.ID,
      title: localize2("aquarium.toggleActionVisibility", "Toggle Aquarium Action Visibility"),
      f1: true,
      category: Categories.Developer
    });
  }
  run(accessor) {
    accessor.get(IAquariumService).toggleActionVisibility();
  }
}
registerAction2(ToggleAquariumActionVisibilityAction);
