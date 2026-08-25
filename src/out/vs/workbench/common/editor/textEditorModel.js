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
import { ModelConstants } from "../../../editor/common/model.js";
import { EditorModel } from "./editorModel.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { MutableDisposable } from "../../../base/common/lifecycle.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../editor/common/languages/modesRegistry.js";
import { ILanguageDetectionService, LanguageDetectionLanguageEventSource } from "../../services/languageDetection/common/languageDetectionWorkerService.js";
import { ThrottledDelayer } from "../../../base/common/async.js";
import { IAccessibilityService } from "../../../platform/accessibility/common/accessibility.js";
import { localize } from "../../../nls.js";
let BaseTextEditorModel = class extends EditorModel {
  constructor(modelService, languageService, languageDetectionService, accessibilityService, textEditorModelHandle) {
    super();
    this.modelService = modelService;
    this.languageService = languageService;
    this.languageDetectionService = languageDetectionService;
    this.accessibilityService = accessibilityService;
    this.textEditorModelHandle = void 0;
    this.modelDisposeListener = this._register(new MutableDisposable());
    this.autoDetectLanguageThrottler = this._register(new ThrottledDelayer(BaseTextEditorModel.AUTO_DETECT_LANGUAGE_THROTTLE_DELAY));
    this._blockLanguageChangeListener = false;
    this._languageChangeSource = void 0;
    if (textEditorModelHandle) {
      this.handleExistingModel(textEditorModelHandle);
    }
  }
  static {
    this.AUTO_DETECT_LANGUAGE_THROTTLE_DELAY = 600;
  }
  handleExistingModel(textEditorModelHandle) {
    const model = this.modelService.getModel(textEditorModelHandle);
    if (!model) {
      throw new Error(`Document with resource ${textEditorModelHandle.toString(true)} does not exist`);
    }
    this.textEditorModelHandle = textEditorModelHandle;
    this.registerModelDisposeListener(model);
  }
  registerModelDisposeListener(model) {
    this.modelDisposeListener.value = model.onWillDispose(() => {
      this.textEditorModelHandle = void 0;
      this.dispose();
    });
  }
  get textEditorModel() {
    return this.textEditorModelHandle ? this.modelService.getModel(this.textEditorModelHandle) : null;
  }
  isReadonly() {
    return true;
  }
  get languageChangeSource() {
    return this._languageChangeSource;
  }
  get hasLanguageSetExplicitly() {
    return typeof this._languageChangeSource === "string";
  }
  setLanguageId(languageId, source) {
    this._languageChangeSource = "user";
    this.setLanguageIdInternal(languageId, source);
  }
  setLanguageIdInternal(languageId, source) {
    if (!this.isResolved()) {
      return;
    }
    if (!languageId || languageId === this.textEditorModel.getLanguageId()) {
      return;
    }
    this._blockLanguageChangeListener = true;
    try {
      this.textEditorModel.setLanguage(this.languageService.createById(languageId), source);
    } finally {
      this._blockLanguageChangeListener = false;
    }
  }
  installModelListeners(model) {
    const disposable = this._register(model.onDidChangeLanguage((e) => {
      if (e.source === LanguageDetectionLanguageEventSource || this._blockLanguageChangeListener) {
        return;
      }
      this._languageChangeSource = "api";
      disposable.dispose();
    }));
  }
  getLanguageId() {
    return this.textEditorModel?.getLanguageId();
  }
  autoDetectLanguage() {
    return this.autoDetectLanguageThrottler.trigger(() => this.doAutoDetectLanguage());
  }
  async doAutoDetectLanguage() {
    if (this.hasLanguageSetExplicitly || // skip detection when the user has made an explicit choice on the language
    !this.textEditorModelHandle || // require a URI to run the detection for
    !this.languageDetectionService.isEnabledForLanguage(this.getLanguageId() ?? PLAINTEXT_LANGUAGE_ID)) {
      return;
    }
    const lang = await this.languageDetectionService.detectLanguage(this.textEditorModelHandle);
    const prevLang = this.getLanguageId();
    if (lang && lang !== prevLang && !this.isDisposed()) {
      this.setLanguageIdInternal(lang, LanguageDetectionLanguageEventSource);
      const languageName = this.languageService.getLanguageName(lang);
      this.accessibilityService.alert(localize("languageAutoDetected", "Language {0} was automatically detected and set as the language mode.", languageName ?? lang));
    }
  }
  /**
   * Creates the text editor model with the provided value, optional preferred language
   * (can be comma separated for multiple values) and optional resource URL.
   */
  createTextEditorModel(value, resource, preferredLanguageId) {
    const firstLineText = this.getFirstLineText(value);
    const languageSelection = this.getOrCreateLanguage(resource, this.languageService, preferredLanguageId, firstLineText);
    return this.doCreateTextEditorModel(value, languageSelection, resource);
  }
  doCreateTextEditorModel(value, languageSelection, resource) {
    let model = resource && this.modelService.getModel(resource);
    if (!model) {
      model = this.modelService.createModel(value, languageSelection, resource);
      this.createdEditorModel = true;
      this.registerModelDisposeListener(model);
    } else {
      this.updateTextEditorModel(value, languageSelection.languageId);
    }
    this.textEditorModelHandle = model.uri;
    return model;
  }
  getFirstLineText(value) {
    const textBufferFactory = value;
    if (typeof textBufferFactory.getFirstLineText === "function") {
      return textBufferFactory.getFirstLineText(ModelConstants.FIRST_LINE_DETECTION_LENGTH_LIMIT);
    }
    const textSnapshot = value;
    return textSnapshot.getLineContent(1).substr(0, ModelConstants.FIRST_LINE_DETECTION_LENGTH_LIMIT);
  }
  /**
   * Gets the language for the given identifier. Subclasses can override to provide their own implementation of this lookup.
   *
   * @param firstLineText optional first line of the text buffer to set the language on. This can be used to guess a language from content.
   */
  getOrCreateLanguage(resource, languageService, preferredLanguage, firstLineText) {
    if (!preferredLanguage || preferredLanguage === PLAINTEXT_LANGUAGE_ID) {
      return languageService.createByFilepathOrFirstLine(resource ?? null, firstLineText);
    }
    return languageService.createById(preferredLanguage);
  }
  /**
   * Updates the text editor model with the provided value. If the value is the same as the model has, this is a no-op.
   */
  updateTextEditorModel(newValue, preferredLanguageId, reason) {
    if (!this.isResolved()) {
      return;
    }
    if (newValue) {
      this.modelService.updateModel(this.textEditorModel, newValue, reason);
    }
    if (preferredLanguageId && preferredLanguageId !== PLAINTEXT_LANGUAGE_ID && this.textEditorModel.getLanguageId() !== preferredLanguageId) {
      this.textEditorModel.setLanguage(this.languageService.createById(preferredLanguageId));
    }
  }
  createSnapshot() {
    if (!this.textEditorModel) {
      return null;
    }
    return this.textEditorModel.createSnapshot(
      true
      /* preserve BOM */
    );
  }
  isResolved() {
    return !!this.textEditorModelHandle;
  }
  dispose() {
    this.modelDisposeListener.dispose();
    if (this.textEditorModelHandle && this.createdEditorModel) {
      this.modelService.destroyModel(this.textEditorModelHandle);
    }
    this.textEditorModelHandle = void 0;
    this.createdEditorModel = false;
    super.dispose();
  }
};
BaseTextEditorModel = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, ILanguageDetectionService),
  __decorateParam(3, IAccessibilityService)
], BaseTextEditorModel);
export {
  BaseTextEditorModel
};
