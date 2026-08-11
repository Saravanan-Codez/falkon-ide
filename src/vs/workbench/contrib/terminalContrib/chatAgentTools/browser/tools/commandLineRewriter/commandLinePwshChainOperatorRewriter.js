import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { isPowerShell } from "../../runInTerminalHelpers.js";
class CommandLinePwshChainOperatorRewriter extends Disposable {
  constructor(_treeSitterCommandParser) {
    super();
    this._treeSitterCommandParser = _treeSitterCommandParser;
  }
  async rewrite(options) {
    if (isPowerShell(options.shell, options.os)) {
      let doubleAmpersandCaptures;
      try {
        doubleAmpersandCaptures = await this._treeSitterCommandParser.extractPwshDoubleAmpersandChainOperators(options.commandLine);
      } catch {
      }
      if (doubleAmpersandCaptures && doubleAmpersandCaptures.length > 0) {
        let rewritten = options.commandLine;
        for (const capture of doubleAmpersandCaptures.reverse()) {
          rewritten = `${rewritten.substring(0, capture.node.startIndex)};${rewritten.substring(capture.node.endIndex)}`;
        }
        return {
          rewritten,
          reasoning: "&& re-written to ;"
        };
      }
    }
    return void 0;
  }
}
export {
  CommandLinePwshChainOperatorRewriter
};
