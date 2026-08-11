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
import { $, append, EventType, addDisposableListener, EventHelper, disposableWindowInterval, getWindow } from "../../../../../base/browser/dom.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { SelectBox } from "../../../../../base/browser/ui/selectBox/selectBox.js";
import { Checkbox, TriStateCheckbox } from "../../../../../base/browser/ui/toggle/toggle.js";
import { toAction } from "../../../../../base/common/actions.js";
import { Sequencer } from "../../../../../base/common/async.js";
import { cancelOnDispose } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { safeIntl } from "../../../../../base/common/date.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { MutableDisposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { parseLinkedText } from "../../../../../base/common/linkedText.js";
import { language } from "../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isObject } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { IInlineCompletionsService } from "../../../../../editor/browser/services/inlineCompletionsService.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, getConfigValueInTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IHoverService, nativeHoverDelegate } from "../../../../../platform/hover/browser/hover.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { Link } from "../../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles, defaultCheckboxStyles, defaultSelectBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { DomWidget } from "../../../../../platform/domWidget/browser/domWidget.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { IChatEntitlementService, ChatEntitlement, getChatPlanName } from "../../../../services/chat/common/chatEntitlementService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { isNewUser } from "./chatStatus.js";
import { IChatStatusItemService } from "./chatStatusItemService.js";
import { GitHubPaths, IDefaultAccountService } from "../../../../../platform/defaultAccount/common/defaultAccount.js";
import product from "../../../../../platform/product/common/product.js";
import { isCompletionsEnabled } from "../../../../../editor/common/services/completionsEnablement.js";
const defaultChat = product.defaultChatAgent;
const completionsConfigurationTargets = [
  ConfigurationTarget.WORKSPACE_FOLDER,
  ConfigurationTarget.WORKSPACE,
  ConfigurationTarget.USER_REMOTE,
  ConfigurationTarget.USER_LOCAL,
  ConfigurationTarget.APPLICATION
];
let ChatStatusDashboard = class extends DomWidget {
  constructor(options, chatEntitlementService, chatStatusItemService, commandService, configurationService, editorService, hoverService, languageService, openerService, telemetryService, textResourceConfigurationService, inlineCompletionsService, markdownRendererService, languageFeaturesService, contextViewService, storageService, defaultAccountService, notificationService) {
    super();
    this.options = options;
    this.chatEntitlementService = chatEntitlementService;
    this.chatStatusItemService = chatStatusItemService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.hoverService = hoverService;
    this.languageService = languageService;
    this.openerService = openerService;
    this.telemetryService = telemetryService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.inlineCompletionsService = inlineCompletionsService;
    this.markdownRendererService = markdownRendererService;
    this.languageFeaturesService = languageFeaturesService;
    this.contextViewService = contextViewService;
    this.storageService = storageService;
    this.defaultAccountService = defaultAccountService;
    this.notificationService = notificationService;
    this.element = $("div.chat-status-bar-entry-tooltip");
    this.dateFormatter = safeIntl.DateTimeFormat(language, { month: "short", day: "numeric" });
    this.timeFormatter = safeIntl.DateTimeFormat(language, { hour: "numeric", minute: "numeric" });
    this.quotaPercentageFormatter = safeIntl.NumberFormat(void 0, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
    this.quotaCreditsFormatter = safeIntl.NumberFormat(language, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    this.render();
  }
  static {
    this.QUICK_SETTINGS_COLLAPSED_KEY = "chatStatusDashboard.quickSettingsCollapsed";
  }
  render() {
    const token = cancelOnDispose(this._store);
    const { chat, premiumChat, completions } = this.chatEntitlementService.quotas;
    const hasQuotas = !!(chat || premiumChat);
    const isAnonymousWithSentiment = this.chatEntitlementService.anonymous && this.chatEntitlementService.sentiment.completed;
    const isPooledQuotaDepleted = premiumChat?.unlimited && premiumChat.hasQuota === false;
    const hasUsageSection = hasQuotas || isAnonymousWithSentiment;
    const hasVisibleUsageContent = chat?.unlimited === false || premiumChat?.unlimited === false || !this.options?.compactQuotaLayout && completions?.unlimited === false || isAnonymousWithSentiment || isPooledQuotaDepleted;
    const contributedEntries = [...this.chatStatusItemService.getEntries()];
    const hasQuickSettingsContent = !this.options?.disableInlineSuggestionsSettings || !this.options?.disableModelSelection || !this.options?.disableProviderOptions || !this.options?.disableCompletionsSnooze;
    let headerAdditionalSpendButton;
    let headerUpgradeButton;
    if (hasUsageSection && !this.options?.compactQuotaLayout) {
      const planName = getChatPlanName(this.chatEntitlementService.entitlement);
      const headerHost = this.options?.titleHeaderContainer ?? this.element;
      const header = this.renderHeader(headerHost, this._store, planName, toAction({
        id: "workbench.action.manageCopilot",
        label: localize("quotaLabel", "Manage Copilot Settings"),
        tooltip: localize("quotaTooltip", "Manage Copilot Settings"),
        class: ThemeIcon.asClassName(Codicon.settings),
        run: () => this.runCommandAndClose(() => this.openerService.open(URI.parse(this.defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotSettings))))
      }));
      const canConfigureAdditionalSpend = this.chatEntitlementService.entitlement === ChatEntitlement.EDU || this.chatEntitlementService.entitlement === ChatEntitlement.Pro || this.chatEntitlementService.entitlement === ChatEntitlement.ProPlus || this.chatEntitlementService.entitlement === ChatEntitlement.Max;
      const showUpgrade = this.chatEntitlementService.quotas.canUpgradePlan ?? false;
      const actionBarElement = header.lastElementChild;
      if (canConfigureAdditionalSpend) {
        headerAdditionalSpendButton = this._store.add(new Button(header, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));
        headerAdditionalSpendButton.element.classList.add("header-cta-button");
        headerAdditionalSpendButton.label = localize("manageBudget", "Manage Budget");
        this._store.add(headerAdditionalSpendButton.onDidClick(() => {
          this.telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.action.chat.manageAdditionalSpend", from: "chat-status" });
          this.runCommandAndClose(() => this.openerService.open(URI.parse(this.defaultAccountService.resolveGitHubUrl(GitHubPaths.billingBudgets))));
        }));
        if (actionBarElement) {
          header.insertBefore(headerAdditionalSpendButton.element, actionBarElement);
        }
      }
      if (showUpgrade) {
        headerUpgradeButton = this._store.add(new Button(header, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
        headerUpgradeButton.element.classList.add("header-cta-button");
        headerUpgradeButton.label = localize("upgrade", "Upgrade");
        this._store.add(headerUpgradeButton.onDidClick(() => this.runCommandAndClose("workbench.action.chat.upgradePlan")));
        if (actionBarElement) {
          header.insertBefore(headerUpgradeButton.element, actionBarElement);
        }
      }
    }
    if (hasUsageSection && this.options?.compactQuotaLayout && this.options.ctaButtonsContainer) {
      const ctaContainer = this.options.ctaButtonsContainer;
      const canConfigureAdditionalSpend = this.chatEntitlementService.entitlement === ChatEntitlement.EDU || this.chatEntitlementService.entitlement === ChatEntitlement.Pro || this.chatEntitlementService.entitlement === ChatEntitlement.ProPlus || this.chatEntitlementService.entitlement === ChatEntitlement.Max;
      const showUpgrade = this.chatEntitlementService.quotas.canUpgradePlan ?? false;
      if (canConfigureAdditionalSpend) {
        headerAdditionalSpendButton = this._store.add(new Button(ctaContainer, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));
        headerAdditionalSpendButton.label = localize("manageBudget", "Manage Budget");
        this._store.add(headerAdditionalSpendButton.onDidClick(() => {
          this.telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.action.chat.manageAdditionalSpend", from: "chat-status" });
          this.runCommandAndClose(() => this.openerService.open(URI.parse(this.defaultAccountService.resolveGitHubUrl(GitHubPaths.billingBudgets))));
        }));
      }
      if (showUpgrade) {
        headerUpgradeButton = this._store.add(new Button(ctaContainer, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
        headerUpgradeButton.label = localize("upgrade", "Upgrade");
        this._store.add(headerUpgradeButton.onDidClick(() => this.runCommandAndClose("workbench.action.chat.upgradePlan")));
      }
    }
    if (this.options?.compactQuotaLayout) {
      this.element.classList.add("compact");
    }
    const updatePromise = this.chatEntitlementService.update(token);
    if (hasVisibleUsageContent) {
      this.renderUsageContent(this.element, token, headerAdditionalSpendButton, headerUpgradeButton, updatePromise);
    }
    const hasPremiumUnlimited = !!premiumChat?.unlimited;
    const creditsUsed = hasPremiumUnlimited && !isPooledQuotaDepleted ? premiumChat?.creditsUsed : void 0;
    if (typeof creditsUsed === "number") {
      this.createCreditsUsedIndicator(this.element, creditsUsed, premiumChat?.resetAt);
    } else if (hasPremiumUnlimited) {
      const includedTitle = this.chatEntitlementService.quotas.usageBasedBilling ? localize("includedTitleTBB", "Credits") : localize("includedTitle", "Premium Requests");
      const getIncludedDescription = () => {
        if (isPooledQuotaDepleted) {
          return {
            compact: localize("premiumLimitReachedCompact", "{0} limit reached.", includedTitle),
            default: localize("premiumLimitReached", "Organization limit reached.")
          };
        }
        return {
          compact: localize("premiumIncludedCompact", "{0} included with your organization's plan.", includedTitle),
          default: localize("premiumIncluded", "Included with your organization's plan.")
        };
      };
      const includedDescription = getIncludedDescription();
      const includedContainer = this.element.appendChild($("div.quota-indicator.included"));
      if (this.options?.compactQuotaLayout) {
        const planName = getChatPlanName(this.chatEntitlementService.entitlement);
        includedContainer.classList.add("compact");
        includedContainer.appendChild($("div.quota-title", void 0, planName));
        includedContainer.appendChild($("div.description", void 0, includedDescription.compact));
      } else {
        includedContainer.appendChild($("div.quota-title", void 0, includedTitle));
        includedContainer.appendChild($("div.description", void 0, includedDescription.default));
      }
    }
    if (hasQuickSettingsContent) {
      const hasContentAbove = hasUsageSection || hasVisibleUsageContent || hasPremiumUnlimited;
      this.renderInlineSuggestionsSection(hasContentAbove);
    }
    if (contributedEntries.length > 0) {
      this.renderContributedSections(contributedEntries);
    }
    this.renderSetupSection();
  }
  renderUsageContent(container, token, headerAdditionalSpendButton, headerUpgradeButton, updatePromise) {
    const { chat: chatQuota, completions: completionsQuota, premiumChat: premiumChatQuota } = this.chatEntitlementService.quotas;
    const compact = !!this.options?.compactQuotaLayout;
    const planName = compact ? getChatPlanName(this.chatEntitlementService.entitlement) : void 0;
    if (chatQuota || premiumChatQuota || completionsQuota) {
      const resetLabel = this.formatGlobalResetLabel();
      const globalCalloutUpdater = this.createGlobalQuotaCallout(container);
      const { calloutVisible: initialCalloutVisible } = globalCalloutUpdater();
      if (headerAdditionalSpendButton) {
        headerAdditionalSpendButton.element.style.display = initialCalloutVisible ? "" : "none";
      }
      if (headerUpgradeButton) {
        headerUpgradeButton.element.style.display = headerAdditionalSpendButton && initialCalloutVisible ? "none" : "";
      }
      let chatQuotaIndicator;
      if (chatQuota && !chatQuota.unlimited && (!this.chatEntitlementService.quotas.usageBasedBilling || this.chatEntitlementService.entitlement === ChatEntitlement.Free)) {
        const chatLabel = this.chatEntitlementService.quotas.usageBasedBilling && this.chatEntitlementService.entitlement === ChatEntitlement.Free ? localize("creditsLabel", "Credits") : localize("chatsLabel", "Chat messages");
        chatQuotaIndicator = this.createQuotaIndicator(container, chatQuota, chatLabel, resetLabel, compact ? planName : void 0);
      }
      let premiumChatQuotaIndicator;
      if (premiumChatQuota && !premiumChatQuota.unlimited && premiumChatQuota.percentRemaining >= 0) {
        const isUBB = this.chatEntitlementService.quotas.usageBasedBilling;
        const premiumChatLabel = isUBB ? localize("creditsLabel", "Credits") : this.chatEntitlementService.quotas.additionalUsageEnabled ? localize("includedPremiumChatsLabel", "Included premium requests") : localize("premiumChatsLabel", "Premium requests");
        const premiumChatResetLabel = isUBB ? this.formatResetAtLabel(premiumChatQuota.resetAt) ?? resetLabel : resetLabel;
        premiumChatQuotaIndicator = this.createQuotaIndicator(container, premiumChatQuota, premiumChatLabel, premiumChatResetLabel, compact ? planName : void 0);
      }
      let additionalBudgetIndicator;
      let additionalBudgetElement;
      const initialOverageEntitlement = this.chatEntitlementService.quotas.additionalUsageEntitlement ?? 0;
      if (initialOverageEntitlement > 0) {
        const overageCount = this.chatEntitlementService.quotas.additionalUsageCount ?? 0;
        const overagePercentRemaining = Math.max(0, Math.min(100, (initialOverageEntitlement - overageCount) / initialOverageEntitlement * 100));
        const overageSnapshot = {
          percentRemaining: overagePercentRemaining,
          unlimited: false,
          entitlement: initialOverageEntitlement,
          quotaRemaining: Math.max(0, initialOverageEntitlement - overageCount)
        };
        const additionalBudgetLabel = localize("additionalBudgetLabel", "Additional Budget");
        additionalBudgetIndicator = this.createQuotaIndicator(container, overageSnapshot, additionalBudgetLabel, resetLabel, compact ? additionalBudgetLabel : void 0);
        additionalBudgetElement = container.lastElementChild;
        const isPremiumExhausted = premiumChatQuota && premiumChatQuota.percentRemaining <= 0;
        if (!isPremiumExhausted) {
          additionalBudgetElement.classList.add("muted");
        }
      }
      let completionsQuotaIndicator;
      const showCompletions = !compact && completionsQuota && !completionsQuota.unlimited && completionsQuota.percentRemaining >= 0 && (!this.chatEntitlementService.quotas.usageBasedBilling || this.chatEntitlementService.entitlement === ChatEntitlement.Free);
      if (showCompletions) {
        completionsQuotaIndicator = this.createQuotaIndicator(container, completionsQuota, localize("completionsLabel", "Inline Suggestions"), resetLabel, compact ? planName : void 0);
      }
      const updateIndicators = () => {
        const { chat: chatQuota2, premiumChat: premiumChatQuota2, completions: completionsQuota2 } = this.chatEntitlementService.quotas;
        if (chatQuota2) {
          chatQuotaIndicator?.(chatQuota2);
        }
        if (premiumChatQuota2) {
          premiumChatQuotaIndicator?.(premiumChatQuota2);
        }
        if (completionsQuota2) {
          completionsQuotaIndicator?.(completionsQuota2);
        }
        if (additionalBudgetIndicator && additionalBudgetElement) {
          const overageEntitlement = this.chatEntitlementService.quotas.additionalUsageEntitlement ?? 0;
          const overageCount = this.chatEntitlementService.quotas.additionalUsageCount ?? 0;
          if (overageEntitlement > 0) {
            const overagePercentRemaining = Math.max(0, Math.min(100, (overageEntitlement - overageCount) / overageEntitlement * 100));
            additionalBudgetIndicator({
              percentRemaining: overagePercentRemaining,
              unlimited: false,
              entitlement: overageEntitlement,
              quotaRemaining: Math.max(0, overageEntitlement - overageCount)
            });
          }
          const premiumExhausted = premiumChatQuota2 && premiumChatQuota2.percentRemaining <= 0;
          additionalBudgetElement.classList.toggle("muted", !premiumExhausted);
        }
        const { calloutVisible } = globalCalloutUpdater();
        if (headerAdditionalSpendButton) {
          headerAdditionalSpendButton.element.style.display = calloutVisible ? "" : "none";
          headerAdditionalSpendButton.label = localize("manageBudget", "Manage Budget");
        }
        if (headerUpgradeButton) {
          headerUpgradeButton.element.style.display = headerAdditionalSpendButton && calloutVisible ? "none" : "";
        }
      };
      (async () => {
        await updatePromise;
        if (token.isCancellationRequested) {
          return;
        }
        updateIndicators();
      })();
      this._store.add(this.chatEntitlementService.onDidChangeQuotaRemaining(() => updateIndicators()));
      this._store.add(this.chatEntitlementService.onDidChangeQuotaExceeded(() => updateIndicators()));
    } else if (this.chatEntitlementService.anonymous && this.chatEntitlementService.sentiment.completed) {
      this.createQuotaIndicator(container, localize("quotaLimited", "Limited"), localize("chatsLabel", "Chat messages"));
    }
  }
  renderInlineSuggestionsSection(hasContentAbove) {
    const nonCollapsible = !!this.options?.disableQuickSettingsCollapsible;
    const collapsed = !nonCollapsible && this.storageService.getBoolean(ChatStatusDashboard.QUICK_SETTINGS_COLLAPSED_KEY, StorageScope.PROFILE, true);
    const activeLanguageId = this.editorService.activeTextEditorLanguageId;
    const getStatusText = () => {
      if (!this.canUseChat()) {
        return localize("inlineSuggestionsDisabled", "Disabled");
      }
      const enabled = activeLanguageId ? isCompletionsEnabled(this.configurationService, activeLanguageId) : isCompletionsEnabled(this.configurationService);
      return enabled ? localize("inlineSuggestionsEnabled", "Enabled") : localize("inlineSuggestionsDisabled", "Disabled");
    };
    let disclosureHeader;
    let chevron;
    let statusEl;
    if (!nonCollapsible) {
      disclosureHeader = this.element.appendChild($("button.collapsible-header"));
      if (!hasContentAbove) {
        disclosureHeader.classList.add("no-border");
      }
      disclosureHeader.setAttribute("aria-expanded", String(!collapsed));
      disclosureHeader.appendChild($("span.collapsible-label", void 0, localize("inlineSuggestionsTab", "Inline Suggestions")));
      chevron = disclosureHeader.appendChild($("span.collapsible-chevron"));
      chevron.classList.add(...ThemeIcon.asClassNameArray(collapsed ? Codicon.chevronRight : Codicon.chevronDown));
      statusEl = disclosureHeader.appendChild($("span.collapsible-status", void 0, getStatusText()));
    }
    const collapsibleContent = this.element.appendChild($("div.collapsible-content"));
    const collapsibleInner = collapsibleContent.appendChild($("div.collapsible-inner"));
    if (collapsed) {
      collapsibleContent.classList.add("collapsed");
      collapsibleInner.inert = true;
    }
    if (disclosureHeader && chevron) {
      const toggle = () => {
        const isCollapsed = collapsibleContent.classList.toggle("collapsed");
        collapsibleInner.inert = isCollapsed;
        disclosureHeader.setAttribute("aria-expanded", String(!isCollapsed));
        chevron.className = "collapsible-chevron";
        chevron.classList.add(...ThemeIcon.asClassNameArray(isCollapsed ? Codicon.chevronRight : Codicon.chevronDown));
        this.storageService.store(ChatStatusDashboard.QUICK_SETTINGS_COLLAPSED_KEY, isCollapsed, StorageScope.PROFILE, StorageTarget.USER);
      };
      this._store.add(addDisposableListener(disclosureHeader, EventType.CLICK, () => toggle()));
    }
    if (statusEl) {
      this._store.add(this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
          statusEl.textContent = getStatusText();
        }
      }));
    }
    this.renderInlineSuggestionsContent(collapsibleInner);
  }
  renderContributedSections(contributedEntries) {
    for (const item of contributedEntries) {
      const headerLabel = typeof item.label === "string" ? item.label : item.label.label;
      let headerLink = typeof item.label === "string" ? void 0 : item.label.link;
      let linkDescription = typeof item.label === "string" ? void 0 : item.label.helpText;
      const section = this.element.appendChild($("div.contributed-section"));
      const header = section.appendChild($("div.collapsible-header.non-collapsible"));
      header.appendChild($("span.collapsible-label", void 0, headerLabel));
      if (linkDescription || headerLink) {
        const infoIcon = header.appendChild($("span.contributed-info-icon"));
        infoIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
        this._store.add(this.hoverService.setupDelayedHover(infoIcon, () => {
          const hoverContent = new MarkdownString("", { isTrusted: true });
          if (linkDescription) {
            hoverContent.appendText(linkDescription);
          }
          if (headerLink) {
            if (linkDescription) {
              hoverContent.appendText(" ");
            }
            hoverContent.appendMarkdown(`[${localize("learnMore", "Learn More")}](${headerLink})`);
          }
          return { content: hoverContent };
        }, { reducedDelay: true }));
      }
      const statusEl = header.appendChild($("span.collapsible-status"));
      const statusDisposables = this._store.add(new MutableDisposable());
      const renderStatus = (text) => {
        const newStore = new DisposableStore();
        statusDisposables.value = newStore;
        this.renderTextPlus(statusEl, text, newStore);
      };
      renderStatus(item.description);
      let currentTooltip = item.tooltip;
      if (currentTooltip) {
        this._store.add(this.hoverService.setupDelayedHover(statusEl, () => ({
          content: currentTooltip ?? ""
        }), { reducedDelay: true }));
      }
      const sectionDisposables = this._store.add(new MutableDisposable());
      const sectionStore = new DisposableStore();
      sectionDisposables.value = sectionStore;
      let detailEl;
      if (item.detail) {
        detailEl = section.appendChild($("div.contributed-detail"));
        this.renderTextPlus(detailEl, item.detail, sectionStore);
      }
      this._store.add(this.chatStatusItemService.onDidChange((e) => {
        if (e.entry.id === item.id) {
          statusEl.textContent = "";
          renderStatus(e.entry.description);
          currentTooltip = e.entry.tooltip;
          headerLink = typeof e.entry.label === "string" ? void 0 : e.entry.label.link;
          linkDescription = typeof e.entry.label === "string" ? void 0 : e.entry.label.helpText;
          const newStore = new DisposableStore();
          sectionDisposables.value = newStore;
          if (detailEl) {
            if (e.entry.detail) {
              detailEl.textContent = "";
              this.renderTextPlus(detailEl, e.entry.detail, newStore);
            } else {
              detailEl.remove();
              detailEl = void 0;
            }
          } else if (e.entry.detail) {
            detailEl = section.appendChild($("div.contributed-detail"));
            this.renderTextPlus(detailEl, e.entry.detail, newStore);
          }
        }
      }));
    }
  }
  renderSetupSection() {
    const hasByokModels = this.chatEntitlementService.hasByokModels;
    const newUser = isNewUser(this.chatEntitlementService) && !hasByokModels;
    const anonymousUser = this.chatEntitlementService.anonymous;
    const disabled = this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted;
    const signedOut = this.chatEntitlementService.entitlement === ChatEntitlement.Unknown;
    if (!(newUser || signedOut || disabled)) {
      return;
    }
    this.element.appendChild($("hr"));
    let descriptionText;
    let descriptionClass = ".description";
    if (newUser && anonymousUser) {
      descriptionText = new MarkdownString(localize({ key: "activeDescriptionAnonymous", comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "By continuing with {0} Copilot, you agree to {1}'s [Terms]({2}) and [Privacy Statement]({3})", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl), { isTrusted: true });
      descriptionClass = `${descriptionClass}.terms`;
    } else if (newUser) {
      descriptionText = localize("activateDescription", "Set up Copilot to use AI features.");
    } else if (anonymousUser) {
      descriptionText = localize("enableMoreDescription", "Sign in to enable more Copilot AI features.");
    } else if (disabled) {
      descriptionText = localize("enableDescription", "Enable Copilot to use AI features.");
    } else {
      descriptionText = localize("signInDescription", "Sign in to use GitHub Copilot AI features.");
    }
    let buttonLabel;
    if (newUser) {
      buttonLabel = localize("enableAIFeatures", "Use AI Features");
    } else if (anonymousUser) {
      buttonLabel = localize("enableMoreAIFeatures", "Enable more AI Features");
    } else if (disabled) {
      buttonLabel = localize("enableCopilotButton", "Enable AI Features");
    } else {
      buttonLabel = localize("signInToUseAIFeatures", "Sign in to use GitHub Copilot");
    }
    let commandId;
    if (newUser && anonymousUser) {
      commandId = "workbench.action.chat.triggerSetupAnonymousWithoutDialog";
    } else {
      commandId = "workbench.action.chat.triggerSetup";
    }
    if (typeof descriptionText === "string") {
      this.element.appendChild($(`div${descriptionClass}`, void 0, descriptionText));
    } else {
      this.element.appendChild($(`div${descriptionClass}`, void 0, this._store.add(this.markdownRendererService.render(descriptionText)).element));
    }
    const button = this._store.add(new Button(this.element, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
    button.label = buttonLabel;
    this._store.add(button.onDidClick(() => this.runCommandAndClose(commandId)));
  }
  renderInlineSuggestionsContent(container) {
    if (!this.options?.disableInlineSuggestionsSettings) {
      this.createSettings(container);
    }
    const providers = !this.options?.disableModelSelection || !this.options?.disableProviderOptions ? this.languageFeaturesService.inlineCompletionsProvider.allNoModel() : void 0;
    if (!this.options?.disableModelSelection && providers) {
      const provider = providers.find((p) => p.modelInfo && p.modelInfo.models.length > 0);
      if (provider) {
        const modelInfo = provider.modelInfo;
        const currentModel = modelInfo.models.find((m) => m.id === modelInfo.currentModelId);
        if (currentModel) {
          const modelContainer = container.appendChild($("div.model-selection"));
          modelContainer.appendChild($("span.model-text", void 0, localize("modelLabel", "Model")));
          const selectOptions = modelInfo.models.map((m) => ({ text: m.name }));
          const selectedIndex = modelInfo.models.findIndex((m) => m.id === modelInfo.currentModelId);
          const selectBox = this._store.add(new SelectBox(selectOptions, Math.max(0, selectedIndex), this.contextViewService, defaultSelectBoxStyles, { ariaLabel: localize("selectModel", "Select Model"), optionsAsChildren: true }));
          const selectContainer = modelContainer.appendChild($("div.model-select-container"));
          selectBox.render(selectContainer);
          this._store.add(selectBox.onDidSelect(async (e) => {
            const selectedModel = modelInfo.models[e.index];
            if (selectedModel && selectedModel.id !== modelInfo.currentModelId && provider.setModelId) {
              await provider.setModelId(selectedModel.id);
            }
          }));
        }
      }
    }
    if (!this.options?.disableProviderOptions && providers) {
      for (const provider of providers) {
        if (provider.providerOptions && provider.providerOptions.length > 0) {
          for (const option of provider.providerOptions) {
            const currentValue = option.values.find((v) => v.id === option.currentValueId);
            if (currentValue) {
              const optionContainer = container.appendChild($("div.suggest-option-selection"));
              optionContainer.appendChild($("span.suggest-option-text", void 0, option.label));
              const selectOptions = option.values.map((v) => ({ text: v.label }));
              const selectedIndex = option.values.findIndex((v) => v.id === option.currentValueId);
              const selectBox = this._store.add(new SelectBox(selectOptions, Math.max(0, selectedIndex), this.contextViewService, defaultSelectBoxStyles, { ariaLabel: localize("selectOption", "Select {0}", option.label), optionsAsChildren: true }));
              const selectContainer = optionContainer.appendChild($("div.suggest-option-select-container"));
              selectBox.render(selectContainer);
              this._store.add(selectBox.onDidSelect(async (e) => {
                const selectedValue = option.values[e.index];
                if (selectedValue && selectedValue.id !== option.currentValueId && provider.setProviderOption) {
                  await provider.setProviderOption(option.id, selectedValue.id);
                }
              }));
            }
          }
        }
      }
    }
    if (!this.options?.disableCompletionsSnooze && this.canUseChat()) {
      const snooze = append(container, $("div.snooze-completions"));
      this.createCompletionsSnooze(snooze, localize("settings.snooze", "Snooze"));
    }
  }
  canUseChat() {
    if (!this.chatEntitlementService.sentiment.completed || this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted) {
      return false;
    }
    if (this.chatEntitlementService.entitlement === ChatEntitlement.Unknown || this.chatEntitlementService.entitlement === ChatEntitlement.Available) {
      return this.chatEntitlementService.anonymous;
    }
    if (this.chatEntitlementService.entitlement === ChatEntitlement.Free && this.chatEntitlementService.quotas.chat?.percentRemaining === 0 && this.chatEntitlementService.quotas.completions?.percentRemaining === 0) {
      return false;
    }
    return true;
  }
  renderHeader(container, disposables, label, action) {
    const header = container.appendChild($("div.header"));
    header.appendChild($("span.header-label", void 0, label));
    if (action) {
      const toolbar = disposables.add(new ActionBar(header, { hoverDelegate: nativeHoverDelegate }));
      toolbar.push([action], { icon: true, label: false });
    }
    return header;
  }
  renderTextPlus(target, text, store) {
    for (const node of parseLinkedText(text).nodes) {
      if (typeof node === "string") {
        const parts = renderLabelWithIcons(node);
        target.append(...parts);
      } else {
        store.add(new Link(target, node, void 0, this.hoverService, this.openerService));
      }
    }
  }
  runCommandAndClose(commandOrFn, ...args) {
    if (typeof commandOrFn === "function") {
      commandOrFn(...args);
    } else {
      this.telemetryService.publicLog2("workbenchActionExecuted", { id: commandOrFn, from: "chat-status" });
      this.commandService.executeCommand(commandOrFn, ...args);
    }
    this.hoverService.hideHover(true);
  }
  formatResetAtLabel(resetAt) {
    if (!resetAt) {
      return void 0;
    }
    const resetDate = new Date(resetAt * 1e3);
    return localize("quotaResetsAt", "Resets {0} at {1}", this.dateFormatter.value.format(resetDate), this.timeFormatter.value.format(resetDate));
  }
  formatGlobalResetLabel() {
    const { resetDate, resetDateHasTime } = this.chatEntitlementService.quotas;
    if (!resetDate) {
      return void 0;
    }
    return resetDateHasTime ? localize("quotaResetsAt", "Resets {0} at {1}", this.dateFormatter.value.format(new Date(resetDate)), this.timeFormatter.value.format(new Date(resetDate))) : localize("quotaResets", "Resets {0}", this.dateFormatter.value.format(new Date(resetDate)));
  }
  createCreditsUsedIndicator(container, creditsUsed, resetAt) {
    const isCompact = !!this.options?.compactQuotaLayout;
    const resetLabel = this.formatResetAtLabel(resetAt) ?? this.formatGlobalResetLabel();
    const resetValue = $("span.quota-reset");
    if (resetLabel) {
      resetValue.textContent = resetLabel;
    }
    const quotaPercentage = $(
      "div.quota-percentage",
      void 0,
      $("span.quota-value", void 0, this.quotaCreditsFormatter.value.format(creditsUsed)),
      $("span.quota-value-suffix", void 0, isCompact ? localize("quotaLabelUsed", "{0} used", localize("creditsLabel", "Credits")) : localize("creditsUsedLabel", "Credits Used"))
    );
    const indicatorElement = $(
      "div.quota-indicator.included.credits-used",
      void 0,
      ...isCompact ? [$("div.quota-title", void 0, getChatPlanName(this.chatEntitlementService.entitlement))] : [],
      $(
        "div.quota-details",
        void 0,
        quotaPercentage,
        resetValue
      )
    );
    if (isCompact) {
      indicatorElement.classList.add("compact");
    }
    container.appendChild(indicatorElement);
  }
  createQuotaIndicator(container, quota, label, resetLabel, compactTitle) {
    const isCompact = !!compactTitle;
    const quotaValue = $("span.quota-value");
    const quotaValueText = isCompact ? quotaValue.appendChild($("span.quota-value-text")) : quotaValue;
    const quotaValueSuffix = $("span.quota-value-suffix");
    const quotaBit = $("div.quota-bit");
    const resetValue = $("span.quota-reset");
    if (resetLabel) {
      resetValue.textContent = resetLabel;
    }
    const quotaPercentage = $(
      "div.quota-percentage",
      void 0,
      quotaValue,
      quotaValueSuffix
    );
    quotaPercentage.tabIndex = isCompact ? -1 : 0;
    const indicatorElement = $(
      "div.quota-indicator",
      void 0,
      $(
        "div.quota-title",
        void 0,
        $("span", void 0, isCompact ? compactTitle : label),
        ...isCompact ? [] : [resetValue]
      ),
      $(
        "div.quota-details",
        void 0,
        quotaPercentage,
        ...isCompact ? [resetValue] : []
      ),
      ...isCompact ? [] : [$("div.quota-bar", void 0, quotaBit)]
    );
    if (isCompact) {
      indicatorElement.classList.add("compact");
    }
    container.appendChild(indicatorElement);
    let currentQuota = quota;
    let isHovered = false;
    const showPercentage = () => {
      if (typeof currentQuota === "string") {
        quotaValueText.textContent = currentQuota;
        quotaValueSuffix.textContent = "";
      } else {
        const usedPercentage = Math.max(0, 100 - currentQuota.percentRemaining);
        quotaValueText.textContent = localize("quotaDisplay", "{0}%", this.quotaPercentageFormatter.value.format(Math.floor(usedPercentage)));
        quotaValueSuffix.textContent = isCompact ? localize("quotaLabelUsed", "{0} used", label) : ` ${localize("quotaUsed", "used")}`;
      }
    };
    const showCredits = () => {
      if (typeof currentQuota !== "string" && currentQuota.entitlement) {
        const total = currentQuota.entitlement;
        const used = currentQuota.quotaRemaining !== void 0 ? total - currentQuota.quotaRemaining : total * (100 - currentQuota.percentRemaining) / 100;
        const usedFormatted = this.quotaCreditsFormatter.value.format(used);
        const totalFormatted = this.quotaCreditsFormatter.value.format(total);
        quotaValueText.textContent = localize("quotaCreditsDisplay", "{0} / {1}", usedFormatted, totalFormatted);
        quotaValueSuffix.textContent = isCompact ? localize("quotaLabelUsed", "{0} used", label) : ` ${localize("quotaUsed", "used")}`;
      }
    };
    const hoverTarget = isCompact ? quotaValueText : quotaPercentage;
    this._store.add(addDisposableListener(hoverTarget, EventType.MOUSE_ENTER, () => {
      isHovered = true;
      showCredits();
    }));
    this._store.add(addDisposableListener(hoverTarget, EventType.MOUSE_LEAVE, () => {
      isHovered = false;
      showPercentage();
    }));
    this._store.add(addDisposableListener(hoverTarget, EventType.FOCUS, () => {
      isHovered = true;
      showCredits();
    }));
    this._store.add(addDisposableListener(hoverTarget, EventType.BLUR, () => {
      isHovered = false;
      showPercentage();
    }));
    const update = (quota2) => {
      currentQuota = quota2;
      let usedPercentage;
      if (typeof quota2 === "string") {
        usedPercentage = 0;
      } else {
        usedPercentage = Math.max(0, 100 - quota2.percentRemaining);
      }
      if (isHovered) {
        showCredits();
      } else {
        showPercentage();
      }
      quotaBit.style.width = `${usedPercentage}%`;
    };
    update(quota);
    return update;
  }
  createGlobalQuotaCallout(container) {
    const calloutIcon = $("span.callout-icon");
    const calloutText = $("span.callout-text");
    const quotaCallout = container.appendChild($("div.quota-callout", void 0, calloutIcon, calloutText));
    quotaCallout.style.display = "none";
    const update = () => {
      const quotas = this.chatEntitlementService.quotas;
      const additionalUsageEnabled = quotas.additionalUsageEnabled ?? false;
      const isEnterpriseUser = this.chatEntitlementService.entitlement === ChatEntitlement.Enterprise || this.chatEntitlementService.entitlement === ChatEntitlement.Business;
      const isUsageBasedBilling = quotas.usageBasedBilling === true;
      const allQuotas = [];
      if (quotas.chat && !quotas.chat.unlimited) {
        allQuotas.push(quotas.chat);
      }
      if (quotas.premiumChat && !quotas.premiumChat.unlimited) {
        allQuotas.push(quotas.premiumChat);
      }
      const maxUsedPercentage = allQuotas.length > 0 ? Math.max(...allQuotas.map((q) => Math.max(0, 100 - q.percentRemaining))) : 0;
      const isPooledQuotaExhausted = quotas.premiumChat?.unlimited && quotas.premiumChat.hasQuota === false;
      if (isEnterpriseUser && isPooledQuotaExhausted) {
        quotaCallout.style.display = "";
        quotaCallout.className = "quota-callout info";
        calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
        calloutText.textContent = localize("quotaBudgetExceededEnterprise", "Your organization or enterprise has exceeded its Copilot budget. Contact your admin to resume usage.");
      } else if (maxUsedPercentage >= 100 && additionalUsageEnabled) {
        quotaCallout.style.display = "";
        quotaCallout.className = "quota-callout info";
        calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
        calloutText.textContent = isEnterpriseUser ? localize("quotaAdditionalUsageActiveEnterprise", "Copilot has paused because your limits are reached. Please contact your admin to increase your limits.") : isUsageBasedBilling ? localize("quotaAdditionalUsageActive", "Additional budget is configured. Usage will continue until limits reset.") : localize("quotaBudgetActive", "Premium request budget is configured. Usage will continue until limits reset.");
      } else if (maxUsedPercentage >= 75 && maxUsedPercentage < 100 && additionalUsageEnabled) {
        quotaCallout.style.display = "";
        quotaCallout.className = "quota-callout info";
        calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
        calloutText.textContent = isEnterpriseUser ? localize("quotaAdditionalUsageApproachingEnterprise", "Copilot will pause when your limits are reached. Please contact your admin to increase your limits.") : isUsageBasedBilling ? localize("quotaAdditionalUsageApproaching", "Once the limit is reached, additional budget will be used.") : localize("quotaBudgetApproaching", "Once the limit is reached, premium request budget will be used.");
      } else if ((maxUsedPercentage >= 100 || isPooledQuotaExhausted) && !additionalUsageEnabled) {
        quotaCallout.style.display = "";
        quotaCallout.className = "quota-callout info";
        calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
        calloutText.textContent = isEnterpriseUser ? localize("quotaPausedEnterprise", "Copilot is paused until the limit resets. Contact your administrator for more information.") : localize("quotaPaused", "Copilot is paused until the limit resets.");
      } else if (maxUsedPercentage >= 75 && !additionalUsageEnabled) {
        quotaCallout.style.display = "";
        quotaCallout.className = "quota-callout info";
        calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
        calloutText.textContent = isEnterpriseUser ? localize("quotaWarningEnterprise", "Copilot will pause when the limit is reached. Contact your administrator for more information.") : localize("quotaWarning", "Copilot will pause when the limit is reached.");
      } else {
        quotaCallout.style.display = "none";
      }
      return { calloutVisible: quotaCallout.style.display !== "none", additionalUsageEnabled };
    };
    update();
    return update;
  }
  createSettings(container) {
    const modeId = this.editorService.activeTextEditorLanguageId;
    const settings = container.appendChild($("div.settings"));
    {
      const globalSetting = append(settings, $("div.setting"));
      this.createInlineSuggestionsSetting(globalSetting, localize("settings.codeCompletions.allFiles", "Ghost text suggestions"), "*");
      const overriddenHint = globalSetting.appendChild($("span.setting-overridden"));
      const updateOverriddenHint = () => {
        const obj = this.configurationService.getValue(defaultChat.completionsEnablementSetting);
        const configuredValue = modeId ? this.findConfiguredCompletionsValue(modeId) : void 0;
        const hasOverride = modeId && configuredValue && isObject(obj) && Boolean(configuredValue.value[modeId]) !== Boolean(obj["*"]);
        overriddenHint.textContent = hasOverride ? localize("settings.overridden", "(overridden)") : "";
      };
      updateOverriddenHint();
      if (modeId) {
        const languageSetting = append(settings, $("div.setting"));
        const languageName = this.languageService.getLanguageName(modeId) ?? modeId;
        this.createTriStateLanguageSetting(languageSetting, localize("settings.codeCompletions.language", "Ghost text suggestions for {0}", languageName), modeId, updateOverriddenHint);
      }
    }
    {
      const setting = append(settings, $("div.setting"));
      this.createNextEditSuggestionsSetting(setting, localize("settings.nextEditSuggestions", "Next edit suggestions"), this.getCompletionsSettingAccessor(modeId));
    }
  }
  createSetting(container, settingIdsToReEvaluate, label, accessor) {
    const checkbox = this._store.add(new Checkbox(label, Boolean(accessor.readSetting()), { ...defaultCheckboxStyles }));
    container.appendChild(checkbox.domNode);
    const settingLabel = append(container, $("span.setting-label", void 0, label));
    this._store.add(Gesture.addTarget(settingLabel));
    [EventType.CLICK, TouchEventType.Tap].forEach((eventType) => {
      this._store.add(addDisposableListener(settingLabel, eventType, (e) => {
        if (checkbox?.enabled) {
          EventHelper.stop(e, true);
          checkbox.checked = !checkbox.checked;
          accessor.writeSetting(checkbox.checked);
          checkbox.focus();
        }
      }));
    });
    this._store.add(checkbox.onChange(() => {
      accessor.writeSetting(checkbox.checked);
    }));
    this._store.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (settingIdsToReEvaluate.some((id) => e.affectsConfiguration(id))) {
        checkbox.checked = Boolean(accessor.readSetting());
      }
    }));
    if (!this.canUseChat()) {
      container.classList.add("disabled");
      checkbox.disable();
      checkbox.checked = false;
    }
    return checkbox;
  }
  createInlineSuggestionsSetting(container, label, modeId) {
    this.createSetting(container, [defaultChat.completionsEnablementSetting], label, this.getCompletionsSettingAccessor(modeId));
  }
  createTriStateLanguageSetting(container, label, modeId, onStateChange) {
    const settingId = defaultChat.completionsEnablementSetting;
    const getState = () => {
      const configuredValue = this.findConfiguredCompletionsValue(modeId);
      return configuredValue ? Boolean(configuredValue.value[modeId]) : "mixed";
    };
    let requestedState = getState();
    let pendingWrites = 0;
    const checkbox = this._store.add(new TriStateCheckbox(label, requestedState, { ...defaultCheckboxStyles }));
    container.appendChild(checkbox.domNode);
    const settingLabel = append(container, $("span.setting-label", void 0, label));
    this._store.add(Gesture.addTarget(settingLabel));
    const writeSequencer = new Sequencer();
    const renderState = (state) => {
      requestedState = state;
      checkbox.checked = state;
      checkbox.domNode.setAttribute("aria-checked", state === "mixed" ? "mixed" : String(state));
    };
    const getNextState = () => requestedState === true ? false : requestedState === false ? "mixed" : true;
    const writeState = async (state) => {
      const configuredValue = this.findConfiguredCompletionsValue(modeId) ?? this.findConfiguredCompletionsValue();
      if (state === "mixed") {
        for (const configuredValue2 of this.findConfiguredCompletionsValues(modeId)) {
          const { [modeId]: _, ...rest } = configuredValue2.value;
          await this.configurationService.updateValue(settingId, rest, configuredValue2.target);
        }
      } else {
        const value = { ...configuredValue?.value, [modeId]: state };
        if (configuredValue) {
          await this.configurationService.updateValue(settingId, value, configuredValue.target);
        } else {
          await this.configurationService.updateValue(settingId, value);
        }
      }
      const enabled = isCompletionsEnabled(this.configurationService, modeId);
      this.telemetryService.publicLog2("chatStatus.settingChanged", {
        settingIdentifier: settingId,
        settingMode: modeId,
        settingEnablement: enabled ? "enabled" : "disabled"
      });
    };
    const requestStateChange = () => {
      const state = getNextState();
      renderState(state);
      pendingWrites++;
      void writeSequencer.queue(async () => {
        try {
          await writeState(state);
        } finally {
          pendingWrites--;
        }
      }).catch((error) => {
        if (pendingWrites === 0) {
          renderState(getState());
          onStateChange();
        }
        this.notificationService.error(error);
      });
    };
    renderState(requestedState);
    [EventType.CLICK, TouchEventType.Tap].forEach((eventType) => {
      this._store.add(addDisposableListener(settingLabel, eventType, (e) => {
        if (checkbox?.enabled) {
          EventHelper.stop(e, true);
          requestStateChange();
          checkbox.focus();
        }
      }));
    });
    this._store.add(checkbox.onChange(() => {
      renderState(requestedState);
      requestStateChange();
    }));
    this._store.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(settingId)) {
        const state = getState();
        if (pendingWrites === 0 || state === requestedState) {
          renderState(state);
          onStateChange();
        }
      }
    }));
    if (!this.canUseChat()) {
      container.classList.add("disabled");
      checkbox.disable();
      checkbox.checked = false;
    }
  }
  findConfiguredCompletionsValue(modeId) {
    return this.findConfiguredCompletionsValues(modeId)[0];
  }
  findConfiguredCompletionsValues(modeId) {
    const inspected = this.configurationService.inspect(defaultChat.completionsEnablementSetting);
    const result = [];
    for (const target of completionsConfigurationTargets) {
      const value = getConfigValueInTarget(inspected, target);
      if (isObject(value) && (!modeId || Object.prototype.hasOwnProperty.call(value, modeId))) {
        result.push({ target, value });
      }
    }
    return result;
  }
  getCompletionsSettingAccessor(modeId = "*") {
    const settingId = defaultChat.completionsEnablementSetting;
    return {
      readSetting: () => isCompletionsEnabled(this.configurationService, modeId),
      writeSetting: (value) => {
        this.telemetryService.publicLog2("chatStatus.settingChanged", {
          settingIdentifier: settingId,
          settingMode: modeId,
          settingEnablement: value ? "enabled" : "disabled"
        });
        let result = this.configurationService.getValue(settingId);
        if (!isObject(result)) {
          result = /* @__PURE__ */ Object.create(null);
        }
        return this.configurationService.updateValue(settingId, { ...result, [modeId]: value });
      }
    };
  }
  createNextEditSuggestionsSetting(container, label, completionsSettingAccessor) {
    const nesSettingId = defaultChat.nextEditSuggestionsSetting;
    const completionsSettingId = defaultChat.completionsEnablementSetting;
    const resource = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    const checkbox = this.createSetting(container, [nesSettingId, completionsSettingId], label, {
      readSetting: () => completionsSettingAccessor.readSetting() && this.textResourceConfigurationService.getValue(resource, nesSettingId),
      writeSetting: (value) => {
        this.telemetryService.publicLog2("chatStatus.settingChanged", {
          settingIdentifier: nesSettingId,
          settingEnablement: value ? "enabled" : "disabled"
        });
        return this.textResourceConfigurationService.updateValue(resource, nesSettingId, value);
      }
    });
    if (!completionsSettingAccessor.readSetting()) {
      container.classList.add("disabled");
      checkbox.disable();
    }
    this._store.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(completionsSettingId)) {
        if (completionsSettingAccessor.readSetting() && this.canUseChat()) {
          checkbox.enable();
          container.classList.remove("disabled");
        } else {
          checkbox.disable();
          container.classList.add("disabled");
        }
      }
    }));
  }
  createCompletionsSnooze(container, label) {
    const isEnabled = () => {
      const completionsEnabled = isCompletionsEnabled(this.configurationService);
      const completionsEnabledActiveLanguage = isCompletionsEnabled(this.configurationService, this.editorService.activeTextEditorLanguageId);
      return completionsEnabled || completionsEnabledActiveLanguage;
    };
    const button = this._store.add(new Button(container, { disabled: !isEnabled(), ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));
    const timerDisplay = container.appendChild($("span.snooze-label"));
    const actionBar = container.appendChild($("div.snooze-action-bar"));
    const toolbar = this._store.add(new ActionBar(actionBar, { hoverDelegate: nativeHoverDelegate }));
    const cancelAction = toAction({
      id: "workbench.action.cancelSnoozeStatusBarLink",
      label: localize("cancelSnooze", "Cancel Snooze"),
      run: () => this.inlineCompletionsService.cancelSnooze(),
      class: ThemeIcon.asClassName(Codicon.stopCircle)
    });
    const update = (isEnabled2) => {
      container.classList.toggle("disabled", !isEnabled2);
      toolbar.clear();
      const timeLeftMs = this.inlineCompletionsService.snoozeTimeLeft;
      if (!isEnabled2 || timeLeftMs <= 0) {
        timerDisplay.textContent = localize("completions.snooze5minutesTitle", "Hide suggestions for 5 min");
        timerDisplay.title = "";
        button.label = label;
        button.setTitle(localize("completions.snooze5minutes", "Hide inline suggestions for 5 min"));
        return true;
      }
      const timeLeftSeconds = Math.ceil(timeLeftMs / 1e3);
      const minutes = Math.floor(timeLeftSeconds / 60);
      const seconds = timeLeftSeconds % 60;
      timerDisplay.textContent = `${minutes}:${seconds < 10 ? "0" : ""}${seconds} ${localize("completions.remainingTime", "remaining")}`;
      timerDisplay.title = localize("completions.snoozeTimeDescription", "Inline suggestions are hidden for the remaining duration");
      button.label = localize("completions.plus5min", "+5 min");
      button.setTitle(localize("completions.snoozeAdditional5minutes", "Snooze additional 5 min"));
      toolbar.push([cancelAction], { icon: true, label: false });
      return false;
    };
    const timerDisposables = this._store.add(new DisposableStore());
    function updateIntervalTimer() {
      timerDisposables.clear();
      const enabled = isEnabled();
      if (update(enabled)) {
        return;
      }
      timerDisposables.add(disposableWindowInterval(
        getWindow(container),
        () => update(enabled),
        1e3
      ));
    }
    updateIntervalTimer();
    this._store.add(button.onDidClick(() => {
      this.inlineCompletionsService.snooze();
      update(isEnabled());
    }));
    this._store.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
        button.enabled = isEnabled();
      }
      updateIntervalTimer();
    }));
    this._store.add(this.inlineCompletionsService.onDidChangeIsSnoozing(() => {
      updateIntervalTimer();
    }));
  }
};
ChatStatusDashboard = __decorateClass([
  __decorateParam(1, IChatEntitlementService),
  __decorateParam(2, IChatStatusItemService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, ITextResourceConfigurationService),
  __decorateParam(11, IInlineCompletionsService),
  __decorateParam(12, IMarkdownRendererService),
  __decorateParam(13, ILanguageFeaturesService),
  __decorateParam(14, IContextViewService),
  __decorateParam(15, IStorageService),
  __decorateParam(16, IDefaultAccountService),
  __decorateParam(17, INotificationService)
], ChatStatusDashboard);
export {
  ChatStatusDashboard
};
