import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
Registry.as(Extensions.Configuration).registerDefaultConfigurations([{
  overrides: {
    "chat.customizationsMenu.userStoragePath": "~/.copilot",
    "github.copilot.chat.claudeCode.enabled": true
  },
  donotCache: true,
  preventExperimentOverride: true,
  source: "sessionsDefaults"
}]);
