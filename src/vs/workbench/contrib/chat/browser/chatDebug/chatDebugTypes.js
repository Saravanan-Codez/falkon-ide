import * as DOM from "../../../../../base/browser/dom.js";
import { BreadcrumbsItem } from "../../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js";
import { RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
const $ = DOM.$;
var ViewState = /* @__PURE__ */ ((ViewState2) => {
  ViewState2["Home"] = "home";
  ViewState2["Overview"] = "overview";
  ViewState2["Logs"] = "logs";
  ViewState2["FlowChart"] = "flowchart";
  ViewState2["CacheExplorer"] = "cache";
  ViewState2["WireLog"] = "wirelog";
  return ViewState2;
})(ViewState || {});
var LogsViewMode = /* @__PURE__ */ ((LogsViewMode2) => {
  LogsViewMode2["List"] = "list";
  LogsViewMode2["Tree"] = "tree";
  return LogsViewMode2;
})(LogsViewMode || {});
const CHAT_DEBUG_FILTER_ACTIVE = new RawContextKey("chatDebugFilterActive", false);
const CHAT_DEBUG_ACTIVE_SESSION_IS_AGENT_HOST = new RawContextKey("chatDebug.activeSessionIsAgentHost", false);
const CHAT_DEBUG_KIND_TOOL_CALL = new RawContextKey("chatDebug.kindToolCall", true);
const CHAT_DEBUG_KIND_MODEL_TURN = new RawContextKey("chatDebug.kindModelTurn", true);
const CHAT_DEBUG_KIND_PROMPT_DISCOVERY = new RawContextKey("chatDebug.kindPromptDiscovery", true);
const CHAT_DEBUG_KIND_SUBAGENT = new RawContextKey("chatDebug.kindSubagent", true);
const CHAT_DEBUG_CMD_TOGGLE_TOOL_CALL = "chatDebug.filter.toggleToolCall";
const CHAT_DEBUG_CMD_TOGGLE_MODEL_TURN = "chatDebug.filter.toggleModelTurn";
const CHAT_DEBUG_CMD_TOGGLE_PROMPT_DISCOVERY = "chatDebug.filter.togglePromptDiscovery";
const CHAT_DEBUG_CMD_TOGGLE_SUBAGENT = "chatDebug.filter.toggleSubagent";
class TextBreadcrumbItem extends BreadcrumbsItem {
  constructor(_text, _isLink = false) {
    super();
    this._text = _text;
    this._isLink = _isLink;
  }
  equals(other) {
    return other instanceof TextBreadcrumbItem && other._text === this._text;
  }
  dispose() {
  }
  render(container) {
    container.classList.add("chat-debug-breadcrumb-item");
    if (this._isLink) {
      container.classList.add("chat-debug-breadcrumb-item-link");
    }
    DOM.append(container, $("span.chat-debug-breadcrumb-item-label", void 0, this._text));
  }
}
function setupBreadcrumbKeyboardNavigation(container, widget) {
  return DOM.addDisposableListener(container, DOM.EventType.KEY_DOWN, (e) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        widget.focusPrev();
        break;
      case "ArrowRight":
        e.preventDefault();
        widget.focusNext();
        break;
      case "Home":
        e.preventDefault();
        widget.setFocused(widget.getItems()[0]);
        break;
      case "End": {
        e.preventDefault();
        const items = widget.getItems();
        widget.setFocused(items[items.length - 1]);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        const focused = widget.getFocused();
        if (focused) {
          widget.setSelection(focused);
        }
        break;
      }
    }
  });
}
export {
  CHAT_DEBUG_ACTIVE_SESSION_IS_AGENT_HOST,
  CHAT_DEBUG_CMD_TOGGLE_MODEL_TURN,
  CHAT_DEBUG_CMD_TOGGLE_PROMPT_DISCOVERY,
  CHAT_DEBUG_CMD_TOGGLE_SUBAGENT,
  CHAT_DEBUG_CMD_TOGGLE_TOOL_CALL,
  CHAT_DEBUG_FILTER_ACTIVE,
  CHAT_DEBUG_KIND_MODEL_TURN,
  CHAT_DEBUG_KIND_PROMPT_DISCOVERY,
  CHAT_DEBUG_KIND_SUBAGENT,
  CHAT_DEBUG_KIND_TOOL_CALL,
  LogsViewMode,
  TextBreadcrumbItem,
  ViewState,
  setupBreadcrumbKeyboardNavigation
};
