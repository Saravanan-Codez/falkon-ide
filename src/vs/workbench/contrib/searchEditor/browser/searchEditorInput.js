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
import "./media/searchEditor.css";
import { Emitter } from "../../../../base/common/event.js";
import { basename } from "../../../../base/common/path.js";
import { extname, isEqual, joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { localize } from "../../../../nls.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { EditorResourceAccessor, EditorInputCapabilities } from "../../../common/editor.js";
import { Memento } from "../../../common/memento.js";
import { SearchEditorFindMatchClass, SearchEditorInputTypeId, SearchEditorScheme, SearchEditorWorkingCopyTypeId } from "./constants.js";
import { SearchEditorModel, searchEditorModelFactory } from "./searchEditorModel.js";
import { defaultSearchConfig, parseSavedSearchEditor, serializeSearchConfiguration } from "./searchEditorSerialization.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../../../services/workingCopy/common/workingCopy.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { bufferToReadable, VSBuffer } from "../../../../base/common/buffer.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
const SEARCH_EDITOR_EXT = ".code-search";
const SearchEditorIcon = registerIcon("search-editor-label-icon", Codicon.search, localize("searchEditorLabelIcon", "Icon of the search editor label."));
let SearchEditorInput = class extends EditorInput {
  constructor(modelUri, backingUri, modelService, textFileService, fileDialogService, instantiationService, workingCopyService, telemetryService, pathService, storageService) {
    super();
    this.modelUri = modelUri;
    this.backingUri = backingUri;
    this.modelService = modelService;
    this.textFileService = textFileService;
    this.fileDialogService = fileDialogService;
    this.instantiationService = instantiationService;
    this.workingCopyService = workingCopyService;
    this.telemetryService = telemetryService;
    this.pathService = pathService;
    this.dirty = false;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this.oldDecorationsIDs = [];
    this.model = instantiationService.createInstance(SearchEditorModel, modelUri);
    if (this.modelUri.scheme !== SearchEditorScheme) {
      throw Error("SearchEditorInput must be invoked with a SearchEditorScheme uri");
    }
    this.memento = new Memento(SearchEditorInput.ID, storageService);
    this._register(storageService.onWillSaveState(() => this.memento.saveMemento()));
    const input = this;
    const workingCopyAdapter = new class {
      constructor() {
        this.typeId = SearchEditorWorkingCopyTypeId;
        this.resource = input.modelUri;
        this.capabilities = input.hasCapability(EditorInputCapabilities.Untitled) ? WorkingCopyCapabilities.Untitled : WorkingCopyCapabilities.None;
        this.onDidChangeDirty = input.onDidChangeDirty;
        this.onDidChangeContent = input.onDidChangeContent;
        this.onDidSave = input.onDidSave;
      }
      get name() {
        return input.getName();
      }
      isDirty() {
        return input.isDirty();
      }
      isModified() {
        return input.isDirty();
      }
      backup(token) {
        return input.backup(token);
      }
      save(options) {
        return input.save(0, options).then((editor) => !!editor);
      }
      revert(options) {
        return input.revert(0, options);
      }
    }();
    this._register(this.workingCopyService.registerWorkingCopy(workingCopyAdapter));
  }
  static {
    this.ID = SearchEditorInputTypeId;
  }
  get typeId() {
    return SearchEditorInput.ID;
  }
  get editorId() {
    return this.typeId;
  }
  getIcon() {
    return SearchEditorIcon;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.None;
    if (!this.backingUri) {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    return capabilities;
  }
  get resource() {
    return this.backingUri || this.modelUri;
  }
  async save(group, options) {
    if ((await this.resolveModels()).resultsModel.isDisposed()) {
      return;
    }
    if (this.backingUri) {
      await this.textFileService.write(this.backingUri, await this.serializeForDisk(), options);
      this.setDirty(false);
      this._onDidSave.fire({ reason: options?.reason, source: options?.source });
      return this;
    } else {
      return this.saveAs(group, options);
    }
  }
  tryReadConfigSync() {
    return this._cachedConfigurationModel?.config;
  }
  async serializeForDisk() {
    const { configurationModel, resultsModel } = await this.resolveModels();
    return serializeSearchConfiguration(configurationModel.config) + "\n" + resultsModel.getValue();
  }
  registerConfigChangeListeners(model) {
    this.configChangeListenerDisposable?.dispose();
    if (!this.isDisposed()) {
      this.configChangeListenerDisposable = model.onConfigDidUpdate(() => {
        if (this.lastLabel !== this.getName()) {
          this._onDidChangeLabel.fire();
          this.lastLabel = this.getName();
        }
        this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE).searchConfig = model.config;
      });
      this._register(this.configChangeListenerDisposable);
    }
  }
  async resolveModels() {
    return this.model.resolve().then((data) => {
      this._cachedResultsModel = data.resultsModel;
      this._cachedConfigurationModel = data.configurationModel;
      if (this.lastLabel !== this.getName()) {
        this._onDidChangeLabel.fire();
        this.lastLabel = this.getName();
      }
      this.registerConfigChangeListeners(data.configurationModel);
      return data;
    });
  }
  async saveAs(group, options) {
    const path = await this.fileDialogService.pickFileToSave(await this.suggestFileName(), options?.availableFileSystems);
    if (path) {
      this.telemetryService.publicLog2("searchEditor/saveSearchResults");
      const toWrite = await this.serializeForDisk();
      if (await this.textFileService.create([{ resource: path, value: toWrite, options: { overwrite: true } }])) {
        this.setDirty(false);
        if (!isEqual(path, this.modelUri)) {
          const input = this.instantiationService.invokeFunction(getOrMakeSearchEditorInput, { fileUri: path, from: "existingFile" });
          input.setMatchRanges(this.getMatchRanges());
          return input;
        }
        return this;
      }
    }
    return void 0;
  }
  getName(maxLength = 12) {
    const trimToMax = (label) => label.length < maxLength ? label : `${label.slice(0, maxLength - 3)}...`;
    if (this.backingUri) {
      const originalURI = EditorResourceAccessor.getOriginalUri(this);
      return localize("searchTitle.withQuery", "Search: {0}", basename((originalURI ?? this.backingUri).path, SEARCH_EDITOR_EXT));
    }
    const query = this._cachedConfigurationModel?.config?.query?.trim();
    if (query) {
      return localize("searchTitle.withQuery", "Search: {0}", trimToMax(query));
    }
    return localize("searchTitle", "Search");
  }
  setDirty(dirty) {
    const wasDirty = this.dirty;
    this.dirty = dirty;
    if (wasDirty !== dirty) {
      this._onDidChangeDirty.fire();
    }
  }
  isDirty() {
    return this.dirty;
  }
  async rename(group, target) {
    if (extname(target) === SEARCH_EDITOR_EXT) {
      return {
        editor: this.instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: "existingFile", fileUri: target })
      };
    }
    return void 0;
  }
  dispose() {
    this.modelService.destroyModel(this.modelUri);
    super.dispose();
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    if (other instanceof SearchEditorInput) {
      return !!(other.modelUri.fragment && other.modelUri.fragment === this.modelUri.fragment) || !!(other.backingUri && isEqual(other.backingUri, this.backingUri));
    }
    return false;
  }
  getMatchRanges() {
    return (this._cachedResultsModel?.getAllDecorations() ?? []).filter((decoration) => decoration.options.className === SearchEditorFindMatchClass).filter(({ range }) => !(range.startColumn === 1 && range.endColumn === 1)).map(({ range }) => range);
  }
  async setMatchRanges(ranges) {
    this.oldDecorationsIDs = (await this.resolveModels()).resultsModel.deltaDecorations(this.oldDecorationsIDs, ranges.map((range) => ({ range, options: { description: "search-editor-find-match", className: SearchEditorFindMatchClass, stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } })));
  }
  async revert(group, options) {
    if (options?.soft) {
      this.setDirty(false);
      return;
    }
    if (this.backingUri) {
      const { config, text } = await this.instantiationService.invokeFunction(parseSavedSearchEditor, this.backingUri);
      const { resultsModel, configurationModel } = await this.resolveModels();
      resultsModel.setValue(text);
      configurationModel.updateConfig(config);
    } else {
      (await this.resolveModels()).resultsModel.setValue("");
    }
    super.revert(group, options);
    this.setDirty(false);
  }
  async backup(token) {
    const contents = await this.serializeForDisk();
    if (token.isCancellationRequested) {
      return {};
    }
    return {
      content: bufferToReadable(VSBuffer.fromString(contents))
    };
  }
  async suggestFileName() {
    const query = (await this.resolveModels()).configurationModel.config.query;
    const searchFileName = (query.replace(/[^\w \-_]+/g, "_") || "Search") + SEARCH_EDITOR_EXT;
    return joinPath(await this.fileDialogService.defaultFilePath(this.pathService.defaultUriScheme), searchFileName);
  }
  toUntyped() {
    if (this.hasCapability(EditorInputCapabilities.Untitled)) {
      return void 0;
    }
    return {
      resource: this.resource,
      options: {
        override: SearchEditorInput.ID
      }
    };
  }
  copy() {
    const newModelUri = URI.from({ scheme: SearchEditorScheme, fragment: `${Math.random()}` });
    const config = this._cachedConfigurationModel?.config ?? {};
    const results = this._cachedResultsModel?.getValue() ?? "";
    return this.instantiationService.invokeFunction(
      getOrMakeSearchEditorInput,
      // eslint-disable-next-line local/code-no-any-casts
      { from: "rawData", config, resultsContents: results, modelUri: newModelUri }
      // modelUri is not in the type, but we handle it below
    );
  }
};
SearchEditorInput = __decorateClass([
  __decorateParam(2, IModelService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IWorkingCopyService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IPathService),
  __decorateParam(9, IStorageService)
], SearchEditorInput);
const getOrMakeSearchEditorInput = (accessor, existingData) => {
  const storageService = accessor.get(IStorageService);
  const configurationService = accessor.get(IConfigurationService);
  const instantiationService = accessor.get(IInstantiationService);
  let modelUri;
  if (existingData.from === "model") {
    modelUri = existingData.modelUri;
  } else if (existingData.from === "rawData" && existingData.modelUri) {
    modelUri = existingData.modelUri;
  } else {
    modelUri = URI.from({ scheme: SearchEditorScheme, fragment: `${Math.random()}` });
  }
  if (!searchEditorModelFactory.models.has(modelUri)) {
    if (existingData.from === "existingFile") {
      instantiationService.invokeFunction((accessor2) => searchEditorModelFactory.initializeModelFromExistingFile(accessor2, modelUri, existingData.fileUri));
    } else {
      const searchEditorSettings = configurationService.getValue("search").searchEditor;
      const reuseOldSettings = searchEditorSettings.reusePriorSearchConfiguration;
      const defaultNumberOfContextLines = searchEditorSettings.defaultNumberOfContextLines;
      const priorConfig = reuseOldSettings ? new Memento(SearchEditorInput.ID, storageService).getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE).searchConfig ?? {} : {};
      const defaultConfig = defaultSearchConfig();
      const config = { ...defaultConfig, ...priorConfig, ...existingData.config };
      if (defaultNumberOfContextLines !== null && defaultNumberOfContextLines !== void 0) {
        config.contextLines = existingData?.config?.contextLines ?? defaultNumberOfContextLines;
      }
      if (existingData.from === "rawData") {
        if (existingData.resultsContents) {
          config.contextLines = 0;
        }
        instantiationService.invokeFunction((accessor2) => searchEditorModelFactory.initializeModelFromRawData(accessor2, modelUri, config, existingData.resultsContents));
      } else {
        instantiationService.invokeFunction((accessor2) => searchEditorModelFactory.initializeModelFromExistingModel(accessor2, modelUri, config));
      }
    }
  }
  return instantiationService.createInstance(
    SearchEditorInput,
    modelUri,
    existingData.from === "existingFile" ? existingData.fileUri : existingData.from === "model" ? existingData.backupOf : void 0
  );
};
export {
  SEARCH_EDITOR_EXT,
  SearchEditorInput,
  getOrMakeSearchEditorInput
};
