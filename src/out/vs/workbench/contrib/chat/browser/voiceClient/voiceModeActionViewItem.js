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
import { getVoiceModeHoverContent } from "../speechToText/micButtonHovers.js";
import { addMicButtonContextMenuListener, getVoiceModeContextMenuActions } from "../speechToText/micButtonMenuActions.js";
const VOICE_START_COMMAND = "agentsVoice.startVoiceInChat";
let VoiceModeActionViewItem = class extends MenuEntryActionViewItem {
  constructor(action, options, _commandService, _configurationService, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService) {
    super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
    this._commandService = _commandService;
    this._configurationService = _configurationService;
  }
  render(container) {
    super.render(container);
    this._register(addMicButtonContextMenuListener(
      container,
      () => getVoiceModeContextMenuActions(this._commandService, this._configurationService, this._keybindingService, VOICE_START_COMMAND),
      this._contextMenuService
    ));
  }
  getHoverContents() {
    return getVoiceModeHoverContent(this.getTooltip() ?? "");
  }
};
VoiceModeActionViewItem = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IAccessibilityService)
], VoiceModeActionViewItem);
export {
  VoiceModeActionViewItem
};
