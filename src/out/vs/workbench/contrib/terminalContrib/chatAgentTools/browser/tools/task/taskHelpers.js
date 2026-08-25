import { localize } from "../../../../../../../nls.js";
import { OutputMonitorState } from "../monitoring/types.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
function toolResultDetailsFromResponse(terminalResults) {
  return Array.from(new Map(
    terminalResults.flatMap(
      (r) => r.resources?.filter((res) => res.uri).map((res) => {
        const range = res.range;
        const item = range !== void 0 ? { uri: res.uri, range } : res.uri;
        const key = range !== void 0 ? `${res.uri.toString()}-${range.toString()}` : `${res.uri.toString()}`;
        return [key, item];
      }) ?? []
    )
  ).values());
}
function toolResultMessageFromResponse(result, taskLabel, toolResultDetails, terminalResults, getOutputTool, isBackground) {
  let resultSummary = "";
  if (result?.exitCode) {
    resultSummary = localize("copilotChat.taskFailedWithExitCode", "Task `{0}` failed with exit code {1}.", taskLabel, result.exitCode);
  } else {
    resultSummary += `\`${taskLabel}\` task `;
    const problemCount = toolResultDetails.length;
    if (getOutputTool) {
      return problemCount ? new MarkdownString(`Got output for ${resultSummary} with \`${problemCount}\` problem${problemCount === 1 ? "" : "s"}`) : new MarkdownString(`Got output for ${resultSummary}`);
    } else {
      const problemCount2 = toolResultDetails.length;
      resultSummary += terminalResults.every((r) => r.state === OutputMonitorState.Idle) ? problemCount2 ? `finished with \`${problemCount2}\` problem${problemCount2 === 1 ? "" : "s"}` : "finished" : isBackground ? problemCount2 ? `started and will continue to run in the background with \`${problemCount2}\` problem${problemCount2 === 1 ? "" : "s"}` : "started and will continue to run in the background" : problemCount2 ? `started with \`${problemCount2}\` problem${problemCount2 === 1 ? "" : "s"}` : "started";
    }
  }
  return new MarkdownString(resultSummary);
}
export {
  toolResultDetailsFromResponse,
  toolResultMessageFromResponse
};
