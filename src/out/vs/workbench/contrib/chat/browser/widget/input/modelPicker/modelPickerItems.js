import { Codicon } from "../../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { localize } from "../../../../../../../nls.js";
import { ActionListItemKind } from "../../../../../../../platform/actionWidget/browser/actionList.js";
import { ChatEntitlement, isProUser } from "../../../../../../services/chat/common/chatEntitlementService.js";
import { MANAGE_CHAT_COMMAND_ID } from "../../../../common/constants.js";
import { buildFlatModelItems, buildGroupedModelItems, buildUnavailableStateItems, RESTRICTED_MODE_TRUST_ACTION_ID, SETUP_REQUIRED_SIGN_IN_ACTION_ID } from "./modelPickerItemSections.js";
import { ModelPickerSection } from "./modelPickerItemSections.js";
const PICKER_COMMAND_ACTION_IDS = /* @__PURE__ */ new Set([RESTRICTED_MODE_TRUST_ACTION_ID, SETUP_REQUIRED_SIGN_IN_ACTION_ID]);
function getControlModelsForEntitlement(manifest, entitlement) {
  return isProUser(entitlement) && entitlement !== ChatEntitlement.EDU ? manifest.paid : manifest.free;
}
function getModelPickerControlModels(manifest, entitlement, models) {
  if (entitlement !== ChatEntitlement.Unknown) {
    return getControlModelsForEntitlement(manifest, entitlement);
  }
  const availableModelIds = new Set(models.filter((model) => !model.metadata.isBYOK && !model.metadata.byokModelIdentifier && !!model.metadata.targetChatSessionType).map((model) => model.metadata.id));
  const controlModels = {};
  for (const tier of [manifest.free, manifest.paid]) {
    for (const [id, entry] of Object.entries(tier)) {
      if (entry.featured && availableModelIds.has(id)) {
        controlModels[id] = { ...entry, exists: true };
      }
    }
  }
  return controlModels;
}
function shouldShowManageModelsAction(chatEntitlementService) {
  return chatEntitlementService.clientByokEnabled || chatEntitlementService.hasByokModels || chatEntitlementService.entitlement === ChatEntitlement.Free || chatEntitlementService.entitlement === ChatEntitlement.EDU || chatEntitlementService.entitlement === ChatEntitlement.Pro || chatEntitlementService.entitlement === ChatEntitlement.ProPlus || chatEntitlementService.entitlement === ChatEntitlement.Max || chatEntitlementService.entitlement === ChatEntitlement.Business || chatEntitlementService.entitlement === ChatEntitlement.Enterprise || chatEntitlementService.isInternal;
}
function createManageModelsAction(commandService) {
  return {
    id: "manageModels",
    enabled: true,
    checked: false,
    class: ThemeIcon.asClassName(Codicon.gear),
    tooltip: localize("chat.manageModels.tooltip", "Manage Language Models"),
    label: localize("chat.manageModels", "Manage Models..."),
    run: () => {
      commandService.executeCommand(MANAGE_CHAT_COMMAND_ID);
    }
  };
}
function buildModelPickerItems(options) {
  const unavailableItems = buildUnavailableStateItems(options);
  if (unavailableItems) {
    return unavailableItems;
  }
  return options.presentation.useGroupedModelPicker ? buildGroupedModelItems(options) : buildFlatModelItems(options);
}
function getModelPickerAccessibilityProvider() {
  return {
    getAriaLabel(element) {
      if (element.kind !== ActionListItemKind.Action) {
        return null;
      }
      const description = element.ariaDescription ?? (typeof element.description === "string" ? element.description : element.description?.value);
      return [element.label, element.badge, description].filter((part) => !!part).join(", ");
    },
    isChecked(element) {
      if (element.isSectionToggle) {
        return void 0;
      }
      if (element.kind === ActionListItemKind.Action && !(element.item?.id && PICKER_COMMAND_ACTION_IDS.has(element.item.id))) {
        return !!element.item?.checked;
      }
      return void 0;
    },
    getRole: (element) => {
      if (element.isSectionToggle) {
        return "menuitem";
      }
      switch (element.kind) {
        case ActionListItemKind.Action:
          return element.item?.id && PICKER_COMMAND_ACTION_IDS.has(element.item.id) ? "menuitem" : "menuitemradio";
        case ActionListItemKind.Separator:
        default:
          return "separator";
      }
    },
    getWidgetRole: () => "menu"
  };
}
export {
  ModelPickerSection,
  buildModelPickerItems,
  createManageModelsAction,
  getControlModelsForEntitlement,
  getModelPickerAccessibilityProvider,
  getModelPickerControlModels,
  shouldShowManageModelsAction
};
