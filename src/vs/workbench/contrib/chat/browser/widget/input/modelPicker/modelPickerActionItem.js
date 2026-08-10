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
import { getActiveWindow } from "../../../../../../../base/browser/dom.js";
import { getBaseLayerHoverDelegate } from "../../../../../../../base/browser/ui/hover/hoverDelegate2.js";
import { getDefaultHoverDelegate } from "../../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { BaseActionViewItem } from "../../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { MutableDisposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { localize } from "../../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { ModelPickerWidget } from "./modelPickerWidget.js";
let ModelPickerActionItem = class extends BaseActionViewItem {
  constructor(action, delegate, pickerOptions, instantiationService, _contextKeyService, keybindingService) {
    super(void 0, action);
    this.pickerOptions = pickerOptions;
    this._contextKeyService = _contextKeyService;
    this.keybindingService = keybindingService;
    this._managedHover = this._register(new MutableDisposable());
    this._pickerWidget = this._register(instantiationService.createInstance(ModelPickerWidget, delegate));
    this._pickerWidget.setSelectedModel(delegate.currentModel.get());
    this._pickerWidget.setCompact(pickerOptions.compact);
    this._register(autorun((t) => {
      const model = delegate.currentModel.read(t);
      this._pickerWidget.setSelectedModel(model);
      this._updateTooltip();
    }));
    this._register(this._pickerWidget.onDidChangeSelection((model) => delegate.setModel(model)));
  }
  render(container) {
    this._pickerWidget.render(container);
    this.element = this._pickerWidget.domNode;
    this._updateTooltip();
    container.classList.add("chat-input-picker-item");
  }
  _getAnchorElement() {
    if (this.element && getActiveWindow().document.contains(this.element)) {
      return this.element;
    }
    return this.pickerOptions.getOverflowAnchor?.() ?? this.element;
  }
  openModelPicker() {
    this._showPicker();
  }
  show() {
    this._showPicker();
  }
  setEnabled(enabled) {
    this._pickerWidget.setEnabled(enabled);
  }
  /**
   * Whether the picker has no usable model because the workspace is untrusted
   * (Restricted Mode). Lets a host (e.g. the sessions picker) keep the picker
   * visible to surface the "Models" placeholder and Trust Workspace action
   * instead of hiding it as an empty/no-model picker.
   */
  isRestrictedMode() {
    return this._pickerWidget.isRestrictedMode();
  }
  /**
   * Whether the picker has no usable model because Chat still needs sign-in /
   * setup. Like {@link isRestrictedMode}, lets a host keep the picker visible to
   * surface the "Models" placeholder and Sign In action.
   */
  isSetupRequired() {
    return this._pickerWidget.isSetupRequired();
  }
  _showPicker() {
    this._pickerWidget.show(this._getAnchorElement());
  }
  _updateTooltip() {
    const target = this._pickerWidget.nameButton;
    if (!target) {
      return;
    }
    this._managedHover.value = getBaseLayerHoverDelegate().setupManagedHover(
      getDefaultHoverDelegate("mouse"),
      target,
      () => this._getHoverContents()
    );
  }
  _getHoverContents() {
    let label = localize("chat.modelPicker.modelsLabel", "Models");
    const keybindingLabel = this.keybindingService.lookupKeybinding(this._action.id, this._contextKeyService)?.getLabel();
    if (keybindingLabel) {
      label += ` (${keybindingLabel})`;
    }
    if (this._pickerWidget.isRestrictedMode()) {
      return localize("chat.modelPicker.restrictedHover", "{0} \u2022 Unavailable while in Restricted mode. Trust Workspace to enable models.", label);
    }
    if (this._pickerWidget.isSetupRequired()) {
      return localize("chat.modelPicker.setupRequiredHover", "{0} \u2022 Sign in to GitHub Copilot to choose a model.", label);
    }
    const { statusIcon, tooltip } = this._pickerWidget.selectedModel?.metadata || {};
    return statusIcon && tooltip ? `${label} \u2022 ${tooltip}` : label;
  }
};
ModelPickerActionItem = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IKeybindingService)
], ModelPickerActionItem);
export {
  ModelPickerActionItem
};
