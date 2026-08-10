import { isPowerShell } from "../../runInTerminalHelpers.js";
class NodeCommandLinePresenter {
  present(options) {
    const commandLine = options.commandLine.forDisplay;
    const extractedNode = extractNodeCommand(commandLine, options.shell, options.os);
    if (extractedNode) {
      return {
        commandLine: extractedNode,
        language: "javascript",
        languageDisplayName: "Node.js"
      };
    }
    return void 0;
  }
}
function extractNodeCommand(commandLine, shell, os) {
  const doubleQuoteMatch = commandLine.match(/^node(?:js)?\s+(?:-e|--eval)\s+"(?<code>.+)"$/s);
  if (doubleQuoteMatch?.groups?.code) {
    let jsCode = doubleQuoteMatch.groups.code.trim();
    if (isPowerShell(shell, os)) {
      jsCode = jsCode.replace(/`"/g, '"');
    } else {
      jsCode = jsCode.replace(/\\"/g, '"');
    }
    return jsCode;
  }
  const singleQuoteMatch = commandLine.match(/^node(?:js)?\s+(?:-e|--eval)\s+'(?<code>.+)'$/s);
  if (singleQuoteMatch?.groups?.code) {
    return singleQuoteMatch.groups.code.trim();
  }
  return void 0;
}
export {
  NodeCommandLinePresenter,
  extractNodeCommand
};
