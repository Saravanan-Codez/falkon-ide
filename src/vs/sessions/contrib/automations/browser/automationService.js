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
import { derived, observableValue, transaction } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import {
  serializeAutomationEditableState
} from "../../../../workbench/contrib/chat/common/automations/automationService.js";
import { publishAutomationCreated, publishAutomationDeleted, publishAutomationUpdated } from "../../../../workbench/contrib/chat/common/automations/automationTelemetry.js";
import { computeNextRunAt } from "../../../../workbench/contrib/chat/common/automations/schedule.js";
import { ChatPermissionLevel, isChatPermissionLevel } from "../../../../workbench/contrib/chat/common/constants.js";
import { AUTOMATION_STORAGE_KEY, IAutomationStorageService } from "../common/automationStorageService.js";
const LEGACY_SCHEMA_VERSIONS = /* @__PURE__ */ new Set([1, 2]);
const CURRENT_SCHEMA_VERSION = 3;
const MAX_RUNS_PER_AUTOMATION = 50;
const EMPTY_LEDGER = Object.freeze({ automations: [], runs: [] });
let AutomationService = class extends Disposable {
  constructor(storageService, logService, telemetryService, automationStorageService) {
    super();
    this.storageService = storageService;
    this.logService = logService;
    this.telemetryService = telemetryService;
    this.automationStorageService = automationStorageService;
    this._runsForCache = /* @__PURE__ */ new Map();
    this._lastSeenRevision = 0;
    this._now = () => /* @__PURE__ */ new Date();
    const result = this.readLedger(this.storageService.get(AUTOMATION_STORAGE_KEY, StorageScope.APPLICATION));
    const initial = result.kind === "ledger" ? result.ledger : EMPTY_LEDGER;
    if (result.kind === "ledger") {
      this._lastSeenRevision = result.revision;
    }
    this._automations = observableValue(this, initial.automations);
    this._runs = observableValue(this, initial.runs);
    this.automations = this._automations;
    this.runs = this._runs;
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, AUTOMATION_STORAGE_KEY, this._store)(() => {
      this.refreshFromStorage();
    }));
  }
  /** Test-only: swap in a deterministic clock used by create/update. */
  setClockForTesting(now) {
    this._now = now;
  }
  getAutomation(id) {
    return this._automations.get().find((a) => a.id === id);
  }
  runsFor(automationId) {
    let cached = this._runsForCache.get(automationId);
    if (!cached) {
      cached = derived(this, (reader) => this._runs.read(reader).filter((r) => r.automationId === automationId));
      this._runsForCache.set(automationId, cached);
    }
    return cached;
  }
  async createAutomation(options, mutationGuard) {
    const now = this._now();
    const nowIso = now.toISOString();
    const nextRun = computeNextRunAt(options.schedule, now);
    const automation = Object.freeze({
      id: generateUuid(),
      name: options.name,
      prompt: options.prompt,
      schedule: options.schedule,
      target: normalizeAutomationTarget(options.target),
      modelId: options.modelId,
      mode: options.mode,
      permissionLevel: isChatPermissionLevel(options.permissionLevel) ? options.permissionLevel : void 0,
      enabled: options.enabled ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastRunAt: void 0,
      nextRunAt: nextRun?.toISOString()
    });
    await this.mutateLedger((ledger) => ({
      kind: "commit",
      ledger: { automations: [automation, ...ledger.automations], runs: ledger.runs },
      result: void 0
    }), mutationGuard);
    publishAutomationCreated(this.telemetryService, automation);
    return automation;
  }
  async updateAutomation(id, patch) {
    const now = this._now();
    const result = await this.mutateLedger((ledger) => {
      const current = ledger.automations.find((automation) => automation.id === id);
      if (!current) {
        throw new Error(`Automation not found: ${id}`);
      }
      const updated = updateAutomation(current, patch, now);
      return {
        kind: "commit",
        ledger: {
          automations: ledger.automations.map((automation) => automation.id === id ? updated : automation),
          runs: ledger.runs
        },
        result: { current, updated }
      };
    });
    publishAutomationUpdated(this.telemetryService, result.current, result.updated);
    return result.updated;
  }
  async updateAutomationIfUnchanged(id, patch, expected, mutationGuard) {
    const now = this._now();
    let previous;
    const result = await this.mutateLedger((ledger) => {
      const current = ledger.automations.find((automation) => automation.id === id);
      if (!current || serializeAutomationEditableState(current) !== serializeAutomationEditableState(expected)) {
        return {
          kind: "noChange",
          result: { kind: "conflict", current }
        };
      }
      const updated = updateAutomation(current, patch, now);
      previous = current;
      return {
        kind: "commit",
        ledger: {
          automations: ledger.automations.map((automation) => automation.id === id ? updated : automation),
          runs: ledger.runs
        },
        result: { kind: "updated", automation: updated }
      };
    }, mutationGuard);
    if (result.kind === "conflict" || !previous) {
      return result;
    }
    publishAutomationUpdated(this.telemetryService, previous, result.automation);
    return result;
  }
  async deleteAutomation(id, mutationGuard) {
    const existing = await this.mutateLedger((ledger) => {
      const automation = ledger.automations.find((automation2) => automation2.id === id);
      if (!automation) {
        return { kind: "noChange", result: void 0 };
      }
      return {
        kind: "commit",
        ledger: {
          automations: ledger.automations.filter((automation2) => automation2.id !== id),
          runs: ledger.runs.filter((run) => run.automationId !== id)
        },
        result: automation
      };
    }, mutationGuard);
    if (!existing) {
      return;
    }
    this._runsForCache.delete(id);
    publishAutomationDeleted(this.telemetryService, existing);
  }
  async recordRunStart(automationId, trigger, leaderWindowId) {
    const now = this._now();
    const startedAt = now.toISOString();
    const run = Object.freeze({
      id: generateUuid(),
      automationId,
      status: "pending",
      trigger,
      startedAt,
      leaderWindowId
    });
    return this.mutateLedger((ledger) => {
      const automation = ledger.automations.find((automation2) => automation2.id === automationId);
      if (!automation) {
        throw new Error(`Automation not found: ${automationId}`);
      }
      const activeRun = findActiveRun(ledger.runs, automationId);
      if (activeRun) {
        return { kind: "noChange", result: { claimed: false, run: activeRun } };
      }
      let automations = ledger.automations;
      if (trigger !== "manual") {
        const updatedAutomation = Object.freeze({
          ...automation,
          lastRunAt: startedAt,
          nextRunAt: computeNextRunAt(automation.schedule, now)?.toISOString(),
          updatedAt: startedAt
        });
        automations = automations.map((automation2) => automation2.id === automationId ? updatedAutomation : automation2);
      }
      return {
        kind: "commit",
        ledger: { automations, runs: [run, ...ledger.runs] },
        result: { claimed: true, run }
      };
    });
  }
  async updateRun(runId, patch) {
    return this.mutateLedger((ledger) => {
      const current = ledger.runs.find((run) => run.id === runId);
      if (!current) {
        return { kind: "noChange", result: void 0 };
      }
      const updated = Object.freeze({
        ...current,
        status: patch.status ?? current.status,
        sessionResource: patch.sessionResource ?? current.sessionResource,
        completedAt: patch.completedAt ?? current.completedAt,
        errorMessage: patch.errorMessage ?? current.errorMessage
      });
      return {
        kind: "commit",
        ledger: {
          automations: ledger.automations,
          runs: ledger.runs.map((run) => run.id === runId ? updated : run)
        },
        result: updated
      };
    });
  }
  async deleteRun(runId) {
    await this.mutateLedger((ledger) => {
      if (!ledger.runs.some((run) => run.id === runId)) {
        return { kind: "noChange", result: void 0 };
      }
      return {
        kind: "commit",
        ledger: {
          automations: ledger.automations,
          runs: ledger.runs.filter((run) => run.id !== runId)
        },
        result: void 0
      };
    });
  }
  getActiveRunFor(automationId) {
    return findActiveRun(this._runs.get(), automationId);
  }
  async markStaleRunsFailed(reason) {
    const completedAt = this._now().toISOString();
    await this.mutateLedger((ledger) => {
      let changed = false;
      const runs = ledger.runs.map((run) => {
        if (run.status === "pending" || run.status === "running") {
          changed = true;
          return Object.freeze({ ...run, status: "failed", completedAt, errorMessage: reason });
        }
        return run;
      });
      if (!changed) {
        return { kind: "noChange", result: void 0 };
      }
      return {
        kind: "commit",
        ledger: { automations: ledger.automations, runs },
        result: void 0
      };
    });
  }
  //#region Persistence
  async mutateLedger(mutate, mutationGuard) {
    let raw = await this.automationStorageService.read();
    while (true) {
      const readResult = this.readLedger(raw);
      if (readResult.kind === "unsupportedSchema") {
        throw new Error("Cannot modify automations: storage was written by a newer version");
      }
      this.acceptLedger(readResult.ledger, readResult.revision);
      const mutation = mutate(readResult.ledger);
      if (mutation.kind === "noChange") {
        return mutation.result;
      }
      const ledger = {
        automations: mutation.ledger.automations,
        runs: trimRunsPerAutomation(mutation.ledger.runs, MAX_RUNS_PER_AUTOMATION)
      };
      const revision = readResult.revision + 1;
      const serialized = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        revision,
        automations: ledger.automations.map(serializeAutomation),
        runs: [...ledger.runs]
      };
      const newValue = JSON.stringify(serialized);
      mutationGuard?.();
      const writeResult = await this.automationStorageService.compareAndSwap(raw, newValue);
      if (writeResult.swapped) {
        this.setLedger(ledger, revision);
        return mutation.result;
      }
      if (writeResult.currentValue === raw) {
        throw new Error("Automation storage rejected an unchanged compare-and-swap value.");
      }
      raw = writeResult.currentValue;
    }
  }
  acceptLedger(ledger, revision) {
    if (revision < this._lastSeenRevision) {
      return;
    }
    this.setLedger(ledger, revision);
  }
  setLedger(ledger, revision) {
    this._lastSeenRevision = revision;
    transaction((tx) => {
      this._automations.set(ledger.automations, tx);
      this._runs.set(ledger.runs, tx);
    });
  }
  refreshFromStorage() {
    const result = this.readLedger(this.storageService.get(AUTOMATION_STORAGE_KEY, StorageScope.APPLICATION));
    if (result.kind === "unsupportedSchema") {
      return;
    }
    this.acceptLedger(result.ledger, result.revision);
  }
  readLedger(raw) {
    if (!raw) {
      return { kind: "ledger", ledger: EMPTY_LEDGER, revision: 0 };
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.schemaVersion === "number" && parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
        this.logService.warn(`[AutomationService] Ledger has schema v${parsed.schemaVersion}; this build only supports v${CURRENT_SCHEMA_VERSION}. Entering read-only mode.`);
        return { kind: "unsupportedSchema" };
      }
      if (parsed?.schemaVersion !== CURRENT_SCHEMA_VERSION && !LEGACY_SCHEMA_VERSIONS.has(parsed?.schemaVersion)) {
        this.logService.warn(`[AutomationService] Unsupported ledger schema version ${parsed?.schemaVersion}; ignoring.`);
        return { kind: "ledger", ledger: EMPTY_LEDGER, revision: 0 };
      }
      const automations = [];
      if (parsed.schemaVersion === CURRENT_SCHEMA_VERSION) {
        const entries = Array.isArray(parsed.automations) ? parsed.automations : [];
        for (const entry of entries) {
          try {
            const automation = deserializeAutomation(entry);
            if (automation) {
              automations.push(automation);
            } else {
              this.logService.warn(`[AutomationService] Dropping persisted automation ${entry?.id} with an invalid target.`);
            }
          } catch (err) {
            this.logService.warn(`[AutomationService] Dropping malformed persisted automation ${entry?.id}.`, err);
          }
        }
      } else {
        const entries = Array.isArray(parsed.automations) ? parsed.automations : [];
        for (const entry of entries) {
          try {
            const automation = deserializeLegacyAutomation(entry);
            if (automation) {
              automations.push(automation);
            } else {
              this.logService.warn(`[AutomationService] Dropping persisted automation ${entry?.id} with an invalid legacy target.`);
            }
          } catch (err) {
            this.logService.warn(`[AutomationService] Dropping malformed persisted automation ${entry?.id}.`, err);
          }
        }
      }
      const validIds = new Set(automations.map((a) => a.id));
      const serializedRuns = Array.isArray(parsed.runs) ? parsed.runs : [];
      const runs = serializedRuns.filter((r) => !!r && typeof r === "object" && validIds.has(r.automationId)).map((r) => Object.freeze({ ...r }));
      const revision = typeof parsed.revision === "number" ? parsed.revision : 0;
      return { kind: "ledger", ledger: { automations, runs: trimRunsPerAutomation(runs, MAX_RUNS_PER_AUTOMATION) }, revision };
    } catch (err) {
      this.logService.error("[AutomationService] Failed to parse automations ledger; resetting.", err);
      return { kind: "ledger", ledger: EMPTY_LEDGER, revision: 0 };
    }
  }
  //#endregion
};
AutomationService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IAutomationStorageService)
], AutomationService);
function serializeAutomation(a) {
  return {
    id: a.id,
    name: a.name,
    prompt: a.prompt,
    schedule: a.schedule,
    target: serializeAutomationTarget(a.target),
    modelId: a.modelId,
    mode: a.mode,
    permissionLevel: a.permissionLevel,
    enabled: a.enabled,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    lastRunAt: a.lastRunAt,
    nextRunAt: a.nextRunAt
  };
}
function deserializeAutomation(s) {
  const target = deserializeAutomationTarget(s.target);
  return target ? createAutomationFromSerialized(s, target) : void 0;
}
function deserializeLegacyAutomation(s) {
  let target;
  if (s.isQuickChat === true) {
    if (!s.providerId || !s.sessionTypeId) {
      return void 0;
    }
    target = createQuickChatAutomationTarget(s.providerId, s.sessionTypeId);
  } else {
    if (!s.folderUri) {
      return void 0;
    }
    target = createWorkspaceAutomationTarget(
      URI.revive(s.folderUri),
      s.providerId,
      s.sessionTypeId,
      deserializeLegacyIsolation(s.isolationMode, s.branch)
    );
  }
  return createAutomationFromSerialized(s, target);
}
function createAutomationFromSerialized(s, target) {
  const permissionLevel = isChatPermissionLevel(s.permissionLevel) ? s.permissionLevel : ChatPermissionLevel.Default;
  return Object.freeze({
    id: s.id,
    name: s.name,
    prompt: s.prompt,
    schedule: s.schedule,
    target,
    modelId: s.modelId,
    mode: s.mode,
    permissionLevel,
    enabled: s.enabled,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastRunAt: s.lastRunAt,
    nextRunAt: s.nextRunAt
  });
}
function updateAutomation(current, patch, now) {
  const merged = mergeAutomation(current, patch);
  const scheduleChanged = patch.schedule !== void 0;
  const enabledChanged = patch.enabled !== void 0;
  return Object.freeze({
    ...merged,
    updatedAt: now.toISOString(),
    nextRunAt: scheduleChanged || enabledChanged && merged.enabled ? computeNextRunAt(merged.schedule, now)?.toISOString() : merged.nextRunAt
  });
}
function mergeAutomation(current, patch) {
  return {
    ...current,
    name: patch.name ?? current.name,
    prompt: patch.prompt ?? current.prompt,
    schedule: patch.schedule ?? current.schedule,
    target: patch.target ? normalizeAutomationTarget(patch.target) : current.target,
    modelId: patch.modelId === null ? void 0 : patch.modelId ?? current.modelId,
    mode: patch.mode === null ? void 0 : patch.mode ?? current.mode,
    permissionLevel: patch.permissionLevel === null ? void 0 : patch.permissionLevel && isChatPermissionLevel(patch.permissionLevel) ? patch.permissionLevel : current.permissionLevel,
    enabled: patch.enabled ?? current.enabled
  };
}
function normalizeAutomationTarget(target) {
  if (target.kind === "quickChat") {
    if (!target.providerId || !target.sessionTypeId) {
      throw new Error("Workspace-less automation requires a providerId and sessionTypeId.");
    }
    return createQuickChatAutomationTarget(target.providerId, target.sessionTypeId);
  }
  if (!target.folderUri) {
    throw new Error("Workspace-backed automation requires a folderUri.");
  }
  return createWorkspaceAutomationTarget(
    target.folderUri,
    target.providerId,
    target.sessionTypeId,
    target.isolation
  );
}
function serializeAutomationTarget(target) {
  return target.kind === "quickChat" ? { kind: "quickChat", providerId: target.providerId, sessionTypeId: target.sessionTypeId } : {
    kind: "workspace",
    folderUri: target.folderUri.toJSON(),
    providerId: target.providerId,
    sessionTypeId: target.sessionTypeId,
    isolation: target.isolation
  };
}
function deserializeAutomationTarget(target) {
  if (target?.kind === "quickChat") {
    return target.providerId && target.sessionTypeId ? createQuickChatAutomationTarget(target.providerId, target.sessionTypeId) : void 0;
  }
  if (target?.kind !== "workspace" || !target.folderUri || !isAutomationWorkspaceIsolation(target.isolation)) {
    return void 0;
  }
  return createWorkspaceAutomationTarget(
    URI.revive(target.folderUri),
    target.providerId,
    target.sessionTypeId,
    target.isolation
  );
}
function deserializeLegacyIsolation(isolationMode, branch) {
  if (isolationMode === "worktree") {
    return branch ? { kind: "worktree", branch } : { kind: "default" };
  }
  return isolationMode === "workspace" ? { kind: "folder" } : { kind: "default" };
}
function normalizeAutomationWorkspaceIsolation(isolation) {
  if (isolation?.kind === "default") {
    return Object.freeze({ kind: "default" });
  }
  if (isolation?.kind === "folder") {
    return Object.freeze({ kind: "folder" });
  }
  if (isolation?.kind === "worktree" && isolation.branch) {
    return Object.freeze({ kind: "worktree", branch: isolation.branch });
  }
  if (isolation?.kind === "worktree") {
    throw new Error("Worktree automation requires a branch.");
  }
  throw new Error("Workspace-backed automation requires a valid isolation mode.");
}
function createQuickChatAutomationTarget(providerId, sessionTypeId) {
  return Object.freeze({ kind: "quickChat", providerId, sessionTypeId });
}
function createWorkspaceAutomationTarget(folderUri, providerId, sessionTypeId, isolation) {
  return Object.freeze({
    kind: "workspace",
    folderUri,
    ...providerId !== void 0 ? { providerId } : {},
    ...sessionTypeId !== void 0 ? { sessionTypeId } : {},
    isolation: normalizeAutomationWorkspaceIsolation(isolation)
  });
}
function isAutomationWorkspaceIsolation(value) {
  return value?.kind === "default" || value?.kind === "folder" || value?.kind === "worktree" && typeof value.branch === "string" && value.branch.length > 0;
}
function findActiveRun(runs, automationId) {
  return runs.find((run) => run.automationId === automationId && (run.status === "pending" || run.status === "running"));
}
function trimRunsPerAutomation(runs, max) {
  const counts = /* @__PURE__ */ new Map();
  const out = [];
  for (const run of runs) {
    const count = counts.get(run.automationId) ?? 0;
    if (count >= max) {
      continue;
    }
    counts.set(run.automationId, count + 1);
    out.push(run);
  }
  return out.length === runs.length ? runs : out;
}
export {
  AutomationService
};
