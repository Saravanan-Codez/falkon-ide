import { toAction } from "../../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import * as semver from "../../../../../../../base/common/semver/semver.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { localize } from "../../../../../../../nls.js";
import { ActionListItemKind } from "../../../../../../../platform/actionWidget/browser/actionList.js";
import { StateType } from "../../../../../../../platform/update/common/update.js";
import { ChatEntitlement } from "../../../../../../services/chat/common/chatEntitlementService.js";
import { getLanguageModelProviderDisplayName, ILanguageModelChatMetadata } from "../../../../common/languageModels.js";
import { languageModelSourcePresentationRegistry } from "../../../../common/languageModelSourcePresentation.js";
import { getModelHoverContent } from "./modelPickerHover.js";
import { getPriceCategoryLabel, isMultiplierPricing } from "./modelPickerPresentation.js";
function isVersionAtLeast(current, required) {
  const currentSemver = semver.coerce(current);
  return !!currentSemver && semver.gte(currentSemver, required);
}
function getUpdateHoverContent(updateState) {
  const hoverContent = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
  switch (updateState) {
    case StateType.AvailableForDownload:
      hoverContent.appendMarkdown(localize("chat.modelPicker.downloadUpdateHover", "This model requires a newer version of VS Code. [Download Update](command:update.downloadUpdate) to access it."));
      break;
    case StateType.Downloaded:
    case StateType.Ready:
      hoverContent.appendMarkdown(localize("chat.modelPicker.restartUpdateHover", "This model requires a newer version of VS Code. [Restart to Update](command:update.restartToUpdate) to access it."));
      break;
    default:
      hoverContent.appendMarkdown(localize("chat.modelPicker.checkUpdateHover", "This model requires a newer version of VS Code. [Update VS Code](command:update.checkForUpdate) to access it."));
      break;
  }
  return hoverContent;
}
function getProviderGroupKey(vendor, groupName) {
  return `${vendor}\0${groupName}`;
}
function buildModelToProviderGroupMap(languageModelsService) {
  const map = /* @__PURE__ */ new Map();
  for (const vendor of languageModelsService.getVendors()) {
    for (const group of languageModelsService.getLanguageModelGroups(vendor.vendor)) {
      const groupName = group.group?.name ?? vendor.displayName;
      for (const identifier of group.modelIdentifiers) {
        map.set(identifier, { vendor: vendor.vendor, groupName });
      }
    }
  }
  return map;
}
function getProviderGroupForModel(model, modelToGroup, languageModelsService) {
  if (model.metadata.modelGroup) {
    const byokGroup = model.metadata.byokModelIdentifier ? modelToGroup.get(model.metadata.byokModelIdentifier) : void 0;
    const sourcePresentation = model.metadata.modelGroup.sourceId ? languageModelSourcePresentationRegistry.get(model.metadata.vendor, model.metadata.modelGroup.sourceId) : void 0;
    return byokGroup ?? {
      vendor: model.metadata.vendor,
      groupName: sourcePresentation?.label ?? getLanguageModelProviderDisplayName(languageModelsService, model.metadata.modelGroup.id)
    };
  }
  return modelToGroup.get(model.identifier) ?? {
    vendor: model.metadata.vendor,
    groupName: getLanguageModelProviderDisplayName(languageModelsService, model.metadata.vendor)
  };
}
function createModelItem(action, model, openerService, vendorLabel, isUBB, ariaDescription, pinAction, onConfigure) {
  const hover = model && openerService ? getModelHoverContent(model, isUBB, onConfigure ? (group) => onConfigure(model, group) : void 0, openerService) : void 0;
  return {
    item: action,
    kind: ActionListItemKind.Action,
    label: action.label,
    description: action.description,
    ariaDescription,
    group: { title: "", icon: action.icon ?? ThemeIcon.fromId(action.checked ? Codicon.check.id : Codicon.blank.id) },
    hideIcon: false,
    section: action.section,
    className: vendorLabel ? "chat-model-picker-inline-source" : void 0,
    badge: vendorLabel,
    hover: hover ? { content: hover.element, disposable: hover.disposable } : void 0,
    tooltip: action.tooltip,
    toolbarActions: pinAction ? [pinAction] : void 0,
    submenuActions: action.toolbarActions?.length ? action.toolbarActions : void 0
  };
}
function createPinAction(modelIdentifier, isPinned, onTogglePin) {
  return toAction({
    id: `pin.${modelIdentifier}`,
    label: isPinned ? localize("chat.modelPicker.unpin", "Unpin Model") : localize("chat.modelPicker.pin", "Pin Model"),
    class: ThemeIcon.asClassName(isPinned ? Codicon.pinned : Codicon.pin),
    run: () => onTogglePin(modelIdentifier, !isPinned)
  });
}
function createModelAction(model, selectedModelId, onSelect, section, suppressVendorInDetail) {
  const pricingForDescription = isMultiplierPricing(model) ? model.metadata.pricing : void 0;
  const priceCategoryLabel = getPriceCategoryLabel(model.metadata.priceCategory);
  const detail = suppressVendorInDetail ? void 0 : model.metadata.detail;
  const promo = ILanguageModelChatMetadata.hasPromoDiscount(model.metadata) ? model.metadata.promo : void 0;
  const promoDetail = promo ? localize("chat.promo.discount", "{0}% discount", promo.discountPercent) : void 0;
  const textParts = [detail, promoDetail, pricingForDescription].filter(Boolean);
  const textDescription = textParts.length > 0 ? textParts.join(" \xB7 ") : void 0;
  const action = {
    id: model.identifier,
    enabled: true,
    icon: model.metadata.statusIcon,
    checked: model.identifier === selectedModelId,
    class: void 0,
    description: textDescription,
    tooltip: model.metadata.name,
    label: model.metadata.name,
    section,
    run: () => onSelect(model)
  };
  const ariaDescription = priceCategoryLabel ? textDescription ? textDescription + " \xB7 " + priceCategoryLabel : priceCategoryLabel : void 0;
  return { action, ariaDescription };
}
function getUnavailableReason(entry, chatEntitlementService, currentVSCodeVersion) {
  const businessOrEnterprise = chatEntitlementService.entitlement === ChatEntitlement.Business || chatEntitlementService.entitlement === ChatEntitlement.Enterprise;
  if (!businessOrEnterprise) {
    return "upgrade";
  }
  return entry.minVSCodeVersion && !isVersionAtLeast(currentVSCodeVersion, entry.minVSCodeVersion) ? "update" : "admin";
}
function createUnavailableModelItem(id, entry, reason, manageSettingsUrl, updateStateType, chatEntitlementService, section) {
  let description;
  if (reason === "upgrade") {
    description = new MarkdownString(localize("chat.modelPicker.upgradeLink", '[Upgrade](command:workbench.action.chat.upgradePlan " ")'), { isTrusted: true });
  } else if (reason === "update") {
    description = localize("chat.modelPicker.updateDescription", "Update VS Code");
  } else {
    description = manageSettingsUrl ? new MarkdownString(localize("chat.modelPicker.adminLink", "[Contact your admin]({0})", manageSettingsUrl), { isTrusted: true }) : localize("chat.modelPicker.adminDescription", "Contact your admin");
  }
  let hoverContent;
  if (reason === "upgrade") {
    hoverContent = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    if (chatEntitlementService.entitlement === ChatEntitlement.Pro) {
      hoverContent.appendMarkdown(localize("chat.modelPicker.upgradeHoverProPlus", '[Upgrade to GitHub Copilot Pro+](command:workbench.action.chat.upgradePlan " ") to use the best models.'));
    } else {
      hoverContent.appendMarkdown(localize("chat.modelPicker.upgradeHover", '[Upgrade to GitHub Copilot Pro](command:workbench.action.chat.upgradePlan " ") to use the best models.'));
    }
  } else if (reason === "update") {
    hoverContent = getUpdateHoverContent(updateStateType);
  } else {
    hoverContent = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    hoverContent.appendMarkdown(localize("chat.modelPicker.adminHover", "This model is not available. Contact your administrator to enable it."));
  }
  return {
    item: {
      id,
      enabled: false,
      checked: false,
      class: void 0,
      tooltip: entry.label,
      label: entry.label,
      description: typeof description === "string" ? description : void 0,
      run: () => {
      }
    },
    kind: ActionListItemKind.Action,
    label: entry.label,
    description,
    group: { title: "", icon: ThemeIcon.fromId(Codicon.blank.id) },
    disabled: true,
    hideIcon: false,
    className: "chat-model-picker-unavailable",
    section,
    hover: { content: hoverContent }
  };
}
export {
  buildModelToProviderGroupMap,
  createModelAction,
  createModelItem,
  createPinAction,
  createUnavailableModelItem,
  getProviderGroupForModel,
  getProviderGroupKey,
  getUnavailableReason,
  isVersionAtLeast
};
