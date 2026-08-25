import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { ChatPermissionLevel } from "../constants.js";
const IAutomationService = createDecorator("automationService");
const ConfigureAutomationToolReferenceName = "configureAutomation";
function serializeAutomationEditableState(automation) {
  const target = automation.target.kind === "quickChat" ? {
    kind: automation.target.kind,
    providerId: automation.target.providerId,
    sessionTypeId: automation.target.sessionTypeId
  } : {
    kind: automation.target.kind,
    folderUri: automation.target.folderUri.toString(),
    providerId: automation.target.providerId,
    sessionTypeId: automation.target.sessionTypeId,
    isolation: automation.target.isolation.kind === "worktree" ? { kind: automation.target.isolation.kind, branch: automation.target.isolation.branch } : { kind: automation.target.isolation.kind }
  };
  return JSON.stringify({
    name: automation.name,
    prompt: automation.prompt,
    schedule: {
      interval: automation.schedule.interval,
      scheduleHour: automation.schedule.scheduleHour,
      scheduleMinute: automation.schedule.scheduleMinute,
      scheduleDay: automation.schedule.scheduleDay
    },
    target,
    modelId: automation.modelId,
    mode: automation.mode,
    permissionLevel: automation.permissionLevel ?? ChatPermissionLevel.Default,
    enabled: automation.enabled
  });
}
export {
  ConfigureAutomationToolReferenceName,
  IAutomationService,
  serializeAutomationEditableState
};
