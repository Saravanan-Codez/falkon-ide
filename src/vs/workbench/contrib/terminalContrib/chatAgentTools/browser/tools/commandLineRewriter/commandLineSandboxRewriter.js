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
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { isPowerShell } from "../../runInTerminalHelpers.js";
import { TreeSitterCommandParserLanguage } from "../../treeSitterCommandParser.js";
import { ITerminalSandboxService, TerminalSandboxPrerequisiteCheck } from "../../../common/terminalSandboxService.js";
let CommandLineSandboxRewriter = class extends Disposable {
  constructor(_treeSitterCommandParser, _sandboxService) {
    super();
    this._treeSitterCommandParser = _treeSitterCommandParser;
    this._sandboxService = _sandboxService;
  }
  async rewrite(options) {
    const sandboxPrereqs = await this._sandboxService.checkForSandboxingPrereqs(false, options.sandboxPrecheckInputs);
    if (!sandboxPrereqs.enabled || sandboxPrereqs.failedCheck === TerminalSandboxPrerequisiteCheck.Config) {
      return void 0;
    }
    const commandDetails = await this._parseCommandDetails(options);
    const wrappedCommand = await this._sandboxService.wrapCommand(options.commandLine, options.requestUnsandboxedExecution, options.shell, options.cwd, commandDetails, options.requestAllowNetwork);
    return {
      rewritten: wrappedCommand.command,
      reasoning: wrappedCommand.requiresAllowNetworkConfirmation ? "Wrapped command for sandbox execution with unrestricted network access" : wrappedCommand.requiresUnsandboxConfirmation ? "Switched command to unsandboxed execution because the command includes a domain that is not in the sandbox allowlist" : "Wrapped command for sandbox execution",
      forDisplay: options.commandLine,
      // show the command that is passed as input (after prior rewrites like cd prefix stripping)
      isSandboxWrapped: wrappedCommand.isSandboxWrapped,
      requiresUnsandboxConfirmation: wrappedCommand.requiresUnsandboxConfirmation,
      requiresAllowNetworkConfirmation: wrappedCommand.requiresAllowNetworkConfirmation,
      blockedDomains: wrappedCommand.blockedDomains,
      deniedDomains: wrappedCommand.deniedDomains
    };
  }
  /**
   * Parses the command line into sandbox command details. If parsing fails,
   * wrapping continues with the base sandbox config rather than blocking the command.
   */
  async _parseCommandDetails(options) {
    try {
      if (options.requestUnsandboxedExecution === true) {
        return [];
      }
      const languageId = isPowerShell(options.shell, options.os) ? TreeSitterCommandParserLanguage.PowerShell : TreeSitterCommandParserLanguage.Bash;
      return await this._treeSitterCommandParser.extractCommands(languageId, options.commandLine);
    } catch {
      return [];
    }
  }
};
CommandLineSandboxRewriter = __decorateClass([
  __decorateParam(1, ITerminalSandboxService)
], CommandLineSandboxRewriter);
export {
  CommandLineSandboxRewriter
};
