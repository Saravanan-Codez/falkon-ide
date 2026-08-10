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
import * as dom from "../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Gesture, EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { IActionViewItemService } from "../../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../../../platform/uriIdentity/common/uriIdentity.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../../workbench/common/contributions.js";
import { IChatPhoneInputPresenter } from "../../../../../../workbench/contrib/chat/browser/widget/input/chatPhoneInputPresenter.js";
import { getModelProviderIcon } from "../../../../../../workbench/contrib/chat/browser/widget/input/modelPicker/modelProviderIcons.js";
import { Menus } from "../../../../../browser/menus.js";
import { SessionUsesCombinedConfigPickerContext, IsPhoneLayoutContext } from "../../../../../common/contextkeys.js";
import { isAgentHostProvider, isAgentHostProviderId } from "../../../../../common/agentHostSessionsProvider.js";
import { ISessionsService } from "../../../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionContext } from "../../../../../services/sessions/browser/sessionContext.js";
import { isWellKnownModeSchema } from "../agentHostPermissionPickerDelegate.js";
import { getAgentHostModeIcon } from "../agentHostModeIcon.js";
import { INewChatModelPickerService } from "../../../../chat/browser/newChatModelPicker.js";
import { ISessionModelSelectionModel } from "../../../../chat/browser/sessionModelSelectionModel.js";
import { reportNewChatPickerClosed } from "../../../../chat/browser/newChatPickerTelemetry.js";
import { createChatPhoneInputSessionContext, createChatPhoneInputTarget, matchesChatPhoneInputTarget } from "./mobileChatPhoneInputTarget.js";
const MOBILE_CHAT_INPUT_CONFIG_PICKER_ID = "sessions.agentHost.mobileChatInputConfigPicker";
let MobileChatInputConfigPicker = class extends Disposable {
  constructor(_session, _sessionsProvidersService, _telemetryService, _phonePresenter, _newChatModelPickerService, _selectionModel, _uriIdentityService) {
    super();
    this._session = _session;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._telemetryService = _telemetryService;
    this._phonePresenter = _phonePresenter;
    this._newChatModelPickerService = _newChatModelPickerService;
    this._selectionModel = _selectionModel;
    this._uriIdentityService = _uriIdentityService;
    this._renderDisposables = this._register(new DisposableStore());
    this._providerListeners = this._register(new DisposableMap());
    this._register(this._newChatModelPickerService.registerModelPicker({
      open: () => {
        void this._showSheet();
      },
      switchToModel: (modelIdentifier) => this._switchToModel(modelIdentifier)
    }));
    this._register(autorun((reader) => {
      this._session.read(reader);
      this._selectionModel.state.read(reader);
      this._updateTrigger();
    }));
    this._register(this._sessionsProvidersService.onDidChangeProviders((e) => {
      for (const provider of e.removed) {
        this._providerListeners.deleteAndDispose(provider.id);
      }
      this._watchProviders(e.added);
      this._updateTrigger();
    }));
    this._watchProviders(this._sessionsProvidersService.getProviders());
  }
  /**
   * Subscribe to each agent-host provider's `onDidChangeSessionConfig`
   * so the button refreshes when the session's mode is mutated outside
   * the sheet (e.g. by a setting reload, schema re-resolve, or
   * another picker).
   */
  _watchProviders(providers) {
    for (const provider of providers) {
      if (this._providerListeners.has(provider.id)) {
        continue;
      }
      const resolved = this._sessionsProvidersService.getProvider(provider.id);
      if (!resolved || !isAgentHostProvider(resolved)) {
        continue;
      }
      this._providerListeners.set(provider.id, resolved.onDidChangeSessionConfig(() => this._updateTrigger()));
    }
  }
  render(container) {
    this._renderDisposables.clear();
    this._containerElement = container;
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot.sessions-chat-picker-slot-mobile-config"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    this._slotElement = slot;
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._renderDisposables.add(Gesture.addTarget(trigger));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._renderDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this._showSheet();
      }));
    }
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this._showSheet();
      }
    }));
    this._updateTrigger();
  }
  _getContext() {
    const session = this._session.get();
    if (!session) {
      return void 0;
    }
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return void 0;
    }
    const config = provider.getSessionConfig(session.sessionId);
    const modeSchema = config?.schema.properties[SessionConfigKey.Mode];
    const modeItems = modeSchema && isWellKnownModeSchema(modeSchema) ? (modeSchema.enum ?? []).map((value, index) => ({
      value: String(value),
      label: modeSchema.enumLabels?.[index] ?? String(value),
      description: modeSchema.enumDescriptions?.[index]
    })) : [];
    const rawCurrentMode = config?.values[SessionConfigKey.Mode] ?? modeSchema?.default;
    const currentMode = typeof rawCurrentMode === "string" && modeItems.some((i) => i.value === rawCurrentMode) ? rawCurrentMode : modeItems[0]?.value;
    const selectionState = this._selectionModel.state.get();
    const modelItems = selectionState.models;
    const currentModelId = selectionState.currentModel?.identifier;
    const showAutoModel = selectionState.options.showAutoModel;
    return { provider, session, modeItems, currentMode, modelItems, currentModelId, showAutoModel };
  }
  _updateTrigger() {
    if (!this._slotElement || !this._triggerElement || !this._containerElement) {
      return;
    }
    const ctx = this._getContext();
    if (!ctx || ctx.modeItems.length === 0 && ctx.modelItems.length === 0 && ctx.showAutoModel) {
      this._slotElement.style.display = "none";
      this._containerElement.style.display = "none";
      return;
    }
    this._slotElement.style.display = "";
    this._containerElement.style.display = "";
    dom.clearNode(this._triggerElement);
    const modeIcon = ctx.currentMode ? getAgentHostModeIcon(ctx.currentMode) : void 0;
    if (modeIcon) {
      dom.append(this._triggerElement, renderIcon(modeIcon));
    }
    const currentModel = ctx.currentModelId ? ctx.modelItems.find((m) => m.identifier === ctx.currentModelId) : void 0;
    if (currentModel) {
      dom.append(this._triggerElement, renderIcon(getModelProviderIcon(currentModel)));
    }
    const labelText = currentModel?.metadata.name ?? (ctx.showAutoModel ? localize("mobileChatInputConfigPicker.autoLabel", "Auto") : localize("mobileChatInputConfigPicker.noModelsLabel", "No models available"));
    const labelSpan = dom.append(this._triggerElement, dom.$("span.chat-input-picker-label"));
    labelSpan.textContent = labelText;
    const ariaParts = [];
    if (ctx.currentMode) {
      const modeItem = ctx.modeItems.find((i) => i.value === ctx.currentMode);
      if (modeItem) {
        ariaParts.push(modeItem.label);
      }
    }
    ariaParts.push(labelText);
    this._triggerElement.ariaLabel = localize(
      "mobileChatInputConfigPicker.triggerAriaLabel",
      "Pick Mode and Model, {0}",
      ariaParts.join(", ")
    );
    const isResolving = ctx.provider.isSessionConfigResolving(ctx.session.sessionId).get();
    this._slotElement.classList.toggle("resolving", isResolving);
    this._triggerElement.setAttribute("aria-disabled", isResolving ? "true" : "false");
  }
  _switchToModel(modelIdentifier) {
    return this._selectionModel.selectModel(modelIdentifier);
  }
  async _showSheet() {
    if (!this._triggerElement) {
      return;
    }
    const ctx = this._getContext();
    if (ctx && ctx.provider.isSessionConfigResolving(ctx.session.sessionId).get()) {
      return;
    }
    const trigger = this._triggerElement;
    const beforeCtx = ctx;
    const target = createChatPhoneInputTarget(createChatPhoneInputSessionContext(beforeCtx?.session), this._uriIdentityService);
    const beforeMode = beforeCtx?.currentMode;
    const beforeModeItem = beforeCtx?.modeItems.find((i) => i.value === beforeMode);
    const beforeModelId = beforeCtx?.currentModelId;
    const beforeModel = beforeModelId ? beforeCtx?.modelItems.find((m) => m.identifier === beforeModelId) : void 0;
    trigger.setAttribute("aria-expanded", "true");
    try {
      await this._phonePresenter.showCombinedModeAndModelSheet(trigger, {
        kind: "session",
        getSessionContext: () => createChatPhoneInputSessionContext(this._session.get()),
        selectModel: (modelIdentifier) => this._switchToModel(modelIdentifier)
      });
      const afterCtx = this._getContext();
      if (beforeCtx && afterCtx && matchesChatPhoneInputTarget(target, createChatPhoneInputSessionContext(afterCtx.session), this._uriIdentityService)) {
        if (beforeCtx.modeItems.length > 0) {
          const afterMode = afterCtx.currentMode;
          const afterModeItem = afterCtx.modeItems.find((i) => i.value === afterMode);
          reportNewChatPickerClosed(this._telemetryService, {
            id: "NewChatMobileChatInputConfigPicker",
            name: "NewChatMobileChatInputConfigPicker.mode",
            optionIdBefore: beforeMode,
            optionIdAfter: afterMode,
            optionLabelBefore: beforeModeItem?.label ?? beforeMode,
            optionLabelAfter: afterModeItem?.label ?? afterMode,
            isPII: false
          });
        }
        if (beforeCtx.modelItems.length > 0) {
          const afterModelId = afterCtx.currentModelId;
          const afterModel = afterModelId ? afterCtx.modelItems.find((m) => m.identifier === afterModelId) : void 0;
          reportNewChatPickerClosed(this._telemetryService, {
            id: "NewChatMobileChatInputConfigPicker",
            name: "NewChatMobileChatInputConfigPicker.model",
            optionIdBefore: beforeModelId,
            optionIdAfter: afterModelId,
            optionLabelBefore: beforeModel?.metadata.name,
            optionLabelAfter: afterModel?.metadata.name,
            isPII: false
          });
        }
      }
    } finally {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    }
  }
};
MobileChatInputConfigPicker = __decorateClass([
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IChatPhoneInputPresenter),
  __decorateParam(4, INewChatModelPickerService),
  __decorateParam(5, ISessionModelSelectionModel),
  __decorateParam(6, IUriIdentityService)
], MobileChatInputConfigPicker);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: MOBILE_CHAT_INPUT_CONFIG_PICKER_ID,
      title: localize2("mobileChatInputConfigPicker", "Mode and Model"),
      f1: false,
      menu: [{
        id: Menus.NewSessionConfig,
        group: "navigation",
        order: 0,
        when: ContextKeyExpr.and(SessionUsesCombinedConfigPickerContext, IsPhoneLayoutContext)
      }]
    });
  }
  async run() {
  }
});
let MobileChatInputConfigPickerContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.mobileChatInputConfigPicker";
  }
  constructor(actionViewItemService, instantiationService, sessionsService, contextKeyService) {
    super();
    const usesCombinedPicker = SessionUsesCombinedConfigPickerContext.bindTo(contextKeyService);
    this._register(autorun((reader) => {
      const session = sessionsService.activeSession.read(reader);
      usesCombinedPicker.set(!!session && isAgentHostProviderId(session.providerId));
    }));
    this._register(actionViewItemService.register(
      Menus.NewSessionConfig,
      MOBILE_CHAT_INPUT_CONFIG_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        const picker = scopedInstantiationService.createInstance(MobileChatInputConfigPicker, session);
        return new MobileChatInputConfigPickerActionViewItem(picker);
      }
    ));
  }
};
MobileChatInputConfigPickerContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IContextKeyService)
], MobileChatInputConfigPickerContribution);
class MobileChatInputConfigPickerActionViewItem extends BaseActionViewItem {
  constructor(_picker) {
    super(void 0, { id: "", label: "", enabled: true, class: void 0, tooltip: "", run: () => {
    } });
    this._picker = _picker;
  }
  render(container) {
    this._picker.render(container);
    container.classList.add("chat-input-picker-item");
  }
  dispose() {
    this._picker.dispose();
    super.dispose();
  }
}
registerWorkbenchContribution2(MobileChatInputConfigPickerContribution.ID, MobileChatInputConfigPickerContribution, WorkbenchPhase.AfterRestored);
