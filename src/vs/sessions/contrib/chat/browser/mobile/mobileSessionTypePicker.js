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
import { localize } from "../../../../../nls.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IWorkbenchLayoutService } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { IChatSessionsService } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ILanguageModelsService } from "../../../../../workbench/contrib/chat/common/languageModels.js";
import { getSessionTypeAvailability, getSessionTypeUnavailableLabel, SessionTypeAvailability } from "../../../../../workbench/contrib/chat/browser/agentSessions/sessionTypeAvailability.js";
import { IChatEntitlementService } from "../../../../../workbench/services/chat/common/chatEntitlementService.js";
import { ISessionsManagementService } from "../../../../services/sessions/common/sessionsManagement.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { SessionTypePicker } from "../sessionTypePicker.js";
import { isPhoneLayout } from "../../../../browser/parts/mobile/mobileLayout.js";
import { showMobilePickerSheet } from "../../../../browser/parts/mobile/mobilePickerSheet.js";
let MobileSessionTypePicker = class extends SessionTypePicker {
  constructor(session, options, actionWidgetService, sessionsManagementService, _sessionsProvidersService, storageService, telemetryService, chatSessionsService, chatEntitlementService, languageModelsService, layoutService, contextKeyService) {
    super(session, options, actionWidgetService, sessionsManagementService, _sessionsProvidersService, storageService, telemetryService, chatSessionsService, chatEntitlementService, languageModelsService, contextKeyService);
    this._sessionsProvidersService = _sessionsProvidersService;
    this.layoutService = layoutService;
  }
  render(container, options) {
    super.render(container, options);
  }
  _showPicker() {
    if (!this._triggerElement) {
      return;
    }
    if (!isPhoneLayout(this.layoutService)) {
      super._showPicker();
      return;
    }
    if (this._folderSessionTypes.length <= 1 && this._pickServedByFolder(this._picked)) {
      return;
    }
    const groups = /* @__PURE__ */ new Map();
    for (const folderType of this._folderSessionTypes) {
      const groupTitle = this._sessionsProvidersService.getProvider(folderType.providerId)?.label ?? folderType.providerId;
      const existing = groups.get(groupTitle);
      if (existing) {
        existing.push(folderType);
      } else {
        groups.set(groupTitle, [folderType]);
      }
    }
    const showSectionHeaders = groups.size > 1;
    const sheetItems = [];
    for (const [groupTitle, types] of groups) {
      let isFirstInGroup = true;
      for (const { providerId, sessionType } of types) {
        const availability = getSessionTypeAvailability(this.chatSessionsService, this.chatEntitlementService, this.languageModelsService, sessionType.chatSessionType ?? sessionType.id);
        sheetItems.push({
          id: `${providerId}\0${sessionType.id}`,
          label: sessionType.label,
          icon: sessionType.icon,
          checked: providerId === this._picked?.providerId && sessionType.id === this._picked?.sessionTypeId,
          disabled: availability !== SessionTypeAvailability.Available,
          description: getSessionTypeUnavailableLabel(availability),
          sectionTitle: showSectionHeaders && isFirstInGroup ? groupTitle : void 0
        });
        isFirstInGroup = false;
      }
    }
    const trigger = this._triggerElement;
    trigger.setAttribute("aria-expanded", "true");
    showMobilePickerSheet(
      this.layoutService.mainContainer,
      localize("mobileSessionTypePicker.title", "Session Type"),
      sheetItems
    ).then((id) => {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
      if (id !== void 0) {
        const [providerId, sessionTypeId] = id.split("\0");
        if (providerId && sessionTypeId) {
          this._handleSelectedSessionType({ providerId, sessionTypeId });
        }
      }
    });
  }
};
MobileSessionTypePicker = __decorateClass([
  __decorateParam(2, IActionWidgetService),
  __decorateParam(3, ISessionsManagementService),
  __decorateParam(4, ISessionsProvidersService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IChatSessionsService),
  __decorateParam(8, IChatEntitlementService),
  __decorateParam(9, ILanguageModelsService),
  __decorateParam(10, IWorkbenchLayoutService),
  __decorateParam(11, IContextKeyService)
], MobileSessionTypePicker);
export {
  MobileSessionTypePicker
};
