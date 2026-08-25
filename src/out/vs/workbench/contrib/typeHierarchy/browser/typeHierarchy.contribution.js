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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorAction2, EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { PeekContext } from "../../../../editor/contrib/peekView/browser/peekView.js";
import { localize, localize2 } from "../../../../nls.js";
import { MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { TypeHierarchyTreePeekWidget } from "./typeHierarchyPeek.js";
import { TypeHierarchyDirection, TypeHierarchyModel, TypeHierarchyProviderRegistry } from "../common/typeHierarchy.js";
const _ctxHasTypeHierarchyProvider = new RawContextKey("editorHasTypeHierarchyProvider", false, localize("editorHasTypeHierarchyProvider", "Whether a type hierarchy provider is available"));
const _ctxTypeHierarchyVisible = new RawContextKey("typeHierarchyVisible", false, localize("typeHierarchyVisible", "Whether type hierarchy peek is currently showing"));
const _ctxTypeHierarchyDirection = new RawContextKey("typeHierarchyDirection", void 0, { type: "string", description: localize("typeHierarchyDirection", "whether type hierarchy shows super types or subtypes") });
function sanitizedDirection(candidate) {
  return candidate === TypeHierarchyDirection.Subtypes || candidate === TypeHierarchyDirection.Supertypes ? candidate : TypeHierarchyDirection.Subtypes;
}
let TypeHierarchyController = class {
  constructor(_editor, _contextKeyService, _storageService, _editorService, _instantiationService) {
    this._editor = _editor;
    this._contextKeyService = _contextKeyService;
    this._storageService = _storageService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
    this._sessionDisposables = new DisposableStore();
    this._ctxHasProvider = _ctxHasTypeHierarchyProvider.bindTo(this._contextKeyService);
    this._ctxIsVisible = _ctxTypeHierarchyVisible.bindTo(this._contextKeyService);
    this._ctxDirection = _ctxTypeHierarchyDirection.bindTo(this._contextKeyService);
    this._disposables.add(Event.any(_editor.onDidChangeModel, _editor.onDidChangeModelLanguage, TypeHierarchyProviderRegistry.onDidChange)(() => {
      this._ctxHasProvider.set(_editor.hasModel() && TypeHierarchyProviderRegistry.has(_editor.getModel()));
    }));
    this._disposables.add(this._sessionDisposables);
  }
  static {
    this.Id = "typeHierarchy";
  }
  static get(editor) {
    return editor.getContribution(TypeHierarchyController.Id);
  }
  static {
    this._storageDirectionKey = "typeHierarchy/defaultDirection";
  }
  dispose() {
    this._disposables.dispose();
  }
  // Peek
  async startTypeHierarchyFromEditor() {
    this._sessionDisposables.clear();
    if (!this._editor.hasModel()) {
      return;
    }
    const document = this._editor.getModel();
    const position = this._editor.getPosition();
    if (!TypeHierarchyProviderRegistry.has(document)) {
      return;
    }
    const cts = new CancellationTokenSource();
    const model = TypeHierarchyModel.create(document, position, cts.token);
    const direction = sanitizedDirection(this._storageService.get(TypeHierarchyController._storageDirectionKey, StorageScope.PROFILE, TypeHierarchyDirection.Subtypes));
    this._showTypeHierarchyWidget(position, direction, model, cts);
  }
  _showTypeHierarchyWidget(position, direction, model, cts) {
    this._ctxIsVisible.set(true);
    this._ctxDirection.set(direction);
    Event.any(this._editor.onDidChangeModel, this._editor.onDidChangeModelLanguage)(this.endTypeHierarchy, this, this._sessionDisposables);
    this._widget = this._instantiationService.createInstance(TypeHierarchyTreePeekWidget, this._editor, position, direction);
    this._widget.showLoading();
    this._sessionDisposables.add(this._widget.onDidClose(() => {
      this.endTypeHierarchy();
      this._storageService.store(TypeHierarchyController._storageDirectionKey, this._widget.direction, StorageScope.PROFILE, StorageTarget.USER);
    }));
    this._sessionDisposables.add({ dispose() {
      cts.dispose(true);
    } });
    this._sessionDisposables.add(this._widget);
    model.then((model2) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (model2) {
        this._sessionDisposables.add(model2);
        this._widget.showModel(model2);
      } else {
        this._widget.showMessage(localize("no.item", "No results"));
      }
    }).catch((err) => {
      if (isCancellationError(err)) {
        this.endTypeHierarchy();
        return;
      }
      this._widget.showMessage(localize("error", "Failed to show type hierarchy"));
    });
  }
  async startTypeHierarchyFromTypeHierarchy() {
    if (!this._widget) {
      return;
    }
    const model = this._widget.getModel();
    const typeItem = this._widget.getFocused();
    if (!typeItem || !model) {
      return;
    }
    const newEditor = await this._editorService.openCodeEditor({ resource: typeItem.item.uri }, this._editor);
    if (!newEditor) {
      return;
    }
    const newModel = model.fork(typeItem.item);
    this._sessionDisposables.clear();
    TypeHierarchyController.get(newEditor)?._showTypeHierarchyWidget(
      Range.lift(newModel.root.selectionRange).getStartPosition(),
      this._widget.direction,
      Promise.resolve(newModel),
      new CancellationTokenSource()
    );
  }
  showSupertypes() {
    this._widget?.updateDirection(TypeHierarchyDirection.Supertypes);
    this._ctxDirection.set(TypeHierarchyDirection.Supertypes);
  }
  showSubtypes() {
    this._widget?.updateDirection(TypeHierarchyDirection.Subtypes);
    this._ctxDirection.set(TypeHierarchyDirection.Subtypes);
  }
  endTypeHierarchy() {
    this._sessionDisposables.clear();
    this._ctxIsVisible.set(false);
    this._editor.focus();
  }
};
TypeHierarchyController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, IInstantiationService)
], TypeHierarchyController);
registerEditorContribution(TypeHierarchyController.Id, TypeHierarchyController, EditorContributionInstantiation.Eager);
registerAction2(class PeekTypeHierarchyAction extends EditorAction2 {
  constructor() {
    super({
      id: "editor.showTypeHierarchy",
      title: localize2("title", "Peek Type Hierarchy"),
      menu: {
        id: MenuId.EditorContextPeek,
        group: "navigation",
        order: 1e3,
        when: ContextKeyExpr.and(
          _ctxHasTypeHierarchyProvider,
          PeekContext.notInPeekEditor
        )
      },
      precondition: ContextKeyExpr.and(
        _ctxHasTypeHierarchyProvider,
        PeekContext.notInPeekEditor
      ),
      f1: true
    });
  }
  async runEditorCommand(_accessor, editor) {
    return TypeHierarchyController.get(editor)?.startTypeHierarchyFromEditor();
  }
});
registerAction2(class extends EditorAction2 {
  constructor() {
    super({
      id: "editor.showSupertypes",
      title: localize2("title.supertypes", "Show Supertypes"),
      icon: Codicon.typeHierarchySuper,
      precondition: ContextKeyExpr.and(_ctxTypeHierarchyVisible, _ctxTypeHierarchyDirection.isEqualTo(TypeHierarchyDirection.Subtypes)),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Shift + KeyMod.Alt + KeyCode.KeyH
      },
      menu: {
        id: TypeHierarchyTreePeekWidget.TitleMenu,
        when: _ctxTypeHierarchyDirection.isEqualTo(TypeHierarchyDirection.Subtypes),
        order: 1
      }
    });
  }
  runEditorCommand(_accessor, editor) {
    return TypeHierarchyController.get(editor)?.showSupertypes();
  }
});
registerAction2(class extends EditorAction2 {
  constructor() {
    super({
      id: "editor.showSubtypes",
      title: localize2("title.subtypes", "Show Subtypes"),
      icon: Codicon.typeHierarchySub,
      precondition: ContextKeyExpr.and(_ctxTypeHierarchyVisible, _ctxTypeHierarchyDirection.isEqualTo(TypeHierarchyDirection.Supertypes)),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Shift + KeyMod.Alt + KeyCode.KeyH
      },
      menu: {
        id: TypeHierarchyTreePeekWidget.TitleMenu,
        when: _ctxTypeHierarchyDirection.isEqualTo(TypeHierarchyDirection.Supertypes),
        order: 1
      }
    });
  }
  runEditorCommand(_accessor, editor) {
    return TypeHierarchyController.get(editor)?.showSubtypes();
  }
});
registerAction2(class extends EditorAction2 {
  constructor() {
    super({
      id: "editor.refocusTypeHierarchy",
      title: localize2("title.refocusTypeHierarchy", "Refocus Type Hierarchy"),
      precondition: _ctxTypeHierarchyVisible,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Shift + KeyCode.Enter
      }
    });
  }
  async runEditorCommand(_accessor, editor) {
    return TypeHierarchyController.get(editor)?.startTypeHierarchyFromTypeHierarchy();
  }
});
registerAction2(class extends EditorAction2 {
  constructor() {
    super({
      id: "editor.closeTypeHierarchy",
      title: localize("close", "Close"),
      icon: Codicon.close,
      precondition: _ctxTypeHierarchyVisible,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 10,
        primary: KeyCode.Escape,
        when: ContextKeyExpr.not("config.editor.stablePeek")
      },
      menu: {
        id: TypeHierarchyTreePeekWidget.TitleMenu,
        order: 1e3
      }
    });
  }
  runEditorCommand(_accessor, editor) {
    return TypeHierarchyController.get(editor)?.endTypeHierarchy();
  }
});
