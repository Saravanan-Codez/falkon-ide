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
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { AuxiliaryBarVisibleContext, IsAuxiliaryWindowContext, IsSessionsWindowContext, IsTopRightEditorGroupContext, MainEditorAreaVisibleContext } from "../../../../../workbench/common/contextkeys.js";
import { Parts } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { Menus } from "../../../../browser/menus.js";
import { IAgentWorkbenchLayoutService } from "../../../../browser/workbench.js";
import { HasDockedDetailsContext, SinglePaneLayoutEnabledContext } from "../../../../common/contextkeys.js";
import { SinglePaneLayoutStrategy } from "./singlePaneLayoutStrategy.js";
const TOGGLE_DETAILS_COMMAND_ID = "workbench.action.agentSessions.toggleDetails";
const singlePaneHeaderToggleDetailsOrder = 10;
let SinglePaneDetailsStrategy = class extends SinglePaneLayoutStrategy {
  constructor(ctx, _layoutService) {
    super(ctx);
    this._layoutService = _layoutService;
    this._register(this._registerToggleDetailsAction());
  }
  /** Toggle the detail panel and return whether it is now visible. */
  toggleDetails() {
    const nowVisible = !this._layoutService.isVisible(Parts.AUXILIARYBAR_PART);
    this._layoutService.setPartHidden(!nowVisible, Parts.AUXILIARYBAR_PART);
    return nowVisible;
  }
  _registerToggleDetailsAction() {
    const that = this;
    return registerAction2(class extends Action2 {
      constructor() {
        super({
          id: TOGGLE_DETAILS_COMMAND_ID,
          title: localize2("toggleDetails", "Toggle Details"),
          icon: Codicon.listSelection,
          f1: false,
          toggled: AuxiliaryBarVisibleContext,
          keybinding: {
            weight: KeybindingWeight.SessionsContrib,
            primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyL,
            when: ContextKeyExpr.and(
              IsSessionsWindowContext,
              IsAuxiliaryWindowContext.toNegated(),
              SinglePaneLayoutEnabledContext
            )
          },
          menu: {
            id: Menus.SessionsEditorHeaderLayout,
            group: "navigation",
            order: singlePaneHeaderToggleDetailsOrder,
            // Not every tab type has a detail panel to show/hide (e.g. browser
            // and search tabs), so only surface the toggle for tab types that do.
            when: ContextKeyExpr.and(
              IsSessionsWindowContext,
              IsAuxiliaryWindowContext.toNegated(),
              IsTopRightEditorGroupContext,
              SinglePaneLayoutEnabledContext,
              MainEditorAreaVisibleContext,
              HasDockedDetailsContext
            )
          }
        });
      }
      run() {
        that.toggleDetails();
      }
    });
  }
};
SinglePaneDetailsStrategy = __decorateClass([
  __decorateParam(1, IAgentWorkbenchLayoutService)
], SinglePaneDetailsStrategy);
export {
  SinglePaneDetailsStrategy,
  TOGGLE_DETAILS_COMMAND_ID
};
