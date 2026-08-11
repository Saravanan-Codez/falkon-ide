var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { EnablementState } from "../../../services/extensionManagement/common/extensionManagement.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
let BracketPairColorizer2TelemetryContribution = class {
  constructor(configurationService, extensionsWorkbenchService, telemetryService) {
    this.configurationService = configurationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.telemetryService = telemetryService;
    this.init().catch(onUnexpectedError);
  }
  async init() {
    const bracketPairColorizerId = "coenraads.bracket-pair-colorizer-2";
    await this.extensionsWorkbenchService.queryLocal();
    const extension = this.extensionsWorkbenchService.installed.find((e) => e.identifier.id === bracketPairColorizerId);
    if (!extension || extension.enablementState !== EnablementState.EnabledGlobally && extension.enablementState !== EnablementState.EnabledWorkspace) {
      return;
    }
    const nativeBracketPairColorizationEnabledKey = "editor.bracketPairColorization.enabled";
    const nativeColorizationEnabled = !!this.configurationService.getValue(nativeBracketPairColorizationEnabledKey);
    this.telemetryService.publicLog2("bracketPairColorizerTwoUsage", {
      nativeColorizationEnabled
    });
  }
};
BracketPairColorizer2TelemetryContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, ITelemetryService)
], BracketPairColorizer2TelemetryContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(BracketPairColorizer2TelemetryContribution, LifecyclePhase.Restored);
