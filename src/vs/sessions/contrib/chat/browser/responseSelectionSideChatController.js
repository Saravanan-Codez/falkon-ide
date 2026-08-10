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
import { Disposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { clamp } from "../../../../base/common/numbers.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { editorSelectionBackground, editorSelectionForeground } from "../../../../platform/theme/common/colors/editorColors.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { FeedbackInputWidget } from "../../agentFeedback/browser/feedbackInputWidget.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { resolveResponseSelection } from "./responseSelectionResolver.js";
import { createAndSendSideChat } from "./sideChatOrchestration.js";
const selectionHighlightName = "chat-response-selection";
registerThemingParticipant((theme, collector) => {
  const background = theme.getColor(editorSelectionBackground);
  if (!background) {
    return;
  }
  const foreground = theme.getColor(editorSelectionForeground);
  collector.addRule(`::highlight(${selectionHighlightName}) {
		background-color: ${background};
		${foreground ? `color: ${foreground};` : ""}
	}`);
});
function getSelectionHighlight(targetWindow) {
  const registry = targetWindow.CSS?.highlights;
  if (!registry) {
    return void 0;
  }
  let highlight = registry.get(selectionHighlightName);
  if (!highlight) {
    highlight = new targetWindow.Highlight();
    registry.set(selectionHighlightName, highlight);
  }
  return highlight;
}
function getVisibleBoundingRect(range) {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  for (const rect of range.getClientRects()) {
    if (rect.width === 0 || rect.height === 0) {
      continue;
    }
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
    left = Math.min(left, rect.left);
  }
  if (bottom === Number.NEGATIVE_INFINITY) {
    const fallback = range.getBoundingClientRect();
    return fallback.width || fallback.height ? fallback : void 0;
  }
  return { top, bottom, left };
}
let ResponseSelectionSideChatController = class extends Disposable {
  constructor(_widget, _sessionsManagementService, _sessionsService, _logService, _notificationService) {
    super();
    this._widget = _widget;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    /** Pins the transcript while a selection or the question input is active. */
    this._autoScrollHold = this._register(new MutableDisposable());
    /** Bumped on a genuine chat navigation/force-dismiss so a stale submission's completion/error handler can no-op. */
    this._generation = 0;
    this._input = this._register(new FeedbackInputWidget({
      placeholder: localize("sessions.selectionSideChat.placeholder", "Ask Question"),
      ariaLabel: localize("sessions.selectionSideChat.ariaLabel", "Ask a question about the selected response text"),
      getMaxContentWidth: () => this._widget.domNode.clientWidth,
      primaryAction: {
        label: localize("sessions.selectionSideChat.ask", "Ask Question"),
        icon: Codicon.arrowUpCompact,
        keybindingLabel: localize("sessions.selectionSideChat.enter", "Enter")
      }
    }));
    this._widget.domNode.appendChild(this._input.domNode);
    this._register(this._input.onDidTriggerPrimary(() => this._submit()));
    this._register(dom.addStandardDisposableListener(this._input.inputElement, "keydown", (e) => {
      if (e.keyCode === KeyCode.Escape) {
        e.preventDefault();
        e.stopPropagation();
        this._dismiss();
        return;
      }
      if (e.keyCode === KeyCode.Enter) {
        if (e.browserEvent.isComposing || e.shiftKey) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this._submit();
      }
    }));
    this._register(dom.addStandardDisposableListener(this._input.inputElement, "keypress", (e) => {
      e.stopPropagation();
    }));
    this._register(dom.addStandardDisposableListener(this._input.inputElement, "input", () => {
      this._input.autoSize();
      this._input.updateActionEnabled();
    }));
    const window = dom.getWindow(this._widget.domNode);
    this._register(dom.addDisposableListener(window.document, "selectionchange", () => this._onSelectionChange()));
    this._register(this._widget.onDidScroll(() => this._reposition()));
    this._register(dom.addDisposableListener(this._widget.domNode, "scroll", () => this._reposition(), true));
    this._register(toDisposable(() => this._paintHighlight(void 0)));
  }
  /**
   * Tracks which chat the current transcript belongs to, for side-chat
   * creation. `ChatView` re-invokes this for the same chat on unrelated
   * observable changes, so only force-dismiss on a genuine resource change.
   */
  setChat(chat) {
    const changedChat = !this._chat || this._chat.resource.toString() !== chat.resource.toString();
    this._chat = chat;
    if (changedChat) {
      this._dismiss(true);
    }
  }
  _onSelectionChange() {
    this._updateAutoScrollHold();
    if (dom.isAncestorOfActiveElement(this._input.domNode)) {
      this._syncHighlight();
      return;
    }
    if (this._input.isBusy) {
      this._syncHighlight();
      return;
    }
    const resolved = resolveResponseSelection(this._widget);
    if (!resolved) {
      this._dismiss();
      return;
    }
    this._resolved = resolved;
    this._showFor();
  }
  /**
   * Pins the transcript while the user is working with a selection: a growing
   * response that scrolls itself to the bottom would otherwise drag the text
   * out from under the selection (and the affordance anchored to it). Covers
   * any selection in the transcript, not just ones that resolve to a single
   * response, since auto-scrolling mid-drag is disruptive either way.
   */
  _updateAutoScrollHold() {
    const shouldHold = !!this._resolved || this._hasTranscriptSelection();
    if (shouldHold) {
      this._autoScrollHold.value ??= this._widget.holdAutoScroll();
    } else {
      this._autoScrollHold.clear();
    }
  }
  _hasTranscriptSelection() {
    const selection = dom.getWindow(this._widget.domNode).getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) {
      return false;
    }
    const range = selection.getRangeAt(0);
    return this._widget.transcriptDomNode.contains(range.commonAncestorContainer);
  }
  /**
   * Keeps the captured selection visible. The native selection disappears as
   * soon as focus moves into the "Ask Question" input, so a CSS custom
   * highlight takes over painting the range for as long as the affordance is
   * open; while the native selection still covers it the browser paints it
   * and the highlight stays off so the two never stack.
   */
  _syncHighlight() {
    const range = this._resolved?.range;
    const nativeSelection = dom.getWindow(this._widget.domNode).getSelection();
    const paintedNatively = !!nativeSelection && !nativeSelection.isCollapsed && !!nativeSelection.toString().trim();
    this._paintHighlight(range && !paintedNatively ? range : void 0);
  }
  _paintHighlight(range) {
    if (this._paintedRange === range) {
      return;
    }
    const highlight = getSelectionHighlight(dom.getWindow(this._widget.domNode));
    if (!highlight) {
      return;
    }
    if (this._paintedRange) {
      highlight.delete(this._paintedRange);
    }
    if (range) {
      highlight.add(range);
    }
    this._paintedRange = range;
  }
  _showFor() {
    this._input.show();
    this._input.autoSize();
    this._input.updateActionEnabled();
    this._syncHighlight();
    this._reposition();
  }
  /**
   * Re-anchors the input to the (live) selection range. Called on every
   * transcript scroll so the overlay tracks the text it belongs to instead of
   * staying pinned where the selection used to be.
   */
  _reposition() {
    const resolved = this._resolved;
    if (!resolved) {
      return;
    }
    const selectionRect = getVisibleBoundingRect(resolved.range);
    if (!selectionRect) {
      this._dismiss();
      return;
    }
    this._input.show();
    const originRect = this._widget.domNode.getBoundingClientRect();
    const bounds = this._transcriptBounds();
    const gap = 4;
    const inputWidth = this._input.domNode.offsetWidth;
    const inputHeight = this._input.domNode.offsetHeight;
    const minLeft = bounds.left - originRect.left;
    const maxLeft = Math.max(minLeft, minLeft + bounds.width - inputWidth);
    const left = clamp(selectionRect.left - originRect.left, minLeft, maxLeft);
    const minTop = bounds.top - originRect.top;
    const maxTop = Math.max(minTop, minTop + bounds.height - inputHeight);
    let top = selectionRect.bottom - originRect.top + gap;
    if (top > maxTop) {
      const aboveTop = selectionRect.top - originRect.top - inputHeight - gap;
      top = aboveTop >= minTop ? aboveTop : maxTop;
    }
    top = clamp(top, minTop, maxTop);
    this._input.domNode.style.top = `${top}px`;
    this._input.domNode.style.left = `${left}px`;
  }
  /**
   * Box the overlay is confined to, in viewport coordinates: the scrollable
   * transcript, further clipped to the window so it can never render out of
   * sight on a small window.
   */
  _transcriptBounds() {
    const rect = this._widget.transcriptDomNode.getBoundingClientRect();
    const viewport = dom.getWindow(this._widget.domNode);
    const top = Math.max(rect.top, 0);
    const left = Math.max(rect.left, 0);
    const bottom = Math.min(rect.top + rect.height, viewport.innerHeight);
    const right = Math.min(rect.left + rect.width, viewport.innerWidth);
    return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }
  /**
   * Dismisses the input. While a submission is pending (`_input.isBusy`),
   * only a genuine view change (`force`, from {@link setChat}) may dismiss
   * it — outside interactions like Escape or selection invalidation must not
   * race the in-flight create/open/send.
   */
  _dismiss(force = false) {
    if (!force && this._input.isBusy) {
      return;
    }
    if (force) {
      this._generation++;
    }
    const hadFocus = dom.isAncestorOfActiveElement(this._input.domNode);
    this._resolved = void 0;
    this._paintHighlight(void 0);
    this._updateAutoScrollHold();
    this._input.setBusy(false);
    this._input.hide();
    this._input.clearInput();
    if (hadFocus) {
      this._widget.focusResponseItem(true);
    }
  }
  _submit() {
    const resolved = this._resolved;
    const chat = this._chat;
    const query = this._input.inputElement.value.trim();
    if (!resolved || !chat || !query || this._input.isBusy) {
      return;
    }
    const found = this._sessionsManagementService.getSessionForChatResource(chat.resource);
    if (!found) {
      this._notificationService.warn(localize("sessions.selectionSideChat.sessionUnavailable", "A side chat cannot be created from this conversation."));
      return;
    }
    const { session } = found;
    if (session.status.get() === SessionStatus.Untitled || session.isArchived.get() || !session.capabilities.get().supportsSideChat) {
      this._notificationService.warn(localize("sessions.selectionSideChat.unsupported", "This conversation does not support side chats."));
      return;
    }
    this._input.setBusy(true, localize("sessions.selectionSideChat.busy", "Asking question\u2026"));
    const generation = this._generation;
    createAndSendSideChat(this._sessionsManagementService, this._sessionsService, session, chat.resource, resolved.response.requestId, query, { text: resolved.text }).then(() => {
      if (this._generation !== generation) {
        return;
      }
      this._input.setBusy(false);
    }).catch((err) => {
      this._logService.error("[selectionSideChat] Failed to create side chat", err);
      if (this._generation !== generation) {
        return;
      }
      this._notificationService.error(localize("sessions.selectionSideChat.createFailed", "The side chat could not be created."));
      this._input.setBusy(false);
      this._input.inputElement.value = query;
      this._input.autoSize();
      this._input.updateActionEnabled();
      this._input.inputElement.focus();
    });
  }
};
ResponseSelectionSideChatController = __decorateClass([
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, ILogService),
  __decorateParam(4, INotificationService)
], ResponseSelectionSideChatController);
export {
  ResponseSelectionSideChatController
};
