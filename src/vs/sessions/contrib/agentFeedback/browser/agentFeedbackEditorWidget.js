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
import "./media/agentFeedbackEditorWidget.css";
import { $, addDisposableListener, addStandardDisposableListener, clearNode, getTotalWidth, isHTMLElement } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Action } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { overviewRulerRangeHighlight } from "../../../../editor/common/core/editorColorRegistry.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { OverviewRulerLane } from "../../../../editor/common/model.js";
import * as nls from "../../../../nls.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { ICodeReviewService } from "../../codeReview/browser/codeReviewService.js";
import { createAgentFeedbackContext } from "./agentFeedbackEditorUtils.js";
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
import { SessionEditorCommentSource, toSessionEditorCommentId } from "./sessionEditorComments.js";
function isTextInputTarget(target) {
  return isHTMLElement(target) && target.closest("textarea, input") !== null;
}
var ComposerKind = /* @__PURE__ */ ((ComposerKind2) => {
  ComposerKind2[ComposerKind2["Edit"] = 0] = "Edit";
  ComposerKind2[ComposerKind2["Reply"] = 1] = "Reply";
  return ComposerKind2;
})(ComposerKind || {});
let AgentFeedbackEditorWidget = class extends Disposable {
  constructor(_editor, _commentItems, _sessionResource, _composerDraftState, _agentFeedbackService, _codeReviewService, _markdownRendererService, _codeEditorService) {
    super();
    this._editor = _editor;
    this._commentItems = _commentItems;
    this._sessionResource = _sessionResource;
    this._composerDraftState = _composerDraftState;
    this._agentFeedbackService = _agentFeedbackService;
    this._codeReviewService = _codeReviewService;
    this._markdownRendererService = _markdownRendererService;
    this._codeEditorService = _codeEditorService;
    this._id = `agent-feedback-widget-${AgentFeedbackEditorWidget._idPool++}`;
    this._itemElements = /* @__PURE__ */ new Map();
    this._activeReplyInputs = /* @__PURE__ */ new Map();
    this._activeEditInputs = /* @__PURE__ */ new Map();
    this._actionBarElements = /* @__PURE__ */ new Map();
    this._position = null;
    this._isExpanded = false;
    this._disposed = false;
    this._startLineNumber = 1;
    this._eventStore = this._register(new DisposableStore());
    this._onDidExpand = this._register(new Emitter());
    this.onDidExpand = this._onDidExpand.event;
    this._rangeHighlightDecoration = this._editor.createDecorationsCollection();
    this._domNode = $("div.agent-feedback-widget");
    this._domNode.classList.add("collapsed");
    this._domNode.tabIndex = -1;
    this._headerNode = $("div.agent-feedback-widget-header");
    const commentIcon = renderIcon(Codicon.comment);
    commentIcon.setAttribute("aria-hidden", "true");
    this._headerNode.appendChild(commentIcon);
    this._titleNode = $("span.agent-feedback-widget-title");
    this._updateTitle();
    this._headerNode.appendChild(this._titleNode);
    this._headerNode.appendChild($("span.agent-feedback-widget-spacer"));
    this._toggleButton = $("div.agent-feedback-widget-toggle");
    this._updateToggleButton();
    this._headerNode.appendChild(this._toggleButton);
    this._domNode.appendChild(this._headerNode);
    this._bodyNode = $("div.agent-feedback-widget-body");
    this._bodyNode.classList.add("collapsed");
    this._buildFeedbackItems();
    this._domNode.appendChild(this._bodyNode);
    const arrow = $("div.agent-feedback-widget-arrow");
    this._domNode.appendChild(arrow);
    this._setupEventHandlers();
    this._domNode.classList.add("visible");
    this._editor.addOverlayWidget(this);
  }
  static {
    this._idPool = 0;
  }
  static {
    /**
     * Estimated widget width in px used while the widget DOM node has not been
     * laid out yet. Matches the `max-width` of `.agent-feedback-widget` so we
     * reserve enough scroll space up front; the real width replaces it once the
     * node is rendered.
     */
    this._estimatedWidgetWidth = 280;
  }
  _setupEventHandlers() {
    this._eventStore.add(addDisposableListener(this._toggleButton, "click", (e) => {
      e.stopPropagation();
      this._toggleExpanded();
    }));
    this._eventStore.add(addDisposableListener(this._headerNode, "click", () => {
      this._toggleExpanded();
    }));
    this._eventStore.add(addStandardDisposableListener(this._domNode, "keydown", (e) => {
      if (e.keyCode !== KeyCode.Escape || !this._cancelActiveInputs()) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }));
  }
  /**
   * Closes every open edit / reply composer. Returns whether any was open.
   */
  _cancelActiveInputs() {
    const cancels = [...this._activeEditInputs.values(), ...this._activeReplyInputs.values()].map((input) => input.cancel);
    for (const cancel of cancels) {
      cancel();
    }
    return cancels.length > 0;
  }
  _setDraft(commentId, kind, text) {
    this._composerDraftState?.drafts.set(commentId, { kind, text });
  }
  _clearDraft(commentId) {
    if (!this._composerDraftState) {
      return;
    }
    this._composerDraftState.drafts.delete(commentId);
    if (this._composerDraftState.focusedCommentId === commentId) {
      this._composerDraftState.focusedCommentId = void 0;
    }
  }
  /**
   * Whether a composer should take focus: always for an explicit user action,
   * and for a restored draft only if it had focus when the widget was rebuilt.
   */
  _shouldFocusComposer(commentId, restoredText) {
    return restoredText === void 0 || this._composerDraftState?.focusedCommentId === commentId;
  }
  _focusComposer(textarea) {
    this._composerToFocus = textarea;
    if (textarea.isConnected) {
      this.restoreComposerFocus();
    }
  }
  _toggleExpanded() {
    if (this._isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }
  _updateTitle() {
    const count = this._commentItems.length;
    if (count === 1) {
      this._titleNode.textContent = this._commentItems[0].text;
    } else {
      this._titleNode.textContent = nls.localize("nComments", "{0} comments", count);
    }
  }
  _updateToggleButton() {
    clearNode(this._toggleButton);
    if (this._isExpanded) {
      this._toggleButton.appendChild(renderIcon(Codicon.chevronUp));
      this._toggleButton.title = nls.localize("collapse", "Collapse");
    } else {
      this._toggleButton.appendChild(renderIcon(Codicon.chevronDown));
      this._toggleButton.title = nls.localize("expand", "Expand");
    }
  }
  _buildFeedbackItems() {
    clearNode(this._bodyNode);
    this._itemElements.clear();
    this._activeReplyInputs.clear();
    this._activeEditInputs.clear();
    this._actionBarElements.clear();
    for (const comment of this._commentItems) {
      const item = $("div.agent-feedback-widget-item");
      item.classList.add(`agent-feedback-widget-item-${comment.source}`);
      if (comment.suggestion) {
        item.classList.add("agent-feedback-widget-item-suggestion");
      }
      this._itemElements.set(comment.id, item);
      const itemHeader = $("div.agent-feedback-widget-item-header");
      const itemMeta = $("div.agent-feedback-widget-item-meta");
      const lineInfo = $("span.agent-feedback-widget-line-info");
      if (comment.range.startLineNumber === comment.range.endLineNumber) {
        lineInfo.textContent = nls.localize("lineNumber", "Line {0}", comment.range.startLineNumber);
      } else {
        lineInfo.textContent = nls.localize("lineRange", "Lines {0}-{1}", comment.range.startLineNumber, comment.range.endLineNumber);
      }
      itemMeta.appendChild(lineInfo);
      const typeLabel = this._getTypeLabel(comment);
      if (typeLabel) {
        const typeBadge = $("span.agent-feedback-widget-item-type");
        typeBadge.textContent = typeLabel;
        itemMeta.appendChild(typeBadge);
      }
      itemHeader.appendChild(itemMeta);
      const actionBarContainer = $("div.agent-feedback-widget-item-actions");
      const actionBar = this._eventStore.add(new ActionBar(actionBarContainer));
      const itemActions = { editAction: void 0, removeAction: void 0, addReplyAction: void 0 };
      itemActions.addReplyAction = this._eventStore.add(new Action(
        "agentFeedback.widget.addReply",
        nls.localize("addToComment", "Add to Comment"),
        ThemeIcon.asClassName(Codicon.commentDiscussion),
        true,
        () => {
          this._startAddingReply(comment, item, itemActions);
        }
      ));
      actionBar.push(itemActions.addReplyAction, { icon: true, label: false });
      itemActions.editAction = this._eventStore.add(new Action(
        "agentFeedback.widget.edit",
        nls.localize("editComment", "Edit"),
        ThemeIcon.asClassName(Codicon.edit),
        true,
        () => {
          this._startEditing(comment, text, itemActions);
        }
      ));
      actionBar.push(itemActions.editAction, { icon: true, label: false });
      const showActionButtonsBar = comment.canConvertToAgentFeedback || comment.source === SessionEditorCommentSource.AgentFeedback && comment.state === AgentFeedbackState.Created;
      itemActions.removeAction = this._eventStore.add(new Action(
        "agentFeedback.widget.remove",
        nls.localize("removeComment", "Remove"),
        ThemeIcon.asClassName(Codicon.close),
        true,
        () => this._removeComment(comment)
      ));
      if (!showActionButtonsBar) {
        actionBar.push(itemActions.removeAction, { icon: true, label: false });
      }
      itemHeader.appendChild(actionBarContainer);
      item.appendChild(itemHeader);
      const text = $("div.agent-feedback-widget-text");
      const rendered = this._markdownRendererService.render(new MarkdownString(comment.text));
      this._eventStore.add(rendered);
      text.appendChild(rendered.element);
      item.appendChild(text);
      if (comment.suggestion?.edits.length) {
        item.appendChild(this._renderSuggestion(comment));
      }
      if (comment.replies?.length) {
        item.appendChild(this._renderReplies(comment.replies));
      }
      if (showActionButtonsBar) {
        this._renderActionButtons(comment, item);
      }
      this._eventStore.add(addDisposableListener(item, "mouseenter", () => {
        this._highlightRange(comment);
      }));
      this._eventStore.add(addDisposableListener(item, "mouseleave", () => {
        this._rangeHighlightDecoration.clear();
      }));
      this._eventStore.add(addDisposableListener(item, "click", (e) => {
        const target = e.target;
        if (target?.closest(".action-bar")) {
          return;
        }
        if (target?.closest(".agent-feedback-widget-add-reply")) {
          return;
        }
        if (isTextInputTarget(target)) {
          return;
        }
        if (target?.closest(".agent-feedback-widget-text, .agent-feedback-widget-suggestion-text, .agent-feedback-widget-reply-text")) {
          const selection = this._domNode.ownerDocument.defaultView?.getSelection();
          if (selection && !selection.isCollapsed && this._domNode.contains(selection.anchorNode)) {
            return;
          }
        }
        this.focusFeedback(comment.id);
        this._agentFeedbackService.setNavigationAnchor(this._sessionResource, comment.id);
        this._revealComment(comment);
      }));
      const onSelectableMousedown = (e) => {
        const target = e.target;
        if (isTextInputTarget(target)) {
          return;
        }
        if (target?.closest(".agent-feedback-widget-text, .agent-feedback-widget-suggestion-text, .agent-feedback-widget-reply-text")) {
          this._domNode.focus({ preventScroll: true });
        }
      };
      this._eventStore.add(addDisposableListener(item, "mousedown", onSelectableMousedown));
      this._bodyNode.appendChild(item);
      const draft = this._composerDraftState?.drafts.get(comment.id);
      if (draft?.kind === 1 /* Reply */) {
        this._startAddingReply(comment, item, itemActions, draft.text);
      } else if (draft?.kind === 0 /* Edit */) {
        this._startEditing(comment, text, itemActions, draft.text);
      }
    }
  }
  _getTypeLabel(comment) {
    switch (comment.kind) {
      case AgentFeedbackKind.PRReview:
        return nls.localize("prReviewComment", "PR Review");
      case AgentFeedbackKind.AgentReview:
        return nls.localize("agentReviewComment", "Agent Review");
      default:
        return void 0;
    }
  }
  _renderSuggestion(comment) {
    const suggestionNode = $("div.agent-feedback-widget-suggestion");
    for (const edit of comment.suggestion?.edits ?? []) {
      const editNode = $("div.agent-feedback-widget-suggestion-edit");
      const header = $("div.agent-feedback-widget-suggestion-header");
      if (edit.range.startLineNumber === edit.range.endLineNumber) {
        header.textContent = nls.localize("suggestedChangeLine", "Suggested Change \u2022 Line {0}", edit.range.startLineNumber);
      } else {
        header.textContent = nls.localize("suggestedChangeLines", "Suggested Change \u2022 Lines {0}-{1}", edit.range.startLineNumber, edit.range.endLineNumber);
      }
      editNode.appendChild(header);
      const newText = $("pre.agent-feedback-widget-suggestion-text");
      newText.textContent = edit.newText;
      editNode.appendChild(newText);
      suggestionNode.appendChild(editNode);
    }
    return suggestionNode;
  }
  _renderReplies(replies) {
    const repliesNode = $("div.agent-feedback-widget-replies");
    for (const reply of replies) {
      const replyNode = $("div.agent-feedback-widget-reply");
      const replyText = $("div.agent-feedback-widget-reply-text");
      const rendered = this._markdownRendererService.render(new MarkdownString(reply));
      this._eventStore.add(rendered);
      replyText.appendChild(rendered.element);
      replyNode.appendChild(replyText);
      repliesNode.appendChild(replyNode);
    }
    return repliesNode;
  }
  /**
   * Renders the Accept / Remove button bar shown at the bottom of a
   * `created` agent feedback comment or a PR review comment. Clicking either
   * button performs the action and removes the bar. For PR review comments
   * "Accept" converts the comment into agent feedback; for agent feedback it
   * marks the comment as accepted.
   */
  _renderActionButtons(comment, item) {
    const buttonBar = $("div.agent-feedback-widget-actions-bar");
    const buttonStore = new DisposableStore();
    this._eventStore.add(buttonStore);
    buttonStore.add(addDisposableListener(buttonBar, "click", (e) => e.stopPropagation()));
    const dismiss = () => {
      buttonStore.dispose();
      buttonBar.remove();
      this._actionBarElements.delete(comment.id);
      this._domNode.focus({ preventScroll: true });
      this._editor.layoutOverlayWidget(this);
    };
    const isPRComment = comment.source === SessionEditorCommentSource.PRReview;
    const acceptTooltip = isPRComment ? nls.localize("acceptPRFeedbackTooltip", "Share PR comment with agent") : nls.localize("acceptAgentFeedbackTooltip", "Share comment with agent");
    const deleteTooltip = isPRComment ? nls.localize("deletePRFeedbackTooltip", "Remove and mark as resolved on GitHub") : nls.localize("deleteAgentFeedbackTooltip", "Remove agent comment");
    const acceptButton = buttonStore.add(new Button(buttonBar, {
      title: acceptTooltip,
      buttonBackground: "var(--vscode-charts-purple)",
      buttonHoverBackground: "color-mix(in srgb, var(--vscode-charts-purple) 85%, var(--vscode-foreground))",
      buttonForeground: "var(--vscode-button-foreground)",
      buttonBorder: "var(--vscode-charts-purple)"
    }));
    acceptButton.label = nls.localize("acceptFeedbackButton", "Accept");
    buttonStore.add(acceptButton.onDidClick(() => {
      if (comment.canConvertToAgentFeedback) {
        this._convertToAgentFeedback(comment);
      } else {
        this._acceptFeedback(comment);
      }
      dismiss();
    }));
    const deleteButton = buttonStore.add(new Button(buttonBar, {
      title: deleteTooltip,
      secondary: true,
      buttonSecondaryBackground: "var(--vscode-button-secondaryBackground)",
      buttonSecondaryHoverBackground: "var(--vscode-button-secondaryHoverBackground)",
      buttonSecondaryForeground: "var(--vscode-button-secondaryForeground)",
      buttonSecondaryBorder: "var(--vscode-button-secondaryBorder)"
    }));
    deleteButton.label = nls.localize("deleteFeedbackButton", "Delete");
    buttonStore.add(deleteButton.onDidClick(() => {
      this._removeComment(comment);
      dismiss();
    }));
    item.appendChild(buttonBar);
    this._actionBarElements.set(comment.id, buttonBar);
  }
  _removeComment(comment) {
    if (comment.source === SessionEditorCommentSource.PRReview) {
      this._codeReviewService.resolvePRReviewThread(this._sessionResource, comment.sourceId);
      return;
    }
    this._agentFeedbackService.removeFeedback(this._sessionResource, comment.sourceId);
  }
  _startEditing(comment, textContainer, actions, restoredText) {
    const existing = this._activeEditInputs.get(comment.id);
    if (existing) {
      existing.textarea.focus();
      return;
    }
    actions.editAction.enabled = false;
    actions.removeAction.enabled = false;
    actions.addReplyAction.enabled = false;
    const editStore = new DisposableStore();
    this._eventStore.add(editStore);
    clearNode(textContainer);
    textContainer.classList.add("editing");
    const textarea = $("textarea.agent-feedback-widget-edit-textarea");
    textarea.value = restoredText ?? comment.text;
    textarea.rows = 1;
    textContainer.appendChild(textarea);
    this._activeEditInputs.set(comment.id, {
      textarea,
      cancel: () => this._stopEditing(comment, textContainer, editStore, actions)
    });
    this._setDraft(comment.id, 0 /* Edit */, textarea.value);
    const autoSize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
      this._editor.layoutOverlayWidget(this);
    };
    autoSize();
    editStore.add(addDisposableListener(textarea, "input", () => {
      this._setDraft(comment.id, 0 /* Edit */, textarea.value);
      autoSize();
    }));
    editStore.add(addStandardDisposableListener(textarea, "keydown", (e) => {
      if (e.keyCode === KeyCode.Enter && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const newText = textarea.value.trim();
        if (newText) {
          this._clearDraft(comment.id);
          this._saveEdit(comment, newText);
        } else {
          this._stopEditing(comment, textContainer, editStore, actions);
        }
      } else if (e.keyCode === KeyCode.Escape) {
        e.preventDefault();
        e.stopPropagation();
        this._stopEditing(comment, textContainer, editStore, actions);
      }
    }));
    if (this._shouldFocusComposer(comment.id, restoredText)) {
      this._focusComposer(textarea);
    }
  }
  _startAddingReply(comment, itemNode, actions, restoredText) {
    const existing = this._activeReplyInputs.get(comment.id);
    if (existing) {
      existing.textarea.focus();
      return;
    }
    actions.editAction.enabled = false;
    actions.removeAction.enabled = false;
    actions.addReplyAction.enabled = false;
    const replyStore = new DisposableStore();
    this._eventStore.add(replyStore);
    const replyContainer = $("div.agent-feedback-widget-add-reply");
    const textarea = $("textarea.agent-feedback-widget-edit-textarea");
    textarea.placeholder = nls.localize("addReplyPlaceholder", "Add a comment\u2026");
    textarea.rows = 1;
    if (restoredText !== void 0) {
      textarea.value = restoredText;
    }
    replyContainer.appendChild(textarea);
    const actionsBar = this._actionBarElements.get(comment.id);
    if (actionsBar) {
      itemNode.insertBefore(replyContainer, actionsBar);
    } else {
      itemNode.appendChild(replyContainer);
    }
    this._activeReplyInputs.set(comment.id, { textarea, cancel: () => cleanup() });
    this._setDraft(comment.id, 1 /* Reply */, textarea.value);
    const autoSize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
      this._editor.layoutOverlayWidget(this);
    };
    autoSize();
    replyStore.add(addDisposableListener(textarea, "input", () => {
      this._setDraft(comment.id, 1 /* Reply */, textarea.value);
      autoSize();
    }));
    const cleanup = () => {
      replyStore.dispose();
      actions.editAction.enabled = true;
      actions.removeAction.enabled = true;
      actions.addReplyAction.enabled = true;
      this._activeReplyInputs.delete(comment.id);
      replyContainer.remove();
      this._clearDraft(comment.id);
      this._editor.layoutOverlayWidget(this);
    };
    replyStore.add(addStandardDisposableListener(textarea, "keydown", (e) => {
      if (e.keyCode === KeyCode.Enter && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const newReply = textarea.value.trim();
        if (newReply) {
          this._clearDraft(comment.id);
          this._saveReply(comment, newReply);
        } else {
          cleanup();
        }
      } else if (e.keyCode === KeyCode.Escape) {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      }
    }));
    if (this._shouldFocusComposer(comment.id, restoredText)) {
      this._focusComposer(textarea);
    }
  }
  /**
   * Focuses the composer restored from a draft, if any. Must be called once the
   * widget is in the DOM — focusing a detached element has no effect.
   */
  restoreComposerFocus() {
    const textarea = this._composerToFocus;
    this._composerToFocus = void 0;
    if (!textarea) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
  _saveReply(comment, replyText) {
    if (comment.source === SessionEditorCommentSource.AgentFeedback) {
      this._agentFeedbackService.addReply(this._sessionResource, comment.sourceId, replyText);
      return;
    }
    if (!comment.canConvertToAgentFeedback) {
      return;
    }
    const feedback = this._agentFeedbackService.addFeedback(
      this._sessionResource,
      comment.resourceUri,
      comment.range,
      comment.text,
      comment.suggestion,
      createAgentFeedbackContext(this._editor, this._codeEditorService, comment.resourceUri, comment.range),
      comment.sourceId,
      AgentFeedbackKind.PRReview
    );
    this._agentFeedbackService.addReply(this._sessionResource, feedback.id, replyText);
    this._agentFeedbackService.setNavigationAnchor(this._sessionResource, toSessionEditorCommentId(SessionEditorCommentSource.AgentFeedback, feedback.id));
    this._codeReviewService.markPRReviewCommentConverted(this._sessionResource, comment.sourceId);
  }
  _saveEdit(comment, newText) {
    if (comment.source === SessionEditorCommentSource.AgentFeedback) {
      this._agentFeedbackService.updateFeedback(this._sessionResource, comment.sourceId, newText);
    } else {
      this._convertToAgentFeedbackWithText(comment, newText);
    }
  }
  _stopEditing(comment, textContainer, editStore, actions) {
    editStore.dispose();
    this._activeEditInputs.delete(comment.id);
    this._clearDraft(comment.id);
    actions.editAction.enabled = true;
    actions.removeAction.enabled = true;
    actions.addReplyAction.enabled = true;
    textContainer.classList.remove("editing");
    clearNode(textContainer);
    const rendered = this._markdownRendererService.render(new MarkdownString(comment.text));
    this._eventStore.add(rendered);
    textContainer.appendChild(rendered.element);
    this._editor.layoutOverlayWidget(this);
  }
  _convertToAgentFeedback(comment) {
    this._convertToAgentFeedbackWithText(comment, comment.text);
  }
  /**
   * Accept a Created agent feedback item so it becomes submittable.
   */
  _acceptFeedback(comment) {
    if (comment.source !== SessionEditorCommentSource.AgentFeedback) {
      return;
    }
    this._agentFeedbackService.acceptFeedback(this._sessionResource, comment.sourceId);
    this._agentFeedbackService.setNavigationAnchor(this._sessionResource, comment.id);
  }
  /**
   * Converts a non-agent-feedback comment into an agent feedback item, optionally with edited text.
   */
  _convertToAgentFeedbackWithText(comment, text) {
    if (!comment.canConvertToAgentFeedback) {
      return;
    }
    const feedback = this._agentFeedbackService.addFeedback(
      this._sessionResource,
      comment.resourceUri,
      comment.range,
      text,
      comment.suggestion,
      createAgentFeedbackContext(this._editor, this._codeEditorService, comment.resourceUri, comment.range),
      comment.sourceId,
      AgentFeedbackKind.PRReview
    );
    this._agentFeedbackService.setNavigationAnchor(this._sessionResource, toSessionEditorCommentId(SessionEditorCommentSource.AgentFeedback, feedback.id));
    this._codeReviewService.markPRReviewCommentConverted(this._sessionResource, comment.sourceId);
  }
  /**
   * Expand the widget body.
   */
  expand() {
    const wasExpanded = this._isExpanded;
    this._isExpanded = true;
    this._domNode.classList.remove("collapsed");
    this._bodyNode.classList.remove("collapsed");
    this._updateToggleButton();
    this._editor.layoutOverlayWidget(this);
    if (!wasExpanded) {
      this._onDidExpand.fire();
    }
  }
  get isExpanded() {
    return this._isExpanded;
  }
  /**
   * Collapse the widget body.
   */
  collapse() {
    this._isExpanded = false;
    this._domNode.classList.add("collapsed");
    this._bodyNode.classList.add("collapsed");
    this._updateToggleButton();
    this.clearFocus();
    this._editor.layoutOverlayWidget(this);
  }
  /**
   * Focus a specific feedback item within this widget.
   * Highlights its range in the editor and marks it as focused.
   */
  focusFeedback(feedbackId) {
    for (const el of this._itemElements.values()) {
      el.classList.remove("focused");
    }
    const feedback = this._commentItems.find((f) => f.id === feedbackId);
    if (!feedback) {
      return;
    }
    const itemEl = this._itemElements.get(feedbackId);
    itemEl?.classList.add("focused");
    this._highlightRange(feedback);
  }
  /**
   * Clear focus state and range highlighting.
   */
  clearFocus() {
    for (const el of this._itemElements.values()) {
      el.classList.remove("focused");
    }
    this._rangeHighlightDecoration.clear();
  }
  _highlightRange(feedback) {
    const endLineNumber = feedback.range.endLineNumber;
    const range = new Range(
      feedback.range.startLineNumber,
      1,
      endLineNumber,
      this._editor.getModel()?.getLineMaxColumn(endLineNumber) ?? 1
    );
    this._rangeHighlightDecoration.set([
      {
        range,
        options: {
          description: "agent-feedback-range-highlight",
          className: "rangeHighlight",
          isWholeLine: true,
          linesDecorationsClassName: "agent-feedback-widget-range-glyph"
        }
      },
      {
        range,
        options: {
          description: "agent-feedback-range-highlight-overview",
          overviewRuler: {
            color: themeColorFromId(overviewRulerRangeHighlight),
            position: OverviewRulerLane.Full
          }
        }
      }
    ]);
  }
  /**
   * Returns true if this widget contains the given feedback item (by id).
   */
  containsFeedback(feedbackId) {
    return this._commentItems.some((f) => f.id === feedbackId);
  }
  /**
   * Returns the comment id whose open composer is the given element, or
   * `undefined` if none. Lets the contribution restore focus after a rebuild.
   */
  findComposerCommentIdForElement(element) {
    for (const [commentId, { textarea }] of [...this._activeEditInputs, ...this._activeReplyInputs]) {
      if (textarea === element) {
        return commentId;
      }
    }
    return void 0;
  }
  /**
   * Ids of the comments rendered by this widget. Used by the contribution
   * to prune draft state for comments that no longer exist.
   */
  getCommentIds() {
    return this._commentItems.map((comment) => comment.id);
  }
  /**
   * Updates the widget position and layout.
   */
  layout(startLineNumber) {
    if (this._disposed) {
      return;
    }
    if (startLineNumber !== this._startLineNumber) {
      this._cachedMinContentWidth = void 0;
    }
    this._startLineNumber = startLineNumber;
    const lineHeight = this._editor.getOption(EditorOption.lineHeight);
    const { contentLeft, contentWidth, verticalScrollbarWidth } = this._editor.getLayoutInfo();
    const scrollTop = this._editor.getScrollTop();
    const widgetWidth = getTotalWidth(this._domNode) || 280;
    const widgetHeight = this._domNode.offsetHeight || 0;
    const headerHeight = this._headerNode.offsetHeight || lineHeight;
    const contentRelativeTop = this._editor.getTopForLineNumber(startLineNumber) + (lineHeight - headerHeight) / 2;
    const scrollHeight = this._editor.getScrollHeight();
    const clampedContentTop = Math.min(Math.max(0, contentRelativeTop), Math.max(0, scrollHeight - widgetHeight));
    this._position = {
      stackOrdinal: 2,
      preference: {
        top: clampedContentTop - scrollTop,
        left: contentLeft + contentWidth - (2 * verticalScrollbarWidth + widgetWidth)
      }
    };
    this._editor.layoutOverlayWidget(this);
  }
  /**
   * Shows or hides the widget.
   */
  toggle(show) {
    this._domNode.classList.toggle("visible", show);
    if (show && this._commentItems.length > 0) {
      this.layout(this._commentItems[0].range.startLineNumber);
    }
  }
  /**
   * Relayouts the widget at its current line number.
   */
  relayout() {
    if (this._startLineNumber) {
      this.layout(this._startLineNumber);
    }
  }
  // IOverlayWidget implementation
  getId() {
    return this._id;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return this._position;
  }
  /**
   * Reserve enough horizontal scroll width so the user can always scroll the
   * editor content out from underneath the widget. The widget is anchored to
   * the right edge of the editor content area, so without this reservation any
   * line that extends under the widget cannot be revealed because the editor
   * cannot scroll past its longest line.
   *
   * The reserved width is the widget width plus the widest content among the
   * anchored line and the lines immediately above and below it. The result is
   * computed once using the real rendered widget width and cached afterwards.
   * Until the widget DOM node has a real width we fall back to an estimate and
   * skip caching so the value is recomputed once it is actually rendered. The
   * cache is also invalidated by `layout` whenever the anchor line changes.
   */
  getMinContentWidthInPx() {
    if (this._disposed) {
      return 0;
    }
    if (this._cachedMinContentWidth !== void 0) {
      return this._cachedMinContentWidth;
    }
    const model = this._editor.getModel();
    if (!model) {
      return 0;
    }
    const renderedWidth = getTotalWidth(this._domNode);
    const hasRenderedWidth = renderedWidth > 0;
    const widgetWidth = hasRenderedWidth ? renderedWidth : AgentFeedbackEditorWidget._estimatedWidgetWidth;
    const lineCount = model.getLineCount();
    let maxLineWidth = 0;
    let measuredAnyLine = false;
    for (let lineNumber = this._startLineNumber - 1; lineNumber <= this._startLineNumber + 1; lineNumber++) {
      if (lineNumber < 1 || lineNumber > lineCount) {
        continue;
      }
      const lineWidth = this._editor.getWidthOfLine(lineNumber);
      if (lineWidth < 0) {
        continue;
      }
      measuredAnyLine = true;
      if (lineWidth > maxLineWidth) {
        maxLineWidth = lineWidth;
      }
    }
    const { verticalScrollbarWidth } = this._editor.getLayoutInfo();
    const result = maxLineWidth + widgetWidth + 2 * verticalScrollbarWidth;
    if (hasRenderedWidth && measuredAnyLine) {
      this._cachedMinContentWidth = result;
    }
    return result;
  }
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._rangeHighlightDecoration.clear();
    this._editor.removeOverlayWidget(this);
    super.dispose();
  }
  _revealComment(comment) {
    const range = new Range(
      comment.range.startLineNumber,
      1,
      comment.range.endLineNumber,
      this._editor.getModel()?.getLineMaxColumn(comment.range.endLineNumber) ?? 1
    );
    this._editor.revealRangeInCenterIfOutsideViewport(range, ScrollType.Smooth);
  }
};
AgentFeedbackEditorWidget = __decorateClass([
  __decorateParam(4, IAgentFeedbackService),
  __decorateParam(5, ICodeReviewService),
  __decorateParam(6, IMarkdownRendererService),
  __decorateParam(7, ICodeEditorService)
], AgentFeedbackEditorWidget);
export {
  AgentFeedbackEditorWidget
};
