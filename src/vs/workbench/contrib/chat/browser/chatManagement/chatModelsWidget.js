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
import "./media/chatModelsWidget.css";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import * as DOM from "../../../../../base/browser/dom.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { ILanguageModelsService, resolveProviderDeprecationLink } from "../../../chat/common/languageModels.js";
import { localize } from "../../../../../nls.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchTable } from "../../../../../platform/list/browser/listService.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { toAction, Action, Separator } from "../../../../../base/common/actions.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ChatModelsViewModel, getManageModelsProviderLabel, SEARCH_SUGGESTIONS, isLanguageModelProviderEntry, isLanguageModelGroupEntry, isStatusEntry } from "./chatModelsViewModel.js";
import { HighlightedLabel } from "../../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { Link } from "../../../../../platform/opener/browser/link.js";
import { SuggestEnabledInput } from "../../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { Delayer } from "../../../../../base/common/async.js";
import { settingsTextInputBorder } from "../../../preferences/common/settingsEditorColorRegistry.js";
import { IChatEntitlementService, ChatEntitlement } from "../../../../services/chat/common/chatEntitlementService.js";
import { DropdownMenuActionViewItem } from "../../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { AnchorAlignment } from "../../../../../base/browser/ui/contextview/contextview.js";
import { ToolBar } from "../../../../../base/browser/ui/toolbar/toolbar.js";
import { preferencesClearInputIcon } from "../../../preferences/browser/preferencesIcons.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IEditorProgressService } from "../../../../../platform/progress/common/progress.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { CONTEXT_MODELS_SEARCH_FOCUS } from "../../common/constants.js";
import { IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
import { LANGUAGE_MODEL_CHAT_PROVIDER_EXTENSION_TAG } from "../../../../../platform/extensionManagement/common/extensionManagement.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import Severity from "../../../../../base/common/severity.js";
import { formatTokenCount } from "../../../../../base/common/numbers.js";
import { IDefaultAccountService } from "../../../../../platform/defaultAccount/common/defaultAccount.js";
import { CHAT_SETUP_ACTION_ID } from "../actions/chatActions.js";
const $ = DOM.$;
const HEADER_HEIGHT = 30;
const VENDOR_ROW_HEIGHT = 30;
const MODEL_ROW_HEIGHT = 26;
const CLOSE_MODAL_EDITOR_COMMAND_ID = "workbench.action.closeModalEditor";
function getModelHoverContent(model) {
  const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
  markdown.appendMarkdown(`**${model.metadata.name}**`);
  if (model.metadata.id !== model.metadata.version) {
    markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${model.metadata.id}&#64;${model.metadata.version}_&nbsp;</span>`);
  } else {
    markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${model.metadata.id}_&nbsp;</span>`);
  }
  markdown.appendText(`
`);
  if (model.metadata.statusIcon && model.metadata.tooltip) {
    if (model.metadata.statusIcon) {
      markdown.appendMarkdown(`$(${model.metadata.statusIcon.id})&nbsp;`);
    }
    markdown.appendMarkdown(`${model.metadata.tooltip}`);
    markdown.appendText(`
`);
  }
  if (model.metadata.pricing) {
    markdown.appendMarkdown(`${localize("models.pricing", "Pricing")}: `);
    markdown.appendMarkdown(model.metadata.pricing);
    markdown.appendText(`
`);
  }
  if (model.metadata.inputCost !== void 0 || model.metadata.outputCost !== void 0 || model.metadata.cacheCost !== void 0 || model.metadata.cacheWriteCost !== void 0) {
    if (model.metadata.inputCost !== void 0) {
      markdown.appendMarkdown(model.metadata.inputCost === 1 ? localize("models.inputCost.singular", "Input Cost: {0} credit per 1M tokens", model.metadata.inputCost) : localize("models.inputCost.plural", "Input Cost: {0} credits per 1M tokens", model.metadata.inputCost));
      markdown.appendText(`
`);
    }
    if (model.metadata.cacheCost !== void 0) {
      markdown.appendMarkdown(model.metadata.cacheCost === 1 ? localize("models.cacheCost.singular", "Cache Read Cost: {0} credit per 1M tokens", model.metadata.cacheCost) : localize("models.cacheCost.plural", "Cache Read Cost: {0} credits per 1M tokens", model.metadata.cacheCost));
      markdown.appendText(`
`);
    }
    if (model.metadata.cacheWriteCost !== void 0) {
      markdown.appendMarkdown(model.metadata.cacheWriteCost === 1 ? localize("models.cacheWriteCost.singular", "Cache Write Cost: {0} credit per 1M tokens", model.metadata.cacheWriteCost) : localize("models.cacheWriteCost.plural", "Cache Write Cost: {0} credits per 1M tokens", model.metadata.cacheWriteCost));
      markdown.appendText(`
`);
    }
    if (model.metadata.outputCost !== void 0) {
      markdown.appendMarkdown(model.metadata.outputCost === 1 ? localize("models.outputCost.singular", "Output Cost: {0} credit per 1M tokens", model.metadata.outputCost) : localize("models.outputCost.plural", "Output Cost: {0} credits per 1M tokens", model.metadata.outputCost));
      markdown.appendText(`
`);
    }
    if (model.metadata.longContextInputCost !== void 0 || model.metadata.longContextOutputCost !== void 0 || model.metadata.longContextCacheCost !== void 0 || model.metadata.longContextCacheWriteCost !== void 0) {
      markdown.appendText(`
`);
      markdown.appendMarkdown(`**${localize("models.longContextPricing", "Long Context Pricing")}**`);
      markdown.appendText(`
`);
      if (model.metadata.longContextInputCost !== void 0) {
        markdown.appendMarkdown(model.metadata.longContextInputCost === 1 ? localize("models.longContextInputCost.singular", "Input Cost: {0} credit per 1M tokens", model.metadata.longContextInputCost) : localize("models.longContextInputCost.plural", "Input Cost: {0} credits per 1M tokens", model.metadata.longContextInputCost));
        markdown.appendText(`
`);
      }
      if (model.metadata.longContextCacheCost !== void 0) {
        markdown.appendMarkdown(model.metadata.longContextCacheCost === 1 ? localize("models.longContextCacheCost.singular", "Cache Read Cost: {0} credit per 1M tokens", model.metadata.longContextCacheCost) : localize("models.longContextCacheCost.plural", "Cache Read Cost: {0} credits per 1M tokens", model.metadata.longContextCacheCost));
        markdown.appendText(`
`);
      }
      if (model.metadata.longContextCacheWriteCost !== void 0) {
        markdown.appendMarkdown(model.metadata.longContextCacheWriteCost === 1 ? localize("models.longContextCacheWriteCost.singular", "Cache Write Cost: {0} credit per 1M tokens", model.metadata.longContextCacheWriteCost) : localize("models.longContextCacheWriteCost.plural", "Cache Write Cost: {0} credits per 1M tokens", model.metadata.longContextCacheWriteCost));
        markdown.appendText(`
`);
      }
      if (model.metadata.longContextOutputCost !== void 0) {
        markdown.appendMarkdown(model.metadata.longContextOutputCost === 1 ? localize("models.longContextOutputCost.singular", "Output Cost: {0} credit per 1M tokens", model.metadata.longContextOutputCost) : localize("models.longContextOutputCost.plural", "Output Cost: {0} credits per 1M tokens", model.metadata.longContextOutputCost));
        markdown.appendText(`
`);
      }
    }
  }
  if (model.metadata.maxInputTokens || model.metadata.maxOutputTokens) {
    const totalTokens = (model.metadata.maxInputTokens ?? 0) + (model.metadata.maxOutputTokens ?? 0);
    markdown.appendMarkdown(`${localize("models.contextSize", "Context Size")}: `);
    markdown.appendMarkdown(`${formatTokenCount(totalTokens)}`);
    markdown.appendText(`
`);
  }
  if (model.metadata.capabilities) {
    markdown.appendMarkdown(`${localize("models.capabilities", "Capabilities")}: `);
    if (model.metadata.capabilities?.toolCalling) {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${localize("models.toolCalling", "Tools")}_&nbsp;</span>`);
    }
    if (model.metadata.capabilities?.vision) {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${localize("models.vision", "Vision")}_&nbsp;</span>`);
    }
    if (model.metadata.capabilities?.agentMode) {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${localize("models.agentMode", "Agent Mode")}_&nbsp;</span>`);
    }
    for (const editTool of model.metadata.capabilities.editTools ?? []) {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${editTool}_&nbsp;</span>`);
    }
    markdown.appendText(`
`);
  }
  return markdown;
}
function buildAddModelsDropdownActions(configurableVendors, supportsAddingModels, runVendorAction, runCopilotSignInAction) {
  if (!supportsAddingModels && !runCopilotSignInAction) {
    return [];
  }
  const customEndpointVendor = configurableVendors.find((v) => v.vendor === "customendpoint");
  const customOaiVendor = configurableVendors.find((v) => v.vendor === "customoai");
  const sortedVendors = configurableVendors.filter((v) => v.vendor !== "customendpoint" && v.vendor !== "customoai").sort((a, b) => {
    const aDeprecated = a.deprecation?.link ? 1 : 0;
    const bDeprecated = b.deprecation?.link ? 1 : 0;
    if (aDeprecated !== bDeprecated) {
      return aDeprecated - bDeprecated;
    }
    return a.displayName.localeCompare(b.displayName);
  });
  if (customOaiVendor) {
    sortedVendors.push(customOaiVendor);
  }
  const toVendorAction = (vendor) => toAction({
    id: `enable-${vendor.vendor}`,
    label: vendor.displayName,
    run: async () => {
      await runVendorAction(vendor);
    }
  });
  const vendorActions = supportsAddingModels ? sortedVendors.map(toVendorAction) : [];
  if (supportsAddingModels && customEndpointVendor) {
    if (vendorActions.length > 0) {
      vendorActions.push(new Separator());
    }
    vendorActions.push(toVendorAction(customEndpointVendor));
  }
  const actions = [];
  if (runCopilotSignInAction) {
    actions.push(toAction({
      id: "signIn-github-copilot",
      label: localize("models.signInGitHubCopilot", "GitHub Copilot"),
      run: async () => {
        await runCopilotSignInAction();
      }
    }));
  }
  if (actions.length > 0 && vendorActions.length > 0) {
    actions.push(new Separator());
  }
  actions.push(...vendorActions);
  return actions;
}
class ModelsFilterAction extends Action {
  constructor() {
    super("workbench.models.filter", localize("filter", "Filter"), ThemeIcon.asClassName(Codicon.filter));
  }
  async run() {
  }
}
function toggleFilter(currentQuery, filter) {
  const { query, synonyms = [], excludes = [] } = filter;
  const allSynonyms = [query, ...synonyms];
  const isChecked = allSynonyms.some((q) => currentQuery.includes(q));
  const hasExcludedQuery = excludes.some((q) => currentQuery.includes(q));
  if (isChecked) {
    let queryWithRemovedFilter = currentQuery;
    for (const q of allSynonyms) {
      queryWithRemovedFilter = queryWithRemovedFilter.replace(q, "");
    }
    return queryWithRemovedFilter.replace(/\s+/g, " ").trim();
  } else if (hasExcludedQuery) {
    let newQuery = currentQuery;
    for (const q of excludes) {
      newQuery = newQuery.replace(q, "");
    }
    newQuery = newQuery.replace(/\s+/g, " ").trim();
    return newQuery ? `${newQuery} ${query}` : query;
  } else {
    const trimmedQuery = currentQuery.trim();
    return trimmedQuery ? `${trimmedQuery} ${query}` : query;
  }
}
let ModelsSearchFilterDropdownMenuActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, search, viewModel, contextMenuService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        ...options,
        classNames: action.class,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
        menuAsChild: true
      }
    );
    this.search = search;
    this.viewModel = viewModel;
  }
  createProviderAction(vendor, displayName) {
    const query = `@provider:"${displayName}"`;
    const currentQuery = this.search.getValue();
    const isChecked = currentQuery.includes(query) || currentQuery.includes(`@provider:${vendor}`);
    return {
      id: `provider-${vendor}`,
      label: displayName,
      tooltip: localize("filterByProvider", "Filter by {0}", displayName),
      class: void 0,
      enabled: true,
      checked: isChecked,
      run: () => this.toggleFilterAndSearch({ query, synonyms: [`@provider:${vendor}`] })
    };
  }
  createCapabilityAction(capability, label) {
    const query = `@capability:${capability}`;
    const currentQuery = this.search.getValue();
    const isChecked = currentQuery.includes(query);
    return {
      id: `capability-${capability}`,
      label,
      tooltip: localize("filterByCapability", "Filter by {0}", label),
      class: void 0,
      enabled: true,
      checked: isChecked,
      run: () => this.toggleFilterAndSearch({ query })
    };
  }
  toggleFilterAndSearch(filter) {
    const currentQuery = this.search.getValue();
    const newQuery = toggleFilter(currentQuery, filter);
    this.search.setValue(newQuery);
  }
  getActions() {
    const actions = [];
    actions.push(
      this.createCapabilityAction("tools", localize("capability.tools", "Tools")),
      this.createCapabilityAction("vision", localize("capability.vision", "Vision")),
      this.createCapabilityAction("agent", localize("capability.agent", "Agent Mode"))
    );
    const configuredVendors = this.viewModel.getConfiguredVendors();
    if (configuredVendors.length > 1) {
      actions.push(new Separator());
      actions.push(...configuredVendors.map((vendor) => this.createProviderAction(vendor.vendor.vendor, vendor.group.name)));
    }
    return actions;
  }
};
ModelsSearchFilterDropdownMenuActionViewItem = __decorateClass([
  __decorateParam(4, IContextMenuService)
], ModelsSearchFilterDropdownMenuActionViewItem);
class Delegate {
  constructor() {
    this.headerRowHeight = HEADER_HEIGHT;
  }
  getHeight(element) {
    return isLanguageModelProviderEntry(element) || isLanguageModelGroupEntry(element) ? VENDOR_ROW_HEIGHT : MODEL_ROW_HEIGHT;
  }
}
class ModelsTableColumnRenderer {
  renderElement(element, index, templateData) {
    templateData.elementDisposables.clear();
    const isVendor = isLanguageModelProviderEntry(element);
    const isGroup = isLanguageModelGroupEntry(element);
    const isStatus = isStatusEntry(element);
    templateData.container.classList.add("models-table-column");
    const row = templateData.container.parentElement;
    row.classList.toggle("models-vendor-row", isVendor || isGroup);
    row.classList.toggle("models-model-row", !isVendor && !isGroup);
    row.classList.toggle("models-status-row", isStatus);
    const isHidden = isVendor && element.hidden || !isVendor && !isGroup && !isStatus && element.model?.hidden;
    row.classList.toggle("models-row-hidden", !!isHidden);
    if (isVendor) {
      this.renderVendorElement(element, index, templateData);
    } else if (isGroup) {
      this.renderGroupElement(element, index, templateData);
    } else if (isStatus) {
      this.renderStatusElement(element, index, templateData);
    } else {
      this.renderModelElement(element, index, templateData);
    }
  }
  renderStatusElement(element, index, templateData) {
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.disposables.dispose();
  }
}
class GutterColumnRenderer extends ModelsTableColumnRenderer {
  constructor(viewModel) {
    super();
    this.viewModel = viewModel;
    this.templateId = GutterColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "gutter";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    container.classList.add("models-gutter-column");
    const actionBar = disposables.add(new ActionBar(container));
    return {
      listRowElement: container.parentElement?.parentElement ?? null,
      container,
      actionBar,
      disposables,
      elementDisposables
    };
  }
  renderElement(entry, index, templateData) {
    templateData.actionBar.clear();
    super.renderElement(entry, index, templateData);
  }
  renderVendorElement(entry, index, templateData) {
    this.renderCollapsableElement(entry, templateData);
    this.renderGroupVisibilityElement(entry, templateData);
  }
  renderGroupElement(entry, index, templateData) {
    this.renderCollapsableElement(entry, templateData);
  }
  renderCollapsableElement(entry, templateData) {
    if (templateData.listRowElement) {
      templateData.listRowElement.setAttribute("aria-expanded", entry.collapsed ? "false" : "true");
    }
    const label = entry.collapsed ? localize("expand", "Expand") : localize("collapse", "Collapse");
    const toggleCollapseAction = {
      id: "toggleCollapse",
      label,
      tooltip: label,
      enabled: true,
      class: ThemeIcon.asClassName(entry.collapsed ? Codicon.chevronRight : Codicon.chevronDown),
      run: () => this.viewModel.toggleCollapsed(entry)
    };
    templateData.actionBar.push(toggleCollapseAction, { icon: true, label: false });
  }
  renderModelElement(entry, index, templateData) {
    this.renderModelVisibilityElement(entry, templateData);
  }
  renderGroupVisibilityElement(entry, templateData) {
    const hidden = entry.hidden;
    templateData.actionBar.push({
      id: hidden ? "showGroup" : "hideGroup",
      label: hidden ? localize("models.showGroup", "Show All Models") : localize("models.hideGroup", "Hide All Models"),
      tooltip: hidden ? localize("models.showGroup", "Show All Models") : localize("models.hideGroup", "Hide All Models"),
      class: `model-visibility-toggle ${ThemeIcon.asClassName(hidden ? Codicon.eyeClosed : Codicon.eye)}`,
      enabled: true,
      run: () => this.viewModel.toggleGroupHidden(entry)
    }, { icon: true, label: false });
  }
  renderModelVisibilityElement(entry, templateData) {
    const hidden = entry.model.hidden;
    templateData.actionBar.push({
      id: hidden ? "showModel" : "hideModel",
      label: hidden ? localize("models.showModel", "Show Model") : localize("models.hideModel", "Hide Model"),
      tooltip: hidden ? localize("models.showModel", "Show Model") : localize("models.hideModel", "Hide Model"),
      class: `model-visibility-toggle ${ThemeIcon.asClassName(hidden ? Codicon.eyeClosed : Codicon.eye)}`,
      enabled: true,
      run: () => this.viewModel.toggleModelHidden(entry)
    }, { icon: true, label: false });
  }
}
let ModelNameColumnRenderer = class extends ModelsTableColumnRenderer {
  constructor(hoverService, instantiationService, productService) {
    super();
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    this.productService = productService;
    this.templateId = ModelNameColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "modelName";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    const nameContainer = DOM.append(container, $(".model-name-container"));
    const statusIcon = DOM.append(nameContainer, $(".status-icon"));
    const providerIcon = DOM.append(nameContainer, $(".model-provider-icon"));
    providerIcon.setAttribute("aria-hidden", "true");
    const nameLabel = disposables.add(new HighlightedLabel(DOM.append(nameContainer, $(".model-name"))));
    const sourceDescription = DOM.append(nameContainer, $(".model-source-description"));
    sourceDescription.style.display = "none";
    const deprecationLinkContainer = DOM.append(nameContainer, $(".model-deprecation-link"));
    deprecationLinkContainer.style.display = "none";
    const deprecationLink = disposables.add(this.instantiationService.createInstance(Link, deprecationLinkContainer, { label: "", href: "" }, {}));
    const modelStatusIcon = DOM.append(nameContainer, $(".model-status-icon"));
    return {
      container,
      statusIcon,
      providerIcon,
      nameLabel,
      sourceDescription,
      modelStatusIcon,
      deprecationLinkContainer,
      deprecationLink,
      disposables,
      elementDisposables
    };
  }
  renderElement(entry, index, templateData) {
    DOM.clearNode(templateData.modelStatusIcon);
    templateData.providerIcon.className = "model-provider-icon";
    templateData.providerIcon.style.display = "none";
    templateData.sourceDescription.textContent = "";
    templateData.sourceDescription.style.display = "none";
    templateData.nameLabel.element.classList.remove("error-status", "warning-status", "info-status");
    templateData.deprecationLinkContainer.style.display = "none";
    super.renderElement(entry, index, templateData);
  }
  renderVendorElement(entry, index, templateData) {
    templateData.nameLabel.set(entry.vendorEntry.group.name, void 0);
    if (entry.sourcePresentation?.icon) {
      templateData.providerIcon.classList.add(...ThemeIcon.asClassNameArray(entry.sourcePresentation.icon));
      templateData.providerIcon.style.display = "";
    }
    if (entry.sourcePresentation?.description) {
      templateData.sourceDescription.textContent = entry.sourcePresentation.description;
      templateData.sourceDescription.style.display = "";
    }
    const deprecationLink = entry.vendorEntry.vendor.deprecation?.link;
    if (deprecationLink) {
      const icon = $("span");
      icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.linkExternal));
      icon.setAttribute("aria-hidden", "true");
      const label = $("span.model-deprecation-link-label", void 0, localize("models.deprecation.link.label", "Migrate"), icon);
      templateData.deprecationLink.link = {
        label,
        href: resolveProviderDeprecationLink(deprecationLink, this.productService.urlProtocol).toString(),
        title: localize("models.deprecation.link.tooltip", "The Ollama model provider is deprecated. Please migrate to the official extension.")
      };
      templateData.deprecationLinkContainer.style.display = "";
    }
  }
  renderGroupElement(entry, index, templateData) {
    templateData.nameLabel.set(entry.label, void 0);
  }
  renderModelElement(entry, index, templateData) {
    const { model: modelEntry, modelNameMatches } = entry;
    templateData.statusIcon.style.display = "none";
    templateData.modelStatusIcon.className = "model-status-icon";
    if (modelEntry.metadata.statusIcon) {
      templateData.modelStatusIcon.classList.add(...ThemeIcon.asClassNameArray(modelEntry.metadata.statusIcon));
      templateData.modelStatusIcon.style.display = "";
    } else {
      templateData.modelStatusIcon.style.display = "none";
    }
    templateData.nameLabel.set(modelEntry.metadata.name, modelNameMatches);
    const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    markdown.appendMarkdown(`**${entry.model.metadata.name}**`);
    if (entry.model.metadata.id !== entry.model.metadata.version) {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${entry.model.metadata.id}&#64;${entry.model.metadata.version}_&nbsp;</span>`);
    } else {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${entry.model.metadata.id}_&nbsp;</span>`);
    }
    markdown.appendText(`
`);
    if (entry.model.metadata.statusIcon && entry.model.metadata.tooltip) {
      if (entry.model.metadata.statusIcon) {
        markdown.appendMarkdown(`$(${entry.model.metadata.statusIcon.id})&nbsp;`);
      }
      markdown.appendMarkdown(`${entry.model.metadata.tooltip}`);
      markdown.appendText(`
`);
    }
    templateData.elementDisposables.add(this.hoverService.setupDelayedHoverAtMouse(templateData.container, () => ({
      content: markdown,
      appearance: {
        compact: true,
        skipFadeInAnimation: true
      }
    })));
  }
  renderStatusElement(entry, index, templateData) {
    templateData.statusIcon.style.display = "";
    templateData.statusIcon.className = "status-icon";
    switch (entry.severity) {
      case Severity.Error:
        templateData.nameLabel.element.classList.add("error-status");
        templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.error));
        break;
      case Severity.Warning:
        templateData.nameLabel.element.classList.add("warning-status");
        templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
        break;
      case Severity.Info:
        templateData.nameLabel.element.classList.add("info-status");
        templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
        break;
    }
    templateData.nameLabel.set(entry.message, void 0, entry.message);
  }
};
ModelNameColumnRenderer = __decorateClass([
  __decorateParam(0, IHoverService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IProductService)
], ModelNameColumnRenderer);
let CombinedCostColumnRenderer = class extends ModelsTableColumnRenderer {
  constructor(hoverService) {
    super();
    this.hoverService = hoverService;
    this.templateId = CombinedCostColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "combinedCost";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    const grid = DOM.append(container, $(".model-cost-grid"));
    const inputCell = DOM.append(grid, $("span.model-cost-cell"));
    const outputCell = DOM.append(grid, $("span.model-cost-cell"));
    const cacheReadCell = DOM.append(grid, $("span.model-cost-cell"));
    const cacheWriteCell = DOM.append(grid, $("span.model-cost-cell"));
    return {
      container,
      inputCell,
      outputCell,
      cacheReadCell,
      cacheWriteCell,
      disposables,
      elementDisposables
    };
  }
  renderElement(entry, index, templateData) {
    templateData.inputCell.textContent = "";
    templateData.outputCell.textContent = "";
    templateData.cacheReadCell.textContent = "";
    templateData.cacheWriteCell.textContent = "";
    super.renderElement(entry, index, templateData);
  }
  renderGroupElement(_element, _index, _templateData) {
  }
  renderVendorElement(_element, _index, _templateData) {
  }
  renderModelElement(entry, index, templateData) {
    const { inputCost, outputCost, cacheCost, cacheWriteCost } = entry.model.metadata;
    const hasCost = inputCost !== void 0 || outputCost !== void 0 || cacheCost !== void 0 || cacheWriteCost !== void 0;
    if (hasCost) {
      templateData.inputCell.textContent = inputCost !== void 0 ? localize("cost.input", "In: {0}", inputCost) : "";
      templateData.outputCell.textContent = outputCost !== void 0 ? localize("cost.output", "Out: {0}", outputCost) : "";
      templateData.cacheReadCell.textContent = cacheCost !== void 0 ? localize("cost.cacheRead", "Cache Read: {0}", cacheCost) : "";
      templateData.cacheWriteCell.textContent = cacheWriteCost !== void 0 ? localize("cost.cacheWrite", "Cache Write: {0}", cacheWriteCost) : "";
      const parts = [];
      if (inputCost !== void 0) {
        parts.push(inputCost === 1 ? localize("cost.inputHover.singular", "Input: {0} credit per 1M tokens", inputCost) : localize("cost.inputHover.plural", "Input: {0} credits per 1M tokens", inputCost));
      }
      if (outputCost !== void 0) {
        parts.push(outputCost === 1 ? localize("cost.outputHover.singular", "Output: {0} credit per 1M tokens", outputCost) : localize("cost.outputHover.plural", "Output: {0} credits per 1M tokens", outputCost));
      }
      if (cacheCost !== void 0) {
        parts.push(cacheCost === 1 ? localize("cost.cacheHover.singular", "Cache Read: {0} credit per 1M tokens", cacheCost) : localize("cost.cacheHover.plural", "Cache Read: {0} credits per 1M tokens", cacheCost));
      }
      if (cacheWriteCost !== void 0) {
        parts.push(cacheWriteCost === 1 ? localize("cost.cacheWriteHover.singular", "Cache Write: {0} credit per 1M tokens", cacheWriteCost) : localize("cost.cacheWriteHover.plural", "Cache Write: {0} credits per 1M tokens", cacheWriteCost));
      }
      templateData.elementDisposables.add(this.hoverService.setupDelayedHoverAtMouse(templateData.container, () => ({
        content: parts.join("\n"),
        appearance: {
          compact: true,
          skipFadeInAnimation: true
        }
      })));
    } else {
      const pricingText = entry.model.metadata.pricing;
      if (pricingText) {
        templateData.inputCell.textContent = pricingText;
        templateData.elementDisposables.add(this.hoverService.setupDelayedHoverAtMouse(templateData.container, () => ({
          content: localize("pricing.tooltip", "Pricing: {0}", pricingText),
          appearance: {
            compact: true,
            skipFadeInAnimation: true
          }
        })));
      }
    }
  }
};
CombinedCostColumnRenderer = __decorateClass([
  __decorateParam(0, IHoverService)
], CombinedCostColumnRenderer);
let TokenLimitsColumnRenderer = class extends ModelsTableColumnRenderer {
  constructor(hoverService) {
    super();
    this.hoverService = hoverService;
    this.templateId = TokenLimitsColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "tokenLimits";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    const tokenLimitsElement = DOM.append(container, $(".model-token-limits"));
    return {
      container,
      tokenLimitsElement,
      disposables,
      elementDisposables
    };
  }
  renderElement(entry, index, templateData) {
    DOM.clearNode(templateData.tokenLimitsElement);
    super.renderElement(entry, index, templateData);
  }
  renderVendorElement(entry, index, templateData) {
  }
  renderGroupElement(entry, index, templateData) {
  }
  renderModelElement(entry, index, templateData) {
    const { model: modelEntry } = entry;
    const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    if (modelEntry.metadata.maxInputTokens || modelEntry.metadata.maxOutputTokens) {
      const totalTokens = (modelEntry.metadata.maxInputTokens ?? 0) + (modelEntry.metadata.maxOutputTokens ?? 0);
      const tokenDiv = DOM.append(templateData.tokenLimitsElement, $(".token-limit-item"));
      const tokenText = DOM.append(tokenDiv, $("span"));
      tokenText.textContent = formatTokenCount(totalTokens);
      markdown.appendMarkdown(`${localize("models.contextSize", "Context Size")}: `);
      markdown.appendMarkdown(`${formatTokenCount(totalTokens)}`);
    }
    templateData.elementDisposables.add(this.hoverService.setupDelayedHoverAtMouse(templateData.container, () => ({
      content: markdown,
      appearance: {
        compact: true,
        skipFadeInAnimation: true
      }
    })));
  }
};
TokenLimitsColumnRenderer = __decorateClass([
  __decorateParam(0, IHoverService)
], TokenLimitsColumnRenderer);
class CapabilitiesColumnRenderer extends ModelsTableColumnRenderer {
  constructor() {
    super(...arguments);
    this.templateId = CapabilitiesColumnRenderer.TEMPLATE_ID;
    this._onDidClickCapability = new Emitter();
    this.onDidClickCapability = this._onDidClickCapability.event;
  }
  static {
    this.TEMPLATE_ID = "capabilities";
  }
  dispose() {
    this._onDidClickCapability.dispose();
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    container.classList.add("model-capability-column");
    const metadataRow = DOM.append(container, $(".model-capabilities"));
    return {
      container,
      metadataRow,
      disposables,
      elementDisposables
    };
  }
  renderElement(entry, index, templateData) {
    DOM.clearNode(templateData.metadataRow);
    super.renderElement(entry, index, templateData);
  }
  renderVendorElement(entry, index, templateData) {
  }
  renderGroupElement(entry, index, templateData) {
  }
  renderModelElement(entry, index, templateData) {
    const { model: modelEntry, capabilityMatches } = entry;
    if (modelEntry.metadata.capabilities?.toolCalling) {
      templateData.elementDisposables.add(this.createCapabilityButton(
        templateData.metadataRow,
        capabilityMatches?.includes("toolCalling") || false,
        localize("models.tools", "Tools"),
        "tools"
      ));
    }
    if (modelEntry.metadata.capabilities?.vision) {
      templateData.elementDisposables.add(this.createCapabilityButton(
        templateData.metadataRow,
        capabilityMatches?.includes("vision") || false,
        localize("models.vision", "Vision"),
        "vision"
      ));
    }
  }
  createCapabilityButton(container, isActive, label, capability) {
    const disposables = new DisposableStore();
    const buttonContainer = DOM.append(container, $(".model-badge-container"));
    const button = disposables.add(new Button(buttonContainer, { secondary: true }));
    button.element.classList.add("model-capability");
    button.element.classList.toggle("active", isActive);
    button.label = label;
    disposables.add(button.onDidClick(() => this._onDidClickCapability.fire(capability)));
    return disposables;
  }
}
function createProviderGroupActions(viewModel, vendor, groupName, languageModelsService, dialogService) {
  const configuration = vendor.configuration;
  if (!configuration) {
    return [];
  }
  const actions = [];
  const configurationProperties = configuration.properties;
  actions.push(toAction({
    id: "goToSettingsAction",
    label: localize("models.goToSettings", "Open in Language Models (JSON)"),
    run: () => languageModelsService.openLanguageModelsProviderGroupSettings(vendor.vendor, groupName)
  }));
  actions.push(new Separator());
  actions.push(toAction({
    id: "renameGroupAction",
    label: localize("models.renameGroup", "Rename Group"),
    run: () => languageModelsService.renameLanguageModelsProviderGroup(vendor.vendor, groupName)
  }));
  if (configurationProperties?.apiKey) {
    actions.push(toAction({
      id: "updateApiKeyAction",
      label: localize("models.updateApiKey", "Update API Key"),
      run: () => languageModelsService.updateLanguageModelsProviderGroupApiKey(vendor.vendor, groupName)
    }));
  }
  if (configurationProperties?.models?.defaultSnippets?.[0]) {
    actions.push(toAction({
      id: "addModelAction",
      label: localize("models.addModel", "Add Model"),
      run: () => languageModelsService.addLanguageModelsProviderGroupModel(vendor.vendor, groupName)
    }));
  }
  actions.push(new Separator());
  actions.push(toAction({
    id: "deleteAction",
    label: localize("models.deleteAction", "Delete"),
    class: ThemeIcon.asClassName(Codicon.trash),
    run: async () => {
      const result = await dialogService.confirm({
        type: "info",
        message: localize("models.deleteConfirmation", "Would you like to delete {0}?", groupName)
      });
      if (!result.confirmed) {
        return;
      }
      await languageModelsService.removeLanguageModelsProviderGroup(vendor.vendor, groupName);
      viewModel.refresh();
    }
  }));
  return actions;
}
let ActionsColumnRenderer = class extends ModelsTableColumnRenderer {
  constructor(viewModel, instantiationService, languageModelsService, dialogService, commandService, contextMenuService) {
    super();
    this.viewModel = viewModel;
    this.instantiationService = instantiationService;
    this.languageModelsService = languageModelsService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.contextMenuService = contextMenuService;
    this.templateId = ActionsColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "actions";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    container.classList.add("models-actions-column");
    const parent = DOM.append(container, $(".actions-container"));
    const actionBar = disposables.add(this.instantiationService.createInstance(
      ToolBar,
      parent,
      this.contextMenuService,
      {
        icon: true,
        label: false,
        moreIcon: Codicon.gear,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT
      }
    ));
    return {
      container,
      actionBar,
      disposables,
      elementDisposables
    };
  }
  renderElement(entry, index, templateData) {
    templateData.actionBar.setActions([]);
    super.renderElement(entry, index, templateData);
  }
  renderVendorElement(entry, index, templateData) {
    const { vendorEntry } = entry;
    const primaryActions = [];
    const secondaryActions = [];
    if (vendorEntry.vendor.configuration) {
      secondaryActions.push(...createProviderGroupActions(this.viewModel, vendorEntry.vendor, vendorEntry.group.name, this.languageModelsService, this.dialogService));
    } else if (vendorEntry.vendor.managementCommand) {
      primaryActions.push(toAction({
        id: "manageVendor",
        label: localize("models.manageProvider", "Manage {0}...", vendorEntry.group.name),
        class: ThemeIcon.asClassName(Codicon.gear),
        run: async () => {
          await this.commandService.executeCommand(vendorEntry.vendor.managementCommand, vendorEntry.vendor.vendor);
          this.viewModel.refresh();
        }
      }));
    }
    templateData.actionBar.setActions(primaryActions, secondaryActions);
  }
  renderGroupElement(entry, index, templateData) {
  }
  renderModelElement(entry, index, templateData) {
    const primaryActions = [];
    if (entry.model.metadata.id !== "auto") {
      primaryActions.push(this.createPinAction(entry.model.identifier));
    }
    const configActions = this.languageModelsService.getModelConfigurationActions(entry.model.identifier);
    const secondaryActions = [...configActions];
    const vendor = entry.model.provider.vendor;
    if (!vendor.isDefault && !vendor.managementCommand && (configActions.length > 0 || entry.model.metadata.configurationSchema)) {
      secondaryActions.push(toAction({
        id: "configureModel",
        label: localize("models.configureModel", "Configure..."),
        run: () => this.languageModelsService.configureModel(entry.model.identifier)
      }));
    }
    templateData.actionBar.setActions(primaryActions, secondaryActions);
  }
  createPinAction(modelIdentifier) {
    const isPinned = this.languageModelsService.isModelPinned(modelIdentifier);
    return toAction({
      id: isPinned ? `unpin.${modelIdentifier}` : `pin.${modelIdentifier}`,
      label: isPinned ? localize("models.unpinModel", "Unpin Model") : localize("models.pinModel", "Pin Model"),
      class: ThemeIcon.asClassName(isPinned ? Codicon.pinned : Codicon.pin),
      run: () => {
        if (isPinned) {
          this.languageModelsService.unpinModel(modelIdentifier);
        } else {
          this.languageModelsService.pinModel(modelIdentifier);
        }
        this.viewModel.refresh();
      }
    });
  }
};
ActionsColumnRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILanguageModelsService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IContextMenuService)
], ActionsColumnRenderer);
class ProviderColumnRenderer extends ModelsTableColumnRenderer {
  constructor() {
    super(...arguments);
    this.templateId = ProviderColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "provider";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    const providerElement = DOM.append(container, $(".model-provider"));
    return {
      container,
      providerElement,
      disposables,
      elementDisposables
    };
  }
  renderVendorElement(entry, index, templateData) {
    templateData.providerElement.textContent = "";
  }
  renderGroupElement(entry, index, templateData) {
    templateData.providerElement.textContent = "";
  }
  renderModelElement(entry, index, templateData) {
    templateData.providerElement.textContent = getManageModelsProviderLabel(entry.model);
  }
}
let ChatModelsWidget = class extends Disposable {
  constructor(languageModelsService, instantiationService, extensionService, contextMenuService, chatEntitlementService, editorProgressService, commandService, editorGroupsService, contextKeyService, dialogService, extensionsWorkbenchService, environmentService, defaultAccountService) {
    super();
    this.languageModelsService = languageModelsService;
    this.instantiationService = instantiationService;
    this.extensionService = extensionService;
    this.contextMenuService = contextMenuService;
    this.chatEntitlementService = chatEntitlementService;
    this.editorProgressService = editorProgressService;
    this.commandService = commandService;
    this.editorGroupsService = editorGroupsService;
    this.contextKeyService = contextKeyService;
    this.dialogService = dialogService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.environmentService = environmentService;
    this.defaultAccountService = defaultAccountService;
    this._onDidChangeItemCount = this._register(new Emitter());
    this.onDidChangeItemCount = this._onDidChangeItemCount.event;
    this.tableMinWidth = 0;
    this.dropdownActions = [];
    this.defaultAccountResolved = false;
    this.tableDisposables = this._register(new DisposableStore());
    this.searchFocusContextKey = CONTEXT_MODELS_SEARCH_FOCUS.bindTo(this.contextKeyService);
    this.delayedFiltering = this._register(new Delayer(200));
    this.viewModel = this._register(this.instantiationService.createInstance(ChatModelsViewModel));
    this.element = DOM.$(".models-widget");
    this.create(this.element);
    this._register(this.defaultAccountService.onDidChangeDefaultAccount(() => {
      this.defaultAccountResolved = true;
      this.updateAddModelsButton();
    }));
    this.defaultAccountService.getDefaultAccount().then(() => {
      if (!this._store.isDisposed) {
        this.defaultAccountResolved = true;
        this.updateAddModelsButton();
      }
    });
    const loadingPromise = this.extensionService.whenInstalledExtensionsRegistered().then(() => this.viewModel.refresh());
    this.editorProgressService.showWhile(loadingPromise, 300);
  }
  static {
    this.NUM_INSTANCES = 0;
  }
  create(container) {
    const searchAndButtonContainer = DOM.append(container, $(".models-search-and-button-container"));
    const placeholder = localize("Search.FullTextSearchPlaceholder", "Type to search...");
    const searchContainer = DOM.append(searchAndButtonContainer, $(".models-search-container"));
    this.searchWidget = this._register(this.instantiationService.createInstance(
      SuggestEnabledInput,
      "chatModelsWidget.searchbox",
      searchContainer,
      {
        triggerCharacters: ["@", ":"],
        provideResults: (query) => {
          const providerSuggestions = this.viewModel.getVendors().map((v) => `@provider:"${v.displayName}"`);
          const allSuggestions = [
            ...providerSuggestions,
            ...SEARCH_SUGGESTIONS.CAPABILITIES
          ];
          if (!query.trim()) {
            return allSuggestions;
          }
          const queryParts = query.split(/\s/g);
          const lastPart = queryParts[queryParts.length - 1];
          if (lastPart.startsWith("@provider:")) {
            return providerSuggestions;
          } else if (lastPart.startsWith("@capability:")) {
            return SEARCH_SUGGESTIONS.CAPABILITIES;
          } else if (lastPart.startsWith("@")) {
            return allSuggestions;
          }
          return [];
        }
      },
      placeholder,
      `chatModelsWidget:searchinput:${ChatModelsWidget.NUM_INSTANCES++}`,
      {
        placeholderText: placeholder,
        styleOverrides: {
          inputBorder: settingsTextInputBorder
        },
        focusContextKey: this.searchFocusContextKey
      }
    ));
    const filterAction = this._register(new ModelsFilterAction());
    const clearSearchAction = this._register(new Action(
      "workbench.models.clearSearch",
      localize("clearSearch", "Clear Search"),
      ThemeIcon.asClassName(preferencesClearInputIcon),
      false,
      () => this.clearSearch()
    ));
    const collapseAllAction = this._register(new Action(
      "workbench.models.collapseAll",
      localize("collapseAll", "Collapse All"),
      ThemeIcon.asClassName(Codicon.collapseAll),
      false,
      () => {
        this.viewModel.collapseAll();
      }
    ));
    collapseAllAction.enabled = this.viewModel.viewModelEntries.some((e) => isLanguageModelGroupEntry(e) || isLanguageModelProviderEntry(e));
    this._register(this.viewModel.onDidChange(() => collapseAllAction.enabled = this.viewModel.viewModelEntries.some((e) => isLanguageModelProviderEntry(e) || isLanguageModelGroupEntry(e))));
    this._register(this.searchWidget.onInputDidChange(() => {
      clearSearchAction.enabled = !!this.searchWidget.getValue();
      this.filterModels();
    }));
    this.searchActionsContainer = DOM.append(searchContainer, $(".models-search-actions"));
    const actions = [clearSearchAction, collapseAllAction, filterAction];
    const toolBar = this._register(new ToolBar(this.searchActionsContainer, this.contextMenuService, {
      actionViewItemProvider: (action, options) => {
        if (action.id === filterAction.id) {
          return this.instantiationService.createInstance(ModelsSearchFilterDropdownMenuActionViewItem, action, options, {
            getValue: () => this.searchWidget.getValue(),
            setValue: (searchValue) => this.search(searchValue)
          }, this.viewModel);
        }
        return void 0;
      },
      getKeyBinding: () => void 0
    }));
    toolBar.setActions(actions);
    this.searchWidget.inputWidget.getContainerDomNode().style.paddingRight = `${DOM.getTotalWidth(this.searchActionsContainer) + 12}px`;
    this.addButtonContainer = DOM.append(searchAndButtonContainer, $(".section-title-actions"));
    const buttonOptions = {
      ...defaultButtonStyles,
      supportIcons: true
    };
    this.addButton = this._register(new Button(this.addButtonContainer, buttonOptions));
    this.addButton.label = `$(${Codicon.add.id}) ${localize("models.enableModelProvider", "Add Models")}`;
    this.addButton.element.classList.add("models-add-model-button");
    this.updateAddModelsButton();
    this._register(this.addButton.onDidClick((e) => {
      if (this.dropdownActions.length > 0) {
        this.contextMenuService.showContextMenu({
          getAnchor: () => this.addButton.element,
          getActions: () => this.dropdownActions
        });
      }
    }));
    if (!this.environmentService.isSessionsWindow) {
      const browseMarketplaceButton = this._register(new Button(this.addButtonContainer, {
        ...buttonOptions,
        secondary: true
      }));
      browseMarketplaceButton.label = `$(${Codicon.extensions.id}) ${localize("models.installProviderExtensions", "Install Model Providers")}`;
      browseMarketplaceButton.element.classList.add("models-browse-marketplace-button");
      this._register(browseMarketplaceButton.onDidClick(() => this.openLanguageModelProviderExtensionsSearch()));
    }
    this.tableContainer = DOM.append(container, $(".models-table-container"));
    this.createTable();
    this._register(this.viewModel.onDidChangeGrouping(() => this.createTable()));
    this._register(this.chatEntitlementService.onDidChangeEntitlement(() => {
      this.updateAddModelsButton();
      this.createTable();
    }));
    this._register(this.chatEntitlementService.onDidChangeUsageBasedBilling(() => this.createTable()));
    this._register(this.languageModelsService.onDidChangeLanguageModelVendors(() => this.updateAddModelsButton()));
    this._register(this.languageModelsService.onDidChangePinnedModels(() => this.viewModel.refresh()));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set(["github.copilot.clientByokEnabled"]))) {
        this.updateAddModelsButton();
      }
    }));
  }
  createTable() {
    this.tableDisposables.clear();
    DOM.clearNode(this.tableContainer);
    this.tableViewport = $(".models-table-viewport");
    this.tableInner = DOM.append(this.tableViewport, $(".models-table-inner"));
    this.tableScrollable = this.tableDisposables.add(new DomScrollableElement(this.tableViewport, {
      horizontal: ScrollbarVisibility.Auto,
      vertical: ScrollbarVisibility.Hidden,
      useShadows: false,
      scrollYToX: true
    }));
    this.tableContainer.appendChild(this.tableScrollable.getDomNode());
    const gutterColumnRenderer = this.instantiationService.createInstance(GutterColumnRenderer, this.viewModel);
    const modelNameColumnRenderer = this.instantiationService.createInstance(ModelNameColumnRenderer);
    const combinedCostColumnRenderer = this.instantiationService.createInstance(CombinedCostColumnRenderer);
    const tokenLimitsColumnRenderer = this.instantiationService.createInstance(TokenLimitsColumnRenderer);
    const capabilitiesColumnRenderer = this.instantiationService.createInstance(CapabilitiesColumnRenderer);
    const actionsColumnRenderer = this.instantiationService.createInstance(ActionsColumnRenderer, this.viewModel);
    const providerColumnRenderer = this.instantiationService.createInstance(ProviderColumnRenderer);
    this.tableDisposables.add(capabilitiesColumnRenderer);
    this.tableDisposables.add(capabilitiesColumnRenderer.onDidClickCapability((capability) => {
      const currentQuery = this.searchWidget.getValue();
      const query = `@capability:${capability}`;
      const newQuery = toggleFilter(currentQuery, { query });
      this.search(newQuery);
    }));
    const columns = [
      {
        label: "",
        tooltip: "",
        weight: 0.05,
        minimumWidth: 64,
        maximumWidth: 64,
        templateId: GutterColumnRenderer.TEMPLATE_ID,
        project(row) {
          return row;
        }
      },
      {
        label: localize("modelName", "Name"),
        tooltip: "",
        weight: 0.35,
        minimumWidth: 200,
        templateId: ModelNameColumnRenderer.TEMPLATE_ID,
        project(row) {
          return row;
        }
      }
    ];
    const isUBB = this.chatEntitlementService.quotas.usageBasedBilling === true;
    columns.push(
      {
        label: localize("tokenLimits", "Context Size"),
        tooltip: "",
        weight: 0.1,
        minimumWidth: 140,
        templateId: TokenLimitsColumnRenderer.TEMPLATE_ID,
        project(row) {
          return row;
        }
      },
      {
        label: localize("capabilities", "Capabilities"),
        tooltip: "",
        weight: 0.15,
        minimumWidth: 180,
        templateId: CapabilitiesColumnRenderer.TEMPLATE_ID,
        project(row) {
          return row;
        }
      },
      {
        label: isUBB ? localize("cost", "Cost (Credits per 1M Tokens)") : localize("pricing", "Pricing"),
        tooltip: "",
        weight: isUBB ? 0.24 : 0.15,
        minimumWidth: isUBB ? 240 : 200,
        templateId: CombinedCostColumnRenderer.TEMPLATE_ID,
        project(row) {
          return row;
        }
      },
      {
        label: "",
        tooltip: "",
        weight: 0.05,
        minimumWidth: 64,
        maximumWidth: 64,
        templateId: ActionsColumnRenderer.TEMPLATE_ID,
        project(row) {
          return row;
        }
      }
    );
    this.tableMinWidth = columns.reduce((sum, c) => sum + c.minimumWidth, 0);
    this.tableInner.style.minWidth = `${this.tableMinWidth}px`;
    this.table = this.tableDisposables.add(this.instantiationService.createInstance(
      WorkbenchTable,
      "ModelsWidget",
      this.tableInner,
      new Delegate(),
      columns,
      [
        gutterColumnRenderer,
        modelNameColumnRenderer,
        combinedCostColumnRenderer,
        tokenLimitsColumnRenderer,
        capabilitiesColumnRenderer,
        actionsColumnRenderer,
        providerColumnRenderer
      ],
      {
        identityProvider: { getId: (e) => e.id },
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel: (e) => {
            if (isLanguageModelProviderEntry(e)) {
              return e.hidden ? localize("vendor.hidden.ariaLabel", "{0} Models (hidden)", e.vendorEntry.group.name) : localize("vendor.ariaLabel", "{0} Models", e.vendorEntry.group.name);
            } else if (isLanguageModelGroupEntry(e)) {
              return e.id === "visible" ? localize("visible.ariaLabel", "Visible Models") : localize("hidden.ariaLabel", "Hidden Models");
            } else if (isStatusEntry(e)) {
              return localize("status.ariaLabel", "Status: {0}", e.message);
            }
            const ariaLabels = [];
            ariaLabels.push(e.model.hidden ? localize("model.name.hidden", "{0} from {1} (hidden)", e.model.metadata.name, getManageModelsProviderLabel(e.model)) : localize("model.name", "{0} from {1}", e.model.metadata.name, getManageModelsProviderLabel(e.model)));
            if (e.model.metadata.maxInputTokens || e.model.metadata.maxOutputTokens) {
              const totalTokens = (e.model.metadata.maxInputTokens ?? 0) + (e.model.metadata.maxOutputTokens ?? 0);
              ariaLabels.push(localize("model.contextSize.totalTokens", "Context size: {0} tokens", formatTokenCount(totalTokens)));
            }
            if (e.model.metadata.capabilities) {
              ariaLabels.push(localize("model.capabilities", "Capabilities: {0}", Object.keys(e.model.metadata.capabilities).join(", ")));
            }
            const pricingText = e.model.metadata.pricing ?? "-";
            if (pricingText !== "-") {
              ariaLabels.push(localize("pricing.ariaLabel", "Pricing: {0}", pricingText));
            }
            if (e.model.metadata.inputCost !== void 0) {
              ariaLabels.push(e.model.metadata.inputCost === 1 ? localize("inputCost.ariaLabel.singular", "Input cost: {0} credit per 1M tokens", e.model.metadata.inputCost) : localize("inputCost.ariaLabel.plural", "Input cost: {0} credits per 1M tokens", e.model.metadata.inputCost));
            }
            if (e.model.metadata.cacheCost !== void 0) {
              ariaLabels.push(e.model.metadata.cacheCost === 1 ? localize("cacheCost.ariaLabel.singular", "Cache read cost: {0} credit per 1M tokens", e.model.metadata.cacheCost) : localize("cacheCost.ariaLabel.plural", "Cache read cost: {0} credits per 1M tokens", e.model.metadata.cacheCost));
            }
            if (e.model.metadata.cacheWriteCost !== void 0) {
              ariaLabels.push(e.model.metadata.cacheWriteCost === 1 ? localize("cacheWriteCost.ariaLabel.singular", "Cache write cost: {0} credit per 1M tokens", e.model.metadata.cacheWriteCost) : localize("cacheWriteCost.ariaLabel.plural", "Cache write cost: {0} credits per 1M tokens", e.model.metadata.cacheWriteCost));
            }
            if (e.model.metadata.outputCost !== void 0) {
              ariaLabels.push(e.model.metadata.outputCost === 1 ? localize("outputCost.ariaLabel.singular", "Output cost: {0} credit per 1M tokens", e.model.metadata.outputCost) : localize("outputCost.ariaLabel.plural", "Output cost: {0} credits per 1M tokens", e.model.metadata.outputCost));
            }
            return ariaLabels.join(". ");
          },
          getWidgetAriaLabel: () => localize("modelsTable.ariaLabel", "Language Models")
        },
        multipleSelectionSupport: true,
        setRowLineHeight: false,
        openOnSingleClick: true,
        alwaysConsumeMouseWheel: false
      }
    ));
    this.tableDisposables.add(this.table.onContextMenu((e) => {
      if (!e.element) {
        return;
      }
      const selection = this.table.getSelection();
      const selectedEntries = selection.every((i) => i !== e.index) ? [e.element] : selection.map((i) => this.viewModel.viewModelEntries[i]).filter((e2) => !!e2);
      const selectedModelEntries = selectedEntries.filter(
        (entry) => !isLanguageModelProviderEntry(entry) && !isLanguageModelGroupEntry(entry) && !isStatusEntry(entry)
      );
      const actions = [];
      let configureGroup;
      let configureVendor;
      if (selectedModelEntries.length) {
        const pinnableEntries = selectedModelEntries.filter((e2) => e2.model.metadata.id !== "auto");
        if (pinnableEntries.length > 0) {
          const allPinned = pinnableEntries.every((e2) => this.languageModelsService.isModelPinned(e2.model.identifier));
          actions.push(toAction({
            id: allPinned ? "unpinModels" : "pinModels",
            label: allPinned ? localize("models.unpinModel", "Unpin Model") : localize("models.pinModel", "Pin Model"),
            class: ThemeIcon.asClassName(allPinned ? Codicon.pinned : Codicon.pin),
            run: () => {
              for (const entry of pinnableEntries) {
                if (allPinned) {
                  this.languageModelsService.unpinModel(entry.model.identifier);
                } else {
                  this.languageModelsService.pinModel(entry.model.identifier);
                }
              }
            }
          }));
        }
        const allHidden = selectedModelEntries.every((e2) => e2.model.hidden);
        actions.push(toAction({
          id: allHidden ? "showModels" : "hideModels",
          label: allHidden ? selectedModelEntries.length === 1 ? localize("models.showModel", "Show Model") : localize("models.showModelsPlural", "Show Models") : selectedModelEntries.length === 1 ? localize("models.hideModel", "Hide Model") : localize("models.hideModelsPlural", "Hide Models"),
          class: ThemeIcon.asClassName(allHidden ? Codicon.eyeClosed : Codicon.eye),
          run: () => this.viewModel.setModelsHidden(selectedModelEntries, !allHidden)
        }));
        if (selectedModelEntries.length === 1) {
          const configActions = this.languageModelsService.getModelConfigurationActions(selectedModelEntries[0].model.identifier);
          if (configActions.length) {
            actions.push(new Separator());
            actions.push(...configActions);
          }
        }
        configureGroup = selectedModelEntries[0].model.provider.group.name;
        configureVendor = selectedModelEntries[0].model.provider.vendor;
        if (selectedModelEntries.some((entry) => entry.model.provider.vendor.isDefault || entry.model.provider.group.name !== configureGroup)) {
          configureGroup = void 0;
          configureVendor = void 0;
        }
      } else if (selectedEntries.length === 1) {
        const entry = e.element;
        if (isLanguageModelProviderEntry(entry)) {
          configureGroup = entry.vendorEntry.group.name;
          configureVendor = entry.vendorEntry.vendor;
          actions.push(toAction({
            id: entry.hidden ? "showGroup" : "hideGroup",
            label: entry.hidden ? localize("models.showGroup", "Show All Models") : localize("models.hideGroup", "Hide All Models"),
            class: ThemeIcon.asClassName(entry.hidden ? Codicon.eyeClosed : Codicon.eye),
            run: () => this.viewModel.toggleGroupHidden(entry)
          }));
        }
      }
      if (configureGroup && configureVendor) {
        const groupActions = configureVendor.managementCommand ? [toAction({
          id: "manageVendor",
          label: localize("models.manageProvider", "Manage {0}...", configureGroup),
          run: async () => {
            await this.commandService.executeCommand(configureVendor.managementCommand, configureVendor.vendor);
            await this.viewModel.refresh();
          }
        })] : createProviderGroupActions(this.viewModel, configureVendor, configureGroup, this.languageModelsService, this.dialogService);
        if (groupActions.length) {
          if (actions.length) {
            actions.push(new Separator());
          }
          actions.push(...groupActions);
        }
      }
      if (actions.length > 0) {
        this.contextMenuService.showContextMenu({
          getAnchor: () => e.anchor,
          getActions: () => actions
        });
      }
    }));
    this.table.splice(0, this.table.length, this.viewModel.viewModelEntries);
    this._onDidChangeItemCount.fire(this.itemCount);
    this.tableDisposables.add(this.viewModel.onDidChange(({ at, removed, added }) => {
      this.table.splice(at, removed, added);
      this._onDidChangeItemCount.fire(this.itemCount);
      if (this.viewModel.selectedEntry) {
        const selectedEntryIndex = this.viewModel.viewModelEntries.indexOf(this.viewModel.selectedEntry);
        this.table.setFocus([selectedEntryIndex]);
        this.table.setSelection([selectedEntryIndex]);
      }
    }));
    this.tableDisposables.add(this.table.onDidOpen(async ({ element, browserEvent }) => {
      if (!element) {
        return;
      }
      if (isStatusEntry(element)) {
        return;
      }
      if (isLanguageModelProviderEntry(element) || isLanguageModelGroupEntry(element)) {
        this.viewModel.toggleCollapsed(element);
      }
    }));
    this.tableDisposables.add(this.table.onDidChangeSelection((e) => this.viewModel.selectedEntry = e.elements[0]));
    this.tableDisposables.add(this.table.onDidBlur(() => {
      if (this.viewModel.shouldRefilter()) {
        this.viewModel.filter(this.searchWidget.getValue());
      }
    }));
    this.layout(this.element.clientHeight, this.element.clientWidth);
  }
  updateAddModelsButton() {
    const configurableVendors = this.languageModelsService.getVendors().filter((vendor) => vendor.managementCommand || vendor.configuration);
    const entitlement = this.chatEntitlementService.entitlement;
    const isManagedEntitlement = entitlement === ChatEntitlement.Business || entitlement === ChatEntitlement.Enterprise;
    const supportsAddingModels = this.chatEntitlementService.isInternal || this.chatEntitlementService.clientByokEnabled || entitlement !== ChatEntitlement.Unknown && entitlement !== ChatEntitlement.Available && !isManagedEntitlement;
    this.dropdownActions = buildAddModelsDropdownActions(
      configurableVendors,
      supportsAddingModels,
      (vendor) => this.addModelsForVendor(vendor),
      this.defaultAccountResolved && this.defaultAccountService.currentDefaultAccount === null ? () => this.commandService.executeCommand(CHAT_SETUP_ACTION_ID) : void 0
    );
    this.addButton.enabled = this.dropdownActions.length > 0;
    this.addButton.setTitle(!supportsAddingModels && isManagedEntitlement ? localize("models.managedByOrganization", "Adding models is managed by your organization") : "");
  }
  async openLanguageModelProviderExtensionsSearch() {
    const activeModalEditorPart = this.editorGroupsService.activeModalEditorPart;
    const isInModalEditor = !!activeModalEditorPart && this.editorGroupsService.getPart(this.editorGroupsService.activeGroup) === activeModalEditorPart;
    if (isInModalEditor) {
      await this.commandService.executeCommand(CLOSE_MODAL_EDITOR_COMMAND_ID);
    }
    await this.extensionsWorkbenchService.openSearch(`tag:"${LANGUAGE_MODEL_CHAT_PROVIDER_EXTENSION_TAG}"`, false);
  }
  filterModels() {
    this.delayedFiltering.trigger(() => {
      this.viewModel.filter(this.searchWidget.getValue());
    });
  }
  async addModelsForVendor(vendor) {
    await this.languageModelsService.configureLanguageModelsProviderGroup(vendor.vendor);
    await this.viewModel.refresh();
  }
  layout(height, width) {
    width = width - 24;
    this.searchWidget.layout(new DOM.Dimension(width - this.searchActionsContainer.clientWidth - this.addButtonContainer.clientWidth - 8, 22));
    const tableHeight = height - 40;
    this.tableContainer.style.height = `${tableHeight}px`;
    const tableWidth = Math.max(width, this.tableMinWidth);
    this.table.layout(tableHeight, tableWidth);
    this.tableScrollable?.scanDomNode();
  }
  focusSearch() {
    this.searchWidget.focus();
  }
  search(filter) {
    this.focusSearch();
    this.searchWidget.setValue(filter);
    this.viewModel.filter(filter);
  }
  clearSearch() {
    this.focusSearch();
    this.searchWidget.setValue("");
  }
  render() {
    if (this.viewModel.shouldRefilter()) {
      this.viewModel.filter(this.searchWidget.getValue());
    }
  }
  /**
   * Gets the total model count (excluding vendor/group/status headers).
   */
  get itemCount() {
    return this.viewModel.viewModelEntries.filter((e) => !isLanguageModelProviderEntry(e) && !isLanguageModelGroupEntry(e) && !isStatusEntry(e)).length;
  }
  /**
   * Re-fires the current item count. Call after subscribing to onDidChangeItemCount
   * to ensure the subscriber receives the latest count.
   */
  fireItemCount() {
    this._onDidChangeItemCount.fire(this.itemCount);
  }
};
ChatModelsWidget = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IChatEntitlementService),
  __decorateParam(5, IEditorProgressService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, IExtensionsWorkbenchService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IDefaultAccountService)
], ChatModelsWidget);
export {
  ChatModelsWidget,
  buildAddModelsDropdownActions,
  getModelHoverContent
};
