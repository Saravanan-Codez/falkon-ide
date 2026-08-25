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
import { Codicon } from "../../../../base/common/codicons.js";
import { OS } from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { KeybindingsEditorModel } from "./keybindingsEditorModel.js";
const KeybindingsEditorIcon = registerIcon("keybindings-editor-label-icon", Codicon.keyboard, nls.localize("keybindingsEditorLabelIcon", "Icon of the keybindings editor label."));
let KeybindingsEditorInput = class extends EditorInput {
  constructor(instantiationService) {
    super();
    this.searchOptions = null;
    this.resource = void 0;
    this.keybindingsModel = instantiationService.createInstance(KeybindingsEditorModel, OS);
  }
  static {
    this.ID = "workbench.input.keybindings";
  }
  get typeId() {
    return KeybindingsEditorInput.ID;
  }
  getName() {
    return nls.localize("keybindingsInputName", "Keyboard Shortcuts");
  }
  getIcon() {
    return KeybindingsEditorIcon;
  }
  async resolve() {
    return this.keybindingsModel;
  }
  matches(otherInput) {
    return otherInput instanceof KeybindingsEditorInput;
  }
  dispose() {
    this.keybindingsModel.dispose();
    super.dispose();
  }
};
KeybindingsEditorInput = __decorateClass([
  __decorateParam(0, IInstantiationService)
], KeybindingsEditorInput);
export {
  KeybindingsEditorInput
};
