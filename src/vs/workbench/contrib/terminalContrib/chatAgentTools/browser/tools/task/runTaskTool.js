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
import { timeout } from "../../../../../../../base/common/async.js";
import { localize } from "../../../../../../../nls.js";
import { ITelemetryService } from "../../../../../../../platform/telemetry/common/telemetry.js";
import { ToolDataSource } from "../../../../../chat/common/tools/languageModelToolsService.js";
import { ITaskService } from "../../../../../tasks/common/taskService.js";
import { TaskRunSource } from "../../../../../tasks/common/tasks.js";
import { ITerminalService } from "../../../../../terminal/browser/terminal.js";
import { collectTerminalResults, getTaskDefinition, getTaskForTool, resolveDependencyTasks, tasksMatch } from "../../taskHelpers.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { toolResultDetailsFromResponse, toolResultMessageFromResponse } from "./taskHelpers.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { DisposableStore } from "../../../../../../../base/common/lifecycle.js";
import { TerminalToolId } from "../toolIds.js";
let RunTaskTool = class {
  constructor(_tasksService, _telemetryService, _terminalService, _configurationService, _instantiationService) {
    this._tasksService = _tasksService;
    this._telemetryService = _telemetryService;
    this._terminalService = _terminalService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const args = invocation.parameters;
    if (!invocation.context) {
      return { content: [{ kind: "text", value: `No invocation context` }], toolResultMessage: `No invocation context` };
    }
    const taskDefinition = getTaskDefinition(args.id);
    const task = await getTaskForTool(args.id, taskDefinition, args.workspaceFolder, this._configurationService, this._tasksService, true);
    if (!task) {
      return { content: [{ kind: "text", value: `Task not found: ${args.id}` }], toolResultMessage: new MarkdownString(localize("chat.taskNotFound", "Task not found: `{0}`", args.id)) };
    }
    const taskLabel = task._label;
    const activeTasks = await this._tasksService.getActiveTasks();
    if (activeTasks.includes(task)) {
      return { content: [{ kind: "text", value: `The task ${taskLabel} is already running.` }], toolResultMessage: new MarkdownString(localize("chat.taskAlreadyRunning", "The task `{0}` is already running.", taskLabel)) };
    }
    const dependencyTasks = await resolveDependencyTasks(task, args.workspaceFolder, this._configurationService, this._tasksService);
    const startMarkersByTerminalInstanceId = /* @__PURE__ */ new Map();
    const startMarkersDisposableStore = new DisposableStore();
    for (const terminal of this._terminalService.instances) {
      const marker = terminal.registerMarker();
      startMarkersByTerminalInstanceId.set(terminal.instanceId, marker);
      if (marker) {
        startMarkersDisposableStore.add(marker);
      }
    }
    try {
      const raceResult = await Promise.race([this._tasksService.run(task, void 0, TaskRunSource.ChatAgent), timeout(3e3)]);
      const result = raceResult && typeof raceResult === "object" ? raceResult : void 0;
      const resources = this._tasksService.getTerminalsForTasks(dependencyTasks ?? task);
      if (!resources || resources.length === 0) {
        return { content: [{ kind: "text", value: `Task started but no terminal was found for: ${taskLabel}` }], toolResultMessage: new MarkdownString(localize("chat.noTerminal", "Task started but no terminal was found for: `{0}`", taskLabel)) };
      }
      const terminals = this._terminalService.instances.filter((t) => resources.some((r) => r.path === t.resource.path && r.scheme === t.resource.scheme));
      if (terminals.length === 0) {
        return { content: [{ kind: "text", value: `Task started but no terminal was found for: ${taskLabel}` }], toolResultMessage: new MarkdownString(localize("chat.noTerminal", "Task started but no terminal was found for: `{0}`", taskLabel)) };
      }
      const store = new DisposableStore();
      let terminalResults = [];
      try {
        terminalResults = await collectTerminalResults(
          terminals,
          task,
          this._instantiationService,
          invocation.context,
          _progress,
          token,
          store,
          (terminalTask) => this._isTaskActive(terminalTask),
          dependencyTasks,
          this._tasksService,
          startMarkersByTerminalInstanceId
        );
      } finally {
        store.dispose();
      }
      for (const r of terminalResults) {
        this._telemetryService.publicLog2?.("copilotChat.runTaskTool.run", {
          taskId: args.id,
          bufferLength: r.output.length ?? 0,
          pollDurationMs: r.pollDurationMs ?? 0,
          inputToolManualAcceptCount: r.inputToolManualAcceptCount ?? 0,
          inputToolManualRejectCount: r.inputToolManualRejectCount ?? 0,
          inputToolManualChars: r.inputToolManualChars ?? 0,
          inputToolManualShownCount: r.inputToolManualShownCount ?? 0,
          inputToolFreeFormInputShownCount: r.inputToolFreeFormInputShownCount ?? 0,
          inputToolFreeFormInputCount: r.inputToolFreeFormInputCount ?? 0
        });
      }
      const details = terminalResults.map((r) => `Terminal: ${r.name}
Output:
${r.output}`);
      const uniqueDetails = Array.from(new Set(details)).join("\n\n");
      const toolResultDetails = toolResultDetailsFromResponse(terminalResults);
      const toolResultMessage = toolResultMessageFromResponse(result, taskLabel, toolResultDetails, terminalResults, void 0, task.configurationProperties.isBackground);
      return {
        content: [{ kind: "text", value: uniqueDetails }],
        toolResultMessage,
        toolResultDetails
      };
    } finally {
      startMarkersDisposableStore.dispose();
    }
  }
  async _isTaskActive(task) {
    const busyTasks = await this._tasksService.getBusyTasks();
    return busyTasks?.some((t) => tasksMatch(t, task)) ?? false;
  }
  async prepareToolInvocation(context, token) {
    const args = context.parameters;
    const taskDefinition = getTaskDefinition(args.id);
    const task = await getTaskForTool(args.id, taskDefinition, args.workspaceFolder, this._configurationService, this._tasksService, true);
    if (!task) {
      return { invocationMessage: new MarkdownString(localize("chat.taskNotFound", "Task not found: `{0}`", args.id)) };
    }
    const taskLabel = task._label;
    const activeTasks = await this._tasksService.getActiveTasks();
    if (task && activeTasks.includes(task)) {
      return { invocationMessage: new MarkdownString(localize("chat.taskAlreadyActive", "The task is already running.")) };
    }
    if (await this._isTaskActive(task)) {
      return {
        invocationMessage: new MarkdownString(localize("chat.taskIsAlreadyRunning", "`{0}` is already running.", taskLabel)),
        pastTenseMessage: new MarkdownString(localize("chat.taskWasAlreadyRunning", "`{0}` was already running.", taskLabel)),
        confirmationMessages: void 0
      };
    }
    return {
      invocationMessage: new MarkdownString(localize("chat.runningTask", "Running `{0}`", taskLabel)),
      pastTenseMessage: new MarkdownString(task?.configurationProperties.isBackground ? localize("chat.startedTask", "Started `{0}`", taskLabel) : localize("chat.ranTask", "Ran `{0}`", taskLabel)),
      confirmationMessages: task ? { title: localize("chat.allowTaskRunTitle", "Allow task run?"), message: localize("chat.allowTaskRunMsg", "Allow to run the task `{0}`?", taskLabel) } : void 0
    };
  }
};
RunTaskTool = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ITerminalService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService)
], RunTaskTool);
const RunTaskToolData = {
  id: TerminalToolId.RunTask,
  toolReferenceName: "runTask",
  legacyToolReferenceFullNames: ["runTasks/runTask"],
  displayName: localize("runInTerminalTool.displayName", "Run Task"),
  modelDescription: `Runs a VS Code task.

- If you see that an appropriate task exists for building or running code, prefer to use this tool to run the task instead of using the ${TerminalToolId.RunInTerminal} tool.
- Make sure that any appropriate build or watch task is running before trying to run tests or execute code.
- If the user asks to run a task, use this tool to do so.`,
  userDescription: localize("runInTerminalTool.userDescription", "Run tasks in the workspace"),
  icon: Codicon.tools,
  source: ToolDataSource.Internal,
  inputSchema: {
    "type": "object",
    "properties": {
      "workspaceFolder": {
        "type": "string",
        "description": "The workspace folder path containing the task"
      },
      "id": {
        "type": "string",
        "description": "The task ID to run."
      }
    },
    "required": [
      "workspaceFolder",
      "id"
    ]
  }
};
export {
  RunTaskTool,
  RunTaskToolData
};
