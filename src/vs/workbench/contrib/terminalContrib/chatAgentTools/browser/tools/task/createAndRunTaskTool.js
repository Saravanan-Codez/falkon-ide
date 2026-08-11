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
import { collectTerminalResults, resolveDependencyTasks, tasksMatch } from "../../taskHelpers.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { VSBuffer } from "../../../../../../../base/common/buffer.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { toolResultDetailsFromResponse, toolResultMessageFromResponse } from "./taskHelpers.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { DisposableStore } from "../../../../../../../base/common/lifecycle.js";
import { TerminalToolId } from "../toolIds.js";
let CreateAndRunTaskTool = class {
  constructor(_tasksService, _telemetryService, _terminalService, _fileService, _configurationService, _instantiationService) {
    this._tasksService = _tasksService;
    this._telemetryService = _telemetryService;
    this._terminalService = _terminalService;
    this._fileService = _fileService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const args = invocation.parameters;
    if (!invocation.context) {
      return { content: [{ kind: "text", value: `No invocation context` }], toolResultMessage: `No invocation context` };
    }
    const tasksJsonUri = URI.file(args.workspaceFolder).with({ path: `${args.workspaceFolder}/.vscode/tasks.json` });
    const exists = await this._fileService.exists(tasksJsonUri);
    const newTask = {
      label: args.task.label,
      type: args.task.type,
      command: args.task.command,
      args: args.task.args,
      isBackground: args.task.isBackground,
      problemMatcher: args.task.problemMatcher,
      group: args.task.group
    };
    const tasksJsonContent = JSON.stringify({
      version: "2.0.0",
      tasks: [newTask]
    }, null, "	");
    if (!exists) {
      await this._fileService.createFile(tasksJsonUri, VSBuffer.fromString(tasksJsonContent), { overwrite: true });
      _progress.report({ message: "Created tasks.json file" });
    } else {
      const content = await this._fileService.readFile(tasksJsonUri);
      const tasksJson = JSON.parse(content.value.toString());
      tasksJson.tasks.push(newTask);
      await this._fileService.writeFile(tasksJsonUri, VSBuffer.fromString(JSON.stringify(tasksJson, null, "	")));
      _progress.report({ message: "Updated tasks.json file" });
    }
    _progress.report({ message: new MarkdownString(localize("copilotChat.fetchingTask", "Resolving the task")) });
    let task;
    const start = Date.now();
    while (Date.now() - start < 5e3 && !token.isCancellationRequested) {
      task = (await this._tasksService.tasks())?.find((t) => t._label === args.task.label);
      if (task) {
        break;
      }
      await timeout(100);
    }
    if (!task) {
      return { content: [{ kind: "text", value: `Task not found: ${args.task.label}` }], toolResultMessage: new MarkdownString(localize("copilotChat.taskNotFound", "Task not found: `{0}`", args.task.label)) };
    }
    const preRunMarkersStore = new DisposableStore();
    let result;
    let terminalResults = [];
    try {
      const dependencyTasks = await resolveDependencyTasks(task, args.workspaceFolder, this._configurationService, this._tasksService);
      const startMarkersByTerminalInstanceId = /* @__PURE__ */ new Map();
      for (const terminal of this._terminalService.instances) {
        const marker = terminal.registerMarker();
        startMarkersByTerminalInstanceId.set(terminal.instanceId, marker);
        if (marker) {
          preRunMarkersStore.add(marker);
        }
      }
      _progress.report({ message: new MarkdownString(localize("copilotChat.runningTask", "Running task `{0}`", args.task.label)) });
      const raceResult = await Promise.race([this._tasksService.run(task, void 0, TaskRunSource.ChatAgent), timeout(3e3)]);
      result = raceResult && typeof raceResult === "object" ? raceResult : void 0;
      const resources = this._tasksService.getTerminalsForTasks(dependencyTasks ?? task);
      const terminals = resources?.map((resource) => this._terminalService.instances.find((t) => t.resource.path === resource?.path && t.resource.scheme === resource.scheme)).filter(Boolean);
      if (!terminals || terminals.length === 0) {
        return { content: [{ kind: "text", value: `Task started but no terminal was found for: ${args.task.label}` }], toolResultMessage: new MarkdownString(localize("copilotChat.noTerminal", "Task started but no terminal was found for: `{0}`", args.task.label)) };
      }
      const store = new DisposableStore();
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
    } finally {
      preRunMarkersStore.dispose();
    }
    for (const r of terminalResults) {
      this._telemetryService.publicLog2?.("copilotChat.runTaskTool.createAndRunTask", {
        taskId: args.task.label,
        bufferLength: r.output.length ?? 0,
        pollDurationMs: r.pollDurationMs ?? 0,
        inputToolManualAcceptCount: r.inputToolManualAcceptCount ?? 0,
        inputToolManualRejectCount: r.inputToolManualRejectCount ?? 0,
        inputToolManualChars: r.inputToolManualChars ?? 0,
        inputToolManualShownCount: r.inputToolManualShownCount ?? 0,
        inputToolFreeFormInputCount: r.inputToolFreeFormInputCount ?? 0,
        inputToolFreeFormInputShownCount: r.inputToolFreeFormInputShownCount ?? 0
      });
    }
    const details = terminalResults.map((r) => `Terminal: ${r.name}
Output:
${r.output}`);
    const uniqueDetails = Array.from(new Set(details)).join("\n\n");
    const toolResultDetails = toolResultDetailsFromResponse(terminalResults);
    const toolResultMessage = toolResultMessageFromResponse(result, args.task.label, toolResultDetails, terminalResults, void 0, task.configurationProperties.isBackground);
    return {
      content: [{ kind: "text", value: uniqueDetails }],
      toolResultMessage,
      toolResultDetails
    };
  }
  async _isTaskActive(task) {
    const busyTasks = await this._tasksService.getBusyTasks();
    return busyTasks?.some((t) => tasksMatch(t, task)) ?? false;
  }
  async prepareToolInvocation(context, token) {
    const args = context.parameters;
    const task = args.task;
    const allTasks = await this._tasksService.tasks();
    if (allTasks?.find((t) => t._label === task.label)) {
      return {
        invocationMessage: new MarkdownString(localize("taskExists", "Task `{0}` already exists.", task.label)),
        pastTenseMessage: new MarkdownString(localize("taskExistsPast", "Task `{0}` already exists.", task.label)),
        confirmationMessages: void 0
      };
    }
    const activeTasks = await this._tasksService.getActiveTasks();
    if (activeTasks.find((t) => t._label === task.label)) {
      return {
        invocationMessage: new MarkdownString(localize("alreadyRunning", "Task `{0}` is already running.", task.label)),
        pastTenseMessage: new MarkdownString(localize("alreadyRunning", "Task `{0}` is already running.", task.label)),
        confirmationMessages: void 0
      };
    }
    return {
      invocationMessage: new MarkdownString(localize("createdTask", "Created task `{0}`", task.label)),
      pastTenseMessage: new MarkdownString(localize("createdTaskPast", "Created task `{0}`", task.label)),
      confirmationMessages: {
        title: localize("allowTaskCreationExecution", "Allow task creation and execution?"),
        message: new MarkdownString(
          localize(
            "createTask",
            "A task `{0}` with command `{1}`{2} will be created.",
            task.label,
            task.command,
            task.args?.length ? ` and args \`${task.args.join(" ")}\`` : ""
          )
        )
      }
    };
  }
};
CreateAndRunTaskTool = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ITerminalService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService)
], CreateAndRunTaskTool);
const CreateAndRunTaskToolData = {
  id: TerminalToolId.CreateAndRunTask,
  toolReferenceName: "createAndRunTask",
  legacyToolReferenceFullNames: ["runTasks/createAndRunTask"],
  displayName: localize("createAndRunTask.displayName", "Create and run Task"),
  modelDescription: "Creates and runs a build, run, or custom task for the workspace by generating or adding to a tasks.json file based on the project structure (such as package.json or README.md). If the user asks to build, run, launch and they have no tasks.json file, use this tool. If they ask to create or add a task, use this tool.",
  userDescription: localize("createAndRunTask.userDescription", "Create and run a task in the workspace"),
  source: ToolDataSource.Internal,
  inputSchema: {
    "type": "object",
    "properties": {
      "workspaceFolder": {
        "type": "string",
        "description": "The absolute path of the workspace folder where the tasks.json file will be created."
      },
      "task": {
        "type": "object",
        "description": "The task to add to the new tasks.json file.",
        "properties": {
          "label": {
            "type": "string",
            "description": "The label of the task."
          },
          "type": {
            "type": "string",
            "description": `The type of the task. The only supported value is 'shell'.`,
            "enum": [
              "shell"
            ]
          },
          "command": {
            "type": "string",
            "description": "The shell command to run for the task. Use this to specify commands for building or running the application."
          },
          "args": {
            "type": "array",
            "description": "The arguments to pass to the command.",
            "items": {
              "type": "string"
            }
          },
          "isBackground": {
            "type": "boolean",
            "description": "Whether the task runs in the background without blocking the UI or other tasks. Set to true for long-running processes like watch tasks or servers that should continue executing without requiring user attention. When false, the task will block the terminal until completion."
          },
          "problemMatcher": {
            "type": "array",
            "description": `The problem matcher to use to parse task output for errors and warnings. Can be a predefined matcher like '$tsc' (TypeScript), '$eslint - stylish', '$gcc', etc., or a custom pattern defined in tasks.json. This helps VS Code display errors in the Problems panel and enables quick navigation to error locations.`,
            "items": {
              "type": "string"
            }
          },
          "group": {
            "type": "string",
            "description": "The group to which the task belongs."
          }
        },
        "required": [
          "label",
          "type",
          "command"
        ]
      }
    },
    "required": [
      "task",
      "workspaceFolder"
    ]
  }
};
export {
  CreateAndRunTaskTool,
  CreateAndRunTaskToolData
};
