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
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { QuickInputService as BaseQuickInputService } from "../../../../platform/quickinput/browser/quickInputService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { InQuickPickContextKey } from "../../../browser/quickaccess.js";
let QuickInputService = class extends BaseQuickInputService {
  constructor(configurationService, instantiationService, keybindingService, contextKeyService, themeService, layoutService) {
    super(instantiationService, contextKeyService, themeService, layoutService, configurationService);
    this.keybindingService = keybindingService;
    this.inQuickInputContext = InQuickPickContextKey.bindTo(this.contextKeyService);
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.onShow(() => this.inQuickInputContext.set(true)));
    this._register(this.onHide(() => this.inQuickInputContext.set(false)));
  }
  createController() {
    return super.createController(this.layoutService, {
      ignoreFocusOut: () => !this.configurationService.getValue("workbench.quickOpen.closeOnFocusLost"),
      backKeybindingLabel: () => this.keybindingService.lookupKeybinding("workbench.action.quickInputBack")?.getLabel() || void 0
    });
  }
};
QuickInputService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, ILayoutService)
], QuickInputService);
registerSingleton(IQuickInputService, QuickInputService, InstantiationType.Delayed);
export {
  QuickInputService
};
