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
import { toAction } from "../../../../base/common/actions.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { createErrorWithActions } from "../../../../base/common/errorMessage.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import severity from "../../../../base/common/severity.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { DEBUG_CONFIGURE_COMMAND_ID, DEBUG_CONFIGURE_LABEL } from "./debugCommands.js";
import { Markers } from "../../markers/common/markers.js";
import { ConfiguringTask, CustomTask, TaskEventKind } from "../../tasks/common/tasks.js";
import { ITaskService } from "../../tasks/common/taskService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
const onceFilter = (event, filter) => Event.once(Event.filter(event, filter));
var TaskRunResult = /* @__PURE__ */ ((TaskRunResult2) => {
  TaskRunResult2[TaskRunResult2["Failure"] = 0] = "Failure";
  TaskRunResult2[TaskRunResult2["Success"] = 1] = "Success";
  return TaskRunResult2;
})(TaskRunResult || {});
const DEBUG_TASK_ERROR_CHOICE_KEY = "debug.taskerrorchoice";
const ABORT_LABEL = nls.localize("abort", "Abort");
const DEBUG_ANYWAY_LABEL = nls.localize({ key: "debugAnyway", comment: ["&& denotes a mnemonic"] }, "&&Debug Anyway");
const DEBUG_ANYWAY_LABEL_NO_MEMO = nls.localize("debugAnywayNoMemo", "Debug Anyway");
let DebugTaskRunner = class {
  constructor(taskService, markerService, configurationService, viewsService, dialogService, storageService, commandService, progressService) {
    this.taskService = taskService;
    this.markerService = markerService;
    this.configurationService = configurationService;
    this.viewsService = viewsService;
    this.dialogService = dialogService;
    this.storageService = storageService;
    this.commandService = commandService;
    this.progressService = progressService;
    this.globalCancellation = new CancellationTokenSource();
  }
  cancel() {
    this.globalCancellation.dispose(true);
    this.globalCancellation = new CancellationTokenSource();
  }
  dispose() {
    this.globalCancellation.dispose(true);
  }
  async runTaskAndCheckErrors(root, taskId) {
    try {
      const taskSummary = await this.runTask(root, taskId, this.globalCancellation.token);
      if (taskSummary && (taskSummary.exitCode === void 0 || taskSummary.cancelled)) {
        return 0 /* Failure */;
      }
      const errorCount = taskId ? this.markerService.read({ severities: MarkerSeverity.Error, take: 2 }).length : 0;
      const successExitCode = taskSummary && taskSummary.exitCode === 0;
      const failureExitCode = taskSummary && taskSummary.exitCode !== 0;
      const onTaskErrors = this.configurationService.getValue("debug").onTaskErrors;
      if (successExitCode || onTaskErrors === "debugAnyway" || errorCount === 0 && !failureExitCode) {
        return 1 /* Success */;
      }
      if (onTaskErrors === "showErrors") {
        await this.viewsService.openView(Markers.MARKERS_VIEW_ID, true);
        return Promise.resolve(0 /* Failure */);
      }
      if (onTaskErrors === "abort") {
        return Promise.resolve(0 /* Failure */);
      }
      const taskLabel = typeof taskId === "string" ? taskId : taskId ? taskId.name : "";
      const message = errorCount > 1 ? nls.localize("preLaunchTaskErrors", "Errors exist after running preLaunchTask '{0}'.", taskLabel) : errorCount === 1 ? nls.localize("preLaunchTaskError", "Error exists after running preLaunchTask '{0}'.", taskLabel) : taskSummary && typeof taskSummary.exitCode === "number" ? nls.localize("preLaunchTaskExitCode", "The preLaunchTask '{0}' terminated with exit code {1}.", taskLabel, taskSummary.exitCode) : nls.localize("preLaunchTaskTerminated", "The preLaunchTask '{0}' terminated.", taskLabel);
      let DebugChoice;
      ((DebugChoice2) => {
        DebugChoice2[DebugChoice2["DebugAnyway"] = 1] = "DebugAnyway";
        DebugChoice2[DebugChoice2["ShowErrors"] = 2] = "ShowErrors";
        DebugChoice2[DebugChoice2["Cancel"] = 0] = "Cancel";
      })(DebugChoice || (DebugChoice = {}));
      const { result, checkboxChecked } = await this.dialogService.prompt({
        type: severity.Warning,
        message,
        buttons: [
          {
            label: DEBUG_ANYWAY_LABEL,
            run: () => 1 /* DebugAnyway */
          },
          {
            label: nls.localize({ key: "showErrors", comment: ["&& denotes a mnemonic"] }, "&&Show Errors"),
            run: () => 2 /* ShowErrors */
          }
        ],
        cancelButton: {
          label: ABORT_LABEL,
          run: () => 0 /* Cancel */
        },
        checkbox: {
          label: nls.localize("remember", "Remember my choice in user settings")
        }
      });
      const debugAnyway = result === 1 /* DebugAnyway */;
      const abort = result === 0 /* Cancel */;
      if (checkboxChecked) {
        this.configurationService.updateValue("debug.onTaskErrors", result === 1 /* DebugAnyway */ ? "debugAnyway" : abort ? "abort" : "showErrors");
      }
      if (abort) {
        return Promise.resolve(0 /* Failure */);
      }
      if (debugAnyway) {
        return 1 /* Success */;
      }
      await this.viewsService.openView(Markers.MARKERS_VIEW_ID, true);
      return Promise.resolve(0 /* Failure */);
    } catch (err) {
      const taskConfigureAction = this.taskService.configureAction();
      const choiceMap = JSON.parse(this.storageService.get(DEBUG_TASK_ERROR_CHOICE_KEY, StorageScope.WORKSPACE, "{}"));
      let choice = -1;
      let DebugChoice;
      ((DebugChoice2) => {
        DebugChoice2[DebugChoice2["DebugAnyway"] = 0] = "DebugAnyway";
        DebugChoice2[DebugChoice2["ConfigureTask"] = 1] = "ConfigureTask";
        DebugChoice2[DebugChoice2["Cancel"] = 2] = "Cancel";
      })(DebugChoice || (DebugChoice = {}));
      if (choiceMap[err.message] !== void 0) {
        choice = choiceMap[err.message];
      } else {
        const { result, checkboxChecked } = await this.dialogService.prompt({
          type: severity.Error,
          message: err.message,
          buttons: [
            {
              label: nls.localize({ key: "debugAnyway", comment: ["&& denotes a mnemonic"] }, "&&Debug Anyway"),
              run: () => 0 /* DebugAnyway */
            },
            {
              label: taskConfigureAction.label,
              run: () => 1 /* ConfigureTask */
            }
          ],
          cancelButton: {
            run: () => 2 /* Cancel */
          },
          checkbox: {
            label: nls.localize("rememberTask", "Remember my choice for this task")
          }
        });
        choice = result;
        if (checkboxChecked) {
          choiceMap[err.message] = choice;
          this.storageService.store(DEBUG_TASK_ERROR_CHOICE_KEY, JSON.stringify(choiceMap), StorageScope.WORKSPACE, StorageTarget.MACHINE);
        }
      }
      if (choice === 1 /* ConfigureTask */) {
        await taskConfigureAction.run();
      }
      return choice === 0 /* DebugAnyway */ ? 1 /* Success */ : 0 /* Failure */;
    }
  }
  async runTask(root, taskId, token = this.globalCancellation.token) {
    if (!taskId) {
      return Promise.resolve(null);
    }
    if (!root) {
      return Promise.reject(new Error(nls.localize("invalidTaskReference", "Task '{0}' can not be referenced from a launch configuration that is in a different workspace folder.", typeof taskId === "string" ? taskId : taskId.type)));
    }
    const task = await this.taskService.getTask(root, taskId);
    if (!task) {
      const errorMessage = typeof taskId === "string" ? nls.localize("DebugTaskNotFoundWithTaskId", "Could not find the task '{0}'.", taskId) : nls.localize("DebugTaskNotFound", "Could not find the specified task.");
      return Promise.reject(createErrorWithActions(errorMessage, [toAction({ id: DEBUG_CONFIGURE_COMMAND_ID, label: DEBUG_CONFIGURE_LABEL, enabled: true, run: () => this.commandService.executeCommand(DEBUG_CONFIGURE_COMMAND_ID) })]));
    }
    let taskStarted = false;
    const store = new DisposableStore();
    const getTaskKey = (t) => t.getKey() ?? t.getMapKey();
    const taskKey = getTaskKey(task);
    const inactivePromise = new Promise((resolve) => store.add(
      onceFilter(this.taskService.onDidStateChange, (e) => {
        return (e.kind === TaskEventKind.Inactive || e.kind === TaskEventKind.ProcessEnded && e.exitCode === void 0) && getTaskKey(e.__task) === taskKey;
      })((e) => {
        taskStarted = true;
        resolve(e.kind === TaskEventKind.ProcessEnded ? { exitCode: e.exitCode } : null);
      })
    ));
    store.add(
      onceFilter(
        this.taskService.onDidStateChange,
        (e) => (e.kind === TaskEventKind.Active || e.kind === TaskEventKind.DependsOnStarted) && getTaskKey(e.__task) === taskKey
      )(() => {
        taskStarted = true;
      })
    );
    const didAcquireInput = store.add(new Emitter());
    store.add(onceFilter(
      this.taskService.onDidStateChange,
      (e) => e.kind === TaskEventKind.AcquiredInput && getTaskKey(e.__task) === taskKey
    )(() => didAcquireInput.fire()));
    const taskDonePromise = this.taskService.getActiveTasks().then(async (tasks) => {
      if (tasks.find((t) => getTaskKey(t) === taskKey)) {
        didAcquireInput.fire();
        const busyTasks = await this.taskService.getBusyTasks();
        if (busyTasks.find((t) => getTaskKey(t) === taskKey)) {
          taskStarted = true;
          return inactivePromise;
        }
        return Promise.resolve(null);
      }
      const taskPromise = this.taskService.run(task);
      if (task.configurationProperties.isBackground) {
        return inactivePromise;
      }
      return taskPromise.then((x) => x ?? null);
    });
    const result = new Promise((resolve, reject) => {
      taskDonePromise.then((result2) => {
        taskStarted = true;
        resolve(result2);
      }, (error) => reject(error));
      store.add(token.onCancellationRequested(() => {
        resolve({ exitCode: void 0, cancelled: true });
        this.taskService.terminate(task).catch(() => {
        });
      }));
      store.add(didAcquireInput.event(() => {
        const waitTime = task.configurationProperties.isBackground ? 5e3 : 1e4;
        store.add(disposableTimeout(() => {
          if (!taskStarted) {
            const errorMessage = nls.localize("taskNotTracked", "The task '{0}' has not exited and doesn't have a 'problemMatcher' defined. Make sure to define a problem matcher for watch tasks.", typeof taskId === "string" ? taskId : JSON.stringify(taskId));
            reject({ severity: severity.Error, message: errorMessage });
          }
        }, waitTime));
        const hideSlowPreLaunchWarning = this.configurationService.getValue("debug").hideSlowPreLaunchWarning;
        if (!hideSlowPreLaunchWarning) {
          store.add(disposableTimeout(() => {
            const message = nls.localize("runningTask", "Waiting for preLaunchTask '{0}'...", task.configurationProperties.name);
            const buttons = [DEBUG_ANYWAY_LABEL_NO_MEMO, ABORT_LABEL];
            const canConfigure = task instanceof CustomTask || task instanceof ConfiguringTask;
            if (canConfigure) {
              buttons.splice(1, 0, nls.localize("configureTask", "Configure Task"));
            }
            this.progressService.withProgress(
              { location: ProgressLocation.Notification, title: message, buttons },
              () => result.catch(() => {
              }),
              (choice) => {
                if (choice === void 0) {
                } else if (choice === 0) {
                  resolve({ exitCode: 0 });
                } else {
                  resolve({ exitCode: void 0, cancelled: true });
                  this.taskService.terminate(task).catch(() => {
                  });
                  if (canConfigure && choice === 1) {
                    this.taskService.openConfig(task);
                  }
                }
              }
            );
          }, 1e4));
        }
      }));
    });
    return result.finally(() => store.dispose());
  }
};
DebugTaskRunner = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IViewsService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IProgressService)
], DebugTaskRunner);
export {
  DebugTaskRunner,
  TaskRunResult
};
