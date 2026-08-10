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
import { localize } from "../../../../nls.js";
import { deepClone } from "../../../../base/common/objects.js";
import { isObject, assertReturnsDefined } from "../../../../base/common/types.js";
import { AbstractTextEditor } from "./textEditor.js";
import { TEXT_DIFF_EDITOR_ID, EditorExtensions, isEditorInput, isEditorInputWithOptionsAndGroup, isTextEditorViewState, createTooLargeFileError } from "../../../common/editor.js";
import { applyTextEditorOptions } from "../../../common/editor/editorOptions.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { TextDiffEditorModel } from "../../../common/editor/textDiffEditorModel.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { TextFileOperationResult } from "../../../services/textfile/common/textfiles.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { EditorActivation } from "../../../../platform/editor/common/editor.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { isEqual } from "../../../../base/common/resources.js";
import { multibyteAwareBtoa } from "../../../../base/common/strings.js";
import { ByteSize, FileOperationResult, IFileService, TooLargeFileOperationError } from "../../../../platform/files/common/files.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { DiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
let TextDiffEditor = class extends AbstractTextEditor {
  constructor(group, telemetryService, instantiationService, storageService, configurationService, editorService, themeService, editorGroupService, fileService, preferencesService, editorResolverService) {
    super(TextDiffEditor.ID, group, telemetryService, instantiationService, storageService, configurationService, themeService, editorService, editorGroupService, fileService);
    this.preferencesService = preferencesService;
    this.editorResolverService = editorResolverService;
    this.diffEditorControl = void 0;
    this.inputLifecycleStopWatch = void 0;
    this._previousViewModel = null;
  }
  static {
    this.ID = TEXT_DIFF_EDITOR_ID;
  }
  get scopedContextKeyService() {
    if (!this.diffEditorControl) {
      return void 0;
    }
    const originalEditor = this.diffEditorControl.getOriginalEditor();
    const modifiedEditor = this.diffEditorControl.getModifiedEditor();
    return (originalEditor.hasTextFocus() ? originalEditor : modifiedEditor).invokeWithinContext((accessor) => accessor.get(IContextKeyService));
  }
  getTitle() {
    if (this.input) {
      return this.input.getName();
    }
    return localize("textDiffEditor", "Text Diff Editor");
  }
  createEditorControl(parent, configuration) {
    this.diffEditorControl = this._register(this.instantiationService.createInstance(DiffEditorWidget, parent, configuration, {}));
  }
  updateEditorControlOptions(options) {
    this.diffEditorControl?.updateOptions(options);
  }
  getMainControl() {
    return this.diffEditorControl?.getModifiedEditor();
  }
  async setInput(input, options, context, token) {
    if (this._previousViewModel) {
      this._previousViewModel.dispose();
      this._previousViewModel = null;
    }
    this.inputLifecycleStopWatch = void 0;
    await super.setInput(input, options, context, token);
    try {
      const resolvedModel = await input.resolve();
      if (token.isCancellationRequested) {
        return void 0;
      }
      if (!(resolvedModel instanceof TextDiffEditorModel)) {
        await this.openAsBinary(input, options);
        return void 0;
      }
      const control = assertReturnsDefined(this.diffEditorControl);
      const resolvedDiffEditorModel = resolvedModel;
      const vm = resolvedDiffEditorModel.textDiffEditorModel ? control.createViewModel(resolvedDiffEditorModel.textDiffEditorModel) : null;
      this._previousViewModel = vm;
      await vm?.waitForDiff();
      control.setModel(vm);
      let hasPreviousViewState = false;
      if (!isTextEditorViewState(options?.viewState)) {
        hasPreviousViewState = this.restoreTextDiffEditorViewState(input, options, context, control);
      }
      let optionsGotApplied = false;
      if (options) {
        optionsGotApplied = applyTextEditorOptions(options, control, ScrollType.Immediate);
      }
      if (!optionsGotApplied && !hasPreviousViewState) {
        control.revealFirstDiff();
      }
      control.updateOptions({
        ...this.getReadonlyConfiguration(resolvedDiffEditorModel.modifiedModel?.isReadonly()),
        originalEditable: !resolvedDiffEditorModel.originalModel?.isReadonly()
      });
      control.handleInitialized();
      this.inputLifecycleStopWatch = new StopWatch(false);
    } catch (error) {
      await this.handleSetInputError(error, input, options);
    }
  }
  async handleSetInputError(error, input, options) {
    if (this.isFileBinaryError(error)) {
      return this.openAsBinary(input, options);
    }
    if (error.fileOperationResult === FileOperationResult.FILE_TOO_LARGE) {
      let message;
      if (error instanceof TooLargeFileOperationError) {
        message = localize("fileTooLargeForHeapErrorWithSize", "At least one file is not displayed in the text compare editor because it is very large ({0}).", ByteSize.formatSize(error.size));
      } else {
        message = localize("fileTooLargeForHeapErrorWithoutSize", "At least one file is not displayed in the text compare editor because it is very large.");
      }
      throw createTooLargeFileError(this.group, input, options, message, this.preferencesService);
    }
    throw error;
  }
  restoreTextDiffEditorViewState(editor, options, context, control) {
    const editorViewState = this.loadEditorViewState(editor, context);
    if (editorViewState) {
      if (options?.selection && editorViewState.modified) {
        editorViewState.modified.cursorState = [];
      }
      control.restoreViewState(editorViewState);
      if (options?.revealIfVisible) {
        control.revealFirstDiff();
      }
      return true;
    }
    return false;
  }
  async openAsBinary(input, options) {
    const original = input.original;
    const modified = input.modified;
    const modifiedResource = modified.resource;
    if (modifiedResource) {
      const fallbackEditorId = this.editorResolverService.getBinaryDiffFallbackEditor(modifiedResource);
      const originalResource = original.resource;
      if (fallbackEditorId && originalResource) {
        const resolved = await this.editorResolverService.resolveEditor({
          original: { resource: originalResource },
          modified: { resource: modifiedResource },
          // Passing an explicit `override` bypasses the automatic `never` filtering and the diff
          // special-casing, so the resolver returns the custom diff editor directly.
          options: { ...options, override: fallbackEditorId }
        }, this.group);
        if (isEditorInputWithOptionsAndGroup(resolved)) {
          this.group.replaceEditors([{
            editor: input,
            replacement: resolved.editor,
            options: {
              ...resolved.options,
              activation: EditorActivation.PRESERVE,
              pinned: this.group.isPinned(input),
              sticky: this.group.isSticky(input)
            }
          }]);
          return;
        }
      }
    }
    const binaryDiffInput = this.instantiationService.createInstance(DiffEditorInput, input.getName(), input.getDescription(), original, modified, true);
    const fileEditorFactory = Registry.as(EditorExtensions.EditorFactory).getFileEditorFactory();
    if (fileEditorFactory.isFileEditor(original)) {
      original.setForceOpenAsBinary();
    }
    if (fileEditorFactory.isFileEditor(modified)) {
      modified.setForceOpenAsBinary();
    }
    this.group.replaceEditors([{
      editor: input,
      replacement: binaryDiffInput,
      options: {
        ...options,
        // Make sure to not steal away the currently active group
        // because we are triggering another openEditor() call
        // and do not control the initial intent that resulted
        // in us now opening as binary.
        activation: EditorActivation.PRESERVE,
        pinned: this.group.isPinned(input),
        sticky: this.group.isSticky(input)
      }
    }]);
  }
  setOptions(options) {
    super.setOptions(options);
    if (options) {
      applyTextEditorOptions(options, assertReturnsDefined(this.diffEditorControl), ScrollType.Smooth);
    }
  }
  shouldHandleConfigurationChangeEvent(e, resource) {
    if (super.shouldHandleConfigurationChangeEvent(e, resource)) {
      return true;
    }
    return e.affectsConfiguration(resource, "diffEditor") || e.affectsConfiguration(resource, "accessibility.verbosity.diffEditor");
  }
  computeConfiguration(configuration) {
    const editorConfiguration = super.computeConfiguration(configuration);
    if (isObject(configuration.diffEditor)) {
      const diffEditorConfiguration = deepClone(configuration.diffEditor);
      diffEditorConfiguration.diffCodeLens = diffEditorConfiguration.codeLens;
      delete diffEditorConfiguration.codeLens;
      diffEditorConfiguration.diffWordWrap = diffEditorConfiguration.wordWrap;
      delete diffEditorConfiguration.wordWrap;
      Object.assign(editorConfiguration, diffEditorConfiguration);
    }
    const verbose = configuration.accessibility?.verbosity?.diffEditor ?? false;
    editorConfiguration.accessibilityVerbose = verbose;
    return editorConfiguration;
  }
  getConfigurationOverrides(configuration) {
    return {
      ...super.getConfigurationOverrides(configuration),
      ...this.getReadonlyConfiguration(this.input?.isReadonly()),
      originalEditable: this.input instanceof DiffEditorInput && !this.input.original.isReadonly(),
      lineDecorationsWidth: "2ch"
    };
  }
  updateReadonly(input) {
    if (input instanceof DiffEditorInput) {
      this.diffEditorControl?.updateOptions({
        ...this.getReadonlyConfiguration(input.isReadonly()),
        originalEditable: !input.original.isReadonly()
      });
    } else {
      super.updateReadonly(input);
    }
  }
  isFileBinaryError(error) {
    if (Array.isArray(error)) {
      const errors = error;
      return errors.some((error2) => this.isFileBinaryError(error2));
    }
    return error.textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY;
  }
  clearInput() {
    if (this._previousViewModel) {
      this._previousViewModel.dispose();
      this._previousViewModel = null;
    }
    super.clearInput();
    const inputLifecycleElapsed = this.inputLifecycleStopWatch?.elapsed();
    this.inputLifecycleStopWatch = void 0;
    if (typeof inputLifecycleElapsed === "number") {
      this.logInputLifecycleTelemetry(inputLifecycleElapsed, this.getControl()?.getModel()?.modified?.getLanguageId());
    }
    this.diffEditorControl?.setModel(null);
  }
  logInputLifecycleTelemetry(duration, languageId) {
    let collapseUnchangedRegions = false;
    if (this.diffEditorControl instanceof DiffEditorWidget) {
      collapseUnchangedRegions = this.diffEditorControl.collapseUnchangedRegions;
    }
    this.telemetryService.publicLog2("diffEditor.editorVisibleTime", {
      editorVisibleTimeMs: duration,
      languageId: languageId ?? "",
      collapseUnchangedRegions
    });
  }
  getControl() {
    return this.diffEditorControl;
  }
  focus() {
    super.focus();
    this.diffEditorControl?.focus();
  }
  hasFocus() {
    return this.diffEditorControl?.hasTextFocus() || super.hasFocus();
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    if (visible) {
      this.diffEditorControl?.onVisible();
    } else {
      this.diffEditorControl?.onHide();
    }
  }
  layout(dimension) {
    this.diffEditorControl?.layout(dimension);
  }
  setBoundarySashes(sashes) {
    this.diffEditorControl?.setBoundarySashes(sashes);
  }
  tracksEditorViewState(input) {
    return input instanceof DiffEditorInput;
  }
  computeEditorViewState(resource) {
    if (!this.diffEditorControl) {
      return void 0;
    }
    const model = this.diffEditorControl.getModel();
    if (!model?.modified || !model.original) {
      return void 0;
    }
    const modelUri = this.toEditorViewStateResource(model);
    if (!modelUri) {
      return void 0;
    }
    if (!isEqual(modelUri, resource)) {
      return void 0;
    }
    return this.diffEditorControl.saveViewState() ?? void 0;
  }
  toEditorViewStateResource(modelOrInput) {
    let original;
    let modified;
    if (modelOrInput instanceof DiffEditorInput) {
      original = modelOrInput.original.resource;
      modified = modelOrInput.modified.resource;
    } else if (!isEditorInput(modelOrInput)) {
      original = modelOrInput.original.uri;
      modified = modelOrInput.modified.uri;
    }
    if (!original || !modified) {
      return void 0;
    }
    return URI.from({ scheme: "diff", path: `${multibyteAwareBtoa(original.toString())}${multibyteAwareBtoa(modified.toString())}` });
  }
};
TextDiffEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ITextResourceConfigurationService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IPreferencesService),
  __decorateParam(10, IEditorResolverService)
], TextDiffEditor);
export {
  TextDiffEditor
};
