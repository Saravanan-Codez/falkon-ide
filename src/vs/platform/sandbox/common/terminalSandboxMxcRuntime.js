import { win32 } from "../../../base/common/path.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IWindowsMxcTerminalSandboxRuntime = createDecorator("windowsMxcTerminalSandboxRuntime");
class WindowsMxcTerminalSandboxRuntime {
  constructor() {
    this._configVersion = "0.6.0-alpha";
  }
  getExecutablePath(appRoot, nativeModulesDir, arch) {
    const binArch = arch === "arm64" ? "arm64" : "x64";
    return win32.join(appRoot, nativeModulesDir, "@microsoft", "mxc-sdk", "bin", binArch, "wxc-exec.exe");
  }
  getRuntimeReadPaths(appRoot, executablePath) {
    const paths = [];
    if (appRoot) {
      paths.push(appRoot);
    }
    if (executablePath) {
      paths.push(executablePath, win32.dirname(executablePath));
    }
    return [...new Set(paths)];
  }
  async createConfig(options, buildSandboxPayload) {
    const tempDirPath = this.toWindowsPath(options.tempDir);
    const shell = options.shell ? this._quoteWindowsCommandLineArgument(options.shell) : "pwsh.exe";
    const commandLine = `${shell} -NoProfile -Command ${this._quoteWindowsCommandLineArgument(options.command)}`;
    const cwd = options.cwd ? this.toWindowsPath(options.cwd) : tempDirPath;
    const policy = {
      version: options.schemaVersion ?? this._configVersion,
      timeoutMs: 0,
      filesystem: {
        readwritePaths: options.allowWritePaths.map((path) => this._normalizeWindowsPath(path)),
        readonlyPaths: [tempDirPath, ...options.shell && win32.isAbsolute(options.shell) ? [win32.dirname(options.shell)] : [], ...options.allowReadPaths].map((path) => this._normalizeWindowsPath(path)),
        deniedPaths: options.denyReadPaths.map((path) => this._normalizeWindowsPath(path))
      },
      network: this._createNetworkPolicy(options.allowNetwork),
      ui: {
        allowWindows: true,
        clipboard: "none",
        allowInputInjection: false
      }
    };
    const config = await buildSandboxPayload(commandLine, policy, cwd);
    if (!config?.process) {
      throw new Error("Unable to build Windows MXC sandbox payload");
    }
    config.process.env = [...options.env];
    return config;
  }
  wrapCommand(executablePath, configPath) {
    return `& ${this._quotePowerShellArgument(executablePath)} ${this._quotePowerShellArgument(configPath)}`;
  }
  wrapUnsandboxedCommand(command) {
    return command;
  }
  toWindowsPath(uri) {
    let value;
    if (uri.authority && uri.path.length > 1 && uri.scheme === "file") {
      value = `\\\\${uri.authority}${uri.path}`;
    } else if (/^\/[a-zA-Z]:/.test(uri.path)) {
      value = uri.path.slice(1);
    } else {
      value = uri.fsPath;
    }
    return this._normalizeWindowsPath(value);
  }
  _normalizeWindowsPath(path) {
    return path.replace(/\//g, "\\");
  }
  _createNetworkPolicy(allowNetwork) {
    return { allowOutbound: allowNetwork };
  }
  _quotePowerShellArgument(value) {
    return `'${value.replace(/'/g, `''`)}'`;
  }
  _quoteWindowsCommandLineArgument(value) {
    return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/\\+$/g, "$&$&")}"`;
  }
}
export {
  IWindowsMxcTerminalSandboxRuntime,
  WindowsMxcTerminalSandboxRuntime
};
