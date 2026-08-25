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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { CommentFormActions } from "./commentFormActions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
let CommentThreadAdditionalActions = class extends Disposable {
  constructor(container, _commentThread, _contextKeyService, _commentMenus, _actionRunDelegate, _keybindingService, _contextMenuService) {
    super();
    this._commentThread = _commentThread;
    this._contextKeyService = _contextKeyService;
    this._commentMenus = _commentMenus;
    this._actionRunDelegate = _actionRunDelegate;
    this._keybindingService = _keybindingService;
    this._contextMenuService = _contextMenuService;
    this._container = dom.append(container, dom.$(".comment-additional-actions"));
    dom.append(this._container, dom.$(".section-separator"));
    this._buttonBar = dom.append(this._container, dom.$(".button-bar"));
    this._createAdditionalActions(this._buttonBar);
  }
  _showMenu() {
    this._container?.classList.remove("hidden");
  }
  _hideMenu() {
    this._container?.classList.add("hidden");
  }
  _enableDisableMenu(menu) {
    const groups = menu.getActions({ shouldForwardArgs: true });
    for (const group of groups) {
      const [, actions] = group;
      for (const action of actions) {
        if (action.enabled) {
          this._showMenu();
          return;
        }
        for (const subAction of action.actions ?? []) {
          if (subAction.enabled) {
            this._showMenu();
            return;
          }
        }
      }
    }
    this._hideMenu();
  }
  _createAdditionalActions(container) {
    const menu = this._commentMenus.getCommentThreadAdditionalActions(this._contextKeyService);
    this._register(menu);
    this._register(menu.onDidChange(() => {
      this._commentFormActions.setActions(
        menu,
        /*hasOnlySecondaryActions*/
        true
      );
      this._enableDisableMenu(menu);
    }));
    this._commentFormActions = new CommentFormActions(this._keybindingService, this._contextKeyService, this._contextMenuService, container, async (action) => {
      this._actionRunDelegate?.();
      action.run({
        thread: this._commentThread,
        $mid: MarshalledId.CommentThreadInstance
      });
    }, 4, true);
    this._register(this._commentFormActions);
    this._commentFormActions.setActions(
      menu,
      /*hasOnlySecondaryActions*/
      true
    );
    this._enableDisableMenu(menu);
  }
};
CommentThreadAdditionalActions = __decorateClass([
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextMenuService)
], CommentThreadAdditionalActions);
export {
  CommentThreadAdditionalActions
};
