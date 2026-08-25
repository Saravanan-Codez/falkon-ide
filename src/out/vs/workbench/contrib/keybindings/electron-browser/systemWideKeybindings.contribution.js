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
import * as nls from "../../../../nls.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { equals } from "../../../../base/common/arrays.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
function selectSystemWideKeybindings(items) {
  const seen = /* @__PURE__ */ new Set();
  const candidates = [];
  const unsupported = [];
  const duplicates = [];
  for (const item of items) {
    if (!item.systemWide || item.isDefault || !item.command) {
      continue;
    }
    const resolved = item.resolvedKeybinding;
    if (!resolved) {
      continue;
    }
    const accelerator = resolved.getElectronAccelerator();
    if (!accelerator) {
      unsupported.push(resolved.getUserSettingsLabel() ?? item.command);
      continue;
    }
    if (seen.has(accelerator)) {
      duplicates.push(resolved.getUserSettingsLabel() ?? accelerator);
      continue;
    }
    seen.add(accelerator);
    candidates.push({
      accelerator,
      commandId: item.command,
      args: item.commandArgs ?? void 0,
      userSettingsLabel: resolved.getUserSettingsLabel() ?? accelerator,
      hasWhen: !!item.when
    });
  }
  return { candidates, unsupported, duplicates };
}
let SystemWideKeybindingsContribution = class extends Disposable {
  constructor(keybindingService, nativeHostService, notificationService, productService, logService) {
    super();
    this.keybindingService = keybindingService;
    this.nativeHostService = nativeHostService;
    this.notificationService = notificationService;
    this.productService = productService;
    this.logService = logService;
    /** Accelerators that failed to register on the last sync, to avoid re-notifying unchanged failures. */
    this.lastReportedFailures = [];
    /** User settings labels whose ignored `when` clause we already warned about. */
    this.warnedWhenLabels = /* @__PURE__ */ new Set();
    this.syncScheduler = this._register(new RunOnceScheduler(() => this.sync(), 200));
    this._register(this.keybindingService.onDidUpdateKeybindings(() => this.scheduleSync()));
    this.scheduleSync();
  }
  static {
    this.ID = "workbench.contrib.systemWideKeybindings";
  }
  scheduleSync() {
    this.syncScheduler.schedule();
  }
  async sync() {
    const candidates = this.collectCandidates();
    if (candidates.length === 0) {
      await this.pushToMainProcess([]);
      return;
    }
    this.warnAboutIgnoredWhenClauses(candidates);
    await this.pushToMainProcess(candidates);
  }
  collectCandidates() {
    const { candidates, unsupported, duplicates } = selectSystemWideKeybindings(this.keybindingService.getKeybindings());
    for (const label of unsupported) {
      this.logService.warn(`[SystemWideKeybindings] '${label}' cannot be registered as a system-wide shortcut (only single key combinations are supported).`);
    }
    for (const label of duplicates) {
      this.logService.warn(`[SystemWideKeybindings] duplicate system-wide accelerator for '${label}', keeping the first binding.`);
    }
    return candidates;
  }
  warnAboutIgnoredWhenClauses(candidates) {
    const newlyWarned = [];
    for (const candidate of candidates) {
      if (candidate.hasWhen && !this.warnedWhenLabels.has(candidate.userSettingsLabel)) {
        this.warnedWhenLabels.add(candidate.userSettingsLabel);
        newlyWarned.push(candidate.userSettingsLabel);
      }
    }
    if (newlyWarned.length > 0) {
      this.notificationService.notify({
        severity: Severity.Warning,
        message: nls.localize("systemWideKeybindings.whenIgnored", 'The "when" clause is ignored for system-wide keybindings ({0}); they are always active while {1} is running.', newlyWarned.join(", "), this.productName())
      });
    }
  }
  async pushToMainProcess(candidates) {
    const payload = candidates.map((candidate) => ({
      accelerator: candidate.accelerator,
      commandId: candidate.commandId,
      args: candidate.args,
      userSettingsLabel: candidate.userSettingsLabel
    }));
    try {
      const result = await this.nativeHostService.syncSystemWideKeybindings(payload);
      this.reportFailures(result.failed);
    } catch (error) {
      this.logService.error("[SystemWideKeybindings] failed to sync system-wide keybindings with the main process", error);
    }
  }
  reportFailures(failed) {
    const sorted = [...failed].sort();
    if (equals(sorted, this.lastReportedFailures)) {
      return;
    }
    this.lastReportedFailures = sorted;
    if (sorted.length === 0) {
      return;
    }
    this.notificationService.notify({
      severity: Severity.Warning,
      message: nls.localize("systemWideKeybindings.registrationFailed", "Some system-wide keybindings could not be registered ({0}); the key combination may already be taken by the operating system or another application.", sorted.join(", "))
    });
  }
  productName() {
    return this.productService.nameLong;
  }
};
SystemWideKeybindingsContribution = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, INativeHostService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IProductService),
  __decorateParam(4, ILogService)
], SystemWideKeybindingsContribution);
registerWorkbenchContribution2(
  SystemWideKeybindingsContribution.ID,
  SystemWideKeybindingsContribution,
  WorkbenchPhase.AfterRestored
);
export {
  SystemWideKeybindingsContribution,
  selectSystemWideKeybindings
};
