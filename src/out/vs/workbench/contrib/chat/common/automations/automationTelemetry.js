function publishAutomationCreated(telemetryService, automation) {
  telemetryService.publicLog2("automation.create", {
    intervalKind: automation.schedule.interval,
    permissionLevel: automation.permissionLevel ?? "",
    isolationMode: getAutomationIsolationMode(automation),
    enabled: automation.enabled
  });
}
function publishAutomationUpdated(telemetryService, before, after) {
  telemetryService.publicLog2("automation.update", {
    intervalKind: after.schedule.interval,
    scheduleChanged: before.schedule.interval !== after.schedule.interval || before.schedule.scheduleHour !== after.schedule.scheduleHour || before.schedule.scheduleMinute !== after.schedule.scheduleMinute || before.schedule.scheduleDay !== after.schedule.scheduleDay,
    enabledChanged: before.enabled !== after.enabled,
    enabled: after.enabled
  });
}
function publishAutomationDeleted(telemetryService, automation) {
  telemetryService.publicLog2("automation.delete", {
    intervalKind: automation.schedule.interval
  });
}
function publishAutomationRun(telemetryService, args) {
  telemetryService.publicLog2("automation.run", {
    trigger: args.trigger,
    intervalKind: args.automation.schedule.interval,
    success: args.success,
    durationMs: Math.max(0, Math.round(args.durationMs)),
    permissionLevel: args.automation.permissionLevel ?? "",
    isolationMode: getAutomationIsolationMode(args.automation)
  });
}
function getAutomationIsolationMode(automation) {
  if (automation.target.kind !== "workspace") {
    return "";
  }
  return automation.target.isolation.kind === "folder" ? "workspace" : automation.target.isolation.kind === "worktree" ? "worktree" : "";
}
function publishAutomationRunError(telemetryService, args) {
  telemetryService.publicLogError2("automation.runError", {
    trigger: args.trigger,
    intervalKind: args.automation.schedule.interval
  });
}
export {
  publishAutomationCreated,
  publishAutomationDeleted,
  publishAutomationRun,
  publishAutomationRunError,
  publishAutomationUpdated
};
