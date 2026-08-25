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
import "./media/agentsessionsviewer.css";
import { clearNode, h, isHTMLElement } from "../../../../../base/browser/dom.js";
import { localize } from "../../../../../nls.js";
import { NotSelectableGroupId } from "../../../../../base/browser/ui/list/list.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { AgentSessionSection, AgentSessionStatus, getAgentChangesSummary, hasValidDiff, isAgentSession, isAgentSessionSection, isAgentSessionShowLess, isAgentSessionShowMore, isAgentSessionsModel, isSessionInProgressStatus } from "./agentSessionsModel.js";
import { IconLabel } from "../../../../../base/browser/ui/iconLabel/iconLabel.js";
import { ThemeIcon, themeColorFromId } from "../../../../../base/common/themables.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { asCssVariable } from "../../../../../platform/theme/common/colorUtils.js";
import { fromNow, getDurationString } from "../../../../../base/common/date.js";
import { createMatches } from "../../../../../base/common/filters.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { allowedChatMarkdownHtmlTags } from "../widget/chatContentMarkdownRenderer.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { coalesce } from "../../../../../base/common/arrays.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { fillEditorsDragData } from "../../../../browser/dnd.js";
import { HoverStyle } from "../../../../../base/browser/ui/hover/hover.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IntervalTimer } from "../../../../../base/common/async.js";
import { MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { Emitter } from "../../../../../base/common/event.js";
import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { AgentSessionHoverWidget } from "./agentSessionHoverWidget.js";
import { AgentSessionProviders } from "./agentSessions.js";
import { AgentSessionsGrouping, AgentSessionsSorting } from "./agentSessionsFilter.js";
import { autorun } from "../../../../../base/common/observable.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { compareIgnoreCase } from "../../../../../base/common/strings.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { IChatSessionsService } from "../../common/chatSessionsService.js";
import { IVoicePlaybackService } from "../../common/voicePlaybackService.js";
import { createPixelSpinner } from "../../../../../base/browser/ui/pixelSpinner/pixelSpinner.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
class AgentSessionStatusIcon extends Disposable {
  constructor(container, getIcon, accessibilityService) {
    super();
    this.container = container;
    this.getIcon = getIcon;
    this.accessibilityService = accessibilityService;
    this.spinner = this._register(new MutableDisposable());
    this._register(this.accessibilityService.onDidChangeReducedMotion(() => {
      if (this._lastSession) {
        this.render(this._lastSession);
      }
    }));
  }
  static {
    this.PIXEL_SPINNER_GRID_KEY = "__pixel_spinner_grid__";
  }
  static {
    this.PIXEL_SPINNER_RING_KEY = "__pixel_spinner_ring__";
  }
  setStatus(session) {
    this._lastSession = session;
    this.render(session);
  }
  reset() {
    this._currentCacheKey = void 0;
    this._lastSession = void 0;
    this.spinner.clear();
    clearNode(this.container);
  }
  render(session) {
    this.container.className = `agent-session-icon${session.status === AgentSessionStatus.NeedsInput ? " needs-input" : ""}`;
    this.container.style.color = "";
    if ((session.status === AgentSessionStatus.InProgress || session.status === AgentSessionStatus.NeedsInput) && !this.accessibilityService.isMotionReduced()) {
      const isNeedsInput = session.status === AgentSessionStatus.NeedsInput;
      const cacheKey2 = isNeedsInput ? AgentSessionStatusIcon.PIXEL_SPINNER_RING_KEY : AgentSessionStatusIcon.PIXEL_SPINNER_GRID_KEY;
      const color2 = isNeedsInput ? asCssVariable("list.warningForeground") : asCssVariable("textLink.foreground");
      if (this._currentCacheKey === cacheKey2) {
        this.updateActiveIconColor(color2);
        return;
      }
      this._currentCacheKey = cacheKey2;
      this.spinner.clear();
      clearNode(this.container);
      const spinner = createPixelSpinner(void 0, { variant: isNeedsInput ? "ring" : "grid" });
      this.spinner.value = spinner;
      spinner.element.style.color = color2;
      this.container.appendChild(spinner.element);
      return;
    }
    const icon = this.getIcon(session);
    const cacheKey = ThemeIcon.asCSSSelector(icon);
    const color = icon.color ? asCssVariable(icon.color.id) : "";
    if (this._currentCacheKey === cacheKey) {
      this.updateActiveIconColor(color);
      return;
    }
    this._currentCacheKey = cacheKey;
    this.spinner.clear();
    clearNode(this.container);
    const iconElement = h(`span${cacheKey}`).root;
    iconElement.style.color = color;
    this.container.appendChild(iconElement);
  }
  updateActiveIconColor(color) {
    const activeIcon = this.container.firstElementChild;
    if (isHTMLElement(activeIcon)) {
      activeIcon.style.color = color;
    }
  }
}
function getAgentSessionStatusIcon(session) {
  if (session.status === AgentSessionStatus.InProgress) {
    return { ...Codicon.sessionInProgress, color: themeColorFromId("textLink.foreground") };
  }
  if (session.status === AgentSessionStatus.NeedsInput) {
    return { ...Codicon.circleFilled, color: themeColorFromId("list.warningForeground") };
  }
  if (session.status === AgentSessionStatus.Failed) {
    return { ...Codicon.error, color: themeColorFromId("errorForeground") };
  }
  if (session.isArchived()) {
    return { ...Codicon.passFilled, color: themeColorFromId("agentSessionReadIndicator.foreground") };
  }
  if (!session.isRead()) {
    return { ...Codicon.circleFilled, color: themeColorFromId("textLink.foreground") };
  }
  return { ...Codicon.circleSmallFilled, color: themeColorFromId("agentSessionReadIndicator.foreground") };
}
let AgentSessionRenderer = class extends Disposable {
  constructor(options, _approvalModel, _activeSessionResource, markdownRendererService, productService, hoverService, instantiationService, contextKeyService, chatSessionsService, accessibilityService, voicePlaybackService) {
    super();
    this.options = options;
    this._approvalModel = _approvalModel;
    this._activeSessionResource = _activeSessionResource;
    this.markdownRendererService = markdownRendererService;
    this.productService = productService;
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.chatSessionsService = chatSessionsService;
    this.accessibilityService = accessibilityService;
    this.voicePlaybackService = voicePlaybackService;
    this.templateId = AgentSessionRenderer.TEMPLATE_ID;
    this.sessionHover = this._register(new MutableDisposable());
    this._onDidChangeItemHeight = this._register(new Emitter());
    this.onDidChangeItemHeight = this._onDidChangeItemHeight.event;
  }
  static {
    this.TEMPLATE_ID = "agent-session";
  }
  static {
    this.APPROVAL_ROW_MAX_LINES = 3;
  }
  static {
    this._APPROVAL_ROW_LINE_HEIGHT = 18;
  }
  static {
    this._APPROVAL_ROW_OVERHEAD = 14;
  }
  // 4px margin-top + 4px padding-top + 4px padding-bottom + 2px border
  static getApprovalRowHeight(label) {
    const lineCount = Math.min(label.split(/\r?\n/).length, AgentSessionRenderer.APPROVAL_ROW_MAX_LINES);
    return lineCount * AgentSessionRenderer._APPROVAL_ROW_LINE_HEIGHT + AgentSessionRenderer._APPROVAL_ROW_OVERHEAD;
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposable = disposables.add(new DisposableStore());
    container.closest(".monaco-list-row")?.classList.add("agent-session-list-row", "agent-session-item-row");
    const elements = h(
      "div.agent-session-item@item",
      [
        h("div.agent-session-icon-col", [
          h("div.agent-session-icon@icon")
        ]),
        h("div.agent-session-main-col", [
          h("div.agent-session-title-row", [
            h("div.agent-session-title@title"),
            h("div.agent-session-pinned-indicator@pinnedIndicator"),
            h("div.agent-session-pending-voice-indicator@pendingVoiceIndicator"),
            h("div.agent-session-title-toolbar@titleToolbar")
          ]),
          h("div.agent-session-details-row", [
            h("div.agent-session-details-icon@detailsIcon"),
            h("div.agent-session-badge@badge"),
            h("span.agent-session-separator@separator"),
            h(
              "div.agent-session-diff-container@diffContainer",
              [
                h("span.agent-session-diff-added@addedSpan"),
                h("span.agent-session-diff-removed@removedSpan")
              ]
            ),
            h("div.agent-session-description@description"),
            h("div.agent-session-status@statusContainer", [
              h("span.agent-session-status-time@statusTime")
            ])
          ]),
          h("div.agent-session-approval-row@approvalRow", [
            h("span.agent-session-approval-label@approvalLabel"),
            h("div.agent-session-approval-button@approvalButtonContainer")
          ])
        ])
      ]
    );
    const contextKeyService = disposables.add(this.contextKeyService.createScoped(elements.item));
    const scopedInstantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const titleToolbar = disposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, elements.titleToolbar, MenuId.AgentSessionItemToolbar, {
      menuOptions: { shouldForwardArgs: true }
    }));
    container.appendChild(elements.item);
    return {
      element: elements.item,
      icon: elements.icon,
      statusIcon: disposables.add(new AgentSessionStatusIcon(elements.icon, (session) => this.getIcon(session), this.accessibilityService)),
      title: disposables.add(new IconLabel(elements.title, { supportHighlights: true, supportIcons: true })),
      pinnedIndicator: elements.pinnedIndicator,
      pendingVoiceIndicator: elements.pendingVoiceIndicator,
      titleToolbar,
      detailsIcon: elements.detailsIcon,
      badge: elements.badge,
      separator: elements.separator,
      diffContainer: elements.diffContainer,
      diffAddedSpan: elements.addedSpan,
      diffRemovedSpan: elements.removedSpan,
      description: elements.description,
      statusContainer: elements.statusContainer,
      statusTime: elements.statusTime,
      approvalRow: elements.approvalRow,
      approvalLabel: elements.approvalLabel,
      approvalButtonContainer: elements.approvalButtonContainer,
      contextKeyService,
      elementDisposable,
      disposables
    };
  }
  renderElement(session, index, template, details) {
    template.elementDisposable.clear();
    template.diffAddedSpan.textContent = "";
    template.diffRemovedSpan.textContent = "";
    template.badge.textContent = "";
    template.description.textContent = "";
    template.element.classList.toggle("archived", session.element.isArchived());
    if (this.options.isGroupedByRepository?.()) {
      const repoName = getRepositoryName(session.element);
      if (repoName) {
        template.element.setAttribute("data-section-label", repoName);
      } else {
        template.element.removeAttribute("data-section-label");
      }
    } else {
      template.element.removeAttribute("data-section-label");
    }
    if (this.options.useStatusOnlyIcons) {
      template.statusIcon.setStatus(session.element);
      if (session.element.providerType === AgentSessionProviders.Background) {
        template.detailsIcon.className = "agent-session-details-icon";
      } else {
        template.detailsIcon.className = `agent-session-details-icon ${ThemeIcon.asClassName(session.element.icon)}`;
        template.detailsIcon.classList.add("visible");
      }
    } else {
      template.statusIcon.setStatus(session.element);
      template.detailsIcon.className = "agent-session-details-icon";
    }
    const markdownTitle = new MarkdownString(session.element.label);
    template.title.setLabel(renderAsPlaintext(markdownTitle), void 0, { matches: createMatches(session.filterData) });
    ChatContextKeys.isArchivedAgentSession.bindTo(template.contextKeyService).set(session.element.isArchived());
    ChatContextKeys.isPinnedAgentSession.bindTo(template.contextKeyService).set(session.element.isPinned());
    ChatContextKeys.isReadAgentSession.bindTo(template.contextKeyService).set(session.element.isRead());
    ChatContextKeys.agentSessionType.bindTo(template.contextKeyService).set(session.element.providerType);
    template.titleToolbar.context = session.element;
    const isPinned = session.element.isPinned();
    template.pinnedIndicator.className = "agent-session-pinned-indicator " + ThemeIcon.asClassName(Codicon.pinned);
    template.pinnedIndicator.classList.toggle("visible", isPinned);
    const sessionResource = session.element.resource;
    template.pendingVoiceIndicator.className = "agent-session-pending-voice-indicator " + ThemeIcon.asClassName(Codicon.unmute);
    template.pendingVoiceIndicator.title = localize("pendingVoiceResponse", "Voice response ready");
    const updatePendingVoice = () => {
      template.pendingVoiceIndicator.classList.toggle("visible", this.voicePlaybackService.hasPendingResponse(sessionResource));
    };
    template.elementDisposable.add(autorun((reader) => {
      this.voicePlaybackService.pendingResponseVersion.read(reader);
      updatePendingVoice();
    }));
    const hasBadge = this.renderBadge(session, template);
    let hasDiff = false;
    const { changes: diff } = session.element;
    if (!isSessionInProgressStatus(session.element.status) && diff && hasValidDiff(diff)) {
      if (this.renderDiff(session, template)) {
        hasDiff = true;
      }
    }
    let hasAgentSessionChanges = false;
    if (session.element.providerType === AgentSessionProviders.Background || session.element.providerType === AgentSessionProviders.Cloud) {
      hasAgentSessionChanges = Array.isArray(diff) && diff.length > 0;
    } else {
      hasAgentSessionChanges = hasDiff;
    }
    ChatContextKeys.hasAgentSessionChanges.bindTo(template.contextKeyService).set(hasAgentSessionChanges);
    const hasDescription = this.renderDescription(session, template);
    const hasStatus = this.renderStatus(session, template);
    const hideDetails = hasDescription && isSessionInProgressStatus(session.element.status);
    template.badge.classList.toggle("has-badge", hasBadge && !hideDetails);
    template.diffContainer.classList.toggle("has-diff", hasDiff && !hideDetails);
    template.statusContainer.classList.toggle("hidden", hideDetails);
    template.separator.classList.toggle("has-separator", !hideDetails && hasBadge && hasDiff);
    template.description.classList.toggle("has-separator", hasDescription && !hideDetails && (hasBadge || hasDiff));
    template.statusContainer.classList.toggle("has-separator", !hideDetails && hasStatus && (hasBadge || hasDiff || hasDescription));
    this.renderHover(session, template);
    if (this._approvalModel) {
      this.renderApprovalRow(session, template);
    }
    this.triggerResolve(session, template);
  }
  triggerResolve(session, template) {
    const cts = new CancellationTokenSource();
    template.elementDisposable.add({ dispose() {
      cts.dispose(true);
    } });
    this.chatSessionsService.resolveChatSessionItem(session.element.providerType, session.element.resource, cts.token).catch(() => {
    });
  }
  renderBadge(session, template) {
    if (this.options.hideSessionBadge) {
      return false;
    }
    const badge = session.element.badge;
    if (!badge) {
      return false;
    }
    if (this.options.isGroupedByRepository?.() && !session.element.isArchived() && !session.element.isPinned()) {
      const raw = typeof badge === "string" ? badge : badge.value;
      const match = raw.match(/^\$\((?:repo|folder|worktree)\)\s*(.+)/);
      if (match) {
        const badgeName = match[1].trim();
        const repoName = getRepositoryName(session.element);
        if (badgeName === repoName) {
          return false;
        }
      }
    }
    const normalisedBadge = this.stripCodicons(badge);
    const badgeValue = typeof normalisedBadge === "string" ? normalisedBadge : normalisedBadge.value;
    if (!badgeValue) {
      return false;
    }
    this.renderMarkdownOrText(normalisedBadge, template.badge, template.elementDisposable);
    return true;
  }
  stripCodicons(content) {
    const raw = typeof content === "string" ? content : content.value;
    const stripped = raw.replace(/\$\([a-z0-9\-]+\)\s*/gi, "").trim();
    if (typeof content === "string") {
      return stripped;
    }
    return MarkdownString.lift({ ...content, value: stripped });
  }
  renderMarkdownOrText(content, container, disposables) {
    if (typeof content === "string") {
      container.textContent = content;
    } else {
      disposables.add(this.markdownRendererService.render(content, {
        sanitizerConfig: {
          replaceWithPlaintext: true,
          allowedTags: {
            override: allowedChatMarkdownHtmlTags
          },
          allowedLinkSchemes: { augment: [this.productService.urlProtocol] }
        }
      }, container));
    }
  }
  renderDiff(session, template) {
    const diff = getAgentChangesSummary(session.element.changes);
    if (!diff) {
      return false;
    }
    if (diff.insertions === 0 && diff.deletions === 0) {
      return false;
    }
    if (diff.insertions >= 0) {
      template.diffAddedSpan.textContent = `+${diff.insertions}`;
    }
    if (diff.deletions >= 0) {
      template.diffRemovedSpan.textContent = `-${diff.deletions}`;
    }
    return true;
  }
  getIcon(session) {
    return getAgentSessionStatusIcon(session);
  }
  renderDescription(session, template) {
    const description = session.element.description;
    if (description) {
      this.renderMarkdownOrText(description, template.description, template.elementDisposable);
      return true;
    }
    if (session.element.status === AgentSessionStatus.InProgress) {
      template.description.textContent = localize("chat.session.status.inProgress", "Working...");
      return true;
    } else if (session.element.status === AgentSessionStatus.NeedsInput) {
      template.description.textContent = localize("chat.session.status.needsInput", "Input needed.");
      return true;
    } else if (session.element.status === AgentSessionStatus.Failed) {
      template.description.textContent = localize("chat.session.status.failed", "Failed");
      return true;
    }
    template.description.textContent = "";
    return false;
  }
  toDuration(startTime, endTime, useFullTimeWords, disallowNow) {
    const elapsed = Math.max(
      Math.round((endTime - startTime) / 1e3) * 1e3,
      1e3
      /* clamp to 1s */
    );
    if (!disallowNow && elapsed < 6e4) {
      return localize("secondsDuration", "now");
    }
    return getDurationString(elapsed, useFullTimeWords);
  }
  renderStatus(session, template) {
    const repoPrefix = session.element.isPinned() && this.options.isGroupedByRepository?.() ? getRepositoryName(session.element) : void 0;
    const getStatusText = (session2) => {
      let timeLabel;
      if (session2.status === AgentSessionStatus.InProgress && session2.timing.lastRequestStarted) {
        timeLabel = this.toDuration(session2.timing.lastRequestStarted, Date.now(), false, false);
      }
      if (!timeLabel) {
        const date = this.options.isSortedByUpdated?.() ? session2.timing.lastRequestEnded ?? session2.timing.created : session2.timing.created;
        const seconds = Math.round(((/* @__PURE__ */ new Date()).getTime() - date) / 1e3);
        if (seconds < 60) {
          timeLabel = localize("secondsDuration", "now");
        } else {
          timeLabel = sessionDateFromNow(date, true);
        }
      }
      return repoPrefix ? `${repoPrefix} \xB7 ${timeLabel}` : timeLabel;
    };
    template.statusTime.textContent = getStatusText(session.element);
    const timer = template.elementDisposable.add(new IntervalTimer());
    timer.cancelAndSet(
      () => template.statusTime.textContent = getStatusText(session.element),
      session.element.status === AgentSessionStatus.InProgress ? 1e3 : 60 * 1e3
      /* every minute */
    );
    return true;
  }
  renderHover(session, template) {
    if (this.options.disableHover) {
      return;
    }
    if (!isSessionInProgressStatus(session.element.status) && session.element.isRead()) {
      return;
    }
    const reducedDelay = session.element.status === AgentSessionStatus.NeedsInput;
    template.elementDisposable.add(
      this.hoverService.setupDelayedHover(template.element, () => this.buildHoverContent(session.element), { groupId: "agent.sessions", reducedDelay })
    );
  }
  buildHoverContent(session) {
    if (this.sessionHover.value?.session.resource.toString() !== session.resource.toString()) {
      this.sessionHover.value = this.instantiationService.createInstance(AgentSessionHoverWidget, session);
    }
    const widget = this.sessionHover.value;
    let pauseDisposable;
    return {
      id: `agent.session.hover.${session.resource.toString()}`,
      content: widget.domNode,
      style: HoverStyle.Pointer,
      onDidShow: () => {
        const previousPauseDisposable = pauseDisposable;
        pauseDisposable = this.options.pauseSessionUpdates?.();
        previousPauseDisposable?.dispose();
        widget.onRendered();
      },
      onDidHide: () => {
        widget.onHidden();
        pauseDisposable?.dispose();
        pauseDisposable = void 0;
      },
      position: {
        hoverPosition: this.options.getHoverPosition()
      }
    };
  }
  renderApprovalRow(session, template) {
    if (this._approvalModel === void 0) {
      throw new BugIndicatingError("Approval model is required to render approval row");
    }
    const approvalModel = this._approvalModel;
    const initialInfo = approvalModel.getApproval(session.element.resource).get();
    let wasVisible = !!initialInfo;
    template.approvalRow.classList.toggle("visible", wasVisible);
    const buttonStore = template.elementDisposable.add(new DisposableStore());
    template.elementDisposable.add(autorun((reader) => {
      buttonStore.clear();
      const info = approvalModel.getApproval(session.element.resource).read(reader);
      const visible = !!info;
      template.approvalRow.classList.toggle("visible", visible);
      if (info) {
        const lines = info.label.split("\n");
        const maxLines = AgentSessionRenderer.APPROVAL_ROW_MAX_LINES;
        const visibleLines = lines.slice(0, maxLines);
        if (lines.length > maxLines) {
          visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1]} \u2026`;
        }
        const langId = info.languageId ?? "json";
        const labelContent = new MarkdownString();
        for (const line of visibleLines) {
          labelContent.appendCodeblock(langId, line);
        }
        this.renderMarkdownOrText(labelContent, template.approvalLabel, buttonStore);
        const fullContent = new MarkdownString().appendCodeblock(info.languageId ?? "json", info.label);
        buttonStore.add(this.hoverService.setupDelayedHover(template.approvalLabel, {
          content: fullContent,
          style: HoverStyle.Pointer,
          position: { hoverPosition: HoverPosition.BELOW }
        }));
        template.approvalButtonContainer.textContent = "";
        const isActive = this._activeSessionResource.read(reader)?.toString() === session.element.resource.toString();
        const button = buttonStore.add(new Button(template.approvalButtonContainer, {
          title: localize("allowActionOnce", "Allow once"),
          secondary: isActive,
          ...defaultButtonStyles
        }));
        button.label = localize("allowAction", "Allow");
        buttonStore.add(button.onDidClick(() => info.confirm()));
      }
      if (wasVisible !== visible) {
        wasVisible = visible;
        this._onDidChangeItemHeight.fire(session.element);
      }
    }));
  }
  renderCompressedElements(node, index, templateData, details) {
    throw new Error("Should never happen since session is incompressible");
  }
  disposeElement(element, index, template, details) {
    template.elementDisposable.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
AgentSessionRenderer = __decorateClass([
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IChatSessionsService),
  __decorateParam(9, IAccessibilityService),
  __decorateParam(10, IVoicePlaybackService)
], AgentSessionRenderer);
function toStatusLabel(status) {
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
let AgentSessionSectionRenderer = class {
  constructor(sectionOptions, instantiationService, contextKeyService) {
    this.sectionOptions = sectionOptions;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = AgentSessionSectionRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "agent-session-section";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    container.closest(".monaco-list-row")?.classList.add("agent-session-list-row", "agent-session-section-row");
    const elements = h(
      "div.agent-session-section@container",
      [
        h("span.agent-session-section-label@label"),
        h("span.agent-session-section-count@count"),
        h("div.agent-session-section-toolbar@toolbar")
      ]
    );
    const contextKeyService = disposables.add(this.contextKeyService.createScoped(elements.container));
    const scopedInstantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const toolbar = disposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, elements.toolbar, MenuId.AgentSessionSectionToolbar, {
      menuOptions: { shouldForwardArgs: true }
    }));
    container.appendChild(elements.container);
    return {
      container: elements.container,
      label: elements.label,
      count: elements.count,
      toolbar,
      contextKeyService,
      disposables
    };
  }
  renderElement(element, index, template, details) {
    template.label.textContent = element.element.label;
    if (this.sectionOptions.hideSectionCount) {
      template.count.textContent = "";
    } else {
      template.count.textContent = String(element.element.sessions.length);
    }
    ChatContextKeys.agentSessionSection.bindTo(template.contextKeyService).set(element.element.section);
    template.toolbar.context = element.element;
  }
  renderCompressedElements(node, index, templateData, details) {
    throw new Error("Should never happen since section header is incompressible");
  }
  disposeElement(element, index, template, details) {
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
AgentSessionSectionRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService)
], AgentSessionSectionRenderer);
class AgentSessionShowMoreRenderer {
  constructor(options) {
    this.options = options;
    this.templateId = AgentSessionShowMoreRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "agent-session-show-more";
  }
  static {
    this.HEIGHT = 26;
  }
  static {
    this.COLLAPSED_HEIGHT = 1;
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elements = h(
      "div.agent-session-show-more@container",
      [h("span.agent-session-show-more-label@label")]
    );
    container.appendChild(elements.container);
    return {
      container: elements.container,
      label: elements.label,
      disposables
    };
  }
  renderElement(element, _index, template) {
    template.label.textContent = this.options?.compactLabel ? localize("agentSessions.showMoreCompact", "+{0} more", element.element.remainingCount) : localize("agentSessions.showMore", "Show {0} More...", element.element.remainingCount);
    template.container.setAttribute("data-section-label", element.element.sectionLabel);
  }
  renderCompressedElements() {
    throw new Error("Should never happen since show-more is incompressible");
  }
  disposeElement() {
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
}
class AgentSessionShowLessRenderer {
  constructor() {
    this.templateId = AgentSessionShowLessRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "agent-session-show-less";
  }
  static {
    this.HEIGHT = AgentSessionShowMoreRenderer.HEIGHT;
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elements = h(
      "div.agent-session-show-more@container",
      [h("span.agent-session-show-more-label@label")]
    );
    container.appendChild(elements.container);
    return {
      container: elements.container,
      label: elements.label,
      disposables
    };
  }
  renderElement(element, _index, template) {
    template.label.textContent = localize("agentSessions.showLess", "Show less");
    template.container.setAttribute("data-section-label", element.element.sectionLabel);
  }
  renderCompressedElements() {
    throw new Error("Should never happen since show-less is incompressible");
  }
  disposeElement() {
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
}
class AgentSessionsListDelegate {
  constructor(_approvalModel, _compactShowMore, _getItemHeight = () => AgentSessionsListDelegate.ITEM_HEIGHT, _getSectionHeight = () => AgentSessionsListDelegate.SECTION_HEIGHT) {
    this._approvalModel = _approvalModel;
    this._compactShowMore = _compactShowMore;
    this._getItemHeight = _getItemHeight;
    this._getSectionHeight = _getSectionHeight;
  }
  static {
    this.ITEM_HEIGHT = 54;
  }
  static {
    this.COMPACT_ITEM_HEIGHT = 52;
  }
  static {
    this.SECTION_HEIGHT = 26;
  }
  static {
    this.SPACED_SECTION_HEIGHT = 30;
  }
  getHeight(element) {
    if (isAgentSessionSection(element)) {
      return this._getSectionHeight();
    }
    if (isAgentSessionShowMore(element) || isAgentSessionShowLess(element)) {
      return this._compactShowMore ? AgentSessionShowMoreRenderer.COLLAPSED_HEIGHT : AgentSessionShowMoreRenderer.HEIGHT;
    }
    let height = this._getItemHeight();
    const approval = this._approvalModel?.getApproval(element.resource).get();
    if (approval) {
      height += AgentSessionRenderer.getApprovalRowHeight(approval.label);
    }
    return height;
  }
  hasDynamicHeight(element) {
    if (isAgentSessionShowMore(element) || isAgentSessionShowLess(element)) {
      return true;
    }
    return !!this._approvalModel && isAgentSession(element);
  }
  getTemplateId(element) {
    if (isAgentSessionSection(element)) {
      return AgentSessionSectionRenderer.TEMPLATE_ID;
    }
    if (isAgentSessionShowMore(element)) {
      return AgentSessionShowMoreRenderer.TEMPLATE_ID;
    }
    if (isAgentSessionShowLess(element)) {
      return AgentSessionShowLessRenderer.TEMPLATE_ID;
    }
    return AgentSessionRenderer.TEMPLATE_ID;
  }
}
class AgentSessionsAccessibilityProvider {
  getWidgetRole() {
    return "list";
  }
  getRole(element) {
    return "listitem";
  }
  getWidgetAriaLabel() {
    return localize("agentSessions", "Agent Sessions");
  }
  getAriaLabel(element) {
    if (isAgentSessionSection(element)) {
      const count = element.sessions.length;
      if (count === 1) {
        return localize("agentSessionSectionAriaLabel.singular", "{0} sessions section, {1} session", element.label, count);
      }
      return localize("agentSessionSectionAriaLabel.plural", "{0} sessions section, {1} sessions", element.label, count);
    }
    if (isAgentSessionShowMore(element)) {
      return localize("agentSessionShowMoreAriaLabel", "Show {0} more sessions", element.remainingCount);
    }
    if (isAgentSessionShowLess(element)) {
      return localize("agentSessionShowLessAriaLabel", "Show less sessions");
    }
    return localize("agentSessionItemAriaLabel", "{0} session {1} ({2}), created {3}", element.providerLabel, element.label, toStatusLabel(element.status), new Date(element.timing.created).toLocaleString());
  }
}
class AgentSessionsDataSource extends Disposable {
  constructor(filter, sorter, repositoryGroupLimit) {
    super();
    this.filter = filter;
    this.sorter = sorter;
    this.repositoryGroupLimit = repositoryGroupLimit;
    this._onDidGetChildren = this._register(new Emitter());
    this.onDidGetChildren = this._onDidGetChildren.event;
    this._onDidExpandRepositoryGroup = this._register(new Emitter());
    this.onDidExpandRepositoryGroup = this._onDidExpandRepositoryGroup.event;
    this.expandedRepositoryGroups = /* @__PURE__ */ new Set();
    if (this.filter) {
      let previousCapped = this.filter.getExcludes().repositoryGroupCapped;
      this._register(this.filter.onDidChange(() => {
        const currentCapped = this.filter.getExcludes().repositoryGroupCapped;
        if (currentCapped && !previousCapped) {
          this.expandedRepositoryGroups.clear();
        }
        previousCapped = currentCapped;
      }));
    }
  }
  static {
    this.CAPPED_SESSIONS_LIMIT = 3;
  }
  static {
    this.REPOSITORY_GROUP_LIMIT = 5;
  }
  expandRepositoryGroup(sectionLabel) {
    this.expandedRepositoryGroups.add(sectionLabel);
    this._onDidExpandRepositoryGroup.fire();
  }
  collapseRepositoryGroup(sectionLabel) {
    this.expandedRepositoryGroups.delete(sectionLabel);
    this._onDidExpandRepositoryGroup.fire();
  }
  hasChildren(element) {
    if (isAgentSessionsModel(element)) {
      return true;
    } else if (isAgentSessionSection(element)) {
      return element.sessions.length > 0;
    } else {
      return false;
    }
  }
  getChildren(element) {
    if (isAgentSessionsModel(element)) {
      let filteredSessions = element.sessions.filter((session) => !this.filter?.exclude(session));
      const limitResultsCount = this.filter?.limitResults?.();
      if (!this.filter?.groupResults?.() || typeof limitResultsCount === "number") {
        filteredSessions.sort(this.sorter.compare.bind(this.sorter));
      }
      if (typeof limitResultsCount === "number") {
        filteredSessions = filteredSessions.slice(0, limitResultsCount);
      }
      this.filter?.notifyResults?.(filteredSessions.length);
      this._onDidGetChildren.fire(filteredSessions.length);
      if (this.filter?.groupResults?.()) {
        return this.groupSessionsIntoSections(filteredSessions);
      }
      return filteredSessions;
    } else if (isAgentSessionSection(element)) {
      const isCappingEnabled = this.repositoryGroupLimit && this.filter?.getExcludes().repositoryGroupCapped;
      if (isCappingEnabled && element.section === AgentSessionSection.Repository && element.sessions.length > this.repositoryGroupLimit) {
        if (!this.expandedRepositoryGroups.has(element.label)) {
          const visible = element.sessions.slice(0, this.repositoryGroupLimit);
          const remainingCount = element.sessions.length - this.repositoryGroupLimit;
          return [...visible, { showMore: true, sectionLabel: element.label, remainingCount }];
        } else {
          return [...element.sessions, { showLess: true, sectionLabel: element.label }];
        }
      }
      return element.sessions;
    } else {
      return [];
    }
  }
  groupSessionsIntoSections(sessions) {
    const isCapped = this.filter?.groupResults?.() === AgentSessionsGrouping.Capped;
    const sorter = this.sorter;
    const sortedSessions = sorter instanceof AgentSessionsSorter ? sessions.sort((a, b) => sorter.compare(
      a,
      b,
      true
      /* prioritize active sessions to keep in-progress/needs-input ones top within each group */
    )) : sessions.sort(sorter.compare.bind(sorter));
    if (isCapped) {
      if (this.filter?.getExcludes().read) {
        return sortedSessions;
      }
      return this.groupSessionsCapped(sortedSessions);
    } else if (this.filter?.groupResults?.() === AgentSessionsGrouping.Repository) {
      return this.groupSessionsByRepository(sortedSessions);
    } else {
      return this.groupSessionsByDate(sortedSessions);
    }
  }
  groupSessionsCapped(sortedSessions) {
    const result = [];
    const firstArchivedIndex = sortedSessions.findIndex((session) => session.isArchived());
    const nonArchivedCount = firstArchivedIndex === -1 ? sortedSessions.length : firstArchivedIndex;
    const nonArchivedSessions = sortedSessions.slice(0, nonArchivedCount);
    const archivedSessions = sortedSessions.slice(nonArchivedCount);
    const pinnedSessions = nonArchivedSessions.filter((session) => session.isPinned());
    const unpinnedSessions = nonArchivedSessions.filter((session) => !session.isPinned());
    const topUnpinned = unpinnedSessions.slice(0, AgentSessionsDataSource.CAPPED_SESSIONS_LIMIT);
    const remainingUnpinned = unpinnedSessions.slice(AgentSessionsDataSource.CAPPED_SESSIONS_LIMIT);
    result.push(...pinnedSessions, ...topUnpinned);
    const othersSessions = [...remainingUnpinned, ...archivedSessions];
    if (othersSessions.length > 0) {
      result.push({
        section: AgentSessionSection.More,
        label: AgentSessionSectionLabels[AgentSessionSection.More],
        sessions: othersSessions
      });
    }
    return result;
  }
  groupSessionsByDate(sortedSessions) {
    const result = [];
    const sortBy = this.filter?.sortResults?.();
    const groupedSessions = groupAgentSessionsByDate(sortedSessions, sortBy);
    for (const { sessions, section, label } of groupedSessions.values()) {
      if (sessions.length === 0) {
        continue;
      }
      result.push({ section, label, sessions });
    }
    return result;
  }
  groupSessionsByRepository(sortedSessions) {
    const repoMap = /* @__PURE__ */ new Map();
    const pinnedSessions = [];
    const archivedSessions = [];
    const otherSessions = [];
    for (const session of sortedSessions) {
      if (session.isArchived()) {
        archivedSessions.push(session);
        continue;
      }
      if (session.isPinned()) {
        pinnedSessions.push(session);
        continue;
      }
      const repoName = getRepositoryName(session);
      if (repoName) {
        let group = repoMap.get(repoName);
        if (!group) {
          group = { label: repoName, sessions: [] };
          repoMap.set(repoName, group);
        }
        group.sessions.push(session);
      } else {
        otherSessions.push(session);
      }
    }
    const result = [];
    result.push(...pinnedSessions);
    const sortedRepoGroups = [...repoMap.values()].sort((a, b) => compareIgnoreCase(a.label, b.label));
    for (const { label, sessions } of sortedRepoGroups) {
      result.push({
        section: AgentSessionSection.Repository,
        label,
        sessions
      });
    }
    if (otherSessions.length > 0) {
      result.push({
        section: AgentSessionSection.Repository,
        label: AgentSessionSectionLabels[AgentSessionSection.Repository],
        sessions: otherSessions
      });
    }
    if (archivedSessions.length > 0) {
      result.push({
        section: AgentSessionSection.Archived,
        label: AgentSessionSectionLabels[AgentSessionSection.Archived],
        sessions: archivedSessions
      });
    }
    return result;
  }
}
function getRepositoryName(session) {
  const metadata = session.metadata;
  if (metadata) {
    const remoteAgentHost = metadata.remoteAgentHost;
    if (remoteAgentHost) {
      const workingDir = metadata.workingDirectoryPath;
      if (workingDir) {
        const folderName = extractRepoNameFromPath(workingDir);
        if (folderName) {
          return `${folderName} [${remoteAgentHost}]`;
        }
      }
      return remoteAgentHost;
    }
    const owner = metadata.owner;
    const name = metadata.name;
    if (owner && name) {
      return name;
    }
    const nwo = metadata.repositoryNwo;
    if (nwo && nwo.includes("/")) {
      return nwo.split("/").pop();
    }
    const repository = metadata.repository;
    if (repository) {
      const repoName = parseRepositoryName(repository);
      if (repoName) {
        return repoName;
      }
    }
    const repositoryUrl = metadata.repositoryUrl;
    if (repositoryUrl) {
      const repoName = parseRepositoryName(repositoryUrl);
      if (repoName) {
        return repoName;
      }
    }
    const repositoryPath = metadata.repositoryPath;
    if (repositoryPath) {
      const repoName = extractRepoNameFromPath(repositoryPath);
      if (repoName) {
        return repoName;
      }
    }
    const worktreePath = metadata.worktreePath;
    if (worktreePath) {
      const repoName = extractRepoNameFromPath(worktreePath);
      if (repoName) {
        return repoName;
      }
    }
    const workingDirectoryPath = metadata.workingDirectoryPath;
    if (workingDirectoryPath) {
      const repoName = extractRepoNameFromPath(workingDirectoryPath);
      if (repoName) {
        return repoName;
      }
    }
  }
  const badge = session.badge;
  if (badge) {
    const raw = typeof badge === "string" ? badge : badge.value;
    const badgeMatch = raw.match(/\$\((?:repo|folder|worktree)\)\s*(.+)/);
    if (badgeMatch) {
      return badgeMatch[1].trim();
    }
  }
  return void 0;
}
function parseRepositoryName(value) {
  if (value.includes("/") && !value.includes("://") && !value.startsWith("git@")) {
    let repoSegment = value.split("/").filter(Boolean).pop();
    if (repoSegment?.endsWith(".git")) {
      repoSegment = repoSegment.slice(0, -4);
    }
    return repoSegment || void 0;
  }
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      let repoSegment = parts[1];
      if (repoSegment.endsWith(".git")) {
        repoSegment = repoSegment.slice(0, -4);
      }
      return repoSegment || void 0;
    }
  } catch {
  }
  if (value.startsWith("git@")) {
    const colonIndex = value.indexOf(":");
    if (colonIndex !== -1 && colonIndex < value.length - 1) {
      const pathPart = value.substring(colonIndex + 1);
      let repoSegment = pathPart.split("/").filter(Boolean).pop();
      if (repoSegment?.endsWith(".git")) {
        repoSegment = repoSegment.slice(0, -4);
      }
      return repoSegment || void 0;
    }
  }
  return void 0;
}
function extractRepoNameFromPath(dirPath) {
  const segments = dirPath.split(/[/\\]/).filter(Boolean);
  if (segments.length < 2) {
    return segments[0];
  }
  const parent = segments[segments.length - 2];
  if (parent.endsWith(".worktrees")) {
    return parent.slice(0, -".worktrees".length) || void 0;
  }
  return segments[segments.length - 1];
}
const AgentSessionSectionLabels = {
  [AgentSessionSection.Pinned]: localize("agentSessions.pinnedSection", "Pinned"),
  [AgentSessionSection.Today]: localize("agentSessions.todaySection", "Today"),
  [AgentSessionSection.Yesterday]: localize("agentSessions.yesterdaySection", "Yesterday"),
  [AgentSessionSection.Week]: localize("agentSessions.weekSection", "Last 7 days"),
  [AgentSessionSection.Older]: localize("agentSessions.olderSection", "Older"),
  [AgentSessionSection.Archived]: localize("agentSessions.archivedSection", "Archived"),
  [AgentSessionSection.More]: localize("agentSessions.moreSection", "More"),
  [AgentSessionSection.Repository]: localize("agentSessions.noRepository", "Other")
};
const DAY_THRESHOLD = 24 * 60 * 60 * 1e3;
const WEEK_THRESHOLD = 7 * DAY_THRESHOLD;
function groupAgentSessionsByDate(sessions, sortBy) {
  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - DAY_THRESHOLD;
  const weekThreshold = now - WEEK_THRESHOLD;
  const pinnedSessions = [];
  const todaySessions = [];
  const yesterdaySessions = [];
  const weekSessions = [];
  const olderSessions = [];
  const archivedSessions = [];
  for (const session of sessions) {
    if (session.isArchived()) {
      archivedSessions.push(session);
    } else if (session.isPinned()) {
      pinnedSessions.push(session);
    } else {
      const sessionTime = sortBy === AgentSessionsSorting.Updated ? session.timing.lastRequestEnded ?? session.timing.created : session.timing.created;
      if (sessionTime >= startOfToday) {
        todaySessions.push(session);
      } else if (sessionTime >= startOfYesterday) {
        yesterdaySessions.push(session);
      } else if (sessionTime >= weekThreshold) {
        weekSessions.push(session);
      } else {
        olderSessions.push(session);
      }
    }
  }
  return /* @__PURE__ */ new Map([
    [AgentSessionSection.Pinned, { section: AgentSessionSection.Pinned, label: AgentSessionSectionLabels[AgentSessionSection.Pinned], sessions: pinnedSessions }],
    [AgentSessionSection.Today, { section: AgentSessionSection.Today, label: AgentSessionSectionLabels[AgentSessionSection.Today], sessions: todaySessions }],
    [AgentSessionSection.Yesterday, { section: AgentSessionSection.Yesterday, label: AgentSessionSectionLabels[AgentSessionSection.Yesterday], sessions: yesterdaySessions }],
    [AgentSessionSection.Week, { section: AgentSessionSection.Week, label: AgentSessionSectionLabels[AgentSessionSection.Week], sessions: weekSessions }],
    [AgentSessionSection.Older, { section: AgentSessionSection.Older, label: AgentSessionSectionLabels[AgentSessionSection.Older], sessions: olderSessions }],
    [AgentSessionSection.Archived, { section: AgentSessionSection.Archived, label: AgentSessionSectionLabels[AgentSessionSection.Archived], sessions: archivedSessions }]
  ]);
}
function sessionDateFromNow(sessionTime, appendAgoLabel) {
  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - DAY_THRESHOLD;
  const startOfTwoDaysAgo = startOfYesterday - DAY_THRESHOLD;
  if (sessionTime < startOfToday && sessionTime >= startOfYesterday) {
    return appendAgoLabel ? localize("date.fromNow.days.singular.ago", "1 day ago") : localize("date.fromNow.days.singular", "1 day");
  }
  if (sessionTime < startOfYesterday && sessionTime >= startOfTwoDaysAgo) {
    return appendAgoLabel ? localize("date.fromNow.days.multiple.ago", "2 days ago") : localize("date.fromNow.days.multiple", "2 days");
  }
  return fromNow(sessionTime, appendAgoLabel);
}
class AgentSessionsIdentityProvider {
  getId(element) {
    if (isAgentSessionSection(element)) {
      return `section-${element.section}-${element.label}`;
    }
    if (isAgentSessionShowMore(element)) {
      return `show-more-${element.sectionLabel}`;
    }
    if (isAgentSessionShowLess(element)) {
      return `show-less-${element.sectionLabel}`;
    }
    if (isAgentSession(element)) {
      return element.resource.toString();
    }
    return "agent-sessions-id";
  }
  getGroupId(element) {
    if (isAgentSessionSection(element) || isAgentSessionsModel(element)) {
      return NotSelectableGroupId;
    }
    return 1;
  }
}
class AgentSessionsCompressionDelegate {
  isIncompressible(element) {
    return true;
  }
}
class AgentSessionsSorter {
  constructor(getSortBy) {
    this.getSortBy = getSortBy ?? (() => AgentSessionsSorting.Created);
  }
  compare(sessionA, sessionB, prioritizeActiveSessions = false) {
    if (prioritizeActiveSessions) {
      const aNeedsInput = sessionA.status === AgentSessionStatus.NeedsInput;
      const bNeedsInput = sessionB.status === AgentSessionStatus.NeedsInput;
      if (aNeedsInput && !bNeedsInput) {
        return -1;
      }
      if (!aNeedsInput && bNeedsInput) {
        return 1;
      }
    }
    const aArchived = sessionA.isArchived();
    const bArchived = sessionB.isArchived();
    if (!aArchived && bArchived) {
      return -1;
    }
    if (aArchived && !bArchived) {
      return 1;
    }
    const aPinned = !aArchived && sessionA.isPinned();
    const bPinned = !bArchived && sessionB.isPinned();
    if (aPinned && !bPinned) {
      return -1;
    }
    if (!aPinned && bPinned) {
      return 1;
    }
    const sortBy = this.getSortBy();
    const timeA = sortBy === AgentSessionsSorting.Updated ? prioritizeActiveSessions ? sessionA.timing.lastRequestStarted ?? sessionA.timing.created : sessionA.timing.lastRequestEnded ?? sessionA.timing.created : sessionA.timing.created;
    const timeB = sortBy === AgentSessionsSorting.Updated ? prioritizeActiveSessions ? sessionB.timing.lastRequestStarted ?? sessionB.timing.created : sessionB.timing.lastRequestEnded ?? sessionB.timing.created : sessionB.timing.created;
    return timeB - timeA;
  }
}
class AgentSessionsKeyboardNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    if (isAgentSessionSection(element)) {
      return element.label;
    }
    if (isAgentSessionShowMore(element)) {
      return element.sectionLabel;
    }
    if (isAgentSessionShowLess(element)) {
      return element.sectionLabel;
    }
    return element.label;
  }
  getCompressedNodeKeyboardNavigationLabel(elements) {
    return void 0;
  }
}
let AgentSessionsDragAndDrop = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
  }
  onDragStart(data, originalEvent) {
    const elements = data.getData().filter((e) => isAgentSession(e));
    const uris = coalesce(elements.map((e) => e.resource));
    this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, uris, originalEvent));
  }
  getDragURI(element) {
    if (isAgentSessionSection(element) || isAgentSessionShowMore(element) || isAgentSessionShowLess(element)) {
      return null;
    }
    return element.resource.toString();
  }
  getDragLabel(elements, originalEvent) {
    const sessions = elements.filter((e) => isAgentSession(e));
    if (sessions.length === 1) {
      return sessions[0].label;
    }
    return localize("agentSessions.dragLabel", "{0} agent sessions", sessions.length);
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    return false;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
  }
};
AgentSessionsDragAndDrop = __decorateClass([
  __decorateParam(0, IInstantiationService)
], AgentSessionsDragAndDrop);
export {
  AgentSessionRenderer,
  AgentSessionSectionLabels,
  AgentSessionSectionRenderer,
  AgentSessionShowLessRenderer,
  AgentSessionShowMoreRenderer,
  AgentSessionsAccessibilityProvider,
  AgentSessionsCompressionDelegate,
  AgentSessionsDataSource,
  AgentSessionsDragAndDrop,
  AgentSessionsIdentityProvider,
  AgentSessionsKeyboardNavigationLabelProvider,
  AgentSessionsListDelegate,
  AgentSessionsSorter,
  getAgentSessionStatusIcon,
  getRepositoryName,
  groupAgentSessionsByDate,
  sessionDateFromNow,
  toStatusLabel
};
