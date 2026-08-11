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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { StringSHA1 } from "../../../../../../base/common/hash.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ToolDataSource } from "../../../../chat/common/tools/languageModelToolsService.js";
import { ITerminalService } from "../../../../terminal/browser/terminal.js";
import { TerminalChatAgentToolsSettingId } from "../../common/terminalChatAgentToolsConfiguration.js";
import { RunInTerminalTool } from "./runInTerminalTool.js";
import { TerminalToolId } from "./toolIds.js";
const GetTerminalOutputToolData = {
  id: TerminalToolId.GetTerminalOutput,
  toolReferenceName: "getTerminalOutput",
  legacyToolReferenceFullNames: ["runCommands/getTerminalOutput"],
  displayName: localize("getTerminalOutputTool.displayName", "Get Terminal Output"),
  modelDescription: `Get output from a terminal execution that was moved to background (identified by the \`id\` returned from ${TerminalToolId.RunInTerminal}). Use this ONLY when the ${TerminalToolId.RunInTerminal} result explicitly says the command was moved to background, timed out, or needs input. Do NOT call this after a sync command that completed normally \u2014 sync commands return full output inline. If a background command has not yet completed, you will be automatically notified when it finishes \u2014 do NOT poll; end your turn and wait.`,
  icon: Codicon.terminal,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: `The ID of an active terminal execution to check (returned by ${TerminalToolId.RunInTerminal} for async executions, or for sync executions that timed out and were moved to the background). This must be the exact opaque UUID returned by that tool; terminal names, labels, or integers are invalid.`,
        pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
      }
    },
    required: ["id"]
  }
};
let GetTerminalOutputTool = class extends Disposable {
  constructor(_configurationService, terminalService) {
    super();
    this._configurationService = _configurationService;
    this._lastOutputSnapshotByExecutionId = /* @__PURE__ */ new Map();
    this._register(terminalService.onDidDisposeInstance((instance) => this._forgetTerminalInstance(instance.instanceId)));
  }
  static {
    this._maxOutputSnapshots = 100;
  }
  static {
    this._tailCharBudget = 8e3;
  }
  async prepareToolInvocation(context, token) {
    return {
      invocationMessage: localize("getTerminalOutput.progressive", "Checking terminal output"),
      pastTenseMessage: localize("getTerminalOutput.past", "Checked terminal output")
    };
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const args = invocation.parameters;
    if (!args.id) {
      return {
        content: [{
          kind: "text",
          value: `Error: 'id' (the persistent terminal UUID returned by ${TerminalToolId.RunInTerminal} in async mode) must be provided.`
        }]
      };
    }
    const execution = RunInTerminalTool.getExecution(args.id);
    if (!execution) {
      this._lastOutputSnapshotByExecutionId.delete(args.id);
      return {
        content: [{
          kind: "text",
          value: `Error: No active terminal execution found with ID ${args.id}. The ID must be the exact value returned by ${TerminalToolId.RunInTerminal} in async mode.`
        }]
      };
    }
    return {
      content: [{
        kind: "text",
        value: this._formatOutput(args.id, execution.instance.instanceId, execution.getOutput())
      }]
    };
  }
  _formatOutput(id, terminalInstanceId, output) {
    if (!this._configurationService.getValue(TerminalChatAgentToolsSettingId.OutputDeltas)) {
      this._lastOutputSnapshotByExecutionId.clear();
      return this._formatTailOrFull(output, `Output of terminal ${id}`);
    }
    const previousOutputSnapshot = this._lastOutputSnapshotByExecutionId.get(id);
    const currentOutputSnapshot = this._createOutputSnapshot(terminalInstanceId, output);
    this._rememberOutput(id, currentOutputSnapshot);
    if (previousOutputSnapshot === void 0) {
      return this._formatTailOrFull(output, `Output of terminal ${id}`);
    }
    if (currentOutputSnapshot.length === previousOutputSnapshot.length && currentOutputSnapshot.hash === previousOutputSnapshot.hash) {
      return `Output of terminal ${id} unchanged since previous poll (${output.length} total characters in buffer). No new output.`;
    }
    if (output.length > previousOutputSnapshot.length && this._hashOutput(output, previousOutputSnapshot.length) === previousOutputSnapshot.hash) {
      const delta = output.slice(previousOutputSnapshot.length);
      return `Output of terminal ${id} since previous poll (${delta.length} new characters, ${output.length} total characters):
${delta}`;
    }
    return this._formatTailOrFull(output, `Output of terminal ${id} changed since previous poll`);
  }
  _formatTailOrFull(output, prefix) {
    if (output.length <= GetTerminalOutputTool._tailCharBudget) {
      return `${prefix}:
${output}`;
    }
    const tail = this._tailOf(output, GetTerminalOutputTool._tailCharBudget);
    const omitted = output.length - tail.length;
    return `${prefix}; showing last ${tail.length} of ${output.length} characters (${omitted} earlier characters omitted). If you need the omitted earlier output, re-run the command and redirect output to a file, then read that file:
${tail}`;
  }
  _tailOf(output, charBudget) {
    if (output.length <= charBudget) {
      return output;
    }
    const startIndex = output.length - charBudget;
    const newlineIndex = output.indexOf("\n", startIndex);
    if (newlineIndex !== -1 && newlineIndex < output.length - 1) {
      return output.slice(newlineIndex + 1);
    }
    return output.slice(startIndex);
  }
  _rememberOutput(id, snapshot) {
    if (!this._lastOutputSnapshotByExecutionId.has(id) && this._lastOutputSnapshotByExecutionId.size >= GetTerminalOutputTool._maxOutputSnapshots) {
      const oldestId = this._lastOutputSnapshotByExecutionId.keys().next().value;
      if (oldestId !== void 0) {
        this._lastOutputSnapshotByExecutionId.delete(oldestId);
      }
    }
    this._lastOutputSnapshotByExecutionId.set(id, snapshot);
  }
  _createOutputSnapshot(terminalInstanceId, output) {
    return {
      terminalInstanceId,
      length: output.length,
      hash: this._hashOutput(output)
    };
  }
  _forgetTerminalInstance(terminalInstanceId) {
    for (const [id, snapshot] of this._lastOutputSnapshotByExecutionId) {
      if (snapshot.terminalInstanceId === terminalInstanceId) {
        this._lastOutputSnapshotByExecutionId.delete(id);
      }
    }
  }
  _hashOutput(output, length = output.length) {
    const sha = new StringSHA1();
    sha.update(length === output.length ? output : output.slice(0, length));
    return sha.digest();
  }
  dispose() {
    this._lastOutputSnapshotByExecutionId.clear();
    super.dispose();
  }
};
GetTerminalOutputTool = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITerminalService)
], GetTerminalOutputTool);
export {
  GetTerminalOutputTool,
  GetTerminalOutputToolData
};
