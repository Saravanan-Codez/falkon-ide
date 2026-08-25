import { ToolDataSource, ToolInvocationPresentation } from "../languageModelToolsService.js";
const TaskCompleteToolId = "task_complete";
const AUTOPILOT_CONTINUATION_MESSAGE = "You have not yet marked the task as complete using the task_complete tool. You MUST call task_complete when done \u2014 whether the task involved code changes, answering a question, or any other interaction.\n\nDo NOT repeat or restate your previous response. Pick up where you left off.\n\nIf you were planning, stop planning and start implementing. You are not done until you have fully completed the task.\n\nIMPORTANT: Do NOT call task_complete if:\n- You have open questions or ambiguities \u2014 make good decisions and keep working\n- You encountered an error \u2014 try to resolve it or find an alternative approach\n- There are remaining steps \u2014 complete them first\n\nWhen you ARE done, first provide a brief text summary of what was accomplished, then call task_complete. Both the summary message and the tool call are required.\n\nKeep working autonomously until the task is truly finished, then call task_complete.";
const TaskCompleteToolData = {
  id: TaskCompleteToolId,
  displayName: "Task Complete",
  modelDescription: "Signal that the user's task is fully done. You MUST call this tool when your work is complete \u2014 whether you made code changes, answered a question, or completed any other kind of task. Provide a brief summary of what was accomplished. Do not restate the summary in your message text \u2014 it is shown to the user directly.\n\nIMPORTANT: Before calling this tool, you MUST output a brief text message summarizing what was done. The task is not complete until both your summary message AND this tool call are present.\n\nWhen to call:\n- After answering the user's question or completing a conversational request\n- After you have completed ALL requested changes\n- After verifying results: tests pass, terminal commands succeeded, tool calls returned expected output\n\nWhen NOT to call:\n- If a terminal command failed or produced unexpected output\n- If an MCP or external tool call returned an error\n- If you encountered errors you have not resolved\n- If there are remaining steps to complete\n- If you have not verified your changes work",
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Brief summary of what was accomplished. Omit for trivial interactions."
      }
    }
  }
};
class TaskCompleteTool {
  async prepareToolInvocation(_context, _token) {
    return {
      presentation: ToolInvocationPresentation.Hidden
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const summary = params?.summary ?? "All done!";
    return {
      content: [{
        kind: "text",
        value: summary
      }]
    };
  }
}
export {
  AUTOPILOT_CONTINUATION_MESSAGE,
  TaskCompleteTool,
  TaskCompleteToolData,
  TaskCompleteToolId
};
