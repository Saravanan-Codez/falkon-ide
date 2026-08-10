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
import { Separator } from "../../../../base/common/actions.js";
import { h } from "../../../../base/browser/dom.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, observableFromEvent } from "../../../../base/common/observable.js";
import { getActionBarActions, MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { OverlayWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { observableCodeEditor } from "../../../browser/observableCodeEditor.js";
let FloatingEditorToolbar = class extends Disposable {
  static {
    this.ID = "editor.contrib.floatingToolbar";
  }
  constructor(editor, instantiationService, keybindingService, menuService) {
    super();
    const editorObs = this._register(observableCodeEditor(editor));
    const editorUriObs = derived((reader) => editorObs.model.read(reader)?.uri);
    const widget = this._register(instantiationService.createInstance(
      FloatingEditorToolbarWidget,
      MenuId.EditorContent,
      editor.contextKeyService,
      editorUriObs
    ));
    this._register(autorun((reader) => {
      const hasActions = widget.hasActions.read(reader);
      if (!hasActions) {
        return;
      }
      reader.store.add(editorObs.createOverlayWidget({
        allowEditorOverflow: false,
        domNode: widget.element,
        minContentWidthInPx: constObservable(0),
        position: constObservable({
          preference: OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER
        })
      }));
    }));
  }
};
FloatingEditorToolbar = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IMenuService)
], FloatingEditorToolbar);
let FloatingEditorToolbarWidget = class extends Disposable {
  constructor(_menuId, _scopedContextKeyService, _toolbarContext, instantiationService, keybindingService, menuService) {
    super();
    const menu = this._register(menuService.createMenu(_menuId, _scopedContextKeyService));
    const menuGroupsObs = observableFromEvent(this, menu.onDidChange, () => menu.getActions());
    const menuPrimaryActionsObs = derived((reader) => {
      const menuGroups = menuGroupsObs.read(reader);
      const { primary } = getActionBarActions(menuGroups, () => true);
      return primary.filter((a) => a.id !== Separator.ID);
    });
    this.hasActions = derived((reader) => menuPrimaryActionsObs.read(reader).length > 0);
    this.element = h("div.floating-menu-overlay-widget").root;
    this._register(toDisposable(() => this.element.remove()));
    this._register(autorun((reader) => {
      const primaryActions = menuPrimaryActionsObs.read(reader);
      const hasActions = primaryActions.length > 0;
      const menuPrimaryActionId = hasActions ? primaryActions[0].id : void 0;
      const isSingleButton = primaryActions.length === 1;
      this.element.classList.toggle("single-button", isSingleButton);
      this.element.style.height = isSingleButton ? "28px" : "26px";
      if (!hasActions) {
        return;
      }
      const toolbar = instantiationService.createInstance(MenuWorkbenchToolBar, this.element, _menuId, {
        actionViewItemProvider: (action, options) => {
          if (!(action instanceof MenuItemAction)) {
            return void 0;
          }
          return instantiationService.createInstance(class extends MenuEntryActionViewItem {
            render(container) {
              super.render(container);
              if (action.id === menuPrimaryActionId) {
                this.element?.classList.add("primary");
              }
            }
            updateLabel() {
              const keybinding = keybindingService.lookupKeybinding(action.id);
              const keybindingLabel = keybinding ? keybinding.getLabel() : void 0;
              if (this.options.label && this.label) {
                this.label.textContent = keybindingLabel ? `${this._commandAction.label} (${keybindingLabel})` : this._commandAction.label;
              }
            }
          }, action, { ...options, keybindingNotRenderedWithLabel: true });
        },
        hiddenItemStrategy: HiddenItemStrategy.Ignore,
        menuOptions: {
          shouldForwardArgs: true
        },
        telemetrySource: "editor.overlayToolbar",
        toolbarOptions: {
          primaryGroup: () => true,
          useSeparatorsInPrimaryActions: true
        }
      });
      reader.store.add(toolbar);
      reader.store.add(autorun((reader2) => {
        const context = _toolbarContext.read(reader2);
        toolbar.context = context;
      }));
    }));
  }
};
FloatingEditorToolbarWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IMenuService)
], FloatingEditorToolbarWidget);
export {
  FloatingEditorToolbar,
  FloatingEditorToolbarWidget
};
