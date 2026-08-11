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
import "./media/chatManagementEditor.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorPane } from "../../../../browser/parts/editor/editorPane.js";
import { ChatModelsWidget } from "./chatModelsWidget.js";
import { CONTEXT_MODELS_EDITOR } from "../../common/constants.js";
const $ = DOM.$;
let ModelsManagementEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService, contextKeyService) {
    super(ModelsManagementEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.editorDisposables = this._register(new DisposableStore());
    this.inModelsEditorContextKey = CONTEXT_MODELS_EDITOR.bindTo(contextKeyService);
  }
  static {
    this.ID = "workbench.editor.modelsManagement";
  }
  createEditor(parent) {
    this.editorDisposables.clear();
    this.bodyContainer = DOM.append(parent, $(".ai-models-management-editor"));
    this.modelsWidget = this.editorDisposables.add(this.instantiationService.createInstance(ChatModelsWidget));
    this.bodyContainer.appendChild(this.modelsWidget.element);
  }
  async setInput(input, options, context, token) {
    this.inModelsEditorContextKey.set(true);
    await super.setInput(input, options, context, token);
    if (this.dimension) {
      this.layout(this.dimension);
    }
    this.modelsWidget?.render();
  }
  layout(dimension) {
    this.dimension = dimension;
    if (this.bodyContainer) {
      this.modelsWidget?.layout(dimension.height - 15, this.bodyContainer.clientWidth - 24);
    }
  }
  focus() {
    super.focus();
    this.modelsWidget?.focusSearch();
  }
  clearInput() {
    this.inModelsEditorContextKey.set(false);
    super.clearInput();
  }
  clearSearch() {
    this.modelsWidget?.clearSearch();
  }
  search(query) {
    this.modelsWidget?.search(query);
  }
};
ModelsManagementEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService)
], ModelsManagementEditor);
export {
  ModelsManagementEditor
};
