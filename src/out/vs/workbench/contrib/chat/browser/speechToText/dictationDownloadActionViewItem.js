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
import { Codicon } from "../../../../../base/common/codicons.js";
import { MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { MenuEntryActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IChatSpeechToTextService } from "./chatSpeechToTextService.js";
import { DictationDownloadRing, getDictationDownloadHoverContent } from "./dictationDownloadRing.js";
import { addMicButtonContextMenuListener, getDictationContextMenuActions } from "./micButtonMenuActions.js";
const TOGGLE_DICTATION_COMMAND_ID = "workbench.action.chat.toggleSpeechToText";
let DictationDownloadActionViewItem = class extends MenuEntryActionViewItem {
  constructor(action, options, _speechToTextService, _commandService, _configurationService, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService) {
    super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
    this._speechToTextService = _speechToTextService;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._ring = this._register(new MutableDisposable());
  }
  render(container) {
    super.render(container);
    container.classList.add("dictation-download-item");
    this._applyState();
    this._register(this._speechToTextService.onDidChangeDownloadingModel(() => this._applyState()));
    this._register(addMicButtonContextMenuListener(
      container,
      () => getDictationContextMenuActions(this._commandService, this._configurationService, this._keybindingService, TOGGLE_DICTATION_COMMAND_ID),
      this._contextMenuService
    ));
  }
  updateClass() {
    super.updateClass();
    this._applyState();
  }
  _applyState() {
    if (!this.label) {
      return;
    }
    if (this._speechToTextService.isDownloadingModel) {
      this.label.classList.remove(...ThemeIcon.asClassNameArray(Codicon.loadingCompact));
      this.label.classList.add(...ThemeIcon.asClassNameArray(Codicon.micDownloadCompact));
      if (!this._ring.value && this.element) {
        this._ring.value = new DictationDownloadRing(this.element, this._speechToTextService);
      }
    } else {
      this.label.classList.remove(...ThemeIcon.asClassNameArray(Codicon.micDownloadCompact));
      this.label.classList.add(...ThemeIcon.asClassNameArray(Codicon.loadingCompact));
      this._ring.clear();
    }
  }
  getHoverContents() {
    return getDictationDownloadHoverContent(this._speechToTextService);
  }
};
DictationDownloadActionViewItem = __decorateClass([
  __decorateParam(2, IChatSpeechToTextService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, IAccessibilityService)
], DictationDownloadActionViewItem);
export {
  DictationDownloadActionViewItem
};
