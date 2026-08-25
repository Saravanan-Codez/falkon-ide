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
import "./media/editortitlecontrol.css";
import { Dimension, clearNode } from "../../../../base/browser/dom.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { MultiEditorTabsControl } from "./multiEditorTabsControl.js";
import { SingleEditorTabsControl } from "./singleEditorTabsControl.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { MultiRowEditorControl } from "./multiRowEditorTabsControl.js";
import { NoEditorTabsControl } from "./noEditorTabsControl.js";
import { EditorHeaderControl } from "./editorHeaderControl.js";
let EditorTitleControl = class extends Themable {
  constructor(parent, editorPartsView, groupsView, groupView, model, menuIds, showHeader, instantiationService, themeService) {
    super(themeService);
    this.parent = parent;
    this.editorPartsView = editorPartsView;
    this.groupsView = groupsView;
    this.groupView = groupView;
    this.model = model;
    this.menuIds = menuIds;
    this.showHeader = showHeader;
    this.instantiationService = instantiationService;
    this.editorTabsControlDisposable = this._register(new DisposableStore());
    this.headerControlDisposable = this._register(new MutableDisposable());
    this.editorTabsControl = this.createEditorTabsControl();
    this.headerControl = this.createHeaderControl();
  }
  createEditorTabsControl() {
    let tabsControlType;
    switch (this.groupsView.partOptions.showTabs) {
      case "none":
        tabsControlType = NoEditorTabsControl;
        break;
      case "single":
        tabsControlType = SingleEditorTabsControl;
        break;
      case "multiple":
      default:
        tabsControlType = this.groupsView.partOptions.pinnedTabsOnSeparateRow ? MultiRowEditorControl : MultiEditorTabsControl;
        break;
    }
    const control = this.instantiationService.createInstance(tabsControlType, this.parent, this.editorPartsView, this.groupsView, this.groupView, this.model, this.menuIds, this.showHeader);
    return this.editorTabsControlDisposable.add(control);
  }
  createHeaderControl() {
    const control = this.instantiationService.createInstance(EditorHeaderControl, this.parent, this.groupView, this.groupsView, this.menuIds, this.showHeader);
    this.headerControlDisposable.value = control;
    return control;
  }
  openEditor(editor, options) {
    const didChange = this.editorTabsControl.openEditor(editor, options);
    this.handleOpenedEditors(didChange);
  }
  openEditors(editors) {
    const didChange = this.editorTabsControl.openEditors(editors);
    this.handleOpenedEditors(didChange);
  }
  handleOpenedEditors(didChange) {
    this.headerControl.handleEditorsChange(didChange);
  }
  beforeCloseEditor(editor) {
    return this.editorTabsControl.beforeCloseEditor(editor);
  }
  closeEditor(editor) {
    this.editorTabsControl.closeEditor(editor);
    this.handleClosedEditors();
  }
  closeEditors(editors) {
    this.editorTabsControl.closeEditors(editors);
    this.handleClosedEditors();
  }
  handleClosedEditors() {
    if (!this.groupView.activeEditor) {
      this.headerControl.handleEditorsChange(true);
    }
  }
  moveEditor(editor, fromIndex, targetIndex, stickyStateChange) {
    return this.editorTabsControl.moveEditor(editor, fromIndex, targetIndex, stickyStateChange);
  }
  pinEditor(editor) {
    return this.editorTabsControl.pinEditor(editor);
  }
  stickEditor(editor) {
    return this.editorTabsControl.stickEditor(editor);
  }
  unstickEditor(editor) {
    return this.editorTabsControl.unstickEditor(editor);
  }
  setActive(isActive) {
    return this.editorTabsControl.setActive(isActive);
  }
  updateEditorSelections() {
    this.editorTabsControl.updateEditorSelections();
  }
  updateEditorLabel(editor) {
    this.editorTabsControl.updateEditorLabel(editor);
    if (this.groupView.activeEditor === editor) {
      this.headerControl.handleEditorsChange(true);
    }
  }
  updateEditorCapabilities(editor) {
    this.editorTabsControl.updateEditorCapabilities(editor);
  }
  updateEditorDirty(editor) {
    return this.editorTabsControl.updateEditorDirty(editor);
  }
  updateOptions(oldOptions, newOptions) {
    if (oldOptions.showTabs !== newOptions.showTabs || newOptions.showTabs !== "single" && oldOptions.pinnedTabsOnSeparateRow !== newOptions.pinnedTabsOnSeparateRow) {
      this.editorTabsControlDisposable.clear();
      this.headerControlDisposable.clear();
      clearNode(this.parent);
      this.editorTabsControl = this.createEditorTabsControl();
      this.headerControl = this.createHeaderControl();
    } else {
      this.editorTabsControl.updateOptions(oldOptions, newOptions);
    }
  }
  layout(dimensions) {
    this.editorTabsControl.layout(dimensions);
    this.headerControl.layout(dimensions.container.width);
    return new Dimension(dimensions.container.width, this.getHeight().total);
  }
  getHeight() {
    const tabsControlHeight = this.editorTabsControl.getHeight();
    return {
      total: tabsControlHeight + this.headerControl.height,
      offset: tabsControlHeight
    };
  }
};
EditorTitleControl = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IThemeService)
], EditorTitleControl);
export {
  EditorTitleControl
};
