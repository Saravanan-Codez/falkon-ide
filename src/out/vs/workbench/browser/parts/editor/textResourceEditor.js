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
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { isTextEditorViewState } from "../../../common/editor.js";
import { applyTextEditorOptions } from "../../../common/editor/editorOptions.js";
import { TextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { BaseTextEditorModel } from "../../../common/editor/textEditorModel.js";
import { UntitledTextEditorInput } from "../../../services/untitled/common/untitledTextEditorInput.js";
import { AbstractTextCodeEditor } from "./textCodeEditor.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { ModelConstants } from "../../../../editor/common/model.js";
import { IFileService } from "../../../../platform/files/common/files.js";
let AbstractTextResourceEditor = class extends AbstractTextCodeEditor {
  constructor(id, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService) {
    super(id, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, fileService);
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    const resolvedModel = await input.resolve();
    if (token.isCancellationRequested) {
      return void 0;
    }
    if (!(resolvedModel instanceof BaseTextEditorModel)) {
      throw new Error("Unable to open file as text");
    }
    const control = assertReturnsDefined(this.editorControl);
    const textEditorModel = resolvedModel.textEditorModel;
    control.setModel(textEditorModel);
    if (!isTextEditorViewState(options?.viewState)) {
      const editorViewState = this.loadEditorViewState(input, context);
      if (editorViewState) {
        if (options?.selection) {
          editorViewState.cursorState = [];
        }
        control.restoreViewState(editorViewState);
      }
    }
    if (options) {
      applyTextEditorOptions(options, control, ScrollType.Immediate);
    }
    control.updateOptions(this.getReadonlyConfiguration(resolvedModel.isReadonly()));
  }
  /**
   * Reveals the last line of this editor if it has a model set.
   */
  revealLastLine() {
    const control = this.editorControl;
    if (!control) {
      return;
    }
    const model = control.getModel();
    if (model) {
      const lastLine = model.getLineCount();
      control.revealPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) }, ScrollType.Smooth);
    }
  }
  clearInput() {
    super.clearInput();
    this.editorControl?.setModel(null);
  }
  tracksEditorViewState(input) {
    return input instanceof UntitledTextEditorInput || input instanceof TextResourceEditorInput;
  }
};
AbstractTextResourceEditor = __decorateClass([
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ITextResourceConfigurationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IFileService)
], AbstractTextResourceEditor);
let TextResourceEditor = class extends AbstractTextResourceEditor {
  constructor(group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, modelService, languageService, fileService) {
    super(TextResourceEditor.ID, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService);
    this.modelService = modelService;
    this.languageService = languageService;
  }
  static {
    this.ID = "workbench.editors.textResourceEditor";
  }
  createEditorControl(parent, configuration) {
    super.createEditorControl(parent, configuration);
    const control = this.editorControl;
    if (control) {
      this._register(control.onDidPaste((e) => this.onDidEditorPaste(e, control)));
    }
  }
  onDidEditorPaste(e, codeEditor) {
    if (this.input instanceof UntitledTextEditorInput && this.input.hasLanguageSetExplicitly) {
      return;
    }
    if (e.range.startLineNumber !== 1 || e.range.startColumn !== 1) {
      return;
    }
    if (codeEditor.getOption(EditorOption.readOnly)) {
      return;
    }
    const textModel = codeEditor.getModel();
    if (!textModel) {
      return;
    }
    const pasteIsWholeContents = textModel.getLineCount() === e.range.endLineNumber && textModel.getLineMaxColumn(e.range.endLineNumber) === e.range.endColumn;
    if (!pasteIsWholeContents) {
      return;
    }
    const currentLanguageId = textModel.getLanguageId();
    if (currentLanguageId !== PLAINTEXT_LANGUAGE_ID) {
      return;
    }
    let candidateLanguage = void 0;
    if (e.languageId) {
      candidateLanguage = { id: e.languageId, source: "event" };
    } else {
      const guess = this.languageService.guessLanguageIdByFilepathOrFirstLine(textModel.uri, textModel.getLineContent(1).substr(0, ModelConstants.FIRST_LINE_DETECTION_LENGTH_LIMIT)) ?? void 0;
      if (guess) {
        candidateLanguage = { id: guess, source: "guess" };
      }
    }
    if (candidateLanguage && candidateLanguage.id !== PLAINTEXT_LANGUAGE_ID) {
      if (this.input instanceof UntitledTextEditorInput && candidateLanguage.source === "event") {
        this.input.setLanguageId(candidateLanguage.id);
      } else {
        textModel.setLanguage(this.languageService.createById(candidateLanguage.id));
      }
      const opts = this.modelService.getCreationOptions(textModel.getLanguageId(), textModel.uri, textModel.isForSimpleWidget);
      textModel.detectIndentation(opts.insertSpaces, opts.tabSize);
    }
  }
};
TextResourceEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ITextResourceConfigurationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IModelService),
  __decorateParam(9, ILanguageService),
  __decorateParam(10, IFileService)
], TextResourceEditor);
export {
  AbstractTextResourceEditor,
  TextResourceEditor
};
