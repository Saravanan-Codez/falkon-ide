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
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { IMarkerNavigationService } from "./markerNavigationService.js";
import * as nls from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { MarkerNavigationWidget } from "./gotoErrorWidget.js";
let MarkerController = class {
  constructor(editor, _markerNavigationService, _contextKeyService, _editorService, _instantiationService) {
    this._markerNavigationService = _markerNavigationService;
    this._contextKeyService = _contextKeyService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._sessionDispoables = new DisposableStore();
    this._editor = editor;
    this._widgetVisible = CONTEXT_MARKERS_NAVIGATION_VISIBLE.bindTo(this._contextKeyService);
  }
  static {
    this.ID = "editor.contrib.markerController";
  }
  static get(editor) {
    return editor.getContribution(MarkerController.ID);
  }
  dispose() {
    this._cleanUp();
    this._sessionDispoables.dispose();
  }
  _cleanUp() {
    this._widgetVisible.reset();
    this._sessionDispoables.clear();
    this._widget = void 0;
    this._model = void 0;
  }
  _getOrCreateModel(uri) {
    if (this._model && this._model.matches(uri)) {
      return this._model;
    }
    let reusePosition = false;
    if (this._model) {
      reusePosition = true;
      this._cleanUp();
    }
    this._model = this._markerNavigationService.getMarkerList(uri);
    if (reusePosition) {
      this._model.move(true, this._editor.getModel(), this._editor.getPosition());
    }
    this._widget = this._instantiationService.createInstance(MarkerNavigationWidget, this._editor);
    this._widget.onDidClose(() => this.close(), this, this._sessionDispoables);
    this._widgetVisible.set(true);
    this._sessionDispoables.add(this._model);
    this._sessionDispoables.add(this._widget);
    this._sessionDispoables.add(this._editor.onDidChangeCursorPosition((e) => {
      if (!this._model?.selected || !Range.containsPosition(this._model?.selected.marker, e.position)) {
        this._model?.resetIndex();
      }
    }));
    this._sessionDispoables.add(this._model.onDidChange(() => {
      if (!this._widget || !this._widget.position || !this._model) {
        return;
      }
      const info = this._model.find(this._editor.getModel().uri, this._widget.position);
      if (info) {
        this._widget.updateMarker(info.marker);
      } else {
        this._widget.showStale();
      }
    }));
    this._sessionDispoables.add(this._widget.onDidSelectRelatedInformation((related) => {
      this._editorService.openCodeEditor({
        resource: related.resource,
        options: { pinned: true, revealIfOpened: true, selection: Range.lift(related).collapseToStart() }
      }, this._editor);
      this.close(false);
    }));
    this._sessionDispoables.add(this._editor.onDidChangeModel(() => this._cleanUp()));
    return this._model;
  }
  close(focusEditor = true) {
    this._cleanUp();
    if (focusEditor) {
      this._editor.focus();
    }
  }
  showAtMarker(marker) {
    if (!this._editor.hasModel()) {
      return;
    }
    const textModel = this._editor.getModel();
    const model = this._getOrCreateModel(textModel.uri);
    model.resetIndex();
    model.move(true, textModel, new Position(marker.startLineNumber, marker.startColumn));
    if (model.selected) {
      this._widget.showAtMarker(model.selected.marker, model.selected.index, model.selected.total);
    }
  }
  async navigate(next, multiFile) {
    if (!this._editor.hasModel()) {
      return;
    }
    const textModel = this._editor.getModel();
    const model = this._getOrCreateModel(multiFile ? void 0 : textModel.uri);
    model.move(next, textModel, this._editor.getPosition());
    if (!model.selected) {
      return;
    }
    if (model.selected.marker.resource.toString() !== textModel.uri.toString()) {
      this._cleanUp();
      const otherEditor = await this._editorService.openCodeEditor({
        resource: model.selected.marker.resource,
        options: { pinned: false, revealIfOpened: true, selectionRevealType: TextEditorSelectionRevealType.NearTop, selection: model.selected.marker }
      }, this._editor);
      if (otherEditor) {
        MarkerController.get(otherEditor)?.close();
        MarkerController.get(otherEditor)?.navigate(next, multiFile);
      }
    } else {
      this._widget.showAtMarker(model.selected.marker, model.selected.index, model.selected.total);
    }
  }
};
MarkerController = __decorateClass([
  __decorateParam(1, IMarkerNavigationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, IInstantiationService)
], MarkerController);
class MarkerNavigationAction extends EditorAction {
  constructor(_next, _multiFile, opts) {
    super(opts);
    this._next = _next;
    this._multiFile = _multiFile;
  }
  async run(_accessor, editor) {
    if (editor.hasModel()) {
      await MarkerController.get(editor)?.navigate(this._next, this._multiFile);
    }
  }
}
class NextMarkerAction extends MarkerNavigationAction {
  static {
    this.ID = "editor.action.marker.next";
  }
  static {
    this.LABEL = nls.localize2("markerAction.next.label", "Go to Next Problem (Error, Warning, Info)");
  }
  constructor() {
    super(true, false, {
      id: NextMarkerAction.ID,
      label: NextMarkerAction.LABEL,
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.Alt | KeyCode.F8,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MarkerNavigationWidget.TitleMenu,
        title: NextMarkerAction.LABEL.value,
        icon: registerIcon("marker-navigation-next", Codicon.arrowDown, nls.localize("nextMarkerIcon", "Icon for goto next marker.")),
        group: "navigation",
        order: 1
      }
    });
  }
}
class PrevMarkerAction extends MarkerNavigationAction {
  static {
    this.ID = "editor.action.marker.prev";
  }
  static {
    this.LABEL = nls.localize2("markerAction.previous.label", "Go to Previous Problem (Error, Warning, Info)");
  }
  constructor() {
    super(false, false, {
      id: PrevMarkerAction.ID,
      label: PrevMarkerAction.LABEL,
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F8,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MarkerNavigationWidget.TitleMenu,
        title: PrevMarkerAction.LABEL.value,
        icon: registerIcon("marker-navigation-previous", Codicon.arrowUp, nls.localize("previousMarkerIcon", "Icon for goto previous marker.")),
        group: "navigation",
        order: 2
      }
    });
  }
}
class NextMarkerInFilesAction extends MarkerNavigationAction {
  static {
    this.ID = "editor.action.marker.nextInFiles";
  }
  constructor() {
    super(true, true, {
      id: NextMarkerInFilesAction.ID,
      label: nls.localize2("markerAction.nextInFiles.label", "Go to Next Problem in Files (Error, Warning, Info)"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyCode.F8,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarGoMenu,
        title: nls.localize({ key: "miGotoNextProblem", comment: ["&& denotes a mnemonic"] }, "Next &&Problem"),
        group: "6_problem_nav",
        order: 1
      }
    });
  }
}
class PrevMarkerInFilesAction extends MarkerNavigationAction {
  static {
    this.ID = "editor.action.marker.prevInFiles";
  }
  constructor() {
    super(false, true, {
      id: PrevMarkerInFilesAction.ID,
      label: nls.localize2("markerAction.previousInFiles.label", "Go to Previous Problem in Files (Error, Warning, Info)"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.Shift | KeyCode.F8,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarGoMenu,
        title: nls.localize({ key: "miGotoPreviousProblem", comment: ["&& denotes a mnemonic"] }, "Previous &&Problem"),
        group: "6_problem_nav",
        order: 2
      }
    });
  }
}
registerEditorContribution(MarkerController.ID, MarkerController, EditorContributionInstantiation.Lazy);
registerEditorAction(NextMarkerAction);
registerEditorAction(PrevMarkerAction);
registerEditorAction(NextMarkerInFilesAction);
registerEditorAction(PrevMarkerInFilesAction);
const CONTEXT_MARKERS_NAVIGATION_VISIBLE = new RawContextKey("markersNavigationVisible", false);
const MarkerCommand = EditorCommand.bindToContribution(MarkerController.get);
registerEditorCommand(new MarkerCommand({
  id: "closeMarkersNavigation",
  precondition: CONTEXT_MARKERS_NAVIGATION_VISIBLE,
  handler: (x) => x.close(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 50,
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
export {
  MarkerController,
  NextMarkerAction,
  NextMarkerInFilesAction,
  PrevMarkerAction,
  PrevMarkerInFilesAction
};
