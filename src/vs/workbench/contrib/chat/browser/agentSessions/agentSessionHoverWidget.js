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
import * as dom from "../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { fromNow, getDurationString } from "../../../../../base/common/date.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { SESSION_META_EHCLI_ADOPTABLE_KEY } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatAgentLocation, ChatModeKind } from "../../common/constants.js";
import { ChatViewModel } from "../../common/model/chatViewModel.js";
import { IChatWidgetService } from "../chat.js";
import { ChatListWidget } from "../widget/chatListWidget.js";
import { AgentSessionProviders, getAgentSessionProvider, getAgentSessionProviderIcon, getAgentSessionProviderName } from "./agentSessions.js";
import { IAgentSessionsService } from "./agentSessionsService.js";
import { AgentSessionStatus, getAgentChangesSummary, hasValidDiff } from "./agentSessionsModel.js";
import "./media/agentSessionHoverWidget.css";
const HEADER_HEIGHT = 60;
const CHAT_LIST_HEIGHT = 240;
const CHAT_HOVER_WIDTH = 500;
let AgentSessionHoverWidget = class extends Disposable {
  constructor(session, chatService, instantiationService, chatWidgetService, agentSessionsService) {
    super();
    this.session = session;
    this.chatService = chatService;
    this.instantiationService = instantiationService;
    this.chatWidgetService = chatWidgetService;
    this.agentSessionsService = agentSessionsService;
    this.domNode = dom.$(".agent-session-hover.interactive-session");
    this.domNode.style.width = `${CHAT_HOVER_WIDTH}px`;
    this.domNode.style.height = `${HEADER_HEIGHT + CHAT_LIST_HEIGHT}px`;
    this.domNode.style.overflow = "hidden";
    this.cts = new CancellationTokenSource();
    this._register(toDisposable(() => this.cts.cancel()));
    this.buildHeader();
    this.contentElement = dom.append(this.domNode, dom.$(".agent-session-hover-content"));
    this.loadingElement = dom.append(this.contentElement, dom.$(".agent-session-hover-loading"));
    dom.append(this.loadingElement, renderIcon(ThemeIcon.modify(Codicon.loading, "spin")));
    this.renderScheduler = this._register(new RunOnceScheduler(() => this.render(), 200));
  }
  onRendered() {
    this.modelRef ??= this.loadModel();
    if (this.listWidget) {
      this.listWidget.layout(CHAT_LIST_HEIGHT, CHAT_HOVER_WIDTH);
      this.listWidget.refresh();
      return;
    }
    this.renderScheduler.schedule();
  }
  onHidden() {
    this.renderScheduler.cancel();
  }
  async loadModel() {
    if (this.session.metadata?.[SESSION_META_EHCLI_ADOPTABLE_KEY] === true) {
      this.loadingElement.remove();
      const tooltip = this.buildFallbackTooltip(this.session);
      this.domNode.textContent = typeof tooltip === "string" ? tooltip : tooltip.value;
      return;
    }
    const modelRef = await this.chatService.acquireOrLoadSession(this.session.resource, ChatAgentLocation.Chat, this.cts.token, "AgentSessionHoverWidget#loadModel");
    if (this._store.isDisposed) {
      modelRef?.dispose();
      return;
    }
    if (!modelRef) {
      this.loadingElement.remove();
      const tooltip = this.buildFallbackTooltip(this.session);
      this.domNode.textContent = typeof tooltip === "string" ? tooltip : tooltip.value;
      return;
    }
    this._register(modelRef);
    return modelRef.object;
  }
  async render() {
    this.modelRef ??= this.loadModel();
    const model = await this.modelRef;
    if (!model || this._store.isDisposed || !this.domNode.isConnected) {
      return;
    }
    if (this.listWidget) {
      this.listWidget.layout(CHAT_LIST_HEIGHT, CHAT_HOVER_WIDTH);
      this.listWidget.refresh();
      return;
    }
    this.loadingElement.remove();
    const viewModel = this._register(this.instantiationService.createInstance(
      ChatViewModel,
      model,
      { maxVisibleItems: 2 }
    ));
    const container = dom.append(this.contentElement, dom.$(".interactive-list"));
    const listWidget = this._register(this.instantiationService.createInstance(
      ChatListWidget,
      container,
      {
        rendererOptions: {
          renderStyle: "compact",
          noHeader: true,
          editable: false
        },
        currentChatMode: () => ChatModeKind.Ask
      }
    ));
    this.listWidget = listWidget;
    listWidget.layout(CHAT_LIST_HEIGHT, CHAT_HOVER_WIDTH);
    listWidget.setScrollLock(true);
    listWidget.setViewModel(viewModel);
    listWidget.refresh();
    const viewModelScheduler = this._register(new RunOnceScheduler(() => {
      if (this.domNode.isConnected) {
        listWidget.refresh();
      }
    }, 500));
    this._register(viewModel.onDidChange(() => {
      if (this.domNode.isConnected && !viewModelScheduler.isScheduled()) {
        viewModelScheduler.schedule();
      }
    }));
    this._register(listWidget.onDidClickFollowup(async (followup) => {
      const widget = await this.chatWidgetService.openSession(model.sessionResource);
      if (widget) {
        widget.acceptInput(followup.message);
      }
    }));
  }
  buildHeader() {
    const session = this.session;
    const header = dom.append(this.domNode, dom.$(".agent-session-hover-header"));
    const titleRow = dom.append(header, dom.$(".agent-session-hover-title"));
    dom.append(titleRow, dom.$("span", void 0, session.label));
    const detailsRow = dom.append(header, dom.$(".agent-session-hover-details"));
    const providerType = getAgentSessionProvider(session.providerType);
    const provider = providerType ?? AgentSessionProviders.Local;
    const providerIcon = getAgentSessionProviderIcon(provider);
    dom.append(detailsRow, renderIcon(providerIcon));
    dom.append(detailsRow, dom.$("span", void 0, getAgentSessionProviderName(provider)));
    dom.append(detailsRow, dom.$("span.separator", void 0, "\u2022"));
    if (session.timing.lastRequestEnded && session.timing.lastRequestStarted) {
      const duration = this.toDuration(session.timing.lastRequestStarted, session.timing.lastRequestEnded, true);
      if (duration) {
        dom.append(detailsRow, dom.$("span", void 0, duration));
      }
    } else {
      const startTime = session.timing.lastRequestStarted ?? session.timing.created;
      dom.append(detailsRow, dom.$("span", void 0, fromNow(startTime, true, true)));
    }
    const diffSeparator = dom.append(detailsRow, dom.$("span.separator", void 0, "\u2022"));
    const diffContainer = dom.append(detailsRow, dom.$(".agent-session-hover-diff"));
    diffSeparator.style.display = "none";
    diffContainer.style.display = "none";
    const observed = this.agentSessionsService.model.observeSession(session.resource);
    this._register(autorun((reader) => {
      const latest = observed.read(reader) ?? session;
      const diff = getAgentChangesSummary(latest.changes);
      dom.clearNode(diffContainer);
      if (diff && hasValidDiff(latest.changes)) {
        diffSeparator.style.display = "";
        diffContainer.style.display = "";
        if (diff.files > 0) {
          dom.append(diffContainer, dom.$("span", void 0, diff.files === 1 ? localize("tooltip.file", "1 file") : localize("tooltip.files", "{0} files", diff.files)));
        }
        if (diff.insertions > 0) {
          dom.append(diffContainer, dom.$("span.insertions", void 0, `+${diff.insertions}`));
        }
        if (diff.deletions > 0) {
          dom.append(diffContainer, dom.$("span.deletions", void 0, `-${diff.deletions}`));
        }
      } else {
        diffSeparator.style.display = "none";
        diffContainer.style.display = "none";
      }
    }));
    if (session.status !== AgentSessionStatus.Completed) {
      dom.append(detailsRow, dom.$("span.separator", void 0, "\u2022"));
      dom.append(detailsRow, dom.$("span", void 0, this.toStatusLabel(session.status)));
    }
    if (session.isArchived()) {
      dom.append(detailsRow, dom.$("span.separator", void 0, "\u2022"));
      dom.append(detailsRow, renderIcon(Codicon.archive));
      dom.append(detailsRow, dom.$("span", void 0, localize("tooltip.archived", "Archived")));
    }
  }
  buildFallbackTooltip(session) {
    const lines = [];
    lines.push(`**${session.label}**`);
    if (session.tooltip) {
      const tooltip = typeof session.tooltip === "string" ? session.tooltip : session.tooltip.value;
      lines.push(tooltip);
    } else {
      if (session.description) {
        const description = typeof session.description === "string" ? session.description : session.description.value;
        lines.push(description);
      }
      if (session.badge) {
        const badge = typeof session.badge === "string" ? session.badge : session.badge.value;
        lines.push(badge);
      }
    }
    const details = [];
    const providerType = getAgentSessionProvider(session.providerType);
    const provider = providerType ?? AgentSessionProviders.Local;
    const providerIcon = getAgentSessionProviderIcon(provider);
    const providerName = getAgentSessionProviderName(provider);
    let timeLabel;
    if (session.timing.lastRequestEnded && session.timing.lastRequestStarted) {
      const duration = this.toDuration(session.timing.lastRequestStarted, session.timing.lastRequestEnded, true);
      timeLabel = duration ?? fromNow(session.timing.lastRequestStarted, true, true);
    } else {
      const startTime = session.timing.lastRequestStarted ?? session.timing.created;
      timeLabel = fromNow(startTime, true, true);
    }
    details.push(`$(${providerIcon.id}) ${providerName} \u2022 ${timeLabel}`);
    const diff = getAgentChangesSummary(session.changes);
    if (diff && hasValidDiff(session.changes)) {
      const diffParts = [];
      if (diff.files > 0) {
        diffParts.push(diff.files === 1 ? localize("tooltip.file", "1 file") : localize("tooltip.files", "{0} files", diff.files));
      }
      if (diff.insertions > 0) {
        diffParts.push(`+${diff.insertions}`);
      }
      if (diff.deletions > 0) {
        diffParts.push(`-${diff.deletions}`);
      }
      if (diffParts.length > 0) {
        details.push(diffParts.join(" "));
      }
    }
    if (session.status !== AgentSessionStatus.Completed) {
      details.push(this.toStatusLabel(session.status));
    }
    lines.push(details.join(" \u2022 "));
    if (session.isArchived()) {
      lines.push(`$(archive) ${localize("tooltip.archived", "Archived")}`);
    }
    return new MarkdownString(lines.join("\n\n"), { supportThemeIcons: true });
  }
  toDuration(startTime, endTime, useFullTimeWords) {
    const elapsed = Math.round((endTime - startTime) / 1e3) * 1e3;
    if (elapsed < 1e3) {
      return void 0;
    }
    return getDurationString(elapsed, useFullTimeWords);
  }
  toStatusLabel(status) {
    let statusLabel;
    switch (status) {
      case AgentSessionStatus.NeedsInput:
        statusLabel = localize("agentSessionNeedsInput", "Needs Input");
        break;
      case AgentSessionStatus.InProgress:
        statusLabel = localize("agentSessionInProgress", "In Progress");
        break;
      case AgentSessionStatus.Failed:
        statusLabel = localize("agentSessionFailed", "Failed");
        break;
      default:
        statusLabel = localize("agentSessionCompleted", "Completed");
    }
    return statusLabel;
  }
};
AgentSessionHoverWidget = __decorateClass([
  __decorateParam(1, IChatService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, IAgentSessionsService)
], AgentSessionHoverWidget);
export {
  AgentSessionHoverWidget
};
