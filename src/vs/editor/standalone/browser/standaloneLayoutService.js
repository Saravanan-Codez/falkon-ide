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
import * as dom from "../../../base/browser/dom.js";
import { mainWindow } from "../../../base/browser/window.js";
import { coalesce } from "../../../base/common/arrays.js";
import { Event } from "../../../base/common/event.js";
import { ICodeEditorService } from "../../browser/services/codeEditorService.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { ILayoutService } from "../../../platform/layout/browser/layoutService.js";
let StandaloneLayoutService = class {
  constructor(_codeEditorService) {
    this._codeEditorService = _codeEditorService;
    this.onDidLayoutMainContainer = Event.None;
    this.onDidLayoutActiveContainer = Event.None;
    this.onDidLayoutContainer = Event.None;
    this.onDidChangeActiveContainer = Event.None;
    this.onDidAddContainer = Event.None;
    this.mainContainerOffset = { top: 0, quickPickTop: 0 };
    this.activeContainerOffset = { top: 0, quickPickTop: 0 };
  }
  get mainContainer() {
    return this._codeEditorService.listCodeEditors().at(0)?.getContainerDomNode() ?? mainWindow.document.body;
  }
  get activeContainer() {
    const activeCodeEditor = this._codeEditorService.getFocusedCodeEditor() ?? this._codeEditorService.getActiveCodeEditor();
    return activeCodeEditor?.getContainerDomNode() ?? this.mainContainer;
  }
  get mainContainerDimension() {
    return dom.getClientArea(this.mainContainer);
  }
  get activeContainerDimension() {
    return dom.getClientArea(this.activeContainer);
  }
  get containers() {
    return coalesce(this._codeEditorService.listCodeEditors().map((codeEditor) => codeEditor.getContainerDomNode()));
  }
  getContainer() {
    return this.activeContainer;
  }
  whenContainerStylesLoaded() {
    return void 0;
  }
  focus() {
    this._codeEditorService.getFocusedCodeEditor()?.focus();
  }
};
StandaloneLayoutService = __decorateClass([
  __decorateParam(0, ICodeEditorService)
], StandaloneLayoutService);
let EditorScopedLayoutService = class extends StandaloneLayoutService {
  constructor(_container, codeEditorService) {
    super(codeEditorService);
    this._container = _container;
  }
  get mainContainer() {
    return this._container;
  }
};
EditorScopedLayoutService = __decorateClass([
  __decorateParam(1, ICodeEditorService)
], EditorScopedLayoutService);
registerSingleton(ILayoutService, StandaloneLayoutService, InstantiationType.Delayed);
export {
  EditorScopedLayoutService
};
