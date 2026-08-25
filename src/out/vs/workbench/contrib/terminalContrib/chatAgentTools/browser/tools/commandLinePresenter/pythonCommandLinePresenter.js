import { isPowerShell } from "../../runInTerminalHelpers.js";
class PythonCommandLinePresenter {
  present(options) {
    const commandLine = options.commandLine.forDisplay;
    const extractedPython = extractPythonCommand(commandLine, options.shell, options.os);
    if (extractedPython) {
      return {
        commandLine: extractedPython,
        language: "python",
        languageDisplayName: "Python"
      };
    }
    return void 0;
  }
}
function extractPythonCommand(commandLine, shell, os) {
  const doubleQuoteMatch = commandLine.match(/^python(?:3)?\s+-c\s+"(?<python>.+)"$/s);
  if (doubleQuoteMatch?.groups?.python) {
    let pythonCode = doubleQuoteMatch.groups.python.trim();
    if (isPowerShell(shell, os)) {
      pythonCode = pythonCode.replace(/`"/g, '"');
    } else {
      pythonCode = pythonCode.replace(/\\"/g, '"');
    }
    return pythonCode;
  }
  const singleQuoteMatch = commandLine.match(/^python(?:3)?\s+-c\s+'(?<python>.+)'$/s);
  if (singleQuoteMatch?.groups?.python) {
    return singleQuoteMatch.groups.python.trim();
  }
  return void 0;
}
export {
  PythonCommandLinePresenter,
  extractPythonCommand
};
