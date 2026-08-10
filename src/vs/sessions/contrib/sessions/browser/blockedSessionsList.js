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
import "./media/blockedSessionsList.css";
import { $, append } from "../../../../base/browser/dom.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { combinedDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Menus } from "../../../browser/menus.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { SessionsFlatList, SessionItemStatusContext } from "./views/sessionsList.js";
const IGNORE_INPUT_NEEDED_COMMAND_ID = "sessions.blockedSessions.ignoreInputNeeded";
const IGNORE_CI_FAILURE_COMMAND_ID = "sessions.blockedSessions.ignoreCIFailure";
function registerBlockedSessionsItemActions() {
  return combinedDisposable(
    MenuRegistry.appendMenuItem(Menus.BlockedSessionsItem, {
      command: {
        id: IGNORE_INPUT_NEEDED_COMMAND_ID,
        title: localize("ignoreInputNeeded", "Ignore Input Needed"),
        icon: Codicon.bellSlash
      },
      group: "navigation",
      order: 1,
      when: ContextKeyExpr.equals(SessionItemStatusContext.key, SessionStatus.NeedsInput)
    }),
    MenuRegistry.appendMenuItem(Menus.BlockedSessionsItem, {
      command: {
        id: IGNORE_CI_FAILURE_COMMAND_ID,
        title: localize("ignoreCIFailure", "Ignore CI Failure"),
        icon: Codicon.bellSlash
      },
      group: "navigation",
      order: 1,
      when: ContextKeyExpr.notEquals(SessionItemStatusContext.key, SessionStatus.NeedsInput)
    })
  );
}
const BLOCKED_LIST_WIDTH = 360;
const BLOCKED_LIST_MAX_VISIBLE_ROWS = 8;
const BLOCKED_LIST_APPROVAL_ROW_MAX_LINES = 5;
let BlockedSessionsList = class extends Disposable {
  constructor(container, options, instantiationService) {
    super();
    this._onDidChangeContentHeight = this._register(new Emitter());
    /** Fires when the list resizes and the host should re-layout its container. */
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this._onDidApproveSession = this._register(new Emitter());
    /** Fires when a session's pending action is approved from its "Allow" button. */
    this.onDidApproveSession = this._onDidApproveSession.event;
    this._width = options.width ?? BLOCKED_LIST_WIDTH;
    const element = append(container, $(".agent-sessions-blocked-list"));
    const header = append(element, $(".agent-sessions-blocked-list-header"));
    const title = append(header, $(".agent-sessions-blocked-list-title"));
    title.textContent = localize("sessionsRequiringInput", "Sessions requiring input");
    const headerActions = append(header, $(".agent-sessions-blocked-list-header-actions"));
    this._register(instantiationService.createInstance(MenuWorkbenchToolBar, headerActions, Menus.BlockedSessionsHeader, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      menuOptions: {
        arg: {
          showAllSessions: options.onShowAllSessions,
          ignoreAllSessions: () => {
            options.onIgnoreAllSessions();
            status(localize("allInputNeededIgnored", "All current blocked sessions were ignored."));
          },
          close: options.onClose
        }
      },
      toolbarOptions: { primaryGroup: () => true },
      telemetrySource: "blockedSessionsList.header"
    }));
    this._rowsContainer = append(element, $(".agent-sessions-blocked-list-rows"));
    this._list = this._register(instantiationService.createInstance(SessionsFlatList, this._rowsContainer, {
      showSessionHover: true,
      onSessionOpen: options.onSessionOpen,
      approvalModel: options.approvalModel,
      ciFixModel: options.ciFixModel,
      approvalRowMaxLines: BLOCKED_LIST_APPROVAL_ROW_MAX_LINES,
      toolbarMenuId: Menus.BlockedSessionsItem,
      onToolbarAction: (action, session) => {
        if (action.id !== IGNORE_INPUT_NEEDED_COMMAND_ID && action.id !== IGNORE_CI_FAILURE_COMMAND_ID) {
          return false;
        }
        options.onIgnoreSession(session);
        status(action.id === IGNORE_INPUT_NEEDED_COMMAND_ID ? localize("inputNeededIgnored", "Input needed ignored until this session needs input again.") : localize("ciFailureIgnored", "CI failure ignored until this session has another CI failure."));
        return true;
      }
    }));
    this._register(this._list.onDidChangeContentHeight(() => {
      this._layout();
      this._onDidChangeContentHeight.fire();
    }));
    this._register(this._list.onDidApproveSession((approved) => this._onDidApproveSession.fire(approved)));
  }
  /** Replace the sessions shown in the list and resize to fit their content. */
  setSessions(sessions) {
    this._list.setSessions(sessions);
    this._layout();
  }
  /** Move keyboard focus into the list. */
  focus() {
    this._list.focus();
  }
  /**
   * Update the list width (e.g. when the anchoring widget reflows as the window
   * resizes) and re-layout to the new width.
   */
  setWidth(width) {
    if (this._width === width) {
      return;
    }
    this._width = width;
    this._layout();
  }
  _layout() {
    const maxHeight = BLOCKED_LIST_MAX_VISIBLE_ROWS * this._list.getRowHeight();
    const height = Math.min(this._list.getContentHeight(), maxHeight);
    this._rowsContainer.style.width = `${this._width}px`;
    this._rowsContainer.style.height = `${height}px`;
    this._list.layout(height, this._width);
  }
};
BlockedSessionsList = __decorateClass([
  __decorateParam(2, IInstantiationService)
], BlockedSessionsList);
export {
  BlockedSessionsList,
  IGNORE_CI_FAILURE_COMMAND_ID,
  IGNORE_INPUT_NEEDED_COMMAND_ID,
  registerBlockedSessionsItemActions
};
