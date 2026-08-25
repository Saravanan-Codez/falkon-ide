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
import "./media/agentFeedbackEditorInput.css";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Selection, SelectionDirection } from "../../../../editor/common/core/selection.js";
import { addStandardDisposableListener, getWindow, isHTMLElement } from "../../../../base/browser/dom.js";
import { isEqual } from "../../../../base/common/resources.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { IAgentFeedbackService } from "./agentFeedbackService.js";
import { createAgentFeedbackContext } from "./agentFeedbackEditorUtils.js";
import { localize, localize2 } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { FeedbackInputWidget } from "./feedbackInputWidget.js";
const addFeedbackAtCurrentLineActionId = "agentFeedbackEditor.action.addAtCurrentLine";
const agentFeedbackHoverGlyphClassName = "agent-feedback-glyph";
const hasAgentFeedbackSessionForEditor = new RawContextKey("agentFeedbackEditor.hasSession", false);
class AgentFeedbackInputWidget extends Disposable {
  constructor(_editor) {
    super();
    this._editor = _editor;
    this.allowEditorOverflow = false;
    this._position = null;
    this._core = this._register(new FeedbackInputWidget({
      placeholder: localize("agentFeedback.addFeedback", "Add Feedback"),
      getMaxContentWidth: () => this._computeContentWidth(),
      primaryAction: {
        label: localize("agentFeedback.add", "Add Feedback"),
        icon: Codicon.plus,
        keybindingLabel: localize("enter", "Enter")
      },
      secondaryAction: {
        label: localize("agentFeedback.addAndSubmit", "Add Feedback and Submit"),
        icon: Codicon.send,
        keybindingLabel: localize("altEnter", "Alt+Enter")
      }
    }));
    this.onDidTriggerAdd = this._core.onDidTriggerPrimary;
    this.onDidTriggerAddAndSubmit = this._core.onDidTriggerSecondary;
  }
  static {
    this._ID = "agentFeedback.inputWidget";
  }
  getId() {
    return AgentFeedbackInputWidget._ID;
  }
  getDomNode() {
    return this._core.domNode;
  }
  getPosition() {
    return this._position;
  }
  get inputElement() {
    return this._core.inputElement;
  }
  setPosition(position) {
    this._position = position;
    this._editor.layoutOverlayWidget(this);
  }
  show() {
    this._core.show();
  }
  hide() {
    this._core.hide();
  }
  clearInput() {
    this._core.clearInput();
  }
  setPlaceholder(placeholder) {
    this._core.setPlaceholder(placeholder);
  }
  autoSize() {
    this._core.autoSize();
  }
  updateActionEnabled() {
    this._core.updateActionEnabled();
  }
  _computeContentWidth() {
    const layoutInfo = this._editor.getLayoutInfo();
    return Math.max(0, layoutInfo.width - layoutInfo.contentLeft);
  }
}
let AgentFeedbackEditorInputContribution = class extends Disposable {
  constructor(_editor, _agentFeedbackService, _codeEditorService, _contextKeyService) {
    super();
    this._editor = _editor;
    this._agentFeedbackService = _agentFeedbackService;
    this._codeEditorService = _codeEditorService;
    this._contextKeyService = _contextKeyService;
    this._visible = false;
    this._mouseDown = false;
    this._suppressSelectionChangeOnce = false;
    this._preferBelow = true;
    this._widgetListeners = this._store.add(new DisposableStore());
    this._hoverDecorations = this._editor.createDecorationsCollection();
    this._store.add({ dispose: () => this._hoverDecorations.clear() });
    this._hasAgentFeedbackSessionContext = hasAgentFeedbackSessionForEditor.bindTo(this._contextKeyService);
    this._store.add(this._editor.onDidChangeCursorSelection(() => this._onSelectionChanged()));
    this._store.add(this._editor.onDidChangeModel(() => this._onModelChanged()));
    this._store.add(this._editor.onDidScrollChange(() => {
      if (this._visible) {
        this._updatePosition();
      }
    }));
    this._store.add(this._editor.onDidLayoutChange(() => {
      if (this._visible && this._widget) {
        this._widget.autoSize();
        this._updatePosition();
      }
    }));
    this._store.add(this._editor.onMouseMove((e) => this._onEditorMouseMove(e)));
    this._store.add(this._editor.onMouseLeave(() => this._clearHoverGlyph()));
    this._store.add(this._editor.onMouseDown((e) => {
      if (this._isWidgetTarget(e.event.target)) {
        return;
      }
      if (this._isHoverGlyphTarget(e)) {
        e.event.preventDefault();
        e.event.stopPropagation();
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber !== void 0) {
          this._selectLine(lineNumber);
        }
        return;
      }
      this._mouseDown = true;
      this._autoHide();
    }));
    this._store.add(this._editor.onMouseUp((e) => {
      this._mouseDown = false;
      if (this._isWidgetTarget(e.event.target)) {
        return;
      }
      if (this._isHoverGlyphTarget(e)) {
        return;
      }
      this._onSelectionChanged();
    }));
    this._store.add(this._editor.onDidBlurEditorWidget(() => {
      if (!this._visible) {
        return;
      }
      getWindow(this._editor.getDomNode()).setTimeout(() => {
        if (!this._visible) {
          return;
        }
        if (this._isWidgetTarget(getWindow(this._editor.getDomNode()).document.activeElement)) {
          return;
        }
        this._autoHide();
      }, 0);
    }));
    this._store.add(this._editor.onDidFocusEditorText(() => this._onSelectionChanged()));
    this._store.add(this._agentFeedbackService.onDidChangeFeedbackScope(() => {
      this._clearHoverGlyph();
      this._sessionResource = this._getSessionForModel();
      if (this._visible && this._widget) {
        if (!this._sessionResource) {
          this._autoHide();
        } else {
          this._widget.setPlaceholder(this._getPlaceholder());
        }
      }
    }));
    this._getSessionForModel();
  }
  static {
    this.ID = "agentFeedback.editorInputContribution";
  }
  _isWidgetTarget(target) {
    return !!this._widget && !!target && this._widget.getDomNode().contains(target);
  }
  _isHoverGlyphTarget(e) {
    return isHTMLElement(e.target.element) && e.target.element.classList.contains(agentFeedbackHoverGlyphClassName);
  }
  _ensureWidget() {
    if (!this._widget) {
      this._widget = new AgentFeedbackInputWidget(this._editor);
      this._store.add(this._widget.onDidTriggerAdd(() => this._addFeedback()));
      this._store.add(this._widget.onDidTriggerAddAndSubmit(() => this._addFeedbackAndSubmit()));
      this._editor.addOverlayWidget(this._widget);
    }
    return this._widget;
  }
  _onModelChanged() {
    this._hide();
    this._clearHoverGlyph();
    this._suppressSelectionChangeOnce = false;
    this._sessionResource = void 0;
    this._getSessionForModel();
  }
  _onEditorMouseMove(e) {
    if (this._visible || this._hasInputText()) {
      this._clearHoverGlyph();
      return;
    }
    this._updateHoverGlyph(e.target.position?.lineNumber);
  }
  _updateHoverGlyph(lineNumber) {
    const model = this._editor.getModel();
    if (lineNumber === void 0 || !model || lineNumber < 1 || lineNumber > model.getLineCount()) {
      this._clearHoverGlyph();
      return;
    }
    if (model.getLineFirstNonWhitespaceColumn(lineNumber) === 0) {
      this._clearHoverGlyph();
      return;
    }
    if (this._hoverLineNumber === lineNumber) {
      return;
    }
    const sessionResource = this._getSessionForModel();
    if (!sessionResource) {
      this._clearHoverGlyph();
      return;
    }
    if (this._lineHasExistingFeedback(sessionResource, model.uri, lineNumber)) {
      this._clearHoverGlyph();
      return;
    }
    this._hoverLineNumber = lineNumber;
    this._hoverDecorations.set([{
      range: new Range(lineNumber, 1, lineNumber, 1),
      options: {
        description: "agent-feedback-hover-glyph",
        lineNumberClassName: `${agentFeedbackHoverGlyphClassName} line-hover`,
        lineNumberHoverMessage: new MarkdownString(localize("agentFeedback.add", "Add Feedback"))
      }
    }]);
  }
  _lineHasExistingFeedback(sessionResource, resourceUri, lineNumber) {
    return this._agentFeedbackService.getFeedback(sessionResource).some((feedback) => isEqual(feedback.resourceUri, resourceUri) && lineNumber >= feedback.range.startLineNumber && lineNumber <= feedback.range.endLineNumber);
  }
  _clearHoverGlyph() {
    if (this._hoverLineNumber === void 0) {
      return;
    }
    this._hoverLineNumber = void 0;
    this._hoverDecorations.clear();
  }
  _onSelectionChanged() {
    if (this._suppressSelectionChangeOnce) {
      this._suppressSelectionChangeOnce = false;
      return;
    }
    if (this._mouseDown || !this._editor.hasTextFocus()) {
      return;
    }
    if (this._visible && this._hasInputText()) {
      return;
    }
    const selection = this._editor.getSelection();
    if (!selection || selection.isEmpty()) {
      this._autoHide();
      return;
    }
    const model = this._editor.getModel();
    if (!model) {
      this._autoHide();
      return;
    }
    const sessionResource = this._getSessionForModel();
    if (!sessionResource) {
      this._autoHide();
      return;
    }
    this._sessionResource = sessionResource;
    const preferBelow = selection.getDirection() === SelectionDirection.LTR;
    const anchorPosition = preferBelow ? selection.getEndPosition() : selection.getStartPosition();
    this._show(Range.lift(selection), anchorPosition, preferBelow);
  }
  _show(range, anchorPosition, preferBelow, focusInput = false) {
    const widget = this._ensureWidget();
    this._clearHoverGlyph();
    if (!this._visible) {
      this._visible = true;
      this._registerWidgetListeners(widget);
    }
    this._pinnedRange = range;
    this._anchorPosition = anchorPosition;
    this._preferBelow = preferBelow;
    widget.setPlaceholder(this._getPlaceholder());
    widget.clearInput();
    widget.show();
    this._updatePosition();
    if (focusInput) {
      widget.inputElement.focus();
    }
  }
  _getPlaceholder() {
    const model = this._editor.getModel();
    const hasChanges = !!model && (this._agentFeedbackService.getSessionForFile(model.uri)?.changes.get().length ?? 0) > 0;
    return hasChanges ? localize("agentFeedback.addFeedback", "Add Feedback") : localize("agentFeedback.addComment", "Add Comment");
  }
  _hide() {
    if (!this._visible) {
      return;
    }
    this._visible = false;
    this._pinnedRange = void 0;
    this._anchorPosition = void 0;
    this._widgetListeners.clear();
    if (this._widget) {
      this._widget.hide();
      this._widget.setPosition(null);
      this._widget.clearInput();
    }
  }
  _hasInputText() {
    return !!this._widget && this._widget.inputElement.value.trim().length > 0;
  }
  showAtCurrentLine(focusInput = true) {
    const position = this._editor.getPosition();
    if (!position) {
      return;
    }
    this._showAtLine(position.lineNumber, focusInput);
  }
  _showAtLine(lineNumber, focusInput) {
    if (this._visible && this._hasInputText()) {
      this.focusInput();
      return;
    }
    const model = this._editor.getModel();
    if (!model || lineNumber < 1 || lineNumber > model.getLineCount()) {
      this._autoHide();
      return;
    }
    const sessionResource = this._getSessionForModel();
    if (!sessionResource) {
      this._autoHide();
      return;
    }
    this._sessionResource = sessionResource;
    this._show(new Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)), new Position(lineNumber, 1), true, focusInput);
  }
  /**
   * Select the whole line as a result of clicking the gutter glyph. Selecting
   * the line triggers the selection-change handler which opens the feedback
   * input automatically, so we don't open it directly here. Empty lines are
   * ignored as there is nothing to give feedback on.
   */
  _selectLine(lineNumber) {
    if (this._visible && this._hasInputText()) {
      this.focusInput();
      return;
    }
    const model = this._editor.getModel();
    if (!model || lineNumber < 1 || lineNumber > model.getLineCount()) {
      return;
    }
    if (model.getLineFirstNonWhitespaceColumn(lineNumber) === 0) {
      return;
    }
    this._editor.setSelection(new Selection(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)));
    this._editor.focus();
    this.focusInput();
  }
  _getSessionForModel() {
    const model = this._editor.getModel();
    if (!model || !this._contextKeyService.contextMatchesRules(ChatContextKeys.enabled)) {
      this._hasAgentFeedbackSessionContext.set(false);
      this._sessionResource = void 0;
      return void 0;
    }
    const sessionResource = this._agentFeedbackService.getFeedbackSessionResource(model.uri);
    this._hasAgentFeedbackSessionContext.set(!!sessionResource);
    this._sessionResource = sessionResource;
    return sessionResource;
  }
  /**
   * Hide the widget unless the user has typed text. When text is present the
   * widget is preserved so the user does not lose their in-progress feedback;
   * they can close it explicitly via Esc.
   */
  _autoHide() {
    if (this._hasInputText()) {
      return;
    }
    this._hide();
  }
  _registerWidgetListeners(widget) {
    this._widgetListeners.clear();
    const editorDomNode = this._editor.getDomNode();
    if (editorDomNode) {
      this._widgetListeners.add(addStandardDisposableListener(editorDomNode, "keydown", (e) => {
        if (!this._visible) {
          return;
        }
        if (!this._editor.hasTextFocus()) {
          return;
        }
        if (e.keyCode === KeyCode.Ctrl || e.keyCode === KeyCode.Shift || e.keyCode === KeyCode.Alt || e.keyCode === KeyCode.Meta) {
          return;
        }
        if (e.keyCode === KeyCode.Escape) {
          this._hide();
          this._editor.focus();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.keyCode === KeyCode.KeyI) {
          e.preventDefault();
          e.stopPropagation();
          widget.inputElement.focus();
          return;
        }
        if (e.ctrlKey || e.altKey || e.metaKey) {
          return;
        }
        if (e.keyCode === KeyCode.UpArrow || e.keyCode === KeyCode.DownArrow || e.keyCode === KeyCode.LeftArrow || e.keyCode === KeyCode.RightArrow) {
          return;
        }
        if (!this._editor.getOption(EditorOption.readOnly)) {
          return;
        }
        if (getWindow(widget.inputElement).document.activeElement !== widget.inputElement) {
          widget.inputElement.focus();
        }
      }));
    }
    this._widgetListeners.add(addStandardDisposableListener(widget.inputElement, "keydown", (e) => {
      if (e.keyCode === KeyCode.Escape) {
        e.preventDefault();
        e.stopPropagation();
        this._hide();
        this._editor.focus();
        return;
      }
      if (e.keyCode === KeyCode.Enter && e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        this._addFeedbackAndSubmit();
        return;
      }
      if (e.keyCode === KeyCode.Enter) {
        e.preventDefault();
        e.stopPropagation();
        this._addFeedback();
        return;
      }
    }));
    this._widgetListeners.add(addStandardDisposableListener(widget.inputElement, "keypress", (e) => {
      e.stopPropagation();
    }));
    this._widgetListeners.add(addStandardDisposableListener(widget.inputElement, "input", () => {
      widget.autoSize();
      widget.updateActionEnabled();
      this._updatePosition();
    }));
    this._widgetListeners.add(addStandardDisposableListener(widget.inputElement, "blur", () => {
      const win = getWindow(widget.inputElement);
      win.setTimeout(() => {
        if (!this._visible) {
          return;
        }
        if (this._editor.hasWidgetFocus()) {
          return;
        }
        this._autoHide();
      }, 0);
    }));
  }
  focusInput() {
    if (this._visible && this._widget) {
      this._widget.inputElement.focus();
    }
  }
  _hideAndRefocusEditor() {
    this._suppressSelectionChangeOnce = true;
    this._hide();
    this._editor.focus();
  }
  _addFeedback() {
    if (!this._widget) {
      return false;
    }
    const text = this._widget.inputElement.value.trim();
    if (!text) {
      return false;
    }
    const range = this._pinnedRange ?? this._editor.getSelection();
    const model = this._editor.getModel();
    if (!range || !model || !this._sessionResource) {
      return false;
    }
    this._agentFeedbackService.addFeedback(this._sessionResource, model.uri, range, text, void 0, createAgentFeedbackContext(this._editor, this._codeEditorService, model.uri, range));
    this._hideAndRefocusEditor();
    return true;
  }
  _addFeedbackAndSubmit() {
    if (!this._widget) {
      return;
    }
    const text = this._widget.inputElement.value.trim();
    if (!text) {
      return;
    }
    const range = this._pinnedRange ?? this._editor.getSelection();
    const model = this._editor.getModel();
    if (!range || !model || !this._sessionResource) {
      return;
    }
    const sessionResource = this._sessionResource;
    this._hideAndRefocusEditor();
    this._agentFeedbackService.addFeedbackAndSubmit(sessionResource, model.uri, range, text, void 0, createAgentFeedbackContext(this._editor, this._codeEditorService, model.uri, range));
  }
  _updatePosition() {
    if (!this._widget || !this._visible) {
      return;
    }
    const lineHeight = this._editor.getOption(EditorOption.lineHeight);
    const layoutInfo = this._editor.getLayoutInfo();
    const widgetDom = this._widget.getDomNode();
    const widgetHeight = widgetDom.offsetHeight || 30;
    const widgetWidth = widgetDom.offsetWidth || 150;
    const target = this._getPositioningTarget();
    if (!target) {
      this._autoHide();
      return;
    }
    const scrolledPosition = this._editor.getScrolledVisiblePosition(target.anchorPosition);
    if (!scrolledPosition) {
      this._widget.setPosition(null);
      return;
    }
    let top;
    if (target.preferBelow) {
      top = scrolledPosition.top + lineHeight;
      if (top + widgetHeight > layoutInfo.height) {
        top = scrolledPosition.top - widgetHeight;
      }
    } else {
      top = scrolledPosition.top - widgetHeight;
      if (top < 0) {
        top = scrolledPosition.top + lineHeight;
      }
    }
    top = Math.max(0, Math.min(top, layoutInfo.height - widgetHeight));
    const minLeft = layoutInfo.contentLeft;
    const maxLeft = Math.max(minLeft, layoutInfo.width - widgetWidth);
    const left = Math.max(minLeft, Math.min(scrolledPosition.left, maxLeft));
    this._widget.setPosition({ preference: { top, left } });
  }
  _getPositioningTarget() {
    if (this._pinnedRange && this._anchorPosition) {
      return { anchorPosition: this._anchorPosition, preferBelow: this._preferBelow };
    }
    const selection = this._editor.getSelection();
    if (!selection || selection.isEmpty()) {
      return void 0;
    }
    const preferBelow = selection.getDirection() === SelectionDirection.LTR;
    return {
      anchorPosition: preferBelow ? selection.getEndPosition() : selection.getStartPosition(),
      preferBelow
    };
  }
  dispose() {
    if (this._widget) {
      this._editor.removeOverlayWidget(this._widget);
      this._widget.dispose();
      this._widget = void 0;
    }
    super.dispose();
  }
};
AgentFeedbackEditorInputContribution = __decorateClass([
  __decorateParam(1, IAgentFeedbackService),
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, IContextKeyService)
], AgentFeedbackEditorInputContribution);
class AddFeedbackAtCurrentLineAction extends Action2 {
  constructor() {
    super({
      id: addFeedbackAtCurrentLineActionId,
      title: localize2("agentFeedback.addAtCurrentLine", "Add Feedback at Current Line"),
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, hasAgentFeedbackSessionForEditor),
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasAgentFeedbackSessionForEditor)
      }
    });
  }
  run(accessor) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() ?? codeEditorService.getActiveCodeEditor();
    const contribution = editor?.getContribution(AgentFeedbackEditorInputContribution.ID);
    contribution?.showAtCurrentLine(true);
  }
}
registerAction2(AddFeedbackAtCurrentLineAction);
registerEditorContribution(AgentFeedbackEditorInputContribution.ID, AgentFeedbackEditorInputContribution, EditorContributionInstantiation.Eventually);
export {
  AgentFeedbackEditorInputContribution,
  AgentFeedbackInputWidget
};
