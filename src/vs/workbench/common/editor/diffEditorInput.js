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
import { localize } from "../../../nls.js";
import { AbstractSideBySideEditorInputSerializer, SideBySideEditorInput } from "./sideBySideEditorInput.js";
import { TEXT_DIFF_EDITOR_ID, BINARY_DIFF_EDITOR_ID, Verbosity, isResourceDiffEditorInput, EditorInputCapabilities } from "../editor.js";
import { BaseTextEditorModel } from "./textEditorModel.js";
import { DiffEditorModel } from "./diffEditorModel.js";
import { TextDiffEditorModel } from "./textDiffEditorModel.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { shorten } from "../../../base/common/labels.js";
import { isResolvedEditorModel } from "../../../platform/editor/common/editor.js";
let DiffEditorInput = class extends SideBySideEditorInput {
  constructor(preferredName, preferredDescription, original, modified, forceOpenAsBinary, editorService) {
    super(preferredName, preferredDescription, original, modified, editorService);
    this.original = original;
    this.modified = modified;
    this.forceOpenAsBinary = forceOpenAsBinary;
    this.cachedModel = void 0;
    this.labels = this.computeLabels();
  }
  static {
    this.ID = "workbench.editors.diffEditorInput";
  }
  get typeId() {
    return DiffEditorInput.ID;
  }
  get editorId() {
    return this.modified.editorId === this.original.editorId ? this.modified.editorId : void 0;
  }
  get capabilities() {
    let capabilities = super.capabilities;
    if (this.labels.forceDescription) {
      capabilities |= EditorInputCapabilities.ForceDescription;
    }
    return capabilities;
  }
  computeLabels() {
    let name;
    let forceDescription = false;
    if (this.preferredName) {
      name = this.preferredName;
    } else {
      const originalName = this.original.getName();
      const modifiedName = this.modified.getName();
      name = localize("sideBySideLabels", "{0} \u2194 {1}", originalName, modifiedName);
      forceDescription = originalName === modifiedName;
    }
    let shortDescription;
    let mediumDescription;
    let longDescription;
    if (this.preferredDescription) {
      shortDescription = this.preferredDescription;
      mediumDescription = this.preferredDescription;
      longDescription = this.preferredDescription;
    } else {
      shortDescription = this.computeLabel(this.original.getDescription(Verbosity.SHORT), this.modified.getDescription(Verbosity.SHORT));
      longDescription = this.computeLabel(this.original.getDescription(Verbosity.LONG), this.modified.getDescription(Verbosity.LONG));
      const originalMediumDescription = this.original.getDescription(Verbosity.MEDIUM);
      const modifiedMediumDescription = this.modified.getDescription(Verbosity.MEDIUM);
      forceDescription = forceDescription && !!originalMediumDescription && !!modifiedMediumDescription && originalMediumDescription !== modifiedMediumDescription;
      if (typeof originalMediumDescription === "string" && typeof modifiedMediumDescription === "string" && // we can only `shorten` when both sides are strings...
      (originalMediumDescription || modifiedMediumDescription)) {
        const [shortenedOriginalMediumDescription, shortenedModifiedMediumDescription] = shorten([originalMediumDescription, modifiedMediumDescription]);
        mediumDescription = this.computeLabel(shortenedOriginalMediumDescription, shortenedModifiedMediumDescription);
      }
    }
    let shortTitle = this.computeLabel(this.original.getTitle(Verbosity.SHORT) ?? this.original.getName(), this.modified.getTitle(Verbosity.SHORT) ?? this.modified.getName(), " \u2194 ");
    let mediumTitle = this.computeLabel(this.original.getTitle(Verbosity.MEDIUM) ?? this.original.getName(), this.modified.getTitle(Verbosity.MEDIUM) ?? this.modified.getName(), " \u2194 ");
    let longTitle = this.computeLabel(this.original.getTitle(Verbosity.LONG) ?? this.original.getName(), this.modified.getTitle(Verbosity.LONG) ?? this.modified.getName(), " \u2194 ");
    const preferredTitle = this.getPreferredTitle();
    if (preferredTitle) {
      shortTitle = `${preferredTitle} (${shortTitle})`;
      mediumTitle = `${preferredTitle} (${mediumTitle})`;
      longTitle = `${preferredTitle} (${longTitle})`;
    }
    return { name, shortDescription, mediumDescription, longDescription, forceDescription, shortTitle, mediumTitle, longTitle };
  }
  computeLabel(originalLabel, modifiedLabel, separator = " - ") {
    if (!originalLabel || !modifiedLabel) {
      return void 0;
    }
    if (originalLabel === modifiedLabel) {
      return modifiedLabel;
    }
    return `${originalLabel}${separator}${modifiedLabel}`;
  }
  getName() {
    return this.labels.name;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.labels.shortDescription;
      case Verbosity.LONG:
        return this.labels.longDescription;
      case Verbosity.MEDIUM:
      default:
        return this.labels.mediumDescription;
    }
  }
  getTitle(verbosity) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.labels.shortTitle;
      case Verbosity.LONG:
        return this.labels.longTitle;
      default:
      case Verbosity.MEDIUM:
        return this.labels.mediumTitle;
    }
  }
  async resolve() {
    const resolvedModel = await this.createModel();
    this.cachedModel?.dispose();
    this.cachedModel = resolvedModel;
    return this.cachedModel;
  }
  prefersEditorPane(editorPanes) {
    if (this.forceOpenAsBinary) {
      return editorPanes.find((editorPane) => editorPane.typeId === BINARY_DIFF_EDITOR_ID);
    }
    return editorPanes.find((editorPane) => editorPane.typeId === TEXT_DIFF_EDITOR_ID);
  }
  async createModel() {
    const [originalEditorModel, modifiedEditorModel] = await Promise.all([
      this.original.resolve(),
      this.modified.resolve()
    ]);
    if (modifiedEditorModel instanceof BaseTextEditorModel && originalEditorModel instanceof BaseTextEditorModel) {
      return new TextDiffEditorModel(originalEditorModel, modifiedEditorModel);
    }
    return new DiffEditorModel(isResolvedEditorModel(originalEditorModel) ? originalEditorModel : void 0, isResolvedEditorModel(modifiedEditorModel) ? modifiedEditorModel : void 0);
  }
  toUntyped(options) {
    const untyped = super.toUntyped(options);
    if (untyped) {
      return {
        ...untyped,
        modified: untyped.primary,
        original: untyped.secondary
      };
    }
    return void 0;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof DiffEditorInput) {
      return this.modified.matches(otherInput.modified) && this.original.matches(otherInput.original) && otherInput.forceOpenAsBinary === this.forceOpenAsBinary;
    }
    if (isResourceDiffEditorInput(otherInput)) {
      return this.modified.matches(otherInput.modified) && this.original.matches(otherInput.original);
    }
    return false;
  }
  dispose() {
    if (this.cachedModel) {
      this.cachedModel.dispose();
      this.cachedModel = void 0;
    }
    super.dispose();
  }
};
DiffEditorInput = __decorateClass([
  __decorateParam(5, IEditorService)
], DiffEditorInput);
class DiffEditorInputSerializer extends AbstractSideBySideEditorInputSerializer {
  createEditorInput(instantiationService, name, description, secondaryInput, primaryInput) {
    return instantiationService.createInstance(DiffEditorInput, name, description, secondaryInput, primaryInput, void 0);
  }
}
export {
  DiffEditorInput,
  DiffEditorInputSerializer
};
