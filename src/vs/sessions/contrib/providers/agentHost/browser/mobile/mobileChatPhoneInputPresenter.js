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
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { derived } from "../../../../../../base/common/observable.js";
import { localize } from "../../../../../../nls.js";
import { SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { observableContextKey } from "../../../../../../platform/observable/common/platformObservableUtils.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IUriIdentityService } from "../../../../../../platform/uriIdentity/common/uriIdentity.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../../workbench/common/contributions.js";
import { ToggleAgentModeActionId } from "../../../../../../workbench/contrib/chat/browser/actions/chatExecuteActions.js";
import { IChatPhoneInputPresenter } from "../../../../../../workbench/contrib/chat/browser/widget/input/chatPhoneInputPresenter.js";
import { getModelProviderIcon } from "../../../../../../workbench/contrib/chat/browser/widget/input/modelPicker/modelProviderIcons.js";
import { IWorkbenchLayoutService } from "../../../../../../workbench/services/layout/browser/layoutService.js";
import { isAgentHostProvider } from "../../../../../common/agentHostSessionsProvider.js";
import { ISessionsService } from "../../../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../../../services/sessions/browser/sessionsProvidersService.js";
import { showMobilePickerSheet } from "../../../../../browser/parts/mobile/mobilePickerSheet.js";
import { getAgentHostModeIcon } from "../agentHostModeIcon.js";
import { isWellKnownModeSchema, isWellKnownModeValue } from "../agentHostPermissionPickerDelegate.js";
import { normalizeModelPickerOptions } from "../../../../chat/browser/sessionModelSelectionModel.js";
import { createChatPhoneInputSessionContext, createChatPhoneInputTarget, matchesChatPhoneInputTarget } from "./mobileChatPhoneInputTarget.js";
let MobileChatPhoneInputPresenter = class extends Disposable {
  constructor(contextKeyService, _commandService, _layoutService, _sessionsService, _sessionsProvidersService, _uriIdentityService) {
    super();
    this._commandService = _commandService;
    this._layoutService = _layoutService;
    this._sessionsService = _sessionsService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._uriIdentityService = _uriIdentityService;
    const isPhoneCtx = observableContextKey("sessionsIsPhoneLayout", contextKeyService);
    this.enabled = derived(this, (reader) => isPhoneCtx.read(reader) === true);
  }
  async showCombinedModeAndModelSheet(_target, request) {
    const idToAction = /* @__PURE__ */ new Map();
    const registerAction = (action) => {
      const id = `chat-phone-picker-row-${idToAction.size}`;
      idToAction.set(id, action);
      return id;
    };
    const sessionContext = this._getSessionContext(request);
    const target = createChatPhoneInputTarget(sessionContext, this._uriIdentityService);
    const rawProvider = sessionContext ? this._sessionsProvidersService.getProvider(sessionContext.providerId) : void 0;
    const agentHostProvider = rawProvider && isAgentHostProvider(rawProvider) ? rawProvider : void 0;
    let sheetItems;
    if (sessionContext && agentHostProvider) {
      sheetItems = this._buildAgentHostSheetItems(sessionContext, agentHostProvider, registerAction);
    } else {
      if (request.kind !== "delegates") {
        return;
      }
      sheetItems = this._buildDelegateSheetItems(request.modeDelegate, request.modelDelegate, registerAction);
    }
    if (sheetItems.length === 0) {
      return;
    }
    await showMobilePickerSheet(
      this._layoutService.mainContainer,
      localize("chatPhoneInput.title", "Configure Session"),
      sheetItems,
      {
        stayOpenOnSelect: true,
        onDidSelect: (id) => {
          const action = idToAction.get(id);
          if (action) {
            this._performAction(action, target, request);
          }
        }
      }
    );
  }
  _buildAgentHostSheetItems(session, provider, registerAction) {
    const items = [];
    const config = provider.getSessionConfig(session.sessionId);
    const modeSchema = config?.schema.properties[SessionConfigKey.Mode];
    const modeItems = modeSchema && isWellKnownModeSchema(modeSchema) ? (modeSchema.enum ?? []).map((value, index) => ({
      value: String(value),
      label: modeSchema.enumLabels?.[index] ?? String(value),
      description: modeSchema.enumDescriptions?.[index]
    })) : [];
    const rawCurrentMode = config?.values[SessionConfigKey.Mode] ?? modeSchema?.default;
    const currentModeValue = typeof rawCurrentMode === "string" && modeItems.some((item) => item.value === rawCurrentMode) ? rawCurrentMode : modeItems[0]?.value;
    modeItems.forEach((item, index) => items.push({
      id: registerAction({ kind: "agentHostMode", value: item.value }),
      label: item.label,
      description: item.description,
      icon: getAgentHostModeIcon(item.value),
      checked: item.value === currentModeValue,
      sectionTitle: index === 0 ? localize("chatPhoneInput.modeSection", "Agent Mode") : void 0
    }));
    const models = provider.getModelsSnapshot(session.sessionId).models;
    const currentModelId = session.modelId;
    models.forEach((model, index) => items.push({
      id: registerAction({ kind: "agentHostModel", model }),
      label: model.metadata.name,
      icon: getModelProviderIcon(model),
      checked: model.identifier === currentModelId,
      sectionTitle: index === 0 ? localize("chatPhoneInput.modelSection", "Model") : void 0
    }));
    const options = normalizeModelPickerOptions(provider.getModelPickerOptions(session.sessionId));
    if (models.length === 0 && !options.showAutoModel) {
      items.push({
        id: "chat-phone-picker-no-models",
        label: localize("chatPhoneInput.noModels", "No models available"),
        disabled: true,
        sectionTitle: localize("chatPhoneInput.modelSection", "Model")
      });
    }
    return items;
  }
  _buildDelegateSheetItems(modeDelegate, modelDelegate, registerAction) {
    const items = [];
    const modes = modeDelegate.currentChatModes.get();
    const currentMode = modeDelegate.currentMode.get();
    [...modes.builtin, ...modes.custom].forEach((mode, index) => {
      const icon = mode.icon.get();
      items.push({
        id: registerAction({ kind: "mode", mode }),
        label: mode.label.get(),
        icon: ThemeIcon.isThemeIcon(icon) ? icon : void 0,
        checked: mode.id === currentMode.id,
        sectionTitle: index === 0 ? localize("chatPhoneInput.modeSection", "Agent Mode") : void 0
      });
    });
    const currentModel = modelDelegate.currentModel.get();
    modelDelegate.getModels().forEach((model, index) => items.push({
      id: registerAction({ kind: "model", model }),
      label: model.metadata.name,
      icon: getModelProviderIcon(model),
      checked: model.identifier === currentModel?.identifier,
      sectionTitle: index === 0 ? localize("chatPhoneInput.modelSection", "Model") : void 0
    }));
    return items;
  }
  _performAction(action, target, request) {
    const session = this._getSessionContext(request);
    if (!matchesChatPhoneInputTarget(target, session, this._uriIdentityService)) {
      return;
    }
    const provider = session ? this._sessionsProvidersService.getProvider(session.providerId) : void 0;
    const agentHostProvider = provider && isAgentHostProvider(provider) ? provider : void 0;
    switch (action.kind) {
      case "mode":
        if (request.kind === "delegates") {
          this._commandService.executeCommand(
            ToggleAgentModeActionId,
            { modeId: action.mode.id, sessionResource: request.modeDelegate.sessionResource() }
          ).catch(() => {
          });
        }
        break;
      case "model":
        if (request.kind === "delegates") {
          request.modelDelegate.setModel(action.model);
        }
        break;
      case "agentHostMode":
        if (session && agentHostProvider) {
          const schema = agentHostProvider.getSessionConfig(session.sessionId)?.schema.properties[SessionConfigKey.Mode];
          if (schema && isWellKnownModeValue(schema, action.value)) {
            agentHostProvider.setSessionConfigValue(session.sessionId, SessionConfigKey.Mode, action.value).catch(() => {
            });
          }
        }
        break;
      case "agentHostModel":
        if (session && agentHostProvider) {
          if (request.kind === "delegates") {
            request.modelDelegate.setModel(action.model);
          } else {
            request.selectModel(action.model.identifier);
          }
        }
        break;
    }
  }
  _getSessionContext(request) {
    return request.kind === "session" ? request.getSessionContext() : createChatPhoneInputSessionContext(this._sessionsService.activeSession.get());
  }
};
MobileChatPhoneInputPresenter = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IWorkbenchLayoutService),
  __decorateParam(3, ISessionsService),
  __decorateParam(4, ISessionsProvidersService),
  __decorateParam(5, IUriIdentityService)
], MobileChatPhoneInputPresenter);
let MobileChatPhoneInputPresenterContribution = class extends Disposable {
  constructor(presenter, instantiationService) {
    super();
    this._registration = this._register(new MutableDisposable());
    const impl = this._register(instantiationService.createInstance(MobileChatPhoneInputPresenter));
    this._registration.value = presenter.setImpl(impl);
  }
  static {
    this.ID = "sessions.contrib.mobileChatPhoneInputPresenter";
  }
};
MobileChatPhoneInputPresenterContribution = __decorateClass([
  __decorateParam(0, IChatPhoneInputPresenter),
  __decorateParam(1, IInstantiationService)
], MobileChatPhoneInputPresenterContribution);
registerWorkbenchContribution2(
  MobileChatPhoneInputPresenterContribution.ID,
  MobileChatPhoneInputPresenterContribution,
  WorkbenchPhase.AfterRestored
);
