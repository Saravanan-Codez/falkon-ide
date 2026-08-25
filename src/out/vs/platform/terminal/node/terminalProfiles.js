import * as fs from "fs";
import * as cp from "child_process";
import { Codicon } from "../../../base/common/codicons.js";
import { basename, delimiter, normalize, dirname, resolve } from "../../../base/common/path.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { findExecutable } from "../../../base/node/processes.js";
import { hasKey, isObject, isString } from "../../../base/common/types.js";
import * as pfs from "../../../base/node/pfs.js";
import { enumeratePowerShellInstallations } from "../../../base/node/powershell.js";
import { ProfileSource, TerminalSettingId } from "../common/terminal.js";
import { getWindowsBuildNumberAsync } from "../../../base/node/windowsVersion.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2["UnixShellsPath"] = "/etc/shells";
  return Constants2;
})(Constants || {});
let profileSources;
let logIfWslNotInstalled = true;
function detectAvailableProfiles(profiles, defaultProfile, includeDetectedProfiles, configurationService, shellEnv = process.env, fsProvider, logService, variableResolver, testPwshSourcePaths) {
  fsProvider = fsProvider || {
    existsFile: pfs.SymlinkSupport.existsFile,
    readFile: fs.promises.readFile
  };
  if (isWindows) {
    return detectAvailableWindowsProfiles(
      includeDetectedProfiles,
      fsProvider,
      shellEnv,
      logService,
      configurationService.getValue(TerminalSettingId.UseWslProfiles) !== false,
      profiles && isObject(profiles) ? { ...profiles } : configurationService.getValue(TerminalSettingId.ProfilesWindows),
      isString(defaultProfile) ? defaultProfile : configurationService.getValue(TerminalSettingId.DefaultProfileWindows),
      testPwshSourcePaths,
      variableResolver
    );
  }
  return detectAvailableUnixProfiles(
    fsProvider,
    logService,
    includeDetectedProfiles,
    profiles && isObject(profiles) ? { ...profiles } : configurationService.getValue(isLinux ? TerminalSettingId.ProfilesLinux : TerminalSettingId.ProfilesMacOs),
    isString(defaultProfile) ? defaultProfile : configurationService.getValue(isLinux ? TerminalSettingId.DefaultProfileLinux : TerminalSettingId.DefaultProfileMacOs),
    testPwshSourcePaths,
    variableResolver,
    shellEnv
  );
}
async function detectAvailableWindowsProfiles(includeDetectedProfiles, fsProvider, shellEnv, logService, useWslProfiles, configProfiles, defaultProfileName, testPwshSourcePaths, variableResolver) {
  const is32ProcessOn64Windows = process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432");
  const system32Path = `${process.env["windir"]}\\${is32ProcessOn64Windows ? "Sysnative" : "System32"}`;
  const allowWslDiscovery = await getWindowsBuildNumberAsync() >= 19041;
  await initializeWindowsProfiles(testPwshSourcePaths);
  const detectedProfiles = /* @__PURE__ */ new Map();
  if (includeDetectedProfiles) {
    detectedProfiles.set("PowerShell", {
      source: ProfileSource.Pwsh,
      icon: Codicon.terminalPowershell,
      isAutoDetected: true
    });
    detectedProfiles.set("Windows PowerShell", {
      path: `${system32Path}\\WindowsPowerShell\\v1.0\\powershell.exe`,
      icon: Codicon.terminalPowershell,
      isAutoDetected: true
    });
    detectedProfiles.set("Git Bash", {
      source: ProfileSource.GitBash,
      icon: Codicon.terminalGitBash,
      isAutoDetected: true
    });
    detectedProfiles.set("Command Prompt", {
      path: `${system32Path}\\cmd.exe`,
      icon: Codicon.terminalCmd,
      isAutoDetected: true
    });
    detectedProfiles.set("Cygwin", {
      path: [
        { path: `${process.env["HOMEDRIVE"]}\\cygwin64\\bin\\bash.exe`, isUnsafe: true },
        { path: `${process.env["HOMEDRIVE"]}\\cygwin\\bin\\bash.exe`, isUnsafe: true }
      ],
      args: ["--login"],
      isAutoDetected: true
    });
    detectedProfiles.set("bash (MSYS2)", {
      path: [
        { path: `${process.env["HOMEDRIVE"]}\\msys64\\usr\\bin\\bash.exe`, isUnsafe: true }
      ],
      args: ["--login", "-i"],
      // CHERE_INVOKING retains current working directory
      env: { CHERE_INVOKING: "1" },
      icon: Codicon.terminalBash,
      isAutoDetected: true
    });
    const cmderPath = `${process.env["CMDER_ROOT"] || `${process.env["HOMEDRIVE"]}\\cmder`}\\vendor\\bin\\vscode_init.cmd`;
    detectedProfiles.set("Cmder", {
      path: `${system32Path}\\cmd.exe`,
      args: ["/K", cmderPath],
      // The path is safe if it was derived from CMDER_ROOT
      requiresPath: process.env["CMDER_ROOT"] ? cmderPath : { path: cmderPath, isUnsafe: true },
      isAutoDetected: true
    });
  }
  applyConfigProfilesToMap(configProfiles, detectedProfiles);
  const resultProfiles = await transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName, fsProvider, shellEnv, logService, variableResolver);
  if (includeDetectedProfiles && useWslProfiles && allowWslDiscovery) {
    try {
      const result = await getWslProfiles(`${system32Path}\\wsl.exe`, defaultProfileName);
      for (const wslProfile of result) {
        if (!configProfiles || !Object.prototype.hasOwnProperty.call(configProfiles, wslProfile.profileName)) {
          resultProfiles.push(wslProfile);
        }
      }
    } catch (e) {
      if (logIfWslNotInstalled) {
        logService?.trace("WSL is not installed, so could not detect WSL profiles");
        logIfWslNotInstalled = false;
      }
    }
  }
  return resultProfiles;
}
async function transformToTerminalProfiles(entries, defaultProfileName, fsProvider, shellEnv = process.env, logService, variableResolver) {
  const promises = [];
  for (const [profileName, profile] of entries) {
    promises.push(getValidatedProfile(profileName, profile, defaultProfileName, fsProvider, shellEnv, logService, variableResolver));
  }
  return (await Promise.all(promises)).filter((e) => !!e);
}
async function getValidatedProfile(profileName, profile, defaultProfileName, fsProvider, shellEnv = process.env, logService, variableResolver) {
  if (profile === null) {
    return void 0;
  }
  let originalPaths;
  let args;
  let icon = void 0;
  if (hasKey(profile, { source: true })) {
    const source = profileSources?.get(profile.source);
    if (!source) {
      return void 0;
    }
    originalPaths = source.paths;
    args = profile.args || source.args;
    if (profile.icon) {
      icon = validateIcon(profile.icon);
    } else if (source.icon) {
      icon = source.icon;
    }
  } else {
    originalPaths = Array.isArray(profile.path) ? profile.path : [profile.path];
    args = isWindows ? profile.args : Array.isArray(profile.args) ? profile.args : void 0;
    icon = validateIcon(profile.icon);
  }
  let paths;
  if (variableResolver) {
    const mapped = originalPaths.map((e) => isString(e) ? e : e.path);
    const resolved = await variableResolver(mapped);
    paths = new Array(originalPaths.length);
    for (let i = 0; i < originalPaths.length; i++) {
      if (isString(originalPaths[i])) {
        paths[i] = resolved[i];
      } else {
        paths[i] = {
          path: resolved[i],
          isUnsafe: true
        };
      }
    }
  } else {
    paths = originalPaths.slice();
  }
  let requiresUnsafePath;
  if (profile.requiresPath) {
    let actualRequiredPath;
    if (isString(profile.requiresPath)) {
      actualRequiredPath = profile.requiresPath;
    } else {
      actualRequiredPath = profile.requiresPath.path;
      if (profile.requiresPath.isUnsafe) {
        requiresUnsafePath = actualRequiredPath;
      }
    }
    const result = await fsProvider.existsFile(actualRequiredPath);
    if (!result) {
      return;
    }
  }
  const validatedProfile = await validateProfilePaths(profileName, defaultProfileName, paths, fsProvider, shellEnv, args, profile.env, profile.overrideName, profile.isAutoDetected, requiresUnsafePath);
  if (!validatedProfile) {
    logService?.debug("Terminal profile not validated", profileName, originalPaths);
    return void 0;
  }
  validatedProfile.isAutoDetected = profile.isAutoDetected;
  validatedProfile.icon = icon;
  validatedProfile.color = profile.color;
  return validatedProfile;
}
function validateIcon(icon) {
  if (isString(icon)) {
    return { id: icon };
  }
  return icon;
}
async function initializeWindowsProfiles(testPwshSourcePaths) {
  if (profileSources && !testPwshSourcePaths) {
    return;
  }
  const [gitBashPaths, pwshPaths] = await Promise.all([getGitBashPaths(), testPwshSourcePaths || getPowershellPaths()]);
  profileSources = /* @__PURE__ */ new Map();
  profileSources.set(
    ProfileSource.GitBash,
    {
      profileName: "Git Bash",
      paths: gitBashPaths,
      args: ["--login", "-i"]
    }
  );
  profileSources.set(ProfileSource.Pwsh, {
    profileName: "PowerShell",
    paths: pwshPaths,
    icon: Codicon.terminalPowershell
  });
}
async function getGitBashPaths() {
  const gitDirs = /* @__PURE__ */ new Set();
  const gitExePath = await findExecutable("git.exe");
  if (gitExePath) {
    const gitExeDir = dirname(gitExePath);
    gitDirs.add(resolve(gitExeDir, "../.."));
  }
  function addTruthy(set, value) {
    if (value) {
      set.add(value);
    }
  }
  addTruthy(gitDirs, process.env["ProgramW6432"]);
  addTruthy(gitDirs, process.env["ProgramFiles"]);
  addTruthy(gitDirs, process.env["ProgramFiles(X86)"]);
  addTruthy(gitDirs, `${process.env["LocalAppData"]}\\Program`);
  const gitBashPaths = [];
  for (const gitDir of gitDirs) {
    gitBashPaths.push(
      `${gitDir}\\Git\\bin\\bash.exe`,
      `${gitDir}\\Git\\usr\\bin\\bash.exe`,
      `${gitDir}\\usr\\bin\\bash.exe`
      // using Git for Windows SDK
    );
  }
  gitBashPaths.push(`${process.env["UserProfile"]}\\scoop\\apps\\git\\current\\bin\\bash.exe`);
  gitBashPaths.push(`${process.env["UserProfile"]}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`);
  return gitBashPaths;
}
async function getPowershellPaths() {
  const paths = [];
  for await (const pwshExe of enumeratePowerShellInstallations()) {
    paths.push(pwshExe.exePath);
  }
  return paths;
}
async function getWslProfiles(wslPath, defaultProfileName) {
  const profiles = [];
  const distroOutput = await new Promise((resolve2, reject) => {
    cp.exec("wsl.exe -l -q", { encoding: "utf16le", env: { ...process.env, WSL_UTF8: "0" }, timeout: 1e3 }, (err, stdout) => {
      if (err) {
        return reject("Problem occurred when getting wsl distros");
      }
      resolve2(stdout);
    });
  });
  if (!distroOutput) {
    return [];
  }
  const distroNames = distroOutput.split(/\r?\n/).filter((t) => t.trim().length > 0);
  for (const distroName of distroNames) {
    if (distroName === "") {
      continue;
    }
    if (distroName.startsWith("docker-desktop")) {
      continue;
    }
    const profileName = `${distroName} (WSL)`;
    const profile = {
      profileName,
      path: wslPath,
      args: [`-d`, `${distroName}`],
      isDefault: profileName === defaultProfileName,
      icon: getWslIcon(distroName),
      isAutoDetected: false
    };
    profiles.push(profile);
  }
  return profiles;
}
function getWslIcon(distroName) {
  if (distroName.includes("Ubuntu")) {
    return Codicon.terminalUbuntu;
  } else if (distroName.includes("Debian")) {
    return Codicon.terminalDebian;
  } else {
    return Codicon.terminalLinux;
  }
}
async function detectAvailableUnixProfiles(fsProvider, logService, includeDetectedProfiles, configProfiles, defaultProfileName, testPaths, variableResolver, shellEnv) {
  const detectedProfiles = /* @__PURE__ */ new Map();
  if (includeDetectedProfiles && await fsProvider.existsFile("/etc/shells" /* UnixShellsPath */)) {
    const contents = (await fsProvider.readFile("/etc/shells" /* UnixShellsPath */)).toString();
    const profiles = (testPaths || contents.split("\n")).map((e) => {
      const index = e.indexOf("#");
      return index === -1 ? e : e.substring(0, index);
    }).filter((e) => e.trim().length > 0);
    const counts = /* @__PURE__ */ new Map();
    for (const profile of profiles) {
      let profileName = basename(profile);
      let count = counts.get(profileName) || 0;
      count++;
      if (count > 1) {
        profileName = `${profileName} (${count})`;
      }
      counts.set(profileName, count);
      detectedProfiles.set(profileName, { path: profile, isAutoDetected: true });
    }
  }
  applyConfigProfilesToMap(configProfiles, detectedProfiles);
  return await transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName, fsProvider, shellEnv, logService, variableResolver);
}
function applyConfigProfilesToMap(configProfiles, profilesMap) {
  if (!configProfiles) {
    return;
  }
  for (const [profileName, value] of Object.entries(configProfiles)) {
    if (value === null || !isObject(value) || !hasKey(value, { path: true }) && !hasKey(value, { source: true })) {
      profilesMap.delete(profileName);
    } else {
      value.icon = value.icon || profilesMap.get(profileName)?.icon;
      profilesMap.set(profileName, value);
    }
  }
}
async function validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected, requiresUnsafePath) {
  if (potentialPaths.length === 0) {
    return Promise.resolve(void 0);
  }
  const path = potentialPaths.shift();
  if (path === "") {
    return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected);
  }
  const isUnsafePath = !isString(path) && path.isUnsafe;
  const actualPath = isString(path) ? path : path.path;
  const profile = {
    profileName,
    path: actualPath,
    args,
    env,
    overrideName,
    isAutoDetected,
    isDefault: profileName === defaultProfileName,
    isUnsafePath,
    requiresUnsafePath
  };
  if (basename(actualPath) === actualPath) {
    const envPaths = shellEnv.PATH ? shellEnv.PATH.split(delimiter) : void 0;
    const executable = await findExecutable(actualPath, void 0, envPaths, void 0, fsProvider.existsFile);
    if (!executable) {
      return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args);
    }
    profile.path = executable;
    profile.isFromPath = true;
    return profile;
  }
  const result = await fsProvider.existsFile(normalize(actualPath));
  if (result) {
    return profile;
  }
  return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected);
}
export {
  detectAvailableProfiles
};
