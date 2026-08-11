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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import Severity from "../../../../base/common/severity.js";
import { StartStopProblemCollector } from "../common/problemCollectors.js";
import { TaskEventKind, TaskRunType } from "../common/tasks.js";
import { ITaskService } from "../common/taskService.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { spinningLoading } from "../../../../platform/theme/common/iconRegistry.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
const TASK_TERMINAL_STATUS_ID = "task_terminal_status";
const ACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: spinningLoading, severity: Severity.Info, tooltip: nls.localize("taskTerminalStatus.active", "Task is running") };
const SUCCEEDED_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.check, severity: Severity.Info, tooltip: nls.localize("taskTerminalStatus.succeeded", "Task succeeded") };
const SUCCEEDED_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.check, severity: Severity.Info, tooltip: nls.localize("taskTerminalStatus.succeededInactive", "Task succeeded and waiting...") };
const FAILED_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.error, severity: Severity.Error, tooltip: nls.localize("taskTerminalStatus.errors", "Task has errors") };
const FAILED_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.error, severity: Severity.Error, tooltip: nls.localize("taskTerminalStatus.errorsInactive", "Task has errors and is waiting...") };
const WARNING_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.warning, severity: Severity.Warning, tooltip: nls.localize("taskTerminalStatus.warnings", "Task has warnings") };
const WARNING_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.warning, severity: Severity.Warning, tooltip: nls.localize("taskTerminalStatus.warningsInactive", "Task has warnings and is waiting...") };
const INFO_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.info, severity: Severity.Info, tooltip: nls.localize("taskTerminalStatus.infos", "Task has infos") };
const INFO_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.info, severity: Severity.Info, tooltip: nls.localize("taskTerminalStatus.infosInactive", "Task has infos and is waiting...") };
let TaskTerminalStatus = class extends Disposable {
  constructor(taskService, _accessibilitySignalService) {
    super();
    this._accessibilitySignalService = _accessibilitySignalService;
    this.terminalMap = this._register(new DisposableMap());
    this._register(taskService.onDidStateChange((event) => {
      switch (event.kind) {
        case TaskEventKind.ProcessStarted:
        case TaskEventKind.Active:
          this.eventActive(event);
          break;
        case TaskEventKind.Inactive:
          this.eventInactive(event);
          break;
        case TaskEventKind.ProcessEnded:
          this.eventEnd(event);
          break;
      }
    }));
  }
  addTerminal(task, terminal, problemMatcher) {
    const status = { id: TASK_TERMINAL_STATUS_ID, severity: Severity.Info };
    terminal.statusList.add(status);
    const store = new DisposableStore();
    store.add(problemMatcher.onDidFindFirstMatch(() => {
      this._marker = terminal.registerMarker();
      if (this._marker) {
        store.add(this._marker);
      }
    }));
    store.add(problemMatcher.onDidFindErrors(() => {
      if (this._marker) {
        terminal.addBufferMarker({ marker: this._marker, hoverMessage: nls.localize("task.watchFirstError", "Beginning of detected errors for this run"), disableCommandStorage: true });
      }
    }));
    store.add(problemMatcher.onDidRequestInvalidateLastMarker(() => {
      this._marker?.dispose();
      this._marker = void 0;
    }));
    store.add(terminal.onDisposed(() => {
      this.terminalMap.deleteAndDispose(terminal.instanceId);
    }));
    this.terminalMap.set(terminal.instanceId, {
      terminal,
      task,
      status,
      problemMatcher,
      taskRunEnded: false,
      dispose() {
        store.dispose();
      }
    });
  }
  terminalFromEvent(event) {
    if (!Object.hasOwn(event, "terminalId") || !event.terminalId) {
      return void 0;
    }
    return this.terminalMap.get(event.terminalId);
  }
  eventEnd(event) {
    const terminalData = this.terminalFromEvent(event);
    if (!terminalData) {
      return;
    }
    terminalData.taskRunEnded = true;
    terminalData.terminal.statusList.remove(terminalData.status);
    if (event.exitCode === 0 && (!terminalData.problemMatcher.maxMarkerSeverity || terminalData.problemMatcher.maxMarkerSeverity < MarkerSeverity.Warning)) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.taskCompleted);
      if (terminalData.task.configurationProperties.isBackground) {
        for (const status of terminalData.terminal.statusList.statuses) {
          terminalData.terminal.statusList.remove(status);
        }
      } else {
        terminalData.terminal.statusList.add(SUCCEEDED_TASK_STATUS);
      }
    } else if (event.exitCode || terminalData.problemMatcher.maxMarkerSeverity !== void 0 && terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Error) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.taskFailed);
      terminalData.terminal.statusList.add(FAILED_TASK_STATUS);
    } else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Warning) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.taskFailed);
      terminalData.terminal.statusList.add(WARNING_TASK_STATUS);
    } else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Info) {
      terminalData.terminal.statusList.add(INFO_TASK_STATUS);
    }
  }
  eventInactive(event) {
    const terminalData = this.terminalFromEvent(event);
    if (!terminalData || !terminalData.problemMatcher || terminalData.taskRunEnded) {
      return;
    }
    terminalData.terminal.statusList.remove(terminalData.status);
    if (terminalData.problemMatcher.numberOfMatches === 0) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.taskCompleted);
      terminalData.terminal.statusList.add(SUCCEEDED_INACTIVE_TASK_STATUS);
    } else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Error) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.taskFailed);
      terminalData.terminal.statusList.add(FAILED_INACTIVE_TASK_STATUS);
    } else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Warning) {
      terminalData.terminal.statusList.add(WARNING_INACTIVE_TASK_STATUS);
    } else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Info) {
      terminalData.terminal.statusList.add(INFO_INACTIVE_TASK_STATUS);
    }
  }
  eventActive(event) {
    const terminalData = this.terminalFromEvent(event);
    if (!terminalData) {
      return;
    }
    terminalData.taskRunEnded = false;
    terminalData.terminal.statusList.remove(terminalData.status);
    if (terminalData.problemMatcher instanceof StartStopProblemCollector || terminalData.problemMatcher?.problemMatchers.length > 0 || event.runType === TaskRunType.SingleRun) {
      terminalData.terminal.statusList.add(ACTIVE_TASK_STATUS);
    }
  }
};
TaskTerminalStatus = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IAccessibilitySignalService)
], TaskTerminalStatus);
export {
  ACTIVE_TASK_STATUS,
  FAILED_TASK_STATUS,
  SUCCEEDED_TASK_STATUS,
  TaskTerminalStatus
};
