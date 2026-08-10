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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { autorun, derived, observableValue } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { AgentSessionApprovalKind, AgentSessionApprovalModel, agentSessionApprovalId } from "../../../../workbench/contrib/chat/browser/agentSessions/agentSessionApprovalModel.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { BlockedSessionReason, BlockedSessions } from "../../blockedSessions/browser/blockedSessions.js";
import { BlockedSessionsCIFixModel } from "./blockedSessionsCIFixModel.js";
import { getFirstApprovalAcrossChats } from "./views/sessionsList.js";
var RequiresInputKind = /* @__PURE__ */ ((RequiresInputKind2) => {
  RequiresInputKind2[RequiresInputKind2["TerminalApproval"] = 0] = "TerminalApproval";
  RequiresInputKind2[RequiresInputKind2["Question"] = 1] = "Question";
  RequiresInputKind2[RequiresInputKind2["FailingCI"] = 2] = "FailingCI";
  return RequiresInputKind2;
})(RequiresInputKind || {});
let BlockedSessionsIndicatorModel = class extends Disposable {
  constructor(approvalModel, blockedSessions, ciFixModel, _sessionsService, instantiationService, productService) {
    super();
    this._sessionsService = _sessionsService;
    /** Current blocked occurrences the user has already acknowledged, keyed by session id. */
    this._ignoredBlockOccurrences = observableValue("ignoredBlockOccurrences", /* @__PURE__ */ new Map());
    /**
     * Latest blocked occurrence per session, independent of visibility. Used so the
     * attention blink only fires for a genuinely new input request or CI failure.
     */
    this._lastBlockedOccurrences = /* @__PURE__ */ new Map();
    /**
     * Not-yet-visible blocked occurrences whose attention blink has not played yet.
     */
    this._pendingBlinkOccurrences = /* @__PURE__ */ new Map();
    this._onDidRequestBlink = this._register(new Emitter());
    /**
     * Fires when a genuinely new, not-yet-visible session becomes blocked and the
     * indicator should play its attention blink. Consumers should re-render and
     * call {@link consumePendingBlink}.
     */
    this.onDidRequestBlink = this._onDidRequestBlink.event;
    this._approvalModel = approvalModel ?? this._register(instantiationService.createInstance(AgentSessionApprovalModel));
    this._blockedSessionsModel = blockedSessions ?? this._register(instantiationService.createInstance(BlockedSessions));
    this._ciFixModel = ciFixModel ?? this._register(instantiationService.createInstance(BlockedSessionsCIFixModel));
    const enabled = productService.quality !== "stable";
    this.blockedSessions = derived(this, (reader) => {
      if (!enabled) {
        return [];
      }
      const visibleSessionIds = /* @__PURE__ */ new Set();
      for (const session of this._sessionsService.visibleSessions.read(reader)) {
        if (session) {
          visibleSessionIds.add(session.sessionId);
        }
      }
      const ignoredOccurrences = this._ignoredBlockOccurrences.read(reader);
      const ciFixHidden = this._ciFixModel.hiddenSessions.read(reader);
      return this._blockedSessionsModel.blockedSessionsWithReasons.read(reader).filter((blocked) => !visibleSessionIds.has(blocked.session.sessionId) && !ciFixHidden.has(blocked.session.sessionId) && !this._isBlockIgnored(blocked, ignoredOccurrences, reader));
    });
    this.requiresInputKind = derived(this, (reader) => {
      const blocked = this.blockedSessions.read(reader);
      if (blocked.length === 0) {
        return void 0;
      }
      let common;
      let hasCommon = false;
      for (const entry of blocked) {
        const kind = this._kindOf(entry, reader);
        if (kind === void 0) {
          return void 0;
        }
        if (!hasCommon) {
          common = kind;
          hasCommon = true;
        } else if (common !== kind) {
          return void 0;
        }
      }
      return common;
    });
    this._register(autorun((reader) => {
      if (!enabled) {
        return;
      }
      const blockedSessions2 = this._blockedSessionsModel.blockedSessionsWithReasons.read(reader);
      const blockedById = new Map(blockedSessions2.map((entry) => [entry.session.sessionId, entry]));
      const visibleSessionIds = new Set(this._sessionsService.visibleSessions.read(reader).filter((session) => session !== void 0).map((session) => session.sessionId));
      const ignoredOccurrences = this._ignoredBlockOccurrences.read(reader);
      const next = new Map(ignoredOccurrences);
      let changed = false;
      for (const [sessionId, ignoredOccurrence] of ignoredOccurrences) {
        const blockedSession = blockedById.get(sessionId);
        if (!blockedSession || this._getBlockOccurrenceId(blockedSession, reader, ignoredOccurrence) !== ignoredOccurrence) {
          next.delete(sessionId);
          changed = true;
        }
      }
      for (const blockedSession of blockedById.values()) {
        if (!visibleSessionIds.has(blockedSession.session.sessionId)) {
          continue;
        }
        const occurrenceId = this._getBlockOccurrenceId(blockedSession, reader, next.get(blockedSession.session.sessionId));
        if (next.get(blockedSession.session.sessionId) !== occurrenceId) {
          next.set(blockedSession.session.sessionId, occurrenceId);
          changed = true;
        }
      }
      if (changed) {
        this._ignoredBlockOccurrences.set(next, void 0);
      }
    }));
    this._register(autorun((reader) => {
      if (!enabled) {
        return;
      }
      const ignoredOccurrences = this._ignoredBlockOccurrences.read(reader);
      const modelBlocked = this._blockedSessionsModel.blockedSessionsWithReasons.read(reader);
      const currentOccurrences = new Map(modelBlocked.map((blocked) => [
        blocked.session.sessionId,
        this._getBlockOccurrenceId(blocked, reader, ignoredOccurrences.get(blocked.session.sessionId))
      ]));
      const previousOccurrences = this._lastBlockedOccurrences;
      this._lastBlockedOccurrences = currentOccurrences;
      const visibleSessionIds = /* @__PURE__ */ new Set();
      for (const session of this._sessionsService.visibleSessions.read(reader)) {
        if (session) {
          visibleSessionIds.add(session.sessionId);
        }
      }
      for (const [sessionId, occurrenceId] of this._pendingBlinkOccurrences) {
        if (currentOccurrences.get(sessionId) !== occurrenceId || visibleSessionIds.has(sessionId)) {
          this._pendingBlinkOccurrences.delete(sessionId);
        }
      }
      let queued = false;
      for (const blocked of modelBlocked) {
        const sessionId = blocked.session.sessionId;
        const occurrenceId = currentOccurrences.get(sessionId);
        if (previousOccurrences.get(sessionId) !== occurrenceId && !visibleSessionIds.has(sessionId)) {
          this._pendingBlinkOccurrences.set(sessionId, occurrenceId);
          queued = true;
        }
      }
      if (queued) {
        this._onDidRequestBlink.fire();
      }
    }));
  }
  /** The approval model, shared with the dropdown list so both agree on each session's pending action. */
  get approvalModel() {
    return this._approvalModel;
  }
  /** The CI-fix model, shared with the dropdown list so the fix action and the hide-while-fixing agree. */
  get ciFixModel() {
    return this._ciFixModel;
  }
  /**
   * Whether a fresh attention blink is pending. Returns `true` only when a session
   * queued as newly blocked is still in the surfaced (visible-filtered) blocked set,
   * so a blink queued while the pill was suppressed can't fire for a session that has
   * since become visible or unblocked. The pending queue is cleared as it is read so
   * a subsequent render won't replay the animation.
   */
  consumePendingBlink() {
    if (this._pendingBlinkOccurrences.size === 0) {
      return false;
    }
    const ignoredOccurrences = this._ignoredBlockOccurrences.get();
    const surfacedOccurrences = new Map(this.blockedSessions.get().map((blocked) => [
      blocked.session.sessionId,
      this._getBlockOccurrenceId(blocked, void 0, ignoredOccurrences.get(blocked.session.sessionId))
    ]));
    let shouldBlink = false;
    for (const [sessionId, occurrenceId] of this._pendingBlinkOccurrences) {
      if (surfacedOccurrences.get(sessionId) === occurrenceId) {
        shouldBlink = true;
        break;
      }
    }
    this._pendingBlinkOccurrences.clear();
    return shouldBlink;
  }
  /** Ignore this session's current blocked occurrence. */
  ignoreSession(session) {
    const blocked = this._blockedSessionsModel.blockedSessionsWithReasons.get().find((entry) => entry.session.sessionId === session.sessionId);
    if (!blocked) {
      return;
    }
    this._ignoreOccurrence(blocked, this._getBlockOccurrenceId(blocked, void 0, this._ignoredBlockOccurrences.get().get(session.sessionId)));
  }
  /** Ignore every blocked occurrence currently surfaced by the indicator. */
  ignoreAllSessions() {
    const blockedSessions = this.blockedSessions.get();
    if (blockedSessions.length === 0) {
      return;
    }
    const next = new Map(this._ignoredBlockOccurrences.get());
    for (const blocked of blockedSessions) {
      next.set(blocked.session.sessionId, this._getBlockOccurrenceId(blocked, void 0, next.get(blocked.session.sessionId)));
    }
    this._ignoredBlockOccurrences.set(next, void 0);
  }
  /**
   * Remember that the user allowed this exact approval so the session drops out of
   * the blocked set immediately.
   */
  dismissApproval(approved) {
    const blocked = this._blockedSessionsModel.blockedSessionsWithReasons.get().find((entry) => entry.session.sessionId === approved.session.sessionId);
    if (!blocked || blocked.reason !== BlockedSessionReason.NeedsInput) {
      return;
    }
    this._ignoreOccurrence(blocked, this._approvalOccurrenceId(blocked, approved.approvalId));
  }
  /**
   * Build the requires-input pill label. A homogeneous set of blocked sessions
   * gets a specific, more actionable message; a mix (or an unclassified session)
   * falls back to the generic "N sessions require input".
   */
  getRequiresInputLabel(count, kind) {
    switch (kind) {
      case 0 /* TerminalApproval */:
        return count === 1 ? localize("oneSessionTerminalApproval", "1 session requires terminal approval") : localize("nSessionsTerminalApproval", "{0} sessions require terminal approval", count);
      case 1 /* Question */:
        return count === 1 ? localize("oneSessionQuestion", "1 session has a question") : localize("nSessionsQuestion", "{0} sessions have questions", count);
      case 2 /* FailingCI */:
        return count === 1 ? localize("oneSessionFailingCI", "1 session is failing CI") : localize("nSessionsFailingCI", "{0} sessions are failing CI", count);
      default:
        return count === 1 ? localize("oneSessionRequiresInput", "1 session requires input") : localize("nSessionsRequireInput", "{0} sessions require input", count);
    }
  }
  _ignoreOccurrence(blocked, occurrenceId) {
    const next = new Map(this._ignoredBlockOccurrences.get());
    next.set(blocked.session.sessionId, occurrenceId);
    this._ignoredBlockOccurrences.set(next, void 0);
  }
  _isBlockIgnored(blocked, ignoredOccurrences, reader) {
    const ignoredOccurrence = ignoredOccurrences.get(blocked.session.sessionId);
    return ignoredOccurrence !== void 0 && this._getBlockOccurrenceId(blocked, reader, ignoredOccurrence) === ignoredOccurrence;
  }
  _getBlockOccurrenceId(blocked, reader, ignoredOccurrence) {
    if (blocked.reason !== BlockedSessionReason.NeedsInput) {
      return blocked.occurrenceId;
    }
    const approval = getFirstApprovalAcrossChats(this._approvalModel, blocked.session, reader);
    if (approval) {
      return this._approvalOccurrenceId(blocked, agentSessionApprovalId(approval));
    }
    const approvalPrefix = this._approvalOccurrenceId(blocked, "");
    return ignoredOccurrence?.startsWith(approvalPrefix) ? ignoredOccurrence : blocked.occurrenceId;
  }
  _approvalOccurrenceId(blocked, approvalId) {
    return `${blocked.occurrenceId}:approval:${approvalId}`;
  }
  /**
   * Classify a single blocked session into a specific requires-input kind, or
   * `undefined` when it can't be classified (which forces the generic message).
   */
  _kindOf(blocked, reader) {
    switch (blocked.reason) {
      case BlockedSessionReason.FailingCI:
        return 2 /* FailingCI */;
      case BlockedSessionReason.NeedsInput: {
        const approval = getFirstApprovalAcrossChats(this._approvalModel, blocked.session, reader);
        switch (approval?.kind) {
          case AgentSessionApprovalKind.Terminal:
            return 0 /* TerminalApproval */;
          case AgentSessionApprovalKind.Question:
            return 1 /* Question */;
          default:
            return void 0;
        }
      }
      default:
        return void 0;
    }
  }
};
BlockedSessionsIndicatorModel = __decorateClass([
  __decorateParam(3, ISessionsService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IProductService)
], BlockedSessionsIndicatorModel);
export {
  BlockedSessionsIndicatorModel,
  RequiresInputKind
};
