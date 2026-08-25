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
import * as resources from "../../../../base/common/resources.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ITaskService } from "../common/taskService.js";
import { RunOnOptions, TaskRunSource, TaskSourceKind, TASKS_CATEGORY } from "../common/tasks.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Event } from "../../../../base/common/event.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const HAS_PROMPTED_FOR_AUTOMATIC_TASKS = "task.hasPromptedForAutomaticTasks.v2";
const ALLOW_AUTOMATIC_TASKS = "task.allowAutomaticTasks";
let RunAutomaticTasks = class extends Disposable {
  constructor(_taskService, _configurationService, _workspaceTrustManagementService, _logService, _storageService, _notificationService, _openerService) {
    super();
    this._taskService = _taskService;
    this._configurationService = _configurationService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._logService = _logService;
    this._storageService = _storageService;
    this._notificationService = _notificationService;
    this._openerService = _openerService;
    this._hasRunTasks = false;
    if (this._taskService.isReconnected) {
      this._tryRunTasks();
    } else {
      this._register(Event.once(this._taskService.onDidReconnectToTasks)(async () => await this._tryRunTasks()));
    }
    this._register(this._workspaceTrustManagementService.onDidChangeTrust(async () => await this._tryRunTasks()));
  }
  async _tryRunTasks() {
    if (!this._workspaceTrustManagementService.isWorkspaceTrusted()) {
      return;
    }
    const { value, userValue } = this._configurationService.inspect(ALLOW_AUTOMATIC_TASKS);
    if (this._hasRunTasks || value === "off" && userValue !== void 0) {
      return;
    }
    this._hasRunTasks = true;
    this._logService.trace("RunAutomaticTasks: Trying to run tasks.");
    if (!this._taskService.hasTaskSystemInfo) {
      this._logService.trace("RunAutomaticTasks: Awaiting task system info.");
      await Event.toPromise(Event.once(this._taskService.onDidChangeTaskSystemInfo));
    }
    let workspaceTasks = await this._taskService.getWorkspaceTasks(TaskRunSource.FolderOpen);
    this._logService.trace(`RunAutomaticTasks: Found ${workspaceTasks.size} automatic tasks`);
    let autoTasks = this._findAutoTasks(this._taskService, workspaceTasks);
    this._logService.trace(`RunAutomaticTasks: taskNames=${JSON.stringify(autoTasks.taskNames)}`);
    if (autoTasks.taskNames.length === 0) {
      const updatedWithinTimeout = await Promise.race([
        new Promise((resolve) => {
          Event.toPromise(Event.once(this._taskService.onDidChangeTaskConfig)).then(() => resolve(true));
        }),
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve(false);
          }, 1e4);
        })
      ]);
      if (!updatedWithinTimeout) {
        this._logService.trace(`RunAutomaticTasks: waited some extra time, but no update of tasks configuration`);
        return;
      }
      workspaceTasks = await this._taskService.getWorkspaceTasks(TaskRunSource.FolderOpen);
      autoTasks = this._findAutoTasks(this._taskService, workspaceTasks);
      this._logService.trace(`RunAutomaticTasks: updated taskNames=${JSON.stringify(autoTasks.taskNames)}`);
    }
    this._runWithPermission(this._taskService, this._configurationService, this._storageService, this._notificationService, this._openerService, autoTasks.tasks, autoTasks.taskNames, autoTasks.locations);
  }
  _runTasks(taskService, tasks) {
    tasks.forEach((task) => {
      if (task instanceof Promise) {
        task.then((promiseResult) => {
          if (promiseResult) {
            taskService.run(promiseResult);
          }
        });
      } else {
        taskService.run(task);
      }
    });
  }
  _getTaskSource(source) {
    const taskKind = TaskSourceKind.toConfigurationTarget(source.kind);
    switch (taskKind) {
      case ConfigurationTarget.WORKSPACE_FOLDER: {
        return resources.joinPath(source.config.workspaceFolder.uri, source.config.file);
      }
      case ConfigurationTarget.WORKSPACE: {
        return source.config.workspace?.configuration ?? void 0;
      }
    }
    return void 0;
  }
  _findAutoTasks(taskService, workspaceTaskResult) {
    const tasks = new Array();
    const taskNames = new Array();
    const locations = /* @__PURE__ */ new Map();
    if (workspaceTaskResult) {
      workspaceTaskResult.forEach((resultElement) => {
        if (resultElement.set) {
          resultElement.set.tasks.forEach((task) => {
            if (task.runOptions.runOn === RunOnOptions.folderOpen) {
              tasks.push(task);
              taskNames.push(task._label);
              const location = this._getTaskSource(task._source);
              if (location) {
                locations.set(location.fsPath, location);
              }
            }
          });
        }
        if (resultElement.configurations) {
          for (const configuredTask of Object.values(resultElement.configurations.byIdentifier)) {
            if (configuredTask.runOptions.runOn === RunOnOptions.folderOpen) {
              tasks.push(new Promise((resolve) => {
                taskService.getTask(resultElement.workspaceFolder, configuredTask._id, true).then((task) => resolve(task));
              }));
              if (configuredTask._label) {
                taskNames.push(configuredTask._label);
              } else {
                taskNames.push(configuredTask.configures.task);
              }
              const location = this._getTaskSource(configuredTask._source);
              if (location) {
                locations.set(location.fsPath, location);
              }
            }
          }
        }
      });
    }
    return { tasks, taskNames, locations };
  }
  async _runWithPermission(taskService, configurationService, storageService, notificationService, openerService, tasks, taskNames, locations) {
    if (taskNames.length === 0) {
      return;
    }
    if (configurationService.getValue(ALLOW_AUTOMATIC_TASKS) === "on") {
      this._runTasks(taskService, tasks);
      return;
    }
    const hasShownPromptForAutomaticTasks = storageService.getBoolean(HAS_PROMPTED_FOR_AUTOMATIC_TASKS, StorageScope.WORKSPACE, false);
    if (hasShownPromptForAutomaticTasks) {
      return;
    }
    const allow = await this._showPrompt(notificationService, storageService, openerService, configurationService, taskNames, locations);
    if (allow) {
      this._runTasks(taskService, tasks);
    }
  }
  _showPrompt(notificationService, storageService, openerService, configurationService, taskNames, locations) {
    return new Promise((resolve) => {
      notificationService.prompt(
        Severity.Info,
        nls.localize(
          "tasks.run.allowAutomatic",
          "This workspace has tasks ({0}) defined ({1}) that can launch processes automatically when you open this workspace. Do you want to allow automatic tasks to run in all trusted workspaces?",
          taskNames.join(", "),
          Array.from(locations.keys()).join(", ")
        ),
        [
          {
            label: nls.localize("allow", "Allow"),
            run: () => {
              resolve(true);
              configurationService.updateValue(ALLOW_AUTOMATIC_TASKS, "on", ConfigurationTarget.USER);
            }
          },
          {
            label: nls.localize("disallow", "Disallow"),
            run: () => {
              resolve(false);
              configurationService.updateValue(ALLOW_AUTOMATIC_TASKS, "off", ConfigurationTarget.USER);
            }
          },
          {
            label: locations.size === 1 ? nls.localize("openTask", "Open File") : nls.localize("openTasks", "Open Files"),
            run: async () => {
              for (const location of locations) {
                await openerService.open(location[1]);
              }
              resolve(false);
            }
          }
        ],
        { onCancel: () => resolve(false) }
      );
      storageService.store(HAS_PROMPTED_FOR_AUTOMATIC_TASKS, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    });
  }
};
RunAutomaticTasks = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceTrustManagementService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IOpenerService)
], RunAutomaticTasks);
class ManageAutomaticTaskRunning extends Action2 {
  static {
    this.ID = "workbench.action.tasks.manageAutomaticRunning";
  }
  static {
    this.LABEL = nls.localize("workbench.action.tasks.manageAutomaticRunning", "Manage Automatic Tasks");
  }
  constructor() {
    super({
      id: ManageAutomaticTaskRunning.ID,
      title: ManageAutomaticTaskRunning.LABEL,
      category: TASKS_CATEGORY
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    const allowItem = { label: nls.localize("workbench.action.tasks.allowAutomaticTasks", "Allow Automatic Tasks") };
    const disallowItem = { label: nls.localize("workbench.action.tasks.disallowAutomaticTasks", "Disallow Automatic Tasks") };
    const value = await quickInputService.pick([allowItem, disallowItem], { canPickMany: false });
    if (!value) {
      return;
    }
    configurationService.updateValue(ALLOW_AUTOMATIC_TASKS, value === allowItem ? "on" : "off", ConfigurationTarget.USER);
  }
}
export {
  ManageAutomaticTaskRunning,
  RunAutomaticTasks
};
