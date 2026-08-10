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
import * as DOM from "../../../../../base/browser/dom.js";
import { autorun } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ViewPane } from "../../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IAuthenticationService } from "../../../../services/authentication/common/authentication.js";
import { IVoiceSessionController } from "../../../chat/browser/voiceClient/voiceSessionController.js";
import { IVoiceTranscriptStore } from "../../common/voiceTranscriptStore.js";
const $ = DOM.$;
let VoiceTranscriptsViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, voiceTranscriptStore, authenticationService, voiceSessionController, logService) {
    super(
      options,
      keybindingService,
      contextMenuService,
      configurationService,
      contextKeyService,
      viewDescriptorService,
      instantiationService,
      openerService,
      themeService,
      hoverService
    );
    this.voiceTranscriptStore = voiceTranscriptStore;
    this.authenticationService = authenticationService;
    this.voiceSessionController = voiceSessionController;
    this.logService = logService;
    let lastState;
    this._register(autorun((reader) => {
      const state = this.voiceSessionController.voiceState.read(reader);
      const wasMidTurn = lastState === "speaking" || lastState === "processing";
      const nowIdle = state === "idle" || state === "listening";
      lastState = state;
      if (wasMidTurn && nowIdle && this.isBodyVisible()) {
        void this.refresh();
      }
    }));
  }
  static {
    this.ID = "workbench.view.voiceTranscripts";
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("voice-transcripts-view");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.overflow = "hidden";
    this.contentContainer = DOM.append(container, $(".voice-transcripts-content"));
    this.contentContainer.style.flex = "1";
    this.contentContainer.style.overflowY = "auto";
    this.contentContainer.style.padding = "6px 12px 12px";
    this.contentContainer.style.fontSize = "13px";
    this.emptyState = DOM.append(container, $(".voice-transcripts-empty"));
    this.emptyState.style.display = "none";
    this.emptyState.style.padding = "24px 16px";
    this.emptyState.style.textAlign = "center";
    this.emptyState.style.color = "var(--vscode-descriptionForeground)";
    this.emptyState.style.fontSize = "13px";
    this.emptyState.textContent = localize(
      "voiceTranscripts.empty",
      "No transcripts yet. Start a voice conversation to populate this view."
    );
    void this.refresh();
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
  }
  /**
   * Re-read the transcript JSONL and re-render. Cheap; the file is text-only
   * and bounded by the user's actual usage.
   */
  async refresh() {
    if (!this.contentContainer || !this.emptyState) {
      return;
    }
    try {
      this.userLogin = await this.resolveUserLogin();
      if (!this.userLogin) {
        this.renderEmpty();
        return;
      }
      const turns = await this.voiceTranscriptStore.loadTurns(this.userLogin);
      const indexEntry = this.voiceTranscriptStore.getIndexEntry(this.userLogin);
      const archiveCutoff = indexEntry?.archivedBefore;
      const spoken = turns.filter((t) => t.kind === "user_voice" || t.kind === "agent_voice");
      const visible = archiveCutoff ? spoken.filter((t) => t.timestamp >= archiveCutoff) : spoken;
      const archivedCount = spoken.length - visible.length;
      if (visible.length === 0 && archivedCount === 0) {
        this.renderEmpty();
        return;
      }
      this.renderTurns(visible, archivedCount);
    } catch (err) {
      this.logService.warn("[voiceTranscripts] refresh failed", err);
      this.renderEmpty();
    }
  }
  async archiveAll() {
    if (!this.userLogin) {
      this.userLogin = await this.resolveUserLogin();
    }
    if (!this.userLogin) {
      return;
    }
    const cutoff = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await this.voiceTranscriptStore.archiveUpTo(this.userLogin, cutoff);
    } catch (err) {
      this.logService.warn("[voiceTranscripts] archiveUpTo failed", err);
    }
    await this.refresh();
  }
  async deleteAll() {
    if (!this.userLogin) {
      this.userLogin = await this.resolveUserLogin();
    }
    if (!this.userLogin) {
      return;
    }
    try {
      await this.voiceTranscriptStore.deleteAll(this.userLogin);
    } catch (err) {
      this.logService.warn("[voiceTranscripts] deleteAll failed", err);
    }
    await this.refresh();
  }
  // --- Internals ---
  async resolveUserLogin() {
    try {
      const sessions = await this.authenticationService.getSessions("github");
      return sessions[0]?.account.label;
    } catch (err) {
      this.logService.warn("[voiceTranscripts] failed to resolve github session", err);
      return void 0;
    }
  }
  renderEmpty() {
    if (!this.contentContainer || !this.emptyState) {
      return;
    }
    DOM.clearNode(this.contentContainer);
    this.contentContainer.style.display = "none";
    this.emptyState.style.display = "block";
  }
  renderTurns(turns, archivedCount) {
    if (!this.contentContainer || !this.emptyState) {
      return;
    }
    this.emptyState.style.display = "none";
    this.contentContainer.style.display = "block";
    DOM.clearNode(this.contentContainer);
    const groups = groupTurnsByTime(turns).filter((g) => g.pairs.length > 0);
    for (const group of groups) {
      this.renderGroup(group);
    }
    if (archivedCount > 0) {
      const archived = DOM.append(this.contentContainer, $(".voice-transcripts-archived-note"));
      archived.style.marginTop = "12px";
      archived.style.fontSize = "11px";
      archived.style.color = "var(--vscode-descriptionForeground)";
      archived.style.fontStyle = "italic";
      archived.textContent = localize(
        "voiceTranscripts.archivedNote",
        "{0} archived turn{1} hidden.",
        archivedCount,
        archivedCount === 1 ? "" : "s"
      );
    }
  }
  renderGroup(group) {
    if (!this.contentContainer) {
      return;
    }
    const groupEl = DOM.append(this.contentContainer, $(".voice-transcripts-group"));
    groupEl.style.marginBottom = "14px";
    const heading = DOM.append(groupEl, $(".voice-transcripts-group-heading"));
    heading.textContent = group.label;
    heading.style.fontSize = "11px";
    heading.style.fontWeight = "600";
    heading.style.textTransform = "uppercase";
    heading.style.letterSpacing = "0.5px";
    heading.style.color = "var(--vscode-descriptionForeground)";
    heading.style.padding = "4px 0 6px";
    heading.style.borderBottom = "1px solid var(--vscode-editorWhitespace-foreground)";
    heading.style.marginBottom = "4px";
    for (const pair of group.pairs) {
      this.renderPair(groupEl, pair);
    }
  }
  renderPair(parent, pair) {
    const pairEl = DOM.append(parent, $(".voice-transcripts-pair"));
    pairEl.style.padding = "6px 0";
    pairEl.style.borderBottom = "1px solid var(--vscode-editorWhitespace-foreground)";
    const time = DOM.append(pairEl, $(".voice-transcripts-time"));
    time.textContent = formatTime(pair.timestamp);
    time.style.fontSize = "10px";
    time.style.color = "var(--vscode-descriptionForeground)";
    time.style.marginBottom = "4px";
    if (pair.user) {
      this.renderRow(pairEl, "You", pair.user.text);
    }
    if (pair.assistant) {
      this.renderRow(pairEl, "Voice", pair.assistant.text);
    }
  }
  renderRow(parent, label, text) {
    const row = DOM.append(parent, $(".voice-transcripts-row"));
    row.style.display = "flex";
    row.style.gap = "6px";
    row.style.alignItems = "baseline";
    row.style.marginBottom = "3px";
    row.style.lineHeight = "1.4";
    const labelEl = DOM.append(row, $("span"));
    labelEl.textContent = `${label}:`;
    labelEl.style.fontSize = "11px";
    labelEl.style.fontWeight = "600";
    labelEl.style.color = "var(--vscode-descriptionForeground)";
    labelEl.style.flex = "0 0 auto";
    labelEl.style.minWidth = "32px";
    const textEl = DOM.append(row, $("span"));
    textEl.textContent = text;
    textEl.style.fontSize = "13px";
    textEl.style.color = "var(--vscode-foreground)";
    textEl.style.whiteSpace = "pre-wrap";
    textEl.style.wordBreak = "break-word";
  }
};
VoiceTranscriptsViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IVoiceTranscriptStore),
  __decorateParam(11, IAuthenticationService),
  __decorateParam(12, IVoiceSessionController),
  __decorateParam(13, ILogService)
], VoiceTranscriptsViewPane);
function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function groupTurnsByTime(turns) {
  if (turns.length === 0) {
    return [];
  }
  const now = /* @__PURE__ */ new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1e3);
  const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
  const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1e3);
  const buckets = [
    { label: localize("voiceTranscripts.today", "Today"), pairs: [] },
    { label: localize("voiceTranscripts.yesterday", "Yesterday"), pairs: [] },
    { label: localize("voiceTranscripts.earlierWeek", "Earlier this week"), pairs: [] },
    { label: localize("voiceTranscripts.earlierMonth", "Earlier this month"), pairs: [] },
    { label: localize("voiceTranscripts.older", "Older"), pairs: [] }
  ];
  for (const turn of turns) {
    const ts = new Date(turn.timestamp);
    let bucket;
    if (ts >= today) {
      bucket = buckets[0];
    } else if (ts >= yesterday) {
      bucket = buckets[1];
    } else if (ts >= weekStart) {
      bucket = buckets[2];
    } else if (ts >= monthStart) {
      bucket = buckets[3];
    } else {
      bucket = buckets[4];
    }
    const last = bucket.pairs[bucket.pairs.length - 1];
    if (turn.role === "user") {
      bucket.pairs.push({ user: turn, timestamp: turn.timestamp });
    } else if (last && !last.assistant) {
      last.assistant = turn;
    } else {
      bucket.pairs.push({ assistant: turn, timestamp: turn.timestamp });
    }
  }
  return buckets;
}
export {
  VoiceTranscriptsViewPane
};
