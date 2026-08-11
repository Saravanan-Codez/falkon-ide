import { Separator } from "../../../../../base/common/actions.js";
import { coalesce } from "../../../../../base/common/arrays.js";
import { posix as pathPosix, win32 as pathWin32 } from "../../../../../base/common/path.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { localize } from "../../../../../nls.js";
import { isAutoApproveRule } from "./tools/commandLineAnalyzer/commandLineAnalyzer.js";
function isPowerShell(envShell, os) {
  if (os === OperatingSystem.Windows) {
    return /^(?:powershell|pwsh)(?:-preview)?$/i.test(pathWin32.basename(envShell).replace(/\.exe$/i, ""));
  }
  return /^(?:powershell|pwsh)(?:-preview)?$/.test(pathPosix.basename(envShell));
}
function isWindowsPowerShell(envShell) {
  return envShell.endsWith("System32\\WindowsPowerShell\\v1.0\\powershell.exe");
}
function isZsh(envShell, os) {
  if (os === OperatingSystem.Windows) {
    return /^zsh(?:\.exe)?$/i.test(pathWin32.basename(envShell));
  }
  return /^zsh$/.test(pathPosix.basename(envShell));
}
function isBash(envShell, os) {
  if (os === OperatingSystem.Windows) {
    return /^bash(?:\.exe)?$/i.test(pathWin32.basename(envShell));
  }
  return /^bash$/.test(pathPosix.basename(envShell));
}
function isFish(envShell, os) {
  if (os === OperatingSystem.Windows) {
    return /^fish(?:\.exe)?$/i.test(pathWin32.basename(envShell));
  }
  return /^fish$/.test(pathPosix.basename(envShell));
}
const TRUNCATION_MESSAGE = "\n\n[... PREVIOUS OUTPUT TRUNCATED ...]\n\n";
function truncateOutputKeepingTail(output, maxLength) {
  if (output.length <= maxLength) {
    return output;
  }
  const truncationMessageLength = TRUNCATION_MESSAGE.length;
  if (truncationMessageLength >= maxLength) {
    return TRUNCATION_MESSAGE.slice(TRUNCATION_MESSAGE.length - maxLength);
  }
  const availableLength = maxLength - truncationMessageLength;
  const endPortion = output.slice(-availableLength);
  return TRUNCATION_MESSAGE + endPortion;
}
function normalizeTerminalCommandForDisplay(commandLine) {
  return commandLine.replace(/\\(["'\/])/g, "$1");
}
function buildCommandDisplayText(command) {
  const normalized = normalizeTerminalCommandForDisplay(command).replace(/\r\n|\r|\n/g, " ");
  return normalized.length > 80 ? normalized.substring(0, 77) + "..." : normalized;
}
function normalizeCommandForExecution(command) {
  return command.replace(/\r\n|\r|\n/g, " ").trim();
}
function isMultilineCommand(command) {
  const normalized = command.replace(/\r\n|\r/g, "\n");
  return /(?<!\\)\n/.test(normalized);
}
function generateAutoApproveActions(commandLine, subCommands, autoApproveResult, options) {
  const actions = [];
  const canCreateAutoApproval = autoApproveResult.subCommandResults.every((e) => e.result !== "denied") && autoApproveResult.commandLineResult.result !== "denied";
  if (canCreateAutoApproval) {
    const unapprovedSubCommands = subCommands.filter((_, index) => {
      return autoApproveResult.subCommandResults[index].result !== "approved";
    });
    const neverAutoApproveCommands = /* @__PURE__ */ new Set([
      // Shell interpreters
      "bash",
      "sh",
      "zsh",
      "fish",
      "ksh",
      "csh",
      "tcsh",
      "dash",
      "pwsh",
      "powershell",
      "powershell.exe",
      "cmd",
      "cmd.exe",
      // Script interpreters
      "python",
      "python3",
      "node",
      "ruby",
      "perl",
      "php",
      "lua",
      // Direct execution commands
      "eval",
      "exec",
      "source",
      "sudo",
      "su",
      "doas",
      // Network tools that can download and execute code
      "curl",
      "wget",
      "invoke-restmethod",
      "invoke-webrequest",
      "irm",
      "iwr"
    ]);
    const commandsWithSubcommands = /* @__PURE__ */ new Set(["git", "npm", "npx", "yarn", "docker", "kubectl", "cargo", "dotnet", "mvn", "gradle"]);
    const commandsWithSubSubCommands = /* @__PURE__ */ new Set(["npm run", "yarn run"]);
    const findNextNonFlagArg = (parts, startIndex) => {
      for (let i = startIndex; i < parts.length; i++) {
        if (!parts[i].startsWith("-")) {
          return i;
        }
      }
      return void 0;
    };
    const subCommandsToSuggest = Array.from(new Set(coalesce(unapprovedSubCommands.map((command) => {
      const parts = command.trim().split(/\s+/);
      const baseCommand = parts[0].toLowerCase();
      if (neverAutoApproveCommands.has(baseCommand)) {
        return void 0;
      }
      if (commandsWithSubcommands.has(baseCommand)) {
        const subCommandIndex = findNextNonFlagArg(parts, 1);
        if (subCommandIndex !== void 0) {
          const baseSubCommand = `${parts[0]} ${parts[subCommandIndex]}`.toLowerCase();
          if (commandsWithSubSubCommands.has(baseSubCommand)) {
            const subSubCommandIndex = findNextNonFlagArg(parts, subCommandIndex + 1);
            if (subSubCommandIndex !== void 0) {
              return parts.slice(0, subSubCommandIndex + 1).join(" ");
            }
            return void 0;
          } else {
            return parts.slice(0, subCommandIndex + 1).join(" ");
          }
        }
        return void 0;
      } else {
        return parts[0];
      }
    }))));
    if (subCommandsToSuggest.length > 0) {
      let subCommandLabel;
      if (subCommandsToSuggest.length === 1) {
        subCommandLabel = `\`${subCommandsToSuggest[0]} \u2026\``;
      } else {
        subCommandLabel = `Commands ${subCommandsToSuggest.map((e) => `\`${e} \u2026\``).join(", ")}`;
      }
      if (!options?.skipSessionScoped) {
        actions.push({
          label: `Allow ${subCommandLabel} in this Session`,
          data: {
            type: "newRule",
            rule: subCommandsToSuggest.map((key) => ({
              key,
              value: true,
              scope: "session"
            }))
          }
        });
      }
      actions.push({
        label: `Allow ${subCommandLabel} in this Workspace`,
        data: {
          type: "newRule",
          rule: subCommandsToSuggest.map((key) => ({
            key,
            value: true,
            scope: "workspace"
          }))
        }
      });
      actions.push({
        label: `Always Allow ${subCommandLabel}`,
        data: {
          type: "newRule",
          rule: subCommandsToSuggest.map((key) => ({
            key,
            value: true,
            scope: "user"
          }))
        }
      });
    }
    if (actions.length > 0) {
      actions.push(new Separator());
    }
    const firstSubcommandFirstWord = unapprovedSubCommands.length > 0 ? unapprovedSubCommands[0].split(" ")[0] : "";
    if (firstSubcommandFirstWord !== commandLine && !commandsWithSubcommands.has(commandLine) && !commandsWithSubSubCommands.has(commandLine)) {
      if (!options?.skipSessionScoped) {
        actions.push({
          label: localize("autoApprove.exactCommand1", "Allow Exact Command Line in this Session"),
          data: {
            type: "newRule",
            rule: {
              key: `/^${escapeRegExpCharacters(commandLine)}$/`,
              value: {
                approve: true,
                matchCommandLine: true
              },
              scope: "session"
            }
          }
        });
      }
      actions.push({
        label: localize("autoApprove.exactCommand2", "Allow Exact Command Line in this Workspace"),
        data: {
          type: "newRule",
          rule: {
            key: `/^${escapeRegExpCharacters(commandLine)}$/`,
            value: {
              approve: true,
              matchCommandLine: true
            },
            scope: "workspace"
          }
        }
      });
      actions.push({
        label: localize("autoApprove.exactCommand", "Always Allow Exact Command Line"),
        data: {
          type: "newRule",
          rule: {
            key: `/^${escapeRegExpCharacters(commandLine)}$/`,
            value: {
              approve: true,
              matchCommandLine: true
            },
            scope: "user"
          }
        }
      });
    }
  }
  if (actions.length > 0) {
    actions.push(new Separator());
  }
  if (!options?.skipSessionScoped) {
    actions.push({
      label: localize("allowSession", "Allow All Commands in this Session"),
      tooltip: localize("allowSessionTooltip", "Allow this tool to run in this session without confirmation."),
      data: {
        type: "sessionApproval"
      }
    });
    actions.push(new Separator());
  }
  actions.push({
    label: localize("autoApprove.configure", "Configure Auto Approve..."),
    data: {
      type: "configure"
    }
  });
  return actions;
}
function dedupeRules(rules) {
  return rules.filter((result, index, array) => {
    if (!isAutoApproveRule(result.rule)) {
      return false;
    }
    const sourceText = result.rule.sourceText;
    return array.findIndex((r) => isAutoApproveRule(r.rule) && r.rule.sourceText === sourceText) === index;
  });
}
function extractCdPrefix(commandLine, shell, os) {
  const isPwsh = isPowerShell(shell, os);
  const cdPrefixMatch = commandLine.match(
    isPwsh ? /^(?:cd(?: \/d)?|Set-Location(?: -Path)?) (?<dir>[^\s]+) ?(?:&&|;)\s+(?<suffix>.+)$/i : /^cd (?<dir>[^\s]+) &&\s+(?<suffix>.+)$/
  );
  const cdDir = cdPrefixMatch?.groups?.dir;
  const cdSuffix = cdPrefixMatch?.groups?.suffix;
  if (cdDir && cdSuffix) {
    let cdDirPath = cdDir;
    if (cdDirPath.startsWith('"') && cdDirPath.endsWith('"')) {
      cdDirPath = cdDirPath.slice(1, -1);
    }
    return { directory: cdDirPath, command: cdSuffix };
  }
  return void 0;
}
export {
  TRUNCATION_MESSAGE,
  buildCommandDisplayText,
  dedupeRules,
  extractCdPrefix,
  generateAutoApproveActions,
  isBash,
  isFish,
  isMultilineCommand,
  isPowerShell,
  isWindowsPowerShell,
  isZsh,
  normalizeCommandForExecution,
  normalizeTerminalCommandForDisplay,
  truncateOutputKeepingTail
};
