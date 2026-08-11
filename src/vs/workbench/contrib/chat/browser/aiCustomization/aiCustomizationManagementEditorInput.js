import { Codicon } from "../../../../../base/common/codicons.js";
import { localize } from "../../../../../nls.js";
import { EditorInputCapabilities, SaveReason } from "../../../../common/editor.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
import { AI_CUSTOMIZATION_MANAGEMENT_EDITOR_INPUT_ID } from "./aiCustomizationManagement.js";
class AICustomizationManagementEditorInput extends EditorInput {
  constructor() {
    super();
    this.resource = void 0;
    this._isDirty = false;
  }
  static {
    this.ID = AI_CUSTOMIZATION_MANAGEMENT_EDITOR_INPUT_ID;
  }
  static {
    this._activeHarnessLabel = "";
  }
  get capabilities() {
    return super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.RequiresModal;
  }
  /**
   * Gets or creates the singleton instance of this input.
   */
  static getOrCreate() {
    if (!AICustomizationManagementEditorInput._instance || AICustomizationManagementEditorInput._instance.isDisposed()) {
      AICustomizationManagementEditorInput._activeHarnessLabel = "";
      AICustomizationManagementEditorInput._instance = new AICustomizationManagementEditorInput();
    }
    return AICustomizationManagementEditorInput._instance;
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof AICustomizationManagementEditorInput;
  }
  get typeId() {
    return AICustomizationManagementEditorInput.ID;
  }
  getName() {
    const harnessLabel = AICustomizationManagementEditorInput._activeHarnessLabel;
    return harnessLabel ? localize("aiCustomizationManagementEditorNameWithHarness", "Agent Customizations for {0}", harnessLabel) : localize("aiCustomizationManagementEditorName", "Agent Customizations");
  }
  getIcon() {
    return Codicon.settingsGear;
  }
  getModalEditorOptions() {
    return { compactHeader: true };
  }
  async resolve() {
    return null;
  }
  isDirty() {
    return this._isDirty;
  }
  async save(group, options) {
    if (options?.reason !== void 0 && options.reason !== SaveReason.EXPLICIT) {
      return void 0;
    }
    if (this._saveHandler) {
      const saved = await this._saveHandler();
      return saved ? this : void 0;
    }
    return void 0;
  }
  async revert() {
    this.setDirty(false);
  }
  setHarnessLabel(label) {
    if (AICustomizationManagementEditorInput._activeHarnessLabel === label) {
      return;
    }
    AICustomizationManagementEditorInput._activeHarnessLabel = label;
    this._onDidChangeLabel.fire();
  }
  setDirty(dirty) {
    if (this._isDirty !== dirty) {
      this._isDirty = dirty;
      this._onDidChangeDirty.fire();
    }
  }
  setSaveHandler(handler) {
    this._saveHandler = handler;
  }
}
export {
  AICustomizationManagementEditorInput
};
