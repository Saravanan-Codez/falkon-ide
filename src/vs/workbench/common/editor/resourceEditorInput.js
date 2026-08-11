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
import { Verbosity, EditorInputCapabilities } from "../editor.js";
import { EditorInput } from "./editorInput.js";
import { ByteSize, IFileService, getLargeFileConfirmationLimit } from "../../../platform/files/common/files.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { dirname, isEqual } from "../../../base/common/resources.js";
import { IFilesConfigurationService } from "../../services/filesConfiguration/common/filesConfigurationService.js";
import { isConfigured } from "../../../platform/configuration/common/configuration.js";
import { ITextResourceConfigurationService } from "../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../services/editor/common/customEditorLabelService.js";
let AbstractResourceEditorInput = class extends EditorInput {
  constructor(resource, preferredResource, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService) {
    super();
    this.resource = resource;
    this.labelService = labelService;
    this.fileService = fileService;
    this.filesConfigurationService = filesConfigurationService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.customEditorLabelService = customEditorLabelService;
    this._name = void 0;
    this._shortDescription = void 0;
    this._mediumDescription = void 0;
    this._longDescription = void 0;
    this._shortTitle = void 0;
    this._mediumTitle = void 0;
    this._longTitle = void 0;
    this._preferredResource = preferredResource || resource;
    this.registerListeners();
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.CanSplitInGroup;
    if (this.fileService.hasProvider(this.resource)) {
      if (this.filesConfigurationService.isReadonly(this.resource)) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    } else {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    if (!(capabilities & EditorInputCapabilities.Readonly)) {
      capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    }
    return capabilities;
  }
  get preferredResource() {
    return this._preferredResource;
  }
  registerListeners() {
    this._register(this.labelService.onDidChangeFormatters((e) => this.onLabelEvent(e.scheme)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onLabelEvent(e.scheme)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onLabelEvent(e.scheme)));
    this._register(this.customEditorLabelService.onDidChange(() => this.updateLabel()));
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
  }
  onLabelEvent(scheme) {
    if (scheme === this._preferredResource.scheme) {
      this.updateLabel();
    }
  }
  updateLabel() {
    this._name = void 0;
    this._shortDescription = void 0;
    this._mediumDescription = void 0;
    this._longDescription = void 0;
    this._shortTitle = void 0;
    this._mediumTitle = void 0;
    this._longTitle = void 0;
    this._onDidChangeLabel.fire();
  }
  setPreferredResource(preferredResource) {
    if (!isEqual(preferredResource, this._preferredResource)) {
      this._preferredResource = preferredResource;
      this.updateLabel();
    }
  }
  getName() {
    if (typeof this._name !== "string") {
      this._name = this.customEditorLabelService.getName(this._preferredResource) ?? this.labelService.getUriBasenameLabel(this._preferredResource);
    }
    return this._name;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.shortDescription;
      case Verbosity.LONG:
        return this.longDescription;
      case Verbosity.MEDIUM:
      default:
        return this.mediumDescription;
    }
  }
  get shortDescription() {
    if (typeof this._shortDescription !== "string") {
      this._shortDescription = this.labelService.getUriBasenameLabel(dirname(this._preferredResource));
    }
    return this._shortDescription;
  }
  get mediumDescription() {
    if (typeof this._mediumDescription !== "string") {
      this._mediumDescription = this.labelService.getUriLabel(dirname(this._preferredResource), { relative: true });
    }
    return this._mediumDescription;
  }
  get longDescription() {
    if (typeof this._longDescription !== "string") {
      this._longDescription = this.labelService.getUriLabel(dirname(this._preferredResource));
    }
    return this._longDescription;
  }
  get shortTitle() {
    if (typeof this._shortTitle !== "string") {
      this._shortTitle = this.getName();
    }
    return this._shortTitle;
  }
  get mediumTitle() {
    if (typeof this._mediumTitle !== "string") {
      this._mediumTitle = this.labelService.getUriLabel(this._preferredResource, { relative: true });
    }
    return this._mediumTitle;
  }
  get longTitle() {
    if (typeof this._longTitle !== "string") {
      this._longTitle = this.labelService.getUriLabel(this._preferredResource);
    }
    return this._longTitle;
  }
  getTitle(verbosity) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.shortTitle;
      case Verbosity.LONG:
        return this.longTitle;
      default:
      case Verbosity.MEDIUM:
        return this.mediumTitle;
    }
  }
  isReadonly() {
    return this.filesConfigurationService.isReadonly(this.resource);
  }
  ensureLimits(options) {
    if (options?.limits) {
      return options.limits;
    }
    const defaultSizeLimit = getLargeFileConfirmationLimit(this.resource);
    let configuredSizeLimit;
    const configuredSizeLimitMb = this.textResourceConfigurationService.inspect(this.resource, null, "workbench.editorLargeFileConfirmation");
    if (isConfigured(configuredSizeLimitMb)) {
      configuredSizeLimit = configuredSizeLimitMb.value * ByteSize.MB;
    }
    return {
      size: configuredSizeLimit ?? defaultSizeLimit
    };
  }
};
AbstractResourceEditorInput = __decorateClass([
  __decorateParam(2, ILabelService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IFilesConfigurationService),
  __decorateParam(5, ITextResourceConfigurationService),
  __decorateParam(6, ICustomEditorLabelService)
], AbstractResourceEditorInput);
export {
  AbstractResourceEditorInput
};
