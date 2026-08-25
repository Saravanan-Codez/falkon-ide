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
import { DeferredPromise, RunOnceScheduler, timeout } from "../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { CancellationError } from "../../../../../../base/common/errors.js";
import { Event } from "../../../../../../base/common/event.js";
import { appendEscapedMarkdownInlineCode, escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { getMediaMime } from "../../../../../../base/common/mime.js";
import { basename, posix, win32 } from "../../../../../../base/common/path.js";
import { OperatingSystem, OS } from "../../../../../../base/common/platform.js";
import { count } from "../../../../../../base/common/strings.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { localize } from "../../../../../../nls.js";
import { ConfirmationOptionKind } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { AgentSandboxSettingId } from "../../../../../../platform/sandbox/common/settings.js";
import { TerminalCapability } from "../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { ITerminalLogService, TerminalExitReason } from "../../../../../../platform/terminal/common/terminal.js";
import { IRemoteAgentService } from "../../../../../services/remote/common/remoteAgentService.js";
import { TerminalToolConfirmationStorageKeys } from "../../../../chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolConfirmationSubPart.js";
import { IChatService, ChatRequestQueueKind, ElicitationState } from "../../../../chat/common/chatService/chatService.js";
import { autorun, constObservable } from "../../../../../../base/common/observable.js";
import { ChatModel } from "../../../../chat/common/model/chatModel.js";
import { ChatConfiguration, isAutoApproveLevel } from "../../../../chat/common/constants.js";
import { ILanguageModelToolsService, ToolDataSource, ToolInvocationPresentation } from "../../../../chat/common/tools/languageModelToolsService.js";
import { ITerminalChatService, ITerminalService } from "../../../../terminal/browser/terminal.js";
import { ITerminalProfileResolverService } from "../../../../terminal/common/terminal.js";
import { DEFAULT_IDLE_SILENCE_TIMEOUT_MS, TerminalChatAgentToolsSettingId } from "../../common/terminalChatAgentToolsConfiguration.js";
import { getRecommendedToolsOverRunInTerminal } from "../alternativeRecommendation.js";
import { BasicExecuteStrategy } from "../executeStrategy/basicExecuteStrategy.js";
import { NoneExecuteStrategy } from "../executeStrategy/noneExecuteStrategy.js";
import { RichExecuteStrategy } from "../executeStrategy/richExecuteStrategy.js";
import { getOutput } from "../outputHelpers.js";
import { LargeOutputFileWriter } from "../largeOutputFileWriter.js";
import { buildCommandDisplayText, extractCdPrefix, isFish, isPowerShell, isWindowsPowerShell, isZsh, normalizeTerminalCommandForDisplay } from "../runInTerminalHelpers.js";
import { NodeCommandLinePresenter } from "./commandLinePresenter/nodeCommandLinePresenter.js";
import { PythonCommandLinePresenter } from "./commandLinePresenter/pythonCommandLinePresenter.js";
import { RubyCommandLinePresenter } from "./commandLinePresenter/rubyCommandLinePresenter.js";
import { SandboxedCommandLinePresenter } from "./commandLinePresenter/sandboxedCommandLinePresenter.js";
import { RunInTerminalToolTelemetry } from "../runInTerminalToolTelemetry.js";
import { ShellIntegrationQuality, ToolTerminalCreator } from "../toolTerminalCreator.js";
import { TreeSitterCommandParser, TreeSitterCommandParserLanguage } from "../treeSitterCommandParser.js";
import { CommandLineAutoApproveAnalyzer } from "./commandLineAnalyzer/commandLineAutoApproveAnalyzer.js";
import { CommandLineFileWriteAnalyzer } from "./commandLineAnalyzer/commandLineFileWriteAnalyzer.js";
import { CommandLineSandboxAnalyzer } from "./commandLineAnalyzer/commandLineSandboxAnalyzer.js";
import { OutputMonitor } from "./monitoring/outputMonitor.js";
import { OutputMonitorState } from "./monitoring/types.js";
import { ChatQuestionCarouselData } from "../../../../chat/common/model/chatProgressTypes/chatQuestionCarouselData.js";
import { chatSessionResourceToId, LocalChatSessionUri } from "../../../../chat/common/model/chatUri.js";
import { TerminalToolId } from "./toolIds.js";
import { URI } from "../../../../../../base/common/uri.js";
import { CommandLineCdPrefixRewriter } from "./commandLineRewriter/commandLineCdPrefixRewriter.js";
import { CommandLinePreventHistoryRewriter } from "./commandLineRewriter/commandLinePreventHistoryRewriter.js";
import { CommandLinePwshChainOperatorRewriter } from "./commandLineRewriter/commandLinePwshChainOperatorRewriter.js";
import { CommandLineBackgroundDetachRewriter } from "./commandLineRewriter/commandLineBackgroundDetachRewriter.js";
import { CommandLineSandboxRewriter } from "./commandLineRewriter/commandLineSandboxRewriter.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IHistoryService } from "../../../../../services/history/common/history.js";
import { ILifecycleService } from "../../../../../services/lifecycle/common/lifecycle.js";
import { TerminalCommandArtifactCollector } from "./terminalCommandArtifactCollector.js";
import { isNumber, isString } from "../../../../../../base/common/types.js";
import { IChatWidgetService } from "../../../../chat/browser/chat.js";
import { TerminalChatCommandId } from "../../../chat/browser/terminalChat.js";
import { clamp } from "../../../../../../base/common/numbers.js";
import { SandboxOutputAnalyzer, outputLooksSandboxBlocked, outputLooksSandboxNetworkBlocked } from "./sandboxOutputAnalyzer.js";
import { IAgentSessionsService } from "../../../../chat/browser/agentSessions/agentSessionsService.js";
import { ITerminalSandboxService, TerminalSandboxPrerequisiteCheck } from "../../common/terminalSandboxService.js";
import { LanguageModelPartAudience } from "../../../../chat/common/languageModels.js";
import { isSessionAutoApproveLevel, isTerminalAutoApproveAllowed, isToolEligibleForTerminalAutoApproval } from "./terminalToolAutoApprove.js";
import { ChatElicitationRequestPart } from "../../../../chat/common/model/chatProgressTypes/chatElicitationRequestPart.js";
import { getSandboxPrecheckInputsForToolInvocation } from "../../../../chat/browser/tools/toolHelpers.js";
import { compact } from "./consoleCompactor/consoleCompactor.js";
const TERMINAL_SANDBOX_DOCUMENTATION_URL = "https://aka.ms/vscode-sandboxing";
const TOOL_REFERENCE_NAME = "runInTerminal";
const LEGACY_TOOL_REFERENCE_FULL_NAMES = ["runCommands/runInTerminal"];
const INPUT_NEEDED_NOTIFICATION_THROTTLE_MS = 5e3;
function createPowerShellModelDescription(shell, sandboxingOptions, includeElevationGuidance) {
  const isWinPwsh = isWindowsPowerShell(shell);
  const parts = [
    `This tool allows you to execute ${isWinPwsh ? "Windows PowerShell 5.1" : "PowerShell"} commands in a persistent terminal session, preserving environment variables, working directory, and other context across multiple commands.`,
    "",
    "Command Execution:",
    // IMPORTANT: PowerShell 5 does not support `&&` so always re-write them to `;`. Note that
    // the behavior of `&&` differs a little from `;` but in general it's fine
    isWinPwsh ? "- Use semicolons ; to chain commands on one line, NEVER use && even when asked explicitly" : "- Prefer ; when chaining commands on one line",
    "- Prefer pipelines | for object-based data flow",
    '- Never create a sub-shell (eg. powershell -c "command") unless explicitly asked',
    "",
    "Directory Management:",
    "- Prefer relative paths when navigating directories, only use absolute when the path is far away or the current cwd is not expected",
    "- By default (mode=sync), shell and cwd are reused by subsequent sync commands",
    "- Use $PWD or Get-Location for current directory",
    "- Use Push-Location/Pop-Location for directory stack",
    "",
    "Program Execution:",
    "- Supports .NET, Python, Node.js, and other executables",
    "- Install modules via Install-Module, Install-Package",
    "- Use Get-Command to verify cmdlet/function availability",
    "",
    "Execution Mode:",
    "- For ALL one-shot commands (builds, tests, installs, compilation, linting, downloads, scripts), use mode=sync and omit timeout. The tool waits for the command to complete and returns full output inline. This is the default and strongly preferred mode.",
    `- Use mode=async ONLY for processes that must keep running indefinitely while you do other work (servers, watchers, dev daemons). Async waits for an initial idle/output signal, then returns a terminal ID and output snapshot while the process continues running.`,
    `- In sync mode, the full output is returned when the command completes \u2014 you do NOT need to call ${TerminalToolId.GetTerminalOutput} afterward. Only use ${TerminalToolId.GetTerminalOutput} if the tool result explicitly says the command was moved to background, timed out, or needs input.`,
    "- Returns a terminal ID for checking status and runtime later",
    "- Use Start-Job for background PowerShell jobs",
    "",
    `Use ${TerminalToolId.SendToTerminal} to send commands or input to a terminal session.`
  ];
  if (sandboxingOptions.sandboxMode !== "off") {
    parts.push(...createSandboxLines(sandboxingOptions));
  }
  parts.push(
    "",
    "Output Management:",
    "- Output exceeding 20KB is saved to a temp file; the result includes the file path so you can read the full output with readFile or search it with grep",
    "- Use Select-Object, Where-Object, Format-Table to filter output",
    "- Use -First/-Last parameters to limit results",
    "- For pager commands, add | Out-String or | Format-List",
    "",
    "Best Practices:",
    "- Use proper cmdlet names instead of aliases in scripts",
    '- Quote paths with spaces: "C:\\Path With Spaces"',
    "- Prefer PowerShell cmdlets over external commands when available",
    "- Prefer idiomatic PowerShell like Get-ChildItem instead of dir or ls for file listings",
    "- Use Test-Path to check file/directory existence",
    "- Be specific with Select-Object properties to avoid excessive output",
    "- Avoid printing credentials unless absolutely required",
    ...includeElevationGuidance ? [
      "- Avoid commands that trigger an interactive elevation prompt, such as Start-Process -Verb RunAs or runas.exe. They block on a UAC/password prompt that cannot be answered in this mode, and secrets must never be routed through the model. If elevated privileges are required, tell the user to run the command themselves and stop \u2014 do NOT retry the command with variations."
    ] : [],
    `- NEVER run Start-Sleep or similar wait commands. You will be automatically notified on your next turn when async terminal commands or timed-out sync commands complete or need input. Do NOT poll for completion.`,
    "- NEVER pipe interactive commands through Select-Object, Where-Object, or other filters \u2014 this hides prompts and prevents the terminal from detecting when input is needed. Run interactive commands without pipes.",
    "",
    "Interactive Input Handling:",
    "- When a terminal command is waiting for interactive input, do NOT suggest alternatives or ask the user whether to proceed. Instead, use the vscode_askQuestions tool to collect the needed values from the user, then send them.",
    `- NEVER use vscode_askQuestions to request sensitive input such as passwords, passphrases, API keys, tokens, or other secrets \u2014 answers to that tool are sent through the model. If the prompt requires a secret, tell the user to type it directly into the terminal and stop; do not call vscode_askQuestions or ${TerminalToolId.SendToTerminal} for that prompt.`,
    `- Send exactly one answer per prompt using ${TerminalToolId.SendToTerminal}. Never send multiple answers in a single send.`,
    `- After each send, call ${TerminalToolId.GetTerminalOutput} to read the next prompt before sending the next answer.`,
    "- Continue one prompt at a time until the command finishes."
  );
  return parts.join("\n");
}
function createSandboxLines(sandboxingOptions) {
  const isNetworkAvailable = sandboxingOptions.sandboxMode === "on-network-available";
  const lines = [
    "",
    "Sandboxing:",
    isNetworkAvailable ? "- Commands run inside a sandbox by default. The sandbox keeps the filesystem mostly read-only." : "- Commands run inside a sandbox by default. The sandbox restricts two things independently: the filesystem and the network.",
    "- Filesystem: read-only outside the workspace and $TMPDIR, which stay read-write. Parts of $HOME are hidden for privacy, but common developer tools (git, package managers, language toolchains) still work because their $HOME config and cache paths are automatically made readable.",
    "- Use $TMPDIR for temporary files; /tmp may not be writable. On macOS and Linux the TMPDIR env var is set to a writable path.",
    "- If a command needs sandboxed write access to specific file paths outside workspace, pass requestFileValidationCheck with those paths. VS Code checks sandbox access before execution and returns Access Denied without running the command when access is unavailable."
  ];
  if (!isNetworkAvailable) {
    const deniedDomains = sandboxingOptions.networkDomains?.deniedDomains ?? [];
    const allowedDomains = sandboxingOptions.networkDomains?.allowedDomains ?? [];
    const deniedSet = new Set(deniedDomains);
    const effectiveAllowed = allowedDomains.filter((d) => !deniedSet.has(d));
    const retrySuffix = sandboxingOptions.retryWithAllowNetworkRequests ? " unless requestAllowNetwork=true is set" : "";
    if (effectiveAllowed.length === 0) {
      lines.push(`- Network: blocked in the sandbox; commands that need the network fail${retrySuffix}.`);
    } else {
      lines.push(`- Network: only these domains are reachable in the sandbox: ${effectiveAllowed.join(", ")}. Other domains fail${retrySuffix}.`);
    }
    if (deniedDomains.length > 0) {
      lines.push(`- These domains are explicitly blocked in the sandbox: ${deniedDomains.join(", ")}`);
    }
  }
  if (sandboxingOptions.retryWithAllowNetworkRequests || sandboxingOptions.allowToRunUnsandboxedCommands) {
    lines.push("- To get more access (each prompts the user \u2014 never ask the user for permission yourself):");
    if (sandboxingOptions.retryWithAllowNetworkRequests) {
      lines.push(
        "  - Need a blocked domain? Set requestAllowNetwork=true and provide requestAllowNetworkReason. This keeps the filesystem sandbox in place and only relaxes the network, so prefer it for network-only needs. Do this proactively when network use is obvious (git fetch/pull/push/clone; npm/yarn/pnpm/pip/cargo/go/brew installs; curl; wget), or reactively after a network failure (e.g. 'Network request failed', HTTP code 403)."
      );
    }
    if (sandboxingOptions.allowToRunUnsandboxedCommands) {
      const removesAllClause = sandboxingOptions.retryWithAllowNetworkRequests ? "This grants full filesystem AND network access by removing all sandbox protection, so for network-only needs prefer requestAllowNetwork and use this only when filesystem (or other non-network) access is also blocked." : "This grants full filesystem and network access by removing all sandbox protection, so use it only when the command truly needs it.";
      lines.push(
        `  - Need filesystem or other access the sandbox blocks? Set requestUnsandboxedExecution=true and provide requestUnsandboxedExecutionReason. ${removesAllClause} Do this proactively when it clearly needs it (writing/deleting files outside the workspace and $TMPDIR like $HOME, /usr, /etc; installing to system locations; elevated privileges), or reactively after a sandbox failure (e.g. 'Operation not permitted').`
      );
    }
  }
  if (!sandboxingOptions.allowToRunUnsandboxedCommands) {
    lines.push("- Running commands outside the sandbox is disabled by chat.agent.sandbox.allowUnsandboxedCommands. Do not set requestUnsandboxedExecution=true.");
  }
  return lines;
}
function createSandboxProperties(sandboxingOptions) {
  const isNetworkAvailable = sandboxingOptions.sandboxMode === "on-network-available";
  return {
    ...sandboxingOptions.allowToRunUnsandboxedCommands ? {
      requestUnsandboxedExecution: {
        type: "boolean",
        description: "Request that this command run outside the terminal sandbox. Only set this when the command clearly needs unsandboxed access. The user will be prompted before the command runs unsandboxed."
      },
      requestUnsandboxedExecutionReason: {
        type: "string",
        description: "A short explanation of why this command must run outside the terminal sandbox. Only provide this when requestUnsandboxedExecution is true."
      }
    } : {},
    ...isNetworkAvailable || !sandboxingOptions.retryWithAllowNetworkRequests ? {} : {
      requestAllowNetwork: {
        type: "boolean",
        description: "Request that this command remain in the terminal sandbox but run with unrestricted network access. Only set this when the command clearly needs network access but the required network access was blocked. The user will be prompted before network restrictions are relaxed."
      },
      requestAllowNetworkReason: {
        type: "string",
        description: "A short explanation of why this sandboxed command needs unrestricted network access. Only provide this when requestAllowNetwork is true."
      }
    },
    requestFileValidationCheck: {
      type: "array",
      description: "Sandbox write access checks to perform before running the command. Provide the file paths that the command needs to write.",
      items: {
        type: "string"
      }
    },
    requestFileValidationCheckReason: {
      type: "string",
      description: "A short explanation of why this sandboxed command needs these file paths. Only provide this when requestFileValidationCheck is not empty."
    }
  };
}
function createGenericDescription(sandboxingOptions, includeElevationGuidance) {
  const parts = [`
Command Execution:
- Use && to chain simple commands on one line
- Prefer pipelines | over temporary files for data flow
- Never create a sub-shell (eg. bash -c "command") unless explicitly asked

Directory Management:
- Prefer relative paths when navigating directories, only use absolute when the path is far away or the current cwd is not expected
- By default (mode=sync), shell and cwd are reused by subsequent sync commands
- Use $PWD for current directory references
- Consider using pushd/popd for directory stack management
- Supports directory shortcuts like ~ and -

Program Execution:
- Supports Python, Node.js, and other executables
- Install packages via package managers (brew, apt, etc.)
- Use which or command -v to verify command availability

Execution Mode:
- For ALL one-shot commands (builds, tests, installs, compilation, linting, downloads, scripts), use mode='sync' and omit timeout. The tool waits for the command to complete and returns full output inline. This is the default and strongly preferred mode.
- Use mode='async' ONLY for processes that must keep running indefinitely while you do other work (servers, watchers, dev daemons). Async waits for an initial idle/output signal, then returns a terminal ID and output snapshot while the process continues running.
- In sync mode, the full output is returned when the command completes \u2014 you do NOT need to call ${TerminalToolId.GetTerminalOutput} afterward. Only use ${TerminalToolId.GetTerminalOutput} if the tool result explicitly says the command was moved to background, timed out, or needs input.

Use ${TerminalToolId.SendToTerminal} to send commands or input to a terminal session.`];
  if (sandboxingOptions.sandboxMode !== "off") {
    parts.push(createSandboxLines(sandboxingOptions).join("\n"));
  }
  parts.push(`

Output Management:
- Output exceeding 20KB is saved to a temp file; the result includes the file path so you can read the full output with readFile or search it with grep
- Use head, tail, grep, awk to filter and limit output size
- For pager commands, disable paging: git --no-pager or add | cat
- Use wc -l to count lines before displaying large outputs

Best Practices:
- Quote variables: "$var" instead of $var to handle spaces
- Use find with -exec or xargs for file operations
- Be specific with commands to avoid excessive output
- Avoid printing credentials unless absolutely required
${includeElevationGuidance ? "- Avoid commands that require interactive privilege escalation, such as sudo/su/doas without a non-interactive flag (e.g. sudo -n). They block on a password prompt that cannot be answered in this mode, and secrets must never be routed through the model. If a command needs elevated privileges, tell the user to run it themselves in the terminal and stop \u2014 do NOT retry the command with variations.\n" : ""}- NEVER run sleep or similar wait commands in a terminal. You will be automatically notified on your next turn when async terminal commands or timed-out sync commands complete or need input. Do NOT poll for completion.
- NEVER pipe interactive commands through tail, head, grep, or other filters \u2014 this hides prompts and prevents the terminal from detecting when input is needed. Run interactive commands without pipes.

Interactive Input Handling:
- When a terminal command is waiting for interactive input, do NOT suggest alternatives or ask the user whether to proceed. Instead, use the vscode_askQuestions tool to collect the needed values from the user, then send them.
- NEVER use vscode_askQuestions to request sensitive input such as passwords, passphrases, API keys, tokens, or other secrets \u2014 answers to that tool are sent through the model. If the prompt requires a secret, tell the user to type it directly into the terminal and stop; do not call vscode_askQuestions or send_to_terminal for that prompt.
- Send exactly one answer per prompt using ${TerminalToolId.SendToTerminal}. Never send multiple answers in a single send.
- After each send, call ${TerminalToolId.GetTerminalOutput} to read the next prompt before sending the next answer.
- Continue one prompt at a time until the command finishes.`);
  return parts.join("");
}
function createBashModelDescription(sandboxingOptions, includeElevationGuidance) {
  return [
    "This tool allows you to execute shell commands in a persistent bash terminal session, preserving environment variables, working directory, and other context across multiple commands.",
    createGenericDescription(sandboxingOptions, includeElevationGuidance),
    "- Use [[ ]] for conditional tests instead of [ ]",
    "- Prefer $() over backticks for command substitution"
  ].join("\n");
}
function createZshModelDescription(sandboxingOptions, includeElevationGuidance) {
  return [
    "This tool allows you to execute shell commands in a persistent zsh terminal session, preserving environment variables, working directory, and other context across multiple commands.",
    createGenericDescription(sandboxingOptions, includeElevationGuidance),
    "- Use type to check command type (builtin, function, alias)",
    "- Use jobs, fg, bg for job control",
    "- Use [[ ]] for conditional tests instead of [ ]",
    "- Prefer $() over backticks for command substitution",
    "- Take advantage of zsh globbing features (**, extended globs). Note: unmatched globs fail by default (zsh: no matches found) \u2014 use a glob qualifier like *(N) or quote the glob if it should be literal",
    "",
    "zsh pitfalls \u2014 these WILL cause errors or hangs:",
    "- NEVER use bare == or === as separators (e.g. echo === triggers zsh equals expansion). Quote them: echo '==='",
    "- NEVER use status as a variable name (it is read-only in zsh). Use exit_code or ret instead"
  ].join("\n");
}
function createFishModelDescription(sandboxingOptions, includeElevationGuidance) {
  return [
    "This tool allows you to execute shell commands in a persistent fish terminal session, preserving environment variables, working directory, and other context across multiple commands.",
    createGenericDescription(sandboxingOptions, includeElevationGuidance),
    "- Use type to check command type (builtin, function, alias)",
    "- Use jobs, fg, bg for job control",
    "- Use test expressions for conditionals (no [[ ]] syntax)",
    "- Prefer command substitution with () syntax",
    "- Variables are arrays by default, use $var[1] for first element",
    "- Take advantage of fish's autosuggestions and completions"
  ].join("\n");
}
async function createRunInTerminalToolData(accessor) {
  const instantiationService = accessor.get(IInstantiationService);
  const terminalSandboxService = accessor.get(ITerminalSandboxService);
  const configurationService = accessor.get(IConfigurationService);
  const allowToRunUnsandboxedCommands = configurationService.getValue(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands) === true;
  const retryWithAllowNetworkRequestsSetting = configurationService.getValue(AgentSandboxSettingId.AgentSandboxRetryWithAllowNetworkRequests) === true;
  const defaultPermissionLevel = configurationService.getValue(ChatConfiguration.DefaultPermissionLevel);
  const includeElevationGuidance = configurationService.getValue(TerminalChatAgentToolsSettingId.EnableAutoApprove) === true || configurationService.getValue(ChatConfiguration.GlobalAutoApprove) === true || isAutoApproveLevel(defaultPermissionLevel);
  const profileFetcher = instantiationService.createInstance(TerminalProfileFetcher);
  const [shell, os, isSandboxEnabled, isSandboxAllowNetworkEnabled] = await Promise.all([
    profileFetcher.getCopilotShell(),
    profileFetcher.osBackend,
    terminalSandboxService.isEnabled(),
    terminalSandboxService.isSandboxAllowNetworkEnabled()
  ]);
  const sandboxingOptions = isSandboxEnabled ? isSandboxAllowNetworkEnabled ? {
    sandboxMode: "on-network-available",
    allowToRunUnsandboxedCommands,
    retryWithAllowNetworkRequests: false,
    networkDomains: void 0
  } : {
    sandboxMode: "on-network-restricted",
    allowToRunUnsandboxedCommands,
    retryWithAllowNetworkRequests: retryWithAllowNetworkRequestsSetting,
    networkDomains: terminalSandboxService.getResolvedNetworkDomains()
  } : {
    sandboxMode: "off"
  };
  let modelDescription;
  if (shell && os && isPowerShell(shell, os)) {
    modelDescription = createPowerShellModelDescription(shell, sandboxingOptions, includeElevationGuidance);
  } else if (shell && os && isZsh(shell, os)) {
    modelDescription = createZshModelDescription(sandboxingOptions, includeElevationGuidance);
  } else if (shell && os && isFish(shell, os)) {
    modelDescription = createFishModelDescription(sandboxingOptions, includeElevationGuidance);
  } else {
    modelDescription = createBashModelDescription(sandboxingOptions, includeElevationGuidance);
  }
  const sharedProperties = {
    command: {
      type: "string",
      description: "The command to run in the terminal."
    },
    explanation: {
      type: "string",
      description: "A one-sentence description of what the command does. This will be shown to the user before the command is run."
    },
    goal: {
      type: "string",
      description: 'A short description of the goal or purpose of the command (e.g., "Install dependencies", "Start development server").'
    }
  };
  const sandboxProperties = sandboxingOptions.sandboxMode === "off" ? {} : createSandboxProperties(sandboxingOptions);
  return {
    id: TerminalToolId.RunInTerminal,
    toolReferenceName: TOOL_REFERENCE_NAME,
    legacyToolReferenceFullNames: LEGACY_TOOL_REFERENCE_FULL_NAMES,
    displayName: localize("runInTerminalTool.displayName", "Run in Terminal"),
    modelDescription: `${modelDescription}

Execution mode:
- mode='sync' (strongly preferred): waits for the command to complete and returns full output inline. Use for ALL one-shot commands (builds, tests, installs, compilation, scripts). Omit timeout to let the command run to completion \u2014 the tool handles idle detection and input prompts automatically.
- mode='async': waits for an initial idle/output signal from the command, then returns a terminal ID and output snapshot while the process continues running. Use ONLY for processes that must keep running indefinitely (servers, watchers, daemons). Timeout caps how long to wait for the initial idle/output signal.

Timeout parameter: Usually omit timeout entirely for sync commands \u2014 the tool returns automatically on completion, input-needed, or cancellation. Only set a timeout as a safety net for commands you suspect might hang. Use 0 to explicitly indicate no timeout.

Sync output is final: When a sync command completes, the full output is returned inline \u2014 do NOT call ${TerminalToolId.GetTerminalOutput} afterward. Only use ${TerminalToolId.GetTerminalOutput} if the tool result explicitly indicates the command was moved to background, timed out, or needs input. Do NOT tell the user to check the terminal panel \u2014 all command output is already included in the tool result.

Terminal notifications: When an async command finishes or a sync command times out, you will be automatically notified on your next turn with the exit code and terminal output. You will also be notified if the terminal needs input. Do NOT poll or sleep to wait for completion.`,
    userDescription: localize("runInTerminalTool.userDescription", "Run commands in the terminal"),
    source: ToolDataSource.Internal,
    icon: Codicon.terminal,
    inputSchema: {
      type: "object",
      properties: {
        ...sharedProperties,
        ...sandboxProperties,
        mode: {
          type: "string",
          enum: ["sync", "async"],
          enumDescriptions: [
            "Wait for command completion and return full output inline. Strongly preferred for all one-shot commands (builds, tests, installs, scripts).",
            "Wait for an initial idle/output signal, then return a terminal ID and output snapshot while the process continues running. Timeout caps how long to wait for the initial signal. Use ONLY for processes that must keep running indefinitely (servers, watchers, daemons)."
          ],
          description: "Execution mode for this command. Use sync (default) for nearly all commands."
        },
        isBackground: {
          type: "boolean",
          description: 'Legacy execution mode flag. Deprecated in favor of "mode". If true, equivalent to mode=async. If false, equivalent to mode=sync.'
        },
        timeout: {
          type: "number",
          description: "Optional. Usually omit entirely for sync commands \u2014 the tool waits for completion automatically. Only set a timeout (in milliseconds) as a safety net if you suspect the command might hang. If the timeout elapses, the command continues in the background and you get a terminal ID to check output later. Use 0 to explicitly indicate no timeout."
        }
      },
      required: ["command", "explanation", "goal", "mode"]
    }
  };
}
var TerminalToolStorageKeysInternal = /* @__PURE__ */ ((TerminalToolStorageKeysInternal2) => {
  TerminalToolStorageKeysInternal2["TerminalSession"] = "chat.terminalSessions";
  return TerminalToolStorageKeysInternal2;
})(TerminalToolStorageKeysInternal || {});
function shouldAutomaticallyRetrySandbox(options) {
  return options.retryAllowed && options.didSandboxWrapCommand && options.retryAlreadyRequested !== true && !options.isPersistentSession && !options.isBackgroundExecution && !options.didTimeout && options.exitCode !== 0 && options.outputLooksRetryable(options.output);
}
function shouldAutomaticallyRetryUnsandboxed(options) {
  return shouldAutomaticallyRetrySandbox({
    retryAllowed: options.allowUnsandboxedCommands,
    retryAlreadyRequested: options.requestUnsandboxedExecution,
    didSandboxWrapCommand: options.didSandboxWrapCommand,
    isPersistentSession: options.isPersistentSession,
    isBackgroundExecution: options.isBackgroundExecution,
    didTimeout: options.didTimeout,
    exitCode: options.exitCode,
    output: options.output,
    // Network failures are handled by shouldAutomaticallyRetryAllowNetworkInSandboxed; do not automatically leave the sandbox for them.
    outputLooksRetryable: (output) => outputLooksSandboxBlocked(output) && !outputLooksSandboxNetworkBlocked(output)
  });
}
function shouldAutomaticallyRetryAllowNetworkInSandboxed(options) {
  return shouldAutomaticallyRetrySandbox({
    retryAllowed: options.retryWithAllowNetworkRequests,
    retryAlreadyRequested: options.requestUnsandboxedExecution || options.requestAllowNetwork,
    didSandboxWrapCommand: options.didSandboxWrapCommand,
    isPersistentSession: options.isPersistentSession,
    isBackgroundExecution: options.isBackgroundExecution,
    didTimeout: options.didTimeout,
    exitCode: options.exitCode,
    output: options.output,
    outputLooksRetryable: outputLooksSandboxNetworkBlocked
  });
}
function outputLooksBubblewrapHostRestricted(output) {
  return /bwrap:\s*No permissions to create new namespace/i.test(output.replace(/\s+/g, " "));
}
const telemetryIgnoredSequences = [
  "\x1B[I",
  // Focus in
  "\x1B[O"
  // Focus out
];
const altBufferMessage = "\n" + localize("runInTerminalTool.altBufferMessage", "The command opened the alternate buffer.");
function buildCompletionNotificationCommand(command) {
  const firstNewline = command.search(/\r|\n/);
  const hasMoreLines = firstNewline !== -1;
  const firstLine = hasMoreLines ? command.substring(0, firstNewline) : command;
  const normalized = normalizeTerminalCommandForDisplay(firstLine);
  if (normalized.length > 80) {
    return normalized.substring(0, 79) + "\u2026";
  }
  return hasMoreLines ? normalized + "\u2026" : normalized;
}
let RunInTerminalTool = class extends Disposable {
  constructor(_chatService, _configurationService, _fileService, _historyService, _instantiationService, _labelService, _languageModelToolsService, _remoteAgentService, _storageService, _terminalChatService, _logService, _terminalService, _terminalSandboxService, _workspaceContextService, _chatWidgetService, _agentSessionsService, lifecycleService) {
    super();
    this._chatService = _chatService;
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._historyService = _historyService;
    this._instantiationService = _instantiationService;
    this._labelService = _labelService;
    this._languageModelToolsService = _languageModelToolsService;
    this._remoteAgentService = _remoteAgentService;
    this._storageService = _storageService;
    this._terminalChatService = _terminalChatService;
    this._logService = _logService;
    this._terminalService = _terminalService;
    this._terminalSandboxService = _terminalSandboxService;
    this._workspaceContextService = _workspaceContextService;
    this._chatWidgetService = _chatWidgetService;
    this._agentSessionsService = _agentSessionsService;
    this._archivedSessionListener = this._register(new MutableDisposable());
    this._sessionTerminalAssociations = new ResourceMap();
    this._sessionTerminalInstances = new ResourceMap();
    this._terminalsBeingDisposedBySessionCleanup = /* @__PURE__ */ new Set();
    /**
     * Tracks active background completion notifications per terminal instance ID.
     * When a new notification is registered for a terminal that already has one,
     * the previous notification (and its OutputMonitor) is disposed first to
     * prevent listener accumulation on the terminal's onDidInputData emitter.
     *
     * Keyed by `ITerminalInstance.instanceId` (stable per terminal) rather than
     * the per-invocation `termId` so that reusing the same foreground terminal
     * after an `inputNeeded` race disposes the prior OutputMonitor.
     */
    this._backgroundNotifications = this._register(new DisposableMap());
    /**
     * Set when VS Code is shutting down. Suppresses "terminal exited"
     * notifications that would otherwise be generated when background
     * terminals are disposed during shutdown and then persist as
     * undeliverable steering messages after restart.
     */
    this._isShuttingDown = false;
    /**
     * Per-instance disposables that unregister `_activeExecutions` entries from the
     * `ITerminalChatService` execution-id map. Keyed by the same `termId` as `_activeExecutions`
     * so registrations and active executions share a lifecycle.
     */
    this._executionRegistrations = this._register(new DisposableMap());
    this._register(lifecycleService.onWillShutdown(() => {
      this._isShuttingDown = true;
    }));
    this._osBackend = this._remoteAgentService.getEnvironment().then((remoteEnv) => remoteEnv?.os ?? OS);
    this._terminalToolCreator = this._instantiationService.createInstance(ToolTerminalCreator);
    this._treeSitterCommandParser = this._register(this._instantiationService.createInstance(TreeSitterCommandParser));
    this._telemetry = this._instantiationService.createInstance(RunInTerminalToolTelemetry);
    this._commandArtifactCollector = this._instantiationService.createInstance(TerminalCommandArtifactCollector);
    this._profileFetcher = this._instantiationService.createInstance(TerminalProfileFetcher);
    this._largeOutputFileWriter = this._register(this._instantiationService.createInstance(LargeOutputFileWriter));
    this._commandLineRewriters = [
      this._register(this._instantiationService.createInstance(CommandLineCdPrefixRewriter)),
      this._register(this._instantiationService.createInstance(CommandLinePwshChainOperatorRewriter, this._treeSitterCommandParser))
    ];
    if (this._enableCommandLineSandboxRewriting) {
      this._commandLineRewriters.push(this._register(this._instantiationService.createInstance(CommandLineSandboxRewriter, this._treeSitterCommandParser)));
    }
    this._commandLineRewriters.push(this._register(this._instantiationService.createInstance(CommandLineBackgroundDetachRewriter)));
    this._commandLineRewriters.push(this._register(this._instantiationService.createInstance(CommandLinePreventHistoryRewriter)));
    this._commandLineAnalyzers = [
      this._register(this._instantiationService.createInstance(CommandLineFileWriteAnalyzer, this._treeSitterCommandParser, (message, args) => this._logService.info(`RunInTerminalTool#CommandLineFileWriteAnalyzer: ${message}`, args))),
      this._register(this._instantiationService.createInstance(CommandLineAutoApproveAnalyzer, this._treeSitterCommandParser, this._telemetry, (message, args) => this._logService.info(`RunInTerminalTool#CommandLineAutoApproveAnalyzer: ${message}`, args)))
    ];
    if (this._enableCommandLineSandboxRewriting) {
      this._commandLineAnalyzers.push(this._register(this._instantiationService.createInstance(CommandLineSandboxAnalyzer)));
    }
    this._commandLinePresenters = [
      this._instantiationService.createInstance(SandboxedCommandLinePresenter),
      new NodeCommandLinePresenter(),
      new PythonCommandLinePresenter(),
      new RubyCommandLinePresenter()
    ];
    this._outputAnalyzers = [
      this._register(this._instantiationService.createInstance(SandboxOutputAnalyzer))
    ];
    this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(TerminalChatAgentToolsSettingId.EnableAutoApprove)) {
        if (this._configurationService.getValue(TerminalChatAgentToolsSettingId.EnableAutoApprove) !== true) {
          this._storageService.remove(TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted, StorageScope.APPLICATION);
        }
      }
    }));
    this._restoreTerminalAssociations();
    this._register(this._terminalService.onDidDisposeInstance((e) => {
      this._removeTerminalAssociations(e);
    }));
    this._register(this._chatService.onDidDisposeSession((e) => {
      for (const resource of e.sessionResources) {
        this._cleanupSessionTerminals(resource);
      }
      this._largeOutputFileWriter.cleanup();
    }));
  }
  static {
    this._activeExecutions = /* @__PURE__ */ new Map();
  }
  _setActiveExecution(termId, execution) {
    RunInTerminalTool._activeExecutions.set(termId, execution);
    this._executionRegistrations.set(termId, this._terminalChatService.registerTerminalInstanceWithExecutionId(termId, execution.instance));
  }
  _deleteActiveExecution(termId) {
    this._executionRegistrations.deleteAndDispose(termId);
    return RunInTerminalTool._activeExecutions.delete(termId);
  }
  static {
    /**
     * Terminal IDs being programmatically disposed (by `kill_terminal` or
     * automatic background-terminal cleanup). Used to suppress the redundant
     * "terminal exited" steering message in `_registerCompletionNotification`'s
     * `onDisposed` handler.
     */
    this._killedByTool = /* @__PURE__ */ new Set();
  }
  static getBackgroundOutput(id) {
    const execution = RunInTerminalTool._activeExecutions.get(id);
    if (!execution) {
      throw new Error("Invalid terminal ID");
    }
    return execution.getOutput();
  }
  /**
   * Gets an active terminal execution by ID. Returns undefined if not found.
   * Can be used to await the completion of a background terminal command.
   */
  static getExecution(id) {
    return RunInTerminalTool._activeExecutions.get(id);
  }
  /**
   * Removes an active terminal execution by ID and disposes it.
   * @returns true if the execution was found and removed, false otherwise.
   */
  static removeExecution(id) {
    const execution = RunInTerminalTool._activeExecutions.get(id);
    if (!execution) {
      return false;
    }
    execution.dispose();
    RunInTerminalTool._activeExecutions.delete(id);
    return true;
  }
  /**
   * Marks a terminal ID as being killed by the `kill_terminal` tool so that
   * the `onDisposed` handler in `_registerCompletionNotification` skips the
   * redundant steering message.
   */
  static markKilledByTool(id) {
    RunInTerminalTool._killedByTool.add(id);
  }
  _resolveExecutionOptions(args) {
    const mode = args.mode ?? (args.isBackground ? "async" : "sync");
    switch (mode) {
      case "async":
        return { mode: "async", persistentSession: true, waitStrategy: "idle" };
      case "sync":
      default:
        return { mode: "sync", persistentSession: false, waitStrategy: "completion" };
    }
  }
  get _allowUnsandboxedCommands() {
    return this._configurationService.getValue(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands) === true;
  }
  get _retryWithAllowNetworkRequests() {
    return this._configurationService.getValue(AgentSandboxSettingId.AgentSandboxRetryWithAllowNetworkRequests) === true;
  }
  get _allowSandboxAutoApprove() {
    return this._configurationService.getValue(AgentSandboxSettingId.AgentSandboxAllowAutoApprove) === true;
  }
  _getAllowToRunUnsandboxedCommands(args) {
    return (args.allowToRunUnsandboxedCommands ?? this._allowUnsandboxedCommands) === true && this._allowUnsandboxedCommands;
  }
  _shouldRejectUnsandboxedExecutionRequest(isSandboxEnabled, allowUnsandboxedCommands, args) {
    return isSandboxEnabled && args.requestUnsandboxedExecution === true && !allowUnsandboxedCommands;
  }
  _shouldRejectAllowNetworkRequest(isSandboxEnabled, isSandboxAllowNetworkEnabled, args) {
    return isSandboxEnabled && !isSandboxAllowNetworkEnabled && args.requestAllowNetwork === true && !this._retryWithAllowNetworkRequests;
  }
  _getUnsandboxedExecutionDisabledMessage() {
    return localize(
      "runInTerminal.unsandboxed.disabled.result",
      "The command was not executed because it requested to run outside the terminal sandbox, but running commands outside the sandbox is disabled by chat.agent.sandbox.allowUnsandboxedCommands. Run the command in the sandbox instead, or enable the setting to allow unsandboxed execution."
    );
  }
  _getAllowNetworkRequestDisabledMessage() {
    return localize(
      "runInTerminal.allowNetwork.disabled.result",
      "The command was not executed because it requested unrestricted network access in the terminal sandbox, but per-command network access is disabled by chat.agent.sandbox.retryWithAllowNetworkRequests. Run the command with restricted network access instead, or enable the setting to allow network access requests."
    );
  }
  async _getDeniedSandboxFileAccess(paths, sandboxPrecheckInputs) {
    if (!paths?.length) {
      return [];
    }
    const result = await this._terminalSandboxService.checkFileAccess("write", paths, sandboxPrecheckInputs);
    return result.denied;
  }
  _buildSandboxFileAccessDeniedMessage(deniedPaths) {
    const deniedPathsMessage = deniedPaths.map((path) => `write: ${path}`).join("\n");
    return localize(
      "runInTerminal.sandbox.fileAccessDenied",
      "Access Denied: The command was not executed because the terminal sandbox does not allow access to the requested file paths:\n{0}",
      deniedPathsMessage
    );
  }
  /**
   * Controls whether this tool wires up sandbox-specific command-line
   * behavior, including both the {@link CommandLineSandboxRewriter} and the
   * {@link CommandLineSandboxAnalyzer}. This is separate from
   * ITerminalSandboxService.isEnabled(), which reports the current terminal
   * sandboxing enablement for the running window.
   */
  get _enableCommandLineSandboxRewriting() {
    return true;
  }
  async handleToolStream(context, _token) {
    const partialInput = context.rawInput;
    if (partialInput && typeof partialInput === "object" && partialInput.command) {
      const truncatedCommand = buildCommandDisplayText(partialInput.command);
      const invocationMessage = new MarkdownString(localize("runInTerminal.streaming", "Running `{0}`", escapeMarkdownSyntaxTokens(truncatedCommand)));
      return { invocationMessage };
    }
    return { invocationMessage: localize("runInTerminal.streaming.default", "Running command") };
  }
  async prepareToolInvocation(context, token) {
    const args = context.parameters;
    const executionOptions = this._resolveExecutionOptions(args);
    const chatSessionResource = context.chatSessionResource;
    const sandboxPrecheckInputs = this._getSandboxPrecheckInputs(chatSessionResource, context.chatRequestId);
    let instance;
    if (chatSessionResource) {
      const toolTerminal = this._sessionTerminalAssociations.get(chatSessionResource);
      if (toolTerminal && !toolTerminal.isBackground) {
        instance = toolTerminal.instance;
      }
    }
    const [os, shell, cwd, sandboxPrereqs] = await Promise.all([
      this._osBackend,
      this._profileFetcher.getCopilotShell(),
      (async () => {
        let cwd2 = await instance?.getCwdResource();
        if (!cwd2) {
          const sessionModel = chatSessionResource ? this._chatService.getSession(chatSessionResource) : void 0;
          if (sessionModel?.workingDirectory) {
            cwd2 = sessionModel.workingDirectory;
          } else {
            const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
            const workspaceFolder = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
            cwd2 = workspaceFolder?.uri;
          }
        }
        return cwd2;
      })(),
      this._terminalSandboxService.checkForSandboxingPrereqs(false, sandboxPrecheckInputs)
    ]);
    const language = os === OperatingSystem.Windows ? "pwsh" : "sh";
    const isSandboxEnabled = sandboxPrereqs.enabled;
    const isSandboxAllowNetworkEnabled = isSandboxEnabled && await this._terminalSandboxService.isSandboxAllowNetworkEnabled();
    const allowUnsandboxedCommands = this._getAllowToRunUnsandboxedCommands(args);
    const explicitUnsandboxRequest = isSandboxEnabled && allowUnsandboxedCommands && args.requestUnsandboxedExecution === true;
    const explicitAllowNetworkRequest = isSandboxEnabled && !isSandboxAllowNetworkEnabled && this._retryWithAllowNetworkRequests && !explicitUnsandboxRequest && args.requestAllowNetwork === true;
    let requiresUnsandboxConfirmation = explicitUnsandboxRequest;
    let requestUnsandboxedExecutionReason = explicitUnsandboxRequest ? args.requestUnsandboxedExecutionReason : void 0;
    let requiresAllowNetworkConfirmation = explicitAllowNetworkRequest;
    let requestAllowNetworkReason = explicitAllowNetworkRequest ? args.requestAllowNetworkReason : void 0;
    const missingDependencies = sandboxPrereqs.failedCheck === TerminalSandboxPrerequisiteCheck.Dependencies && sandboxPrereqs.missingDependencies?.length ? sandboxPrereqs.missingDependencies : void 0;
    const canInstallMissingDependencies = !!missingDependencies && sandboxPrereqs.canInstallMissingDependencies === true;
    const sandboxRemediations = sandboxPrereqs.failedCheck === TerminalSandboxPrerequisiteCheck.Bubblewrap && sandboxPrereqs.remediations?.length ? [...sandboxPrereqs.remediations] : void 0;
    const sandboxPrerequisiteFailure = sandboxPrereqs.failedCheck === TerminalSandboxPrerequisiteCheck.Bubblewrap && !sandboxRemediations ? localize("runInTerminal.bubblewrap.unusable", "Bubblewrap is installed but cannot create the required sandbox namespace on this system. The command was not executed.") : missingDependencies && !canInstallMissingDependencies ? localize("runInTerminal.missingDeps.unsupportedInstaller", "The following dependencies required for sandboxed execution are not installed: {0}. Install them using your system package manager, then run the command again.", missingDependencies.join(", ")) : void 0;
    const terminalToolSessionId = generateUuid();
    const terminalCommandId = `tool-${generateUuid()}`;
    if (this._shouldRejectUnsandboxedExecutionRequest(isSandboxEnabled, allowUnsandboxedCommands, args)) {
      const commandToDisplay2 = normalizeTerminalCommandForDisplay(args.command);
      return {
        invocationMessage: new MarkdownString(localize("runInTerminal.unsandboxed.disabled.invocation", "Not running `{0}` because unsandboxed execution is disabled", escapeMarkdownSyntaxTokens(buildCommandDisplayText(commandToDisplay2)))),
        icon: Codicon.error,
        confirmationMessages: void 0,
        toolSpecificData: {
          kind: "terminal",
          terminalToolSessionId,
          terminalCommandId,
          commandLine: {
            original: args.command,
            forDisplay: commandToDisplay2
          },
          cwd,
          language,
          isBackground: executionOptions.persistentSession,
          requestUnsandboxedExecution: false,
          requestUnsandboxedExecutionReason: void 0
        }
      };
    }
    if (this._shouldRejectAllowNetworkRequest(isSandboxEnabled, isSandboxAllowNetworkEnabled, args)) {
      const commandToDisplay2 = normalizeTerminalCommandForDisplay(args.command);
      return {
        invocationMessage: new MarkdownString(localize("runInTerminal.allowNetwork.disabled.invocation", "Not running `{0}` because unrestricted network access in the sandbox is disabled", escapeMarkdownSyntaxTokens(buildCommandDisplayText(commandToDisplay2)))),
        icon: Codicon.error,
        confirmationMessages: void 0,
        toolSpecificData: {
          kind: "terminal",
          terminalToolSessionId,
          terminalCommandId,
          commandLine: {
            original: args.command,
            forDisplay: commandToDisplay2
          },
          cwd,
          language,
          isBackground: executionOptions.persistentSession,
          requestAllowNetwork: false,
          requestAllowNetworkReason: void 0
        }
      };
    }
    const rewriteResult = await this._rewriteCommandLine(args.command, {
      cwd,
      shell,
      os,
      isBackground: executionOptions.persistentSession,
      requestUnsandboxedExecution: allowUnsandboxedCommands ? requiresUnsandboxConfirmation : false,
      requestUnsandboxedExecutionReason,
      requestAllowNetwork: explicitAllowNetworkRequest,
      requestAllowNetworkReason,
      sandboxPrecheckInputs
    });
    const rewrittenCommand = rewriteResult.rewrittenCommand;
    const forDisplayCommand = rewriteResult.forDisplayCommand;
    const isSandboxWrapped = rewriteResult.isSandboxWrapped;
    requiresUnsandboxConfirmation = rewriteResult.requiresUnsandboxConfirmation;
    requestUnsandboxedExecutionReason = rewriteResult.requestUnsandboxedExecutionReason;
    requiresAllowNetworkConfirmation = rewriteResult.requiresAllowNetworkConfirmation;
    requestAllowNetworkReason = rewriteResult.requestAllowNetworkReason;
    const blockedDomains = rewriteResult.blockedDomains;
    const toolSpecificData = {
      kind: "terminal",
      terminalToolSessionId,
      terminalCommandId,
      commandLine: {
        original: args.command,
        toolEdited: rewrittenCommand === args.command ? void 0 : rewrittenCommand,
        forDisplay: forDisplayCommand ?? normalizeTerminalCommandForDisplay(rewrittenCommand ?? args.command),
        isSandboxWrapped
      },
      cwd,
      language,
      isBackground: executionOptions.persistentSession,
      requestUnsandboxedExecution: requiresUnsandboxConfirmation,
      requestUnsandboxedExecutionReason,
      requestAllowNetwork: requiresAllowNetworkConfirmation,
      requestAllowNetworkReason,
      missingSandboxDependencies: missingDependencies,
      sandboxRemediations,
      sandboxPrerequisiteFailure
    };
    let sandboxPrerequisiteConfirmation = void 0;
    if (missingDependencies && canInstallMissingDependencies) {
      const depsList = missingDependencies.join(", ");
      sandboxPrerequisiteConfirmation = {
        title: localize("runInTerminal.missingDeps.title", "Missing Sandbox Dependencies"),
        message: new MarkdownString(localize(
          "runInTerminal.missingDeps.message",
          "The following dependencies required for sandboxed execution are not installed: {0}. Would you like to install them?",
          depsList
        )),
        customOptions: [
          { id: "install", label: localize("runInTerminal.missingDeps.install", "Install"), kind: ConfirmationOptionKind.Approve },
          { id: "cancel", label: localize("runInTerminal.missingDeps.cancel", "Cancel"), kind: ConfirmationOptionKind.Deny }
        ]
      };
    }
    const alternativeRecommendation = getRecommendedToolsOverRunInTerminal(args.command, this._languageModelToolsService);
    if (alternativeRecommendation) {
      toolSpecificData.alternativeRecommendation = alternativeRecommendation;
      return {
        confirmationMessages: void 0,
        presentation: ToolInvocationPresentation.Hidden,
        toolSpecificData
      };
    }
    const commandLine = forDisplayCommand ?? rewrittenCommand ?? args.command;
    const isEligibleForAutoApproval = () => isToolEligibleForTerminalAutoApproval(TOOL_REFERENCE_NAME, this._configurationService, LEGACY_TOOL_REFERENCE_FULL_NAMES);
    const isAutoApproveEnabled = this._configurationService.getValue(TerminalChatAgentToolsSettingId.EnableAutoApprove) === true;
    const isAutoApproveAllowed = isTerminalAutoApproveAllowed(TOOL_REFERENCE_NAME, this._configurationService, this._storageService, LEGACY_TOOL_REFERENCE_FULL_NAMES);
    const commandLineAnalyzerOptions = {
      commandLine,
      cwd,
      os,
      shell,
      treeSitterLanguage: isPowerShell(shell, os) ? TreeSitterCommandParserLanguage.PowerShell : TreeSitterCommandParserLanguage.Bash,
      terminalToolSessionId,
      chatSessionResource,
      requiresUnsandboxConfirmation,
      requiresAllowNetworkConfirmation,
      hasSessionAutoApproval: !!chatSessionResource && this._terminalChatService.hasChatSessionAutoApproval(chatSessionResource)
    };
    const isSessionAutoApproved = chatSessionResource && isSessionAutoApproveLevel(chatSessionResource, this._configurationService, this._chatWidgetService, this._chatService);
    const commandLineAnalyzers = isSessionAutoApproved ? this._commandLineAnalyzers.filter((e) => !(e instanceof CommandLineAutoApproveAnalyzer)) : this._commandLineAnalyzers;
    const commandLineAnalyzerResults = await Promise.all(commandLineAnalyzers.map((e) => e.analyze(commandLineAnalyzerOptions)));
    const disclaimersRaw = commandLineAnalyzerResults.map((e) => e.disclaimers).filter((e) => !!e).flatMap((e) => e);
    let disclaimer;
    if (disclaimersRaw.length > 0) {
      const disclaimerTexts = disclaimersRaw.map((d) => typeof d === "string" ? d : d.value);
      const hasMarkdownDisclaimer = disclaimersRaw.some((d) => typeof d !== "string");
      const mdOptions = hasMarkdownDisclaimer ? { supportThemeIcons: true, isTrusted: { enabledCommands: [TerminalChatCommandId.OpenTerminalSettingsLink] } } : { supportThemeIcons: true };
      disclaimer = new MarkdownString(`$(${Codicon.info.id}) ` + disclaimerTexts.join(" "), mdOptions);
    }
    const analyzersIsAutoApproveAllowed = commandLineAnalyzerResults.every((e) => e.isAutoApproveAllowed);
    const customActions = isEligibleForAutoApproval() && analyzersIsAutoApproveAllowed ? commandLineAnalyzerResults.map((e) => e.customActions ?? []).flat() : void 0;
    let shellType = basename(shell, ".exe");
    if (shellType === "powershell") {
      shellType = "pwsh";
    }
    const wouldBeAutoApproved = (
      // Does at least one analyzer auto approve
      commandLineAnalyzerResults.some((e) => e.isAutoApproved) && // No analyzer denies auto approval
      commandLineAnalyzerResults.every((e) => e.isAutoApproved !== false) && // All analyzers allow auto approval
      analyzersIsAutoApproveAllowed
    );
    const isAutoApprovedByRules = (
      // Is the setting enabled and the user has opted-in
      isAutoApproveAllowed && // Would be auto-approved based on rules
      wouldBeAutoApproved
    );
    const isSandboxAutoApproved = isSandboxEnabled && toolSpecificData.commandLine.isSandboxWrapped === true && !requiresAllowNetworkConfirmation && this._allowSandboxAutoApprove;
    const isFinalAutoApproved = isSandboxAutoApproved || isAutoApprovedByRules || commandLineAnalyzerResults.some((e) => e.forceAutoApproval);
    if (isFinalAutoApproved || isAutoApproveEnabled && commandLineAnalyzerResults.some((e) => e.autoApproveInfo)) {
      toolSpecificData.autoApproveInfo = commandLineAnalyzerResults.find((e) => e.autoApproveInfo)?.autoApproveInfo;
    }
    const commandToDisplay = (toolSpecificData.commandLine.forDisplay ?? toolSpecificData.commandLine.userEdited ?? toolSpecificData.commandLine.toolEdited ?? toolSpecificData.commandLine.original).trimStart();
    const extractedCd = extractCdPrefix(commandToDisplay, shell, os);
    let confirmationTitle;
    if (extractedCd && cwd) {
      const isAbsolutePath = os === OperatingSystem.Windows ? win32.isAbsolute(extractedCd.directory) : posix.isAbsolute(extractedCd.directory);
      const directoryUri = isAbsolutePath ? URI.from({ scheme: cwd.scheme, authority: cwd.authority, path: extractedCd.directory }) : URI.joinPath(cwd, extractedCd.directory);
      const directoryLabel = this._labelService.getUriLabel(directoryUri);
      const cdPrefix = commandToDisplay.substring(0, commandToDisplay.length - extractedCd.command.length);
      toolSpecificData.confirmation = {
        commandLine: extractedCd.command,
        cwdLabel: directoryLabel,
        cdPrefix
      };
      confirmationTitle = localize("runInTerminal.inDirectory", "Run `{0}` command within `{1}`?", shellType, directoryLabel);
    } else {
      toolSpecificData.confirmation = {
        commandLine: commandToDisplay
      };
      confirmationTitle = localize("runInTerminal", "Run `{0}` command?", shellType);
    }
    const commandForPresenter = extractedCd?.command ?? commandToDisplay;
    let presenterInput = commandForPresenter;
    for (const presenter of this._commandLinePresenters) {
      const presenterResult = await presenter.present({ commandLine: { original: args.command, forDisplay: presenterInput }, shell, os });
      if (presenterResult) {
        toolSpecificData.presentationOverrides = {
          commandLine: presenterResult.commandLine,
          language: presenterResult.language ?? void 0
        };
        if (extractedCd && toolSpecificData.confirmation?.cwdLabel) {
          if (presenterResult.languageDisplayName) {
            confirmationTitle = localize("runInTerminal.presentationOverride.inDirectory", "Run `{0}` command in `{1}` within `{2}`?", presenterResult.languageDisplayName, shellType, toolSpecificData.confirmation.cwdLabel);
          } else {
            confirmationTitle = localize("runInTerminal.presentationOverride.inDirectory.withoutLanguage", "Run command in `{0}` within `{1}`?", shellType, toolSpecificData.confirmation.cwdLabel);
          }
        } else {
          if (presenterResult.languageDisplayName) {
            confirmationTitle = localize("runInTerminal.presentationOverride", "Run `{0}` command in `{1}`?", presenterResult.languageDisplayName, shellType);
          } else {
            confirmationTitle = localize("runInTerminal.presentationOverride.withoutLanguage", "Run command in `{0}`?", shellType);
          }
        }
        if (!presenterResult.processOtherPresenters) {
          break;
        }
        presenterInput = presenterResult.commandLine;
      }
    }
    if (requiresUnsandboxConfirmation) {
      confirmationTitle = blockedDomains?.length ? localize("runInTerminal.unsandboxed.domain", "Run `{0}` command outside the [sandbox]({1}) to access {2}?", shellType, TERMINAL_SANDBOX_DOCUMENTATION_URL, this._formatBlockedDomainsForTitle(blockedDomains)) : localize("runInTerminal.unsandboxed", "Run `{0}` command outside the [sandbox]({1})?", shellType, TERMINAL_SANDBOX_DOCUMENTATION_URL);
    } else if (requiresAllowNetworkConfirmation) {
      confirmationTitle = localize("runInTerminal.allowNetwork", "Allow {0} command to access the network?", shellType);
    }
    const shouldShowConfirmation = !isFinalAutoApproved && (!isSessionAutoApproved || requiresAllowNetworkConfirmation) || context.forceConfirmationReason !== void 0;
    const explanation = args.explanation || localize("runInTerminal.defaultExplanation", "No explanation provided");
    const goal = args.goal || localize("runInTerminal.defaultGoal", "No goal provided");
    const confirmationMessage = requiresUnsandboxConfirmation ? new MarkdownString(localize(
      "runInTerminal.unsandboxed.confirmationMessage",
      "Explanation: {0}\n\nGoal: {1}\n\nReason for leaving the sandbox: {2}",
      explanation,
      goal,
      requestUnsandboxedExecutionReason || localize("runInTerminal.unsandboxed.confirmationMessage.defaultReason", "The model indicated that this command needs unsandboxed access.")
    )) : requiresAllowNetworkConfirmation ? new MarkdownString(localize(
      "runInTerminal.allowNetwork.confirmationMessage",
      "Explanation: {0}\n\nGoal: {1}\n\nReason for allowing unrestricted network access in the sandbox: {2}",
      explanation,
      goal,
      requestAllowNetworkReason || localize("runInTerminal.allowNetwork.confirmationMessage.defaultReason", "The model indicated that this sandboxed command needs unrestricted network access.")
    )) : new MarkdownString(localize("runInTerminal.confirmationMessage", "Explanation: {0}\n\nGoal: {1}", explanation, goal));
    const confirmationMessages = shouldShowConfirmation ? {
      title: confirmationTitle,
      message: confirmationMessage,
      disclaimer,
      allowAutoConfirm: void 0,
      terminalCustomActions: customActions
    } : void 0;
    const rawDisplayCommand = toolSpecificData.commandLine.forDisplay ?? toolSpecificData.commandLine.toolEdited ?? toolSpecificData.commandLine.original;
    const displayCommand = rawDisplayCommand.length > 80 ? rawDisplayCommand.substring(0, 77) + "..." : rawDisplayCommand;
    const invocationMessage = toolSpecificData.commandLine.isSandboxWrapped ? new MarkdownString(localize("runInTerminal.invocation.sandbox", "Running `{0}` in sandbox", escapeMarkdownSyntaxTokens(displayCommand))) : new MarkdownString(localize("runInTerminal.invocation", "Running `{0}`", escapeMarkdownSyntaxTokens(displayCommand)));
    return {
      invocationMessage,
      icon: toolSpecificData.commandLine.isSandboxWrapped ? Codicon.terminalSecure : Codicon.terminal,
      confirmationMessages: sandboxPrerequisiteConfirmation ?? confirmationMessages,
      toolSpecificData
    };
  }
  _formatBlockedDomainsForTitle(blockedDomains) {
    if (blockedDomains.length === 1) {
      return `\`${blockedDomains[0]}\``;
    }
    return localize("runInTerminal.unsandboxed.domain.summary", "`{0}` and {1} more domains", blockedDomains[0], blockedDomains.length - 1);
  }
  _getBlockedDomainReason(blockedDomains, deniedDomains = []) {
    if (deniedDomains.length === blockedDomains.length && deniedDomains.length > 0) {
      if (blockedDomains.length === 1) {
        return localize("runInTerminal.unsandboxed.domain.reason.denied.single", "This command accesses {0}, which is blocked by chat.agent.deniedNetworkDomains.", blockedDomains[0]);
      }
      return localize("runInTerminal.unsandboxed.domain.reason.denied.multi", "This command accesses {0} and {1} more domains that are blocked by chat.agent.deniedNetworkDomains.", blockedDomains[0], blockedDomains.length - 1);
    }
    if (deniedDomains.length > 0) {
      if (blockedDomains.length === 1) {
        return localize("runInTerminal.unsandboxed.domain.reason.mixed.single", "This command accesses {0}, which is blocked by chat.agent.deniedNetworkDomains or not added to chat.agent.allowedNetworkDomains.", blockedDomains[0]);
      }
      return localize("runInTerminal.unsandboxed.domain.reason.mixed.multi", "This command accesses {0} and {1} more domains that are blocked by chat.agent.deniedNetworkDomains or not added to chat.agent.allowedNetworkDomains.", blockedDomains[0], blockedDomains.length - 1);
    }
    if (blockedDomains.length === 1) {
      return localize("runInTerminal.unsandboxed.domain.reason.single", "This command accesses {0}, which is not permitted by the current chat.agent.sandbox configuration.", blockedDomains[0]);
    }
    return localize("runInTerminal.unsandboxed.domain.reason.multi", "This command accesses {0} and {1} more domains that are not permitted by the current chat.agent.sandbox configuration.", blockedDomains[0], blockedDomains.length - 1);
  }
  async _rewriteCommandLine(commandLine, options) {
    let rewrittenCommand = commandLine;
    let forDisplayCommand = void 0;
    let isSandboxWrapped = false;
    let requiresUnsandboxConfirmation = options.requestUnsandboxedExecution;
    let requestUnsandboxedExecutionReason = options.requestUnsandboxedExecution ? options.requestUnsandboxedExecutionReason : void 0;
    let requiresAllowNetworkConfirmation = false;
    let requestAllowNetworkReason = options.requestAllowNetwork ? options.requestAllowNetworkReason : void 0;
    let blockedDomains;
    for (const rewriter of this._commandLineRewriters) {
      const rewriteResult = await rewriter.rewrite({
        commandLine: rewrittenCommand,
        cwd: options.cwd,
        shell: options.shell,
        os: options.os,
        isBackground: options.isBackground,
        requestUnsandboxedExecution: requiresUnsandboxConfirmation,
        requestAllowNetwork: options.requestAllowNetwork,
        sandboxPrecheckInputs: options.sandboxPrecheckInputs
      });
      if (rewriteResult) {
        rewrittenCommand = rewriteResult.rewritten;
        forDisplayCommand = forDisplayCommand ?? rewriteResult.forDisplay;
        if (rewriteResult.isSandboxWrapped) {
          isSandboxWrapped = true;
        } else if (rewriteResult.isSandboxWrapped === false) {
          isSandboxWrapped = false;
        }
        if (rewriteResult.requiresUnsandboxConfirmation) {
          requiresUnsandboxConfirmation = true;
        }
        if (rewriteResult.requiresAllowNetworkConfirmation) {
          requiresAllowNetworkConfirmation = true;
        }
        if (rewriteResult.blockedDomains?.length) {
          blockedDomains = rewriteResult.blockedDomains;
          const blockedDomainReason = this._getBlockedDomainReason(rewriteResult.blockedDomains, rewriteResult.deniedDomains);
          if (rewriteResult.requiresAllowNetworkConfirmation) {
            requestAllowNetworkReason = blockedDomainReason;
          } else {
            requestUnsandboxedExecutionReason = blockedDomainReason;
          }
        }
        this._logService.info(`RunInTerminalTool: Command rewritten by ${rewriter.constructor.name}: ${rewriteResult.reasoning}`);
      }
    }
    return {
      rewrittenCommand,
      forDisplayCommand,
      isSandboxWrapped,
      requiresUnsandboxConfirmation,
      requestUnsandboxedExecutionReason,
      requiresAllowNetworkConfirmation,
      requestAllowNetworkReason: requiresAllowNetworkConfirmation ? requestAllowNetworkReason : void 0,
      blockedDomains
    };
  }
  _getSandboxPrecheckInputs(chatSessionResource, chatRequestId) {
    return getSandboxPrecheckInputsForToolInvocation(chatSessionResource, chatRequestId, this._chatWidgetService, this._chatService);
  }
  async _confirmAutomaticSandboxRetry(retryKind, sessionResource, command, shell, blockedDomains, riskAssessment, token) {
    const chatModel = sessionResource && this._chatService.getSession(sessionResource);
    if (!(chatModel instanceof ChatModel)) {
      return false;
    }
    if (sessionResource && isSessionAutoApproveLevel(sessionResource, this._configurationService, this._chatWidgetService, this._chatService)) {
      return true;
    }
    const request = chatModel.getRequests().at(-1);
    if (!request) {
      return false;
    }
    let shellType = basename(shell, ".exe");
    if (shellType === "powershell") {
      shellType = "pwsh";
    }
    const store = new DisposableStore();
    return new Promise((resolve) => {
      let resolved = false;
      const resolveOnce = (value) => {
        if (resolved) {
          return;
        }
        resolved = true;
        store.dispose();
        resolve(value);
      };
      const confirmationMessage = retryKind === "allowNetwork" ? new MarkdownString(localize(
        "runInTerminal.allowNetwork.autoRetry.confirmationMessage",
        "`{0}`",
        escapeMarkdownSyntaxTokens(buildCommandDisplayText(command))
      )) : new MarkdownString(localize(
        "runInTerminal.unsandboxed.autoRetry.confirmationMessage",
        "`{0}`",
        escapeMarkdownSyntaxTokens(buildCommandDisplayText(command))
      ));
      const part = new ChatElicitationRequestPart(
        this._getAutomaticSandboxRetryTitle(retryKind, shellType, blockedDomains),
        confirmationMessage,
        "",
        localize("allow", "Allow"),
        localize("skip", "Skip"),
        async () => {
          resolveOnce(true);
          part.hide();
          return ElicitationState.Accepted;
        },
        async () => {
          resolveOnce(false);
          part.hide();
          return ElicitationState.Rejected;
        },
        void 0,
        void 0,
        () => resolveOnce(false),
        riskAssessment
      );
      chatModel.acceptResponseProgress(request, part);
      store.add(token.onCancellationRequested(() => resolveOnce(false)));
      store.add({ dispose: () => part.hide() });
    });
  }
  _getAutomaticSandboxRetryTitle(retryKind, shellType, blockedDomains) {
    if (retryKind === "allowNetwork") {
      return blockedDomains?.length ? new MarkdownString(localize("runInTerminal.allowNetwork.autoRetry.domain", "Retry `{0}` command in the sandbox by allowing network access to {1}?", shellType, this._formatBlockedDomainsForTitle(blockedDomains))) : new MarkdownString(localize("runInTerminal.allowNetwork.autoRetry", "Retry `{0}` command in the sandbox by allowing network access?", shellType));
    }
    return blockedDomains?.length ? new MarkdownString(localize("runInTerminal.unsandboxed.autoRetry.domain", "Run `{0}` command outside the sandbox to access {1}?", shellType, this._formatBlockedDomainsForTitle(blockedDomains))) : new MarkdownString(localize("runInTerminal.unsandboxed.autoRetry", "Run `{0}` command outside the sandbox?", shellType));
  }
  /**
   * Surface a confirmation dialog when the terminal is detected to be waiting
   * for sensitive input (password, passphrase, OTP, …). Sensitive prompts must
   * never be routed through the model — the user types the secret directly
   * into the terminal. The "Focus terminal" action reveals and focuses the
   * terminal; the "Cancel" action cancels the running command.
   *
   * Returns a disposable that hides any pending elicitation. The handler
   * itself dedupes concurrent elicitations so repeated polling cycles don't
   * spam the chat session.
   */
  _registerSensitiveInputElicitation(chatSessionResource, terminalInstance, outputMonitor, cancelExecution, onAutoCancelled) {
    const store = new DisposableStore();
    let pending;
    let autoCancelled = false;
    store.add(outputMonitor.onDidDetectSensitiveInputNeeded(() => {
      if (pending || autoCancelled) {
        return;
      }
      const isAutoApproved = chatSessionResource && isSessionAutoApproveLevel(chatSessionResource, this._configurationService, this._chatWidgetService, this._chatService);
      const chatModel = chatSessionResource && this._chatService.getSession(chatSessionResource);
      if (isAutoApproved) {
        autoCancelled = true;
        if (chatModel instanceof ChatModel) {
          const request2 = chatModel.getRequests().at(-1);
          if (request2) {
            const infoPart = new ChatElicitationRequestPart(
              new MarkdownString(localize("runInTerminal.sensitiveInput.autoCancelTitle", "Terminal command cancelled \u2014 sensitive input required")),
              new MarkdownString(localize("runInTerminal.sensitiveInput.autoCancelMessage", "The terminal command was prompting for a password or other secret. Auto-approve / autopilot mode cannot safely supply secrets, so the command was cancelled. Run the command interactively if you want to provide the secret.")),
              "",
              localize("runInTerminal.sensitiveInput.dismiss", "Dismiss"),
              "",
              async () => {
                infoPart.hide();
                return ElicitationState.Accepted;
              },
              async () => {
                infoPart.hide();
                return ElicitationState.Rejected;
              },
              void 0,
              void 0,
              void 0,
              void 0
            );
            chatModel.acceptResponseProgress(request2, infoPart);
          }
        }
        onAutoCancelled?.();
        cancelExecution();
        return;
      }
      if (!(chatModel instanceof ChatModel)) {
        this._terminalService.setActiveInstance(terminalInstance);
        this._terminalService.revealTerminal(terminalInstance, true).catch(() => {
        });
        terminalInstance.focus();
        return;
      }
      const request = chatModel.getRequests().at(-1);
      if (!request) {
        return;
      }
      const part = new ChatElicitationRequestPart(
        new MarkdownString(localize("runInTerminal.sensitiveInput.title", "Terminal is waiting for sensitive input")),
        new MarkdownString(localize("runInTerminal.sensitiveInput.message", "The terminal command appears to be prompting for a password or other sensitive value. Focus the terminal to type it directly \u2014 secrets must not be sent through chat.")),
        "",
        localize("runInTerminal.sensitiveInput.focus", "Focus Terminal"),
        localize("runInTerminal.sensitiveInput.cancel", "Cancel Command"),
        async () => {
          pending = void 0;
          part.hide();
          try {
            this._terminalService.setActiveInstance(terminalInstance);
            await this._terminalService.revealTerminal(terminalInstance, true);
            terminalInstance.focus();
          } catch (err) {
            this._logService.warn(`RunInTerminalTool: failed to reveal terminal for sensitive input`, err);
          }
          return ElicitationState.Accepted;
        },
        async () => {
          pending = void 0;
          part.hide();
          cancelExecution();
          return ElicitationState.Rejected;
        },
        void 0,
        void 0,
        () => {
          pending = void 0;
        },
        void 0
      );
      pending = part;
      chatModel.acceptResponseProgress(request, part);
    }));
    return store;
  }
  _acceptAutomaticSandboxRetryToolInvocationUpdate(retryKind, sessionResource, toolCallId, toolSpecificData, isComplete, toolResultMessage) {
    const chatModel = sessionResource && this._chatService.getSession(sessionResource);
    if (!(chatModel instanceof ChatModel)) {
      return;
    }
    const request = chatModel.getRequests().at(-1);
    if (!request) {
      return;
    }
    const displayCommand = buildCommandDisplayText(toolSpecificData.commandLine.forDisplay ?? toolSpecificData.commandLine.toolEdited ?? toolSpecificData.commandLine.original);
    const progress = {
      kind: "externalToolInvocationUpdate",
      toolCallId,
      toolName: localize("runInTerminalTool.displayName", "Run in Terminal"),
      isComplete,
      invocationMessage: retryKind === "allowNetwork" ? new MarkdownString(localize("runInTerminal.allowNetwork.autoRetry.invocation", "Running `{0}` in the sandbox with unrestricted network access", escapeMarkdownSyntaxTokens(displayCommand))) : new MarkdownString(localize("runInTerminal.unsandboxed.autoRetry.invocation", "Running `{0}` outside the sandbox", escapeMarkdownSyntaxTokens(displayCommand))),
      pastTenseMessage: toolResultMessage,
      toolSpecificData
    };
    chatModel.acceptResponseProgress(request, progress);
  }
  async _runAutomaticSandboxRetry(options) {
    const requestAllowNetwork = options.retryKind === "allowNetwork";
    const requestUnsandboxedExecution = options.retryKind === "unsandboxed" && options.allowUnsandboxedCommands;
    const [os, shell] = await Promise.all([
      this._osBackend,
      this._profileFetcher.getCopilotShell()
    ]);
    const retryRewriteResult = await this._rewriteCommandLine(options.args.command, {
      cwd: options.toolSpecificData.cwd ? URI.revive(options.toolSpecificData.cwd) : void 0,
      shell,
      os,
      isBackground: options.isBackground,
      requestUnsandboxedExecution,
      requestUnsandboxedExecutionReason: requestUnsandboxedExecution ? options.retryReason : void 0,
      requestAllowNetwork,
      requestAllowNetworkReason: requestAllowNetwork ? options.retryReason : void 0
    });
    const rewrittenRetryReason = (requestAllowNetwork ? retryRewriteResult.requestAllowNetworkReason : retryRewriteResult.requestUnsandboxedExecutionReason) ?? options.retryReason;
    const retryParameters = {
      ...options.args,
      command: options.args.command,
      allowToRunUnsandboxedCommands: options.allowUnsandboxedCommands,
      requestUnsandboxedExecution,
      requestUnsandboxedExecutionReason: requestUnsandboxedExecution ? rewrittenRetryReason : void 0,
      requestAllowNetwork,
      requestAllowNetworkReason: requestAllowNetwork ? rewrittenRetryReason : void 0
    };
    const retryRiskAssessment = {
      toolId: TerminalToolId.RunInTerminal,
      parameters: {
        ...retryParameters,
        command: retryRewriteResult.rewrittenCommand
      }
    };
    const retryConfirmationCommand = options.toolSpecificData.presentationOverrides?.commandLine ?? options.command;
    const shouldRetry = await this._confirmAutomaticSandboxRetry(options.retryKind, options.invocation.context?.sessionResource, retryConfirmationCommand, shell, retryRewriteResult.blockedDomains, retryRiskAssessment, options.token);
    if (!shouldRetry) {
      return void 0;
    }
    const retryToolSpecificData = {
      ...options.toolSpecificData,
      terminalCommandId: `tool-${generateUuid()}`,
      commandLine: {
        original: options.args.command,
        toolEdited: retryRewriteResult.rewrittenCommand === options.args.command ? void 0 : retryRewriteResult.rewrittenCommand,
        forDisplay: retryRewriteResult.forDisplayCommand ?? normalizeTerminalCommandForDisplay(retryRewriteResult.rewrittenCommand ?? options.args.command),
        isSandboxWrapped: retryRewriteResult.isSandboxWrapped
      },
      requestUnsandboxedExecution: requestUnsandboxedExecution || (requestAllowNetwork ? false : void 0),
      requestUnsandboxedExecutionReason: requestUnsandboxedExecution ? rewrittenRetryReason : void 0,
      requestAllowNetwork: requestAllowNetwork || void 0,
      requestAllowNetworkReason: requestAllowNetwork ? rewrittenRetryReason : void 0,
      terminalCommandUri: void 0,
      terminalCommandOutput: void 0,
      terminalTheme: void 0,
      terminalCommandState: void 0,
      didContinueInBackground: void 0
    };
    const retryToolCallId = `automatic-${options.retryKind === "allowNetwork" ? "allow-network" : "unsandbox"}-retry-${generateUuid()}`;
    this._acceptAutomaticSandboxRetryToolInvocationUpdate(options.retryKind, options.invocation.context?.sessionResource, retryToolCallId, retryToolSpecificData, false);
    return await this.invoke({
      ...options.invocation,
      parameters: retryParameters,
      toolSpecificData: retryToolSpecificData
    }, options.countTokens, options.progress, options.token);
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const toolSpecificData = invocation.toolSpecificData;
    if (!toolSpecificData) {
      throw new Error("toolSpecificData must be provided for this tool");
    }
    if (!invocation.context) {
      throw new Error("Invocation context must be provided for this tool");
    }
    const commandId = toolSpecificData.terminalCommandId;
    if (toolSpecificData.alternativeRecommendation) {
      return {
        content: [{
          kind: "text",
          value: toolSpecificData.alternativeRecommendation
        }]
      };
    }
    const args = invocation.parameters;
    const allowUnsandboxedCommands = this._getAllowToRunUnsandboxedCommands(args);
    const sandboxPrecheckInputs = this._getSandboxPrecheckInputs(invocation.context.sessionResource, invocation.chatRequestId);
    const isSandboxEnabled = await this._terminalSandboxService.isEnabled(sandboxPrecheckInputs);
    if (this._shouldRejectUnsandboxedExecutionRequest(isSandboxEnabled, allowUnsandboxedCommands, args)) {
      const message = this._getUnsandboxedExecutionDisabledMessage();
      return {
        toolResultError: message,
        toolResultDetails: {
          input: args.command,
          output: [{ type: "embed", isText: true, value: message }],
          isError: true
        },
        content: [{
          kind: "text",
          value: message
        }]
      };
    }
    const sandboxPrerequisiteTerminalOptions = {
      createTerminal: async () => this._terminalService.createTerminal({}),
      focusTerminal: async (terminal) => {
        this._terminalService.setActiveInstance(terminal);
        await this._terminalService.revealTerminal(terminal, true);
        terminal.focus();
      }
    };
    if (toolSpecificData.sandboxPrerequisiteFailure) {
      return {
        content: [{ kind: "text", value: toolSpecificData.sandboxPrerequisiteFailure }]
      };
    }
    const isSandboxAllowNetworkEnabled = isSandboxEnabled && await this._terminalSandboxService.isSandboxAllowNetworkEnabled();
    if (this._shouldRejectAllowNetworkRequest(isSandboxEnabled, isSandboxAllowNetworkEnabled, args)) {
      const message = this._getAllowNetworkRequestDisabledMessage();
      return {
        toolResultError: message,
        toolResultDetails: {
          input: args.command,
          output: [{ type: "embed", isText: true, value: message }],
          isError: true
        },
        content: [{
          kind: "text",
          value: message
        }]
      };
    }
    if (toolSpecificData.missingSandboxDependencies?.length) {
      if (invocation.selectedCustomButton === "install") {
        const sessionResource = invocation.context.sessionResource;
        const { exitCode: exitCode2 } = await this._terminalSandboxService.installMissingSandboxDependencies(toolSpecificData.missingSandboxDependencies, sessionResource, token, sandboxPrerequisiteTerminalOptions);
        if (exitCode2 !== void 0 && exitCode2 !== 0) {
          return {
            content: [{
              kind: "text",
              value: localize(
                "runInTerminal.missingDeps.failed",
                "Sandbox dependency installation failed (exit code {0}). The command was not executed.",
                exitCode2
              )
            }]
          };
        }
        if (exitCode2 === void 0) {
          return {
            content: [{
              kind: "text",
              value: localize(
                "runInTerminal.missingDeps.unknown",
                "Could not determine whether sandbox dependency installation succeeded. The command was not executed."
              )
            }]
          };
        }
        const refreshedPrereqs = await this._terminalSandboxService.checkForSandboxingPrereqs(true, sandboxPrecheckInputs);
        if (refreshedPrereqs.failedCheck !== void 0) {
          return {
            content: [{
              kind: "text",
              value: refreshedPrereqs.failedCheck === TerminalSandboxPrerequisiteCheck.Bubblewrap && refreshedPrereqs.remediations?.length ? localize("runInTerminal.missingDeps.bubblewrapFailed", "Sandbox dependencies were installed, but bubblewrap cannot create the required sandbox namespace. Run the command again to choose an available repair option.") : refreshedPrereqs.failedCheck === TerminalSandboxPrerequisiteCheck.Bubblewrap ? localize("runInTerminal.missingDeps.bubblewrapFailedNoRepair", "Sandbox dependencies were installed, but bubblewrap cannot create the required sandbox namespace on this system. The command was not executed.") : localize("runInTerminal.missingDeps.recheckFailed", "Sandbox prerequisites are still not satisfied after installation. The command was not executed.")
            }]
          };
        }
        this._logService.info("RunInTerminalTool: Sandbox dependency installation succeeded");
        return {
          content: [{
            kind: "text",
            value: localize(
              "runInTerminal.missingDeps.installed",
              "Sandbox dependencies were installed successfully. If the issue persists, reload the window and try running the command again."
            )
          }]
        };
      } else {
        this._logService.info("RunInTerminalTool: User cancelled sandbox dependency installation");
        return {
          content: [{
            kind: "text",
            value: localize(
              "runInTerminal.missingDeps.cancelled",
              "Sandbox dependency installation was cancelled by the user."
            )
          }]
        };
      }
    }
    if (toolSpecificData.sandboxRemediations?.length) {
      const selectedRemediation = toolSpecificData.sandboxRemediations[0];
      const { exitCode: exitCode2 } = await this._terminalSandboxService.runSandboxRemediation(selectedRemediation, invocation.context.sessionResource, token, sandboxPrerequisiteTerminalOptions);
      if (exitCode2 !== 0) {
        return this._getBubblewrapUnsupportedResult();
      }
      const refreshedPrereqs = await this._terminalSandboxService.checkForSandboxingPrereqs(true, sandboxPrecheckInputs);
      if (refreshedPrereqs.failedCheck !== void 0) {
        return this._getBubblewrapUnsupportedResult();
      }
      this._logService.info("RunInTerminalTool: Bubblewrap remediation and capability recheck succeeded, proceeding with command execution");
    }
    const executionOptions = this._resolveExecutionOptions(args);
    this._logService.debug(`RunInTerminalTool: Invoking with options ${JSON.stringify(args)}`);
    let toolResultMessage;
    if (args.timeout !== void 0 && (Number.isNaN(args.timeout) || args.timeout < 0)) {
      return {
        content: [{
          kind: "text",
          value: "Error: timeout must be a non-negative number of milliseconds (use 0 for no timeout)."
        }]
      };
    }
    if (executionOptions.mode === "sync" && args.timeout === void 0) {
      args.timeout = 0;
    }
    const chatSessionResource = invocation.context.sessionResource;
    const shouldSendNotifications = !invocation.subAgentInvocationId;
    const command = toolSpecificData.commandLine.userEdited ?? toolSpecificData.commandLine.toolEdited ?? toolSpecificData.commandLine.original;
    const didUserEditCommand = toolSpecificData.commandLine.userEdited !== void 0 && toolSpecificData.commandLine.userEdited !== toolSpecificData.commandLine.original;
    const didToolEditCommand = !didUserEditCommand && toolSpecificData.commandLine.toolEdited !== void 0 && toolSpecificData.commandLine.toolEdited !== toolSpecificData.commandLine.original && // Only consider it a meaningful edit if the display form also differs from the
    // original. Cosmetic rewrites like prepending a space to prevent shell history
    // should not trigger the "tool simplified the command" note.
    normalizeTerminalCommandForDisplay(toolSpecificData.commandLine.toolEdited).trim() !== normalizeTerminalCommandForDisplay(toolSpecificData.commandLine.original).trim();
    const didSandboxWrapCommand = toolSpecificData.commandLine.isSandboxWrapped === true;
    const commandLineForMetadata = isSandboxEnabled ? toolSpecificData.commandLine.forDisplay ?? toolSpecificData.commandLine.original : void 0;
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    if (didSandboxWrapCommand) {
      const deniedAccess = await this._getDeniedSandboxFileAccess(args.requestFileValidationCheck, sandboxPrecheckInputs);
      if (deniedAccess.length > 0) {
        const message = this._buildSandboxFileAccessDeniedMessage(deniedAccess);
        return {
          toolResultError: message,
          toolResultDetails: {
            input: args.command,
            output: [{ type: "embed", isText: true, value: message }],
            isError: true
          },
          content: [{
            kind: "text",
            value: message
          }]
        };
      }
    }
    let error;
    const automaticUnsandboxRetryReason = localize("runInTerminal.unsandboxed.autoRetry.reason", "The sandboxed execution output indicated the sandbox blocked the command.");
    const automaticAllowNetworkRetryReason = localize("runInTerminal.allowNetwork.autoRetry.reason", "The sandboxed execution output indicated the sandbox blocked required network access.");
    const isNewSession = !executionOptions.persistentSession && !this._sessionTerminalAssociations.has(chatSessionResource);
    const timingStart = Date.now();
    const termId = generateUuid();
    const terminalToolSessionId = toolSpecificData.terminalToolSessionId;
    const store = new DisposableStore();
    this._logService.debug(`RunInTerminalTool: Creating ${executionOptions.persistentSession ? "background" : "foreground"} terminal. termId=${termId}, chatSessionResource=${chatSessionResource}`);
    const toolTerminal = await this._initTerminal(chatSessionResource, termId, terminalToolSessionId, executionOptions.persistentSession, token);
    this._handleTerminalVisibility(toolTerminal, chatSessionResource);
    const timingConnectMs = Date.now() - timingStart;
    const xterm = await toolTerminal.instance.xtermReadyPromise;
    if (!xterm) {
      throw new Error("Instance was disposed before xterm.js was ready");
    }
    const commandDetection = toolTerminal.instance.capabilities.get(TerminalCapability.CommandDetection);
    let inputUserChars = 0;
    let inputUserSigint = false;
    store.add(xterm.raw.onData((data) => {
      if (!telemetryIgnoredSequences.includes(data)) {
        inputUserChars += data.length;
      }
      inputUserSigint ||= data === "";
    }));
    let terminalResult = "";
    let outputLineCount = -1;
    let exitCode;
    let altBufferResult;
    let didTimeout = false;
    let didIdleSilence = false;
    let didInputNeeded = false;
    let didSensitiveAutoCancelled = false;
    let isBackgroundExecution = executionOptions.persistentSession;
    let timeoutPromise;
    let timeoutRacePromise;
    let outputMonitor;
    let pollingResult;
    const executeCancellation = store.add(new CancellationTokenSource(token));
    const timeoutValue = args.timeout !== void 0 ? clamp(args.timeout, 0, Number.MAX_SAFE_INTEGER) : void 0;
    if (timeoutValue !== void 0 && timeoutValue > 0) {
      const shouldEnforceTimeout = executionOptions.waitStrategy === "idle" || this._configurationService.getValue(TerminalChatAgentToolsSettingId.EnforceTimeoutFromModel) === true;
      if (shouldEnforceTimeout) {
        timeoutPromise = timeout(timeoutValue);
        timeoutRacePromise = timeoutPromise.then(
          () => ({ type: "timeout" })
        ).catch(() => ({ type: "timeout" }));
      }
    }
    let continueInBackgroundResolve;
    const continueInBackgroundPromise = new Promise((resolve) => {
      continueInBackgroundResolve = resolve;
    });
    if (terminalToolSessionId) {
      store.add(this._terminalChatService.onDidContinueInBackground((sessionId) => {
        if (sessionId === terminalToolSessionId) {
          const execution = RunInTerminalTool._activeExecutions.get(termId);
          execution?.setBackground?.();
          isBackgroundExecution = true;
          continueInBackgroundResolve?.();
        }
      }));
    }
    let executionPromise;
    try {
      const execution = this._instantiationService.createInstance(
        ActiveTerminalExecution,
        chatSessionResource,
        termId,
        toolTerminal,
        commandDetection,
        executionOptions.persistentSession
      );
      this._logService.info(`RunInTerminalTool: Using \`${execution.strategy.type}\` execute strategy for command \`${command}\``);
      store.add(execution);
      this._setActiveExecution(termId, execution);
      const startMarkerPromise = Event.toPromise(execution.strategy.onDidCreateStartMarker);
      const outputMonitorPollFn = executionOptions.persistentSession ? async (executionForPoll) => ({
        output: executionForPoll.getOutput(),
        state: OutputMonitorState.Idle
      }) : void 0;
      store.add(execution.strategy.onDidCreateStartMarker((startMarker) => {
        if (!outputMonitor) {
          outputMonitor = this._instantiationService.createInstance(
            OutputMonitor,
            {
              instance: toolTerminal.instance,
              sessionResource: chatSessionResource,
              getOutput: (marker) => execution.getOutput(marker ?? startMarker)
            },
            outputMonitorPollFn,
            invocation.context,
            token,
            command
          );
        }
      }));
      executionPromise = execution.start(command, executeCancellation.token, commandId, commandLineForMetadata);
      if (executionOptions.waitStrategy === "idle") {
        this._logService.debug(`RunInTerminalTool: Starting persistent execution with idle wait strategy \`${command}\``);
        await startMarkerPromise;
        let idleTimedOut = false;
        if (outputMonitor) {
          if (timeoutRacePromise) {
            const idleRace = await Promise.race([
              Event.toPromise(outputMonitor.onDidFinishCommand).then(() => ({ type: "idle" })),
              timeoutRacePromise
            ]);
            if (idleRace.type === "timeout") {
              idleTimedOut = true;
              this._logService.debug(`RunInTerminalTool: Timeout reached waiting for idle signal, returning output collected so far`);
            } else {
              pollingResult = outputMonitor.pollingResult;
            }
          } else {
            await Event.toPromise(outputMonitor.onDidFinishCommand);
            pollingResult = outputMonitor.pollingResult;
          }
        }
        await this._commandArtifactCollector.capture(toolSpecificData, toolTerminal.instance, commandId);
        if (token.isCancellationRequested) {
          throw new CancellationError();
        }
        const state = toolSpecificData.terminalCommandState ?? {};
        state.timestamp = state.timestamp ?? timingStart;
        toolSpecificData.terminalCommandState = state;
        let resultText2 = didSandboxWrapCommand ? `Command is now running in terminal with ID=${termId}` : didUserEditCommand ? `Note: The user manually edited the command to \`${command}\`, and that command is now running in terminal with ID=${termId}` : didToolEditCommand ? `Note: The tool simplified the command to \`${command}\`, and that command is now running in terminal with ID=${termId}` : `Command is running in terminal with ID=${termId}`;
        const backgroundOutput = pollingResult?.output ?? (idleTimedOut ? execution.getOutput() : void 0);
        const outputAnalyzerMessage2 = backgroundOutput ? await this._getOutputAnalyzerMessage(void 0, backgroundOutput, command, didSandboxWrapCommand) : void 0;
        if (idleTimedOut) {
          resultText2 += `
 Timed out waiting for the command to become idle. The command is still running, with output:
`;
          if (outputAnalyzerMessage2) {
            resultText2 += `${outputAnalyzerMessage2}
`;
          }
          resultText2 += backgroundOutput ?? "";
        } else if (pollingResult && pollingResult.state === OutputMonitorState.Idle) {
          resultText2 += `
 The command became idle with output:
`;
          if (outputAnalyzerMessage2) {
            resultText2 += `${outputAnalyzerMessage2}
`;
          }
          resultText2 += pollingResult.output;
          resultText2 += `
${this._buildInputNeededSteeringText(chatSessionResource, termId, "none")}`;
        } else if (pollingResult) {
          resultText2 += `
 The command is still running, with output:
`;
          if (outputAnalyzerMessage2) {
            resultText2 += `${outputAnalyzerMessage2}
`;
          }
          resultText2 += pollingResult.output;
        }
        const endCwd2 = await toolTerminal.instance.getCwdResource();
        return {
          toolMetadata: {
            exitCode: void 0,
            id: termId,
            terminalId: toolTerminal.instance.instanceId,
            cwd: endCwd2?.toString()
          },
          content: [{
            kind: "text",
            value: resultText2
          }]
        };
      } else {
        const raceCleanup = new DisposableStore();
        startMarkerPromise.then(() => {
          if (outputMonitor && !raceCleanup.isDisposed) {
            raceCleanup.add(this._registerSensitiveInputElicitation(
              chatSessionResource,
              toolTerminal.instance,
              outputMonitor,
              () => executeCancellation.cancel(),
              () => {
                didSensitiveAutoCancelled = true;
              }
            ));
          }
        });
        const raceCandidates = [
          executionPromise.then((result) => ({ type: "completed", result })),
          continueInBackgroundPromise.then(() => ({ type: "background" })),
          new Promise((resolve) => {
            startMarkerPromise.then(() => {
              if (outputMonitor && !raceCleanup.isDisposed) {
                raceCleanup.add(outputMonitor.onDidDetectInputNeeded(() => resolve({ type: "inputNeeded" })));
              }
            });
          })
        ];
        if (timeoutRacePromise) {
          raceCandidates.push(timeoutRacePromise);
        }
        const idleSilenceMs = this._configurationService.getValue(TerminalChatAgentToolsSettingId.IdleSilenceTimeoutMs) ?? DEFAULT_IDLE_SILENCE_TIMEOUT_MS;
        if (idleSilenceMs > 0) {
          const idleSilenceDeferred = new DeferredPromise();
          const idleSilenceScheduler = raceCleanup.add(new RunOnceScheduler(() => idleSilenceDeferred.complete({ type: "idleSilence" }), idleSilenceMs));
          raceCleanup.add(toolTerminal.instance.onData(() => idleSilenceScheduler.schedule()));
          idleSilenceScheduler.schedule();
          raceCandidates.push(idleSilenceDeferred.p);
        }
        let raceResult;
        try {
          raceResult = await Promise.race(raceCandidates);
        } finally {
          raceCleanup.dispose();
        }
        if (raceResult.type === "inputNeeded") {
          this._logService.debug(`RunInTerminalTool: Output monitor detected input needed in foreground terminal, returning output to agent`);
          error = "inputNeeded";
          didInputNeeded = true;
          const idleOutput = execution.getOutput();
          outputLineCount = idleOutput ? count(idleOutput.trim(), "\n") + 1 : 0;
          terminalResult = idleOutput ?? "";
        } else if (raceResult.type === "background") {
          this._logService.debug(`RunInTerminalTool: Continue in background triggered, returning output collected so far`);
          error = "continueInBackground";
          const backgroundOutput = execution.getOutput();
          outputLineCount = backgroundOutput ? count(backgroundOutput.trim(), "\n") + 1 : 0;
          terminalResult = backgroundOutput;
        } else if (raceResult.type === "timeout") {
          this._logService.debug(`RunInTerminalTool: Timeout reached, returning output collected so far`);
          error = "timeout";
          didTimeout = true;
          isBackgroundExecution = true;
          toolTerminal.isBackground = true;
          toolSpecificData.didContinueInBackground = true;
          this._sessionTerminalAssociations.delete(chatSessionResource);
          await this._associateProcessIdWithSession(toolTerminal.instance, chatSessionResource, termId, toolTerminal.shellIntegrationQuality, true);
          const timeoutOutput = execution.getOutput();
          outputLineCount = timeoutOutput ? count(timeoutOutput.trim(), "\n") + 1 : 0;
          terminalResult = timeoutOutput ?? "";
        } else if (raceResult.type === "idleSilence") {
          this._logService.debug(`RunInTerminalTool: Idle silence reached (${idleSilenceMs}ms), promoting to background`);
          error = "idleSilence";
          didIdleSilence = true;
          isBackgroundExecution = true;
          toolTerminal.isBackground = true;
          toolSpecificData.didContinueInBackground = true;
          this._sessionTerminalAssociations.delete(chatSessionResource);
          await this._associateProcessIdWithSession(toolTerminal.instance, chatSessionResource, termId, toolTerminal.shellIntegrationQuality, true);
          const idleSilenceOutput = execution.getOutput();
          outputLineCount = idleSilenceOutput ? count(idleSilenceOutput.trim(), "\n") + 1 : 0;
          terminalResult = idleSilenceOutput ?? "";
        } else {
          const executeResult = raceResult.result;
          toolTerminal.receivedUserInput = false;
          if (token.isCancellationRequested) {
            throw new CancellationError();
          }
          if (executeResult.didEnterAltBuffer) {
            const state = toolSpecificData.terminalCommandState ?? {};
            state.timestamp = state.timestamp ?? timingStart;
            toolSpecificData.terminalCommandState = state;
            toolResultMessage = altBufferMessage;
            outputLineCount = 0;
            error = executeResult.error ?? "alternateBuffer";
            const altBufferCwd = await toolTerminal.instance.getCwdResource();
            altBufferResult = {
              toolResultMessage,
              toolMetadata: {
                exitCode: void 0,
                id: termId,
                terminalId: toolTerminal.instance.instanceId,
                cwd: altBufferCwd?.toString()
              },
              content: [{
                kind: "text",
                value: altBufferMessage
              }]
            };
          } else {
            await this._commandArtifactCollector.capture(toolSpecificData, toolTerminal.instance, commandId);
            {
              const state = toolSpecificData.terminalCommandState ?? {};
              state.timestamp = state.timestamp ?? timingStart;
              if (executeResult.exitCode !== void 0) {
                state.exitCode = executeResult.exitCode;
                if (state.timestamp !== void 0) {
                  state.duration = state.duration ?? Math.max(0, Date.now() - state.timestamp);
                }
              }
              toolSpecificData.terminalCommandState = state;
            }
            this._logService.info(`RunInTerminalTool: Finished \`${execution.strategy.type}\` execute strategy with exitCode \`${executeResult.exitCode}\`, result.length \`${executeResult.output?.length}\`, error \`${executeResult.error}\``);
            outputLineCount = executeResult.output === void 0 ? 0 : count(executeResult.output.trim(), "\n") + 1;
            exitCode = executeResult.exitCode;
            error = executeResult.error;
            const resultArr = [];
            if (executeResult.output !== void 0) {
              resultArr.push(executeResult.output);
            }
            if (executeResult.additionalInformation) {
              resultArr.push(executeResult.additionalInformation);
            }
            terminalResult = resultArr.join("\n\n");
          }
        }
      }
    } catch (e) {
      if (didTimeout && e instanceof CancellationError) {
        this._logService.debug(`RunInTerminalTool: Timeout reached, returning output collected so far`);
        error = "timeout";
        isBackgroundExecution = true;
        toolTerminal.isBackground = true;
        toolSpecificData.didContinueInBackground = true;
        this._sessionTerminalAssociations.delete(chatSessionResource);
        const timeoutOutput = getOutput(toolTerminal.instance, void 0);
        outputLineCount = timeoutOutput ? count(timeoutOutput.trim(), "\n") + 1 : 0;
        terminalResult = timeoutOutput ?? "";
      } else {
        this._logService.debug(`RunInTerminalTool: Threw exception`);
        if (e instanceof CancellationError) {
          await this._commandArtifactCollector.capture(toolSpecificData, toolTerminal.instance, commandId);
          const state = toolSpecificData.terminalCommandState ?? {};
          if (state.exitCode === void 0) {
            state.exitCode = -1;
            state.timestamp = state.timestamp ?? timingStart;
            state.duration = state.duration ?? Math.max(0, Date.now() - state.timestamp);
          }
          toolSpecificData.terminalCommandState = state;
        }
        RunInTerminalTool._activeExecutions.get(termId)?.dispose();
        this._deleteActiveExecution(termId);
        toolTerminal.instance.dispose();
        error = e instanceof CancellationError ? "canceled" : "unexpectedException";
        throw e;
      }
    } finally {
      timeoutPromise?.cancel();
      if ((isBackgroundExecution || didInputNeeded) && executionPromise) {
        executionPromise.catch((e) => {
          if (!(e instanceof CancellationError)) {
            this._logService.error(`RunInTerminalTool: Background execution error`, e);
          }
        });
        if (shouldSendNotifications) {
          const alreadyNotifiedInputNeededOutput = didInputNeeded ? terminalResult : void 0;
          this._registerCompletionNotification(toolTerminal.instance, termId, chatSessionResource, command, toolSpecificData, outputMonitor, alreadyNotifiedInputNeededOutput);
        } else {
          outputMonitor?.dispose();
        }
      } else {
        RunInTerminalTool._activeExecutions.get(termId)?.dispose();
        this._deleteActiveExecution(termId);
        outputMonitor?.dispose();
      }
      store.dispose();
      const timingExecuteMs = Date.now() - timingStart;
      this._telemetry.logInvoke(toolTerminal.instance, {
        terminalToolSessionId: toolSpecificData.terminalToolSessionId,
        didUserEditCommand,
        didToolEditCommand,
        isBackground: executionOptions.persistentSession,
        isSandboxWrapped: toolSpecificData.commandLine.isSandboxWrapped === true,
        requestUnsandboxedExecutionReason: args.requestUnsandboxedExecutionReason,
        shellIntegrationQuality: toolTerminal.shellIntegrationQuality,
        error,
        isNewSession,
        outputLineCount,
        exitCode,
        timingExecuteMs,
        timingConnectMs,
        inputUserChars,
        inputUserSigint,
        terminalExecutionIdleBeforeTimeout: pollingResult?.state === OutputMonitorState.Idle,
        pollDurationMs: pollingResult?.pollDurationMs,
        inputToolManualAcceptCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualAcceptCount,
        inputToolManualRejectCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualRejectCount,
        inputToolManualChars: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualChars,
        inputToolAutoAcceptCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolAutoAcceptCount,
        inputToolAutoChars: outputMonitor?.outputMonitorTelemetryCounters?.inputToolAutoChars,
        inputToolManualShownCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualShownCount,
        inputToolFreeFormInputCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolFreeFormInputCount,
        inputToolFreeFormInputShownCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolFreeFormInputShownCount
      });
    }
    if (altBufferResult) {
      return altBufferResult;
    }
    if (didSandboxWrapCommand && outputLooksBubblewrapHostRestricted(terminalResult)) {
      return this._getBubblewrapHostRestrictedResult();
    }
    const shouldAutoRetryUnsandboxed = shouldAutomaticallyRetryUnsandboxed({
      allowUnsandboxedCommands,
      didSandboxWrapCommand,
      requestUnsandboxedExecution: args.requestUnsandboxedExecution === true,
      isPersistentSession: executionOptions.persistentSession,
      isBackgroundExecution: isBackgroundExecution || didInputNeeded,
      didTimeout,
      exitCode,
      output: terminalResult
    });
    const shouldAutoRetryAllowNetwork = shouldAutomaticallyRetryAllowNetworkInSandboxed({
      retryWithAllowNetworkRequests: isSandboxEnabled && !isSandboxAllowNetworkEnabled && this._retryWithAllowNetworkRequests,
      didSandboxWrapCommand,
      requestUnsandboxedExecution: args.requestUnsandboxedExecution === true,
      requestAllowNetwork: args.requestAllowNetwork === true,
      isPersistentSession: executionOptions.persistentSession,
      isBackgroundExecution: isBackgroundExecution || didInputNeeded,
      didTimeout,
      exitCode,
      output: terminalResult
    });
    const automaticSandboxRetry = shouldAutoRetryAllowNetwork ? { retryKind: "allowNetwork", retryReason: automaticAllowNetworkRetryReason } : shouldAutoRetryUnsandboxed ? { retryKind: "unsandboxed", retryReason: automaticUnsandboxRetryReason } : void 0;
    if (automaticSandboxRetry) {
      const retryResult = await this._runAutomaticSandboxRetry({
        ...automaticSandboxRetry,
        invocation,
        countTokens: _countTokens,
        progress: _progress,
        token,
        args,
        toolSpecificData,
        command,
        allowUnsandboxedCommands,
        isBackground: executionOptions.persistentSession
      });
      if (retryResult) {
        return retryResult;
      }
    }
    this._terminalToolCreator.refreshShellIntegrationQuality(toolTerminal);
    this._logService.info(`RunInTerminalTool: shellIntegrationQuality=${toolTerminal.shellIntegrationQuality} at banner decision time`);
    if (!toolResultMessage && toolTerminal.shellIntegrationQuality === ShellIntegrationQuality.None) {
      toolResultMessage = "$(info) Enable [shell integration](https://code.visualstudio.com/docs/terminal/shell-integration) to improve command detection";
    }
    const resultText = [];
    if (!didSandboxWrapCommand) {
      if (didUserEditCommand) {
        resultText.push(`Note: The user manually edited the command to \`${command}\` (terminal ID=${termId}), and this is the output of running that command instead:
`);
      } else if (didToolEditCommand) {
        const wasDetachedToBackground = /(^|\s)nohup\s|Start-Process\b/.test(command);
        const stdinHint = wasDetachedToBackground ? ' Note that stdin is closed for detached background processes; do not try to send input via send_to_terminal \u2014 re-run with mode="sync" instead if interactive input is required.' : "";
        resultText.push(`Note: The tool simplified the command to \`${command}\` (terminal ID=${termId}).${stdinHint} This is the output of running that command instead:
`);
      }
      if (isBackgroundExecution && !executionOptions.persistentSession) {
        resultText.push(`Note: This terminal execution was moved to the background using the ID ${termId}
`);
      }
    }
    if (didSensitiveAutoCancelled) {
      resultText.push(`Note: The command in terminal ID ${termId} was prompting for a password, passphrase, or other secret. The user is unavailable (auto-approve / autopilot mode is on, so no human can focus the terminal to type a secret) and the command has been cancelled. Stop, do NOT retry the command, do NOT call ${TerminalToolId.SendToTerminal}, and do NOT call vscode_askQuestions for the secret. Tell the user to run the command interactively when they are available.

`);
    } else if (didInputNeeded) {
      resultText.push(`Note: The command is running in terminal ID ${termId} and may be waiting for input.
${this._buildInputNeededSteeringText(chatSessionResource, termId, "none")}

`);
    } else if (didTimeout && timeoutValue !== void 0 && timeoutValue > 0) {
      const notificationHint = shouldSendNotifications ? " You will be automatically notified on your next turn when it completes." : "";
      resultText.push(`Note: Command timed out after ${timeoutValue}ms. The command may still be running in terminal ID ${termId}.${notificationHint}
${this._buildInputNeededSteeringText(chatSessionResource, termId, "timeout")}

`);
    } else if (didIdleSilence) {
      const notificationHint = shouldSendNotifications ? " You will be automatically notified on your next turn when it completes." : "";
      resultText.push(`Note: The command produced no new output for an extended period and was moved to background terminal ID ${termId}; the process is still running and has not been killed.${notificationHint}
${this._buildInputNeededSteeringText(chatSessionResource, termId, "idleSilence")}

`);
    }
    const outputAnalyzerMessage = await this._getOutputAnalyzerMessage(exitCode, terminalResult, command, didSandboxWrapCommand);
    if (outputAnalyzerMessage) {
      resultText.push(`${outputAnalyzerMessage}
`);
    }
    let outputForResult = terminalResult;
    if (this._configurationService.getValue(TerminalChatAgentToolsSettingId.OutputCompaction) === true) {
      try {
        const commandForCompaction = toolSpecificData.commandLine.forDisplay ?? command;
        const report = compact(commandForCompaction, terminalResult);
        this._telemetry.logCompaction(report);
        if (report.applied) {
          outputForResult = report.compactedOutput;
        }
      } catch {
        this._telemetry.logCompactionFailed();
      }
    }
    const processedOutput = await this._largeOutputFileWriter.processOutput(outputForResult);
    resultText.push(processedOutput);
    const isError = exitCode !== void 0 && exitCode !== 0;
    const endCwd = await toolTerminal.instance.getCwdResource();
    const imageContent = await this._extractImagesFromOutput(terminalResult, endCwd);
    return {
      toolResultMessage,
      toolMetadata: {
        exitCode,
        id: termId,
        terminalId: toolTerminal.instance.instanceId,
        cwd: endCwd?.toString(),
        timedOut: didTimeout || void 0,
        timeoutMs: didTimeout ? timeoutValue : void 0,
        inputNeeded: didInputNeeded || void 0
      },
      toolResultDetails: isError ? {
        input: command,
        output: [{ type: "embed", isText: true, value: outputForResult }],
        isError: true
      } : void 0,
      content: [
        {
          kind: "text",
          value: resultText.join("")
        },
        ...imageContent
      ]
    };
  }
  _getBubblewrapUnsupportedResult() {
    const settingId = AgentSandboxSettingId.AgentSandboxEnabled;
    const message = localize(
      "runInTerminal.bubblewrap.unsupportedEnvironment",
      "Sandboxing is not supported in this environment. To disable sandboxing, set `{0}` to `off`. The command was not executed.",
      settingId
    );
    const settingsCommandArgs = encodeURIComponent(JSON.stringify([`@id:${settingId}`]));
    const toolResultMessage = new MarkdownString(localize(
      "runInTerminal.bubblewrap.unsupportedEnvironmentWithSettingsLink",
      'Sandboxing is not supported in this environment. [Open the `{0}` setting](command:workbench.action.openSettings?{1} "Open Settings") and set it to `off`. The command was not executed.',
      settingId,
      settingsCommandArgs
    ), { isTrusted: { enabledCommands: ["workbench.action.openSettings"] } });
    return {
      content: [{ kind: "text", value: message }],
      toolResultMessage
    };
  }
  _getBubblewrapHostRestrictedResult() {
    const settingId = AgentSandboxSettingId.AgentSandboxEnabled;
    const message = localize(
      "runInTerminal.bubblewrap.hostRestriction",
      "Sandbox creation failed due to host restrictions. Sandboxing can be disabled by setting `{0}` to `off`.",
      settingId
    );
    return {
      content: [{ kind: "text", value: message }],
      toolResultMessage: message
    };
  }
  /**
   * Builds the steering text the model sees when the terminal tool suspects
   * the command may be waiting for input. The heuristic that triggers this
   * note can false-positive on long-running compute commands or shells sitting
   * on a secondary prompt (e.g. heredoc continuation `> `), so the text
   * explicitly:
   *   1. Tells the model this note is NOT a signal to end the turn.
   *   2. In auto-approve mode, leads with `send_to_terminal` for non-secret
   *      prompts to minimize round-trips, with a `get_terminal_output` fallback.
   *   3. In default mode, leads with `get_terminal_output` as the safe
   *      recovery action and offers `vscode_askQuestions` only for real
   *      non-secret prompts. Secret prompts (passwords, passphrases,
   *      tokens) must never be routed through `vscode_askQuestions`
   *      because answers to that tool are sent through the model — the
   *      user is told to type those values directly into the terminal.
   * `kill_terminal` is only advertised when the command may be hung
   * (`'timeout'` or `'idleSilence'`) — suggesting it in the general case
   * leads the model to terminate valid interactive sessions (e.g.
   * `npm init`) instead of driving them.
   */
  _buildInputNeededSteeringText(chatSessionResource, termId, hungHint) {
    const isAutoApproved = isSessionAutoApproveLevel(chatSessionResource, this._configurationService, this._chatWidgetService, this._chatService);
    const lines = [];
    lines.push(`This note is not a signal to end the turn \u2014 pick one of the actions below and continue.`);
    if (isAutoApproved) {
      lines.push(`  1. If the output clearly ends with a non-secret input prompt (Continue? (y/n), Enter selection, etc. \u2014 a normal shell prompt like \`$\` or \`#\` does NOT count), determine the answer and immediately call ${TerminalToolId.SendToTerminal} with id="${termId}" (which returns the next few lines of output). Repeat one prompt at a time. Never guess passwords, passphrases, tokens, or other secrets \u2014 if the prompt requires a secret you do not have, inform the user and stop.`);
      lines.push(`  2. If the command may still be producing output or the shell prompt has not returned, call ${TerminalToolId.GetTerminalOutput} with id="${termId}" to continue polling.`);
    } else {
      lines.push(`  1. If the command may still be producing output or the shell prompt has not returned, call ${TerminalToolId.GetTerminalOutput} with id="${termId}" to continue polling. This is the default and safest action when unsure.`);
      lines.push(`  2. Only if the output clearly ends with a real non-secret input prompt (Continue? (y/n), Enter selection, etc. \u2014 a normal shell prompt like \`$\` or \`#\` does NOT count), call the vscode_askQuestions tool to ask the user, then send each answer using ${TerminalToolId.SendToTerminal} with id="${termId}" (which returns the next few lines of output). Repeat one prompt at a time. NEVER route secret prompts (passwords, passphrases, tokens, API keys, etc.) through vscode_askQuestions \u2014 answers to that tool are sent through the model. For secret prompts, tell the user to type the value directly into the terminal and stop.`);
    }
    if (hungHint === "timeout") {
      lines.push(`  3. A timeout does not mean the command failed \u2014 call ${TerminalToolId.GetTerminalOutput} with id="${termId}" to continue polling. Only call ${TerminalToolId.KillTerminal} if the command is genuinely hung and you need to retry with a different approach.`);
    } else if (hungHint === "idleSilence") {
      lines.push(`  3. Producing no output for an extended period does not mean the command failed \u2014 call ${TerminalToolId.GetTerminalOutput} with id="${termId}" to continue polling. Only call ${TerminalToolId.KillTerminal} if the command is genuinely hung and you need to retry with a different approach.`);
    }
    return lines.join("\n");
  }
  async _getOutputAnalyzerMessage(exitCode, exitResult, commandLine, isSandboxWrapped) {
    for (const analyzer of this._outputAnalyzers) {
      const message = await analyzer.analyze({ exitCode, exitResult, commandLine, isSandboxWrapped });
      if (message) {
        return message;
      }
    }
    return void 0;
  }
  static {
    this._maxImageFileSize = 5 * 1024 * 1024;
  }
  /**
   * Scans terminal output for file paths that point to images and reads them.
   * Returns data content parts for any found images that exist on disk.
   */
  async _extractImagesFromOutput(output, cwd) {
    const pathPattern = /[^\s/\\]*(?:[/\\][^\s/\\]*)+\.(?:png|jpe?g|gif|webp|bmp)/gi;
    const matches = /* @__PURE__ */ new Set();
    for (const line of output.split(/\r?\n/)) {
      if (line.length > 1e4) {
        continue;
      }
      for (const match of line.matchAll(pathPattern)) {
        matches.add(match[0]);
      }
    }
    if (matches.size === 0) {
      return [];
    }
    const results = [];
    for (const filePath of matches) {
      try {
        const mimeType = getMediaMime(filePath);
        if (!mimeType || !mimeType.startsWith("image/")) {
          continue;
        }
        let fileUri;
        if (/^\/|^[A-Za-z]:[\\\/]/.test(filePath)) {
          fileUri = URI.file(filePath);
        } else if (cwd) {
          fileUri = URI.joinPath(cwd, filePath);
        } else {
          continue;
        }
        const stat = await this._fileService.stat(fileUri).catch(() => void 0);
        if (!stat || stat.isDirectory || stat.size > RunInTerminalTool._maxImageFileSize) {
          continue;
        }
        const fileContent = await this._fileService.readFile(fileUri);
        results.push({
          kind: "data",
          value: {
            mimeType,
            data: fileContent.value
          },
          audience: [LanguageModelPartAudience.User]
        });
      } catch {
      }
    }
    return results;
  }
  _handleTerminalVisibility(toolTerminal, chatSessionResource) {
    const chatSessionOpenInWidget = !!this._chatWidgetService.getWidgetBySessionResource(chatSessionResource);
    if (this._configurationService.getValue(TerminalChatAgentToolsSettingId.OutputLocation) === "terminal" && chatSessionOpenInWidget) {
      this._terminalService.setActiveInstance(toolTerminal.instance);
      this._terminalService.revealTerminal(toolTerminal.instance, true);
    }
  }
  // #region Terminal init
  /**
   * Initializes a terminal for command execution. For foreground mode, reuses existing cached
   * terminal from the session. For background mode, always creates a new terminal to allow
   * parallel execution.
   */
  async _initTerminal(chatSessionResource, termId, terminalToolSessionId, isBackground, token) {
    if (!isBackground) {
      const cachedTerminal = this._sessionTerminalAssociations.get(chatSessionResource);
      if (cachedTerminal && !cachedTerminal.isBackground && !cachedTerminal.instance.isDisposed) {
        if (cachedTerminal.instance.exitCode !== void 0) {
          this._logService.info(`RunInTerminalTool: Cached terminal shell has exited (code=${cachedTerminal.instance.exitCode}), creating a new terminal`);
          this._sessionTerminalAssociations.delete(chatSessionResource);
        } else {
          this._logService.debug(`RunInTerminalTool: Using cached terminal with session resource \`${chatSessionResource}\``);
          this._terminalToolCreator.refreshShellIntegrationQuality(cachedTerminal);
          this._terminalChatService.registerTerminalInstanceWithToolSession(terminalToolSessionId, cachedTerminal.instance);
          this._backgroundNotifications.deleteAndDispose(cachedTerminal.instance.instanceId);
          return cachedTerminal;
        }
      }
    }
    this._logService.debug(`RunInTerminalTool: Creating ${isBackground ? "background" : "foreground"} terminal with ID=${termId}`);
    const profile = await this._profileFetcher.getCopilotProfile();
    const os = await this._osBackend;
    const toolTerminal = await this._terminalToolCreator.createTerminal(profile, os, token);
    toolTerminal.isBackground = isBackground;
    this._terminalChatService.registerTerminalInstanceWithToolSession(terminalToolSessionId, toolTerminal.instance);
    this._terminalChatService.registerTerminalInstanceWithChatSession(chatSessionResource, toolTerminal.instance);
    this._registerInputListener(toolTerminal);
    this._addSessionTerminalAssociation(chatSessionResource, toolTerminal);
    if (token.isCancellationRequested) {
      toolTerminal.instance.dispose();
      throw new CancellationError();
    }
    await this._setupProcessIdAssociation(toolTerminal, chatSessionResource, termId, isBackground);
    return toolTerminal;
  }
  _registerInputListener(toolTerminal) {
    const disposable = toolTerminal.instance.onData((data) => {
      if (!telemetryIgnoredSequences.includes(data)) {
        toolTerminal.receivedUserInput = data.length > 0;
      }
    });
    Event.once(toolTerminal.instance.onDisposed)(() => disposable.dispose());
  }
  // #endregion
  // #region Session management
  _restoreTerminalAssociations() {
    const storedAssociations = this._storageService.get("chat.terminalSessions" /* TerminalSession */, StorageScope.WORKSPACE, "{}");
    try {
      const associations = JSON.parse(storedAssociations);
      for (const instance of this._terminalService.instances) {
        if (instance.processId) {
          const association = associations[instance.processId];
          if (association) {
            const chatSessionResource = LocalChatSessionUri.forSession(association.sessionId);
            this._logService.debug(`RunInTerminalTool: Restored terminal association for PID ${instance.processId}, session ${association.sessionId}`);
            const toolTerminal = {
              instance,
              shellIntegrationQuality: association.shellIntegrationQuality,
              isBackground: association.isBackground
            };
            this._addSessionTerminalAssociation(chatSessionResource, toolTerminal);
            this._terminalChatService.registerTerminalInstanceWithChatSession(chatSessionResource, instance);
            if (association.id) {
              this._setActiveExecution(association.id, this._register(new RestoredTerminalExecution(instance)));
            }
            Event.once(instance.onDisposed)(() => {
              this._removeProcessIdAssociation(instance.processId);
              this._removeExecutionAssociations(instance);
            });
          }
        }
      }
    } catch (error) {
      this._logService.debug(`RunInTerminalTool: Failed to restore terminal associations: ${error}`);
    }
  }
  async _setupProcessIdAssociation(toolTerminal, chatSessionResource, termId, isBackground) {
    await this._associateProcessIdWithSession(toolTerminal.instance, chatSessionResource, termId, toolTerminal.shellIntegrationQuality, isBackground);
    Event.once(toolTerminal.instance.onDisposed)(() => {
      if (toolTerminal.instance.processId) {
        this._removeProcessIdAssociation(toolTerminal.instance.processId);
      }
    });
  }
  async _associateProcessIdWithSession(terminal, chatSessionResource, id, shellIntegrationQuality, isBackground) {
    try {
      const pid = await Promise.race([
        terminal.processReady.then(() => terminal.processId),
        timeout(5e3).then(() => {
          throw new Error("Timeout");
        })
      ]);
      if (isNumber(pid)) {
        const storedAssociations = this._storageService.get("chat.terminalSessions" /* TerminalSession */, StorageScope.WORKSPACE, "{}");
        const associations = JSON.parse(storedAssociations);
        const sessionId = chatSessionResourceToId(chatSessionResource);
        const existingAssociation = associations[pid] || {};
        associations[pid] = {
          ...existingAssociation,
          sessionId,
          shellIntegrationQuality,
          id,
          isBackground
        };
        this._storageService.store("chat.terminalSessions" /* TerminalSession */, JSON.stringify(associations), StorageScope.WORKSPACE, StorageTarget.USER);
        this._logService.debug(`RunInTerminalTool: Associated terminal PID ${pid} with session ${sessionId}`);
      }
    } catch (error) {
      this._logService.debug(`RunInTerminalTool: Failed to associate terminal with session: ${error}`);
    }
  }
  async _removeProcessIdAssociation(pid) {
    try {
      const storedAssociations = this._storageService.get("chat.terminalSessions" /* TerminalSession */, StorageScope.WORKSPACE, "{}");
      const associations = JSON.parse(storedAssociations);
      if (associations[pid]) {
        delete associations[pid];
        this._storageService.store("chat.terminalSessions" /* TerminalSession */, JSON.stringify(associations), StorageScope.WORKSPACE, StorageTarget.USER);
        this._logService.debug(`RunInTerminalTool: Removed terminal association for PID ${pid}`);
      }
    } catch (error) {
      this._logService.debug(`RunInTerminalTool: Failed to remove terminal association: ${error}`);
    }
  }
  _cleanupSessionTerminals(chatSessionResource) {
    const sessionTerminals = this._sessionTerminalInstances.get(chatSessionResource);
    const toolTerminal = this._sessionTerminalAssociations.get(chatSessionResource);
    const terminalsToDispose = sessionTerminals ?? (toolTerminal ? /* @__PURE__ */ new Set([toolTerminal.instance]) : void 0);
    if (!terminalsToDispose || terminalsToDispose.size === 0) {
      return;
    }
    const shouldPreserveTerminalsForOutputLocation = this._configurationService.getValue(TerminalChatAgentToolsSettingId.OutputLocation) === "terminal";
    this._logService.debug(`RunInTerminalTool: Cleaning up ${terminalsToDispose.size} terminal(s) for ended chat session ${chatSessionResource}`);
    this._sessionTerminalAssociations.delete(chatSessionResource);
    this._sessionTerminalInstances.delete(chatSessionResource);
    for (const terminal of terminalsToDispose) {
      if (this._terminalService.foregroundInstances.includes(terminal) || shouldPreserveTerminalsForOutputLocation) {
        this._logService.debug(`RunInTerminalTool: Skipping disposal of preserved terminal ${terminal.instanceId} for session ${chatSessionResource}`);
        continue;
      }
      this._terminalsBeingDisposedBySessionCleanup.add(terminal);
      terminal.dispose();
    }
    const terminalToRemove = [];
    for (const [termId, execution] of RunInTerminalTool._activeExecutions.entries()) {
      if (terminalsToDispose.has(execution.instance)) {
        if (this._terminalService.foregroundInstances.includes(execution.instance) || shouldPreserveTerminalsForOutputLocation) {
          continue;
        }
        execution.dispose();
        terminalToRemove.push(termId);
      }
    }
    for (const termId of terminalToRemove) {
      this._deleteActiveExecution(termId);
    }
  }
  _addSessionTerminalAssociation(chatSessionResource, toolTerminal) {
    this._ensureArchivedSessionListener();
    let sessionTerminals = this._sessionTerminalInstances.get(chatSessionResource);
    if (!sessionTerminals) {
      sessionTerminals = /* @__PURE__ */ new Set();
      this._sessionTerminalInstances.set(chatSessionResource, sessionTerminals);
    }
    sessionTerminals.add(toolTerminal.instance);
    if (!toolTerminal.isBackground) {
      this._sessionTerminalAssociations.set(chatSessionResource, toolTerminal);
    }
  }
  _ensureArchivedSessionListener() {
    if (this._archivedSessionListener.value) {
      return;
    }
    this._archivedSessionListener.value = this._agentSessionsService.onDidChangeSessionArchivedState((session) => {
      if (session.isArchived()) {
        this._cleanupSessionTerminals(session.resource);
      }
    });
  }
  _removeTerminalAssociations(terminal) {
    if (this._terminalsBeingDisposedBySessionCleanup.delete(terminal)) {
      this._removeExecutionAssociations(terminal);
      return;
    }
    for (const [sessionResource, toolTerminal] of this._sessionTerminalAssociations.entries()) {
      if (terminal === toolTerminal.instance) {
        this._sessionTerminalAssociations.delete(sessionResource);
      }
    }
    for (const [sessionResource, sessionTerminals] of this._sessionTerminalInstances.entries()) {
      if (!sessionTerminals.delete(terminal)) {
        continue;
      }
      if (sessionTerminals.size === 0) {
        this._sessionTerminalInstances.delete(sessionResource);
      }
    }
    this._removeExecutionAssociations(terminal);
  }
  _removeExecutionAssociations(terminal) {
    const executionIdsToRemove = [];
    for (const [termId, execution] of RunInTerminalTool._activeExecutions.entries()) {
      if (execution.instance === terminal) {
        execution.dispose();
        executionIdsToRemove.push(termId);
      }
    }
    for (const termId of executionIdsToRemove) {
      this._deleteActiveExecution(termId);
    }
  }
  /**
   * Registers a listener for command completion on a background terminal.
   * When a command finishes, sends a steering message to the chat session
   * so the agent is notified on its next turn.
   *
   * If an output monitor is provided, it is continued in background mode
   * to detect prompts-for-input while the terminal runs in the background.
   * The output monitor is cancelled and disposed when a command finishes.
   */
  _registerCompletionNotification(terminalInstance, termId, chatSessionResource, commandName, toolSpecificData, outputMonitor, alreadyNotifiedInputNeededOutput) {
    const notificationKey = terminalInstance.instanceId;
    this._backgroundNotifications.deleteAndDispose(notificationKey);
    const commandDetection = terminalInstance.capabilities.get(TerminalCapability.CommandDetection);
    if (!commandDetection) {
      outputMonitor?.dispose();
      return;
    }
    const commandDisplay = appendEscapedMarkdownInlineCode(buildCompletionNotificationCommand(commandName));
    const sessionRef = this._chatService.acquireExistingSession(chatSessionResource, "RunInTerminalTool#completionNotification");
    if (!sessionRef) {
      this._logService.warn(`RunInTerminalTool: Cannot register completion notification for terminal ${termId} - session already disposed`);
      outputMonitor?.dispose();
      return;
    }
    const lastRequest = sessionRef.object.lastRequest;
    const sendOptions = {};
    if (lastRequest) {
      sendOptions.userSelectedModelId = lastRequest.modelId;
      sendOptions.modeInfo = lastRequest.modeInfo;
      sendOptions.agentIdSilent = lastRequest.response?.agent?.id;
      if (lastRequest.userSelectedTools) {
        sendOptions.userSelectedTools = constObservable(lastRequest.userSelectedTools);
      }
    }
    const store = new DisposableStore();
    let userIsReplyingDirectly = false;
    const disposeNotification = () => this._backgroundNotifications.deleteAndDispose(notificationKey);
    const handleSessionCancelled = () => {
      if (sessionRef.object.lastRequest?.response?.isCanceled) {
        disposeNotification();
        return true;
      }
      return false;
    };
    store.add(autorun((reader) => {
      const request = sessionRef.object.lastRequestObs.read(reader);
      if (!request?.response) {
        return;
      }
      reader.store.add(request.response.onDidChange((ev) => {
        if (ev.reason === "completedRequest" && request.response.isCanceled) {
          disposeNotification();
        }
      }));
    }));
    if (outputMonitor) {
      let lastInputNeededOutput = alreadyNotifiedInputNeededOutput ?? "";
      let lastInputNeededNotificationTime = alreadyNotifiedInputNeededOutput !== void 0 ? Date.now() : 0;
      const bgCts = new CancellationTokenSource();
      store.add(toDisposable(() => {
        bgCts.cancel();
        bgCts.dispose();
      }));
      store.add(outputMonitor);
      outputMonitor.continueMonitoringAsync(bgCts.token);
      store.add(this._registerSensitiveInputElicitation(
        chatSessionResource,
        terminalInstance,
        outputMonitor,
        () => {
          const execution = RunInTerminalTool._activeExecutions.get(termId);
          execution?.dispose();
        }
      ));
      store.add(outputMonitor.onDidDetectInputNeeded(() => {
        if (userIsReplyingDirectly) {
          this._logService.debug(`RunInTerminalTool: Suppressing input-needed notification for terminal ${termId} because user is replying directly`);
          return;
        }
        if (terminalInstance.isDisposed) {
          this._logService.debug(`RunInTerminalTool: Suppressing input-needed notification for terminal ${termId} because the terminal is disposed`);
          return;
        }
        if (handleSessionCancelled()) {
          return;
        }
        const execution = RunInTerminalTool._activeExecutions.get(termId);
        if (!execution) {
          return;
        }
        const currentOutput = execution.getOutput();
        const now = Date.now();
        const isDuplicate = currentOutput === lastInputNeededOutput && now - lastInputNeededNotificationTime < INPUT_NEEDED_NOTIFICATION_THROTTLE_MS;
        if (isDuplicate) {
          return;
        }
        lastInputNeededOutput = currentOutput;
        lastInputNeededNotificationTime = now;
        const inputAction = this._buildInputNeededSteeringText(chatSessionResource, termId, "none");
        const message = `[Terminal ${termId} notification: command may be waiting for input \u2014 assess the output below.]
${inputAction}
Terminal output:
${currentOutput}`;
        this._logService.debug(`RunInTerminalTool: Input needed in background terminal ${termId}, notifying chat session`);
        this._chatService.sendRequest(chatSessionResource, message, {
          ...sendOptions,
          queue: ChatRequestQueueKind.Steering,
          isSystemInitiated: true,
          systemInitiatedLabel: localize("terminalAssessingOutput", "{0} may need input", commandDisplay),
          terminalExecutionId: termId
        }).catch((e) => {
          this._logService.warn(`RunInTerminalTool: Failed to send input-needed notification for terminal ${termId}`, e);
        });
      }));
    }
    store.add(terminalInstance.onDidInputData(() => {
      if (userIsReplyingDirectly) {
        return;
      }
      userIsReplyingDirectly = true;
      this._dismissPendingCarouselsForTerminal(chatSessionResource, termId);
    }));
    store.add(sessionRef);
    store.add(commandDetection.onCommandFinished((command) => {
      const execution = RunInTerminalTool._activeExecutions.get(termId);
      if (!execution) {
        disposeNotification();
        return;
      }
      if (handleSessionCancelled()) {
        return;
      }
      disposeNotification();
      const exitCode = command.exitCode;
      const exitCodeText = exitCode !== void 0 && exitCode !== 0 ? ` with exit code ${exitCode}` : "";
      const currentOutput = execution.getOutput();
      const isUserVisible = this._terminalService.foregroundInstances.includes(terminalInstance);
      const message = isUserVisible ? `[Terminal ${termId} notification: command completed${exitCodeText}. Use send_to_terminal to send another command or kill_terminal to stop it.]
Terminal output:
${currentOutput}` : `[Terminal ${termId} notification: command completed${exitCodeText}. The terminal has been cleaned up.]
Terminal output:
${currentOutput}`;
      this._logService.debug(`RunInTerminalTool: Command completed in background terminal ${termId}, notifying chat session`);
      this._chatService.sendRequest(chatSessionResource, message, {
        ...sendOptions,
        queue: ChatRequestQueueKind.Steering,
        isSystemInitiated: true,
        systemInitiatedLabel: localize("terminalCommandCompleted", "{0} completed", commandDisplay),
        terminalExecutionId: termId
      }).catch((e) => {
        this._logService.warn(`RunInTerminalTool: Failed to send completion notification for terminal ${termId}`, e);
      });
      this._commandArtifactCollector.capture(toolSpecificData, terminalInstance, command.id).then(() => {
        if (this._terminalService.foregroundInstances.includes(terminalInstance)) {
          this._logService.debug(`RunInTerminalTool: Background terminal ${termId} was revealed by user, skipping disposal`);
          return;
        }
        this._logService.debug(`RunInTerminalTool: Disposing finished background terminal ${termId}`);
        RunInTerminalTool._killedByTool.add(termId);
        execution.dispose();
        this._deleteActiveExecution(termId);
        terminalInstance.dispose();
      });
    }));
    const executionForDisposal = RunInTerminalTool._activeExecutions.get(termId);
    store.add(terminalInstance.onDisposed(() => {
      if (RunInTerminalTool._killedByTool.has(termId)) {
        disposeNotification();
        return;
      }
      if (this._isShuttingDown) {
        disposeNotification();
        return;
      }
      if (terminalInstance.exitReason === TerminalExitReason.User) {
        this._logService.debug(`RunInTerminalTool: Background terminal ${termId} closed by user, suppressing steering message`);
        disposeNotification();
        return;
      }
      if (handleSessionCancelled()) {
        return;
      }
      const currentOutput = executionForDisposal?.getOutput() ?? "";
      const exitCode = terminalInstance.exitCode;
      const exitCodeText = exitCode !== void 0 && exitCode !== 0 ? ` with exit code ${exitCode}` : "";
      disposeNotification();
      const message = `[Terminal ${termId} notification: terminal exited${exitCodeText}. The terminal process ended before the command could complete normally; further commands cannot be sent to this terminal ID.]
Terminal output:
${currentOutput}`;
      this._logService.debug(`RunInTerminalTool: Background terminal ${termId} disposed${exitCodeText}, notifying chat session`);
      this._chatService.sendRequest(chatSessionResource, message, {
        ...sendOptions,
        queue: ChatRequestQueueKind.Steering,
        isSystemInitiated: true,
        systemInitiatedLabel: localize("terminalProcessExited", "{0} terminal exited", commandDisplay),
        terminalExecutionId: termId
      }).catch((e) => {
        this._logService.warn(`RunInTerminalTool: Failed to send terminal-exited notification for terminal ${termId}`, e);
      });
    }));
    store.add(sessionRef.object.onDidChange((e) => {
      if (e.kind === "removeRequest") {
        this._logService.debug(`RunInTerminalTool: Request removed from session, cleaning up background terminal ${termId}`);
        RunInTerminalTool._activeExecutions.get(termId)?.dispose();
        this._deleteActiveExecution(termId);
        disposeNotification();
        terminalInstance.dispose();
      }
    }));
    this._backgroundNotifications.set(notificationKey, store);
  }
  /**
   * Find and dismiss any pending (not yet answered) question carousels that
   * are associated with the given terminal. This is called when the user
   * types directly into the terminal, bypassing the carousel UI.
   */
  _dismissPendingCarouselsForTerminal(chatSessionResource, termId) {
    const model = this._chatService.getSession(chatSessionResource);
    if (!model) {
      return;
    }
    const requests = model.getRequests();
    for (let i = requests.length - 1; i >= 0; i--) {
      const response = requests[i].response;
      if (!response) {
        continue;
      }
      const parts = response.response.value;
      for (let j = parts.length - 1; j >= 0; j--) {
        const part = parts[j];
        if (part instanceof ChatQuestionCarouselData && part.terminalId === termId && !part.isUsed) {
          this._logService.debug(`RunInTerminalTool: Dismissing pending carousel for terminal ${termId} because user typed directly in terminal`);
          part.data = {};
          part.isUsed = true;
          part.dismissedByTerminalInput = true;
          part.completion.complete({ answers: void 0 });
          return;
        }
      }
    }
  }
  // #endregion
};
RunInTerminalTool = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IHistoryService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ILanguageModelToolsService),
  __decorateParam(7, IRemoteAgentService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, ITerminalChatService),
  __decorateParam(10, ITerminalLogService),
  __decorateParam(11, ITerminalService),
  __decorateParam(12, ITerminalSandboxService),
  __decorateParam(13, IWorkspaceContextService),
  __decorateParam(14, IChatWidgetService),
  __decorateParam(15, IAgentSessionsService),
  __decorateParam(16, ILifecycleService)
], RunInTerminalTool);
let ActiveTerminalExecution = class extends Disposable {
  constructor(sessionResource, termId, toolTerminal, commandDetection, isBackground, _instantiationService) {
    super();
    this.sessionResource = sessionResource;
    this.termId = termId;
    this._instantiationService = _instantiationService;
    this._toolTerminal = toolTerminal;
    this._isBackground = isBackground;
    this._completionDeferred = new DeferredPromise();
    this.strategy = this._register(this._createStrategy(commandDetection));
    this._register(this.strategy.onDidCreateStartMarker((marker) => {
      if (marker) {
        this._startMarker = marker;
      }
    }));
  }
  /**
   * The promise that resolves when the execute strategy completes. Can be awaited to get the
   * full result with exit code.
   */
  get completionPromise() {
    return this._completionDeferred.p;
  }
  get isBackground() {
    return this._isBackground;
  }
  get startMarker() {
    return this._startMarker;
  }
  get instance() {
    return this._toolTerminal.instance;
  }
  _createStrategy(commandDetection) {
    const isSyncMode = !this._isBackground;
    switch (this._toolTerminal.shellIntegrationQuality) {
      case ShellIntegrationQuality.None:
        return this._instantiationService.createInstance(NoneExecuteStrategy, this._toolTerminal.instance, () => this._toolTerminal.receivedUserInput ?? false);
      case ShellIntegrationQuality.Basic:
        return this._instantiationService.createInstance(BasicExecuteStrategy, this._toolTerminal.instance, () => this._toolTerminal.receivedUserInput ?? false, commandDetection);
      case ShellIntegrationQuality.Rich:
        return this._instantiationService.createInstance(RichExecuteStrategy, this._toolTerminal.instance, commandDetection, isSyncMode);
    }
  }
  /**
   * Starts the command execution using the execute strategy.
   * @param commandLine The command to execute
   * @param token Cancellation token
   * @param commandId Optional command ID for linking
   * @returns The execution result
   */
  async start(commandLine, token, commandId, commandLineForMetadata) {
    try {
      const result = await this.strategy.execute(commandLine, token, commandId, commandLineForMetadata);
      this._completionDeferred.complete(result);
      return result;
    } catch (e) {
      this._completionDeferred.error(e);
      throw e;
    }
  }
  /**
   * Switches this execution to foreground mode, meaning callers will await its completion.
   */
  setForeground() {
    this._isBackground = false;
  }
  /**
   * Switches this execution to background mode.
   */
  setBackground() {
    this._isBackground = true;
  }
  /**
   * Gets the current output from the terminal.
   */
  getOutput(marker) {
    return getOutput(this.instance, marker ?? this._startMarker);
  }
};
ActiveTerminalExecution = __decorateClass([
  __decorateParam(5, IInstantiationService)
], ActiveTerminalExecution);
class RestoredTerminalExecution extends Disposable {
  constructor(instance) {
    super();
    this.instance = instance;
    this.completionPromise = Promise.resolve({ output: void 0, error: "restoredTerminalExecutionNotAwaitable" });
  }
  getOutput(marker) {
    return getOutput(this.instance, marker);
  }
}
let TerminalProfileFetcher = class {
  constructor(_configurationService, _terminalProfileResolverService, _remoteAgentService, _fileService, _logService) {
    this._configurationService = _configurationService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._remoteAgentService = _remoteAgentService;
    this._fileService = _fileService;
    this._logService = _logService;
    this.osBackend = this._remoteAgentService.getEnvironment().then((remoteEnv) => remoteEnv?.os ?? OS);
  }
  static {
    this._posixShellFallbacks = ["/bin/bash", "/usr/bin/bash", "/bin/sh"];
  }
  async getCopilotProfile() {
    const os = await this.osBackend;
    const customChatAgentProfile = this._getChatTerminalProfile(os);
    if (customChatAgentProfile) {
      return customChatAgentProfile;
    }
    const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({
      os,
      remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority
    });
    if (basename(defaultProfile.path) === "cmd.exe") {
      return {
        ...defaultProfile,
        path: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        profileName: "PowerShell"
      };
    }
    if (defaultProfile.path === "/bin/sh") {
      return {
        ...defaultProfile,
        path: "/bin/bash",
        profileName: "bash"
      };
    }
    if (os !== OperatingSystem.Windows) {
      const shellExists = await this._shellExists(defaultProfile.path);
      if (!shellExists) {
        const fallbackPath = await this._findFallbackShell();
        if (fallbackPath) {
          this._logService.warn(`TerminalProfileFetcher: resolved shell "${defaultProfile.path}" does not exist, falling back to "${fallbackPath}"`);
          return {
            ...defaultProfile,
            path: fallbackPath,
            profileName: basename(fallbackPath),
            icon: void 0
          };
        }
      }
    }
    return { ...defaultProfile, icon: void 0 };
  }
  async _shellExists(shellPath) {
    try {
      const remoteAuthority = this._remoteAgentService.getConnection()?.remoteAuthority;
      const resource = remoteAuthority ? URI.file(shellPath).with({ scheme: "vscode-remote", authority: remoteAuthority }) : URI.file(shellPath);
      return await this._fileService.exists(resource);
    } catch {
      return false;
    }
  }
  async _findFallbackShell() {
    for (const candidate of TerminalProfileFetcher._posixShellFallbacks) {
      if (await this._shellExists(candidate)) {
        return candidate;
      }
    }
    return void 0;
  }
  async getCopilotShell() {
    return (await this.getCopilotProfile()).path;
  }
  _getChatTerminalProfile(os) {
    let profileSetting;
    switch (os) {
      case OperatingSystem.Windows:
        profileSetting = TerminalChatAgentToolsSettingId.TerminalProfileWindows;
        break;
      case OperatingSystem.Macintosh:
        profileSetting = TerminalChatAgentToolsSettingId.TerminalProfileMacOs;
        break;
      case OperatingSystem.Linux:
      default:
        profileSetting = TerminalChatAgentToolsSettingId.TerminalProfileLinux;
        break;
    }
    const profile = this._configurationService.getValue(profileSetting);
    if (this._isValidChatAgentTerminalProfile(profile)) {
      return profile;
    }
    return void 0;
  }
  _isValidChatAgentTerminalProfile(profile) {
    if (profile === null || profile === void 0 || typeof profile !== "object") {
      return false;
    }
    if ("path" in profile && isString(profile.path)) {
      return true;
    }
    return false;
  }
};
TerminalProfileFetcher = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITerminalProfileResolverService),
  __decorateParam(2, IRemoteAgentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ITerminalLogService)
], TerminalProfileFetcher);
export {
  RunInTerminalTool,
  TerminalProfileFetcher,
  buildCompletionNotificationCommand,
  createRunInTerminalToolData,
  createSandboxLines,
  createSandboxProperties,
  outputLooksBubblewrapHostRestricted,
  shouldAutomaticallyRetryAllowNetworkInSandboxed,
  shouldAutomaticallyRetryUnsandboxed
};
