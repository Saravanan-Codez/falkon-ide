import { localize, localize2 } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { METERED_CONNECTION_SETTING_KEY } from "../../../../platform/meteredConnection/common/meteredConnection.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { MeteredConnectionStatusContribution } from "./meteredConnectionStatus.js";
import "../../../../platform/meteredConnection/common/meteredConnection.config.contribution.js";
registerWorkbenchContribution2(MeteredConnectionStatusContribution.ID, MeteredConnectionStatusContribution, WorkbenchPhase.AfterRestored);
registerAction2(class ConfigureMeteredConnectionAction extends Action2 {
  static {
    this.ID = "workbench.action.configureMeteredConnection";
  }
  constructor() {
    super({
      id: ConfigureMeteredConnectionAction.ID,
      title: localize2("configureMeteredConnection", "Configure Metered Connection"),
      f1: true
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    const currentValue = configurationService.getValue(METERED_CONNECTION_SETTING_KEY);
    const picks = [
      {
        value: "auto",
        label: localize("meteredConnection.auto", "Auto"),
        description: localize("meteredConnection.auto.description", "Detect metered connections automatically"),
        picked: currentValue === "auto"
      },
      {
        value: "on",
        label: localize("meteredConnection.on", "On"),
        description: localize("meteredConnection.on.description", "Always treat the connection as metered"),
        picked: currentValue === "on"
      },
      {
        value: "off",
        label: localize("meteredConnection.off", "Off"),
        description: localize("meteredConnection.off.description", "Never treat the connection as metered"),
        picked: currentValue === "off"
      }
    ];
    const pick = await quickInputService.pick(picks, {
      placeHolder: localize("meteredConnection.placeholder", "Select Metered Connection Mode"),
      activeItem: picks.find((p) => p.picked)
    });
    if (pick) {
      await configurationService.updateValue(METERED_CONNECTION_SETTING_KEY, pick.value);
    }
  }
});
