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
import * as Objects from "../../../../base/common/objects.js";
import { ContributedTask, CustomTask, ConfiguringTask } from "../common/tasks.js";
import * as Types from "../../../../base/common/types.js";
import { ITaskService } from "../common/taskService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { getColorClass, createColorStyleElement } from "../../terminal/browser/terminalIcon.js";
import { showWithPinnedItems } from "../../../../platform/quickinput/browser/quickPickPin.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
const QUICKOPEN_DETAIL_CONFIG = "task.quickOpen.detail";
const QUICKOPEN_SKIP_CONFIG = "task.quickOpen.skip";
function isWorkspaceFolder(folder) {
  return "uri" in folder;
}
const SHOW_ALL = nls.localize("taskQuickPick.showAll", "Show All Tasks...");
const configureTaskIcon = registerIcon("tasks-list-configure", Codicon.gear, nls.localize("configureTaskIcon", "Configuration icon in the tasks selection list."));
const removeTaskIcon = registerIcon("tasks-remove", Codicon.close, nls.localize("removeTaskIcon", "Icon for remove in the tasks selection list."));
const runTaskStorageKey = "runTaskStorageKey";
let TaskQuickPick = class extends Disposable {
  constructor(_taskService, _configurationService, _quickInputService, _notificationService, _themeService, _dialogService, _storageService) {
    super();
    this._taskService = _taskService;
    this._configurationService = _configurationService;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._themeService = _themeService;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this._sorter = this._taskService.createSorter();
  }
  _showDetail() {
    return !!this._configurationService.getValue(QUICKOPEN_DETAIL_CONFIG);
  }
  _guessTaskLabel(task) {
    if (task._label) {
      return task._label;
    }
    if (ConfiguringTask.is(task)) {
      let label = task.configures.type;
      const configures = Objects.deepClone(task.configures);
      delete configures["_key"];
      delete configures["type"];
      Object.keys(configures).forEach((key) => label += `: ${configures[key]}`);
      return label;
    }
    return "";
  }
  static getTaskLabelWithIcon(task, labelGuess) {
    const label = labelGuess || task._label;
    const icon = task.configurationProperties.icon;
    if (!icon) {
      return `${label}`;
    }
    return icon.id ? `$(${icon.id}) ${label}` : `$(${Codicon.tools.id}) ${label}`;
  }
  static applyColorStyles(task, entry, themeService) {
    if (task.configurationProperties.icon?.color) {
      const colorTheme = themeService.getColorTheme();
      const disposable = createColorStyleElement(colorTheme);
      entry.iconClasses = [getColorClass(task.configurationProperties.icon.color)];
      return disposable;
    }
    return;
  }
  _createTaskEntry(task, extraButtons = []) {
    const buttons = [
      { iconClass: ThemeIcon.asClassName(configureTaskIcon), tooltip: nls.localize("configureTask", "Configure Task") },
      ...extraButtons
    ];
    const entry = { label: TaskQuickPick.getTaskLabelWithIcon(task, this._guessTaskLabel(task)), description: this._taskService.getTaskDescription(task), task, detail: this._showDetail() ? task.configurationProperties.detail : void 0, buttons };
    const disposable = TaskQuickPick.applyColorStyles(task, entry, this._themeService);
    if (disposable) {
      this._register(disposable);
    }
    return entry;
  }
  _createEntriesForGroup(entries, tasks, groupLabel, extraButtons = []) {
    entries.push({ type: "separator", label: groupLabel });
    tasks.forEach((task) => {
      if (!task.configurationProperties.hide) {
        entries.push(this._createTaskEntry(task, extraButtons));
      }
    });
  }
  _createTypeEntries(entries, types) {
    entries.push({ type: "separator", label: nls.localize("contributedTasks", "contributed") });
    types.forEach((type) => {
      entries.push({ label: `$(folder) ${type}`, task: type, ariaLabel: nls.localize("taskType", "All {0} tasks", type) });
    });
    entries.push({ label: SHOW_ALL, task: SHOW_ALL, alwaysShow: true });
  }
  _handleFolderTaskResult(result) {
    const tasks = [];
    Array.from(result).forEach(([key, folderTasks]) => {
      if (folderTasks.set) {
        tasks.push(...folderTasks.set.tasks);
      }
      if (folderTasks.configurations) {
        for (const configuration in folderTasks.configurations.byIdentifier) {
          tasks.push(folderTasks.configurations.byIdentifier[configuration]);
        }
      }
    });
    return tasks;
  }
  _dedupeConfiguredAndRecent(recentTasks, configuredTasks) {
    let dedupedConfiguredTasks = [];
    const foundRecentTasks = Array(recentTasks.length).fill(false);
    for (let j = 0; j < configuredTasks.length; j++) {
      const workspaceFolder = configuredTasks[j].getWorkspaceFolder()?.uri.toString();
      const definition = configuredTasks[j].getDefinition()?._key;
      const type = configuredTasks[j].type;
      const label = configuredTasks[j]._label;
      const recentKey = configuredTasks[j].getKey();
      const findIndex = recentTasks.findIndex((value) => {
        return workspaceFolder && definition && value.getWorkspaceFolder()?.uri.toString() === workspaceFolder && (value.getDefinition()?._key === definition || value.type === type && value._label === label) || recentKey && value.getKey() === recentKey;
      });
      if (findIndex === -1) {
        dedupedConfiguredTasks.push(configuredTasks[j]);
      } else {
        recentTasks[findIndex] = configuredTasks[j];
        foundRecentTasks[findIndex] = true;
      }
    }
    dedupedConfiguredTasks = dedupedConfiguredTasks.sort((a, b) => this._sorter.compare(a, b));
    const prunedRecentTasks = [];
    for (let i = 0; i < recentTasks.length; i++) {
      if (foundRecentTasks[i] || ConfiguringTask.is(recentTasks[i])) {
        prunedRecentTasks.push(recentTasks[i]);
      }
    }
    return { configuredTasks: dedupedConfiguredTasks, recentTasks: prunedRecentTasks };
  }
  async getTopLevelEntries(defaultEntry) {
    if (this._topLevelEntries !== void 0) {
      return { entries: this._topLevelEntries };
    }
    let recentTasks = (await this._taskService.getSavedTasks("historical")).reverse();
    const configuredTasks = this._handleFolderTaskResult(await this._taskService.getWorkspaceTasks());
    const extensionTaskTypes = this._taskService.taskTypes();
    this._topLevelEntries = [];
    const dedupeAndPrune = this._dedupeConfiguredAndRecent(recentTasks, configuredTasks);
    const dedupedConfiguredTasks = dedupeAndPrune.configuredTasks;
    recentTasks = dedupeAndPrune.recentTasks;
    if (recentTasks.length > 0) {
      const removeRecentButton = {
        iconClass: ThemeIcon.asClassName(removeTaskIcon),
        tooltip: nls.localize("removeRecent", "Remove Recently Used Task")
      };
      this._createEntriesForGroup(this._topLevelEntries, recentTasks, nls.localize("recentlyUsed", "recently used"), [removeRecentButton]);
    }
    if (configuredTasks.length > 0) {
      if (dedupedConfiguredTasks.length > 0) {
        this._createEntriesForGroup(this._topLevelEntries, dedupedConfiguredTasks, nls.localize("configured", "configured"));
      }
    }
    if (defaultEntry && configuredTasks.length === 0) {
      this._topLevelEntries.push({ type: "separator", label: nls.localize("configured", "configured") });
      this._topLevelEntries.push(defaultEntry);
    }
    if (extensionTaskTypes.length > 0) {
      this._createTypeEntries(this._topLevelEntries, extensionTaskTypes);
    }
    return { entries: this._topLevelEntries, isSingleConfigured: configuredTasks.length === 1 ? configuredTasks[0] : void 0 };
  }
  async handleSettingOption(selectedType) {
    const { confirmed } = await this._dialogService.confirm({
      type: Severity.Warning,
      message: nls.localize(
        "TaskQuickPick.changeSettingDetails",
        "Task detection for {0} tasks causes files in any workspace you open to be run as code. Enabling {0} task detection is a user setting and will apply to any workspace you open. \n\n Do you want to enable {0} task detection for all workspaces?",
        selectedType
      ),
      cancelButton: nls.localize("TaskQuickPick.changeSettingNo", "No")
    });
    if (confirmed) {
      await this._configurationService.updateValue(`${selectedType}.autoDetect`, "on");
      await new Promise((resolve) => setTimeout(() => resolve(), 100));
      return this.show(nls.localize("TaskService.pickRunTask", "Select the task to run"), void 0, selectedType);
    }
    return void 0;
  }
  async show(placeHolder, defaultEntry, startAtType, name) {
    const disposables = new DisposableStore();
    const picker = disposables.add(this._quickInputService.createQuickPick({ useSeparators: true }));
    picker.placeholder = placeHolder;
    picker.matchOnDescription = true;
    picker.ignoreFocusOut = false;
    disposables.add(picker.onDidTriggerItemButton(async (context) => {
      const task = context.item.task;
      if (context.button.iconClass === ThemeIcon.asClassName(removeTaskIcon)) {
        const key = task && !Types.isString(task) ? task.getKey() : void 0;
        if (key) {
          this._taskService.removeRecentlyUsedTask(key);
        }
        const indexToRemove = picker.items.indexOf(context.item);
        if (indexToRemove >= 0) {
          picker.items = [...picker.items.slice(0, indexToRemove), ...picker.items.slice(indexToRemove + 1)];
        }
      } else if (context.button.iconClass === ThemeIcon.asClassName(configureTaskIcon)) {
        this._quickInputService.cancel();
        if (ContributedTask.is(task)) {
          this._taskService.customize(task, void 0, true);
        } else if (CustomTask.is(task) || ConfiguringTask.is(task)) {
          let canOpenConfig = false;
          try {
            canOpenConfig = await this._taskService.openConfig(task);
          } catch (e) {
          }
          if (!canOpenConfig) {
            this._taskService.customize(task, void 0, true);
          }
        }
      }
    }));
    if (name) {
      picker.value = name;
    }
    let firstLevelTask = startAtType;
    if (!firstLevelTask) {
      const topLevelEntriesResult = await this.getTopLevelEntries(defaultEntry);
      if (topLevelEntriesResult.isSingleConfigured && this._configurationService.getValue(QUICKOPEN_SKIP_CONFIG)) {
        disposables.dispose();
        return this._toTask(topLevelEntriesResult.isSingleConfigured);
      }
      const taskQuickPickEntries = topLevelEntriesResult.entries;
      firstLevelTask = await this._doPickerFirstLevel(picker, taskQuickPickEntries, disposables);
    }
    do {
      if (Types.isString(firstLevelTask)) {
        if (name) {
          await this._doPickerFirstLevel(picker, (await this.getTopLevelEntries(defaultEntry)).entries, disposables);
          disposables.dispose();
          return void 0;
        }
        const selectedEntry = await this.doPickerSecondLevel(picker, disposables, firstLevelTask);
        if (selectedEntry && !selectedEntry.settingType && selectedEntry.task === null) {
          picker.value = "";
          firstLevelTask = await this._doPickerFirstLevel(picker, (await this.getTopLevelEntries(defaultEntry)).entries, disposables);
        } else if (selectedEntry && Types.isString(selectedEntry.settingType)) {
          disposables.dispose();
          return this.handleSettingOption(selectedEntry.settingType);
        } else {
          disposables.dispose();
          return selectedEntry?.task && !Types.isString(selectedEntry?.task) ? this._toTask(selectedEntry?.task) : void 0;
        }
      } else if (firstLevelTask) {
        disposables.dispose();
        return this._toTask(firstLevelTask);
      } else {
        disposables.dispose();
        return firstLevelTask;
      }
    } while (1);
    return;
  }
  async _doPickerFirstLevel(picker, taskQuickPickEntries, disposables) {
    picker.items = taskQuickPickEntries;
    disposables.add(showWithPinnedItems(this._storageService, runTaskStorageKey, picker, true));
    const firstLevelPickerResult = await new Promise((resolve) => {
      disposables.add(Event.once(picker.onDidAccept)(async () => {
        resolve(picker.selectedItems ? picker.selectedItems[0] : void 0);
      }));
    });
    return firstLevelPickerResult?.task;
  }
  async doPickerSecondLevel(picker, disposables, type, name) {
    picker.busy = true;
    if (type === SHOW_ALL) {
      const items = (await this._taskService.tasks()).filter((t) => !t.configurationProperties.hide).sort((a, b) => this._sorter.compare(a, b)).map((task) => this._createTaskEntry(task));
      items.push(...TaskQuickPick.allSettingEntries(this._configurationService));
      picker.items = items;
    } else {
      picker.value = name || "";
      picker.items = await this._getEntriesForProvider(type);
    }
    await picker.show();
    picker.busy = false;
    const secondLevelPickerResult = await new Promise((resolve) => {
      disposables.add(Event.once(picker.onDidAccept)(async () => {
        resolve(picker.selectedItems ? picker.selectedItems[0] : void 0);
      }));
    });
    return secondLevelPickerResult;
  }
  static allSettingEntries(configurationService) {
    const entries = [];
    const gruntEntry = TaskQuickPick.getSettingEntry(configurationService, "grunt");
    if (gruntEntry) {
      entries.push(gruntEntry);
    }
    const gulpEntry = TaskQuickPick.getSettingEntry(configurationService, "gulp");
    if (gulpEntry) {
      entries.push(gulpEntry);
    }
    const jakeEntry = TaskQuickPick.getSettingEntry(configurationService, "jake");
    if (jakeEntry) {
      entries.push(jakeEntry);
    }
    return entries;
  }
  static getSettingEntry(configurationService, type) {
    if (configurationService.getValue(`${type}.autoDetect`) === "off") {
      return {
        label: "$(gear) " + nls.localize(
          "TaskQuickPick.changeSettingsOptions",
          "{0} task detection is turned off. Enable {1} task detection...",
          type[0].toUpperCase() + type.slice(1),
          type
        ),
        task: null,
        settingType: type,
        alwaysShow: true
      };
    }
    return void 0;
  }
  async _getEntriesForProvider(type) {
    const tasks = (await this._taskService.tasks({ type })).sort((a, b) => this._sorter.compare(a, b));
    let taskQuickPickEntries = [];
    if (tasks.length > 0) {
      for (const task of tasks) {
        if (!task.configurationProperties.hide) {
          taskQuickPickEntries.push(this._createTaskEntry(task));
        }
      }
      taskQuickPickEntries.push({
        type: "separator"
      }, {
        label: nls.localize("TaskQuickPick.goBack", "Go back \u21A9"),
        task: null,
        alwaysShow: true
      });
    } else {
      taskQuickPickEntries = [{
        label: nls.localize("TaskQuickPick.noTasksForType", "No {0} tasks found. Go back \u21A9", type),
        task: null,
        alwaysShow: true
      }];
    }
    const settingEntry = TaskQuickPick.getSettingEntry(this._configurationService, type);
    if (settingEntry) {
      taskQuickPickEntries.push(settingEntry);
    }
    return taskQuickPickEntries;
  }
  async _toTask(task) {
    if (!ConfiguringTask.is(task)) {
      return task;
    }
    const resolvedTask = await this._taskService.tryResolveTask(task);
    if (!resolvedTask) {
      this._notificationService.error(nls.localize("noProviderForTask", 'There is no task provider registered for tasks of type "{0}".', task.type));
    }
    return resolvedTask;
  }
};
TaskQuickPick = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IStorageService)
], TaskQuickPick);
export {
  QUICKOPEN_DETAIL_CONFIG,
  QUICKOPEN_SKIP_CONFIG,
  TaskQuickPick,
  configureTaskIcon,
  isWorkspaceFolder
};
