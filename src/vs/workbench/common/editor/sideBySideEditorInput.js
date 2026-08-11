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
import { Event } from "../../../base/common/event.js";
import { localize } from "../../../nls.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { EditorInputCapabilities, EditorExtensions, isResourceSideBySideEditorInput, isDiffEditorInput, isResourceDiffEditorInput, findViewStateForEditor, isEditorInput, isResourceEditorInput, isResourceMergeEditorInput, isResourceMultiDiffEditorInput } from "../editor.js";
import { EditorInput } from "./editorInput.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
let SideBySideEditorInput = class extends EditorInput {
  constructor(preferredName, preferredDescription, secondary, primary, editorService) {
    super();
    this.preferredName = preferredName;
    this.preferredDescription = preferredDescription;
    this.secondary = secondary;
    this.primary = primary;
    this.editorService = editorService;
    this.hasIdenticalSides = this.primary.matches(this.secondary);
    this.registerListeners();
  }
  static {
    this.ID = "workbench.editorinputs.sidebysideEditorInput";
  }
  get typeId() {
    return SideBySideEditorInput.ID;
  }
  get capabilities() {
    let capabilities = this.primary.capabilities;
    capabilities &= ~EditorInputCapabilities.CanSplitInGroup;
    if (this.secondary.hasCapability(EditorInputCapabilities.RequiresTrust)) {
      capabilities |= EditorInputCapabilities.RequiresTrust;
    }
    if (this.secondary.hasCapability(EditorInputCapabilities.Singleton)) {
      capabilities |= EditorInputCapabilities.Singleton;
    }
    if (this.secondary.hasCapability(EditorInputCapabilities.ForceReveal)) {
      capabilities |= EditorInputCapabilities.ForceReveal;
    }
    capabilities |= EditorInputCapabilities.MultipleEditors;
    return capabilities;
  }
  get resource() {
    if (this.hasIdenticalSides) {
      return this.primary.resource;
    }
    return void 0;
  }
  registerListeners() {
    this._register(Event.once(Event.any(this.primary.onWillDispose, this.secondary.onWillDispose))(() => {
      if (!this.isDisposed()) {
        this.dispose();
      }
    }));
    this._register(this.primary.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
    this._register(this.primary.onDidChangeCapabilities(() => this._onDidChangeCapabilities.fire()));
    this._register(this.secondary.onDidChangeCapabilities(() => this._onDidChangeCapabilities.fire()));
    this._register(this.primary.onDidChangeLabel(() => this._onDidChangeLabel.fire()));
    this._register(this.secondary.onDidChangeLabel(() => this._onDidChangeLabel.fire()));
  }
  getName() {
    const preferredName = this.getPreferredName();
    if (preferredName) {
      return preferredName;
    }
    if (this.hasIdenticalSides) {
      return this.primary.getName();
    }
    return localize("sideBySideLabels", "{0} - {1}", this.secondary.getName(), this.primary.getName());
  }
  getPreferredName() {
    return this.preferredName;
  }
  getDescription(verbosity) {
    const preferredDescription = this.getPreferredDescription();
    if (preferredDescription) {
      return preferredDescription;
    }
    if (this.hasIdenticalSides) {
      return this.primary.getDescription(verbosity);
    }
    return super.getDescription(verbosity);
  }
  getPreferredDescription() {
    return this.preferredDescription;
  }
  getTitle(verbosity) {
    let title;
    if (this.hasIdenticalSides) {
      title = this.primary.getTitle(verbosity) ?? this.getName();
    } else {
      title = super.getTitle(verbosity);
    }
    const preferredTitle = this.getPreferredTitle();
    if (preferredTitle) {
      title = `${preferredTitle} (${title})`;
    }
    return title;
  }
  getPreferredTitle() {
    if (this.preferredName && this.preferredDescription) {
      return `${this.preferredName} ${this.preferredDescription}`;
    }
    if (this.preferredName || this.preferredDescription) {
      return this.preferredName ?? this.preferredDescription;
    }
    return void 0;
  }
  getLabelExtraClasses() {
    if (this.hasIdenticalSides) {
      return this.primary.getLabelExtraClasses();
    }
    return super.getLabelExtraClasses();
  }
  getAriaLabel() {
    if (this.hasIdenticalSides) {
      return this.primary.getAriaLabel();
    }
    return super.getAriaLabel();
  }
  getTelemetryDescriptor() {
    const descriptor = this.primary.getTelemetryDescriptor();
    return { ...descriptor, ...super.getTelemetryDescriptor() };
  }
  isDirty() {
    return this.primary.isDirty();
  }
  isSaving() {
    return this.primary.isSaving();
  }
  async save(group, options) {
    const primarySaveResult = await this.primary.save(group, options);
    return this.saveResultToEditor(primarySaveResult);
  }
  async saveAs(group, options) {
    const primarySaveResult = await this.primary.saveAs(group, options);
    return this.saveResultToEditor(primarySaveResult);
  }
  saveResultToEditor(primarySaveResult) {
    if (!primarySaveResult || !this.hasIdenticalSides) {
      return primarySaveResult;
    }
    if (this.primary.matches(primarySaveResult)) {
      return this;
    }
    if (primarySaveResult instanceof EditorInput) {
      return new SideBySideEditorInput(this.preferredName, this.preferredDescription, primarySaveResult, primarySaveResult, this.editorService);
    }
    if (!isResourceDiffEditorInput(primarySaveResult) && !isResourceMultiDiffEditorInput(primarySaveResult) && !isResourceSideBySideEditorInput(primarySaveResult) && !isResourceMergeEditorInput(primarySaveResult)) {
      return {
        primary: primarySaveResult,
        secondary: primarySaveResult,
        label: this.preferredName,
        description: this.preferredDescription
      };
    }
    return void 0;
  }
  revert(group, options) {
    return this.primary.revert(group, options);
  }
  async rename(group, target) {
    if (!this.hasIdenticalSides) {
      return;
    }
    const renameResult = await this.primary.rename(group, target);
    if (!renameResult) {
      return void 0;
    }
    if (isEditorInput(renameResult.editor)) {
      return {
        editor: new SideBySideEditorInput(this.preferredName, this.preferredDescription, renameResult.editor, renameResult.editor, this.editorService),
        options: {
          ...renameResult.options,
          viewState: findViewStateForEditor(this, group, this.editorService)
        }
      };
    }
    if (isResourceEditorInput(renameResult.editor)) {
      return {
        editor: {
          label: this.preferredName,
          description: this.preferredDescription,
          primary: renameResult.editor,
          secondary: renameResult.editor,
          options: {
            ...renameResult.options,
            viewState: findViewStateForEditor(this, group, this.editorService)
          }
        }
      };
    }
    return void 0;
  }
  isReadonly() {
    return this.primary.isReadonly();
  }
  toUntyped(options) {
    const primaryResourceEditorInput = this.primary.toUntyped(options);
    const secondaryResourceEditorInput = this.secondary.toUntyped(options);
    if (primaryResourceEditorInput && secondaryResourceEditorInput && !isResourceDiffEditorInput(primaryResourceEditorInput) && !isResourceDiffEditorInput(secondaryResourceEditorInput) && !isResourceMultiDiffEditorInput(primaryResourceEditorInput) && !isResourceMultiDiffEditorInput(secondaryResourceEditorInput) && !isResourceSideBySideEditorInput(primaryResourceEditorInput) && !isResourceSideBySideEditorInput(secondaryResourceEditorInput) && !isResourceMergeEditorInput(primaryResourceEditorInput) && !isResourceMergeEditorInput(secondaryResourceEditorInput)) {
      const untypedInput = {
        label: this.preferredName,
        description: this.preferredDescription,
        primary: primaryResourceEditorInput,
        secondary: secondaryResourceEditorInput
      };
      if (typeof options?.preserveViewState === "number") {
        untypedInput.options = {
          viewState: findViewStateForEditor(this, options.preserveViewState, this.editorService)
        };
      }
      return untypedInput;
    }
    return void 0;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (isDiffEditorInput(otherInput) || isResourceDiffEditorInput(otherInput)) {
      return false;
    }
    if (otherInput instanceof SideBySideEditorInput) {
      return this.primary.matches(otherInput.primary) && this.secondary.matches(otherInput.secondary);
    }
    if (isResourceSideBySideEditorInput(otherInput)) {
      return this.primary.matches(otherInput.primary) && this.secondary.matches(otherInput.secondary);
    }
    return false;
  }
};
SideBySideEditorInput = __decorateClass([
  __decorateParam(4, IEditorService)
], SideBySideEditorInput);
class AbstractSideBySideEditorInputSerializer {
  canSerialize(editorInput) {
    const input = editorInput;
    if (input.primary && input.secondary) {
      const [secondaryInputSerializer, primaryInputSerializer] = this.getSerializers(input.secondary.typeId, input.primary.typeId);
      return !!(secondaryInputSerializer?.canSerialize(input.secondary) && primaryInputSerializer?.canSerialize(input.primary));
    }
    return false;
  }
  serialize(editorInput) {
    const input = editorInput;
    if (input.primary && input.secondary) {
      const [secondaryInputSerializer, primaryInputSerializer] = this.getSerializers(input.secondary.typeId, input.primary.typeId);
      if (primaryInputSerializer && secondaryInputSerializer) {
        const primarySerialized = primaryInputSerializer.serialize(input.primary);
        const secondarySerialized = secondaryInputSerializer.serialize(input.secondary);
        if (primarySerialized && secondarySerialized) {
          const serializedEditorInput = {
            name: input.getPreferredName(),
            description: input.getPreferredDescription(),
            primarySerialized,
            secondarySerialized,
            primaryTypeId: input.primary.typeId,
            secondaryTypeId: input.secondary.typeId
          };
          return JSON.stringify(serializedEditorInput);
        }
      }
    }
    return void 0;
  }
  deserialize(instantiationService, serializedEditorInput) {
    const deserialized = JSON.parse(serializedEditorInput);
    const [secondaryInputSerializer, primaryInputSerializer] = this.getSerializers(deserialized.secondaryTypeId, deserialized.primaryTypeId);
    if (primaryInputSerializer && secondaryInputSerializer) {
      const primaryInput = primaryInputSerializer.deserialize(instantiationService, deserialized.primarySerialized);
      const secondaryInput = secondaryInputSerializer.deserialize(instantiationService, deserialized.secondarySerialized);
      if (primaryInput instanceof EditorInput && secondaryInput instanceof EditorInput) {
        return this.createEditorInput(instantiationService, deserialized.name, deserialized.description, secondaryInput, primaryInput);
      }
    }
    return void 0;
  }
  getSerializers(secondaryEditorInputTypeId, primaryEditorInputTypeId) {
    const registry = Registry.as(EditorExtensions.EditorFactory);
    return [registry.getEditorSerializer(secondaryEditorInputTypeId), registry.getEditorSerializer(primaryEditorInputTypeId)];
  }
}
class SideBySideEditorInputSerializer extends AbstractSideBySideEditorInputSerializer {
  createEditorInput(instantiationService, name, description, secondaryInput, primaryInput) {
    return instantiationService.createInstance(SideBySideEditorInput, name, description, secondaryInput, primaryInput);
  }
}
export {
  AbstractSideBySideEditorInputSerializer,
  SideBySideEditorInput,
  SideBySideEditorInputSerializer
};
