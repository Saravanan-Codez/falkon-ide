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
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { MenuEntryActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IChatSpeechToTextService } from "./chatSpeechToTextService.js";
import { setupDictationMicGlow } from "./dictationMicGlow.js";
import { getDictationHoverContent } from "./micButtonHovers.js";
import { addMicButtonContextMenuListener, getDictationContextMenuActions } from "./micButtonMenuActions.js";
let DictationActionViewItem = class extends MenuEntryActionViewItem {
  constructor(action, options, _commandService, _configurationService, keybindingService, notificationService, contextKeyService, _dictationThemeService, contextMenuService, _dictationAccessibilityService, _speechToTextService) {
    super(action, options, keybindingService, notificationService, contextKeyService, _dictationThemeService, contextMenuService, _dictationAccessibilityService);
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._dictationThemeService = _dictationThemeService;
    this._dictationAccessibilityService = _dictationAccessibilityService;
    this._speechToTextService = _speechToTextService;
  }
  render(container) {
    super.render(container);
    this._register(addMicButtonContextMenuListener(
      container,
      () => getDictationContextMenuActions(this._commandService, this._configurationService, this._keybindingService, this._action.id),
      this._contextMenuService
    ));
    this._register(setupDictationMicGlow(container, this._speechToTextService, this._dictationAccessibilityService, void 0, this._dictationThemeService));
  }
  getHoverContents() {
    return getDictationHoverContent(this.getTooltip() ?? "", this._configurationService);
  }
};
DictationActionViewItem = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IAccessibilityService),
  __decorateParam(10, IChatSpeechToTextService)
], DictationActionViewItem);
export {
  DictationActionViewItem
};
