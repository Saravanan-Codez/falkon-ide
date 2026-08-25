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
import { DeferredPromise } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { derived, waitForState } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IAutomationService } from "../../../../workbench/contrib/chat/common/automations/automationService.js";
import { publishAutomationRun, publishAutomationRunError } from "../../../../workbench/contrib/chat/common/automations/automationTelemetry.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
let AutomationRunner = class {
  constructor(automationService, sessionsManagementService, logService, telemetryService, notificationService) {
    this.automationService = automationService;
    this.sessionsManagementService = sessionsManagementService;
    this.logService = logService;
    this.telemetryService = telemetryService;
    this.notificationService = notificationService;
  }
  runOnce(automation, trigger, leaderWindowId, token = CancellationToken.None) {
    const dispatched = new DeferredPromise();
    return {
      whenDispatched: dispatched.p,
      whenCompleted: this._runOnce(automation, trigger, leaderWindowId, token, dispatched)
    };
  }
  async _runOnce(automation, trigger, leaderWindowId, token, dispatched) {
    try {
      await this._runOnceInner(automation, trigger, leaderWindowId, token, dispatched);
    } catch (err) {
      this.logService.error(`[AutomationRunner] unexpected error in runOnce for ${automation.id}`, err);
    } finally {
      await dispatched.complete({ kind: "notStarted", reason: "error" });
    }
  }
  async _runOnceInner(automation, trigger, leaderWindowId, token, dispatched) {
    const startTimeMs = Date.now();
    let runId;
    try {
      if (!this.automationService.getAutomation(automation.id)) {
        this.logService.trace(`[AutomationRunner] skipping ${automation.id}: automation was deleted.`);
        await dispatched.complete({ kind: "notStarted", reason: "deleted" });
        return;
      }
      const target = automation.target;
      const isolationMode = target.kind === "workspace" ? target.isolation.kind === "folder" ? "workspace" : target.isolation.kind === "worktree" ? "worktree" : void 0 : void 0;
      const branch = target.kind === "workspace" && target.isolation.kind === "worktree" ? target.isolation.branch : void 0;
      const createOptions = target.providerId !== void 0 || target.sessionTypeId !== void 0 || automation.modelId !== void 0 || automation.mode !== void 0 || automation.permissionLevel !== void 0 || isolationMode !== void 0 || branch !== void 0 ? {
        providerId: target.providerId,
        sessionTypeId: target.sessionTypeId,
        modelId: automation.modelId,
        modeId: automation.mode,
        permissionLevel: automation.permissionLevel,
        isolationMode,
        branch
      } : void 0;
      const targetAvailable = target.kind === "quickChat" ? this.sessionsManagementService.isQuickChatTargetAvailable(createOptions) : this.sessionsManagementService.isNewSessionTargetAvailable(target.folderUri, createOptions);
      if (!targetAvailable) {
        this.logService.trace(`[AutomationRunner] deferring ${automation.id}: target is not yet advertised.`);
        if (trigger === "manual") {
          this.notificationService.info(localize("automationTargetUnavailable", "Automation '{0}' cannot start until its agent becomes available.", automation.name));
        }
        await dispatched.complete({ kind: "notStarted", reason: "targetUnavailable" });
        return;
      }
      const claim = await this.automationService.recordRunStart(automation.id, trigger, leaderWindowId);
      if (!claim.claimed) {
        this.logService.trace(`[AutomationRunner] skipping ${automation.id}: active run already exists.`);
        await dispatched.complete({ kind: "alreadyRunning", activeRun: claim.run });
        return;
      }
      runId = claim.run.id;
      const run = await this.automationService.updateRun(runId, { status: "running" }) ?? claim.run;
      if (token.isCancellationRequested) {
        await dispatched.complete({ kind: "notStarted", reason: "cancelled", run });
        await this._markCancelled(runId, trigger, automation, startTimeMs);
        return;
      }
      const options = {
        query: automation.prompt,
        background: true,
        title: automation.name?.substring(0, 100)
      };
      this.logService.trace(`[AutomationRunner] running ${automation.id}: target=${target.kind}, provider=${createOptions?.providerId ?? "(default)"}, sessionType=${createOptions?.sessionTypeId ?? "(default)"}, model=${createOptions?.modelId ?? "(default)"}, mode=${createOptions?.modeId ?? "(default)"}, permissionLevel=${createOptions?.permissionLevel ?? "(default)"}`);
      let session;
      if (target.kind === "quickChat") {
        session = await this.sessionsManagementService.createAndSendQuickChatRequest(options, createOptions, token);
      } else {
        session = await this.sessionsManagementService.createAndSendNewChatRequest(target.folderUri, options, createOptions, token);
      }
      if (session) {
        const sessionResource = session.resource.toString();
        const dispatchedRun = await this.automationService.updateRun(runId, { sessionResource }) ?? run;
        await dispatched.complete({ kind: "started", run: dispatchedRun, sessionResource });
      } else {
        await dispatched.complete({ kind: "notStarted", reason: token.isCancellationRequested ? "cancelled" : "error", run });
      }
      if (token.isCancellationRequested) {
        await this._markCancelled(runId, trigger, automation, startTimeMs);
        return;
      }
      const terminalStatus = session ? await waitForState(
        derived((reader) => session.mainChat.read(reader).status.read(reader)),
        (status) => status === SessionStatus.Completed || status === SessionStatus.Error,
        void 0,
        token
      ) : SessionStatus.Completed;
      if (token.isCancellationRequested) {
        await this._markCancelled(runId, trigger, automation, startTimeMs);
        return;
      }
      if (terminalStatus === SessionStatus.Error) {
        throw new Error(localize("automationRunner.sessionFailed", "Agent session failed."));
      }
      await this.automationService.updateRun(runId, {
        status: "completed",
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      publishAutomationRun(this.telemetryService, { trigger, automation, success: true, durationMs: Date.now() - startTimeMs });
    } catch (err) {
      if (runId && token.isCancellationRequested) {
        await dispatched.complete({ kind: "notStarted", reason: "cancelled" });
        await this._markCancelled(runId, trigger, automation, startTimeMs);
        return;
      }
      this.logService.error(`[AutomationRunner] run for ${automation.id} failed`, err);
      try {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.notificationService.error(localize("automationRunFailed", "Automation '{0}' failed: {1}", automation.name, errorMessage));
        let failedRun;
        if (runId) {
          failedRun = await this.automationService.updateRun(runId, {
            status: "failed",
            completedAt: (/* @__PURE__ */ new Date()).toISOString(),
            errorMessage
          });
        }
        await dispatched.complete({ kind: "notStarted", reason: "error", run: failedRun });
        publishAutomationRun(this.telemetryService, { trigger, automation, success: false, durationMs: Date.now() - startTimeMs });
        publishAutomationRunError(this.telemetryService, { trigger, automation });
      } catch (innerErr) {
        this.logService.error(`[AutomationRunner] error recording failure for ${automation.id}`, innerErr);
      }
    }
  }
  async _markCancelled(runId, trigger, automation, startTimeMs) {
    try {
      if (this.automationService.getActiveRunFor(automation.id)?.id === runId) {
        await this.automationService.updateRun(runId, {
          status: "failed",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          errorMessage: localize("automationRunner.cancelled", "Cancelled")
        });
      }
      publishAutomationRun(this.telemetryService, { trigger, automation, success: false, durationMs: Date.now() - startTimeMs });
    } catch (err) {
      this.logService.error(`[AutomationRunner] error recording cancellation for ${automation.id}`, err);
    }
  }
};
AutomationRunner = __decorateClass([
  __decorateParam(0, IAutomationService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, INotificationService)
], AutomationRunner);
export {
  AutomationRunner
};
