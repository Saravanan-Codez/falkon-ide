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
import { URI } from "../../../../../base/common/uri.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { localize } from "../../../../../nls.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IWorkbenchLayoutService } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { ChatConfiguration, ChatPermissionLevel } from "../../../../../workbench/contrib/chat/common/constants.js";
import { DEFAULT_PERMISSION_LEVELS, PermissionPicker } from "./permissionPicker.js";
import { isPhoneLayout } from "../../../../browser/parts/mobile/mobileLayout.js";
import { showMobilePickerSheet } from "../../../../browser/parts/mobile/mobilePickerSheet.js";
const LEARN_MORE_ID = "learn-more";
let MobilePermissionPicker = class extends PermissionPicker {
  constructor(_delegate, actionWidgetService, configurationService, dialogService, openerService, storageService, telemetryService, hoverService, _layoutService) {
    super(_delegate, actionWidgetService, configurationService, dialogService, openerService, storageService, telemetryService, hoverService);
    this._layoutService = _layoutService;
  }
  showPicker() {
    if (!this._triggerElement || this.actionWidgetService.isVisible || this._isResolving()) {
      return;
    }
    if (!isPhoneLayout(this._layoutService)) {
      super.showPicker();
      return;
    }
    const policyRestricted = this.configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
    const levels = this._delegate.availableLevels ?? DEFAULT_PERMISSION_LEVELS;
    const items = levels.map((level) => {
      const meta = this._getPermissionLevelMeta(level);
      return {
        id: level,
        label: meta.label,
        description: meta.detail,
        icon: meta.icon,
        checked: this._currentLevel === level,
        // Default is never policy-restricted; elevated levels are
        // disabled when enterprise policy turns off auto-approval.
        ...level !== ChatPermissionLevel.Default && policyRestricted ? { disabled: true } : {}
      };
    });
    items.push({
      id: LEARN_MORE_ID,
      label: localize("permissions.learnMore", "Learn more about permissions"),
      icon: Codicon.linkExternal,
      sectionTitle: ""
    });
    const trigger = this._triggerElement;
    trigger.setAttribute("aria-expanded", "true");
    showMobilePickerSheet(
      this._layoutService.mainContainer,
      localize("permissionPicker.title", "Approvals"),
      items
    ).then(async (id) => {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
      if (!id) {
        return;
      }
      if (id === LEARN_MORE_ID) {
        await this.openerService.open(URI.parse("https://aka.ms/vscode/docs/permissions"));
        return;
      }
      await this._selectLevel(id);
    });
  }
};
MobilePermissionPicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IHoverService),
  __decorateParam(8, IWorkbenchLayoutService)
], MobilePermissionPicker);
export {
  MobilePermissionPicker
};
