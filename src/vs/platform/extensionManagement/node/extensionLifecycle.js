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
import { fork } from "child_process";
import { Limiter } from "../../../base/common/async.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { join } from "../../../base/common/path.js";
import { Promises } from "../../../base/node/pfs.js";
import { ILogService } from "../../log/common/log.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
let ExtensionsLifecycle = class extends Disposable {
  // Run max 5 processes in parallel
  constructor(userDataProfilesService, logService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    this.logService = logService;
    this.processesLimiter = new Limiter(5);
  }
  async postUninstall(extension) {
    const script = this.parseScript(extension, "uninstall");
    if (script) {
      this.logService.info(extension.identifier.id, extension.manifest.version, `Running post uninstall script`);
      await this.processesLimiter.queue(async () => {
        try {
          await this.runLifecycleHook(script.script, "uninstall", script.args, true, extension);
          this.logService.info(`Finished running post uninstall script`, extension.identifier.id, extension.manifest.version);
        } catch (error) {
          this.logService.error("Failed to run post uninstall script", extension.identifier.id, extension.manifest.version);
          this.logService.error(error);
        }
      });
    }
    try {
      await Promises.rm(this.getExtensionStoragePath(extension));
    } catch (error) {
      this.logService.error("Error while removing extension storage path", extension.identifier.id);
      this.logService.error(error);
    }
  }
  parseScript(extension, type) {
    const scriptKey = `vscode:${type}`;
    if (extension.location.scheme === Schemas.file && extension.manifest && extension.manifest["scripts"] && typeof extension.manifest["scripts"][scriptKey] === "string") {
      const script = extension.manifest["scripts"][scriptKey].split(" ");
      if (script.length < 2 || script[0] !== "node" || !script[1]) {
        this.logService.warn(extension.identifier.id, extension.manifest.version, `${scriptKey} should be a node script`);
        return null;
      }
      return { script: join(extension.location.fsPath, script[1]), args: script.slice(2) || [] };
    }
    return null;
  }
  runLifecycleHook(lifecycleHook, lifecycleType, args, timeout, extension) {
    return new Promise((c, e) => {
      const extensionLifecycleProcess = this.start(lifecycleHook, lifecycleType, args, extension);
      let timeoutHandler;
      const onexit = (error) => {
        if (timeoutHandler) {
          clearTimeout(timeoutHandler);
          timeoutHandler = null;
        }
        if (error) {
          e(error);
        } else {
          c(void 0);
        }
      };
      extensionLifecycleProcess.on("error", (err) => {
        onexit(toErrorMessage(err) || "Unknown");
      });
      extensionLifecycleProcess.on("exit", (code, signal) => {
        onexit(code ? `post-${lifecycleType} process exited with code ${code}` : void 0);
      });
      if (timeout) {
        timeoutHandler = setTimeout(() => {
          timeoutHandler = null;
          extensionLifecycleProcess.kill();
          e("timed out");
        }, 5e3);
      }
    });
  }
  start(uninstallHook, lifecycleType, args, extension) {
    const opts = {
      silent: true,
      execArgv: void 0
    };
    const extensionUninstallProcess = fork(uninstallHook, [`--type=extension-post-${lifecycleType}`, ...args], opts);
    extensionUninstallProcess.stdout.setEncoding("utf8");
    extensionUninstallProcess.stderr.setEncoding("utf8");
    const onStdout = Event.fromNodeEventEmitter(extensionUninstallProcess.stdout, "data");
    const onStderr = Event.fromNodeEventEmitter(extensionUninstallProcess.stderr, "data");
    this._register(onStdout((data) => this.logService.info(extension.identifier.id, extension.manifest.version, `post-${lifecycleType}`, data)));
    this._register(onStderr((data) => this.logService.error(extension.identifier.id, extension.manifest.version, `post-${lifecycleType}`, data)));
    const onOutput = Event.any(
      Event.map(onStdout, (o) => ({ data: `%c${o}`, format: [""] }), this._store),
      Event.map(onStderr, (o) => ({ data: `%c${o}`, format: ["color: red"] }), this._store)
    );
    const onDebouncedOutput = Event.debounce(onOutput, (r, o) => {
      return r ? { data: r.data + o.data, format: [...r.format, ...o.format] } : { data: o.data, format: o.format };
    }, 100, void 0, void 0, void 0, this._store);
    onDebouncedOutput((data) => {
      console.group(extension.identifier.id);
      console.log(data.data, ...data.format);
      console.groupEnd();
    });
    return extensionUninstallProcess;
  }
  getExtensionStoragePath(extension) {
    return join(this.userDataProfilesService.defaultProfile.globalStorageHome.fsPath, extension.identifier.id.toLowerCase());
  }
};
ExtensionsLifecycle = __decorateClass([
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, ILogService)
], ExtensionsLifecycle);
export {
  ExtensionsLifecycle
};
