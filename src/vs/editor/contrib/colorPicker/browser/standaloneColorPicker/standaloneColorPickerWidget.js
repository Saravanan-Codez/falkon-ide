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
import "../colorPicker.css";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../../browser/editorBrowser.js";
import { PositionAffinity } from "../../../../common/model.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorHoverStatusBar } from "../../../hover/browser/contentHoverStatusBar.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { Emitter } from "../../../../../base/common/event.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { DefaultDocumentColorProvider } from "../defaultDocumentColorProvider.js";
import { IEditorWorkerService } from "../../../../common/services/editorWorker.js";
import { StandaloneColorPickerParticipant } from "./standaloneColorPickerParticipant.js";
import * as dom from "../../../../../base/browser/dom.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
class StandaloneColorPickerResult {
  // The color picker result consists of: an array of color results and a boolean indicating if the color was found in the editor
  constructor(value, foundInEditor) {
    this.value = value;
    this.foundInEditor = foundInEditor;
  }
}
const PADDING = 8;
const CLOSE_BUTTON_WIDTH = 22;
let StandaloneColorPickerWidget = class extends Disposable {
  constructor(_editor, _standaloneColorPickerVisible, _standaloneColorPickerFocused, _instantiationService, _keybindingService, _languageFeaturesService, _editorWorkerService, _hoverService) {
    super();
    this._editor = _editor;
    this._standaloneColorPickerVisible = _standaloneColorPickerVisible;
    this._standaloneColorPickerFocused = _standaloneColorPickerFocused;
    this._keybindingService = _keybindingService;
    this._languageFeaturesService = _languageFeaturesService;
    this._editorWorkerService = _editorWorkerService;
    this._hoverService = _hoverService;
    this.allowEditorOverflow = true;
    this._position = void 0;
    this._body = document.createElement("div");
    this._colorHover = null;
    this._selectionSetInEditor = false;
    this._onResult = this._register(new Emitter());
    this.onResult = this._onResult.event;
    this._renderedHoverParts = this._register(new MutableDisposable());
    this._renderedStatusBar = this._register(new MutableDisposable());
    this._standaloneColorPickerVisible.set(true);
    this._standaloneColorPickerParticipant = _instantiationService.createInstance(StandaloneColorPickerParticipant, this._editor);
    this._position = this._editor._getViewModel()?.getPrimaryCursorState().modelState.position;
    const editorSelection = this._editor.getSelection();
    this._selections = this._editor.getSelections() ?? [];
    const selection = editorSelection ? {
      startLineNumber: editorSelection.startLineNumber,
      startColumn: editorSelection.startColumn,
      endLineNumber: editorSelection.endLineNumber,
      endColumn: editorSelection.endColumn
    } : { startLineNumber: 0, endLineNumber: 0, endColumn: 0, startColumn: 0 };
    const focusTracker = this._register(dom.trackFocus(this._body));
    this._register(focusTracker.onDidBlur((_) => {
      this.hide();
    }));
    this._register(focusTracker.onDidFocus((_) => {
      this.focus();
    }));
    this._register(this._editor.onDidChangeCursorPosition(() => {
      if (!this._selectionSetInEditor) {
        this.hide();
      } else {
        this._selectionSetInEditor = false;
      }
      this._selections = this._editor.getSelections() ?? [];
    }));
    this._register(this._editor.onMouseMove((e) => {
      const classList = e.target.element?.classList;
      if (classList && classList.contains("colorpicker-color-decoration")) {
        this.hide();
      }
    }));
    this._register(this.onResult((result) => {
      this._render(result.value, result.foundInEditor);
    }));
    this._start(selection);
    this._body.style.zIndex = "50";
    this._editor.addContentWidget(this);
  }
  static {
    this.ID = "editor.contrib.standaloneColorPickerWidget";
  }
  updateEditor() {
    if (this._colorHover) {
      this._standaloneColorPickerParticipant.updateEditorModel(this._colorHover, this._selections);
    }
  }
  getId() {
    return StandaloneColorPickerWidget.ID;
  }
  getDomNode() {
    return this._body;
  }
  getPosition() {
    if (!this._position) {
      return null;
    }
    const positionPreference = this._editor.getOption(EditorOption.hover).above;
    return {
      position: this._position,
      secondaryPosition: this._position,
      preference: positionPreference ? [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW] : [ContentWidgetPositionPreference.BELOW, ContentWidgetPositionPreference.ABOVE],
      positionAffinity: PositionAffinity.None
    };
  }
  hide() {
    this.dispose();
    this._standaloneColorPickerVisible.set(false);
    this._standaloneColorPickerFocused.set(false);
    this._editor.removeContentWidget(this);
    this._editor.focus();
  }
  focus() {
    this._standaloneColorPickerFocused.set(true);
    this._body.focus();
  }
  async _start(selection) {
    const computeAsyncResult = await this._computeAsync(selection);
    if (!computeAsyncResult) {
      return;
    }
    this._onResult.fire(new StandaloneColorPickerResult(computeAsyncResult.result, computeAsyncResult.foundInEditor));
  }
  async _computeAsync(range) {
    if (!this._editor.hasModel()) {
      return null;
    }
    const colorInfo = {
      range,
      color: { red: 0, green: 0, blue: 0, alpha: 1 }
    };
    const colorHoverResult = await this._standaloneColorPickerParticipant.createColorHover(colorInfo, new DefaultDocumentColorProvider(this._editorWorkerService), this._languageFeaturesService.colorProvider);
    if (!colorHoverResult) {
      return null;
    }
    return { result: colorHoverResult.colorHover, foundInEditor: colorHoverResult.foundInEditor };
  }
  _render(colorHover, foundInEditor) {
    const fragment = document.createDocumentFragment();
    this._renderedStatusBar.value = this._register(new EditorHoverStatusBar(this._keybindingService, this._hoverService));
    const context = {
      fragment,
      statusBar: this._renderedStatusBar.value,
      onContentsChanged: () => {
      },
      setMinimumDimensions: () => {
      },
      hide: () => this.hide(),
      focus: () => this.focus()
    };
    this._colorHover = colorHover;
    this._renderedHoverParts.value = this._standaloneColorPickerParticipant.renderHoverParts(context, [colorHover]);
    if (!this._renderedHoverParts.value) {
      this._renderedStatusBar.clear();
      this._renderedHoverParts.clear();
      return;
    }
    const colorPicker = this._renderedHoverParts.value.colorPicker;
    this._body.classList.add("standalone-colorpicker-body");
    this._body.style.maxHeight = Math.max(this._editor.getLayoutInfo().height / 4, 250) + "px";
    this._body.style.maxWidth = Math.max(this._editor.getLayoutInfo().width * 0.66, 500) + "px";
    this._body.tabIndex = 0;
    this._body.appendChild(fragment);
    colorPicker.layout();
    const colorPickerBody = colorPicker.body;
    const saturationBoxWidth = colorPickerBody.saturationBox.domNode.clientWidth;
    const widthOfOriginalColorBox = colorPickerBody.domNode.clientWidth - saturationBoxWidth - CLOSE_BUTTON_WIDTH - PADDING;
    const enterButton = colorPicker.body.enterButton;
    enterButton?.onClicked(() => {
      this.updateEditor();
      this.hide();
    });
    const colorPickerHeader = colorPicker.header;
    const pickedColorNode = colorPickerHeader.pickedColorNode;
    pickedColorNode.style.width = saturationBoxWidth + PADDING + "px";
    const originalColorNode = colorPickerHeader.originalColorNode;
    originalColorNode.style.width = widthOfOriginalColorBox + "px";
    const closeButton = colorPicker.header.closeButton;
    closeButton?.onClicked(() => {
      this.hide();
    });
    if (foundInEditor) {
      if (enterButton) {
        enterButton.button.textContent = "Replace";
      }
      this._selectionSetInEditor = true;
      this._editor.setSelection(colorHover.range);
    }
    this._editor.layoutContentWidget(this);
  }
};
StandaloneColorPickerWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, ILanguageFeaturesService),
  __decorateParam(6, IEditorWorkerService),
  __decorateParam(7, IHoverService)
], StandaloneColorPickerWidget);
export {
  StandaloneColorPickerWidget
};
