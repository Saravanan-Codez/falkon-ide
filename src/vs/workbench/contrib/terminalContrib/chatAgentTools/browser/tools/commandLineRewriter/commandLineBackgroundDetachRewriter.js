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
import { OperatingSystem } from "../../../../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { TerminalChatAgentToolsSettingId } from "../../../common/terminalChatAgentToolsConfiguration.js";
import { isBash, isFish, isPowerShell, isZsh } from "../../runInTerminalHelpers.js";
let CommandLineBackgroundDetachRewriter = class extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
  }
  rewrite(options) {
    if (!this._configurationService.getValue(TerminalChatAgentToolsSettingId.DetachBackgroundProcesses)) {
      return void 0;
    }
    const trimmedForCheck = options.commandLine.trimEnd();
    const endsWithBareBackgroundAmp = /(?:^|[^&])&$/.test(trimmedForCheck);
    if (!options.isBackground && !endsWithBareBackgroundAmp) {
      return void 0;
    }
    if (this._readsFromStdin(options.commandLine)) {
      return void 0;
    }
    if (options.os === OperatingSystem.Windows) {
      if (!options.isBackground) {
        return void 0;
      }
      return this._rewriteForPowerShell(options);
    }
    return this._rewriteForPosix(options);
  }
  /**
   * Returns true when the command line invokes a program that is known to
   * require an interactive stdin. Detaching such a command would close stdin
   * and either hang the program or make it exit with an error.
   *
   * The check is intentionally conservative — only well-known interactive
   * front-ends are matched, and only when their command-line flags do not
   * obviously force non-interactive behaviour.
   */
  _readsFromStdin(commandLine) {
    const trimmed = commandLine.replace(/^\s*(?:[A-Z_][A-Z0-9_]*=\S+\s+)+/, "").replace(/^\s*cd\s+\S+\s*(?:&&|;)\s*/i, "").trimStart();
    if (/^(expect|passwd|vi|vim|nano|less|more|top|htop|sftp|ftp|telnet|gdb|lldb)\b/.test(trimmed)) {
      return true;
    }
    if (/^psql\b/.test(trimmed) && !/\s(-c|-f|--command|--file)\b/.test(trimmed)) {
      return true;
    }
    if (/^mysql\b/.test(trimmed) && !/\s(-e|--execute)\b/.test(trimmed)) {
      return true;
    }
    if (/^ssh\b/.test(trimmed) && !/\s-T\b/.test(trimmed) && !/\sssh\s+\S+\s+\S/.test(" " + trimmed)) {
      return true;
    }
    if (/^sudo\b/.test(trimmed) && !/\s-n\b/.test(trimmed) && !/\bSUDO_ASKPASS\b/.test(commandLine)) {
      return true;
    }
    return false;
  }
  _rewriteForPosix(options) {
    const trimmed = options.commandLine.trimEnd();
    const endsWithBackgroundAmp = /(?:^|[^&])&$/.test(trimmed);
    let commandToWrap = trimmed;
    if (this._needsShellCWrapper(trimmed)) {
      const innerCommand = endsWithBackgroundAmp ? trimmed.replace(/\s*&$/, "") : trimmed;
      if (isFish(options.shell, options.os)) {
        const escaped = innerCommand.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        commandToWrap = `${options.shell} -c "${escaped}"`;
      } else {
        const escaped = innerCommand.replace(/'/g, `'\\''`);
        commandToWrap = `${options.shell} -c '${escaped}'`;
      }
    }
    const needsTrailingAmp = !/(?:^|[^&])&$/.test(commandToWrap);
    const supportsDisown = isBash(options.shell, options.os) || isZsh(options.shell, options.os);
    const disownSuffix = supportsDisown ? " disown" : "";
    const rewritten = needsTrailingAmp ? `nohup ${commandToWrap} &${disownSuffix}` : `nohup ${commandToWrap}${disownSuffix}`;
    return {
      rewritten,
      reasoning: "Wrapped background command with nohup to survive terminal shutdown",
      forDisplay: options.commandLine
    };
  }
  /**
   * Returns true when the command uses shell constructs that `nohup` cannot exec
   * directly. Such commands must be wrapped in `<shell> -c '...'` before being
   * passed to nohup.
   *
   * `nohup` only accepts a single simple external command (plus its arguments).
   * Anything that requires shell parsing — compound statements, builtins, shell
   * operators, or inline variable assignments — must go through a shell wrapper.
   */
  _needsShellCWrapper(commandLine) {
    const trimmed = commandLine.trimStart();
    return (
      // Bash compound command keywords — syntax constructs that are not executables.
      /^(for|while|until|if|case|select|function)\b/.test(trimmed) || // Shell builtins — these only run meaningfully inside the current shell; nohup
      // cannot exec them (eval, set, export, source, unset, declare, cd, exec, etc.).
      /^(eval|set|export|source|unset|declare|typeset|local|readonly|alias|cd|exec)\b/.test(trimmed) || // `. file` (dot-source builtin). Exclude `./script` (relative path) by requiring
      // whitespace after the dot.
      /^\.\s/.test(trimmed) || // Compound groupings: subshell `( ... )` or brace group `{ ...; }`.
      /^[{(]/.test(trimmed) || // Inline environment variable assignments before a command (e.g. `VAR=val cmd`).
      // nohup would try to exec `VAR=val` as a program name.
      /^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed) || // Shell operators: pipes, command chains (&&, ||), semicolons, or background
      // operators (&) in the middle of the command. nohup only execs the first
      // simple command; the rest would be lost or misinterpreted.
      // A single trailing `&` is handled separately (not matched here) since it's
      // just a background operator that nohup can coexist with.
      /(?:\|\||&&|[|;]|&(?!&)(?!\s*$))/.test(trimmed)
    );
  }
  _rewriteForPowerShell(options) {
    if (!isPowerShell(options.shell, options.os)) {
      return void 0;
    }
    const escapedCommand = options.commandLine.replace(/"/g, '\\"');
    return {
      rewritten: `Start-Process -WindowStyle Hidden -FilePath "${options.shell}" -ArgumentList "-NoProfile", "-Command", "${escapedCommand}"`,
      reasoning: "Wrapped background command with Start-Process to survive terminal shutdown",
      forDisplay: options.commandLine
    };
  }
};
CommandLineBackgroundDetachRewriter = __decorateClass([
  __decorateParam(0, IConfigurationService)
], CommandLineBackgroundDetachRewriter);
export {
  CommandLineBackgroundDetachRewriter
};
