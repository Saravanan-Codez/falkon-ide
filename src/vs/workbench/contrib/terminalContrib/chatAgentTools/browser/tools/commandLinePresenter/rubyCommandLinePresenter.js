import { isPowerShell } from "../../runInTerminalHelpers.js";
class RubyCommandLinePresenter {
  present(options) {
    const commandLine = options.commandLine.forDisplay;
    const extractedRuby = extractRubyCommand(commandLine, options.shell, options.os);
    if (extractedRuby) {
      return {
        commandLine: extractedRuby,
        language: "ruby",
        languageDisplayName: "Ruby"
      };
    }
    return void 0;
  }
}
function extractRubyCommand(commandLine, shell, os) {
  const doubleQuoteMatch = commandLine.match(/^ruby\s+-e\s+"(?<code>.+)"$/s);
  if (doubleQuoteMatch?.groups?.code) {
    let rubyCode = doubleQuoteMatch.groups.code.trim();
    if (!rubyCode) {
      return void 0;
    }
    if (isPowerShell(shell, os)) {
      rubyCode = rubyCode.replace(/`"/g, '"');
    } else {
      rubyCode = rubyCode.replace(/\\"/g, '"');
    }
    return rubyCode;
  }
  const singleQuoteMatch = commandLine.match(/^ruby\s+-e\s+'(?<code>.+)'$/s);
  if (singleQuoteMatch?.groups?.code) {
    const rubyCode = singleQuoteMatch.groups.code.trim();
    if (!rubyCode) {
      return void 0;
    }
    return rubyCode;
  }
  return void 0;
}
export {
  RubyCommandLinePresenter,
  extractRubyCommand
};
