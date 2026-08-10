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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue, transaction } from "../../../../base/common/observable.js";
import { joinPath, dirname, isEqual } from "../../../../base/common/resources.js";
import { parse } from "../../../../base/common/jsonc.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IJSONEditingService } from "../../../../workbench/services/configuration/common/jsonEditing.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IPreferencesService } from "../../../../workbench/services/preferences/common/preferences.js";
import { ISessionTaskRunnerRegistry } from "./sessionTaskRunner.js";
const ISessionsTasksService = createDecorator("sessionsTasksService");
let SessionsTasksService = class extends Disposable {
  constructor(_fileService, _jsonEditingService, _preferencesService, _taskRunnerRegistry, _storageService) {
    super();
    this._fileService = _fileService;
    this._jsonEditingService = _jsonEditingService;
    this._preferencesService = _preferencesService;
    this._taskRunnerRegistry = _taskRunnerRegistry;
    this._storageService = _storageService;
    this._onDidRunTask = this._register(new Emitter());
    this.onDidRunTask = this._onDidRunTask.event;
    this._sessionTasks = observableValue(this, []);
    this._fileWatcher = this._register(new MutableDisposable());
    this._pinnedTaskObservables = /* @__PURE__ */ new Map();
    this._browserUrlObservables = /* @__PURE__ */ new Map();
    this._pinnedBrowserObservables = /* @__PURE__ */ new Map();
    this._pinnedTaskLabels = this._loadPinnedTaskLabels();
    this._browserUrls = this._loadBrowserUrls();
    this._pinnedBrowsers = this._loadPinnedBrowsers();
  }
  static {
    this._PINNED_TASK_LABELS_KEY = "agentSessions.pinnedTaskLabels";
  }
  static {
    this._BROWSER_URLS_KEY = "agentSessions.browserUrls";
  }
  static {
    this._PINNED_BROWSERS_KEY = "agentSessions.pinnedBrowsers";
  }
  getSessionTasks(session) {
    const folder = this._getSessionFolder(session);
    this._ensureFileWatch(folder);
    if (!isEqual(this._lastRefreshedFolder, folder)) {
      this._lastRefreshedFolder = folder;
      this._refreshSessionTasks(folder);
    }
    return this._sessionTasks;
  }
  async getSessionTasksOnce(session) {
    return this._readTasksFromBothTargets(session, (t) => !!t.inAgents);
  }
  async getAllTasks(session) {
    return this._readTasksFromBothTargets(session, () => true);
  }
  async getNonSessionTasks(session) {
    return this._readTasksFromBothTargets(session, (t) => !t.inAgents);
  }
  /**
   * Reads tasks from both workspace and user `tasks.json` for a session,
   * filtering each entry through `predicate` (in addition to the supported-type
   * check) and tagging it with its storage target.
   */
  async _readTasksFromBothTargets(session, predicate) {
    const result = [];
    const targets = ["workspace", "user"];
    for (const target of targets) {
      const uri = this._getTasksJsonUri(session, target);
      if (!uri) {
        continue;
      }
      const json = await this._readTasksJson(uri);
      for (const task of json.tasks ?? []) {
        if (predicate(task) && this._isSupportedTask(task)) {
          result.push({ task, target });
        }
      }
    }
    return result;
  }
  async addTaskToSessions(task, session, target, options) {
    const tasksJsonUri = this._getTasksJsonUri(session, target);
    if (!tasksJsonUri) {
      return;
    }
    const tasksJson = await this._readTasksJson(tasksJsonUri);
    const tasks = tasksJson.tasks ?? [];
    const index = tasks.findIndex((t) => t.label === task.label);
    if (index === -1) {
      return;
    }
    const edits = [
      { path: ["tasks", index, "inAgents"], value: true }
    ];
    if (options) {
      edits.push({
        path: ["tasks", index, "runOptions"],
        value: options.runOn && options.runOn !== "default" ? { runOn: options.runOn } : void 0
      });
    }
    await this._jsonEditingService.write(tasksJsonUri, edits, true);
  }
  async createAndAddTask(label, command, session, target, options) {
    const tasksJsonUri = this._getTasksJsonUri(session, target);
    if (!tasksJsonUri) {
      return void 0;
    }
    const tasksJson = await this._readTasksJson(tasksJsonUri);
    const tasks = tasksJson.tasks ?? [];
    const resolvedLabel = label?.trim() || command;
    const newTask = {
      label: resolvedLabel,
      type: "shell",
      command,
      inAgents: true,
      ...options?.runOn && options.runOn !== "default" ? { runOptions: { runOn: options.runOn } } : {}
    };
    await this._jsonEditingService.write(tasksJsonUri, [
      { path: ["version"], value: tasksJson.version ?? "2.0.0" },
      { path: ["tasks"], value: [...tasks, newTask] }
    ], true);
    return newTask;
  }
  async updateTask(originalTaskLabel, updatedTask, session, currentTarget, newTarget) {
    const currentTasksJsonUri = this._getTasksJsonUri(session, currentTarget);
    const newTasksJsonUri = this._getTasksJsonUri(session, newTarget);
    if (!currentTasksJsonUri || !newTasksJsonUri) {
      return;
    }
    const currentTasksJson = await this._readTasksJson(currentTasksJsonUri);
    const currentTasks = currentTasksJson.tasks ?? [];
    const currentIndex = currentTasks.findIndex((task) => task.label === originalTaskLabel);
    if (currentIndex === -1) {
      return;
    }
    if (currentTasksJsonUri.toString() === newTasksJsonUri.toString()) {
      const updatedTasks = currentTasks.map((task, i) => i === currentIndex ? updatedTask : task);
      await this._jsonEditingService.write(currentTasksJsonUri, [
        { path: ["tasks"], value: updatedTasks }
      ], true);
    } else {
      const newTasksJson = await this._readTasksJson(newTasksJsonUri);
      const newTasks = newTasksJson.tasks ?? [];
      await this._jsonEditingService.write(currentTasksJsonUri, [
        { path: ["tasks"], value: currentTasks.filter((_, taskIndex) => taskIndex !== currentIndex) }
      ], true);
      await this._jsonEditingService.write(newTasksJsonUri, [
        { path: ["version"], value: newTasksJson.version ?? "2.0.0" },
        { path: ["tasks"], value: [...newTasks, updatedTask] }
      ], true);
    }
    const repoUri = this._getSessionRepo(session)?.root;
    if (repoUri) {
      const key = repoUri.toString();
      if (this._pinnedTaskLabels.get(key) === originalTaskLabel) {
        this._setPinnedTaskLabelForKey(key, updatedTask.label);
      }
    }
  }
  async removeTask(taskLabel, session, target) {
    const tasksJsonUri = this._getTasksJsonUri(session, target);
    if (!tasksJsonUri) {
      return;
    }
    const tasksJson = await this._readTasksJson(tasksJsonUri);
    const tasks = tasksJson.tasks ?? [];
    const index = tasks.findIndex((t) => t.label === taskLabel);
    if (index === -1) {
      return;
    }
    await this._jsonEditingService.write(tasksJsonUri, [
      { path: ["tasks"], value: tasks.filter((_, taskIndex) => taskIndex !== index) }
    ], true);
    const repoUri = this._getSessionRepo(session)?.root;
    if (repoUri) {
      const key = repoUri.toString();
      if (this._pinnedTaskLabels.get(key) === taskLabel) {
        this._setPinnedTaskLabelForKey(key, void 0);
      }
    }
  }
  async runTask(task, session) {
    const runner = this._taskRunnerRegistry.getRunner(session);
    if (!runner) {
      return void 0;
    }
    const handle = await runner.runTask(task, session);
    this._onDidRunTask.fire({ task, session });
    return handle;
  }
  getPinnedTaskLabel(repository) {
    if (!repository) {
      return observableValue("pinnedTaskLabel", void 0);
    }
    const key = repository.toString();
    let obs = this._pinnedTaskObservables.get(key);
    if (!obs) {
      obs = observableValue("pinnedTaskLabel", this._pinnedTaskLabels.get(key));
      this._pinnedTaskObservables.set(key, obs);
    }
    return obs;
  }
  setPinnedTaskLabel(repository, taskLabel) {
    if (!repository) {
      return;
    }
    const key = repository.toString();
    this._setPinnedTaskLabelForKey(key, taskLabel);
    if (taskLabel !== void 0) {
      this._setPinnedBrowserForKey(key, false);
    }
  }
  getBrowserUrl(repository) {
    if (!repository) {
      return observableValue("browserUrl", void 0);
    }
    const key = repository.toString();
    let obs = this._browserUrlObservables.get(key);
    if (!obs) {
      obs = observableValue("browserUrl", this._browserUrls.get(key));
      this._browserUrlObservables.set(key, obs);
    }
    return obs;
  }
  setBrowserUrl(repository, url) {
    if (!repository) {
      return;
    }
    const key = repository.toString();
    const trimmed = url?.trim();
    if (!trimmed) {
      this._browserUrls.delete(key);
    } else {
      this._browserUrls.set(key, trimmed);
    }
    this._saveBrowserUrls();
    const obs = this._browserUrlObservables.get(key);
    if (obs) {
      transaction((tx) => obs.set(trimmed || void 0, tx));
    }
  }
  getPinnedBrowser(repository) {
    if (!repository) {
      return observableValue("pinnedBrowser", false);
    }
    const key = repository.toString();
    let obs = this._pinnedBrowserObservables.get(key);
    if (!obs) {
      obs = observableValue("pinnedBrowser", this._pinnedBrowsers.has(key));
      this._pinnedBrowserObservables.set(key, obs);
    }
    return obs;
  }
  setPinnedBrowser(repository, pinned) {
    if (!repository) {
      return;
    }
    const key = repository.toString();
    this._setPinnedBrowserForKey(key, pinned);
    if (pinned) {
      this._setPinnedTaskLabelForKey(key, void 0);
    }
  }
  // --- private helpers ---
  _getSessionRepo(session) {
    return session.workspace.get()?.folders[0];
  }
  _getSessionFolder(session) {
    const repo = this._getSessionRepo(session);
    return repo?.workingDirectory ?? repo?.root;
  }
  _getTasksJsonUri(session, target) {
    if (target === "workspace") {
      return this._getWorkspaceTasksJsonUri(this._getSessionFolder(session));
    }
    return this._getUserTasksJsonUri();
  }
  _getWorkspaceTasksJsonUri(folder) {
    return folder?.path ? joinPath(folder, ".vscode", "tasks.json") : void 0;
  }
  _getUserTasksJsonUri() {
    const userSettingsResource = this._preferencesService.userSettingsResource;
    if (!userSettingsResource.path) {
      return void 0;
    }
    const userSettingsFolder = dirname(userSettingsResource);
    return userSettingsFolder.path ? joinPath(userSettingsFolder, "tasks.json") : void 0;
  }
  async _readTasksJson(uri) {
    try {
      const content = await this._fileService.readFile(uri);
      return parse(content.value.toString());
    } catch {
      return {};
    }
  }
  _isSupportedTask(task) {
    return !!task.label;
  }
  _ensureFileWatch(folder) {
    const tasksUri = this._getWorkspaceTasksJsonUri(folder);
    if (!tasksUri) {
      this._watchedResource = void 0;
      this._fileWatcher.clear();
      return;
    }
    if (this._watchedResource && this._watchedResource.toString() === tasksUri.toString()) {
      return;
    }
    this._watchedResource = tasksUri;
    const disposables = new DisposableStore();
    disposables.add(this._fileService.watch(tasksUri));
    const userUri = this._getUserTasksJsonUri();
    if (userUri) {
      disposables.add(this._fileService.watch(userUri));
    }
    disposables.add(this._fileService.onDidFilesChange((e) => {
      if (e.affects(tasksUri) || userUri && e.affects(userUri)) {
        this._refreshSessionTasks(folder);
      }
    }));
    this._fileWatcher.value = disposables;
  }
  async _refreshSessionTasks(folder) {
    if (!folder) {
      transaction((tx) => this._sessionTasks.set([], tx));
      return;
    }
    const tasksUri = this._getWorkspaceTasksJsonUri(folder);
    const tasksJson = tasksUri ? await this._readTasksJson(tasksUri) : {};
    const sessionTasks = (tasksJson.tasks ?? []).filter((t) => t.inAgents && this._isSupportedTask(t)).map((t) => ({ task: t, target: "workspace" }));
    const userUri = this._getUserTasksJsonUri();
    const userJson = userUri ? await this._readTasksJson(userUri) : {};
    const userSessionTasks = (userJson.tasks ?? []).filter((t) => t.inAgents && this._isSupportedTask(t)).map((t) => ({ task: t, target: "user" }));
    transaction((tx) => this._sessionTasks.set([...sessionTasks, ...userSessionTasks], tx));
  }
  _loadPinnedTaskLabels() {
    const raw = this._storageService.get(SessionsTasksService._PINNED_TASK_LABELS_KEY, StorageScope.APPLICATION);
    if (raw) {
      try {
        return new Map(Object.entries(JSON.parse(raw)));
      } catch {
      }
    }
    return /* @__PURE__ */ new Map();
  }
  _savePinnedTaskLabels() {
    this._storageService.store(
      SessionsTasksService._PINNED_TASK_LABELS_KEY,
      JSON.stringify(Object.fromEntries(this._pinnedTaskLabels)),
      StorageScope.APPLICATION,
      StorageTarget.USER
    );
  }
  _setPinnedTaskLabelForKey(key, taskLabel) {
    if (taskLabel === void 0) {
      this._pinnedTaskLabels.delete(key);
    } else {
      this._pinnedTaskLabels.set(key, taskLabel);
    }
    this._savePinnedTaskLabels();
    const obs = this._pinnedTaskObservables.get(key);
    if (obs) {
      transaction((tx) => obs.set(taskLabel, tx));
    }
  }
  _loadBrowserUrls() {
    const raw = this._storageService.get(SessionsTasksService._BROWSER_URLS_KEY, StorageScope.APPLICATION);
    if (raw) {
      try {
        return new Map(Object.entries(JSON.parse(raw)));
      } catch {
      }
    }
    return /* @__PURE__ */ new Map();
  }
  _saveBrowserUrls() {
    this._storageService.store(
      SessionsTasksService._BROWSER_URLS_KEY,
      JSON.stringify(Object.fromEntries(this._browserUrls)),
      StorageScope.APPLICATION,
      StorageTarget.USER
    );
  }
  _loadPinnedBrowsers() {
    const raw = this._storageService.get(SessionsTasksService._PINNED_BROWSERS_KEY, StorageScope.APPLICATION);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      } catch {
      }
    }
    return /* @__PURE__ */ new Set();
  }
  _savePinnedBrowsers() {
    this._storageService.store(
      SessionsTasksService._PINNED_BROWSERS_KEY,
      JSON.stringify([...this._pinnedBrowsers]),
      StorageScope.APPLICATION,
      StorageTarget.USER
    );
  }
  _setPinnedBrowserForKey(key, pinned) {
    if (pinned) {
      this._pinnedBrowsers.add(key);
    } else {
      this._pinnedBrowsers.delete(key);
    }
    this._savePinnedBrowsers();
    const obs = this._pinnedBrowserObservables.get(key);
    if (obs) {
      transaction((tx) => obs.set(pinned, tx));
    }
  }
};
SessionsTasksService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IJSONEditingService),
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, ISessionTaskRunnerRegistry),
  __decorateParam(4, IStorageService)
], SessionsTasksService);
export {
  ISessionsTasksService,
  SessionsTasksService
};
