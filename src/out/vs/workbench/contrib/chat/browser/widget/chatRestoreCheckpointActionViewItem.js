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
import * as dom from "../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { MenuEntryActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
let ChatRestoreCheckpointActionViewItem = class extends MenuEntryActionViewItem {
  constructor(action, options, _needsConfirmation, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService) {
    super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
    this._needsConfirmation = _needsConfirmation;
    this._confirming = false;
    this._confirmDisposables = this._register(new DisposableStore());
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-restore-checkpoint-item");
    const cancelButton = this._cancelButton = dom.append(container, dom.$("a.action-label.chat-restore-checkpoint-cancel"));
    cancelButton.setAttribute("role", "button");
    cancelButton.tabIndex = -1;
    dom.reset(cancelButton, ...renderLabelWithIcons(`$(close)`));
    const cancelLabel = localize("chat.restoreCheckpoint.cancelTooltip", "Cancel restoring this checkpoint");
    cancelButton.title = cancelLabel;
    cancelButton.setAttribute("aria-label", cancelLabel);
    this._register(dom.addDisposableListener(cancelButton, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this._setConfirming(false);
      this.label?.focus();
    }));
    this._register(dom.addDisposableListener(container, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (!event.equals(KeyCode.Enter) && !event.equals(KeyCode.Space)) {
        return;
      }
      if (this._confirming) {
        dom.EventHelper.stop(e, true);
        this._setConfirming(false);
        void super.onClick(new MouseEvent("click"));
        return;
      }
      if (this._needsConfirmation(this._context)) {
        dom.EventHelper.stop(e, true);
        this._setConfirming(true);
      }
    }));
    this._updateConfirmUI();
  }
  async onClick(event) {
    if (this._confirming) {
      this._setConfirming(false);
      return super.onClick(event);
    }
    if (this._needsConfirmation(this._context)) {
      event.preventDefault();
      event.stopPropagation();
      this._setConfirming(true);
      return;
    }
    return super.onClick(event);
  }
  _setConfirming(value) {
    if (this._confirming === value) {
      return;
    }
    this._confirming = value;
    this._confirmDisposables.clear();
    if (value && this.element) {
      this._confirmDisposables.add(dom.addDisposableListener(this.element, dom.EventType.FOCUS_OUT, (e) => {
        const next = e.relatedTarget;
        if (!next || !this.element?.contains(next)) {
          this._setConfirming(false);
        }
      }));
      this._confirmDisposables.add(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
        const event = new StandardKeyboardEvent(e);
        if (event.equals(KeyCode.Escape)) {
          dom.EventHelper.stop(e, true);
          this._setConfirming(false);
          this.label?.focus();
        }
      }));
    }
    this._updateConfirmUI();
  }
  _updateConfirmUI() {
    this.element?.classList.toggle("confirming", this._confirming);
    this._cancelButton?.classList.toggle("hidden", !this._confirming);
    this.updateLabel();
    this.updateTooltip();
  }
  updateLabel() {
    if (this._confirming && this.label) {
      dom.reset(this.label, ...renderLabelWithIcons(`${localize("chat.restoreCheckpoint.confirm", "Discard Edits")}`));
      return;
    }
    super.updateLabel();
  }
  getTooltip() {
    if (this._confirming) {
      return localize("chat.restoreCheckpoint.confirmTooltip", "Confirm restoring this checkpoint and discarding later edits");
    }
    return super.getTooltip();
  }
};
ChatRestoreCheckpointActionViewItem = __decorateClass([
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IAccessibilityService)
], ChatRestoreCheckpointActionViewItem);
export {
  ChatRestoreCheckpointActionViewItem
};
