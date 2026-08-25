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
import { getWindowById } from "../../../../../base/browser/dom.js";
import { isAuxiliaryWindow } from "../../../../../base/browser/window.js";
import { timeout } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../base/common/path.js";
import { isString } from "../../../../../base/common/types.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { TelemetryTrustedValue } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalLocation } from "../../../../../platform/terminal/common/terminal.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { ITerminalEditorService, ITerminalService } from "../../../terminal/browser/terminal.js";
let TerminalTelemetryContribution = class extends Disposable {
  constructor(lifecycleService, terminalService, terminalEditorService, _telemetryService) {
    super();
    this._telemetryService = _telemetryService;
    this._register(terminalService.onDidCreateInstance(async (instance) => {
      const store = new DisposableStore();
      this._store.add(store);
      await Promise.race([
        // Wait for process ready so the shell launch config is fully resolved, then
        // allow another 10 seconds for the shell integration to be fully initialized
        instance.processReady.then(() => {
          return timeout(1e4);
        }),
        // If the terminal is disposed, it's ready to report on immediately
        Event.toPromise(instance.onDisposed, store),
        // If the app is shutting down, flush
        Event.toPromise(lifecycleService.onWillShutdown, store)
      ]);
      let isInAuxWindow = false;
      try {
        const input = terminalEditorService.getInputFromResource(instance.resource);
        const windowId = input.group?.windowId;
        isInAuxWindow = !!(windowId && isAuxiliaryWindow(getWindowById(windowId, true).window));
      } catch {
      }
      this._logCreateInstance(instance, isInAuxWindow);
      this._store.delete(store);
    }));
    this._register(terminalService.onAnyInstanceShellTypeChanged((instance) => {
      this._logShellTypeChanged(instance);
    }));
  }
  static {
    this.ID = "terminalTelemetry";
  }
  _logCreateInstance(instance, isInAuxWindow) {
    const slc = instance.shellLaunchConfig;
    const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
    this._telemetryService.publicLog2("terminal/createInstance", {
      location: instance.target === TerminalLocation.Panel ? "view" : instance.target === TerminalLocation.Editor ? isInAuxWindow ? "editor-auxwindow" : "editor" : "unknown",
      shellType: new TelemetryTrustedValue(getSanitizedShellType(slc)),
      promptType: new TelemetryTrustedValue(instance.capabilities.get(TerminalCapability.PromptTypeDetection)?.promptType),
      isCustomPtyImplementation: !!slc.customPtyImplementation,
      isExtensionOwnedTerminal: !!slc.isExtensionOwnedTerminal,
      isLoginShell: (isString(slc.args) ? slc.args.split(" ") : slc.args)?.some((arg) => arg === "-l" || arg === "--login") ?? false,
      isReconnect: !!slc.attachPersistentProcess,
      hasRemoteAuthority: instance.hasRemoteAuthority,
      shellIntegrationQuality: commandDetection?.hasRichCommandDetection ? 2 : commandDetection ? 1 : 0,
      shellIntegrationInjected: instance.usedShellIntegrationInjection,
      shellIntegrationInjectionFailureReason: instance.shellIntegrationInjectionFailureReason,
      imageAddonLoaded: instance.xterm?.isImageAddonLoaded ?? false,
      terminalSessionId: instance.sessionId
    });
  }
  _logShellTypeChanged(instance) {
    this._telemetryService.publicLog2("terminal/shellTypeChanged", {
      shellType: new TelemetryTrustedValue(instance.shellType ?? "unknown"),
      terminalSessionId: instance.sessionId
    });
  }
};
TerminalTelemetryContribution = __decorateClass([
  __decorateParam(0, ILifecycleService),
  __decorateParam(1, ITerminalService),
  __decorateParam(2, ITerminalEditorService),
  __decorateParam(3, ITelemetryService)
], TerminalTelemetryContribution);
var AllowedShellType = /* @__PURE__ */ ((AllowedShellType2) => {
  AllowedShellType2["Unknown"] = "unknown";
  AllowedShellType2["CommandPrompt"] = "cmd";
  AllowedShellType2["Cygwin"] = "cygwin-bash";
  AllowedShellType2["GitBash"] = "git-bash";
  AllowedShellType2["Msys2"] = "msys2-bash";
  AllowedShellType2["WindowsPowerShell"] = "windows-powershell";
  AllowedShellType2["Wsl"] = "wsl";
  AllowedShellType2["Bash"] = "bash";
  AllowedShellType2["Fish"] = "fish";
  AllowedShellType2["Pwsh"] = "pwsh";
  AllowedShellType2["PwshPreview"] = "pwsh-preview";
  AllowedShellType2["Sh"] = "sh";
  AllowedShellType2["Ssh"] = "ssh";
  AllowedShellType2["Tmux"] = "tmux";
  AllowedShellType2["Zsh"] = "zsh";
  AllowedShellType2["Amm"] = "amm";
  AllowedShellType2["Ash"] = "ash";
  AllowedShellType2["Csh"] = "csh";
  AllowedShellType2["Dash"] = "dash";
  AllowedShellType2["Elvish"] = "elvish";
  AllowedShellType2["Ion"] = "ion";
  AllowedShellType2["Ksh"] = "ksh";
  AllowedShellType2["Mksh"] = "mksh";
  AllowedShellType2["Msh"] = "msh";
  AllowedShellType2["NuShell"] = "nu";
  AllowedShellType2["Plan9Shell"] = "rc";
  AllowedShellType2["SchemeShell"] = "scsh";
  AllowedShellType2["Tcsh"] = "tcsh";
  AllowedShellType2["Termux"] = "termux";
  AllowedShellType2["Xonsh"] = "xonsh";
  AllowedShellType2["Claude"] = "claude";
  AllowedShellType2["Codex"] = "codex";
  AllowedShellType2["Copilot"] = "copilot";
  AllowedShellType2["Gemini"] = "gemini";
  AllowedShellType2["Clojure"] = "clj";
  AllowedShellType2["CommonLispSbcl"] = "sbcl";
  AllowedShellType2["Crystal"] = "crystal";
  AllowedShellType2["Deno"] = "deno";
  AllowedShellType2["Elixir"] = "iex";
  AllowedShellType2["Erlang"] = "erl";
  AllowedShellType2["FSharp"] = "fsi";
  AllowedShellType2["Go"] = "go";
  AllowedShellType2["HaskellGhci"] = "ghci";
  AllowedShellType2["Java"] = "jshell";
  AllowedShellType2["Julia"] = "julia";
  AllowedShellType2["Lua"] = "lua";
  AllowedShellType2["Node"] = "node";
  AllowedShellType2["Ocaml"] = "ocaml";
  AllowedShellType2["Perl"] = "perl";
  AllowedShellType2["Php"] = "php";
  AllowedShellType2["PrologSwipl"] = "swipl";
  AllowedShellType2["Python"] = "python";
  AllowedShellType2["R"] = "R";
  AllowedShellType2["RubyIrb"] = "irb";
  AllowedShellType2["Scala"] = "scala";
  AllowedShellType2["SchemeRacket"] = "racket";
  AllowedShellType2["SmalltalkGnu"] = "gst";
  AllowedShellType2["SmalltalkPharo"] = "pharo";
  AllowedShellType2["Tcl"] = "tclsh";
  AllowedShellType2["TsNode"] = "ts-node";
  return AllowedShellType2;
})(AllowedShellType || {});
const shellTypeExecutableAllowList = /* @__PURE__ */ new Set([
  // Windows only
  "cmd" /* CommandPrompt */,
  "wsl" /* Wsl */,
  // Common Unix shells
  "bash" /* Bash */,
  "fish" /* Fish */,
  "pwsh" /* Pwsh */,
  "sh" /* Sh */,
  "ssh" /* Ssh */,
  "tmux" /* Tmux */,
  "zsh" /* Zsh */,
  // More shells
  "amm" /* Amm */,
  "ash" /* Ash */,
  "csh" /* Csh */,
  "dash" /* Dash */,
  "elvish" /* Elvish */,
  "ion" /* Ion */,
  "ksh" /* Ksh */,
  "mksh" /* Mksh */,
  "msh" /* Msh */,
  "nu" /* NuShell */,
  "rc" /* Plan9Shell */,
  "scsh" /* SchemeShell */,
  "tcsh" /* Tcsh */,
  "termux" /* Termux */,
  "xonsh" /* Xonsh */,
  // Lanugage REPLs
  "clj" /* Clojure */,
  "sbcl" /* CommonLispSbcl */,
  "crystal" /* Crystal */,
  "deno" /* Deno */,
  "iex" /* Elixir */,
  "erl" /* Erlang */,
  "fsi" /* FSharp */,
  "go" /* Go */,
  "ghci" /* HaskellGhci */,
  "jshell" /* Java */,
  "julia" /* Julia */,
  "lua" /* Lua */,
  "node" /* Node */,
  "ocaml" /* Ocaml */,
  "perl" /* Perl */,
  "php" /* Php */,
  "swipl" /* PrologSwipl */,
  "python" /* Python */,
  "R" /* R */,
  "irb" /* RubyIrb */,
  "scala" /* Scala */,
  "racket" /* SchemeRacket */,
  "gst" /* SmalltalkGnu */,
  "pharo" /* SmalltalkPharo */,
  "tclsh" /* Tcl */,
  "ts-node" /* TsNode */
]);
const shellTypeExecutableRegexAllowList = [
  { regex: /^(?:pwsh|powershell)-preview$/i, type: "pwsh-preview" /* PwshPreview */ },
  { regex: /^python(?:\d+(?:\.\d+)?)?$/i, type: "python" /* Python */ }
];
const shellTypePathRegexAllowList = [
  // Cygwin uses bash.exe, so look up based on the path
  { regex: /\\Cygwin(?:64)?\\.+\\bash\.exe$/i, type: "cygwin-bash" /* Cygwin */ },
  // Git bash uses bash.exe, so look up based on the path
  { regex: /\\Git\\.+\\bash\.exe$/i, type: "git-bash" /* GitBash */ },
  // Msys2 uses bash.exe, so look up based on the path
  { regex: /\\msys(?:32|64)\\.+\\(?:bash|msys2)\.exe$/i, type: "msys2-bash" /* Msys2 */ },
  // WindowsPowerShell should always be installed on this path, we cannot just look at the
  // executable name since powershell is the CLI on other platforms sometimes (eg. snap package)
  { regex: /\\WindowsPowerShell\\v1.0\\powershell.exe$/i, type: "windows-powershell" /* WindowsPowerShell */ },
  // WSL executables will represent some other shell in the end, but it's difficult to determine
  // when we log
  { regex: /\\Windows\\(?:System32|SysWOW64|Sysnative)\\(?:bash|wsl)\.exe$/i, type: "wsl" /* Wsl */ }
];
function getSanitizedShellType(slc) {
  if (!slc.executable) {
    return "unknown" /* Unknown */;
  }
  const executableFile = basename(slc.executable);
  const executableFileWithoutExt = executableFile.replace(/\.[^\.]+$/, "");
  for (const entry of shellTypePathRegexAllowList) {
    if (entry.regex.test(slc.executable)) {
      return entry.type;
    }
  }
  for (const entry of shellTypeExecutableRegexAllowList) {
    if (entry.regex.test(executableFileWithoutExt)) {
      return entry.type;
    }
  }
  if (shellTypeExecutableAllowList.has(executableFileWithoutExt)) {
    return executableFileWithoutExt;
  }
  return "unknown" /* Unknown */;
}
export {
  TerminalTelemetryContribution
};
