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
import { IAccessibilityService, AccessibilitySupport } from "../../../../platform/accessibility/common/accessibility.js";
import { isWindows, isLinux } from "../../../../base/common/platform.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AccessibilityService } from "../../../../platform/accessibility/browser/accessibilityService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
let NativeAccessibilityService = class extends AccessibilityService {
  constructor(environmentService, contextKeyService, configurationService, _layoutService, _telemetryService, nativeHostService) {
    super(contextKeyService, _layoutService, configurationService);
    this._telemetryService = _telemetryService;
    this.nativeHostService = nativeHostService;
    this.didSendTelemetry = false;
    this.shouldAlwaysUnderlineAccessKeys = void 0;
    this.setAccessibilitySupport(environmentService.window.accessibilitySupport ? AccessibilitySupport.Enabled : AccessibilitySupport.Disabled);
  }
  async alwaysUnderlineAccessKeys() {
    if (!isWindows) {
      return false;
    }
    if (typeof this.shouldAlwaysUnderlineAccessKeys !== "boolean") {
      const windowsKeyboardAccessibility = await this.nativeHostService.windowsGetStringRegKey("HKEY_CURRENT_USER", "Control Panel\\Accessibility\\Keyboard Preference", "On");
      this.shouldAlwaysUnderlineAccessKeys = windowsKeyboardAccessibility === "1";
    }
    return this.shouldAlwaysUnderlineAccessKeys;
  }
  setAccessibilitySupport(accessibilitySupport) {
    super.setAccessibilitySupport(accessibilitySupport);
    if (!this.didSendTelemetry && accessibilitySupport === AccessibilitySupport.Enabled) {
      this._telemetryService.publicLog2("accessibility", { enabled: true });
      this.didSendTelemetry = true;
    }
  }
};
NativeAccessibilityService = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILayoutService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, INativeHostService)
], NativeAccessibilityService);
registerSingleton(IAccessibilityService, NativeAccessibilityService, InstantiationType.Delayed);
let LinuxAccessibilityContribution = class {
  static {
    this.ID = "workbench.contrib.linuxAccessibility";
  }
  constructor(jsonEditingService, accessibilityService, environmentService) {
    const forceRendererAccessibility = () => {
      if (accessibilityService.isScreenReaderOptimized()) {
        jsonEditingService.write(environmentService.argvResource, [{ path: ["force-renderer-accessibility"], value: true }], true);
      }
    };
    forceRendererAccessibility();
    accessibilityService.onDidChangeScreenReaderOptimized(forceRendererAccessibility);
  }
};
LinuxAccessibilityContribution = __decorateClass([
  __decorateParam(0, IJSONEditingService),
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, INativeWorkbenchEnvironmentService)
], LinuxAccessibilityContribution);
if (isLinux) {
  registerWorkbenchContribution2(LinuxAccessibilityContribution.ID, LinuxAccessibilityContribution, WorkbenchPhase.BlockRestore);
}
export {
  NativeAccessibilityService
};
