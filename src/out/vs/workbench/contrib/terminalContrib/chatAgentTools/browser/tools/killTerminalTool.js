import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { ToolDataSource } from "../../../../chat/common/tools/languageModelToolsService.js";
import { RunInTerminalTool } from "./runInTerminalTool.js";
import { TerminalToolId } from "./toolIds.js";
const KillTerminalToolData = {
  id: TerminalToolId.KillTerminal,
  toolReferenceName: "killTerminal",
  displayName: localize("killTerminalTool.displayName", "Kill Terminal"),
  modelDescription: `Kill a terminal by its ID. Use this to clean up terminals that are no longer needed (e.g., after stopping a server or when a long-running task completes). The terminal ID is returned by ${TerminalToolId.RunInTerminal} in async mode (legacy: isBackground=true).`,
  icon: Codicon.terminal,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: `The ID of the persistent terminal to kill (returned by ${TerminalToolId.RunInTerminal} in async mode).`,
        pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
      }
    },
    required: [
      "id"
    ]
  }
};
class KillTerminalTool extends Disposable {
  async prepareToolInvocation(_context, _token) {
    return {
      invocationMessage: localize("kill.progressive", "Killing terminal"),
      pastTenseMessage: localize("kill.past", "Killed terminal")
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const args = invocation.parameters;
    const execution = RunInTerminalTool.getExecution(args.id);
    if (!execution) {
      return {
        content: [{
          kind: "text",
          value: `Error: No active terminal execution found with ID ${args.id}. The terminal may have already been killed or the ID is invalid.`
        }]
      };
    }
    const finalOutput = execution.getOutput();
    RunInTerminalTool.markKilledByTool(args.id);
    execution.instance.dispose();
    const outputSummary = finalOutput ? `Final output before termination:
${finalOutput}` : "No output was captured.";
    return {
      content: [{
        kind: "text",
        value: `Successfully killed persistent terminal ${args.id}. ${outputSummary}`
      }]
    };
  }
}
export {
  KillTerminalTool,
  KillTerminalToolData
};
