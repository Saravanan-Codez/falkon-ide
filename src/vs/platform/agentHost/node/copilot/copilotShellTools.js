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
import { generateUuid } from "../../../../base/common/uuid.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { IEnvironmentService } from "../../../environment/common/environment.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { IProductService } from "../../../product/common/productService.js";
import { ISandboxHelperService } from "../../../sandbox/common/sandboxHelperService.js";
import { TerminalClaimKind } from "../../common/state/protocol/state.js";
import { isZsh } from "../agentHostShellUtils.js";
import { IAgentHostTerminalManager } from "../agentHostTerminalManager.js";
import { createAgentHostSandboxEngine } from "./agentHostSandboxEngine.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { DEFAULT_SHELL_COMMAND_TIMEOUT_MS, executeShellCommand, isMultilineCommand, prefixForHistorySuppression, prepareOutputForModel, shellTypeForExecutable } from "../shared/shellCommandExecution.js";
const ALT_BUFFER_MESSAGE = "The command opened the alternate buffer and is still running in the terminal. It likely launched an interactive terminal UI. Use write_bash/write_powershell to interact with it, or shutdown the shell to stop it.";
let ShellManager = class extends Disposable {
  constructor(_sessionUri, workingDirectory, _terminalManager, _logService, _instantiationService, _environmentService, _productService, _agentConfigurationService, _sandboxHelper) {
    super();
    this._sessionUri = _sessionUri;
    this.workingDirectory = workingDirectory;
    this._terminalManager = _terminalManager;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._agentConfigurationService = _agentConfigurationService;
    this._sandboxHelper = _sandboxHelper;
    this._shells = /* @__PURE__ */ new Map();
    this._toolCallShells = /* @__PURE__ */ new Map();
    /** Set of shell ids currently executing a command and unsafe to share. */
    this._busyShellIds = /* @__PURE__ */ new Set();
    /** Release listeners for shells held after a tool returns while the command is still running. */
    this._heldShellReleaseListeners = /* @__PURE__ */ new Map();
    this._onDidAssociateTerminal = this._register(new Emitter());
    this.onDidAssociateTerminal = this._onDidAssociateTerminal.event;
    this._register(toDisposable(() => {
      for (const store of this._heldShellReleaseListeners.values()) {
        store.dispose();
      }
      this._heldShellReleaseListeners.clear();
      for (const shell of this._shells.values()) {
        if (this._terminalManager.hasTerminal(shell.terminalUri)) {
          this._terminalManager.disposeTerminal(shell.terminalUri);
        }
      }
      this._shells.clear();
      this._toolCallShells.clear();
      this._busyShellIds.clear();
    }));
  }
  /**
   * Resolves the session's shell executable via {@link IAgentHostTerminalManager.getDefaultShell}
   * and caches it so every tool call in the session uses the same binary
   * (keeps `shellType`, sentinel format, and history suppression consistent).
   */
  getResolvedExecutable() {
    if (!this._resolvedExecutable) {
      this._resolvedExecutable = this._terminalManager.getDefaultShell();
    }
    return this._resolvedExecutable;
  }
  /**
   * Lazily constructs the per-session {@link TerminalSandboxEngine}. The engine
   * is registered for disposal alongside the {@link ShellManager}; its temp dir
   * is cleaned up best-effort on dispose.
   */
  getOrCreateSandboxEngine() {
    if (!this._sandboxEngine) {
      const sessionId = this._sessionUri.path.split("/").pop() ?? generateUuid();
      const engine = createAgentHostSandboxEngine(
        this._instantiationService,
        this._environmentService,
        this._productService,
        this._agentConfigurationService,
        this._sandboxHelper,
        sessionId,
        this.workingDirectory
      );
      this._register(engine);
      this._register(toDisposable(() => {
        void engine.cleanupTempDir().catch((err) => this._logService.warn("[ShellManager] Sandbox temp dir cleanup failed", err));
      }));
      this._sandboxEngine = engine;
    }
    return this._sandboxEngine;
  }
  /**
   * Acquire a shell of the given type for executing a single command. The
   * returned reference holds the shell exclusively — its terminal will not
   * be handed out to another concurrent caller until the reference is
   * disposed. If no idle shell of the requested type exists, a new one is
   * created.
   */
  async getOrCreateShell(shellType, turnId, toolCallId, cwd) {
    for (const shell2 of this._shells.values()) {
      if (shell2.shellType !== shellType || !this._terminalManager.hasTerminal(shell2.terminalUri)) {
        continue;
      }
      const exitCode = this._terminalManager.getExitCode(shell2.terminalUri);
      if (exitCode !== void 0) {
        this._shells.delete(shell2.id);
        continue;
      }
      if (this._busyShellIds.has(shell2.id)) {
        continue;
      }
      this._busyShellIds.add(shell2.id);
      this._trackToolCall(toolCallId, shell2.id);
      return this._makeReference(shell2);
    }
    const id = generateUuid();
    const terminalUri = `agenthost-terminal://shell/${id}`;
    const claim = {
      kind: TerminalClaimKind.Session,
      session: this._sessionUri.toString(),
      turnId,
      toolCallId
    };
    const shellDisplayName = shellType === "bash" ? "Bash" : "PowerShell";
    const executable = await this.getResolvedExecutable();
    await this._terminalManager.createTerminal({
      channel: terminalUri,
      claim,
      name: shellDisplayName,
      cwd: cwd ?? this.workingDirectory?.fsPath
    }, { shell: executable, preventShellHistory: true, nonInteractive: true });
    const shell = { id, terminalUri, shellType, executable };
    this._shells.set(id, shell);
    this._busyShellIds.add(id);
    this._trackToolCall(toolCallId, id);
    this._logService.info(`[ShellManager] Created ${shellType} shell ${id} (terminal=${terminalUri},  executable=${executable})`);
    return this._makeReference(shell);
  }
  _makeReference(shell) {
    let disposed = false;
    return {
      object: shell,
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        this._busyShellIds.delete(shell.id);
      }
    };
  }
  holdShellUntilCommandFinishes(shell) {
    if (this._heldShellReleaseListeners.has(shell.id)) {
      return;
    }
    const store = new DisposableStore();
    const release = () => {
      this._busyShellIds.delete(shell.id);
      this._heldShellReleaseListeners.delete(shell.id);
      store.dispose();
    };
    store.add(this._terminalManager.onCommandFinished(shell.terminalUri, release));
    store.add(this._terminalManager.onExit(shell.terminalUri, release));
    this._heldShellReleaseListeners.set(shell.id, store);
  }
  _trackToolCall(toolCallId, shellId) {
    this._toolCallShells.set(toolCallId, shellId);
    const shell = this._shells.get(shellId);
    if (shell) {
      const displayName = shell.shellType === "bash" ? "Bash" : "PowerShell";
      this._onDidAssociateTerminal.fire({ toolCallId, terminalUri: shell.terminalUri, displayName });
    }
  }
  getTerminalUriForToolCall(toolCallId) {
    const shellId = this._toolCallShells.get(toolCallId);
    if (!shellId) {
      return void 0;
    }
    return this._shells.get(shellId)?.terminalUri;
  }
  getShell(id) {
    return this._shells.get(id);
  }
  listShells() {
    const result = [];
    for (const shell of this._shells.values()) {
      if (this._terminalManager.hasTerminal(shell.terminalUri)) {
        result.push(shell);
      }
    }
    return result;
  }
  shutdownShell(id) {
    const shell = this._shells.get(id);
    if (!shell) {
      return false;
    }
    this._heldShellReleaseListeners.get(id)?.dispose();
    this._heldShellReleaseListeners.delete(id);
    this._terminalManager.disposeTerminal(shell.terminalUri);
    this._shells.delete(id);
    this._busyShellIds.delete(id);
    this._logService.info(`[ShellManager] Shut down shell ${id}`);
    return true;
  }
};
ShellManager = __decorateClass([
  __decorateParam(2, IAgentHostTerminalManager),
  __decorateParam(3, ILogService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IEnvironmentService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IAgentConfigurationService),
  __decorateParam(8, ISandboxHelperService)
], ShellManager);
function makeSuccessResult(text) {
  return { textResultForLlm: text, resultType: "success" };
}
function makeFailureResult(text, error) {
  return { textResultForLlm: text, resultType: "failure", error };
}
function makeExecutionResult(toolResult, options) {
  return { toolResult, keepShellBusy: options?.keepShellBusy };
}
function shellCommandResultToExecutionResult(result, timeoutMs) {
  switch (result.status) {
    case "completed": {
      const exitCode = result.exitCode ?? 0;
      const text = `Exit code: ${exitCode}
${result.output}`;
      return makeExecutionResult(exitCode === 0 ? makeSuccessResult(text) : makeFailureResult(text));
    }
    case "shellExited":
      return makeExecutionResult(makeFailureResult(`Shell exited with code ${result.exitCode}
${result.output}`));
    case "timeout":
      return makeExecutionResult(makeFailureResult(
        `Command timed out after ${Math.round(timeoutMs / 1e3)}s. Partial output:
${result.output}`,
        "timeout"
      ));
    case "background":
      return makeExecutionResult(
        makeSuccessResult("The user chose to continue this command in the background. The terminal is still running."),
        { keepShellBusy: true }
      );
    case "altBuffer":
      return makeExecutionResult(makeFailureResult(ALT_BUFFER_MESSAGE, "alternateBuffer"), { keepShellBusy: true });
  }
}
async function executeCommandInShell(shell, command, timeoutMs, terminalManager, logService) {
  const result = shellCommandResultToExecutionResult(
    await executeShellCommand(shell, command, timeoutMs, terminalManager, logService),
    timeoutMs
  );
  return {
    ...result,
    toolResult: {
      ...result.toolResult,
      textResultForLlm: `Shell ID: ${shell.id}
${result.toolResult.textResultForLlm}`
    }
  };
}
async function createShellTools(shellManager, terminalManager, logService, confirmUnsandboxedExecution) {
  const executable = await shellManager.getResolvedExecutable();
  const shellType = shellTypeForExecutable(executable);
  const engine = shellManager.getOrCreateSandboxEngine();
  const sandboxEnabled = await engine.isEnabled();
  const networkDomains = sandboxEnabled ? engine.getResolvedNetworkDomains() : void 0;
  const primaryTool = {
    name: shellType,
    description: shellType === "bash" ? isZsh(executable) ? createZshModelDescription(sandboxEnabled, networkDomains) : createBashModelDescription(sandboxEnabled, networkDomains) : createPowerShellModelDescription(shellType, executable, sandboxEnabled, networkDomains),
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to execute" },
        timeout: { type: "number", description: "Timeout in milliseconds (default 120000)" },
        ...sandboxEnabled ? {
          requestUnsandboxedExecution: {
            type: "boolean",
            description: "Request that this command run outside the sandbox. Only set this after first executing the command in the sandbox and observing that sandboxing caused the failure. The user will be prompted before the command runs unsandboxed."
          },
          requestUnsandboxedExecutionReason: {
            type: "string",
            description: "A short explanation of the sandboxed execution failure or blocked-domain requirement that justifies retrying outside the sandbox. Only provide this when requestUnsandboxedExecution is true."
          }
        } : {}
      },
      required: ["command"]
    },
    overridesBuiltInTool: true,
    handler: async (args, invocation) => {
      const timeoutMs = args.timeout ?? DEFAULT_SHELL_COMMAND_TIMEOUT_MS;
      const ref = await shellManager.getOrCreateShell(
        shellType,
        invocation.toolCallId,
        invocation.toolCallId
      );
      let shouldReleaseShell = true;
      try {
        let commandToRun = args.command;
        if (sandboxEnabled) {
          if (args.requestUnsandboxedExecution && !engine.areUnsandboxedCommandsAllowed()) {
            return makeFailureResult(
              "Unsandboxed execution is disabled by the chat.agent.sandbox.allowUnsandboxedCommands setting.",
              "unsandboxed_disabled"
            );
          }
          const requestUnsandboxedConfirmation = async (blockedDomains) => {
            if (!confirmUnsandboxedExecution) {
              const blocked = blockedDomains?.join(", ") ?? "(unknown)";
              return makeFailureResult(
                `Command requires approval to run outside the sandbox. Blocked domains: ${blocked}. Re-run with requestUnsandboxedExecution=true and requestUnsandboxedExecutionReason explaining why unsandboxed access is required.`,
                "sandbox_blocked"
              );
            }
            const approved = await confirmUnsandboxedExecution({
              toolCallId: invocation.toolCallId,
              toolName: invocation.toolName,
              shellExecutable: executable,
              command: args.command,
              reason: args.requestUnsandboxedExecutionReason,
              blockedDomains
            });
            return approved;
          };
          let wrapped = await engine.wrapCommand(
            args.command,
            args.requestUnsandboxedExecution,
            executable,
            ref.object.shellType === "bash" ? shellManager.workingDirectory : void 0
          );
          if (args.requestUnsandboxedExecution && !wrapped.isSandboxWrapped) {
            const decision = await requestUnsandboxedConfirmation(wrapped.blockedDomains);
            if (typeof decision !== "boolean") {
              return decision;
            }
            if (!decision) {
              const blocked = wrapped.blockedDomains?.join(", ") ?? "(none)";
              return makeFailureResult(
                `User declined to run command outside the sandbox. Blocked domains: ${blocked}.`,
                "sandbox_blocked"
              );
            }
          }
          if (wrapped.requiresUnsandboxConfirmation) {
            const decision = await requestUnsandboxedConfirmation(wrapped.blockedDomains);
            if (typeof decision !== "boolean") {
              return decision;
            }
            if (!decision) {
              const blocked = wrapped.blockedDomains?.join(", ") ?? "(unknown)";
              return makeFailureResult(
                `User declined to run command outside the sandbox. Blocked domains: ${blocked}.`,
                "sandbox_blocked"
              );
            }
            wrapped = await engine.wrapCommand(
              args.command,
              true,
              executable,
              ref.object.shellType === "bash" ? shellManager.workingDirectory : void 0
            );
          }
          commandToRun = wrapped.command;
        }
        const result = await executeCommandInShell(ref.object, commandToRun, timeoutMs, terminalManager, logService);
        if (result.keepShellBusy) {
          shouldReleaseShell = false;
          shellManager.holdShellUntilCommandFinishes(ref.object);
        }
        return result.toolResult;
      } finally {
        if (shouldReleaseShell) {
          ref.dispose();
        }
      }
    }
  };
  const readTool = {
    name: `read_${shellType}`,
    description: `Read the latest output from a running ${shellType} shell.`,
    parameters: {
      type: "object",
      properties: {
        shell_id: { type: "string", description: "Shell ID to read from (optional; uses latest shell if omitted)" }
      }
    },
    overridesBuiltInTool: true,
    skipPermission: true,
    handler: (args) => {
      const shells = shellManager.listShells();
      const shell = args.shell_id ? shellManager.getShell(args.shell_id) : shells[shells.length - 1];
      if (!shell) {
        return makeFailureResult("No active shell found.", "no_shell");
      }
      const content = terminalManager.getContent(shell.terminalUri);
      if (!content) {
        return makeSuccessResult("(no output)");
      }
      return makeSuccessResult(prepareOutputForModel(content));
    }
  };
  const writeTool = {
    name: `write_${shellType}`,
    description: `Send input to a running ${shellType} shell (e.g. answering a prompt, sending Ctrl+C).`,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Text to write to the shell stdin" }
      },
      required: ["command"]
    },
    overridesBuiltInTool: true,
    skipPermission: true,
    handler: async (args) => {
      const shells = shellManager.listShells();
      const shell = shells[shells.length - 1];
      if (!shell) {
        return makeFailureResult("No active shell found.", "no_shell");
      }
      await terminalManager.sendText(shell.terminalUri, args.command, { shouldExecute: false });
      return makeSuccessResult("Input sent to shell.");
    }
  };
  const shutdownTool = {
    name: shellType === "bash" ? "bash_shutdown" : `${shellType}_shutdown`,
    description: `Stop a ${shellType} shell.`,
    parameters: {
      type: "object",
      properties: {
        shell_id: { type: "string", description: "Shell ID to stop (optional; stops latest shell if omitted)" }
      }
    },
    overridesBuiltInTool: true,
    skipPermission: true,
    handler: (args) => {
      if (args.shell_id) {
        const success = shellManager.shutdownShell(args.shell_id);
        return success ? makeSuccessResult("Shell stopped.") : makeFailureResult("Shell not found.", "not_found");
      }
      const shells = shellManager.listShells();
      const shell = shells[shells.length - 1];
      if (!shell) {
        return makeFailureResult("No active shell to stop.", "no_shell");
      }
      shellManager.shutdownShell(shell.id);
      return makeSuccessResult("Shell stopped.");
    }
  };
  const listTool = {
    name: `list_${shellType}`,
    description: `List active ${shellType} shell instances.`,
    parameters: { type: "object", properties: {} },
    overridesBuiltInTool: true,
    skipPermission: true,
    handler: () => {
      const shells = shellManager.listShells();
      if (shells.length === 0) {
        return makeSuccessResult("No active shells.");
      }
      const descriptions = shells.map((s) => {
        const exitCode = terminalManager.getExitCode(s.terminalUri);
        const status = exitCode !== void 0 ? `exited (${exitCode})` : "running";
        return `- ${s.id}: ${s.shellType} [${status}]`;
      });
      return makeSuccessResult(descriptions.join("\n"));
    }
  };
  const otherShellType = shellType === "bash" ? "powershell" : "bash";
  const redirectMessage = `This tool is disabled because the configured shell is ${executable}. Use the \`${shellType}\` tool instead.`;
  const redirectTool = {
    name: otherShellType,
    description: redirectMessage,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to execute" },
        timeout: { type: "number", description: "Timeout in milliseconds (default 120000)" }
      },
      required: ["command"]
    },
    overridesBuiltInTool: true,
    skipPermission: true,
    handler: () => {
      return makeFailureResult(redirectMessage, "wrong_shell");
    }
  };
  return [primaryTool, readTool, writeTool, shutdownTool, listTool, redirectTool];
}
function isWindowsPowerShell(envShell) {
  return envShell.endsWith("System32\\WindowsPowerShell\\v1.0\\powershell.exe");
}
function createPowerShellModelDescription(shellType, shellPath, isSandboxEnabled, networkDomains) {
  const isWinPwsh = isWindowsPowerShell(shellPath);
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
    "Async Mode:",
    "- For long-running tasks (e.g., servers), use mode=async",
    "- Returns a terminal ID for checking status and runtime later",
    "- Use Start-Job for background PowerShell jobs",
    "",
    `Use write_${shellType} to send commands or input to a terminal session.`
  ];
  if (isSandboxEnabled) {
    parts.push(...createSandboxLines(networkDomains));
  }
  parts.push(
    "",
    "Output Management:",
    "- Output is automatically truncated if longer than 60KB to prevent context overflow",
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
    "",
    "Interactive Input Handling:",
    "- When a terminal command is waiting for interactive input, do NOT suggest alternatives or ask the user whether to proceed. Instead, use the ask_user tool to collect the needed values from the user, then send them.",
    `- Send exactly one answer per prompt using write_${shellType}. Never send multiple answers in a single send.`,
    `- After each send, call read_${shellType} to read the next prompt before sending the next answer.`,
    "- Continue one prompt at a time until the command finishes."
  );
  return parts.join("\n");
}
function createSandboxLines(networkDomains) {
  const lines = [
    "",
    "Sandboxing:",
    "- ATTENTION: Terminal sandboxing is enabled, commands run in a sandbox by default",
    "- When executing commands within the sandboxed environment, all operations requiring a temporary directory must utilize the $TMPDIR environment variable. The /tmp directory is not guaranteed to be accessible or writable and must be avoided",
    "- Tools and scripts should respect the TMPDIR environment variable, which is automatically set to an appropriate path within the sandbox",
    "- When a command fails due to sandbox restrictions, immediately re-run it with requestUnsandboxedExecution=true. Do NOT ask the user for permission \u2014 setting this flag automatically shows a confirmation prompt to the user",
    "- Only set requestUnsandboxedExecution=true when there is evidence of failures caused by the sandbox, e.g. 'Operation not permitted' errors, network failures, or file access errors, etc",
    "- Do NOT set requestUnsandboxedExecution=true without first executing the command in sandbox mode. Always try the command in the sandbox first, and only set requestUnsandboxedExecution=true when retrying after that sandboxed execution failed due to sandbox restrictions.",
    "- When setting requestUnsandboxedExecution=true, also provide requestUnsandboxedExecutionReason explaining why the command needs unsandboxed access"
  ];
  if (networkDomains) {
    const deniedSet = new Set(networkDomains.deniedDomains);
    const effectiveAllowed = networkDomains.allowedDomains.filter((d) => !deniedSet.has(d));
    if (effectiveAllowed.length === 0) {
      lines.push("- All network access is blocked in the sandbox");
    } else {
      lines.push(`- Only the following domains are accessible in the sandbox (all other network access is blocked): ${effectiveAllowed.join(", ")}`);
    }
    if (networkDomains.deniedDomains.length > 0) {
      lines.push(`- The following domains are explicitly blocked in the sandbox: ${networkDomains.deniedDomains.join(", ")}`);
    }
  }
  return lines;
}
function createGenericDescription(shellType, isSandboxEnabled, networkDomains) {
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

Async Mode:
- For long-running tasks (e.g., servers), use mode=async
- Returns a terminal ID for checking status and runtime later

Use write_${shellType} to send commands or input to a terminal session.`];
  if (isSandboxEnabled) {
    parts.push(createSandboxLines(networkDomains).join("\n"));
  }
  parts.push(`

Output Management:
- Output is automatically truncated if longer than 60KB to prevent context overflow
- Use head, tail, grep, awk to filter and limit output size
- For pager commands, disable paging: git --no-pager or add | cat
- Use wc -l to count lines before displaying large outputs

Best Practices:
- Quote variables: "$var" instead of $var to handle spaces
- Use find with -exec or xargs for file operations
- Be specific with commands to avoid excessive output
- Avoid printing credentials unless absolutely required
- NEVER run sleep or similar wait commands in a terminal. You will be automatically notified on your next turn when async terminal commands or timed-out sync commands complete or need input. Do NOT poll for completion.

Interactive Input Handling:
- When a terminal command is waiting for interactive input, do NOT suggest alternatives or ask the user whether to proceed. Instead, use the ask_user tool to collect the needed values from the user, then send them.
- Send exactly one answer per prompt using write_${shellType}. Never send multiple answers in a single send.
- After each send, call read_${shellType} to read the next prompt before sending the next answer.
- Continue one prompt at a time until the command finishes.`);
  return parts.join("");
}
function createBashModelDescription(isSandboxEnabled, networkDomains) {
  return [
    "This tool allows you to execute shell commands in a persistent bash terminal session, preserving environment variables, working directory, and other context across multiple commands.",
    createGenericDescription("bash", isSandboxEnabled, networkDomains),
    "- Use [[ ]] for conditional tests instead of [ ]",
    "- Prefer $() over backticks for command substitution",
    "- Use set -e at start of complex commands to exit on errors"
  ].join("\n");
}
function createZshModelDescription(isSandboxEnabled, networkDomains) {
  return [
    "This tool allows you to execute shell commands in a persistent zsh terminal session, preserving environment variables, working directory, and other context across multiple commands.",
    createGenericDescription("bash", isSandboxEnabled, networkDomains),
    "- Use type to check command type (builtin, function, alias)",
    "- Use jobs, fg, bg for job control",
    "- Use [[ ]] for conditional tests instead of [ ]",
    "- Prefer $() over backticks for command substitution",
    "- Take advantage of zsh globbing features (**, extended globs). Note: unmatched globs fail by default (zsh: no matches found) - use a glob qualifier like *(N) or quote the glob if it should be literal",
    "",
    "zsh pitfalls - these WILL cause errors or hangs:",
    "- NEVER use bare == or === as separators (e.g. echo === triggers zsh equals expansion). Quote them: echo '==='",
    "- NEVER use status as a variable name (it is read-only in zsh). Use exit_code or ret instead"
  ].join("\n");
}
export {
  ShellManager,
  createShellTools,
  isMultilineCommand,
  prefixForHistorySuppression,
  shellTypeForExecutable
};
