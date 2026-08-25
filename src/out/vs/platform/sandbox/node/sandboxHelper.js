import { execFile } from "child_process";
import { readFile } from "fs/promises";
import { getCaseInsensitive } from "../../../base/common/objects.js";
import { win32 } from "../../../base/common/path.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { getOSReleaseInfo } from "../../../base/node/osReleaseInfo.js";
import { findExecutable } from "../../../base/node/processes.js";
const linuxDependencyInstallCommands = [
  { distributionIds: ["debian", "ubuntu", "linuxmint", "pop", "elementary", "kali", "raspbian"], commands: [["apt-get", "apt-get update && apt-get install -y"], ["apt", "apt update && apt install -y"]] },
  { distributionIds: ["fedora", "rhel", "centos", "rocky", "almalinux"], commands: [["dnf", "dnf install -y"], ["yum", "yum install -y"]] },
  { distributionIds: ["arch", "manjaro", "endeavouros"], commands: [["pacman", "pacman -S --needed --noconfirm"]] },
  { distributionIds: ["suse", "opensuse", "opensuse-leap", "opensuse-tumbleweed"], commands: [["zypper", "zypper --non-interactive install"]] },
  { distributionIds: ["alpine"], commands: [["apk", "apk add"]] }
];
class SandboxHelperService {
  static async checkSandboxDependenciesWith(findCommand, linux = isLinux, probeBubblewrap = (command) => SandboxHelperService._probeBubblewrap(command), resolveInstallEnvironment = () => SandboxHelperService._resolveLinuxInstallEnvironment(), resolveAppArmorRestriction = () => SandboxHelperService._resolveAppArmorRestriction()) {
    if (!linux) {
      return void 0;
    }
    const [bubblewrapPath, socatPath] = await Promise.all([
      findCommand("bwrap"),
      findCommand("socat")
    ]);
    const bubblewrapProbe = bubblewrapPath ? await probeBubblewrap(bubblewrapPath) : { usable: false };
    const [dependencyInstallCommand, apparmorRestrictsUnprivilegedUserNamespaces] = await Promise.all([
      !bubblewrapPath || !socatPath ? SandboxHelperService._findDependencyInstallCommand(findCommand, resolveInstallEnvironment) : void 0,
      bubblewrapPath && !bubblewrapProbe.usable ? resolveAppArmorRestriction() : void 0
    ]);
    return {
      bubblewrapInstalled: !!bubblewrapPath,
      bubblewrapUsable: bubblewrapProbe.usable,
      bubblewrapError: bubblewrapProbe.error,
      socatInstalled: !!socatPath,
      dependencyInstallCommand,
      ...apparmorRestrictsUnprivilegedUserNamespaces === void 0 ? void 0 : { apparmorRestrictsUnprivilegedUserNamespaces }
    };
  }
  static async _resolveAppArmorRestriction() {
    const apparmorRestriction = await readFile("/proc/sys/kernel/apparmor_restrict_unprivileged_userns", "utf8").catch(() => void 0);
    return apparmorRestriction === void 0 ? void 0 : apparmorRestriction.trim() === "1";
  }
  static async _findDependencyInstallCommand(findCommand, resolveInstallEnvironment) {
    const environment = await resolveInstallEnvironment();
    const installer = linuxDependencyInstallCommands.find((candidate) => candidate.distributionIds.some((id) => environment.distributionIds.includes(id)));
    if (!installer) {
      return void 0;
    }
    const elevation = environment.isRoot ? "" : await findCommand("sudo") ? "sudo " : void 0;
    if (elevation === void 0) {
      return void 0;
    }
    for (const [executable, command] of installer.commands) {
      if (await findCommand(executable)) {
        return command.split(" && ").map((command2) => `${elevation}${command2}`).join(" && ");
      }
    }
    return void 0;
  }
  static async _resolveLinuxInstallEnvironment() {
    const releaseInfo = await getOSReleaseInfo(() => {
    });
    return {
      distributionIds: [releaseInfo?.id, ...releaseInfo?.id_like?.split(/\s+/) ?? []].filter((id) => !!id),
      isRoot: process.getuid?.() === 0
    };
  }
  checkSandboxDependencies() {
    return SandboxHelperService.checkSandboxDependenciesWith(findExecutable);
  }
  static _probeBubblewrap(command) {
    return new Promise((resolve) => {
      execFile(command, ["--unshare-net", "--dev-bind", "/", "/", "echo", "ok"], { encoding: "utf8", timeout: 5e3 }, (error, stdout, stderr) => {
        if (!error && stdout.trim() === "ok") {
          resolve({ usable: true });
          return;
        }
        const detail = stderr.trim() || error?.message || `Unexpected output: ${stdout.trim()}`;
        resolve({ usable: false, error: detail.slice(0, 1e3) });
      });
    });
  }
  async getWindowsMxcFilesystemPolicy() {
    if (!isWindows) {
      return void 0;
    }
    const { getAvailableToolsPolicy, getUserProfilePolicy, getTemporaryFilesPolicy } = await import("@microsoft/mxc-sdk");
    const availableToolsPolicy = getAvailableToolsPolicy(process.env, { containerType: "processcontainer" });
    const userProfilePolicy = getUserProfilePolicy();
    const temporaryFilesPolicy = getTemporaryFilesPolicy(process.env);
    const psHome = await this._getPSHome();
    return {
      readonlyPaths: [.../* @__PURE__ */ new Set([...availableToolsPolicy.readonlyPaths, ...userProfilePolicy.readonlyPaths, ...temporaryFilesPolicy.readonlyPaths, ...psHome ? [psHome] : []])],
      readwritePaths: [.../* @__PURE__ */ new Set([...availableToolsPolicy.readwritePaths, ...userProfilePolicy.readwritePaths, ...temporaryFilesPolicy.readwritePaths])]
    };
  }
  async getWindowsMxcEnvironment() {
    if (!isWindows) {
      return void 0;
    }
    const env = [];
    for (const variable of ["SystemRoot", "PATH", "ComSpec", "PATHEXT", "PSModulePath"]) {
      const value = getCaseInsensitive(process.env, variable);
      if (typeof value === "string" && value) {
        env.push(`${variable}=${value}`);
      }
    }
    const userProfile = getCaseInsensitive(process.env, "USERPROFILE");
    if (typeof userProfile === "string" && userProfile) {
      env.push(`USERPROFILE=${userProfile}`);
    }
    const appData = getCaseInsensitive(process.env, "APPDATA");
    if (typeof appData === "string" && appData) {
      env.push(`APPDATA=${appData}`);
    }
    const localAppData = this._getLocalAppData();
    if (typeof localAppData === "string" && localAppData) {
      env.push(`LOCALAPPDATA=${localAppData}`);
    }
    const psHome = await this._getPSHome();
    if (psHome) {
      env.push(`PSHOME=${psHome}`);
    }
    return env;
  }
  async buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment = "process") {
    if (!isWindows) {
      return void 0;
    }
    const { buildSandboxPayload } = await import("@microsoft/mxc-sdk");
    return buildSandboxPayload(commandLine, policy, workingDirectory, containerName, containment);
  }
  async _getPSHome() {
    const psHome = getCaseInsensitive(process.env, "PSHOME");
    if (typeof psHome === "string" && psHome) {
      return psHome;
    }
    const powerShellPath = await findExecutable("pwsh") ?? await findExecutable("powershell");
    return powerShellPath ? win32.dirname(powerShellPath) : void 0;
  }
  _getLocalAppData() {
    const localAppData = getCaseInsensitive(process.env, "LOCALAPPDATA");
    return typeof localAppData === "string" && localAppData ? localAppData : void 0;
  }
}
export {
  SandboxHelperService
};
