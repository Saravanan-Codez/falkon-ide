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
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../base/common/observable.js";
import { localize2 } from "../../../../nls.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { ModelPickerActionItem } from "../../../../workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerActionItem.js";
import { IChatEntitlementService } from "../../../../workbench/services/chat/common/chatEntitlementService.js";
import { Menus } from "../../../browser/menus.js";
import { IsPhoneLayoutContext, SessionUsesCombinedConfigPickerContext } from "../../../common/contextkeys.js";
import { ISessionContext } from "../../../services/sessions/browser/sessionContext.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionModelSelectionModel } from "./sessionModelSelectionModel.js";
import { INewChatModelPickerService } from "./newChatModelPicker.js";
import { reportNewChatPickerClosed } from "./newChatPickerTelemetry.js";
import { markOnboardingTarget } from "../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
let ModelPicker = class extends Disposable {
  constructor(compact, instantiationService, _telemetryService, _newChatModelPickerService, _workspaceTrustManagementService, _chatEntitlementService, _sessionContext, _selectionModel) {
    super();
    this._telemetryService = _telemetryService;
    this._newChatModelPickerService = _newChatModelPickerService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._chatEntitlementService = _chatEntitlementService;
    this._sessionContext = _sessionContext;
    this._selectionModel = _selectionModel;
    this._renderDisposables = this._register(new DisposableStore());
    const currentModel = derived(this, (reader) => this._selectionModel.state.read(reader).currentModel);
    this._delegate = {
      currentModel,
      setModel: (model) => {
        const previousModel = this._selectionModel.state.get().currentModel;
        if (this._selectionModel.selectModel(model.identifier)) {
          reportNewChatPickerClosed(this._telemetryService, {
            id: "NewChatModelPicker",
            optionIdBefore: previousModel?.identifier,
            optionIdAfter: model.identifier,
            optionLabelBefore: previousModel?.metadata.name,
            optionLabelAfter: model.metadata.name,
            isPII: false
          });
        }
      },
      getModels: () => [...this._selectionModel.state.get().models],
      getPresentationOptions: () => ({
        ...this._selectionModel.state.get().options,
        showModelIcon: true
      }),
      isCacheWarm: () => {
        const session = this._sessionContext.session.get();
        return session ? session.status.get() !== SessionStatus.Untitled : false;
      }
    };
    const pickerOptions = {
      compact
    };
    const action = { id: "sessions.modelPicker", label: "", enabled: true, class: void 0, tooltip: "", run: () => {
    } };
    this._modelPicker = this._register(instantiationService.createInstance(ModelPickerActionItem, action, this._delegate, pickerOptions));
    this._register(this._newChatModelPickerService.registerModelPicker({
      open: () => this._modelPicker.openModelPicker(),
      switchToModel: (modelIdentifier) => this.switchToModel(modelIdentifier)
    }));
    this._register(autorun((reader) => {
      this._selectionModel.state.read(reader);
      this._updatePickerState();
    }));
    this._register(this._workspaceTrustManagementService.onDidChangeTrust(() => this._updatePickerState()));
    this._workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
      if (!this._store.isDisposed) {
        this._updatePickerState();
      }
    });
    this._register(this._chatEntitlementService.onDidChangeEntitlement(() => this._updatePickerState()));
    this._register(this._chatEntitlementService.onDidChangeSentiment(() => this._updatePickerState()));
    this._register(this._chatEntitlementService.onDidChangeAnonymous(() => this._updatePickerState()));
  }
  render(container) {
    this._renderDisposables.clear();
    this._container = container;
    this._modelPicker.render(container);
    this._renderDisposables.add(markOnboardingTarget(container, "sessions.newSession.modelPicker", {
      open: () => this._modelPicker.openModelPicker()
    }));
    this._updatePickerState();
  }
  switchToModel(modelIdentifier) {
    return this._selectionModel.selectModel(modelIdentifier);
  }
  /**
   * Whether the model picker should be shown for the given session. Visible
   * when the session has models, when its Auto model is unavailable (so the
   * widget can render the "No models available" empty state), or when the
   * workspace is untrusted / Chat still needs sign-in (so the widget can render
   * its Restricted Mode or Sign In state). Otherwise hidden, matching the
   * historical behavior for providers that offer no models.
   */
  _shouldShowPicker() {
    const state = this._selectionModel.state.get();
    if (state.models.length > 0) {
      return true;
    }
    if (this._modelPicker.isRestrictedMode() || this._modelPicker.isSetupRequired()) {
      return true;
    }
    return !state.options.showAutoModel;
  }
  _updatePickerState() {
    const visible = this._shouldShowPicker();
    this._modelPicker.setEnabled(visible);
    this._updateVisibility(visible);
  }
  _updateVisibility(visible) {
    if (this._container) {
      this._container.style.display = visible ? "" : "none";
    }
  }
};
ModelPicker = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, INewChatModelPickerService),
  __decorateParam(4, IWorkspaceTrustManagementService),
  __decorateParam(5, IChatEntitlementService),
  __decorateParam(6, ISessionContext),
  __decorateParam(7, ISessionModelSelectionModel)
], ModelPicker);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "sessions.modelPicker",
      title: localize2("sessionsModelPicker", "Model"),
      f1: false,
      menu: [{
        id: Menus.NewSessionConfig,
        group: "navigation",
        order: 1,
        // Hidden on phone when the active provider supplies a combined
        // mode + model picker instead (see MobileChatInputConfigPicker).
        when: ContextKeyExpr.or(IsPhoneLayoutContext.negate(), SessionUsesCombinedConfigPickerContext.negate())
      }]
    });
  }
  async run() {
  }
});
class ModelPickerActionViewItem extends BaseActionViewItem {
  constructor(picker) {
    super(void 0, { id: "", label: "", enabled: true, class: void 0, tooltip: "", run: () => {
    } });
    this.picker = picker;
  }
  render(container) {
    this.picker.render(container);
  }
  dispose() {
    this.picker.dispose();
    super.dispose();
  }
}
export {
  ModelPicker,
  ModelPickerActionViewItem
};
