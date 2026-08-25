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
import * as dom from "../../../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Checkbox } from "../../../../../../../base/browser/ui/toggle/toggle.js";
import { Action } from "../../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { DisposableMap, DisposableStore, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { localize } from "../../../../../../../nls.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { FileKind } from "../../../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../../../../platform/notification/common/notification.js";
import { defaultCheckboxStyles } from "../../../../../../../platform/theme/browser/defaultStyles.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../../../../browser/labels.js";
import { AgentFeedbackReviewCommandId, IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../../common/tools/languageModelToolsService.js";
import { ChatContextKeys } from "../../../../common/actions/chatContextKeys.js";
import { IChatWidgetService } from "../../../chat.js";
import { IChatToolRiskAssessmentService } from "../../../tools/chatToolRiskAssessmentService.js";
import { ChatCollapsibleContentPart } from "../chatCollapsibleContentPart.js";
import { ChatCustomConfirmationWidget } from "../chatConfirmationWidget.js";
import { AbstractToolConfirmationSubPart } from "./abstractToolConfirmationSubPart.js";
import "../media/chatAgentFeedbackReviewConfirmation.css";
let ChatAgentFeedbackReviewConfirmationSubPart = class extends AbstractToolConfirmationSubPart {
  constructor(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService, commandService, logService, notificationService, hoverService) {
    super(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService);
    this.commandService = commandService;
    this.logService = logService;
    this.notificationService = notificationService;
    this.hoverService = hoverService;
    this.codeblocks = [];
    this._rows = /* @__PURE__ */ new Map();
    this._rowStores = this._register(new DisposableMap());
    this._onDidChangeRevealButtonDisablement = this._register(new Emitter());
    const data = toolInvocation.toolSpecificData;
    if (!data || data.kind !== "agentFeedbackReviewConfirmation") {
      throw new Error("Agent feedback review confirmation data is missing");
    }
    this._resourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
    const listElement = dom.$(".chat-agent-feedback-review-list");
    void this._populate(listElement);
    const revealLabel = data.options[0] ?? localize("agentFeedback.reveal", "Reveal Selected");
    const buttons = [
      {
        label: revealLabel,
        data: () => this._onReveal(),
        disabled: true,
        onDidChangeDisablement: this._onDidChangeRevealButtonDisablement.event
      },
      {
        label: localize("agentFeedback.cancel", "Cancel"),
        isSecondary: true,
        data: () => this.confirmWith(this.toolInvocation, { type: ToolConfirmKind.Skipped })
      }
    ];
    const confirmWidget = this._register(this.instantiationService.createInstance(
      ChatCustomConfirmationWidget,
      this.context,
      {
        title: this.getTitle(),
        icon: Codicon.commentDiscussion,
        message: listElement,
        buttons
      }
    ));
    const hasToolConfirmation = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
    hasToolConfirmation.set(true);
    this._register(confirmWidget.onDidClick(({ button, isTouchClick }) => {
      button.data();
      if (!isTouchClick) {
        this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.focusInput();
      }
    }));
    this._register(toDisposable(() => hasToolConfirmation.reset()));
    this.domNode = confirmWidget.domNode;
  }
  get _sessionResource() {
    return this.context.element.sessionResource;
  }
  async _populate(listElement) {
    let comments = [];
    try {
      comments = await this.commandService.executeCommand(
        AgentFeedbackReviewCommandId.GetComments,
        this._sessionResource
      ) ?? [];
    } catch (error) {
      this.logService.warn("[AgentFeedbackReview] Failed to fetch unreviewed comments", error);
    }
    if (this._store.isDisposed) {
      return;
    }
    dom.clearNode(listElement);
    if (!comments.length) {
      listElement.append(dom.$(".chat-agent-feedback-review-empty", void 0, localize("agentFeedback.none", "No unreviewed comments.")));
      return;
    }
    for (const comment of comments) {
      this._renderRow(listElement, comment);
    }
  }
  _renderRow(listElement, comment) {
    const rowStore = new DisposableStore();
    this._rowStores.set(comment.id, rowStore);
    const rowElement = dom.append(listElement, dom.$(".chat-agent-feedback-review-row"));
    const checkbox = rowStore.add(new Checkbox(
      localize("agentFeedback.revealComment", "Reveal this comment to the agent"),
      true,
      defaultCheckboxStyles
    ));
    dom.append(rowElement, checkbox.domNode);
    const main = dom.append(rowElement, dom.$(".chat-agent-feedback-review-main"));
    const header = dom.append(main, dom.$(".chat-agent-feedback-review-header"));
    if (comment.kindLabel) {
      dom.append(header, dom.$(".chat-agent-feedback-review-kind", void 0, comment.kindLabel));
    }
    const fileUri = URI.revive(comment.fileUri);
    const fileLabel = rowStore.add(this._resourceLabels.create(header));
    fileLabel.element.classList.add("chat-agent-feedback-review-file");
    fileLabel.setResource(
      { resource: fileUri, name: basename(fileUri) },
      { fileKind: FileKind.FILE, title: fileUri.fsPath || fileUri.path }
    );
    this._renderCommentText(rowStore, main, comment.text);
    const actionsContainer = dom.append(rowElement, dom.$(".chat-agent-feedback-review-actions"));
    const actionBar = rowStore.add(new ActionBar(actionsContainer));
    actionBar.push(rowStore.add(new Action(
      "agentFeedbackReview.reveal",
      localize("agentFeedback.openFile", "Open File and Reveal Comment"),
      ThemeIcon.asClassName(Codicon.goToFile),
      true,
      () => this._reveal(comment.id)
    )), { icon: true, label: false });
    actionBar.push(rowStore.add(new Action(
      "agentFeedbackReview.delete",
      localize("agentFeedback.delete", "Delete Comment"),
      ThemeIcon.asClassName(Codicon.close),
      true,
      () => this._delete(comment.id)
    )), { icon: true, label: false });
    this._rows.set(comment.id, { comment, checkbox, element: rowElement });
    rowStore.add(checkbox.onChange(() => this._updateRevealButtonDisablement()));
    this._updateRevealButtonDisablement();
  }
  _updateRevealButtonDisablement() {
    this._onDidChangeRevealButtonDisablement.fire(![...this._rows.values()].some((row) => row.checkbox.checked));
  }
  /**
   * Renders the comment body clamped to two visual lines by default, with an
   * expand/collapse toggle in the bottom-right corner. The toggle and the
   * fade/ellipsis affordance only appear when the text actually overflows two
   * lines; overflow is re-evaluated whenever the available width changes.
   */
  _renderCommentText(rowStore, main, text) {
    const container = dom.append(main, dom.$(".chat-agent-feedback-review-text-container"));
    const textElement = dom.append(container, dom.$(".chat-agent-feedback-review-text"));
    textElement.textContent = text;
    const toggle = dom.append(container, dom.$("button.chat-agent-feedback-review-expand-toggle"));
    toggle.type = "button";
    toggle.tabIndex = 0;
    const toggleIcon = dom.append(toggle, dom.$("span.codicon"));
    toggleIcon.setAttribute("aria-hidden", "true");
    const expandLabel = localize("agentFeedback.expandComment", "Show More");
    const collapseLabel = localize("agentFeedback.collapseComment", "Show Less");
    let expanded = false;
    const renderState = () => {
      container.classList.toggle("collapsed", !expanded);
      container.classList.toggle("expanded", expanded);
      toggleIcon.classList.toggle("codicon-chevron-down", !expanded);
      toggleIcon.classList.toggle("codicon-chevron-up", expanded);
      toggle.setAttribute("aria-label", expanded ? collapseLabel : expandLabel);
      toggle.setAttribute("aria-expanded", String(expanded));
    };
    const isOverflowing = () => {
      const wasExpanded = expanded;
      if (wasExpanded) {
        container.classList.add("collapsed");
        container.classList.remove("expanded");
      }
      const overflowing = textElement.scrollHeight - textElement.clientHeight > 1;
      if (wasExpanded) {
        container.classList.remove("collapsed");
        container.classList.add("expanded");
      }
      return overflowing;
    };
    const updateOverflow = () => {
      const overflowing = isOverflowing();
      container.classList.toggle("overflowing", overflowing);
      if (!overflowing && expanded) {
        expanded = false;
        renderState();
      }
    };
    rowStore.add(this.hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      toggle,
      () => expanded ? collapseLabel : expandLabel
    ));
    rowStore.add(dom.addDisposableListener(toggle, dom.EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent(ChatCollapsibleContentPart.userToggleEvent, { bubbles: true }));
      expanded = !expanded;
      renderState();
    }));
    renderState();
    const targetWindow = dom.getWindow(container);
    const observer = new targetWindow.ResizeObserver(() => updateOverflow());
    observer.observe(textElement);
    rowStore.add(toDisposable(() => observer.disconnect()));
  }
  async _reveal(commentId) {
    try {
      await this.commandService.executeCommand(AgentFeedbackReviewCommandId.Reveal, this._sessionResource, commentId);
    } catch (error) {
      this.logService.warn("[AgentFeedbackReview] Failed to reveal comment", error);
    }
  }
  async _delete(commentId) {
    const row = this._rows.get(commentId);
    try {
      await this.commandService.executeCommand(AgentFeedbackReviewCommandId.Delete, this._sessionResource, commentId);
      row?.element.remove();
      this._rows.delete(commentId);
      this._rowStores.deleteAndDispose(commentId);
      this._updateRevealButtonDisablement();
    } catch (error) {
      this.logService.warn("[AgentFeedbackReview] Failed to delete comment", error);
    }
  }
  async _onReveal() {
    const checkedIds = [];
    for (const row of this._rows.values()) {
      if (row.checkbox.checked) {
        checkedIds.push(row.comment.id);
      }
    }
    if (!checkedIds.length) {
      return;
    }
    try {
      await this.commandService.executeCommand(AgentFeedbackReviewCommandId.Accept, this._sessionResource, checkedIds);
    } catch (error) {
      this.logService.warn("[AgentFeedbackReview] Failed to accept comments", error);
      this.notificationService.notify({
        severity: Severity.Error,
        message: localize("agentFeedback.acceptFailed", "Failed to reveal the selected comments. Please try again.")
      });
      return;
    }
    this.confirmWith(this.toolInvocation, { type: ToolConfirmKind.UserAction });
  }
  createContentElement() {
    return "";
  }
  getTitle() {
    const state = this.toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return "";
    }
    const title = state.confirmationMessages?.title;
    return typeof title === "string" ? title : title?.value ?? "";
  }
};
ChatAgentFeedbackReviewConfirmationSubPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, ILanguageModelToolsService),
  __decorateParam(7, IChatToolRiskAssessmentService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, ILogService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IHoverService)
], ChatAgentFeedbackReviewConfirmationSubPart);
export {
  ChatAgentFeedbackReviewConfirmationSubPart
};
