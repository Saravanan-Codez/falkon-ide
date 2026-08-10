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
import { localize } from "../../nls.js";
import { URI } from "../../base/common/uri.js";
import { dirname, isEqual, basenameOrAuthority } from "../../base/common/resources.js";
import { IconLabel } from "../../base/browser/ui/iconLabel/iconLabel.js";
import { ILanguageService } from "../../editor/common/languages/language.js";
import { IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IModelService } from "../../editor/common/services/model.js";
import { ITextFileService } from "../services/textfile/common/textfiles.js";
import { IDecorationsService } from "../services/decorations/common/decorations.js";
import { Schemas } from "../../base/common/network.js";
import { FileKind, FILES_ASSOCIATIONS_CONFIG } from "../../platform/files/common/files.js";
import { IThemeService } from "../../platform/theme/common/themeService.js";
import { Event, Emitter } from "../../base/common/event.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { getIconClasses } from "../../editor/common/services/getIconClasses.js";
import { Disposable, dispose, MutableDisposable } from "../../base/common/lifecycle.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { normalizeDriveLetter } from "../../base/common/labels.js";
import { INotebookDocumentService, extractCellOutputDetails } from "../services/notebook/common/notebookDocumentService.js";
function toResource(props) {
  if (!props?.resource) {
    return void 0;
  }
  if (URI.isUri(props.resource)) {
    return props.resource;
  }
  return props.resource.primary;
}
const DEFAULT_LABELS_CONTAINER = {
  onDidChangeVisibility: Event.None
};
let ResourceLabels = class extends Disposable {
  constructor(container, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService) {
    super();
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.modelService = modelService;
    this.workspaceService = workspaceService;
    this.languageService = languageService;
    this.decorationsService = decorationsService;
    this.themeService = themeService;
    this.labelService = labelService;
    this.textFileService = textFileService;
    this._onDidChangeDecorations = this._register(new Emitter());
    this.widgets = [];
    this.labels = [];
    this.registerListeners(container);
  }
  get onDidChangeDecorations() {
    return this._onDidChangeDecorations.event;
  }
  registerListeners(container) {
    this._register(container.onDidChangeVisibility((visible) => {
      this.widgets.forEach((widget) => widget.notifyVisibilityChanged(visible));
    }));
    this._register(this.languageService.onDidChange(() => this.widgets.forEach((widget) => widget.notifyExtensionsRegistered())));
    this._register(this.modelService.onModelLanguageChanged((e) => {
      if (!e.model.uri) {
        return;
      }
      this.widgets.forEach((widget) => widget.notifyModelLanguageChanged(e.model));
    }));
    this._register(this.modelService.onModelAdded((model) => {
      if (!model.uri) {
        return;
      }
      this.widgets.forEach((widget) => widget.notifyModelAdded(model));
    }));
    this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => {
      this.widgets.forEach((widget) => widget.notifyWorkspaceFoldersChange());
    }));
    this._register(this.decorationsService.onDidChangeDecorations((e) => {
      let notifyDidChangeDecorations = false;
      this.widgets.forEach((widget) => {
        if (widget.notifyFileDecorationsChanges(e)) {
          notifyDidChangeDecorations = true;
        }
      });
      if (notifyDidChangeDecorations) {
        this._onDidChangeDecorations.fire();
      }
    }));
    this._register(this.themeService.onDidColorThemeChange(() => this.widgets.forEach((widget) => widget.notifyThemeChange())));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(FILES_ASSOCIATIONS_CONFIG)) {
        this.widgets.forEach((widget) => widget.notifyFileAssociationsChange());
      }
    }));
    this._register(this.labelService.onDidChangeFormatters((e) => {
      this.widgets.forEach((widget) => widget.notifyFormattersChange(e.scheme));
    }));
    this._register(this.textFileService.untitled.onDidChangeLabel((model) => {
      this.widgets.forEach((widget) => widget.notifyUntitledLabelChange(model.resource));
    }));
  }
  get(index) {
    return this.labels[index];
  }
  create(container, options) {
    const widget = this.instantiationService.createInstance(ResourceLabelWidget, container, options);
    const label = {
      element: widget.element,
      get onDidRender() {
        return widget.onDidRender;
      },
      setLabel: (label2, description, options2) => widget.setLabel(label2, description, options2),
      setResource: (label2, options2) => widget.setResource(label2, options2),
      setFile: (resource, options2) => widget.setFile(resource, options2),
      clear: () => widget.clear(),
      dispose: () => this.disposeWidget(widget)
    };
    this.labels.push(label);
    this.widgets.push(widget);
    return label;
  }
  disposeWidget(widget) {
    const index = this.widgets.indexOf(widget);
    if (index > -1) {
      this.widgets.splice(index, 1);
      this.labels.splice(index, 1);
    }
    dispose(widget);
  }
  clear() {
    this.widgets = dispose(this.widgets);
    this.labels = [];
  }
  dispose() {
    super.dispose();
    this.clear();
  }
};
ResourceLabels = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, IDecorationsService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, ITextFileService)
], ResourceLabels);
let ResourceLabel = class extends ResourceLabels {
  get element() {
    return this.label;
  }
  constructor(container, options, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService) {
    super(DEFAULT_LABELS_CONTAINER, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService);
    this.label = this._register(this.create(container, options));
  }
};
ResourceLabel = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IDecorationsService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, ITextFileService)
], ResourceLabel);
var Redraw = /* @__PURE__ */ ((Redraw2) => {
  Redraw2[Redraw2["Basic"] = 1] = "Basic";
  Redraw2[Redraw2["Full"] = 2] = "Full";
  return Redraw2;
})(Redraw || {});
let ResourceLabelWidget = class extends IconLabel {
  constructor(container, options, languageService, modelService, decorationsService, labelService, textFileService, contextService, notebookDocumentService) {
    super(container, options);
    this.languageService = languageService;
    this.modelService = modelService;
    this.decorationsService = decorationsService;
    this.labelService = labelService;
    this.textFileService = textFileService;
    this.contextService = contextService;
    this.notebookDocumentService = notebookDocumentService;
    this._onDidRender = this._register(new Emitter());
    this.label = void 0;
    this.decoration = this._register(new MutableDisposable());
    this.options = void 0;
    this.computedIconClasses = void 0;
    this.computedLanguageId = void 0;
    this.computedPathLabel = void 0;
    this.computedWorkspaceFolderLabel = void 0;
    this.needsRedraw = void 0;
    this.isHidden = false;
  }
  get onDidRender() {
    return this._onDidRender.event;
  }
  notifyVisibilityChanged(visible) {
    if (visible === this.isHidden) {
      this.isHidden = !visible;
      if (visible && this.needsRedraw) {
        this.render({
          updateIcon: this.needsRedraw === 2 /* Full */,
          updateDecoration: this.needsRedraw === 2 /* Full */
        });
        this.needsRedraw = void 0;
      }
    }
  }
  notifyModelLanguageChanged(model) {
    this.handleModelEvent(model);
  }
  notifyModelAdded(model) {
    this.handleModelEvent(model);
  }
  handleModelEvent(model) {
    const resource = toResource(this.label);
    if (!resource) {
      return;
    }
    if (isEqual(model.uri, resource)) {
      if (this.computedLanguageId !== model.getLanguageId()) {
        this.computedLanguageId = model.getLanguageId();
        this.render({ updateIcon: true, updateDecoration: false });
      }
    }
  }
  notifyFileDecorationsChanges(e) {
    if (!this.options) {
      return false;
    }
    const resource = toResource(this.label);
    if (!resource) {
      return false;
    }
    if (this.options.fileDecorations && e.affectsResource(resource)) {
      return this.render({ updateIcon: false, updateDecoration: true });
    }
    return false;
  }
  notifyExtensionsRegistered() {
    this.render({ updateIcon: true, updateDecoration: false });
  }
  notifyThemeChange() {
    this.render({ updateIcon: false, updateDecoration: false });
  }
  notifyFileAssociationsChange() {
    this.render({ updateIcon: true, updateDecoration: false });
  }
  notifyFormattersChange(scheme) {
    if (toResource(this.label)?.scheme === scheme) {
      this.render({ updateIcon: false, updateDecoration: false });
    }
  }
  notifyUntitledLabelChange(resource) {
    if (isEqual(resource, toResource(this.label))) {
      this.render({ updateIcon: false, updateDecoration: false });
    }
  }
  notifyWorkspaceFoldersChange() {
    if (typeof this.computedWorkspaceFolderLabel === "string") {
      const resource = toResource(this.label);
      if (URI.isUri(resource) && this.label?.name === this.computedWorkspaceFolderLabel) {
        this.setFile(resource, this.options);
      }
    }
  }
  setFile(resource, options) {
    const hideLabel = options?.hideLabel;
    let name;
    if (!hideLabel) {
      if (options?.fileKind === FileKind.ROOT_FOLDER) {
        const workspaceFolder = this.contextService.getWorkspaceFolder(resource);
        if (workspaceFolder) {
          name = workspaceFolder.name;
          this.computedWorkspaceFolderLabel = name;
        }
      }
      if (!name) {
        name = normalizeDriveLetter(basenameOrAuthority(resource));
      }
    }
    let description;
    if (!options?.hidePath) {
      const descriptionCandidate = this.labelService.getUriLabel(dirname(resource), { relative: true });
      if (descriptionCandidate && descriptionCandidate !== ".") {
        description = descriptionCandidate;
      }
    }
    this.setResource({ resource, name, description, range: options?.range }, options);
  }
  setResource(label, options = /* @__PURE__ */ Object.create(null)) {
    const resource = toResource(label);
    const isSideBySideEditor = label?.resource && !URI.isUri(label.resource);
    if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.untitled) {
      const untitledModel = this.textFileService.untitled.get(resource);
      if (untitledModel && !untitledModel.hasAssociatedFilePath) {
        if (typeof label.name === "string") {
          label.name = untitledModel.name;
        }
        if (typeof label.description === "string") {
          const untitledDescription = untitledModel.resource.path;
          if (label.name !== untitledDescription) {
            label.description = untitledDescription;
          } else {
            label.description = void 0;
          }
        }
        const untitledTitle = untitledModel.resource.path;
        if (untitledModel.name !== untitledTitle) {
          options.title = `${untitledModel.name} \u2022 ${untitledTitle}`;
        } else {
          options.title = untitledTitle;
        }
      }
    }
    if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.vscodeNotebookCell) {
      const notebookDocument = this.notebookDocumentService.getNotebook(resource);
      const cellIndex = notebookDocument?.getCellIndex(resource);
      if (notebookDocument && cellIndex !== void 0 && typeof label.name === "string") {
        options.title = localize("notebookCellLabel", "{0} \u2022 Cell {1}", label.name, `${cellIndex + 1}`);
      }
      if (typeof label.name === "string" && notebookDocument && cellIndex !== void 0 && typeof label.name === "string") {
        label.name = localize("notebookCellLabel", "{0} \u2022 Cell {1}", label.name, `${cellIndex + 1}`);
      }
    }
    if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.vscodeNotebookCellOutput) {
      const notebookDocument = this.notebookDocumentService.getNotebook(resource);
      const outputUriData = extractCellOutputDetails(resource);
      if (outputUriData?.cellFragment) {
        if (!outputUriData.notebook) {
          return;
        }
        const cellUri = outputUriData.notebook.with({
          scheme: Schemas.vscodeNotebookCell,
          fragment: outputUriData.cellFragment
        });
        const cellIndex = notebookDocument?.getCellIndex(cellUri);
        const outputIndex = outputUriData.outputIndex;
        if (cellIndex !== void 0 && outputIndex !== void 0 && typeof label.name === "string") {
          label.name = localize(
            "notebookCellOutputLabel",
            "{0} \u2022 Cell {1} \u2022 Output {2}",
            label.name,
            `${cellIndex + 1}`,
            `${outputIndex + 1}`
          );
        } else if (cellIndex !== void 0 && typeof label.name === "string") {
          label.name = localize(
            "notebookCellOutputLabelSimple",
            "{0} \u2022 Cell {1} \u2022 Output",
            label.name,
            `${cellIndex + 1}`
          );
        }
      }
    }
    if (options.namePrefix) {
      if (typeof label.name === "string") {
        label.name = options.namePrefix + label.name;
      } else if (Array.isArray(label.name) && label.name.length > 0) {
        label.name = [options.namePrefix + label.name[0], ...label.name.slice(1)];
      }
    }
    if (options.nameSuffix) {
      if (typeof label.name === "string") {
        label.name = label.name + options.nameSuffix;
      } else if (Array.isArray(label.name) && label.name.length > 0) {
        label.name = [...label.name.slice(0, label.name.length - 1), label.name[label.name.length - 1] + options.nameSuffix];
      }
    }
    const hasResourceChanged = this.hasResourceChanged(label);
    const hasPathLabelChanged = hasResourceChanged || this.hasPathLabelChanged(label);
    const hasFileKindChanged = this.hasFileKindChanged(options);
    const hasIconChanged = this.hasIconChanged(options);
    this.label = label;
    this.options = options;
    if (hasResourceChanged) {
      this.computedLanguageId = void 0;
    }
    if (hasPathLabelChanged) {
      this.computedPathLabel = void 0;
    }
    this.render({
      updateIcon: hasResourceChanged || hasFileKindChanged || hasIconChanged,
      updateDecoration: hasResourceChanged || hasFileKindChanged
    });
  }
  hasFileKindChanged(newOptions) {
    const newFileKind = newOptions?.fileKind;
    const oldFileKind = this.options?.fileKind;
    return newFileKind !== oldFileKind;
  }
  hasResourceChanged(newLabel) {
    const newResource = toResource(newLabel);
    const oldResource = toResource(this.label);
    if (newResource && oldResource) {
      return newResource.toString() !== oldResource.toString();
    }
    if (!newResource && !oldResource) {
      return false;
    }
    return true;
  }
  hasPathLabelChanged(newLabel) {
    const newResource = toResource(newLabel);
    return !!newResource && this.computedPathLabel !== this.labelService.getUriLabel(newResource);
  }
  hasIconChanged(newOptions) {
    return this.options?.icon !== newOptions?.icon;
  }
  clear() {
    this.label = void 0;
    this.options = void 0;
    this.computedLanguageId = void 0;
    this.computedIconClasses = void 0;
    this.computedPathLabel = void 0;
    this.setLabel("");
  }
  render(options) {
    if (this.isHidden) {
      if (this.needsRedraw !== 2 /* Full */) {
        this.needsRedraw = options.updateIcon || options.updateDecoration ? 2 /* Full */ : 1 /* Basic */;
      }
      return false;
    }
    if (options.updateIcon) {
      this.computedIconClasses = void 0;
    }
    if (!this.label) {
      return false;
    }
    const iconLabelOptions = {
      title: "",
      bold: this.options?.bold,
      italic: this.options?.italic,
      strikethrough: this.options?.strikethrough,
      matches: this.options?.matches,
      descriptionMatches: this.options?.descriptionMatches,
      extraClasses: [],
      separator: this.options?.separator,
      domId: this.options?.domId,
      disabledCommand: this.options?.disabledCommand,
      labelEscapeNewLines: this.options?.labelEscapeNewLines,
      descriptionTitle: this.options?.descriptionTitle,
      supportIcons: this.options?.supportIcons
    };
    const resource = toResource(this.label);
    if (this.options?.title !== void 0) {
      iconLabelOptions.title = this.options.title;
    }
    if (resource && resource.scheme !== Schemas.data && (!this.options?.title || typeof this.options.title !== "string" && !this.options.title.markdownNotSupportedFallback)) {
      if (!this.computedPathLabel) {
        this.computedPathLabel = this.labelService.getUriLabel(resource);
      }
      if (!iconLabelOptions.title || typeof iconLabelOptions.title === "string") {
        iconLabelOptions.title = this.computedPathLabel;
      } else if (!iconLabelOptions.title.markdownNotSupportedFallback) {
        iconLabelOptions.title.markdownNotSupportedFallback = this.computedPathLabel;
      }
    }
    if (this.options && !this.options.hideIcon) {
      if (!this.computedIconClasses) {
        this.computedIconClasses = getIconClasses(this.modelService, this.languageService, resource, this.options.fileKind, this.options.icon);
      }
      if (URI.isUri(this.options.icon)) {
        iconLabelOptions.iconPath = this.options.icon;
      }
      iconLabelOptions.extraClasses = this.computedIconClasses.slice(0);
    }
    if (this.options?.extraClasses) {
      iconLabelOptions.extraClasses.push(...this.options.extraClasses);
    }
    if (this.options?.fileDecorations && resource) {
      if (options.updateDecoration) {
        this.decoration.value = this.decorationsService.getDecoration(resource, this.options.fileKind !== FileKind.FILE);
      }
      const decoration = this.decoration.value;
      if (decoration) {
        if (decoration.tooltip) {
          if (typeof iconLabelOptions.title === "string") {
            iconLabelOptions.title = `${iconLabelOptions.title} \u2022 ${decoration.tooltip}`;
          } else if (typeof iconLabelOptions.title?.markdown === "string") {
            const title = `${iconLabelOptions.title.markdown} \u2022 ${decoration.tooltip}`;
            iconLabelOptions.title = { markdown: title, markdownNotSupportedFallback: title };
          }
        }
        if (decoration.strikethrough) {
          iconLabelOptions.strikethrough = true;
        }
        if (this.options.fileDecorations.colors) {
          iconLabelOptions.extraClasses.push(decoration.labelClassName);
        }
        if (this.options.fileDecorations.badges) {
          iconLabelOptions.extraClasses.push(decoration.badgeClassName);
          iconLabelOptions.extraClasses.push(decoration.iconClassName);
        }
      }
    }
    if (this.label.range) {
      iconLabelOptions.suffix = this.label.range.startLineNumber !== this.label.range.endLineNumber ? `:${this.label.range.startLineNumber}-${this.label.range.endLineNumber}` : `:${this.label.range.startLineNumber}`;
    }
    this.setLabel(this.label.name ?? "", this.label.description, iconLabelOptions);
    this._onDidRender.fire();
    return true;
  }
  dispose() {
    super.dispose();
    this.label = void 0;
    this.options = void 0;
    this.computedLanguageId = void 0;
    this.computedIconClasses = void 0;
    this.computedPathLabel = void 0;
    this.computedWorkspaceFolderLabel = void 0;
  }
};
ResourceLabelWidget = __decorateClass([
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IDecorationsService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, INotebookDocumentService)
], ResourceLabelWidget);
export {
  DEFAULT_LABELS_CONTAINER,
  ResourceLabel,
  ResourceLabels
};
