import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { TerminalClaimKind } from "../../common/state/protocol/state.js";
const SHELL_COMMAND_MAX_OUTPUT_BYTES = 8e4;
const DEFAULT_SHELL_COMMAND_TIMEOUT_MS = 12e4;
const SENTINEL_PREFIX = "<<<COPILOT_SENTINEL_";
function shellTypeForExecutable(shellPath) {
  const lastSep = Math.max(shellPath.lastIndexOf("/"), shellPath.lastIndexOf("\\"));
  const base = shellPath.slice(lastSep + 1).toLowerCase().replace(/\.exe$/, "");
  switch (base) {
    // PowerShell
    case "pwsh":
    case "powershell":
    case "pwsh-preview":
      return "powershell";
    // POSIX shells
    case "bash":
    case "sh":
    case "zsh":
    case "fish":
    case "csh":
    case "ksh":
    case "nu":
    case "xonsh":
    // Git for Windows bash entry points
    case "git-cmd":
    // WSL launchers — bash inside, but invoked via these stubs
    case "wsl":
    case "ubuntu":
    case "ubuntu1804":
    case "kali":
    case "debian":
    case "opensuse-42":
    case "sles-12":
      return "bash";
    default:
      return platform.isWindows ? "powershell" : "bash";
  }
}
function prefixForHistorySuppression(shellType) {
  return shellType === "powershell" ? "" : " ";
}
function isMultilineCommand(command) {
  const normalized = command.replace(/\r\n|\r/g, "\n");
  return /(?<!\\)\n/.test(normalized);
}
function shouldUseBracketedPasteMode(command) {
  return platform.isMacintosh || isMultilineCommand(command);
}
function makeSentinelId() {
  return generateUuid().replace(/-/g, "");
}
function buildSentinelCommand(sentinelId, shellType) {
  if (shellType === "powershell") {
    return `Write-Output "${SENTINEL_PREFIX}${sentinelId}_EXIT_$LASTEXITCODE>>>"`;
  }
  return `echo "${SENTINEL_PREFIX}${sentinelId}_EXIT_$?>>>"`;
}
function parseSentinel(content, sentinelId) {
  const marker = `${SENTINEL_PREFIX}${sentinelId}_EXIT_`;
  let markerIndex = content.lastIndexOf(marker);
  while (markerIndex !== -1) {
    const outputBeforeSentinel = content.substring(0, markerIndex);
    const afterMarker = content.substring(markerIndex + marker.length);
    const endIdx = afterMarker.indexOf(">>>");
    if (endIdx !== -1) {
      const exitCodeStr = afterMarker.substring(0, endIdx).trim();
      if (/^-?\d+$/.test(exitCodeStr)) {
        return {
          found: true,
          exitCode: parseInt(exitCodeStr, 10),
          outputBeforeSentinel
        };
      }
    }
    markerIndex = content.lastIndexOf(marker, markerIndex - 1);
  }
  return { found: false, exitCode: -1, outputBeforeSentinel: content };
}
function prepareOutputForModel(rawOutput) {
  let text = removeAnsiEscapeCodes(rawOutput).trim();
  if (text.length > SHELL_COMMAND_MAX_OUTPUT_BYTES) {
    text = text.substring(text.length - SHELL_COMMAND_MAX_OUTPUT_BYTES);
  }
  return text;
}
function executeShellCommand(target, command, timeoutMs, terminalManager, logService) {
  return terminalManager.supportsCommandDetection(target.terminalUri) ? executeCommandWithShellIntegration(target, command, timeoutMs, terminalManager, logService) : executeCommandWithSentinel(target, command, timeoutMs, terminalManager, logService);
}
function registerAltBufferHandler(target, terminalManager, logService, disposables, finish) {
  void terminalManager.createAltBufferPromise(target.terminalUri, disposables).then(() => {
    logService.info("[ShellCommand] Command entered alternate buffer");
    finish({ status: "altBuffer", output: "" });
  });
}
async function executeCommandWithShellIntegration(target, command, timeoutMs, terminalManager, logService) {
  const disposables = new DisposableStore();
  const result = new Promise((resolve) => {
    let resolved = false;
    const finish = (result2) => {
      if (resolved) {
        return;
      }
      resolved = true;
      disposables.dispose();
      resolve(result2);
    };
    disposables.add(terminalManager.onCommandFinished(target.terminalUri, (event) => {
      const output = prepareOutputForModel(event.output);
      const exitCode = event.exitCode ?? 0;
      logService.info(`[ShellCommand] Command completed (shell integration) with exit code ${exitCode}`);
      finish({ status: "completed", exitCode, output });
    }));
    registerAltBufferHandler(target, terminalManager, logService, disposables, finish);
    disposables.add(terminalManager.onExit(target.terminalUri, (exitCode) => {
      logService.info(`[ShellCommand] Shell exited unexpectedly with code ${exitCode}`);
      const fullContent = terminalManager.getContent(target.terminalUri) ?? "";
      finish({ status: "shellExited", exitCode, output: prepareOutputForModel(fullContent) });
    }));
    disposables.add(terminalManager.onClaimChanged(target.terminalUri, (claim) => {
      if (claim.kind === TerminalClaimKind.Session && !claim.toolCallId) {
        logService.info(`[ShellCommand] Continuing in background (claim narrowed)`);
        finish({ status: "background", output: "" });
      }
    }));
    const timer = setTimeout(() => {
      logService.warn(`[ShellCommand] Command timed out after ${timeoutMs}ms`);
      const fullContent = terminalManager.getContent(target.terminalUri) ?? "";
      finish({ status: "timeout", output: prepareOutputForModel(fullContent) });
    }, timeoutMs);
    disposables.add(toDisposable(() => clearTimeout(timer)));
  });
  try {
    await terminalManager.sendText(target.terminalUri, `${prefixForHistorySuppression(target.shellType)}${command}`, {
      shouldExecute: true,
      bracketedPasteMode: shouldUseBracketedPasteMode(command)
    });
  } catch (err) {
    disposables.dispose();
    throw err;
  }
  return result;
}
async function executeCommandWithSentinel(target, command, timeoutMs, terminalManager, logService) {
  const sentinelId = makeSentinelId();
  const sentinelCmd = buildSentinelCommand(sentinelId, target.shellType);
  const disposables = new DisposableStore();
  const contentBefore = terminalManager.getContent(target.terminalUri) ?? "";
  const offsetBefore = contentBefore.length;
  const result = new Promise((resolve) => {
    let resolved = false;
    const finish = (result2) => {
      if (resolved) {
        return;
      }
      resolved = true;
      disposables.dispose();
      resolve(result2);
    };
    const checkForSentinel = () => {
      const fullContent = terminalManager.getContent(target.terminalUri) ?? "";
      const clampedOffset = Math.min(offsetBefore, fullContent.length);
      const newContent = fullContent.substring(clampedOffset);
      const parsed = parseSentinel(newContent, sentinelId);
      if (parsed.found) {
        const output = prepareOutputForModel(parsed.outputBeforeSentinel);
        logService.info(`[ShellCommand] Command completed with exit code ${parsed.exitCode}`);
        finish({ status: "completed", exitCode: parsed.exitCode, output });
      }
    };
    disposables.add(terminalManager.onData(target.terminalUri, () => {
      checkForSentinel();
    }));
    registerAltBufferHandler(target, terminalManager, logService, disposables, finish);
    disposables.add(terminalManager.onExit(target.terminalUri, (exitCode) => {
      logService.info(`[ShellCommand] Shell exited unexpectedly with code ${exitCode}`);
      const fullContent = terminalManager.getContent(target.terminalUri) ?? "";
      const newContent = fullContent.substring(offsetBefore);
      finish({ status: "shellExited", exitCode, output: prepareOutputForModel(newContent) });
    }));
    disposables.add(terminalManager.onClaimChanged(target.terminalUri, (claim) => {
      if (claim.kind === TerminalClaimKind.Session && !claim.toolCallId) {
        logService.info(`[ShellCommand] Continuing in background (claim narrowed)`);
        finish({ status: "background", output: "" });
      }
    }));
    const timer = setTimeout(() => {
      logService.warn(`[ShellCommand] Command timed out after ${timeoutMs}ms`);
      const fullContent = terminalManager.getContent(target.terminalUri) ?? "";
      const newContent = fullContent.substring(offsetBefore);
      finish({ status: "timeout", output: prepareOutputForModel(newContent) });
    }, timeoutMs);
    disposables.add(toDisposable(() => clearTimeout(timer)));
    checkForSentinel();
  });
  try {
    await terminalManager.sendText(target.terminalUri, `${prefixForHistorySuppression(target.shellType)}${command}`, {
      shouldExecute: true,
      bracketedPasteMode: shouldUseBracketedPasteMode(command)
    });
    await terminalManager.sendText(target.terminalUri, sentinelCmd, { shouldExecute: true });
  } catch (err) {
    disposables.dispose();
    throw err;
  }
  return result;
}
export {
  DEFAULT_SHELL_COMMAND_TIMEOUT_MS,
  SHELL_COMMAND_MAX_OUTPUT_BYTES,
  executeShellCommand,
  isMultilineCommand,
  prefixForHistorySuppression,
  prepareOutputForModel,
  shellTypeForExecutable
};
