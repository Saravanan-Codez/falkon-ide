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
import { equals } from "../../../../base/common/arrays.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IWorkbenchAssignmentService } from "../../assignment/common/assignmentService.js";
import { EnablementState, IWorkbenchExtensionEnablementService } from "../../extensionManagement/common/extensionManagement.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
const IInlineCompletionsUnificationService = createDecorator("inlineCompletionsUnificationService");
const CODE_UNIFICATION_PREFIX = "cmp-cht-";
const EXTENSION_UNIFICATION_PREFIX = "cmp-ext-";
const CODE_UNIFICATION_FF = "inlineCompletionsUnificationCode";
const MODEL_UNIFICATION_FF = "inlineCompletionsUnificationModel";
const isRunningUnificationExperiment = new RawContextKey("isRunningUnificationExperiment", false);
const ExtensionUnificationSetting = "chat.extensionUnification.enabled";
let InlineCompletionsUnificationImpl = class extends Disposable {
  constructor(_assignmentService, _contextKeyService, _configurationService, _extensionEnablementService, _extensionManagementService, _extensionService, productService) {
    super();
    this._assignmentService = _assignmentService;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._extensionEnablementService = _extensionEnablementService;
    this._extensionManagementService = _extensionManagementService;
    this._extensionService = _extensionService;
    this._state = new InlineCompletionsUnificationState(false, false, false, []);
    this._onDidStateChange = this._register(new Emitter());
    this.onDidStateChange = this._onDidStateChange.event;
    this._onDidChangeExtensionUnificationState = this._register(new Emitter());
    this._onDidChangeExtensionUnificationSetting = this._register(new Emitter());
    this._completionsExtensionId = productService.defaultChatAgent?.extensionId.toLowerCase();
    this._chatExtensionId = productService.defaultChatAgent?.chatExtensionId.toLowerCase();
    const relevantExtensions = [this._completionsExtensionId, this._chatExtensionId].filter((id) => !!id);
    this.isRunningUnificationExperiment = isRunningUnificationExperiment.bindTo(this._contextKeyService);
    this._assignmentService.addTelemetryAssignmentFilter({
      id: "inlineCompletionsUnification",
      exclude: (assignment) => assignment.startsWith(EXTENSION_UNIFICATION_PREFIX) && this._state.extensionUnification !== this._configurationService.getValue(ExtensionUnificationSetting),
      onDidChange: Event.any(this._onDidChangeExtensionUnificationState.event, this._onDidChangeExtensionUnificationSetting.event)
    });
    this._register(this._extensionEnablementService.onEnablementChanged((extensions) => {
      if (extensions.some((ext) => relevantExtensions.includes(ext.identifier.id.toLowerCase()))) {
        this._update();
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ExtensionUnificationSetting)) {
        this._update();
        this._onDidChangeExtensionUnificationSetting.fire();
      }
    }));
    this._register(this._extensionService.onDidChangeExtensions(({ added }) => {
      if (added.some((ext) => relevantExtensions.includes(ext.identifier.value.toLowerCase()))) {
        this._update();
      }
    }));
    this._register(this._assignmentService.onDidRefetchAssignments(() => this._update()));
    this._update();
  }
  get state() {
    return this._state;
  }
  async _update() {
    const [codeUnificationFF, modelUnificationFF, extensionUnificationEnabled] = await Promise.all([
      this._assignmentService.getTreatment(CODE_UNIFICATION_FF),
      this._assignmentService.getTreatment(MODEL_UNIFICATION_FF),
      this._isExtensionUnificationActive()
    ]);
    const extensionStatesMatchUnificationSetting = this._configurationService.getValue(ExtensionUnificationSetting) === extensionUnificationEnabled;
    const currentExperiments = await this._assignmentService.getCurrentExperiments();
    const newState = new InlineCompletionsUnificationState(
      codeUnificationFF === true,
      modelUnificationFF === true,
      extensionUnificationEnabled,
      currentExperiments?.filter((exp) => exp.startsWith(CODE_UNIFICATION_PREFIX) || extensionStatesMatchUnificationSetting && exp.startsWith(EXTENSION_UNIFICATION_PREFIX)) ?? []
    );
    if (this._state.equals(newState)) {
      return;
    }
    const previousState = this._state;
    this._state = newState;
    this.isRunningUnificationExperiment.set(this._state.codeUnification || this._state.modelUnification || this._state.extensionUnification);
    this._onDidStateChange.fire();
    if (previousState.extensionUnification !== this._state.extensionUnification) {
      this._onDidChangeExtensionUnificationState.fire();
    }
  }
  async _isExtensionUnificationActive() {
    if (!this._configurationService.getValue(ExtensionUnificationSetting)) {
      return false;
    }
    if (!this._completionsExtensionId || !this._chatExtensionId) {
      return false;
    }
    const [completionsExtension, chatExtension, installedExtensions] = await Promise.all([
      this._extensionService.getExtension(this._completionsExtensionId),
      this._extensionService.getExtension(this._chatExtensionId),
      this._extensionManagementService.getInstalled(ExtensionType.User)
    ]);
    if (!chatExtension || completionsExtension) {
      return false;
    }
    const completionExtensionInstalled = installedExtensions.filter((ext) => ext.identifier.id.toLowerCase() === this._completionsExtensionId);
    if (completionExtensionInstalled.length === 0) {
      return true;
    }
    const completionsExtensionDisabledByUnification = completionExtensionInstalled.some((ext) => this._extensionEnablementService.getEnablementState(ext) === EnablementState.DisabledByUnification);
    return !!chatExtension && completionsExtensionDisabledByUnification;
  }
};
InlineCompletionsUnificationImpl = __decorateClass([
  __decorateParam(0, IWorkbenchAssignmentService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IWorkbenchExtensionEnablementService),
  __decorateParam(4, IExtensionManagementService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IProductService)
], InlineCompletionsUnificationImpl);
class InlineCompletionsUnificationState {
  constructor(codeUnification, modelUnification, extensionUnification, expAssignments) {
    this.codeUnification = codeUnification;
    this.modelUnification = modelUnification;
    this.extensionUnification = extensionUnification;
    this.expAssignments = expAssignments;
  }
  equals(other) {
    return this.codeUnification === other.codeUnification && this.modelUnification === other.modelUnification && this.extensionUnification === other.extensionUnification && equals(this.expAssignments, other.expAssignments);
  }
}
registerSingleton(IInlineCompletionsUnificationService, InlineCompletionsUnificationImpl, InstantiationType.Delayed);
export {
  IInlineCompletionsUnificationService,
  InlineCompletionsUnificationImpl,
  isRunningUnificationExperiment
};
