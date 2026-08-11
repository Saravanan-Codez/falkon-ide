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
import { BaseTextEditorModel } from "../../../common/editor/textEditorModel.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { Emitter } from "../../../../base/common/event.js";
import { IWorkingCopyBackupService } from "../../workingCopy/common/workingCopyBackup.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { createTextBufferFactory, createTextBufferFactoryFromStream } from "../../../../editor/common/model/textModel.js";
import { IWorkingCopyService } from "../../workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities, NO_TYPE_ID } from "../../workingCopy/common/workingCopy.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ensureValidWordDefinition } from "../../../../editor/common/core/wordHelper.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { getCharContainingOffset } from "../../../../base/common/strings.js";
import { UTF8 } from "../../textfile/common/encoding.js";
import { bufferToReadable, bufferToStream, VSBuffer } from "../../../../base/common/buffer.js";
import { ILanguageDetectionService } from "../../languageDetection/common/languageDetectionWorkerService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
let UntitledTextEditorModel = class extends BaseTextEditorModel {
  //#endregion
  constructor(resource, hasAssociatedFilePath, initialValue, preferredLanguageId, preferredEncoding, languageService, modelService, workingCopyBackupService, textResourceConfigurationService, workingCopyService, textFileService, labelService, editorService, languageDetectionService, accessibilityService) {
    super(modelService, languageService, languageDetectionService, accessibilityService);
    this.resource = resource;
    this.hasAssociatedFilePath = hasAssociatedFilePath;
    this.initialValue = initialValue;
    this.preferredLanguageId = preferredLanguageId;
    this.preferredEncoding = preferredEncoding;
    this.workingCopyBackupService = workingCopyBackupService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.workingCopyService = workingCopyService;
    this.textFileService = textFileService;
    this.labelService = labelService;
    this.editorService = editorService;
    //#region Events
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidChangeName = this._register(new Emitter());
    this.onDidChangeName = this._onDidChangeName.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeEncoding = this._register(new Emitter());
    this.onDidChangeEncoding = this._onDidChangeEncoding.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidRevert = this._register(new Emitter());
    this.onDidRevert = this._onDidRevert.event;
    //#endregion
    this.typeId = NO_TYPE_ID;
    // IMPORTANT: never change this to not break existing assumptions (e.g. backups)
    this.capabilities = WorkingCopyCapabilities.Untitled;
    //#region Name
    this.configuredLabelFormat = "content";
    this.cachedModelFirstLineWords = void 0;
    //#endregion
    //#region Resolve
    this.ignoreDirtyOnModelContentChange = false;
    this.dirty = this.hasAssociatedFilePath || !!this.initialValue;
    this._register(this.workingCopyService.registerWorkingCopy(this));
    if (preferredLanguageId) {
      this.setLanguageId(preferredLanguageId);
    }
    this.onConfigurationChange(void 0, false);
    this.registerListeners();
  }
  static {
    this.FIRST_LINE_NAME_MAX_LENGTH = 40;
  }
  static {
    this.FIRST_LINE_NAME_CANDIDATE_MAX_LENGTH = this.FIRST_LINE_NAME_MAX_LENGTH * 10;
  }
  static {
    // Support the special '${activeEditorLanguage}' language by
    // looking up the language id from the editor that is active
    // before the untitled editor opens. This special id is only
    // used for the initial language and can be changed after the
    // fact (either manually or through auto-detection).
    this.ACTIVE_EDITOR_LANGUAGE_ID = "${activeEditorLanguage}";
  }
  get name() {
    if (this.configuredLabelFormat === "content" && !this.hasAssociatedFilePath && this.cachedModelFirstLineWords) {
      return this.cachedModelFirstLineWords;
    }
    return this.labelService.getUriBasenameLabel(this.resource);
  }
  registerListeners() {
    this._register(this.textResourceConfigurationService.onDidChangeConfiguration((e) => this.onConfigurationChange(e, true)));
  }
  onConfigurationChange(e, fromEvent) {
    if (!e || e.affectsConfiguration(this.resource, "files.encoding")) {
      const configuredEncoding = this.textResourceConfigurationService.getValue(this.resource, "files.encoding");
      if (this.configuredEncoding !== configuredEncoding && typeof configuredEncoding === "string") {
        this.configuredEncoding = configuredEncoding;
        if (fromEvent && !this.preferredEncoding) {
          this._onDidChangeEncoding.fire();
        }
      }
    }
    if (!e || e.affectsConfiguration(this.resource, "workbench.editor.untitled.labelFormat")) {
      const configuredLabelFormat = this.textResourceConfigurationService.getValue(this.resource, "workbench.editor.untitled.labelFormat");
      if (this.configuredLabelFormat !== configuredLabelFormat && (configuredLabelFormat === "content" || configuredLabelFormat === "name")) {
        this.configuredLabelFormat = configuredLabelFormat;
        if (fromEvent) {
          this._onDidChangeName.fire();
        }
      }
    }
  }
  //#region Language
  setLanguageId(languageId, source) {
    const actualLanguage = languageId === UntitledTextEditorModel.ACTIVE_EDITOR_LANGUAGE_ID ? this.editorService.activeTextEditorLanguageId : languageId;
    this.preferredLanguageId = actualLanguage;
    if (actualLanguage) {
      super.setLanguageId(actualLanguage, source);
    }
  }
  getLanguageId() {
    if (this.textEditorModel) {
      return this.textEditorModel.getLanguageId();
    }
    return this.preferredLanguageId;
  }
  getEncoding() {
    return this.preferredEncoding || this.configuredEncoding;
  }
  async setEncoding(encoding) {
    const oldEncoding = this.getEncoding();
    this.preferredEncoding = encoding;
    if (oldEncoding !== this.preferredEncoding) {
      this._onDidChangeEncoding.fire();
    }
  }
  isDirty() {
    return this.dirty;
  }
  isModified() {
    return this.isDirty();
  }
  setDirty(dirty) {
    if (this.dirty === dirty) {
      return;
    }
    this.dirty = dirty;
    this._onDidChangeDirty.fire();
  }
  //#endregion
  //#region Save / Revert / Backup
  async save(options) {
    const target = await this.textFileService.save(this.resource, options);
    if (target) {
      this._onDidSave.fire({ reason: options?.reason, source: options?.source });
    }
    return !!target;
  }
  async revert() {
    this.ignoreDirtyOnModelContentChange = true;
    try {
      this.updateTextEditorModel(createTextBufferFactory(""));
    } finally {
      this.ignoreDirtyOnModelContentChange = false;
    }
    this.setDirty(false);
    this._onDidRevert.fire();
  }
  async backup(token) {
    let content = void 0;
    if (this.isResolved()) {
      content = await this.textFileService.getEncodedReadable(this.resource, this.createSnapshot() ?? void 0, { encoding: UTF8 });
    } else if (typeof this.initialValue === "string") {
      content = bufferToReadable(VSBuffer.fromString(this.initialValue));
    }
    return { content };
  }
  async resolve() {
    let createdUntitledModel = false;
    let hasBackup = false;
    if (!this.textEditorModel) {
      let untitledContents;
      const backup = await this.workingCopyBackupService.resolve(this);
      if (backup) {
        untitledContents = backup.value;
        hasBackup = true;
      } else {
        untitledContents = bufferToStream(VSBuffer.fromString(this.initialValue || ""));
      }
      const untitledContentsFactory = await createTextBufferFactoryFromStream(await this.textFileService.getDecodedStream(this.resource, untitledContents, { encoding: UTF8 }));
      this.createTextEditorModel(untitledContentsFactory, this.resource, this.preferredLanguageId);
      createdUntitledModel = true;
    } else {
      this.updateTextEditorModel(void 0, this.preferredLanguageId);
    }
    const textEditorModel = assertReturnsDefined(this.textEditorModel);
    this.installModelListeners(textEditorModel);
    if (createdUntitledModel) {
      if (hasBackup || this.initialValue) {
        this.updateNameFromFirstLine(textEditorModel);
      }
      this.setDirty(this.hasAssociatedFilePath || !!hasBackup || !!this.initialValue);
      if (hasBackup || this.initialValue) {
        this._onDidChangeContent.fire();
      }
    }
    return super.resolve();
  }
  isResolved() {
    return !!this.textEditorModelHandle;
  }
  installModelListeners(model) {
    this._register(model.onDidChangeContent((e) => this.onModelContentChanged(model, e)));
    this._register(model.onDidChangeLanguage(() => this.onConfigurationChange(void 0, true)));
    super.installModelListeners(model);
  }
  onModelContentChanged(textEditorModel, e) {
    if (!this.ignoreDirtyOnModelContentChange) {
      if (!this.hasAssociatedFilePath && textEditorModel.getLineCount() === 1 && textEditorModel.getLineLength(1) === 0) {
        this.setDirty(false);
      } else {
        this.setDirty(true);
      }
    }
    if (e.changes.some((change) => (change.range.startLineNumber === 1 || change.range.endLineNumber === 1) && change.range.startColumn <= UntitledTextEditorModel.FIRST_LINE_NAME_CANDIDATE_MAX_LENGTH)) {
      this.updateNameFromFirstLine(textEditorModel);
    }
    this._onDidChangeContent.fire();
    this.autoDetectLanguage();
  }
  updateNameFromFirstLine(textEditorModel) {
    if (this.hasAssociatedFilePath) {
      return;
    }
    let modelFirstWordsCandidate = void 0;
    let firstLineText = textEditorModel.getValueInRange({
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 1,
      endColumn: UntitledTextEditorModel.FIRST_LINE_NAME_CANDIDATE_MAX_LENGTH + 1
      // first cap at FIRST_LINE_NAME_CANDIDATE_MAX_LENGTH
    }).trim().replace(/\s+/g, " ").replace(/\u202E/g, "");
    firstLineText = firstLineText.substr(
      0,
      getCharContainingOffset(
        // finally cap at FIRST_LINE_NAME_MAX_LENGTH (grapheme aware #111235)
        firstLineText,
        UntitledTextEditorModel.FIRST_LINE_NAME_MAX_LENGTH
      )[0]
    );
    if (firstLineText && ensureValidWordDefinition().exec(firstLineText)) {
      modelFirstWordsCandidate = firstLineText;
    }
    if (modelFirstWordsCandidate !== this.cachedModelFirstLineWords) {
      this.cachedModelFirstLineWords = modelFirstWordsCandidate;
      this._onDidChangeName.fire();
    }
  }
  //#endregion
  isReadonly() {
    return false;
  }
};
UntitledTextEditorModel = __decorateClass([
  __decorateParam(5, ILanguageService),
  __decorateParam(6, IModelService),
  __decorateParam(7, IWorkingCopyBackupService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IWorkingCopyService),
  __decorateParam(10, ITextFileService),
  __decorateParam(11, ILabelService),
  __decorateParam(12, IEditorService),
  __decorateParam(13, ILanguageDetectionService),
  __decorateParam(14, IAccessibilityService)
], UntitledTextEditorModel);
export {
  UntitledTextEditorModel
};
