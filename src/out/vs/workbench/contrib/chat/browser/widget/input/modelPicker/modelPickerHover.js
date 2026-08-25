import "./media/modelPicker.css";
import * as dom from "../../../../../../../base/browser/dom.js";
import { renderMarkdown } from "../../../../../../../base/browser/markdownRenderer.js";
import { Button } from "../../../../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { DisposableStore } from "../../../../../../../base/common/lifecycle.js";
import { formatTokenCount } from "../../../../../../../base/common/numbers.js";
import { localize } from "../../../../../../../nls.js";
import { defaultButtonStyles } from "../../../../../../../platform/theme/browser/defaultStyles.js";
import { ILanguageModelChatMetadata } from "../../../../common/languageModels.js";
import { getPriceCategoryLabel, isAutoModel, isMultiplierPricing } from "./modelPickerPresentation.js";
const SUPPORTED_CONFIG_GROUPS = ["navigation", "tokens"];
function getModelHoverContent(model, isUBB, onConfigure, openerService) {
  const isAuto = isAutoModel(model);
  const promo = !isAuto && ILanguageModelChatMetadata.hasPromoDiscount(model.metadata) ? model.metadata.promo : void 0;
  const container = dom.$(".chat-model-hover");
  const disposables = new DisposableStore();
  const titleRow = dom.$(".chat-model-hover-title-row");
  titleRow.appendChild(dom.$(".chat-model-hover-name", void 0, model.metadata.name));
  const tags = dom.$(".chat-model-hover-title-tags");
  const categoryLabel = !isAuto && !promo ? getCategoryLabel(model.metadata.category) : void 0;
  if (categoryLabel) {
    tags.appendChild(dom.$("span.chat-model-hover-category", void 0, categoryLabel));
  }
  const priceCategoryLabel = !isAuto ? getPriceCategoryLabel(model.metadata.priceCategory) : void 0;
  const badgeLabel = isAuto ? model.metadata.detail : priceCategoryLabel;
  if (badgeLabel) {
    const badge = dom.$("span.chat-model-hover-price-badge", void 0, badgeLabel);
    if (!isAuto && isHighCostCategory(model.metadata.priceCategory)) {
      badge.classList.add("high-cost");
    }
    tags.appendChild(badge);
  }
  if (promo) {
    const discountLabel = localize("chat.promo.discountBadge", "{0}% discount", promo.discountPercent);
    tags.appendChild(dom.$("span.chat-model-hover-price-badge", void 0, discountLabel));
  }
  if (tags.childElementCount > 0) {
    titleRow.appendChild(tags);
  }
  container.appendChild(titleRow);
  if (!isAuto && model.metadata.warningText) {
    for (const message of Object.values(model.metadata.warningText)) {
      const warningContainer = dom.$(".chat-model-hover-warning-text");
      warningContainer.appendChild(renderIcon(Codicon.warning));
      const warningMd = new MarkdownString(message, { isTrusted: false, supportThemeIcons: true });
      const rendered = disposables.add(renderMarkdown(warningMd, {
        actionHandler: (link) => {
          void openerService.open(link, { allowCommands: false, fromUserGesture: true });
        }
      }));
      warningContainer.appendChild(rendered.element);
      container.appendChild(warningContainer);
    }
  }
  if (promo) {
    const promoContainer = dom.$(".chat-model-hover-promo-text");
    promoContainer.appendChild(renderIcon(Codicon.info));
    const endsAtLabel = ILanguageModelChatMetadata.getPromoEndsAtLabel(promo.endsAt);
    const promoMessage = endsAtLabel ? promo.message + " " + endsAtLabel : promo.message;
    const promoMd = new MarkdownString(promoMessage, { isTrusted: false, supportThemeIcons: true });
    const rendered = disposables.add(renderMarkdown(promoMd, {
      actionHandler: (link) => {
        void openerService.open(link, { allowCommands: false, fromUserGesture: true });
      }
    }));
    promoContainer.appendChild(rendered.element);
    container.appendChild(promoContainer);
  }
  let costInfoRendered = false;
  let costTableRendered = false;
  if (!isAuto && isUBB) {
    const metrics = [
      { label: localize("models.inputCostLabel", "Input"), def: model.metadata.inputCost, long: model.metadata.longContextInputCost },
      { label: localize("models.outputCostLabel", "Output"), def: model.metadata.outputCost, long: model.metadata.longContextOutputCost },
      { label: localize("models.cacheCostLabel", "Cache Read"), def: model.metadata.cacheCost, long: model.metadata.longContextCacheCost },
      { label: localize("models.cacheWriteCostLabel", "Cache Write"), def: model.metadata.cacheWriteCost, long: model.metadata.longContextCacheWriteCost }
    ].filter((metric) => metric.def !== void 0 || metric.long !== void 0);
    if (metrics.length > 0) {
      const hasLongContext = metrics.some((metric) => metric.long !== void 0);
      const table = dom.$(".chat-model-hover-cost-table");
      if (hasLongContext) {
        container.classList.add("has-long-context");
        table.classList.add("has-long-context");
      }
      const appendValueCell = (row, cost) => {
        if (cost === void 0) {
          row.appendChild(dom.$("span.chat-model-hover-cost-value.empty"));
          return;
        }
        row.appendChild(dom.$(
          "span.chat-model-hover-cost-value",
          void 0,
          dom.$(
            "span.chat-model-hover-cost-number",
            void 0,
            typeof cost === "number" ? String(cost) : localize("models.cost.unknown", "Unknown")
          )
        ));
      };
      const headerRow = dom.$(".chat-model-hover-cost-row.header");
      headerRow.appendChild(dom.$("span.chat-model-hover-cost-heading", void 0, localize("models.creditsPerMillionTokens", "Credits Per 1M Tokens")));
      if (hasLongContext) {
        headerRow.appendChild(dom.$("span.chat-model-hover-cost-value.subheader", void 0, localize("models.defaultContext", "Default")));
        headerRow.appendChild(dom.$("span.chat-model-hover-cost-value.subheader", void 0, localize("models.longContext", "Long Context")));
      } else {
        headerRow.appendChild(dom.$("span.chat-model-hover-cost-value.subheader"));
      }
      table.appendChild(headerRow);
      for (const metric of metrics) {
        const row = dom.$(".chat-model-hover-cost-row");
        const labelCell = dom.$(".chat-model-hover-cost-label");
        labelCell.appendChild(dom.$("span.chat-model-hover-cost-label-text", void 0, metric.label));
        row.appendChild(labelCell);
        appendValueCell(row, metric.def);
        if (hasLongContext) {
          appendValueCell(row, metric.long);
        }
        table.appendChild(row);
      }
      container.appendChild(table);
      costTableRendered = true;
      costInfoRendered = true;
    } else if (model.metadata.pricing && (isMultiplierPricing(model) || !priceCategoryLabel)) {
      appendCostSection(container, model.metadata.pricing);
      costInfoRendered = true;
    }
  } else if (!isAuto && model.metadata.pricing) {
    appendCostSection(container, model.metadata.pricing);
    costInfoRendered = true;
  }
  if (!costInfoRendered && model.metadata.tooltip) {
    const descriptionMd = new MarkdownString(model.metadata.tooltip, { supportThemeIcons: true });
    const rendered = disposables.add(renderMarkdown(descriptionMd, {
      actionHandler: (link) => {
        void openerService.open(link, { allowCommands: false, fromUserGesture: true });
      }
    }));
    rendered.element.classList.add("chat-model-hover-description");
    container.appendChild(rendered.element);
  }
  if (!isAuto && !costTableRendered && (model.metadata.maxInputTokens || model.metadata.maxOutputTokens)) {
    const totalTokens = (model.metadata.maxInputTokens ?? 0) + (model.metadata.maxOutputTokens ?? 0);
    const contextSection = dom.$(".chat-model-hover-context");
    contextSection.appendChild(dom.$(".chat-model-hover-context-label", void 0, localize("models.contextSize", "Max context")));
    contextSection.appendChild(dom.$(".chat-model-hover-context-value", void 0, formatTokenCount(totalTokens)));
    container.appendChild(contextSection);
  }
  if (model.metadata.configurationSchema?.properties) {
    const configButtons = [];
    const seenGroups = /* @__PURE__ */ new Set();
    for (const propSchema of Object.values(model.metadata.configurationSchema.properties)) {
      if (propSchema.enum && propSchema.enum.length >= 2 && propSchema.group && SUPPORTED_CONFIG_GROUPS.includes(propSchema.group) && !seenGroups.has(propSchema.group)) {
        const label = propSchema.title ?? propSchema.description;
        if (label) {
          seenGroups.add(propSchema.group);
          configButtons.push({ group: propSchema.group, label });
        }
      }
    }
    if (configButtons.length > 0) {
      const configRow = dom.$(".chat-model-hover-configurable");
      configRow.appendChild(dom.$("span.chat-model-hover-configurable-label", void 0, localize("models.configurable", "Configurable")));
      const buttonsContainer = dom.$(".chat-model-hover-configurable-buttons");
      for (const { group, label } of configButtons) {
        const button = disposables.add(new Button(buttonsContainer, {
          ...defaultButtonStyles,
          secondary: true,
          title: label
        }));
        button.label = label;
        disposables.add(button.onDidClick(() => onConfigure?.(group)));
      }
      configRow.appendChild(buttonsContainer);
      container.appendChild(configRow);
    }
  }
  return container.children.length > 0 ? { element: container, disposable: disposables } : void 0;
}
function appendCostSection(container, pricing) {
  const costSection = dom.$(".chat-model-hover-cost");
  costSection.appendChild(dom.$("span", void 0, localize("models.cost", "Cost: {0}", pricing)));
  container.appendChild(costSection);
}
function isHighCostCategory(priceCategory) {
  return priceCategory === "high" || priceCategory === "very_high";
}
function getCategoryLabel(category) {
  switch (category) {
    case void 0:
    case "":
      return void 0;
    case "lightweight":
      return localize("chat.category.lightweight", "Lightweight");
    case "versatile":
      return localize("chat.category.versatile", "Versatile");
    case "powerful":
      return localize("chat.category.powerful", "Powerful");
    default:
      return typeof category === "string" ? category.charAt(0).toUpperCase() + category.slice(1) : void 0;
  }
}
export {
  getModelHoverContent
};
