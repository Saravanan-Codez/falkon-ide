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
import "./media/modelPicker.css";
import * as dom from "../../../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../../../base/browser/keyboardEvent.js";
import { renderIcon } from "../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { getBaseLayerHoverDelegate } from "../../../../../../../base/browser/ui/hover/hoverDelegate2.js";
import { getDefaultHoverDelegate } from "../../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { KeyCode } from "../../../../../../../base/common/keyCodes.js";
import { AnchorPosition } from "../../../../../../../base/common/layout.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../../base/common/lifecycle.js";
import { disposableTimeout } from "../../../../../../../base/common/async.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { localize } from "../../../../../../../nls.js";
import { IActionWidgetService } from "../../../../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IOpenerService } from "../../../../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../../../../platform/telemetry/common/telemetry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../../platform/storage/common/storage.js";
import { TelemetryTrustedValue } from "../../../../../../../platform/telemetry/common/telemetryUtils.js";
import { ILanguageModelsService } from "../../../../common/languageModels.js";
import { IChatEntitlementService } from "../../../../../../services/chat/common/chatEntitlementService.js";
import { CHAT_SETUP_ACTION_ID } from "../../../actions/chatActions.js";
import { IUriIdentityService } from "../../../../../../../platform/uriIdentity/common/uriIdentity.js";
import { GitHubPaths, IDefaultAccountService } from "../../../../../../../platform/defaultAccount/common/defaultAccount.js";
import { IUpdateService } from "../../../../../../../platform/update/common/update.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from "../../../../../../../platform/workspace/common/workspaceTrust.js";
import { withChatInputPickerMotion } from "../chatInputPickerActionItem.js";
import { buildModelPickerItems, createManageModelsAction, getModelPickerAccessibilityProvider, getModelPickerControlModels, ModelPickerSection, shouldShowManageModelsAction } from "./modelPickerItems.js";
import { ModelPickerConfiguration } from "./modelPickerConfiguration.js";
import { getModelPickerIcon } from "./modelProviderIcons.js";
import { getModelPickerUnavailableReason, isAutoModel, ModelPickerUnavailableReason, modelPickerRequiresSetup, shouldShowCacheBreakHint as computeShouldShowCacheBreakHint } from "./modelPickerPresentation.js";
const CACHE_BREAK_HINT_DISMISSED_STORAGE_KEY = "chat.cacheBreakHintDismissed";
let ModelPickerWidget = class extends Disposable {
  constructor(_delegate, _actionWidgetService, _commandService, _openerService, _telemetryService, _languageModelsService, _productService, _entitlementService, _updateService, _uriIdentityService, _defaultAccountService, _workspaceTrustManagementService, _workspaceTrustRequestService, _storageService, instantiationService) {
    super();
    this._delegate = _delegate;
    this._actionWidgetService = _actionWidgetService;
    this._commandService = _commandService;
    this._openerService = _openerService;
    this._telemetryService = _telemetryService;
    this._languageModelsService = _languageModelsService;
    this._productService = _productService;
    this._entitlementService = _entitlementService;
    this._updateService = _updateService;
    this._uriIdentityService = _uriIdentityService;
    this._defaultAccountService = _defaultAccountService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._workspaceTrustRequestService = _workspaceTrustRequestService;
    this._storageService = _storageService;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._workspaceTrustInitialized = false;
    this._activatingAfterTrust = false;
    this._activatingTimer = this._register(new MutableDisposable());
    this._pendingAuxiliaryRelayout = this._register(new MutableDisposable());
    this._activeShowDisposables = this._register(new MutableDisposable());
    this._showRequestId = 0;
    this._configuration = instantiationService.createInstance(ModelPickerConfiguration, {
      getSelectedModel: () => this._selectedModel,
      getConfigurationAccess: () => this._delegate.modelConfiguration ?? this._languageModelsService,
      isDisabled: () => !!this._domNode?.classList.contains("disabled"),
      shouldShowCacheBreakHint: () => this.shouldShowCacheBreakHint(
        /* excludeAutoModel */
        false
      ),
      getCacheBreakLearnMoreLink: () => this.getCacheBreakLearnMoreLink(),
      dismissCacheBreakHint: () => this.dismissCacheBreakHint(),
      onDidChangeVisibility: (visible) => this._delegate.onDidChangeVisibility?.(visible),
      getActionWidgetContainer: () => this._delegate.actionWidgetContainer,
      getActionWidgetAnchor: (anchor) => this._delegate.getActionWidgetAnchor?.(anchor) ?? anchor,
      getAnchorPosition: () => this._delegate.anchorPosition
    });
    this._register(this._languageModelsService.onDidChangeLanguageModels(() => {
      if (this._activatingAfterTrust && this._delegate.getModels().length > 0) {
        this._clearActivating();
      }
      this._renderLabel();
    }));
    this._register(this._workspaceTrustManagementService.onDidChangeTrust((trusted) => {
      if (trusted && this._delegate.getPresentationOptions().showAutoModel && this._delegate.getModels().length === 0) {
        this._activatingAfterTrust = true;
        this._activatingTimer.value = disposableTimeout(() => {
          this._activatingAfterTrust = false;
          this._renderLabel();
        }, 15e3);
      } else {
        this._clearActivating();
      }
      this._renderLabel();
    }));
    this._workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
      if (this._store.isDisposed) {
        return;
      }
      this._workspaceTrustInitialized = true;
      this._renderLabel();
    });
    this._register(this._entitlementService.onDidChangeUsageBasedBilling(() => {
      this._renderLabel();
    }));
    this._register(this._entitlementService.onDidChangeEntitlement(() => this._renderLabel()));
    this._register(this._entitlementService.onDidChangeSentiment(() => this._renderLabel()));
    this._register(this._entitlementService.onDidChangeAnonymous(() => this._renderLabel()));
    if (this._delegate.modelConfiguration?.onDidChange) {
      this._register(this._delegate.modelConfiguration.onDidChange(() => {
        this._renderLabel();
      }));
    }
  }
  get selectedModel() {
    return this._selectedModel;
  }
  get domNode() {
    return this._domNode;
  }
  get nameButton() {
    return this._nameButton;
  }
  setCompact(compact) {
    this._compact = compact;
    this._register(autorun((reader) => {
      const isCompact = compact.read(reader);
      if (this._domNode) {
        this._domNode.classList.toggle("compact", isCompact);
      }
      this._renderLabel();
    }));
  }
  setSelectedModel(model) {
    this._selectedModel = model;
    this._renderLabel();
  }
  setEnabled(enabled) {
    if (this._domNode) {
      this._domNode.classList.toggle("disabled", !enabled);
      this._domNode.setAttribute("aria-disabled", String(!enabled));
    }
  }
  setBadge(badge) {
    this._badge = badge;
    this._updateBadge();
  }
  /**
   * Why the picker currently has no model to offer (untrusted vs. needs
   * sign-in/setup), or `undefined` when a model is available. See
   * {@link getModelPickerUnavailableReason}.
   */
  _unavailableReason() {
    return getModelPickerUnavailableReason({
      trustInitialized: this._workspaceTrustInitialized,
      trusted: this._workspaceTrustManagementService.isWorkspaceTrusted(),
      pickerModels: this._delegate.getModels(),
      liveModelIds: this._languageModelsService.getLanguageModelIds(),
      requiresSetup: this._requiresSetup()
    });
  }
  _requiresSetup() {
    return modelPickerRequiresSetup({
      entitlement: this._entitlementService.entitlement,
      anonymous: this._entitlementService.anonymous,
      hasByokModels: this._entitlementService.hasByokModels
    });
  }
  /**
   * Whether the picker has no usable model specifically because the workspace
   * is untrusted (Restricted Mode disables the chat model providers).
   */
  isRestrictedMode() {
    return this._unavailableReason() === ModelPickerUnavailableReason.Restricted;
  }
  /**
   * Whether the picker has no usable model because Chat still needs sign-in /
   * setup (and the workspace is trusted, so it is not Restricted Mode). BYOK
   * and anonymous access never report this state.
   */
  isSetupRequired() {
    return this._unavailableReason() === ModelPickerUnavailableReason.SetupRequired;
  }
  _clearActivating() {
    this._activatingAfterTrust = false;
    this._activatingTimer.clear();
  }
  /**
   * Prompts the user to trust the workspace. On grant, providers register their
   * models and `onDidChangeLanguageModels` refreshes the picker.
   */
  async _requestWorkspaceTrust() {
    await this._workspaceTrustRequestService.requestWorkspaceTrust({
      message: localize("chat.modelPicker.trustMessage", "Trusting this workspace enables AI models and chat features.")
    });
  }
  /**
   * Starts the Chat setup / sign-in flow (same command as the title-bar Sign In
   * affordance). On completion the entitlement and model registry change, which
   * refreshes the picker.
   */
  _requestSetup() {
    this._commandService.executeCommand(CHAT_SETUP_ACTION_ID);
  }
  render(container) {
    this._domNode = dom.append(container, dom.$("div.action-label.model-picker-split"));
    this._domNode.setAttribute("role", "group");
    this._domNode.tabIndex = -1;
    if (this._compact?.get()) {
      this._domNode.classList.toggle("compact", true);
    }
    this._nameButton = dom.append(this._domNode, dom.$("a.model-picker-section.model-picker-name"));
    this._nameButton.tabIndex = 0;
    this._nameButton.setAttribute("role", "button");
    this._nameButton.setAttribute("aria-haspopup", "true");
    this._nameButton.setAttribute("aria-expanded", "false");
    this._configButton = dom.append(this._domNode, dom.$("a.model-picker-section.model-picker-config"));
    this._configButton.tabIndex = 0;
    this._configButton.setAttribute("role", "button");
    this._configButton.setAttribute("aria-haspopup", "true");
    this._configButton.setAttribute("aria-expanded", "false");
    this._configButton.style.display = "none";
    this._badgeIcon = dom.$("span.model-picker-badge");
    this._updateBadge();
    this._renderLabel();
    this._registerButtonAction(this._nameButton, () => this.show());
    this._registerButtonAction(this._configButton, () => this._configuration.show(this._configButton));
    this._register(getBaseLayerHoverDelegate().setupManagedHover(
      getDefaultHoverDelegate("mouse"),
      this._configButton,
      localize("chat.modelPicker.configTooltip", "Configure Model")
    ));
  }
  /**
   * Registers mouse-down and Enter/Space key handlers on a button element.
   */
  _registerButtonAction(element, action) {
    let expandedOnMouseDown = false;
    if (this._delegate.openOnMouseUp) {
      this._register(dom.addDisposableGenericMouseDownListener(element, (e) => {
        if (e.button === 0) {
          expandedOnMouseDown = element.getAttribute("aria-expanded") === "true";
        }
      }));
    }
    const runAction = (e) => {
      if (e.button !== 0) {
        return;
      }
      dom.EventHelper.stop(e, true);
      if (this._delegate.openOnMouseUp && expandedOnMouseDown && element.getAttribute("aria-expanded") !== "true") {
        expandedOnMouseDown = false;
        return;
      }
      expandedOnMouseDown = false;
      action();
    };
    this._register(this._delegate.openOnMouseUp ? dom.addDisposableGenericMouseUpListener(element, runAction) : dom.addDisposableGenericMouseDownListener(element, runAction));
    this._register(dom.addDisposableListener(element, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        action();
      }
    }));
  }
  /** The "Learn more" header link for cache-break hints; `undefined` when the product has no URL. */
  getCacheBreakLearnMoreLink() {
    const url = this._productService.defaultChatAgent?.optimizeUsageDocumentationUrl;
    return url ? { label: localize("chat.cacheBreak.learnMore", "Learn more"), uri: URI.parse(url) } : void 0;
  }
  isCacheBreakHintDismissed() {
    return this._storageService.getBoolean(CACHE_BREAK_HINT_DISMISSED_STORAGE_KEY, StorageScope.APPLICATION, false);
  }
  dismissCacheBreakHint() {
    this._storageService.store(CACHE_BREAK_HINT_DISMISSED_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
  }
  /**
   * The picker's current availability, derived once so the label states and the "nothing to switch
   * to" hint suppression (#325185) cannot disagree.
   */
  _availability() {
    const reason = this._unavailableReason();
    const empty = this._delegate.getModels().length === 0;
    const activating = reason === void 0 && empty && this._activatingAfterTrust;
    const genericNoModels = reason === void 0 && !activating && empty && !this._delegate.getPresentationOptions().showAutoModel;
    return { reason, activating, genericNoModels, noModels: reason !== void 0 || activating || genericNoModels };
  }
  /** Thin wrapper over {@link computeShouldShowCacheBreakHint} that supplies this picker's live state. */
  shouldShowCacheBreakHint(excludeAutoModel) {
    return computeShouldShowCacheBreakHint({
      dismissed: this.isCacheBreakHintDismissed(),
      cacheWarm: this._delegate.isCacheWarm?.() ?? false,
      noModelsAvailable: this._availability().noModels,
      excludeAutoModel,
      selectedModelIsAuto: !!this._selectedModel && isAutoModel(this._selectedModel)
    });
  }
  show(anchor) {
    const anchorElement = anchor ?? this._domNode;
    if (!anchorElement || this._domNode?.classList.contains("disabled")) {
      return;
    }
    if (this._nameButton?.getAttribute("aria-expanded") === "true") {
      this._showRequestId++;
      this._activeShowDisposables.clear();
      this._nameButton.setAttribute("aria-expanded", "false");
      const visibilityChange2 = this._delegate.onDidChangeVisibility?.(false);
      if (visibilityChange2) {
        void visibilityChange2.catch(() => {
        });
      }
      this._actionWidgetService.hide(true);
      return;
    }
    const previousModel = this._selectedModel;
    const onSelect = (model) => {
      this._telemetryService.publicLog2("chat.modelChange", {
        fromModel: previousModel?.metadata.vendor === "copilot" ? new TelemetryTrustedValue(previousModel.identifier) : "unknown",
        toModel: model.metadata.vendor === "copilot" ? new TelemetryTrustedValue(model.identifier) : "unknown",
        chatSessionId: this._delegate.getChatSessionId?.()
      });
      this._selectedModel = model;
      this._renderLabel();
      this._onDidChangeSelection.fire(model);
    };
    const onConfigure = (model, group) => {
      onSelect(model);
      this._actionWidgetService.hide();
      this._configuration.show(this._configButton, group);
    };
    const models = this._delegate.getModels();
    const presentation = this._delegate.getPresentationOptions();
    const manifest = this._languageModelsService.getModelsControlManifest();
    const controlModelsForTier = getModelPickerControlModels(manifest, this._entitlementService.entitlement, models);
    const canShowManageModelsAction = presentation.showManageModelsAction && shouldShowManageModelsAction(this._entitlementService);
    const manageModelsAction = canShowManageModelsAction ? createManageModelsAction(this._commandService) : void 0;
    const logModelPickerInteraction = (interaction) => {
      this._telemetryService.publicLog2("chat.modelPickerInteraction", { interaction });
    };
    const manageSettingsUrl = this._defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotSettings);
    const onTogglePin = (modelIdentifier, pinned) => {
      if (pinned) {
        this._languageModelsService.pinModel(modelIdentifier);
      } else {
        this._languageModelsService.unpinModel(modelIdentifier);
      }
      this._actionWidgetService.hide();
      this.show(anchorElement);
    };
    const items = buildModelPickerItems({
      models,
      selectedModelId: this._selectedModel?.identifier,
      recentModelIds: this._languageModelsService.getRecentlyUsedModelIds().filter((id) => !this._languageModelsService.isModelHidden(id)),
      pinnedModelIds: this._languageModelsService.getPinnedModelIds().filter((id) => !this._languageModelsService.isModelHidden(id)),
      controlModels: controlModelsForTier,
      currentVSCodeVersion: this._productService.version,
      updateStateType: this._updateService.state.type,
      manageSettingsUrl,
      manageModelsAction,
      chatEntitlementService: this._entitlementService,
      languageModelsService: this._languageModelsService,
      openerService: this._openerService,
      presentation: {
        ...presentation,
        restrictedMode: this.isRestrictedMode(),
        setupRequired: this.isSetupRequired(),
        isUBB: !!this._entitlementService.quotas.usageBasedBilling
      },
      actions: {
        onSelect,
        onTogglePin,
        onConfigure,
        onRequestTrust: () => {
          void this._requestWorkspaceTrust();
        },
        onRequestSetup: () => {
          this._requestSetup();
        }
      }
    });
    const hoverDisposables = new DisposableStore();
    const showDisposables = new DisposableStore();
    showDisposables.add(hoverDisposables);
    this._activeShowDisposables.value = showDisposables;
    for (const item of items) {
      if (item.hover?.disposable) {
        hoverDisposables.add(item.hover.disposable);
      }
    }
    const unavailable = this.isRestrictedMode() || this.isSetupRequired();
    const showCacheBreakHint = this.shouldShowCacheBreakHint(
      /* excludeAutoModel */
      true
    );
    const listOptions = withChatInputPickerMotion({
      className: "chat-model-picker-dropdown",
      headerText: showCacheBreakHint ? localize("chat.modelPicker.cacheBreakHint", "Switching models mid-session resets the prompt cache and may increase cost.") : void 0,
      headerIcon: showCacheBreakHint ? Codicon.info : void 0,
      headerLink: showCacheBreakHint ? this.getCacheBreakLearnMoreLink() : void 0,
      headerDismiss: showCacheBreakHint ? () => this.dismissCacheBreakHint() : void 0,
      showFilter: !unavailable,
      filterPlaceholder: localize("chat.modelPicker.search", "Search models"),
      focusFilterOnOpen: true,
      collapsedByDefault: /* @__PURE__ */ new Set([ModelPickerSection.Other]),
      onDidToggleSection: (section, collapsed) => {
        if (section === ModelPickerSection.Other) {
          logModelPickerInteraction(collapsed ? "otherModelsCollapsed" : "otherModelsExpanded");
        }
      },
      linkHandler: (uri) => {
        if (uri.scheme === "command" && uri.path === "workbench.action.chat.upgradePlan") {
          logModelPickerInteraction("premiumModelUpgradePlanClicked");
        } else if (manageSettingsUrl && this._uriIdentityService.extUri.isEqual(uri, URI.parse(manageSettingsUrl))) {
          logModelPickerInteraction("disabledModelContactAdminClicked");
        }
        void this._openerService.open(uri, { allowCommands: true });
      },
      minWidth: 200,
      anchorPosition: this._delegate.anchorPosition ?? AnchorPosition.ABOVE
    });
    const previouslyFocusedElement = dom.getActiveElement();
    const delegate = {
      onSelect: (action) => {
        this._actionWidgetService.hide();
        action.run();
      },
      onHide: () => {
        this._showRequestId++;
        if (this._activeShowDisposables.value === showDisposables) {
          this._activeShowDisposables.clear();
        } else {
          showDisposables.dispose();
        }
        this._nameButton?.setAttribute("aria-expanded", "false");
        const visibilityChange2 = this._delegate.onDidChangeVisibility?.(false);
        if (visibilityChange2) {
          void visibilityChange2.catch(() => {
          });
        }
        if (dom.isHTMLElement(previouslyFocusedElement)) {
          previouslyFocusedElement.focus();
        }
      }
    };
    this._nameButton?.setAttribute("aria-expanded", "true");
    const showRequestId = ++this._showRequestId;
    const showActionWidget = () => {
      if (showRequestId !== this._showRequestId || this._nameButton?.getAttribute("aria-expanded") !== "true") {
        if (this._activeShowDisposables.value === showDisposables) {
          this._activeShowDisposables.clear();
        }
        return;
      }
      this._actionWidgetService.show(
        "ChatModelPicker",
        false,
        items,
        delegate,
        this._delegate.getActionWidgetAnchor?.(anchorElement) ?? anchorElement,
        this._delegate.actionWidgetContainer,
        [],
        getModelPickerAccessibilityProvider(),
        listOptions
      );
      if (this._delegate.onDidChangeVisibility) {
        this._pendingAuxiliaryRelayout.value = dom.scheduleAtNextAnimationFrame(dom.getWindow(anchorElement), () => {
          this._actionWidgetService.updateItems(items);
        });
      }
    };
    const visibilityChange = this._delegate.onDidChangeVisibility?.(true);
    if (visibilityChange) {
      void visibilityChange.then(showActionWidget, () => {
        if (showRequestId !== this._showRequestId) {
          return;
        }
        this._showRequestId++;
        if (this._activeShowDisposables.value === showDisposables) {
          this._activeShowDisposables.clear();
        }
        this._nameButton?.setAttribute("aria-expanded", "false");
        const hideVisibilityChange = this._delegate.onDidChangeVisibility?.(false);
        if (hideVisibilityChange) {
          void hideVisibilityChange.catch(() => {
          });
        }
        if (dom.isHTMLElement(previouslyFocusedElement)) {
          previouslyFocusedElement.focus();
        }
      });
    } else {
      showActionWidget();
    }
  }
  dispose() {
    this._showRequestId++;
    this._activeShowDisposables.clear();
    this._configuration.dispose();
    if (this._nameButton?.getAttribute("aria-expanded") === "true") {
      this._actionWidgetService.hide(true);
    }
    super.dispose();
  }
  _updateBadge() {
    if (this._badgeIcon) {
      if (this._badge) {
        const icon = this._badge === "info" ? Codicon.info : Codicon.warning;
        dom.reset(this._badgeIcon, renderIcon(icon));
        this._badgeIcon.style.display = "";
        this._badgeIcon.classList.toggle("info", this._badge === "info");
        this._badgeIcon.classList.toggle("warning", this._badge === "warning");
      } else {
        this._badgeIcon.style.display = "none";
      }
    }
  }
  _renderLabel() {
    if (!this._domNode || !this._nameButton) {
      return;
    }
    const { name } = this._selectedModel?.metadata || {};
    const { reason, activating, genericNoModels, noModels: noModelsAvailable } = this._availability();
    const restrictedMode = reason === ModelPickerUnavailableReason.Restricted;
    const setupRequired = reason === ModelPickerUnavailableReason.SetupRequired;
    const unavailable = reason !== void 0;
    const nameChildren = [];
    const modelIcon = this._selectedModel ? this._selectedModel.metadata.statusIcon ?? (this._delegate.getPresentationOptions().showModelIcon ? getModelPickerIcon(this._selectedModel) : void 0) : void 0;
    const compact = this._compact?.get() ?? false;
    if (modelIcon && !noModelsAvailable) {
      nameChildren.push(renderIcon(modelIcon));
    }
    const modelLabel = unavailable ? localize("chat.modelPicker.modelsLabel", "Models") : activating ? localize("chat.modelPicker.activating", "Activating...") : genericNoModels ? localize("chat.modelPicker.noModels", "No models available") : name ?? localize("chat.modelPicker.auto", "Auto");
    if (!compact || !modelIcon || noModelsAvailable) {
      nameChildren.push(dom.$("span.chat-input-picker-label", void 0, modelLabel));
    }
    if (this._badgeIcon) {
      nameChildren.push(this._badgeIcon);
    }
    dom.reset(this._nameButton, ...nameChildren);
    if (this._configButton) {
      this._configuration.renderButton(this._configButton, compact, noModelsAvailable);
    }
    const ariaLabel = restrictedMode ? localize("chat.modelPicker.ariaLabelRestricted", "Models, unavailable while in Restricted mode") : setupRequired ? localize("chat.modelPicker.ariaLabelSetupRequired", "Models, sign in to use Copilot") : localize("chat.modelPicker.ariaLabel", "Models, {0}", modelLabel);
    this._domNode.ariaLabel = ariaLabel;
    this._nameButton.ariaLabel = ariaLabel;
  }
};
ModelPickerWidget = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, ILanguageModelsService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IChatEntitlementService),
  __decorateParam(8, IUpdateService),
  __decorateParam(9, IUriIdentityService),
  __decorateParam(10, IDefaultAccountService),
  __decorateParam(11, IWorkspaceTrustManagementService),
  __decorateParam(12, IWorkspaceTrustRequestService),
  __decorateParam(13, IStorageService),
  __decorateParam(14, IInstantiationService)
], ModelPickerWidget);
export {
  ModelPickerWidget
};
