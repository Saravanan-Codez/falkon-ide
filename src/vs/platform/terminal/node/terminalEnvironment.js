import * as os from "os";
import { FileAccess } from "../../../base/common/network.js";
import * as path from "../../../base/common/path.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import * as process from "../../../base/common/process.js";
import { format } from "../../../base/common/strings.js";
import { ShellIntegrationInjectionFailureReason } from "../common/terminal.js";
import { EnvironmentVariableMutatorType } from "../common/environmentVariable.js";
import { deserializeEnvironmentVariableCollections } from "../common/environmentVariableShared.js";
import { MergedEnvironmentVariableCollection } from "../common/environmentVariableCollection.js";
import { chmod, realpathSync, mkdirSync } from "fs";
import { promisify } from "util";
import { isString } from "../../../base/common/types.js";
import { getWindowsBuildNumberAsync } from "../../../base/node/windowsVersion.js";
async function getShellIntegrationInjection(shellLaunchConfig, options, env, logService, productService, skipStickyBit = false) {
  if (!options.shellIntegration.enabled) {
    return { type: "failure", reason: ShellIntegrationInjectionFailureReason.InjectionSettingDisabled };
  }
  if (!shellLaunchConfig.executable) {
    return { type: "failure", reason: ShellIntegrationInjectionFailureReason.NoExecutable };
  }
  if (shellLaunchConfig.isFeatureTerminal && !shellLaunchConfig.forceShellIntegration) {
    return { type: "failure", reason: ShellIntegrationInjectionFailureReason.FeatureTerminal };
  }
  if (shellLaunchConfig.ignoreShellIntegration) {
    return { type: "failure", reason: ShellIntegrationInjectionFailureReason.IgnoreShellIntegrationFlag };
  }
  const windowsBuildNumber = isWindows ? await getWindowsBuildNumberAsync() : 0;
  if (isWindows && windowsBuildNumber < 18309) {
    return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedWindowsBuild };
  }
  const originalArgs = shellLaunchConfig.args;
  const shell = process.platform === "win32" ? path.basename(shellLaunchConfig.executable).toLowerCase() : path.basename(shellLaunchConfig.executable);
  const shellIntegrationScriptRoot = FileAccess.asFileUri("vs/workbench/contrib/terminal/common/scripts").fsPath;
  const type = "injection";
  let newArgs;
  const envMixin = {
    "VSCODE_INJECTION": "1"
  };
  if (options.shellIntegration.nonce) {
    envMixin["VSCODE_NONCE"] = options.shellIntegration.nonce;
  }
  const scopedDownShellEnvs = ["PATH", "VIRTUAL_ENV", "HOME", "SHELL", "PWD"];
  if (shellLaunchConfig.shellIntegrationEnvironmentReporting) {
    if (isWindows) {
      const enableWindowsEnvReporting = options.windowsUseConptyDll || windowsBuildNumber >= 22631 && shell !== "bash.exe";
      if (enableWindowsEnvReporting) {
        envMixin["VSCODE_SHELL_ENV_REPORTING"] = scopedDownShellEnvs.join(",");
      }
    } else {
      envMixin["VSCODE_SHELL_ENV_REPORTING"] = scopedDownShellEnvs.join(",");
    }
  }
  if (isWindows) {
    if (shell === "pwsh.exe" || shell === "powershell.exe") {
      envMixin["VSCODE_A11Y_MODE"] = options.isScreenReaderOptimized ? "1" : "0";
      if (!originalArgs || arePwshImpliedArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("windows-pwsh" /* WindowsPwsh */);
      } else if (arePwshLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("windows-pwsh-login" /* WindowsPwshLogin */);
      }
      if (!newArgs) {
        return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedArgs };
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], shellIntegrationScriptRoot, "");
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { type, newArgs, envMixin };
    } else if (shell === "bash.exe") {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        envMixin["VSCODE_SHELL_LOGIN"] = "1";
        addEnvMixinPathPrefix(options, envMixin, shell);
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      }
      if (!newArgs) {
        return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedArgs };
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], shellIntegrationScriptRoot);
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { type, newArgs, envMixin };
    }
    logService.warn(`Shell integration cannot be enabled for executable "${shellLaunchConfig.executable}" and args`, shellLaunchConfig.args);
    return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedShell };
  }
  switch (shell) {
    case "bash": {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        envMixin["VSCODE_SHELL_LOGIN"] = "1";
        addEnvMixinPathPrefix(options, envMixin, shell);
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      }
      if (!newArgs) {
        return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedArgs };
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], shellIntegrationScriptRoot);
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { type, newArgs, envMixin };
    }
    case "fish": {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("fish" /* Fish */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("fish-login" /* FishLogin */);
      } else if (originalArgs === shellIntegrationArgs.get("fish" /* Fish */) || originalArgs === shellIntegrationArgs.get("fish-login" /* FishLogin */)) {
        newArgs = originalArgs;
      }
      if (!newArgs) {
        return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedArgs };
      }
      addEnvMixinPathPrefix(options, envMixin, shell);
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], shellIntegrationScriptRoot);
      return { type, newArgs, envMixin };
    }
    case "pwsh": {
      if (!originalArgs || arePwshImpliedArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("pwsh" /* Pwsh */);
      } else if (arePwshLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("pwsh-login" /* PwshLogin */);
      }
      if (!newArgs) {
        return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedArgs };
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], shellIntegrationScriptRoot, "");
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { type, newArgs, envMixin };
    }
    case "zsh": {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("zsh" /* Zsh */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("zsh-login" /* ZshLogin */);
        addEnvMixinPathPrefix(options, envMixin, shell);
      } else if (originalArgs === shellIntegrationArgs.get("zsh" /* Zsh */) || originalArgs === shellIntegrationArgs.get("zsh-login" /* ZshLogin */)) {
        newArgs = originalArgs;
      }
      if (!newArgs) {
        return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedArgs };
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], shellIntegrationScriptRoot);
      let username;
      try {
        username = os.userInfo().username;
      } catch {
        username = "unknown";
      }
      const realTmpDir = realpathSync(os.tmpdir());
      const zdotdir = path.join(realTmpDir, `${username}-${productService.applicationName}-zsh`);
      if (!skipStickyBit) {
        try {
          const chmodAsync = promisify(chmod);
          await chmodAsync(zdotdir, 960);
        } catch (err) {
          if (!err.message.includes("ENOENT")) {
            logService.error(`Failed to set sticky bit on ${zdotdir}: ${err}`);
            return { type: "failure", reason: ShellIntegrationInjectionFailureReason.FailedToSetStickyBit };
          }
          try {
            mkdirSync(zdotdir, { recursive: true });
          } catch (err2) {
            logService.error(`Failed to create zdotdir at ${zdotdir}: ${err2}`);
            return { type: "failure", reason: ShellIntegrationInjectionFailureReason.FailedToCreateTmpDir };
          }
          try {
            const chmodAsync = promisify(chmod);
            await chmodAsync(zdotdir, 960);
          } catch (err2) {
            logService.error(`Failed to set sticky bit on ${zdotdir}: ${err2}`);
            return { type: "failure", reason: ShellIntegrationInjectionFailureReason.FailedToSetStickyBit };
          }
        }
      }
      envMixin["ZDOTDIR"] = zdotdir;
      const userZdotdir = env?.ZDOTDIR ?? os.homedir() ?? `~`;
      envMixin["USER_ZDOTDIR"] = userZdotdir;
      const filesToCopy = [];
      filesToCopy.push({
        source: path.join(shellIntegrationScriptRoot, "shellIntegration-rc.zsh"),
        dest: path.join(zdotdir, ".zshrc")
      });
      filesToCopy.push({
        source: path.join(shellIntegrationScriptRoot, "shellIntegration-profile.zsh"),
        dest: path.join(zdotdir, ".zprofile")
      });
      filesToCopy.push({
        source: path.join(shellIntegrationScriptRoot, "shellIntegration-env.zsh"),
        dest: path.join(zdotdir, ".zshenv")
      });
      filesToCopy.push({
        source: path.join(shellIntegrationScriptRoot, "shellIntegration-login.zsh"),
        dest: path.join(zdotdir, ".zlogin")
      });
      return { type, newArgs, envMixin, filesToCopy };
    }
  }
  logService.warn(`Shell integration cannot be enabled for executable "${shellLaunchConfig.executable}" and args`, shellLaunchConfig.args);
  return { type: "failure", reason: ShellIntegrationInjectionFailureReason.UnsupportedShell };
}
function addEnvMixinPathPrefix(options, envMixin, shell) {
  if ((isMacintosh || shell === "fish") && options.environmentVariableCollections) {
    const deserialized = deserializeEnvironmentVariableCollections(options.environmentVariableCollections);
    const merged = new MergedEnvironmentVariableCollection(deserialized);
    const pathEntry = merged.getVariableMap({ workspaceFolder: options.workspaceFolder }).get("PATH");
    const prependToPath = [];
    if (pathEntry) {
      for (const mutator of pathEntry) {
        if (mutator.type === EnvironmentVariableMutatorType.Prepend) {
          prependToPath.push(mutator.value);
        }
      }
    }
    if (prependToPath.length > 0) {
      envMixin["VSCODE_PATH_PREFIX"] = prependToPath.join("");
    }
  }
}
var ShellIntegrationExecutable = /* @__PURE__ */ ((ShellIntegrationExecutable2) => {
  ShellIntegrationExecutable2["WindowsPwsh"] = "windows-pwsh";
  ShellIntegrationExecutable2["WindowsPwshLogin"] = "windows-pwsh-login";
  ShellIntegrationExecutable2["Pwsh"] = "pwsh";
  ShellIntegrationExecutable2["PwshLogin"] = "pwsh-login";
  ShellIntegrationExecutable2["Zsh"] = "zsh";
  ShellIntegrationExecutable2["ZshLogin"] = "zsh-login";
  ShellIntegrationExecutable2["Bash"] = "bash";
  ShellIntegrationExecutable2["Fish"] = "fish";
  ShellIntegrationExecutable2["FishLogin"] = "fish-login";
  return ShellIntegrationExecutable2;
})(ShellIntegrationExecutable || {});
const shellIntegrationArgs = /* @__PURE__ */ new Map();
shellIntegrationArgs.set("windows-pwsh" /* WindowsPwsh */, ["-noexit", "-command", 'try { . "{0}\\shellIntegration.ps1" } catch {}{1}']);
shellIntegrationArgs.set("windows-pwsh-login" /* WindowsPwshLogin */, ["-l", "-noexit", "-command", 'try { . "{0}\\shellIntegration.ps1" } catch {}{1}']);
shellIntegrationArgs.set("pwsh" /* Pwsh */, ["-noexit", "-command", '. "{0}/shellIntegration.ps1"{1}']);
shellIntegrationArgs.set("pwsh-login" /* PwshLogin */, ["-l", "-noexit", "-command", '. "{0}/shellIntegration.ps1"']);
shellIntegrationArgs.set("zsh" /* Zsh */, ["-i"]);
shellIntegrationArgs.set("zsh-login" /* ZshLogin */, ["-il"]);
shellIntegrationArgs.set("bash" /* Bash */, ["--init-file", "{0}/shellIntegration-bash.sh"]);
shellIntegrationArgs.set("fish" /* Fish */, ["--init-command", 'source "{0}/shellIntegration.fish"']);
shellIntegrationArgs.set("fish-login" /* FishLogin */, ["-l", "--init-command", 'source "{0}/shellIntegration.fish"']);
const pwshLoginArgs = ["-login", "-l"];
const shLoginArgs = ["--login", "-l"];
const shInteractiveArgs = ["-i", "--interactive"];
const pwshImpliedArgs = ["-nol", "-nologo"];
function arePwshLoginArgs(originalArgs) {
  if (isString(originalArgs)) {
    return pwshLoginArgs.includes(originalArgs.toLowerCase());
  } else {
    return originalArgs.length === 1 && pwshLoginArgs.includes(originalArgs[0].toLowerCase()) || originalArgs.length === 2 && (pwshLoginArgs.includes(originalArgs[0].toLowerCase()) || pwshLoginArgs.includes(originalArgs[1].toLowerCase())) && (pwshImpliedArgs.includes(originalArgs[0].toLowerCase()) || pwshImpliedArgs.includes(originalArgs[1].toLowerCase()));
  }
}
function arePwshImpliedArgs(originalArgs) {
  if (isString(originalArgs)) {
    return pwshImpliedArgs.includes(originalArgs.toLowerCase());
  } else {
    return originalArgs.length === 0 || originalArgs?.length === 1 && pwshImpliedArgs.includes(originalArgs[0].toLowerCase());
  }
}
function areZshBashFishLoginArgs(originalArgs) {
  if (!isString(originalArgs)) {
    originalArgs = originalArgs.filter((arg) => !shInteractiveArgs.includes(arg.toLowerCase()));
  }
  return isString(originalArgs) && shLoginArgs.includes(originalArgs.toLowerCase()) || !isString(originalArgs) && originalArgs.length === 1 && shLoginArgs.includes(originalArgs[0].toLowerCase());
}
const sensitiveEnvVarNames = /^(?:.*_)?(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIAL|AUTH|PRIVATE_?KEY|ACCESS_?KEY|CLIENT_?SECRET|APIKEY)(?:_.*)?$/i;
const secretValuePatterns = [
  // JWT tokens
  /^eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+$/,
  // GitHub tokens
  /^gh[psuro]_[a-zA-Z0-9]{36}$/,
  /^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/,
  // Google API keys
  /^AIza[A-Za-z0-9_\-]{35}$/,
  // Slack tokens
  /^xox[pbar]\-[A-Za-z0-9\-]+$/,
  // Azure/MS tokens (common patterns)
  /^[a-zA-Z0-9]{32,}$/
];
function sanitizeEnvForLogging(env) {
  if (!env) {
    return env;
  }
  const sanitized = {};
  for (const key of Object.keys(env)) {
    const value = env[key];
    if (value === void 0) {
      continue;
    }
    if (sensitiveEnvVarNames.test(key)) {
      sanitized[key] = "<REDACTED>";
      continue;
    }
    let isSecret = false;
    for (const pattern of secretValuePatterns) {
      if (pattern.test(value)) {
        isSecret = true;
        break;
      }
    }
    sanitized[key] = isSecret ? "<REDACTED>" : value;
  }
  return sanitized;
}
export {
  getShellIntegrationInjection,
  sanitizeEnvForLogging
};
