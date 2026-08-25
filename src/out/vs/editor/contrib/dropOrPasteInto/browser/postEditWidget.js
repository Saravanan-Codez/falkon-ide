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
import * as dom from "../../../../base/browser/dom.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { raceCancellationError } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { IBulkEditService } from "../../../browser/services/bulkEditService.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { createCombinedWorkspaceEdit } from "./edit.js";
import "./postEditWidget.css";
let PostEditWidget = class extends Disposable {
  constructor(typeId, editor, visibleContext, showCommand, range, edits, onSelectNewEdit, additionalActions, contextKeyService, _keybindingService, _actionWidgetService) {
    super();
    this.typeId = typeId;
    this.editor = editor;
    this.showCommand = showCommand;
    this.range = range;
    this.edits = edits;
    this.onSelectNewEdit = onSelectNewEdit;
    this.additionalActions = additionalActions;
    this._keybindingService = _keybindingService;
    this._actionWidgetService = _actionWidgetService;
    this.allowEditorOverflow = true;
    this.suppressMouseDown = true;
    this.create();
    this.visibleContext = visibleContext.bindTo(contextKeyService);
    this.visibleContext.set(true);
    this._register(toDisposable(() => this.visibleContext.reset()));
    this.editor.addContentWidget(this);
    this.editor.layoutContentWidget(this);
    this._register(toDisposable((() => this.editor.removeContentWidget(this))));
    this._register(this.editor.onDidChangeCursorPosition((e) => {
      this.dispose();
    }));
    this._register(Event.runAndSubscribe(_keybindingService.onDidUpdateKeybindings, () => {
      this._updateButtonTitle();
    }));
  }
  static {
    this.baseId = "editor.widget.postEditWidget";
  }
  _updateButtonTitle() {
    this.button.element.title = this._keybindingService.appendKeybinding(this.showCommand.label, this.showCommand.id);
  }
  create() {
    this.domNode = dom.$(".post-edit-widget");
    this.button = this._register(new Button(this.domNode, {
      supportIcons: true
    }));
    this.button.label = "$(insert)";
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.CLICK, () => this.showSelector()));
  }
  getId() {
    return PostEditWidget.baseId + "." + this.typeId;
  }
  getDomNode() {
    return this.domNode;
  }
  getPosition() {
    return {
      position: this.range.getEndPosition(),
      preference: [ContentWidgetPositionPreference.BELOW]
    };
  }
  showSelector() {
    const pos = dom.getDomNodePagePosition(this.button.element);
    const anchor = { x: pos.left + pos.width, y: pos.top + pos.height };
    this._actionWidgetService.show(
      "postEditWidget",
      false,
      this.edits.allEdits.map((edit, i) => {
        return {
          kind: ActionListItemKind.Action,
          item: edit,
          label: edit.title,
          disabled: false,
          canPreview: false,
          group: { title: "", icon: ThemeIcon.fromId(i === this.edits.activeEditIndex ? Codicon.check.id : Codicon.blank.id) }
        };
      }),
      {
        onHide: () => {
          this.editor.focus();
        },
        onSelect: (item) => {
          this._actionWidgetService.hide(false);
          const i = this.edits.allEdits.findIndex((edit) => edit === item);
          if (i !== this.edits.activeEditIndex) {
            return this.onSelectNewEdit(i);
          }
        }
      },
      anchor,
      this.editor.getDomNode() ?? void 0,
      this.additionalActions
    );
  }
};
PostEditWidget = __decorateClass([
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IActionWidgetService)
], PostEditWidget);
let PostEditWidgetManager = class extends Disposable {
  constructor(_id, _editor, _visibleContext, _showCommand, _getAdditionalActions, _instantiationService, _bulkEditService, _notificationService) {
    super();
    this._id = _id;
    this._editor = _editor;
    this._visibleContext = _visibleContext;
    this._showCommand = _showCommand;
    this._getAdditionalActions = _getAdditionalActions;
    this._instantiationService = _instantiationService;
    this._bulkEditService = _bulkEditService;
    this._notificationService = _notificationService;
    this._currentWidget = this._register(new MutableDisposable());
    this._register(Event.any(
      _editor.onDidChangeModel,
      _editor.onDidChangeModelContent
    )(() => this.clear()));
  }
  async applyEditAndShowIfNeeded(ranges, edits, canShowWidget, resolve, token) {
    if (!ranges.length || !this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    const edit = edits.allEdits.at(edits.activeEditIndex);
    if (!edit) {
      return;
    }
    const onDidSelectEdit = async (newEditIndex) => {
      const model2 = this._editor.getModel();
      if (!model2) {
        return;
      }
      await model2.undo();
      this.applyEditAndShowIfNeeded(ranges, { activeEditIndex: newEditIndex, allEdits: edits.allEdits }, canShowWidget, resolve, token);
    };
    const handleError = (e, message) => {
      if (isCancellationError(e)) {
        return;
      }
      this._notificationService.error(message);
      if (canShowWidget) {
        this.show(ranges[0], edits, onDidSelectEdit);
      }
    };
    const editorStateCts = new EditorStateCancellationTokenSource(this._editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Selection, void 0, token);
    let resolvedEdit;
    try {
      resolvedEdit = await raceCancellationError(resolve(edit, editorStateCts.token), editorStateCts.token);
    } catch (e) {
      return handleError(e, localize("resolveError", "Error resolving edit '{0}':\n{1}", edit.title, toErrorMessage(e)));
    } finally {
      editorStateCts.dispose();
    }
    if (token.isCancellationRequested) {
      return;
    }
    const combinedWorkspaceEdit = createCombinedWorkspaceEdit(model.uri, ranges, resolvedEdit);
    const primaryRange = ranges[0];
    const editTrackingDecoration = model.deltaDecorations([], [{
      range: primaryRange,
      options: { description: "paste-line-suffix", stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges }
    }]);
    this._editor.focus();
    let editResult;
    let editRange;
    try {
      editResult = await this._bulkEditService.apply(combinedWorkspaceEdit, { editor: this._editor, token });
      editRange = model.getDecorationRange(editTrackingDecoration[0]);
    } catch (e) {
      return handleError(e, localize("applyError", "Error applying edit '{0}':\n{1}", edit.title, toErrorMessage(e)));
    } finally {
      model.deltaDecorations(editTrackingDecoration, []);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (canShowWidget && editResult.isApplied && edits.allEdits.length > 1) {
      this.show(editRange ?? primaryRange, edits, onDidSelectEdit);
    }
  }
  show(range, edits, onDidSelectEdit) {
    this.clear();
    if (this._editor.hasModel()) {
      this._currentWidget.value = this._instantiationService.createInstance(PostEditWidget, this._id, this._editor, this._visibleContext, this._showCommand, range, edits, onDidSelectEdit, this._getAdditionalActions());
    }
  }
  clear() {
    this._currentWidget.clear();
  }
  tryShowSelector() {
    this._currentWidget.value?.showSelector();
  }
};
PostEditWidgetManager = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IBulkEditService),
  __decorateParam(7, INotificationService)
], PostEditWidgetManager);
export {
  PostEditWidgetManager
};
