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
import "./media/chatContextUsageDetails.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { toAction } from "../../../../../../base/common/actions.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { localize } from "../../../../../../nls.js";
import { IMenuService, MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchButtonBar } from "../../../../../../platform/actions/browser/buttonbar.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { getActionBarActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { formatCopilotCredits } from "../../../common/chatService/chatService.js";
const $ = dom.$;
const COMPACT_AGENT_HOST_CONVERSATION_ACTION_ID = "workbench.action.chat.compactAgentHostConversation";
let ChatContextUsageDetails = class extends Disposable {
  constructor(_chatWidget, _dataObservable, instantiationService, menuService, contextKeyService) {
    super();
    this._chatWidget = _chatWidget;
    this._dataObservable = _dataObservable;
    this.instantiationService = instantiationService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.domNode = $(".chat-context-usage-details");
    const topHeader = this.domNode.appendChild($("div.header"));
    topHeader.textContent = localize("sessionInfo", "Session Info");
    this.sessionCostSection = this.domNode.appendChild($(".session-cost-section"));
    this.sessionCostSection.style.display = "none";
    const sessionCostRow = this.sessionCostSection.appendChild($(".session-cost-row"));
    const sessionCostLabel = sessionCostRow.appendChild($("span.session-cost-label"));
    sessionCostLabel.textContent = localize("sessionCost", "Session Cost");
    this.sessionCostValue = sessionCostRow.appendChild($("span.session-cost-value"));
    this.quotaItem = this.domNode.appendChild($(".quota-indicator"));
    const header = this.domNode.insertBefore($("div.header"), this.quotaItem);
    header.textContent = localize("contextWindow", "Context Window");
    const quotaLabel = this.quotaItem.appendChild($(".quota-label"));
    this.tokenCountLabel = quotaLabel.appendChild($("span"));
    this.percentageLabel = quotaLabel.appendChild($("span.quota-value"));
    const progressBar = this.quotaItem.appendChild($(".quota-bar"));
    this.progressFill = progressBar.appendChild($(".quota-bit"));
    this.outputBufferFill = progressBar.appendChild($(".quota-bit.output-buffer"));
    this.outputBufferLegend = this.quotaItem.appendChild($(".output-buffer-legend"));
    this.outputBufferLegend.appendChild($(".output-buffer-swatch"));
    const legendLabel = this.outputBufferLegend.appendChild($("span"));
    legendLabel.textContent = localize("outputReserved", "Reserved for response");
    this.outputBufferLegend.style.display = "none";
    this.tokenDetailsContainer = this.domNode.appendChild($(".token-details-container"));
    this.warningMessage = this.domNode.appendChild($("div.description"));
    this.warningMessage.textContent = localize("qualityWarning", "Quality may decline as limit nears.");
    this.warningMessage.style.display = "none";
    this.actionsSection = this.domNode.appendChild($(".actions-section"));
    const buttonBarContainer = this.actionsSection.appendChild($(".button-bar-container"));
    const buttonBar = this._register(this.instantiationService.createInstance(WorkbenchButtonBar, buttonBarContainer, {
      buttonConfigProvider: () => ({ isSecondary: true })
    }));
    const menu = this._register(this.menuService.createMenu(MenuId.ChatContextUsageActions, this.contextKeyService));
    const updateActions = () => {
      const actions = getActionBarActions(menu.getActions({ shouldForwardArgs: true }), () => true);
      const primaryActions = actions.primary.map((action) => this.withActionContext(action));
      const secondaryActions = actions.secondary.map((action) => this.withActionContext(action));
      buttonBar.update(primaryActions, secondaryActions);
      this.actionsSection.style.display = primaryActions.length > 0 || secondaryActions.length > 0 ? "" : "none";
    };
    this._register(menu.onDidChange(updateActions));
    updateActions();
    this._register(autorun((reader) => {
      const data = this._dataObservable.read(reader);
      if (data) {
        this._render(data);
      }
    }));
  }
  setChatWidget(widget) {
    this._chatWidget = widget;
  }
  withActionContext(action) {
    if (action.id !== COMPACT_AGENT_HOST_CONVERSATION_ACTION_ID) {
      return action;
    }
    return toAction({
      id: action.id,
      label: action.label,
      tooltip: action.tooltip,
      class: action.class,
      enabled: action.enabled,
      checked: action.checked,
      run: () => action.run(this._chatWidget)
    });
  }
  _render(data) {
    const { percentage, usedTokens, totalContextWindow, outputBufferPercentage, promptTokenDetails, sessionCost } = data;
    if (typeof sessionCost === "number" && sessionCost > 0) {
      const formatted = formatCopilotCredits(sessionCost);
      this.sessionCostValue.textContent = formatted === "1" ? localize("sessionCostCredit", "{0} credit", formatted) : localize("sessionCostCredits", "{0} credits", formatted);
      this.sessionCostSection.style.display = "";
    } else {
      this.sessionCostSection.style.display = "none";
    }
    this.tokenCountLabel.textContent = localize(
      "tokenCount",
      "{0} / {1} tokens",
      this.formatTokenCount(usedTokens, 1),
      this.formatTokenCount(totalContextWindow, 0)
    );
    this.percentageLabel.textContent = localize("quotaDisplay", "{0}%", Math.min(100, percentage).toFixed(0));
    const usageBarWidth = Math.max(0, Math.min(100, percentage));
    this.progressFill.style.width = `${usageBarWidth}%`;
    if (outputBufferPercentage !== void 0 && outputBufferPercentage > 0) {
      this.outputBufferFill.style.width = `${Math.max(0, Math.min(100 - usageBarWidth, outputBufferPercentage))}%`;
      this.outputBufferFill.style.display = "";
      this.outputBufferLegend.style.display = "";
    } else {
      this.outputBufferFill.style.width = "0";
      this.outputBufferFill.style.display = "none";
      this.outputBufferLegend.style.display = "none";
    }
    this.quotaItem.classList.remove("warning", "error");
    if (percentage >= 90) {
      this.quotaItem.classList.add("error");
    } else if (percentage >= 75) {
      this.quotaItem.classList.add("warning");
    }
    this.renderTokenDetails(promptTokenDetails, percentage);
    this.warningMessage.style.display = percentage >= 75 ? "" : "none";
  }
  formatTokenCount(count, decimals) {
    const mThreshold = 1e6 - 500 * Math.pow(10, -decimals);
    if (count >= mThreshold) {
      return `${(count / 1e6).toFixed(decimals)}M`;
    } else if (count >= 1e3) {
      return `${(count / 1e3).toFixed(decimals)}K`;
    }
    return count.toString();
  }
  renderTokenDetails(details, contextWindowPercentage) {
    dom.clearNode(this.tokenDetailsContainer);
    if (!details || details.length === 0) {
      this.tokenDetailsContainer.style.display = "none";
      return;
    }
    this.tokenDetailsContainer.style.display = "";
    const categoryMap = /* @__PURE__ */ new Map();
    let totalPercentage = 0;
    for (const detail of details) {
      const existing = categoryMap.get(detail.category) || [];
      existing.push({ label: detail.label, percentageOfPrompt: detail.percentageOfPrompt });
      categoryMap.set(detail.category, existing);
      totalPercentage += detail.percentageOfPrompt;
    }
    if (totalPercentage < 100) {
      const uncategorizedPercentage = 100 - totalPercentage;
      categoryMap.set(localize("uncategorized", "Uncategorized"), [
        { label: localize("other", "Other"), percentageOfPrompt: uncategorizedPercentage }
      ]);
    }
    for (const [category, items] of categoryMap) {
      const visibleItems = items.filter((item) => {
        const contextRelativePercentage = item.percentageOfPrompt / 100 * contextWindowPercentage;
        return contextRelativePercentage >= 0.05;
      });
      if (visibleItems.length === 0) {
        continue;
      }
      const categorySection = this.tokenDetailsContainer.appendChild($(".token-category"));
      const categoryHeader = categorySection.appendChild($(".token-category-header"));
      categoryHeader.textContent = category;
      for (const item of visibleItems) {
        const itemRow = categorySection.appendChild($(".token-detail-item"));
        const itemLabel = itemRow.appendChild($(".token-detail-label"));
        itemLabel.textContent = item.label;
        const contextRelativePercentage = item.percentageOfPrompt / 100 * contextWindowPercentage;
        const itemValue = itemRow.appendChild($(".token-detail-value"));
        itemValue.textContent = `${contextRelativePercentage.toFixed(1)}%`;
      }
    }
  }
  focus() {
    this.domNode.focus();
  }
};
ChatContextUsageDetails = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextKeyService)
], ChatContextUsageDetails);
export {
  ChatContextUsageDetails
};
