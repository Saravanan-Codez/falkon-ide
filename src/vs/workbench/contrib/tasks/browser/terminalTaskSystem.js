import { asArray } from "../../../../base/common/arrays.js";
import * as Async from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { isUNC } from "../../../../base/common/extpath.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { LinkedMap, Touch } from "../../../../base/common/map.js";
import * as Objects from "../../../../base/common/objects.js";
import * as path from "../../../../base/common/path.js";
import * as Platform from "../../../../base/common/platform.js";
import * as resources from "../../../../base/common/resources.js";
import Severity from "../../../../base/common/severity.js";
import * as Types from "../../../../base/common/types.js";
import * as nls from "../../../../nls.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { Markers } from "../../markers/common/markers.js";
import { ProblemMatcherRegistry } from "../common/problemMatcher.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { TaskTerminalStatus } from "./taskTerminalStatus.js";
import { ProblemCollectorEventKind, ProblemHandlingStrategy, StartStopProblemCollector, WatchingProblemCollector } from "../common/problemCollectors.js";
import { GroupKind } from "../common/taskConfiguration.js";
import { TaskError, TaskErrors, TaskExecuteKind, Triggers, VerifiedTask } from "../common/taskSystem.js";
import { CommandString, ContributedTask, CustomTask, DependsOrder, InMemoryTask, PanelKind, RerunForActiveTerminalCommandId, RevealKind, RevealProblemKind, RuntimeType, ShellQuoting, TASK_TERMINAL_ACTIVE, TaskEvent, TaskEventKind, TaskScope, TaskSourceKind, rerunTaskIcon } from "../common/tasks.js";
import { VSCodeOscProperty, VSCodeOscPt, VSCodeSequence } from "../../terminal/browser/terminalEscapeSequences.js";
import { TerminalProcessExtHostProxy } from "../../terminal/browser/terminalProcessExtHostProxy.js";
import { TERMINAL_VIEW_ID } from "../../terminal/common/terminal.js";
import { TaskProblemMonitor } from "./taskProblemMonitor.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { serializeVSCodeOscMessage } from "../../../../platform/terminal/common/xterm/shellIntegrationAddon.js";
const TaskTerminalType = "Task";
class VariableResolver {
  constructor(workspaceFolder, taskSystemInfo, values, _service) {
    this.workspaceFolder = workspaceFolder;
    this.taskSystemInfo = taskSystemInfo;
    this.values = values;
    this._service = _service;
  }
  static {
    this._regex = /\$\{(.*?)\}/g;
  }
  async resolve(value) {
    const replacers = [];
    value.replace(VariableResolver._regex, (match, ...args) => {
      replacers.push(this._replacer(match, args));
      return match;
    });
    const resolvedReplacers = await Promise.all(replacers);
    return value.replace(VariableResolver._regex, () => resolvedReplacers.shift());
  }
  async _replacer(match, args) {
    const result = this.values.get(match.substring(2, match.length - 1));
    if (result !== void 0 && result !== null) {
      return result;
    }
    if (this._service) {
      return this._service.resolveAsync(this.workspaceFolder, match);
    }
    return match;
  }
}
class TerminalTaskSystem extends Disposable {
  constructor(_terminalService, _terminalGroupService, _outputService, _paneCompositeService, _viewsService, _markerService, _modelService, _configurationResolverService, _contextService, _environmentService, _outputChannelId, _fileService, _terminalProfileResolverService, _pathService, _viewDescriptorService, _logService, _notificationService, contextKeyService, instantiationService, taskSystemInfoResolver, _taskLookup) {
    super();
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._outputService = _outputService;
    this._paneCompositeService = _paneCompositeService;
    this._viewsService = _viewsService;
    this._markerService = _markerService;
    this._modelService = _modelService;
    this._configurationResolverService = _configurationResolverService;
    this._contextService = _contextService;
    this._environmentService = _environmentService;
    this._outputChannelId = _outputChannelId;
    this._fileService = _fileService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._pathService = _pathService;
    this._viewDescriptorService = _viewDescriptorService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._taskLookup = _taskLookup;
    this._isRerun = false;
    this._terminalCreationQueue = Promise.resolve();
    this._hasReconnected = false;
    this._terminalTabActions = [{ id: RerunForActiveTerminalCommandId, label: nls.localize("rerunTask", "Rerun Task"), icon: rerunTaskIcon }];
    this._taskStartTimes = /* @__PURE__ */ new Map();
    this._capturedTaskVariables = /* @__PURE__ */ new Map();
    this._activeTasks = /* @__PURE__ */ Object.create(null);
    this._busyTasks = /* @__PURE__ */ Object.create(null);
    this._taskErrors = /* @__PURE__ */ Object.create(null);
    this._taskDependencies = /* @__PURE__ */ Object.create(null);
    this._terminals = /* @__PURE__ */ Object.create(null);
    this._idleTaskTerminals = new LinkedMap();
    this._sameTaskTerminals = /* @__PURE__ */ Object.create(null);
    this._onDidStateChange = this._register(new Emitter());
    this._taskSystemInfoResolver = taskSystemInfoResolver;
    this._register(this._terminalStatusManager = instantiationService.createInstance(TaskTerminalStatus));
    this._register(this._taskProblemMonitor = instantiationService.createInstance(TaskProblemMonitor));
    this._taskTerminalActive = TASK_TERMINAL_ACTIVE.bindTo(contextKeyService);
    this._register(this._terminalService.onDidChangeActiveInstance((e) => this._taskTerminalActive.set(e?.shellLaunchConfig.type === "Task")));
  }
  static {
    this.TelemetryEventName = "taskService";
  }
  static {
    this.ProcessVarName = "__process__";
  }
  static {
    this._shellQuotes = {
      "cmd": {
        strong: '"'
      },
      "powershell": {
        escape: {
          escapeChar: "`",
          charsToEscape: ` "'()`
        },
        strong: "'",
        weak: '"'
      },
      "bash": {
        escape: {
          escapeChar: "\\",
          charsToEscape: ` "'`
        },
        strong: "'",
        weak: '"'
      },
      "zsh": {
        escape: {
          escapeChar: "\\",
          charsToEscape: ` "'`
        },
        strong: "'",
        weak: '"'
      }
    };
  }
  static {
    this._osShellQuotes = {
      "Linux": TerminalTaskSystem._shellQuotes["bash"],
      "Mac": TerminalTaskSystem._shellQuotes["bash"],
      "Windows": TerminalTaskSystem._shellQuotes["powershell"]
    };
  }
  taskShellIntegrationStartSequence(cwd) {
    return VSCodeSequence(VSCodeOscPt.Property, `${VSCodeOscProperty.HasRichCommandDetection}=True`) + VSCodeSequence(VSCodeOscPt.PromptStart) + VSCodeSequence(VSCodeOscPt.Property, `${VSCodeOscProperty.Task}=True`) + (cwd ? VSCodeSequence(VSCodeOscPt.Property, `${VSCodeOscProperty.Cwd}=${typeof cwd === "string" ? cwd : cwd.fsPath}`) : "") + VSCodeSequence(VSCodeOscPt.CommandStart);
  }
  getTaskShellIntegrationOutputSequence(commandLineInfo) {
    return (commandLineInfo ? VSCodeSequence(VSCodeOscPt.CommandLine, `${serializeVSCodeOscMessage(commandLineInfo.commandLine)};${commandLineInfo.nonce}`) : "") + VSCodeSequence(VSCodeOscPt.CommandExecuted);
  }
  get onDidStateChange() {
    return this._onDidStateChange.event;
  }
  _log(value) {
    this._appendOutput(value + "\n");
  }
  _showOutput() {
    this._outputService.showChannel(this._outputChannelId, true);
  }
  reconnect(task, resolver) {
    this._reconnectToTerminals();
    return this.run(task, resolver, Triggers.reconnect);
  }
  run(task, resolver, trigger = Triggers.command) {
    task = task.clone();
    const instances = InMemoryTask.is(task) || this._isTaskEmpty(task) ? [] : this._getInstances(task);
    const validInstance = instances.length < ((task.runOptions && task.runOptions.instanceLimit) ?? 1);
    const instance = instances[0]?.count?.count ?? 0;
    this._currentTask = new VerifiedTask(task, resolver, trigger);
    if (instance > 0) {
      task.instance = instance;
    }
    if (!validInstance) {
      const terminalData = instances[instances.length - 1];
      this._lastTask = this._currentTask;
      return { kind: TaskExecuteKind.Active, task: terminalData.task, active: { same: true, background: task.configurationProperties.isBackground }, promise: terminalData.promise };
    }
    try {
      const executeResult = { kind: TaskExecuteKind.Started, task, started: {}, promise: this._executeTask(task, resolver, trigger, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Map(), void 0) };
      executeResult.promise.then((summary) => {
        this._lastTask = this._currentTask;
      });
      return executeResult;
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      } else if (error instanceof Error) {
        this._log(error.message);
        throw new TaskError(Severity.Error, error.message, TaskErrors.UnknownError);
      } else {
        this._log(error.toString());
        throw new TaskError(Severity.Error, nls.localize("TerminalTaskSystem.unknownError", "A unknown error has occurred while executing a task. See task output log for details."), TaskErrors.UnknownError);
      }
    }
  }
  getTerminalsForTasks(tasks) {
    const results = [];
    for (const t of asArray(tasks)) {
      for (const key of Object.keys(this._terminals)) {
        const value = this._terminals[key];
        if (value.lastTask === t.getMapKey()) {
          results.push(value.terminal.resource);
        }
      }
    }
    return results.length > 0 ? results : void 0;
  }
  getTaskProblems(instanceId) {
    return this._taskProblemMonitor.getTaskProblems(instanceId);
  }
  rerun() {
    if (this._lastTask && this._lastTask.verify()) {
      if (this._lastTask.task.runOptions.reevaluateOnRerun !== void 0 && !this._lastTask.task.runOptions.reevaluateOnRerun) {
        this._isRerun = true;
      }
      const result = this.run(this._lastTask.task, this._lastTask.resolver);
      result.promise.then((summary) => {
        this._isRerun = false;
      });
      return result;
    } else {
      return void 0;
    }
  }
  get lastTask() {
    return this._lastTask;
  }
  set lastTask(task) {
    this._lastTask = task;
  }
  _showTaskLoadErrors(task) {
    if (task.taskLoadMessages && task.taskLoadMessages.length > 0) {
      task.taskLoadMessages.forEach((loadMessage) => {
        this._log(loadMessage + "\n");
      });
      const openOutput = "Show Output";
      this._notificationService.prompt(
        Severity.Warning,
        nls.localize(
          "TerminalTaskSystem.taskLoadReporting",
          'There are issues with task "{0}". See the output for more details.',
          task._label
        ),
        [{
          label: openOutput,
          run: () => this._showOutput()
        }]
      );
    }
  }
  isTaskVisible(task) {
    const terminalData = this._activeTasks[task.getMapKey()];
    if (!terminalData?.terminal) {
      return false;
    }
    const activeTerminalInstance = this._terminalService.activeInstance;
    const isPanelShowingTerminal = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    return isPanelShowingTerminal && activeTerminalInstance?.instanceId === terminalData.terminal.instanceId;
  }
  revealTask(task) {
    const terminalData = this._activeTasks[task.getMapKey()];
    if (!terminalData?.terminal) {
      return false;
    }
    const isTerminalInPanel = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID) === ViewContainerLocation.Panel;
    if (isTerminalInPanel && this.isTaskVisible(task)) {
      if (this._previousPanelId) {
        if (this._previousTerminalInstance) {
          this._terminalService.setActiveInstance(this._previousTerminalInstance);
        }
        this._paneCompositeService.openPaneComposite(this._previousPanelId, ViewContainerLocation.Panel);
      } else {
        this._paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
      }
      this._previousPanelId = void 0;
      this._previousTerminalInstance = void 0;
    } else {
      if (isTerminalInPanel) {
        this._previousPanelId = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)?.getId();
        if (this._previousPanelId === TERMINAL_VIEW_ID) {
          this._previousTerminalInstance = this._terminalService.activeInstance ?? void 0;
        }
      }
      this._terminalService.setActiveInstance(terminalData.terminal);
      if (CustomTask.is(task) || ContributedTask.is(task)) {
        this._terminalGroupService.showPanel(task.command.presentation.focus);
      }
    }
    return true;
  }
  isActive() {
    return Promise.resolve(this.isActiveSync());
  }
  isActiveSync() {
    return Object.values(this._activeTasks).some((value) => !!value.terminal);
  }
  canAutoTerminate() {
    return Object.values(this._activeTasks).every((value) => !value.task.configurationProperties.promptOnClose);
  }
  getActiveTasks() {
    return Object.values(this._activeTasks).flatMap((value) => value.terminal ? value.task : []);
  }
  getLastInstance(task) {
    const recentKey = task.getKey();
    return Object.values(this._activeTasks).reverse().find(
      (value) => recentKey && recentKey === value.task.getKey()
    )?.task;
  }
  getFirstInstance(task) {
    const recentKey = task.getKey();
    for (const task2 of this.getActiveTasks()) {
      if (recentKey && recentKey === task2.getKey()) {
        return task2;
      }
    }
    return void 0;
  }
  getBusyTasks() {
    return Object.keys(this._busyTasks).map((key) => this._busyTasks[key]);
  }
  customExecutionComplete(task, result) {
    const activeTerminal = this._activeTasks[task.getMapKey()];
    if (!activeTerminal?.terminal) {
      return Promise.reject(new Error("Expected to have a terminal for a custom execution task"));
    }
    return new Promise((resolve) => {
      resolve();
    });
  }
  _getInstances(task) {
    const recentKey = task.getKey();
    return Object.values(this._activeTasks).filter(
      (value) => recentKey && recentKey === value.task.getKey()
    );
  }
  _removeFromActiveTasks(task) {
    const key = typeof task === "string" ? task : task.getMapKey();
    const taskToRemove = this._activeTasks[key];
    if (!taskToRemove) {
      return;
    }
    delete this._activeTasks[key];
  }
  _fireTaskEvent(event) {
    if (event.kind !== TaskEventKind.Changed && event.kind !== TaskEventKind.ProblemMatcherEnded && event.kind !== TaskEventKind.ProblemMatcherStarted) {
      const activeTask = this._activeTasks[event.__task.getMapKey()];
      if (activeTask) {
        activeTask.state = event.kind;
      }
    }
    this._onDidStateChange.fire(event);
  }
  terminate(task) {
    const activeTerminal = this._activeTasks[task.getMapKey()];
    if (!activeTerminal) {
      return Promise.resolve({ success: false, task: void 0 });
    }
    const terminal = activeTerminal.terminal;
    if (!terminal) {
      return Promise.resolve({ success: false, task: void 0 });
    }
    return new Promise((resolve, reject) => {
      const onExit = terminal.onExit(() => {
        const terminatedTask = activeTerminal.task;
        try {
          onExit.dispose();
          this._fireTaskEvent(TaskEvent.terminated(terminatedTask, terminal.instanceId, terminal.exitReason));
        } catch (error) {
        }
        resolve({ success: true, task: terminatedTask });
      });
      terminal.dispose();
    });
  }
  terminateAll() {
    const promises = [];
    for (const [key, terminalData] of Object.entries(this._activeTasks)) {
      const terminal = terminalData?.terminal;
      if (terminal) {
        promises.push(new Promise((resolve, reject) => {
          const onExit = terminal.onExit(() => {
            const task = terminalData.task;
            try {
              onExit.dispose();
              this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
            } catch (error) {
            }
            if (this._activeTasks[key] === terminalData) {
              delete this._activeTasks[key];
            }
            resolve({ success: true, task: terminalData.task });
          });
        }));
        terminal.dispose();
      }
    }
    return Promise.all(promises);
  }
  _showDependencyCycleMessage(task) {
    this._log(nls.localize(
      "dependencyCycle",
      'There is a dependency cycle. See task "{0}".',
      task._label
    ));
    this._showOutput();
  }
  _executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved) {
    this._showTaskLoadErrors(task);
    const mapKey = task.getMapKey();
    const promise = Promise.resolve().then(async () => {
      alreadyResolved = alreadyResolved ?? /* @__PURE__ */ new Map();
      const promises = [];
      if (task.configurationProperties.dependsOn) {
        const nextLiveDependencies = new Set(liveDependencies).add(task.getCommonTaskId());
        for (const dependency of task.configurationProperties.dependsOn) {
          const dependencyTask = await resolver.resolve(dependency.uri, dependency.task);
          if (dependencyTask) {
            this._adoptConfigurationForDependencyTask(dependencyTask, task);
            const taskMapKey = task.getMapKey();
            const dependencyMapKey = dependencyTask.getMapKey();
            if (!this._taskDependencies[taskMapKey]) {
              this._taskDependencies[taskMapKey] = [];
            }
            if (!this._taskDependencies[taskMapKey].includes(dependencyMapKey)) {
              this._taskDependencies[taskMapKey].push(dependencyMapKey);
            }
            let taskResult;
            const commonKey = dependencyTask.getCommonTaskId();
            if (nextLiveDependencies.has(commonKey)) {
              this._showDependencyCycleMessage(dependencyTask);
              taskResult = Promise.resolve({});
            } else {
              taskResult = encounteredTasks.get(commonKey);
              if (!taskResult) {
                const activeTask2 = this._activeTasks[dependencyTask.getMapKey()] ?? this._getInstances(dependencyTask).pop();
                taskResult = activeTask2 && this._getDependencyPromise(activeTask2);
              }
            }
            if (!taskResult) {
              this._fireTaskEvent(TaskEvent.general(TaskEventKind.DependsOnStarted, task));
              taskResult = this._executeDependencyTask(dependencyTask, resolver, trigger, nextLiveDependencies, encounteredTasks, alreadyResolved);
            }
            encounteredTasks.set(commonKey, taskResult);
            promises.push(taskResult);
            if (task.configurationProperties.dependsOrder === DependsOrder.sequence) {
              const promiseResult = await taskResult;
              if (promiseResult.exitCode !== 0) {
                break;
              }
            }
          } else {
            this._log(nls.localize(
              "dependencyFailed",
              "Couldn't resolve dependent task '{0}' in workspace folder '{1}'",
              Types.isString(dependency.task) ? dependency.task : JSON.stringify(dependency.task, void 0, 0),
              dependency.uri.toString()
            ));
            this._showOutput();
          }
        }
      }
      return Promise.all(promises).then((summaries) => {
        for (const summary of summaries) {
          if (summary.exitCode !== 0) {
            return { exitCode: summary.exitCode };
          }
        }
        if ((ContributedTask.is(task) || CustomTask.is(task)) && task.command) {
          if (this._isRerun) {
            return this._reexecuteCommand(task, trigger, alreadyResolved);
          } else {
            return this._executeCommand(task, trigger, alreadyResolved);
          }
        }
        return { exitCode: 0 };
      });
    }).finally(() => {
      if (this._activeTasks[mapKey] === activeTask) {
        delete this._activeTasks[mapKey];
      }
    });
    const lastInstance = this._getInstances(task).pop();
    const count = lastInstance?.count ?? { count: 0 };
    count.count++;
    const activeTask = { task, promise, count };
    this._activeTasks[mapKey] = activeTask;
    return promise;
  }
  _createInactiveDependencyPromise(task) {
    return new Promise((resolve) => {
      const taskInactiveDisposable = this.onDidStateChange((taskEvent) => {
        if (taskEvent.kind === TaskEventKind.Inactive && taskEvent.__task === task) {
          taskInactiveDisposable.dispose();
          resolve({ exitCode: 0 });
        }
      });
    });
  }
  _taskHasErrors(task) {
    const taskMapKey = task.getMapKey();
    if (this._taskErrors[taskMapKey]) {
      return true;
    }
    const dependencies = this._taskDependencies[taskMapKey];
    if (dependencies) {
      for (const dependencyMapKey of dependencies) {
        if (this._taskErrors[dependencyMapKey]) {
          return true;
        }
      }
    }
    return false;
  }
  _cleanupTaskTracking(task) {
    const taskMapKey = task.getMapKey();
    delete this._taskErrors[taskMapKey];
    delete this._taskDependencies[taskMapKey];
  }
  _adoptConfigurationForDependencyTask(dependencyTask, task) {
    if (dependencyTask.configurationProperties.icon) {
      dependencyTask.configurationProperties.icon.id ||= task.configurationProperties.icon?.id;
      dependencyTask.configurationProperties.icon.color ||= task.configurationProperties.icon?.color;
    } else {
      dependencyTask.configurationProperties.icon = task.configurationProperties.icon;
    }
  }
  async _getDependencyPromise(task) {
    if (!task.task.configurationProperties.isBackground) {
      return task.promise;
    }
    if (!task.task.configurationProperties.problemMatchers || task.task.configurationProperties.problemMatchers.length === 0) {
      return task.promise;
    }
    if (task.state === TaskEventKind.Inactive) {
      return { exitCode: 0 };
    }
    return this._createInactiveDependencyPromise(task.task);
  }
  async _executeDependencyTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved) {
    if (!task.configurationProperties.isBackground) {
      return this._executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved);
    }
    const inactivePromise = this._createInactiveDependencyPromise(task);
    return Promise.race([inactivePromise, this._executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved)]);
  }
  async _resolveAndFindExecutable(systemInfo, workspaceFolder, task, cwd, envPath) {
    const command = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name));
    cwd = cwd ? await this._configurationResolverService.resolveAsync(workspaceFolder, cwd) : void 0;
    const delimiter = (await this._pathService.path).delimiter;
    const paths = envPath ? await Promise.all(envPath.split(delimiter).map((p) => this._configurationResolverService.resolveAsync(workspaceFolder, p))) : void 0;
    const foundExecutable = await systemInfo?.findExecutable(command, cwd, paths);
    if (foundExecutable) {
      return foundExecutable;
    }
    if (path.isAbsolute(command)) {
      return command;
    }
    return path.join(cwd ?? "", command);
  }
  _findUnresolvedVariables(variables, alreadyResolved) {
    if (alreadyResolved.size === 0) {
      return variables;
    }
    const unresolved = /* @__PURE__ */ new Set();
    for (const variable of variables) {
      if (!alreadyResolved.has(variable.substring(2, variable.length - 1))) {
        unresolved.add(variable);
      }
    }
    return unresolved;
  }
  _mergeMaps(mergeInto, mergeFrom) {
    for (const entry of mergeFrom) {
      if (!mergeInto.has(entry[0])) {
        mergeInto.set(entry[0], entry[1]);
      }
    }
  }
  async _acquireInput(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved) {
    const resolved = await this._resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved);
    this._fireTaskEvent(TaskEvent.general(TaskEventKind.AcquiredInput, task));
    return resolved;
  }
  _resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved) {
    const isProcess = task.command && task.command.runtime === RuntimeType.Process;
    const options = task.command && task.command.options ? task.command.options : void 0;
    const cwd = options ? options.cwd : void 0;
    let envPath = void 0;
    if (options && options.env) {
      for (const key of Object.keys(options.env)) {
        if (key.toLowerCase() === "path") {
          if (Types.isString(options.env[key])) {
            envPath = options.env[key];
          }
          break;
        }
      }
    }
    const unresolved = this._findUnresolvedVariables(variables, alreadyResolved);
    let resolvedVariables;
    if (taskSystemInfo && workspaceFolder) {
      const resolveSet = {
        variables: unresolved
      };
      if (taskSystemInfo.platform === Platform.Platform.Windows && isProcess) {
        resolveSet.process = { name: CommandString.value(task.command.name) };
        if (cwd) {
          resolveSet.process.cwd = cwd;
        }
        if (envPath) {
          resolveSet.process.path = envPath;
        }
      }
      resolvedVariables = taskSystemInfo.resolveVariables(workspaceFolder, resolveSet, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolved) => {
        if (!resolved) {
          return void 0;
        }
        this._mergeMaps(alreadyResolved, resolved.variables);
        resolved.variables = new Map(alreadyResolved);
        if (isProcess) {
          let process = CommandString.value(task.command.name);
          if (taskSystemInfo.platform === Platform.Platform.Windows) {
            process = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
          }
          resolved.variables.set(TerminalTaskSystem.ProcessVarName, process);
        }
        return resolved;
      });
      return resolvedVariables;
    } else {
      const variablesArray = new Array();
      unresolved.forEach((variable) => variablesArray.push(variable));
      return new Promise((resolve, reject) => {
        this._configurationResolverService.resolveWithInteraction(workspaceFolder, variablesArray, "tasks", void 0, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolvedVariablesMap) => {
          if (resolvedVariablesMap) {
            this._mergeMaps(alreadyResolved, resolvedVariablesMap);
            resolvedVariablesMap = new Map(alreadyResolved);
            if (isProcess) {
              let processVarValue;
              if (Platform.isWindows) {
                processVarValue = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
              } else {
                processVarValue = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name));
              }
              resolvedVariablesMap.set(TerminalTaskSystem.ProcessVarName, processVarValue);
            }
            const resolvedVariablesResult = {
              variables: resolvedVariablesMap
            };
            resolve(resolvedVariablesResult);
          } else {
            resolve(void 0);
          }
        }, (reason) => {
          reject(reason);
        });
      });
    }
  }
  _executeCommand(task, trigger, alreadyResolved) {
    const taskWorkspaceFolder = task.getWorkspaceFolder();
    let workspaceFolder;
    if (taskWorkspaceFolder) {
      workspaceFolder = this._currentTask.workspaceFolder = taskWorkspaceFolder;
    } else {
      const folders = this._contextService.getWorkspace().folders;
      workspaceFolder = folders.length > 0 ? folders[0] : void 0;
    }
    const systemInfo = this._currentTask.systemInfo = this._taskSystemInfoResolver(workspaceFolder);
    const variables = /* @__PURE__ */ new Set();
    this._collectTaskVariables(variables, task);
    const resolvedVariables = this._acquireInput(systemInfo, workspaceFolder, task, variables, alreadyResolved);
    return resolvedVariables.then((resolvedVariables2) => {
      if (resolvedVariables2 && !this._isTaskEmpty(task)) {
        this._currentTask.resolvedVariables = resolvedVariables2;
        return this._executeInTerminal(task, trigger, new VariableResolver(workspaceFolder, systemInfo, resolvedVariables2.variables, this._configurationResolverService), workspaceFolder);
      } else {
        this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
        return Promise.resolve({ exitCode: 0 });
      }
    }, (reason) => {
      return Promise.reject(reason);
    });
  }
  _isTaskEmpty(task) {
    const isCustomExecution = task.command.runtime === RuntimeType.CustomExecution;
    return !(task.command !== void 0 && task.command.runtime && (isCustomExecution || task.command.name !== void 0));
  }
  _reexecuteCommand(task, trigger, alreadyResolved) {
    const lastTask = this._lastTask;
    if (!lastTask) {
      return Promise.reject(new Error("No task previously run"));
    }
    const workspaceFolder = this._currentTask.workspaceFolder = lastTask.workspaceFolder;
    this._currentTask.systemInfo = lastTask.systemInfo;
    const variables = /* @__PURE__ */ new Set();
    this._collectTaskVariables(variables, task);
    let hasAllVariables = true;
    variables.forEach((value) => {
      if (Object.hasOwn(lastTask.getVerifiedTask().resolvedVariables, value.substring(2, value.length - 1))) {
        hasAllVariables = false;
      }
    });
    if (!hasAllVariables) {
      return this._acquireInput(lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().workspaceFolder, task, variables, alreadyResolved).then((resolvedVariables) => {
        if (!resolvedVariables) {
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
          return { exitCode: 0 };
        }
        this._currentTask.resolvedVariables = resolvedVariables;
        return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
      }, (reason) => {
        return Promise.reject(reason);
      });
    } else {
      this._currentTask.resolvedVariables = lastTask.getVerifiedTask().resolvedVariables;
      return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
    }
  }
  async _executeInTerminal(task, trigger, resolver, workspaceFolder) {
    let terminal = void 0;
    let error = void 0;
    let promise = void 0;
    if (task.configurationProperties.isBackground) {
      const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
      const watchingProblemMatcher = new WatchingProblemCollector(problemMatchers, this._markerService, this._modelService, this._fileService, this._logService);
      if (problemMatchers.length > 0 && !watchingProblemMatcher.isWatching()) {
        this._appendOutput(nls.localize("TerminalTaskSystem.nonWatchingMatcher", "Task {0} is a background task but uses a problem matcher without a background pattern", task._label));
        this._showOutput();
      }
      const toDispose = new DisposableStore();
      let eventCounter = 0;
      const mapKey = task.getMapKey();
      toDispose.add(watchingProblemMatcher.onDidStateChange((event) => {
        if (event.kind === ProblemCollectorEventKind.BackgroundProcessingBegins) {
          eventCounter++;
          this._busyTasks[mapKey] = task;
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.Active, task, terminal?.instanceId));
        } else if (event.kind === ProblemCollectorEventKind.BackgroundProcessingEnds) {
          eventCounter--;
          if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
          }
          if (event.capturedVariables) {
            this._registerCapturedVariables(event.capturedVariables);
          }
          this._fireTaskEvent(TaskEvent.inactive(task, terminal?.instanceId, this._takeTaskDuration(terminal?.instanceId)));
          if (eventCounter === 0) {
            if (watchingProblemMatcher.numberOfMatches > 0 && watchingProblemMatcher.maxMarkerSeverity && watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
              this._taskErrors[task.getMapKey()] = true;
              this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
              const reveal = task.command.presentation.reveal;
              const revealProblems = task.command.presentation.revealProblems;
              if (revealProblems === RevealProblemKind.OnProblem) {
                this._viewsService.openView(Markers.MARKERS_VIEW_ID, true);
              } else if (reveal === RevealKind.Silent) {
                this._terminalService.setActiveInstance(terminal);
                this._terminalGroupService.showPanel(false);
              }
            } else {
              this._fireTaskEvent(TaskEvent.problemMatcherEnded(task, this._taskHasErrors(task), terminal?.instanceId));
            }
          }
        }
      }));
      watchingProblemMatcher.aboutToStart();
      let delayer = void 0;
      [terminal, error] = await this._createTerminal(task, resolver, workspaceFolder);
      if (error) {
        return Promise.reject(new Error(error.message));
      }
      if (!terminal) {
        return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
      }
      this._terminalStatusManager.addTerminal(task, terminal, watchingProblemMatcher);
      this._taskProblemMonitor.addTerminal(terminal, watchingProblemMatcher);
      let processStartedSignaled = false;
      terminal.processReady.then(() => {
        if (!processStartedSignaled) {
          this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
          processStartedSignaled = true;
        }
      }, (_error) => {
        this._logService.error("Task terminal process never got ready");
      });
      this._taskStartTimes.set(terminal.instanceId, Date.now());
      this._fireTaskEvent(TaskEvent.start(task, terminal.instanceId, resolver.values));
      let onData;
      if (problemMatchers.length) {
        onData = terminal.onLineData((line) => {
          watchingProblemMatcher.processLine(line);
          if (!delayer) {
            delayer = new Async.Delayer(3e3);
          }
          delayer.trigger(() => {
            watchingProblemMatcher.forceDelivery();
            delayer = void 0;
          });
        });
      }
      promise = new Promise((resolve, reject) => {
        const boundTerminal = terminal;
        const onExit = terminal.onExit((terminalLaunchResult) => {
          const exitCode = typeof terminalLaunchResult === "number" ? terminalLaunchResult : terminalLaunchResult?.code;
          onData?.dispose();
          onExit.dispose();
          const key = task.getMapKey();
          if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
          }
          const cur = this._activeTasks[key];
          if (cur && cur.terminal === boundTerminal) {
            this._removeFromActiveTasks(task);
          }
          this._fireTaskEvent(TaskEvent.changed());
          if (terminalLaunchResult !== void 0) {
            switch (task.command.presentation.panel) {
              case PanelKind.Dedicated:
                this._sameTaskTerminals[key] = terminal.instanceId.toString();
                break;
              case PanelKind.Shared:
                this._idleTaskTerminals.set(key, terminal.instanceId.toString(), Touch.AsOld);
                break;
            }
          }
          const reveal = task.command.presentation.reveal;
          if (reveal === RevealKind.Silent && (exitCode !== 0 || watchingProblemMatcher.numberOfMatches > 0 && watchingProblemMatcher.maxMarkerSeverity && watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error)) {
            try {
              this._terminalService.setActiveInstance(terminal);
              this._terminalGroupService.showPanel(false);
            } catch (e) {
            }
          }
          watchingProblemMatcher.done();
          watchingProblemMatcher.dispose();
          if (!processStartedSignaled) {
            this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
            processStartedSignaled = true;
          }
          const durationMs = this._takeTaskDuration(terminal.instanceId);
          this._fireTaskEvent(TaskEvent.processEnded(task, terminal.instanceId, exitCode, durationMs));
          for (let i = 0; i < eventCounter; i++) {
            this._fireTaskEvent(TaskEvent.inactive(task, terminal.instanceId));
          }
          eventCounter = 0;
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
          toDispose.dispose();
          resolve({ exitCode: exitCode ?? void 0 });
        });
      });
      if (trigger === Triggers.reconnect && !!terminal.xterm) {
        const bufferLines = [];
        const bufferReverseIterator = terminal.xterm.getBufferReverseIterator();
        const startRegex = new RegExp(watchingProblemMatcher.beginPatterns.map((pattern) => pattern.source).join("|"));
        for (const nextLine of bufferReverseIterator) {
          bufferLines.push(nextLine);
          if (startRegex.test(nextLine)) {
            break;
          }
        }
        let delayer2 = void 0;
        for (let i = bufferLines.length - 1; i >= 0; i--) {
          watchingProblemMatcher.processLine(bufferLines[i]);
          if (!delayer2) {
            delayer2 = new Async.Delayer(3e3);
          }
          delayer2.trigger(() => {
            watchingProblemMatcher.forceDelivery();
            delayer2 = void 0;
          });
        }
      }
    } else {
      [terminal, error] = await this._createTerminal(task, resolver, workspaceFolder);
      if (error) {
        return Promise.reject(new Error(error.message));
      }
      if (!terminal) {
        return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
      }
      this._taskStartTimes.set(terminal.instanceId, Date.now());
      this._fireTaskEvent(TaskEvent.start(task, terminal.instanceId, resolver.values));
      const mapKey = task.getMapKey();
      this._busyTasks[mapKey] = task;
      this._fireTaskEvent(TaskEvent.general(TaskEventKind.Active, task, terminal.instanceId));
      const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
      const startStopProblemMatcher = new StartStopProblemCollector(problemMatchers, this._markerService, this._modelService, ProblemHandlingStrategy.Clean, this._fileService, this._logService);
      this._terminalStatusManager.addTerminal(task, terminal, startStopProblemMatcher);
      this._taskProblemMonitor.addTerminal(terminal, startStopProblemMatcher);
      const problemMatcherListener = startStopProblemMatcher.onDidStateChange((event) => {
        if (event.kind === ProblemCollectorEventKind.BackgroundProcessingBegins) {
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherStarted, task, terminal?.instanceId));
        } else if (event.kind === ProblemCollectorEventKind.BackgroundProcessingEnds) {
          if (startStopProblemMatcher.numberOfMatches && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
            this._taskErrors[task.getMapKey()] = true;
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
          } else {
            this._fireTaskEvent(TaskEvent.problemMatcherEnded(task, this._taskHasErrors(task), terminal?.instanceId));
          }
        }
      });
      let processStartedSignaled = false;
      terminal.processReady.then(() => {
        if (!processStartedSignaled) {
          this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
          processStartedSignaled = true;
        }
      }, (_error) => {
      });
      const onData = terminal.onLineData((line) => {
        startStopProblemMatcher.processLine(line);
      });
      promise = new Promise((resolve, reject) => {
        const boundTerminal = terminal;
        const onExit = terminal.onExit((terminalLaunchResult) => {
          const exitCode = typeof terminalLaunchResult === "number" ? terminalLaunchResult : terminalLaunchResult?.code;
          onExit.dispose();
          const key = task.getMapKey();
          const cur = this._activeTasks[key];
          if (cur && cur.terminal === boundTerminal) {
            this._removeFromActiveTasks(task);
          }
          this._fireTaskEvent(TaskEvent.changed());
          if (terminalLaunchResult !== void 0) {
            switch (task.command.presentation.panel) {
              case PanelKind.Dedicated:
                this._sameTaskTerminals[key] = terminal.instanceId.toString();
                break;
              case PanelKind.Shared:
                this._idleTaskTerminals.set(key, terminal.instanceId.toString(), Touch.AsOld);
                break;
            }
          }
          const reveal = task.command.presentation.reveal;
          const revealProblems = task.command.presentation.revealProblems;
          const revealProblemPanel = terminal && revealProblems === RevealProblemKind.OnProblem && startStopProblemMatcher.numberOfMatches > 0;
          if (revealProblemPanel) {
            this._viewsService.openView(Markers.MARKERS_VIEW_ID);
          } else if (terminal && reveal === RevealKind.Silent && (exitCode !== 0 || startStopProblemMatcher.numberOfMatches > 0 && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error)) {
            try {
              this._terminalService.setActiveInstance(terminal);
              this._terminalGroupService.showPanel(false);
            } catch (e) {
            }
          }
          setTimeout(() => {
            onData.dispose();
            startStopProblemMatcher.done();
            startStopProblemMatcher.dispose();
            problemMatcherListener.dispose();
          }, 100);
          if (!processStartedSignaled && terminal) {
            this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
            processStartedSignaled = true;
          }
          const durationMs = this._takeTaskDuration(terminal?.instanceId);
          this._fireTaskEvent(TaskEvent.processEnded(task, terminal?.instanceId, exitCode ?? void 0, durationMs));
          if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
          }
          this._fireTaskEvent(TaskEvent.inactive(task, terminal?.instanceId, durationMs));
          if (startStopProblemMatcher.numberOfMatches && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
            this._taskErrors[task.getMapKey()] = true;
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
          } else {
            this._fireTaskEvent(TaskEvent.problemMatcherEnded(task, this._taskHasErrors(task), terminal?.instanceId));
          }
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task, terminal?.instanceId));
          this._cleanupTaskTracking(task);
          resolve({ exitCode: exitCode ?? void 0 });
        });
      });
    }
    const showProblemPanel = task.command.presentation && task.command.presentation.revealProblems === RevealProblemKind.Always;
    if (showProblemPanel) {
      this._viewsService.openView(Markers.MARKERS_VIEW_ID);
    } else if (task.command.presentation && (task.command.presentation.focus || task.command.presentation.reveal === RevealKind.Always)) {
      this._terminalService.setActiveInstance(terminal);
      await this._terminalService.revealTerminal(terminal);
      if (task.command.presentation.focus && terminal) {
        await this._terminalService.focusInstance(terminal);
      }
    }
    if (this._activeTasks[task.getMapKey()]) {
      this._activeTasks[task.getMapKey()].terminal = terminal;
    } else {
      this._logService.warn("No active tasks found for the terminal.");
    }
    this._fireTaskEvent(TaskEvent.changed());
    return promise;
  }
  _takeTaskDuration(terminalId) {
    if (terminalId === void 0) {
      return void 0;
    }
    const startTime = this._taskStartTimes.get(terminalId);
    if (startTime === void 0) {
      return void 0;
    }
    this._taskStartTimes.delete(terminalId);
    return Date.now() - startTime;
  }
  _registerCapturedVariables(capturedVariables) {
    for (const [name, value] of capturedVariables) {
      this._capturedTaskVariables.set(name, value);
      if (!this._configurationResolverService.resolvableVariables.has(`taskVar:${name}`)) {
        this._configurationResolverService.contributeVariable(`taskVar:${name}`, async () => this._capturedTaskVariables.get(name));
      }
    }
  }
  _createTerminalName(task) {
    const needsFolderQualification = this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
    return needsFolderQualification ? task.getQualifiedLabel() : task.configurationProperties.name || "";
  }
  async _createShellLaunchConfig(task, workspaceFolder, variableResolver, platform, options, command, args, waitOnExit, presentationOptions) {
    let shellLaunchConfig;
    const isShellCommand = task.command.runtime === RuntimeType.Shell;
    const needsFolderQualification = this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
    const terminalName = this._createTerminalName(task);
    const type = TaskTerminalType;
    const originalCommand = task.command.name;
    let cwd;
    if (options.cwd) {
      cwd = options.cwd;
      if (!path.isAbsolute(cwd)) {
        if (workspaceFolder && workspaceFolder.uri.scheme === Schemas.file) {
          cwd = path.join(workspaceFolder.uri.fsPath, cwd);
        }
      }
      cwd = isUNC(cwd) ? cwd : resources.toLocalResource(URI.from({ scheme: Schemas.file, path: cwd }), this._environmentService.remoteAuthority, this._pathService.defaultUriScheme);
    }
    if (isShellCommand) {
      let os;
      switch (platform) {
        case Platform.Platform.Windows:
          os = Platform.OperatingSystem.Windows;
          break;
        case Platform.Platform.Mac:
          os = Platform.OperatingSystem.Macintosh;
          break;
        case Platform.Platform.Linux:
        default:
          os = Platform.OperatingSystem.Linux;
          break;
      }
      const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({
        allowAutomationShell: true,
        os,
        remoteAuthority: this._environmentService.remoteAuthority
      });
      let icon;
      if (task.configurationProperties.icon?.id) {
        icon = ThemeIcon.fromId(task.configurationProperties.icon.id);
      } else {
        const taskGroupKind = task.configurationProperties.group ? GroupKind.to(task.configurationProperties.group) : void 0;
        const kindId = typeof taskGroupKind === "string" ? taskGroupKind : taskGroupKind?.kind;
        icon = kindId === "test" ? ThemeIcon.fromId(Codicon.beaker.id) : defaultProfile.icon;
      }
      shellLaunchConfig = {
        name: terminalName,
        type,
        executable: defaultProfile.path,
        args: defaultProfile.args,
        env: { ...defaultProfile.env },
        icon,
        color: task.configurationProperties.icon?.color || void 0,
        waitOnExit
      };
      let shellSpecified = false;
      const shellOptions = task.command.options && task.command.options.shell;
      if (shellOptions) {
        if (shellOptions.executable) {
          if (shellOptions.executable !== shellLaunchConfig.executable) {
            shellLaunchConfig.args = void 0;
          }
          shellLaunchConfig.executable = await this._resolveVariable(variableResolver, shellOptions.executable);
          shellSpecified = true;
        }
        if (shellOptions.args) {
          shellLaunchConfig.args = await this._resolveVariables(variableResolver, shellOptions.args.slice());
        }
      }
      if (shellLaunchConfig.args === void 0) {
        shellLaunchConfig.args = [];
      }
      const shellArgs = Array.isArray(shellLaunchConfig.args) ? shellLaunchConfig.args.slice(0) : [shellLaunchConfig.args];
      const toAdd = [];
      const basename = path.posix.basename((await this._pathService.fileURI(shellLaunchConfig.executable)).path).toLowerCase();
      const commandLine = this._buildShellCommandLine(platform, basename, shellOptions, command, originalCommand, args);
      let windowsShellArgs = false;
      if (platform === Platform.Platform.Windows) {
        windowsShellArgs = true;
        const userHome = await this._pathService.userHome();
        if (basename === "cmd.exe" && (options.cwd && isUNC(options.cwd) || !options.cwd && isUNC(userHome.fsPath))) {
          return void 0;
        }
        if (basename === "powershell.exe" || basename === "pwsh.exe") {
          if (!shellSpecified) {
            toAdd.push("-Command");
          }
        } else if (basename === "bash.exe" || basename === "zsh.exe") {
          windowsShellArgs = false;
          if (!shellSpecified) {
            toAdd.push("-c");
          }
        } else if (basename === "wsl.exe") {
          if (!shellSpecified) {
            toAdd.push("-e");
          }
        } else if (basename === "nu.exe") {
          if (!shellSpecified) {
            toAdd.push("-c");
          }
        } else {
          if (!shellSpecified) {
            toAdd.push("/d", "/c");
          }
        }
      } else {
        if (!shellSpecified) {
          if (platform === Platform.Platform.Mac) {
          }
          toAdd.push("-c");
        }
      }
      const combinedShellArgs = this._addAllArgument(toAdd, shellArgs);
      combinedShellArgs.push(commandLine);
      shellLaunchConfig.shellIntegrationNonce = generateUuid();
      const commandLineInfo = {
        commandLine,
        nonce: shellLaunchConfig.shellIntegrationNonce
      };
      shellLaunchConfig.args = windowsShellArgs ? combinedShellArgs.join(" ") : combinedShellArgs;
      if (task.command.presentation && task.command.presentation.echo) {
        if (needsFolderQualification && workspaceFolder) {
          const folder = cwd && typeof cwd === "object" && Object.hasOwn(cwd, "path") ? path.basename(cwd.path) : workspaceFolder.name;
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executingInFolder",
            comment: ["The workspace folder the task is running in", "The task command line or label"]
          }, "Executing task in folder {0}: {1}", folder, commandLine), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(commandLineInfo);
        } else {
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executing.shellIntegration",
            comment: ["The task command line or label"]
          }, "Executing task: {0}", commandLine), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(commandLineInfo);
        }
      } else {
        shellLaunchConfig.initialText = {
          text: this.taskShellIntegrationStartSequence(cwd) + this.getTaskShellIntegrationOutputSequence(commandLineInfo),
          trailingNewLine: false
        };
      }
    } else {
      const commandExecutable = task.command.runtime !== RuntimeType.CustomExecution ? CommandString.value(command) : void 0;
      const executable = !isShellCommand ? await this._resolveVariable(variableResolver, await this._resolveVariable(variableResolver, "${" + TerminalTaskSystem.ProcessVarName + "}")) : commandExecutable;
      shellLaunchConfig = {
        name: terminalName,
        type,
        icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : void 0,
        color: task.configurationProperties.icon?.color || void 0,
        executable,
        args: args.map((a) => Types.isString(a) ? a : a.value),
        waitOnExit
      };
      if (task.command.presentation && task.command.presentation.echo) {
        const getArgsToEcho = (args2) => {
          if (!args2 || args2.length === 0) {
            return "";
          }
          if (Types.isString(args2)) {
            return args2;
          }
          return args2.join(" ");
        };
        if (needsFolderQualification && workspaceFolder) {
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executingInFolder",
            comment: ["The workspace folder the task is running in", "The task command line or label"]
          }, "Executing task in folder {0}: {1}", workspaceFolder.name, `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(void 0);
        } else {
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executing.shell-integration",
            comment: ["The task command line or label"]
          }, "Executing task: {0}", `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(void 0);
        }
      } else {
        shellLaunchConfig.initialText = {
          text: this.taskShellIntegrationStartSequence(cwd) + this.getTaskShellIntegrationOutputSequence(void 0),
          trailingNewLine: false
        };
      }
    }
    if (cwd) {
      shellLaunchConfig.cwd = cwd;
    }
    if (options.env) {
      if (shellLaunchConfig.env) {
        shellLaunchConfig.env = { ...shellLaunchConfig.env, ...options.env };
      } else {
        shellLaunchConfig.env = options.env;
      }
    }
    shellLaunchConfig.isFeatureTerminal = true;
    shellLaunchConfig.useShellEnvironment = true;
    shellLaunchConfig.tabActions = this._terminalTabActions;
    return shellLaunchConfig;
  }
  _addAllArgument(shellCommandArgs, configuredShellArgs) {
    const combinedShellArgs = Objects.deepClone(configuredShellArgs);
    shellCommandArgs.forEach((element) => {
      const shouldAddShellCommandArg = configuredShellArgs.every((arg, index) => {
        if (arg.toLowerCase() === element && configuredShellArgs.length > index + 1) {
          return !configuredShellArgs.slice(index + 1).every((testArg) => testArg.startsWith("-"));
        } else {
          return arg.toLowerCase() !== element;
        }
      });
      if (shouldAddShellCommandArg) {
        combinedShellArgs.push(element);
      }
    });
    return combinedShellArgs;
  }
  async _reconnectToTerminal(task) {
    const reconnectedInstances = this._terminalService.instances.filter((e) => e.reconnectionProperties?.ownerId === TaskTerminalType);
    return reconnectedInstances.find((e) => getReconnectionData(e)?.lastTask === task.getCommonTaskId());
  }
  async _doCreateTerminal(task, group, launchConfigs) {
    const reconnectedTerminal = await this._reconnectToTerminal(task);
    const registerOnDisposed = (terminal) => {
      const listener = terminal.onDisposed(() => {
        this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
        listener.dispose();
      });
    };
    if (reconnectedTerminal) {
      if ((CustomTask.is(task) || ContributedTask.is(task)) && task.command.presentation) {
        reconnectedTerminal.waitOnExit = getWaitOnExitValue(task.command.presentation, task.configurationProperties);
      }
      registerOnDisposed(reconnectedTerminal);
      this._logService.trace("reconnected to task and terminal", task._id);
      return reconnectedTerminal;
    }
    if (group) {
      for (const terminal of Object.values(this._terminals)) {
        if (terminal.group === group) {
          this._logService.trace(`Found terminal to split for group ${group}`);
          const originalInstance = terminal.terminal;
          const result = await this._terminalService.createTerminal({ location: { parentTerminal: originalInstance }, config: launchConfigs });
          registerOnDisposed(result);
          if (result) {
            return result;
          }
        }
      }
      this._logService.trace(`No terminal found to split for group ${group}`);
    }
    const createdTerminal = await this._terminalService.createTerminal({ config: launchConfigs });
    registerOnDisposed(createdTerminal);
    return createdTerminal;
  }
  _reconnectToTerminals() {
    if (this._hasReconnected) {
      this._logService.trace(`Already reconnected to terminals, so returning`);
      return;
    }
    const reconnectedInstances = this._terminalService.instances.filter((e) => e.reconnectionProperties?.ownerId === TaskTerminalType);
    this._logService.trace(`Attempting reconnection of ${reconnectedInstances.length} terminals`);
    if (!reconnectedInstances.length) {
      this._logService.trace(`No terminals to reconnect to so returning`);
    } else {
      for (const terminal of reconnectedInstances) {
        const data = getReconnectionData(terminal);
        if (data) {
          const terminalData = { lastTask: data.lastTask, group: data.group, terminal, shellIntegrationNonce: data.shellIntegrationNonce };
          this._terminals[terminal.instanceId] = terminalData;
          const listener = terminal.onDisposed(() => {
            this._deleteTaskAndTerminal(terminal, terminalData);
            listener.dispose();
          });
          this._logService.trace("Reconnecting to task terminal", terminalData.lastTask, terminal.instanceId);
        }
      }
    }
    this._hasReconnected = true;
  }
  _deleteTaskAndTerminal(terminal, terminalData) {
    delete this._terminals[terminal.instanceId];
    delete this._sameTaskTerminals[terminalData.lastTask];
    this._idleTaskTerminals.delete(terminalData.lastTask);
    const mapKey = terminalData.lastTask;
    const cur = this._activeTasks[mapKey];
    if (cur && cur.terminal === terminal) {
      this._removeFromActiveTasks(mapKey);
    }
    if (this._busyTasks[mapKey]) {
      delete this._busyTasks[mapKey];
    }
  }
  async _createTerminal(task, resolver, workspaceFolder) {
    const platform = resolver.taskSystemInfo ? resolver.taskSystemInfo.platform : Platform.platform;
    const options = await this._resolveOptions(resolver, task.command.options);
    const presentationOptions = task.command.presentation;
    if (!presentationOptions) {
      throw new Error("Task presentation options should not be undefined here.");
    }
    const waitOnExit = getWaitOnExitValue(presentationOptions, task.configurationProperties);
    let command;
    let args;
    let launchConfigs;
    if (task.command.runtime === RuntimeType.CustomExecution) {
      this._currentTask.shellLaunchConfig = launchConfigs = {
        customPtyImplementation: (id, cols, rows) => new TerminalProcessExtHostProxy(id, cols, rows, this._terminalService),
        waitOnExit,
        name: this._createTerminalName(task),
        initialText: task.command.presentation && task.command.presentation.echo ? formatMessageForTerminal(nls.localize({
          key: "task.executing",
          comment: ["The task command line or label"]
        }, "Executing task: {0}", task._label), { excludeLeadingNewLine: true }) : void 0,
        isFeatureTerminal: true,
        icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : void 0,
        color: task.configurationProperties.icon?.color || void 0
      };
    } else {
      const resolvedResult = await this._resolveCommandAndArgs(resolver, task.command);
      command = resolvedResult.command;
      args = resolvedResult.args;
      this._currentTask.shellLaunchConfig = launchConfigs = await this._createShellLaunchConfig(task, workspaceFolder, resolver, platform, options, command, args, waitOnExit, presentationOptions);
      if (launchConfigs === void 0) {
        return [void 0, new TaskError(Severity.Error, nls.localize("TerminalTaskSystem", "Can't execute a shell command on an UNC drive using cmd.exe."), TaskErrors.UnknownError)];
      }
    }
    const prefersSameTerminal = presentationOptions.panel === PanelKind.Dedicated;
    const allowsSharedTerminal = presentationOptions.panel === PanelKind.Shared;
    const group = presentationOptions.group;
    const taskKey = task.getMapKey();
    let terminalToReuse;
    if (prefersSameTerminal) {
      const terminalId = this._sameTaskTerminals[taskKey];
      if (terminalId) {
        terminalToReuse = this._terminals[terminalId];
        delete this._sameTaskTerminals[taskKey];
      }
    } else if (allowsSharedTerminal) {
      let terminalId = this._idleTaskTerminals.remove(taskKey);
      if (!terminalId) {
        for (const taskId of this._idleTaskTerminals.keys()) {
          const idleTerminalId = this._idleTaskTerminals.get(taskId);
          if (idleTerminalId && this._terminals[idleTerminalId] && this._terminals[idleTerminalId].group === group) {
            terminalId = this._idleTaskTerminals.remove(taskId);
            break;
          }
        }
      }
      if (terminalId) {
        terminalToReuse = this._terminals[terminalId];
      }
    }
    if (terminalToReuse) {
      if (!launchConfigs) {
        throw new Error("Task shell launch configuration should not be undefined here.");
      }
      terminalToReuse.terminal.scrollToBottom();
      if (task.configurationProperties.isBackground) {
        launchConfigs.reconnectionProperties = { ownerId: TaskTerminalType, data: { lastTask: task.getCommonTaskId(), group, label: task._label, id: task._id } };
      }
      if (terminalToReuse.shellIntegrationNonce) {
        if (Types.isString(launchConfigs.initialText) && launchConfigs.shellIntegrationNonce) {
          launchConfigs.initialText = launchConfigs.initialText.replace(launchConfigs.shellIntegrationNonce, terminalToReuse.shellIntegrationNonce);
        }
      }
      await terminalToReuse.terminal.reuseTerminal(launchConfigs);
      if (task.command.presentation && task.command.presentation.clear) {
        terminalToReuse.terminal.clearBuffer();
      }
      this._terminals[terminalToReuse.terminal.instanceId.toString()].lastTask = taskKey;
      return [terminalToReuse.terminal, void 0];
    }
    this._terminalCreationQueue = this._terminalCreationQueue.then(() => this._doCreateTerminal(task, group, launchConfigs));
    const terminal = await this._terminalCreationQueue;
    if (task.configurationProperties.isBackground) {
      terminal.shellLaunchConfig.reconnectionProperties = { ownerId: TaskTerminalType, data: { lastTask: task.getCommonTaskId(), group, label: task._label, id: task._id } };
    }
    const terminalKey = terminal.instanceId.toString();
    const terminalData = { terminal, lastTask: taskKey, group, shellIntegrationNonce: terminal.shellLaunchConfig.shellIntegrationNonce };
    const onDisposedListener = terminal.onDisposed(() => {
      this._deleteTaskAndTerminal(terminal, terminalData);
      onDisposedListener.dispose();
    });
    this._terminals[terminalKey] = terminalData;
    terminal.shellLaunchConfig.tabActions = this._terminalTabActions;
    return [terminal, void 0];
  }
  _buildShellCommandLine(platform, shellExecutable, shellOptions, command, originalCommand, args) {
    const basename = path.parse(shellExecutable).name.toLowerCase();
    const shellQuoteOptions = this._getQuotingOptions(basename, shellOptions, platform);
    function needsQuotes(value2) {
      if (value2.length >= 2) {
        const first = value2[0] === shellQuoteOptions.strong ? shellQuoteOptions.strong : value2[0] === shellQuoteOptions.weak ? shellQuoteOptions.weak : void 0;
        if (first === value2[value2.length - 1]) {
          return false;
        }
      }
      let quote2;
      for (let i = 0; i < value2.length; i++) {
        const ch = value2[i];
        if (ch === quote2) {
          quote2 = void 0;
        } else if (quote2 !== void 0) {
          continue;
        } else if (ch === shellQuoteOptions.escape) {
          i++;
        } else if (ch === shellQuoteOptions.strong || ch === shellQuoteOptions.weak) {
          quote2 = ch;
        } else if (ch === " ") {
          return true;
        }
      }
      return false;
    }
    function quote(value2, kind) {
      if (kind === ShellQuoting.Strong && shellQuoteOptions.strong) {
        return [shellQuoteOptions.strong + value2 + shellQuoteOptions.strong, true];
      } else if (kind === ShellQuoting.Weak && shellQuoteOptions.weak) {
        return [shellQuoteOptions.weak + value2 + shellQuoteOptions.weak, true];
      } else if (kind === ShellQuoting.Escape && shellQuoteOptions.escape) {
        if (Types.isString(shellQuoteOptions.escape)) {
          return [value2.replace(/ /g, shellQuoteOptions.escape + " "), true];
        } else {
          const buffer = [];
          for (const ch of shellQuoteOptions.escape.charsToEscape) {
            buffer.push(`\\${ch}`);
          }
          const regexp = new RegExp("[" + buffer.join(",") + "]", "g");
          const escapeChar = shellQuoteOptions.escape.escapeChar;
          return [value2.replace(regexp, (match) => escapeChar + match), true];
        }
      }
      return [value2, false];
    }
    function quoteIfNecessary(value2) {
      if (Types.isString(value2)) {
        if (needsQuotes(value2)) {
          return quote(value2, ShellQuoting.Strong);
        } else {
          return [value2, false];
        }
      } else {
        return quote(value2.value, value2.quoting);
      }
    }
    if ((!args || args.length === 0) && Types.isString(command) && (command === originalCommand || needsQuotes(originalCommand))) {
      return command;
    }
    const result = [];
    let commandQuoted = false;
    let argQuoted = false;
    let value;
    let quoted;
    [value, quoted] = quoteIfNecessary(command);
    result.push(value);
    commandQuoted = quoted;
    for (const arg of args) {
      [value, quoted] = quoteIfNecessary(arg);
      result.push(value);
      argQuoted = argQuoted || quoted;
    }
    let commandLine = result.join(" ");
    if (platform === Platform.Platform.Windows) {
      if (basename === "cmd" && commandQuoted && argQuoted) {
        commandLine = '"' + commandLine + '"';
      } else if ((basename === "powershell" || basename === "pwsh") && commandQuoted) {
        commandLine = "& " + commandLine;
      }
    }
    return commandLine;
  }
  _getQuotingOptions(shellBasename, shellOptions, platform) {
    if (shellOptions && shellOptions.quoting) {
      return shellOptions.quoting;
    }
    return TerminalTaskSystem._shellQuotes[shellBasename] || TerminalTaskSystem._osShellQuotes[Platform.PlatformToString(platform)];
  }
  _collectTaskVariables(variables, task) {
    if (task.command && task.command.name) {
      this._collectCommandVariables(variables, task.command, task);
    }
    this._collectMatcherVariables(variables, task.configurationProperties.problemMatchers);
    if (task.command.runtime === RuntimeType.CustomExecution && (CustomTask.is(task) || ContributedTask.is(task))) {
      let definition;
      if (CustomTask.is(task)) {
        definition = task._source.config.element;
      } else {
        definition = Objects.deepClone(task.defines);
        delete definition._key;
        delete definition.type;
      }
      this._collectDefinitionVariables(variables, definition);
    }
  }
  _collectDefinitionVariables(variables, definition) {
    if (Types.isString(definition)) {
      this._collectVariables(variables, definition);
    } else if (Array.isArray(definition)) {
      definition.forEach((element) => this._collectDefinitionVariables(variables, element));
    } else if (Types.isObject(definition)) {
      for (const key of Object.keys(definition)) {
        this._collectDefinitionVariables(variables, definition[key]);
      }
    }
  }
  _collectCommandVariables(variables, command, task) {
    if (command.runtime === RuntimeType.CustomExecution) {
      return;
    }
    if (command.name === void 0) {
      throw new Error("Command name should never be undefined here.");
    }
    this._collectVariables(variables, command.name);
    command.args?.forEach((arg) => this._collectVariables(variables, arg));
    const scope = task._source.scope;
    if (scope !== TaskScope.Global) {
      variables.add("${workspaceFolder}");
    }
    if (command.options) {
      const options = command.options;
      if (options.cwd) {
        this._collectVariables(variables, options.cwd);
      }
      const optionsEnv = options.env;
      if (optionsEnv) {
        Object.keys(optionsEnv).forEach((key) => {
          const value = optionsEnv[key];
          if (Types.isString(value)) {
            this._collectVariables(variables, value);
          }
        });
      }
      if (options.shell) {
        if (options.shell.executable) {
          this._collectVariables(variables, options.shell.executable);
        }
        options.shell.args?.forEach((arg) => this._collectVariables(variables, arg));
      }
    }
  }
  _collectMatcherVariables(variables, values) {
    if (values === void 0 || values === null || values.length === 0) {
      return;
    }
    values.forEach((value) => {
      let matcher;
      if (Types.isString(value)) {
        if (value[0] === "$") {
          matcher = ProblemMatcherRegistry.get(value.substring(1));
        } else {
          matcher = ProblemMatcherRegistry.get(value);
        }
      } else {
        matcher = value;
      }
      if (matcher && matcher.filePrefix) {
        if (Types.isString(matcher.filePrefix)) {
          this._collectVariables(variables, matcher.filePrefix);
        } else {
          for (const fp of [...asArray(matcher.filePrefix.include || []), ...asArray(matcher.filePrefix.exclude || [])]) {
            this._collectVariables(variables, fp);
          }
        }
      }
    });
  }
  _collectVariables(variables, value) {
    const string = Types.isString(value) ? value : value.value;
    const r = /\$\{(.*?)\}/g;
    let matches;
    do {
      matches = r.exec(string);
      if (matches) {
        variables.add(matches[0]);
      }
    } while (matches);
  }
  async _resolveCommandAndArgs(resolver, commandConfig) {
    let args = commandConfig.args ? commandConfig.args.slice() : [];
    args = await this._resolveVariables(resolver, args);
    const command = await this._resolveVariable(resolver, commandConfig.name);
    return { command, args };
  }
  async _resolveVariables(resolver, value) {
    return Promise.all(value.map((s) => this._resolveVariable(resolver, s)));
  }
  async _resolveMatchers(resolver, values) {
    if (values === void 0 || values === null || values.length === 0) {
      return [];
    }
    const result = [];
    for (const value of values) {
      let matcher;
      if (Types.isString(value)) {
        if (value[0] === "$") {
          matcher = ProblemMatcherRegistry.get(value.substring(1));
        } else {
          matcher = ProblemMatcherRegistry.get(value);
        }
      } else {
        matcher = value;
      }
      if (!matcher) {
        this._appendOutput(nls.localize("unknownProblemMatcher", "Problem matcher {0} can't be resolved. The matcher will be ignored"));
        continue;
      }
      const taskSystemInfo = resolver.taskSystemInfo;
      const hasFilePrefix = matcher.filePrefix !== void 0;
      const hasUriProvider = taskSystemInfo !== void 0 && taskSystemInfo.uriProvider !== void 0;
      if (!hasFilePrefix && !hasUriProvider) {
        result.push(matcher);
      } else {
        const copy = Objects.deepClone(matcher);
        if (hasUriProvider && taskSystemInfo !== void 0) {
          copy.uriProvider = taskSystemInfo.uriProvider;
        }
        if (hasFilePrefix) {
          const filePrefix = copy.filePrefix;
          if (Types.isString(filePrefix)) {
            copy.filePrefix = await this._resolveVariable(resolver, filePrefix);
          } else if (filePrefix !== void 0) {
            if (filePrefix.include) {
              filePrefix.include = Array.isArray(filePrefix.include) ? await Promise.all(filePrefix.include.map((x) => this._resolveVariable(resolver, x))) : await this._resolveVariable(resolver, filePrefix.include);
            }
            if (filePrefix.exclude) {
              filePrefix.exclude = Array.isArray(filePrefix.exclude) ? await Promise.all(filePrefix.exclude.map((x) => this._resolveVariable(resolver, x))) : await this._resolveVariable(resolver, filePrefix.exclude);
            }
          }
        }
        result.push(copy);
      }
    }
    return result;
  }
  async _resolveVariable(resolver, value) {
    if (Types.isString(value)) {
      return resolver.resolve(value);
    } else if (value !== void 0) {
      return {
        value: await resolver.resolve(value.value),
        quoting: value.quoting
      };
    } else {
      throw new Error("Should never try to resolve undefined.");
    }
  }
  async _resolveOptions(resolver, options) {
    if (options === void 0 || options === null) {
      let cwd;
      try {
        cwd = await this._resolveVariable(resolver, "${workspaceFolder}");
      } catch (e) {
      }
      return { cwd };
    }
    const result = Types.isString(options.cwd) ? { cwd: await this._resolveVariable(resolver, options.cwd) } : { cwd: await this._resolveVariable(resolver, "${workspaceFolder}") };
    if (options.env) {
      result.env = /* @__PURE__ */ Object.create(null);
      for (const key of Object.keys(options.env)) {
        const value = options.env[key];
        if (Types.isString(value)) {
          result.env[key] = await this._resolveVariable(resolver, value);
        } else {
          result.env[key] = String(value);
        }
      }
    }
    return result;
  }
  static {
    this.WellKnownCommands = {
      "ant": true,
      "cmake": true,
      "eslint": true,
      "gradle": true,
      "grunt": true,
      "gulp": true,
      "jake": true,
      "jenkins": true,
      "jshint": true,
      "make": true,
      "maven": true,
      "msbuild": true,
      "msc": true,
      "nmake": true,
      "npm": true,
      "rake": true,
      "tsc": true,
      "xbuild": true
    };
  }
  getSanitizedCommand(cmd) {
    let result = cmd.toLowerCase();
    const index = result.lastIndexOf(path.sep);
    if (index !== -1) {
      result = result.substring(index + 1);
    }
    if (TerminalTaskSystem.WellKnownCommands[result]) {
      return result;
    }
    return "other";
  }
  async getTaskForTerminal(instanceId) {
    for (const key of Object.keys(this._activeTasks)) {
      const activeTask = this._activeTasks[key];
      if (activeTask.terminal?.instanceId === instanceId) {
        return activeTask.task;
      }
    }
    const terminalData = this._terminals[instanceId.toString()];
    if (terminalData?.lastTask) {
      return await this._taskLookup(terminalData.lastTask);
    }
    return void 0;
  }
  _appendOutput(output) {
    const outputChannel = this._outputService.getChannel(this._outputChannelId);
    outputChannel?.append(output);
  }
}
function getWaitOnExitValue(presentationOptions, configurationProperties) {
  if (presentationOptions.close === void 0 || presentationOptions.close === false) {
    if (presentationOptions.reveal !== RevealKind.Never || !configurationProperties.isBackground || presentationOptions.close === false) {
      if (presentationOptions.panel === PanelKind.New) {
        return taskShellIntegrationWaitOnExitSequence(nls.localize("closeTerminal", "Press any key to close the terminal."));
      } else if (presentationOptions.showReuseMessage) {
        return taskShellIntegrationWaitOnExitSequence(nls.localize("reuseTerminal", "Terminal will be reused by tasks, press any key to close it."));
      } else {
        return true;
      }
    }
  }
  return !presentationOptions.close;
}
function taskShellIntegrationWaitOnExitSequence(message) {
  return (exitCode) => {
    return `${VSCodeSequence(VSCodeOscPt.CommandFinished, exitCode.toString())}${message}`;
  };
}
function getReconnectionData(terminal) {
  return terminal.shellLaunchConfig.attachPersistentProcess?.reconnectionProperties?.data;
}
export {
  TerminalTaskSystem
};
