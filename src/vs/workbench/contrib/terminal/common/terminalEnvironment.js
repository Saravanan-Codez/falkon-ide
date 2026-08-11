import * as path from "../../../../base/common/path.js";
import { URI, uriToFsPath } from "../../../../base/common/uri.js";
import { sanitizeProcessEnvironment } from "../../../../base/common/processes.js";
import { ShellIntegrationTimeoutOverride, TerminalSettingId, WindowsShellType } from "../../../../platform/terminal/common/terminal.js";
import { isWindows, isMacintosh, language, OperatingSystem } from "../../../../base/common/platform.js";
import { escapeNonWindowsPath, sanitizeCwd } from "../../../../platform/terminal/common/terminalEnvironment.js";
import { isNumber, isString } from "../../../../base/common/types.js";
function mergeEnvironments(parent, other) {
  if (!other) {
    return;
  }
  if (isWindows) {
    for (const configKey in other) {
      let actualKey = configKey;
      for (const envKey in parent) {
        if (configKey.toLowerCase() === envKey.toLowerCase()) {
          actualKey = envKey;
          break;
        }
      }
      const value = other[configKey];
      if (value !== void 0) {
        _mergeEnvironmentValue(parent, actualKey, value);
      }
    }
  } else {
    Object.keys(other).forEach((key) => {
      const value = other[key];
      if (value !== void 0) {
        _mergeEnvironmentValue(parent, key, value);
      }
    });
  }
}
function _mergeEnvironmentValue(env, key, value) {
  if (isString(value)) {
    env[key] = value;
  } else {
    delete env[key];
  }
}
function addTerminalEnvironmentKeys(env, version, locale, detectLocale) {
  env["TERM_PROGRAM"] = "vscode";
  if (version) {
    env["TERM_PROGRAM_VERSION"] = version;
  }
  if (shouldSetLangEnvVariable(env, detectLocale)) {
    env["LANG"] = getLangEnvVariable(locale);
  }
  env["COLORTERM"] = "truecolor";
}
function mergeNonNullKeys(env, other) {
  if (!other) {
    return;
  }
  for (const key of Object.keys(other)) {
    const value = other[key];
    if (value !== void 0 && value !== null) {
      env[key] = value;
    }
  }
}
async function resolveConfigurationVariables(variableResolver, env) {
  await Promise.all(Object.entries(env).map(async ([key, value]) => {
    if (isString(value)) {
      try {
        env[key] = await variableResolver(value);
      } catch (e) {
        env[key] = value;
      }
    }
  }));
  return env;
}
function shouldSetLangEnvVariable(env, detectLocale) {
  if (detectLocale === "on") {
    return true;
  }
  if (detectLocale === "auto") {
    const lang = env["LANG"];
    return !lang || lang.search(/\.UTF\-8$/) === -1 && lang.search(/\.utf8$/) === -1 && lang.search(/\.euc.+/) === -1;
  }
  return false;
}
function getLangEnvVariable(locale) {
  const parts = locale ? locale.split("-") : [];
  const n = parts.length;
  if (n === 0) {
    return "en_US.UTF-8";
  }
  if (n === 1) {
    const languageVariants = {
      af: "ZA",
      am: "ET",
      be: "BY",
      bg: "BG",
      ca: "ES",
      cs: "CZ",
      da: "DK",
      // de: 'AT',
      // de: 'CH',
      de: "DE",
      el: "GR",
      // en: 'AU',
      // en: 'CA',
      // en: 'GB',
      // en: 'IE',
      // en: 'NZ',
      en: "US",
      es: "ES",
      et: "EE",
      eu: "ES",
      fi: "FI",
      // fr: 'BE',
      // fr: 'CA',
      // fr: 'CH',
      fr: "FR",
      he: "IL",
      hr: "HR",
      hu: "HU",
      hy: "AM",
      is: "IS",
      // it: 'CH',
      it: "IT",
      ja: "JP",
      kk: "KZ",
      ko: "KR",
      lt: "LT",
      // nl: 'BE',
      nl: "NL",
      no: "NO",
      pl: "PL",
      pt: "BR",
      // pt: 'PT',
      ro: "RO",
      ru: "RU",
      sk: "SK",
      sl: "SI",
      sr: "YU",
      sv: "SE",
      tr: "TR",
      uk: "UA",
      zh: "CN"
    };
    if (Object.prototype.hasOwnProperty.call(languageVariants, parts[0])) {
      parts.push(languageVariants[parts[0]]);
    }
  } else {
    parts[1] = parts[1].toUpperCase();
  }
  return parts.join("_") + ".UTF-8";
}
async function getCwd(shell, userHome, variableResolver, root, customCwd, logService) {
  if (shell.cwd) {
    const unresolved = typeof shell.cwd === "object" ? shell.cwd.fsPath : shell.cwd;
    const resolved = await _resolveCwd(unresolved, variableResolver);
    return sanitizeCwd(resolved || unresolved);
  }
  let cwd;
  if (!shell.ignoreConfigurationCwd && customCwd) {
    if (variableResolver) {
      customCwd = await _resolveCwd(customCwd, variableResolver, logService);
    }
    if (customCwd) {
      if (path.isAbsolute(customCwd)) {
        cwd = customCwd;
      } else if (root) {
        cwd = path.join(root.fsPath, customCwd);
      }
    }
  }
  if (!cwd) {
    cwd = root ? root.fsPath : userHome || "";
  }
  return sanitizeCwd(cwd);
}
async function _resolveCwd(cwd, variableResolver, logService) {
  if (variableResolver) {
    try {
      return await variableResolver(cwd);
    } catch (e) {
      logService?.error("Could not resolve terminal cwd", e);
      return void 0;
    }
  }
  return cwd;
}
function createVariableResolver(lastActiveWorkspace, env, configurationResolverService) {
  if (!configurationResolverService) {
    return void 0;
  }
  return (str) => configurationResolverService.resolveWithEnvironment(env, lastActiveWorkspace, str);
}
async function createTerminalEnvironment(shellLaunchConfig, envFromConfig, variableResolver, version, detectLocale, baseEnv) {
  const env = {};
  if (shellLaunchConfig.strictEnv) {
    mergeNonNullKeys(env, shellLaunchConfig.env);
  } else {
    mergeNonNullKeys(env, baseEnv);
    const allowedEnvFromConfig = { ...envFromConfig };
    if (variableResolver) {
      if (allowedEnvFromConfig) {
        await resolveConfigurationVariables(variableResolver, allowedEnvFromConfig);
      }
      if (shellLaunchConfig.env) {
        await resolveConfigurationVariables(variableResolver, shellLaunchConfig.env);
      }
    }
    if (isMacintosh) {
      if (env["VSCODE_NODE_OPTIONS"]) {
        env["NODE_OPTIONS"] = env["VSCODE_NODE_OPTIONS"];
        delete env["VSCODE_NODE_OPTIONS"];
      }
      if (env["VSCODE_NODE_REPL_EXTERNAL_MODULE"]) {
        env["NODE_REPL_EXTERNAL_MODULE"] = env["VSCODE_NODE_REPL_EXTERNAL_MODULE"];
        delete env["VSCODE_NODE_REPL_EXTERNAL_MODULE"];
      }
    }
    sanitizeProcessEnvironment(env, "VSCODE_IPC_HOOK_CLI");
    mergeEnvironments(env, allowedEnvFromConfig);
    mergeEnvironments(env, shellLaunchConfig.env);
    addTerminalEnvironmentKeys(env, version, language, detectLocale);
  }
  return env;
}
async function preparePathForShell(resource, executable, title, shellType, backend, os, isWindowsFrontend = isWindows) {
  let originalPath;
  if (isString(resource)) {
    originalPath = resource;
  } else {
    originalPath = resource.fsPath;
    if (isWindowsFrontend && os !== OperatingSystem.Windows) {
      originalPath = originalPath.replace(/\\/g, "/");
    } else if (!isWindowsFrontend && os === OperatingSystem.Windows) {
      originalPath = originalPath.replace(/\//g, "\\");
    }
  }
  if (!executable) {
    return originalPath;
  }
  const hasSpace = originalPath.includes(" ");
  const hasParens = originalPath.includes("(") || originalPath.includes(")");
  const pathBasename = path.basename(executable, ".exe");
  const isPowerShell = pathBasename === "pwsh" || title === "pwsh" || pathBasename === "powershell" || title === "powershell";
  if (isPowerShell && (hasSpace || originalPath.includes("'"))) {
    return `& '${originalPath.replace(/'/g, "''")}'`;
  }
  if (hasParens && isPowerShell) {
    return `& '${originalPath}'`;
  }
  if (os === OperatingSystem.Windows) {
    if (shellType !== void 0) {
      if (shellType === WindowsShellType.GitBash) {
        return escapeNonWindowsPath(originalPath.replace(/\\/g, "/"), shellType);
      } else if (shellType === WindowsShellType.Wsl) {
        return backend?.getWslPath(originalPath, "win-to-unix") || originalPath;
      } else if (hasSpace) {
        return `"${originalPath}"`;
      }
      return originalPath;
    }
    const lowerExecutable = executable.toLowerCase();
    if (lowerExecutable.includes("wsl") || lowerExecutable.includes("bash.exe") && !lowerExecutable.toLowerCase().includes("git")) {
      return backend?.getWslPath(originalPath, "win-to-unix") || originalPath;
    } else if (hasSpace) {
      return `"${originalPath}"`;
    }
    return originalPath;
  }
  return escapeNonWindowsPath(originalPath, shellType);
}
function getWorkspaceForTerminal(cwd, workspaceContextService, historyService) {
  const cwdUri = isString(cwd) ? URI.parse(cwd) : cwd;
  let workspaceFolder = cwdUri ? workspaceContextService.getWorkspaceFolder(cwdUri) ?? void 0 : void 0;
  if (!workspaceFolder) {
    const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot();
    workspaceFolder = activeWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
  }
  return workspaceFolder;
}
async function getUriLabelForShell(uri, backend, shellType, os, isWindowsFrontend = isWindows) {
  let path2 = isString(uri) ? uri : uri.fsPath;
  if (os === OperatingSystem.Windows) {
    if (shellType === WindowsShellType.Wsl) {
      return backend.getWslPath(path2.replaceAll("/", "\\"), "win-to-unix");
    } else if (shellType === WindowsShellType.GitBash) {
      return path2.replaceAll("\\", "/").replace(/^([a-zA-Z]):\//, "/$1/");
    } else {
      path2 = isString(uri) ? path2 : uriToFsPath(uri, true);
      return !isWindowsFrontend ? path2.replaceAll("/", "\\") : path2;
    }
  } else {
    return isWindowsFrontend ? path2.replaceAll("\\", "/") : path2;
  }
}
function getShellIntegrationTimeout(configurationService, siInjectionEnabled, isRemote, processReadyTimestamp) {
  const timeoutValue = configurationService.getValue(TerminalSettingId.ShellIntegrationTimeout);
  let timeoutMs;
  if (isNumber(timeoutValue) && timeoutValue === ShellIntegrationTimeoutOverride.DisableForTests) {
    timeoutMs = 0;
  } else if (!isNumber(timeoutValue) || timeoutValue < 0) {
    timeoutMs = siInjectionEnabled ? 5e3 : isRemote ? 3e3 : 2e3;
  } else if (timeoutValue === 0) {
    timeoutMs = 0;
  } else {
    timeoutMs = Math.max(timeoutValue, 500);
  }
  if (processReadyTimestamp !== void 0) {
    const elapsed = Date.now() - processReadyTimestamp;
    timeoutMs = Math.max(0, timeoutMs - elapsed);
  }
  return timeoutMs;
}
export {
  addTerminalEnvironmentKeys,
  createTerminalEnvironment,
  createVariableResolver,
  getCwd,
  getLangEnvVariable,
  getShellIntegrationTimeout,
  getUriLabelForShell,
  getWorkspaceForTerminal,
  mergeEnvironments,
  preparePathForShell,
  shouldSetLangEnvVariable
};
