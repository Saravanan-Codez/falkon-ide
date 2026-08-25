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
import { localize } from "../../../../nls.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ITaskService } from "../common/taskService.js";
import { CustomTask, ContributedTask, ConfiguringTask } from "../common/tasks.js";
import { TaskQuickPick } from "./taskQuickPick.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isString } from "../../../../base/common/types.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let TasksQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(extensionService, _taskService, _configurationService, _quickInputService, _notificationService, _dialogService, _themeService, _storageService) {
    super(TasksQuickAccessProvider.PREFIX, {
      noResultsPick: {
        label: localize("noTaskResults", "No matching tasks")
      }
    });
    this._taskService = _taskService;
    this._configurationService = _configurationService;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._dialogService = _dialogService;
    this._themeService = _themeService;
    this._storageService = _storageService;
  }
  static {
    this.PREFIX = "task ";
  }
  async _getPicks(filter, disposables, token) {
    if (token.isCancellationRequested) {
      return [];
    }
    const taskQuickPick = new TaskQuickPick(this._taskService, this._configurationService, this._quickInputService, this._notificationService, this._themeService, this._dialogService, this._storageService);
    const topLevelPicks = await taskQuickPick.getTopLevelEntries();
    const taskPicks = [];
    for (const entry of topLevelPicks.entries) {
      const highlights = matchesFuzzy(filter, entry.label);
      if (!highlights) {
        continue;
      }
      if (entry.type === "separator") {
        taskPicks.push(entry);
      }
      const task = entry.task;
      const quickAccessEntry = entry;
      quickAccessEntry.highlights = { label: highlights };
      quickAccessEntry.trigger = (index) => {
        if (index === 1 && quickAccessEntry.buttons?.length === 2) {
          const key = task && !isString(task) ? task.getKey() : void 0;
          if (key) {
            this._taskService.removeRecentlyUsedTask(key);
          }
          return TriggerAction.REFRESH_PICKER;
        } else {
          if (ContributedTask.is(task)) {
            this._taskService.customize(task, void 0, true);
          } else if (CustomTask.is(task)) {
            this._taskService.openConfig(task);
          }
          return TriggerAction.CLOSE_PICKER;
        }
      };
      quickAccessEntry.accept = async () => {
        if (isString(task)) {
          const showResult = await taskQuickPick.show(localize("TaskService.pickRunTask", "Select the task to run"), void 0, task);
          if (showResult) {
            this._taskService.run(showResult, { attachProblemMatcher: true });
          }
        } else {
          this._taskService.run(await this._toTask(task), { attachProblemMatcher: true });
        }
      };
      taskPicks.push(quickAccessEntry);
    }
    return taskPicks;
  }
  async _toTask(task) {
    if (!ConfiguringTask.is(task)) {
      return task;
    }
    return this._taskService.tryResolveTask(task);
  }
};
TasksQuickAccessProvider = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, ITaskService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IStorageService)
], TasksQuickAccessProvider);
export {
  TasksQuickAccessProvider
};
