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
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isIOS } from "../../../../base/common/platform.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import * as nls from "../../../../nls.js";
import { IMenuService, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService, isStandaloneEditorWorkspace } from "../../../../platform/workspace/common/workspace.js";
let ContextMenuController = class {
  constructor(editor, _contextMenuService, _contextViewService, _contextKeyService, _keybindingService, _menuService, _configurationService, _workspaceContextService) {
    this._contextMenuService = _contextMenuService;
    this._contextViewService = _contextViewService;
    this._contextKeyService = _contextKeyService;
    this._keybindingService = _keybindingService;
    this._menuService = _menuService;
    this._configurationService = _configurationService;
    this._workspaceContextService = _workspaceContextService;
    this._toDispose = new DisposableStore();
    this._contextMenuIsBeingShownCount = 0;
    this._editor = editor;
    this._toDispose.add(this._editor.onContextMenu((e) => this._onContextMenu(e)));
    this._toDispose.add(this._editor.onMouseWheel((e) => {
      if (this._contextMenuIsBeingShownCount > 0) {
        const view = this._contextViewService.getContextViewElement();
        const target = e.srcElement;
        if (!(target.shadowRoot && dom.getShadowRoot(view) === target.shadowRoot)) {
          this._contextViewService.hideContextView();
        }
      }
    }));
    this._toDispose.add(this._editor.onKeyDown((e) => {
      if (!this._editor.getOption(EditorOption.contextmenu)) {
        return;
      }
      if (e.keyCode === KeyCode.ContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu();
      }
    }));
  }
  static {
    this.ID = "editor.contrib.contextmenu";
  }
  static get(editor) {
    return editor.getContribution(ContextMenuController.ID);
  }
  _onContextMenu(e) {
    if (!this._editor.hasModel()) {
      return;
    }
    if (!this._editor.getOption(EditorOption.contextmenu)) {
      this._editor.focus();
      if (e.target.position && !this._editor.getSelection().containsPosition(e.target.position)) {
        this._editor.setPosition(e.target.position);
      }
      return;
    }
    if (e.target.type === MouseTargetType.OVERLAY_WIDGET) {
      return;
    }
    if (e.target.type === MouseTargetType.CONTENT_TEXT && e.target.detail.injectedText) {
      return;
    }
    e.event.preventDefault();
    e.event.stopPropagation();
    if (e.target.type === MouseTargetType.SCROLLBAR) {
      return this._showScrollbarContextMenu(e.event);
    }
    if (e.target.type !== MouseTargetType.CONTENT_TEXT && e.target.type !== MouseTargetType.CONTENT_EMPTY && e.target.type !== MouseTargetType.TEXTAREA) {
      return;
    }
    this._editor.focus();
    if (e.target.position) {
      let hasSelectionAtPosition = false;
      for (const selection of this._editor.getSelections()) {
        if (selection.containsPosition(e.target.position)) {
          hasSelectionAtPosition = true;
          break;
        }
      }
      if (!hasSelectionAtPosition) {
        this._editor.setPosition(e.target.position);
      }
    }
    let anchor = null;
    if (e.target.type !== MouseTargetType.TEXTAREA) {
      anchor = e.event;
    }
    this.showContextMenu(anchor);
  }
  showContextMenu(anchor) {
    if (!this._editor.getOption(EditorOption.contextmenu)) {
      return;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const menuActions = this._getMenuActions(
      this._editor.getModel(),
      this._editor.contextMenuId
    );
    if (menuActions.length > 0) {
      this._doShowContextMenu(menuActions, anchor);
    }
  }
  _getMenuActions(model, menuId) {
    const result = [];
    const groups = this._menuService.getMenuActions(menuId, this._contextKeyService, { arg: model.uri });
    for (const group of groups) {
      const [, actions] = group;
      let addedItems = 0;
      for (const action of actions) {
        if (action instanceof SubmenuItemAction) {
          const subActions = this._getMenuActions(model, action.item.submenu);
          if (subActions.length > 0) {
            result.push(new SubmenuAction(action.id, action.label, subActions));
            addedItems++;
          }
        } else {
          result.push(action);
          addedItems++;
        }
      }
      if (addedItems) {
        result.push(new Separator());
      }
    }
    if (result.length) {
      result.pop();
    }
    return result;
  }
  _doShowContextMenu(actions, event = null) {
    if (!this._editor.hasModel()) {
      return;
    }
    let anchor = event;
    if (!anchor) {
      this._editor.revealPosition(this._editor.getPosition(), ScrollType.Immediate);
      this._editor.render();
      const cursorCoords = this._editor.getScrolledVisiblePosition(this._editor.getPosition());
      const editorCoords = dom.getDomNodePagePosition(this._editor.getDomNode());
      const posx = editorCoords.left + cursorCoords.left;
      const posy = editorCoords.top + cursorCoords.top + cursorCoords.height;
      anchor = { x: posx, y: posy };
    }
    const useShadowDOM = this._editor.getOption(EditorOption.useShadowDOM) && !isIOS;
    this._contextMenuIsBeingShownCount++;
    this._contextMenuService.showContextMenu({
      domForShadowRoot: useShadowDOM ? this._editor.getOverflowWidgetsDomNode() ?? this._editor.getDomNode() : void 0,
      getAnchor: () => anchor,
      getActions: () => actions,
      getActionViewItem: (action) => {
        const keybinding = this._keybindingFor(action);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel(), isMenu: true });
        }
        const customAction = action;
        if (typeof customAction.getActionViewItem === "function") {
          return customAction.getActionViewItem();
        }
        return new ActionViewItem(action, action, { icon: true, label: true, isMenu: true });
      },
      getKeyBinding: (action) => {
        return this._keybindingFor(action);
      },
      onHide: (wasCancelled) => {
        this._contextMenuIsBeingShownCount--;
      }
    });
  }
  _showScrollbarContextMenu(anchor) {
    if (!this._editor.hasModel()) {
      return;
    }
    if (isStandaloneEditorWorkspace(this._workspaceContextService.getWorkspace())) {
      return;
    }
    const minimapOptions = this._editor.getOption(EditorOption.minimap);
    let lastId = 0;
    const createAction = (opts) => {
      return {
        id: `menu-action-${++lastId}`,
        label: opts.label,
        tooltip: "",
        class: void 0,
        enabled: typeof opts.enabled === "undefined" ? true : opts.enabled,
        checked: opts.checked,
        run: opts.run
      };
    };
    const createSubmenuAction = (label, actions2) => {
      return new SubmenuAction(
        `menu-action-${++lastId}`,
        label,
        actions2,
        void 0
      );
    };
    const createEnumAction = (label, enabled, configName, configuredValue, options) => {
      if (!enabled) {
        return createAction({ label, enabled, run: () => {
        } });
      }
      const createRunner = (value) => {
        return () => {
          this._configurationService.updateValue(configName, value);
        };
      };
      const actions2 = [];
      for (const option of options) {
        actions2.push(createAction({
          label: option.label,
          checked: configuredValue === option.value,
          run: createRunner(option.value)
        }));
      }
      return createSubmenuAction(
        label,
        actions2
      );
    };
    const actions = [];
    actions.push(createAction({
      label: nls.localize("context.minimap.minimap", "Minimap"),
      checked: minimapOptions.enabled,
      run: () => {
        this._configurationService.updateValue(`editor.minimap.enabled`, !minimapOptions.enabled);
      }
    }));
    actions.push(new Separator());
    actions.push(createAction({
      label: nls.localize("context.minimap.renderCharacters", "Render Characters"),
      enabled: minimapOptions.enabled,
      checked: minimapOptions.renderCharacters,
      run: () => {
        this._configurationService.updateValue(`editor.minimap.renderCharacters`, !minimapOptions.renderCharacters);
      }
    }));
    actions.push(createEnumAction(
      nls.localize("context.minimap.size", "Vertical size"),
      minimapOptions.enabled,
      "editor.minimap.size",
      minimapOptions.size,
      [{
        label: nls.localize("context.minimap.size.proportional", "Proportional"),
        value: "proportional"
      }, {
        label: nls.localize("context.minimap.size.fill", "Fill"),
        value: "fill"
      }, {
        label: nls.localize("context.minimap.size.fit", "Fit"),
        value: "fit"
      }]
    ));
    actions.push(createEnumAction(
      nls.localize("context.minimap.slider", "Slider"),
      minimapOptions.enabled,
      "editor.minimap.showSlider",
      minimapOptions.showSlider,
      [{
        label: nls.localize("context.minimap.slider.mouseover", "Mouse Over"),
        value: "mouseover"
      }, {
        label: nls.localize("context.minimap.slider.always", "Always"),
        value: "always"
      }]
    ));
    actions.push(createEnumAction(
      nls.localize("context.minimap.side", "Side"),
      minimapOptions.enabled,
      "editor.minimap.side",
      minimapOptions.side,
      [{
        label: nls.localize("context.minimap.side.right", "Right"),
        value: "right"
      }, {
        label: nls.localize("context.minimap.side.left", "Left"),
        value: "left"
      }]
    ));
    const useShadowDOM = this._editor.getOption(EditorOption.useShadowDOM) && !isIOS;
    this._contextMenuIsBeingShownCount++;
    this._contextMenuService.showContextMenu({
      domForShadowRoot: useShadowDOM ? this._editor.getDomNode() : void 0,
      getAnchor: () => anchor,
      getActions: () => actions,
      onHide: (wasCancelled) => {
        this._contextMenuIsBeingShownCount--;
        this._editor.focus();
      }
    });
  }
  _keybindingFor(action) {
    return this._keybindingService.lookupKeybinding(action.id);
  }
  dispose() {
    if (this._contextMenuIsBeingShownCount > 0) {
      this._contextViewService.hideContextView();
    }
    this._toDispose.dispose();
  }
};
ContextMenuController = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IWorkspaceContextService)
], ContextMenuController);
class ShowContextMenu extends EditorAction {
  constructor() {
    super({
      id: "editor.action.showContextMenu",
      label: nls.localize2("action.showContextMenu.label", "Show Editor Context Menu"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.Shift | KeyCode.F10,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    ContextMenuController.get(editor)?.showContextMenu();
  }
}
registerEditorContribution(ContextMenuController.ID, ContextMenuController, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(ShowContextMenu);
export {
  ContextMenuController
};
