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
import { app } from "electron";
import { coalesce } from "../../../base/common/arrays.js";
import { isMacintosh } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { whenDeleted } from "../../../base/node/pfs.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { isLaunchedFromCli } from "../../environment/node/argvHelper.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IURLService } from "../../url/common/url.js";
import { IWindowsMainService, OpenContext } from "../../windows/electron-main/windows.js";
const ID = "launchMainService";
const ILaunchMainService = createDecorator(ID);
let LaunchMainService = class {
  constructor(logService, windowsMainService, urlService, configurationService) {
    this.logService = logService;
    this.windowsMainService = windowsMainService;
    this.urlService = urlService;
    this.configurationService = configurationService;
  }
  async start(args, userEnv) {
    this.logService.trace("Received data from other instance: ", args, userEnv);
    if (isMacintosh) {
      app.focus({ steal: true });
    }
    const urlsToOpen = this.parseOpenUrl(args);
    if (urlsToOpen.length) {
      let whenWindowReady = Promise.resolve();
      if (this.windowsMainService.getWindowCount() === 0) {
        const window = (await this.windowsMainService.openEmptyWindow({ context: OpenContext.DESKTOP })).at(0);
        if (window) {
          whenWindowReady = window.ready();
        }
      }
      whenWindowReady.then(() => {
        for (const { uri, originalUrl } of urlsToOpen) {
          this.urlService.open(uri, { originalUrl });
        }
      });
    } else {
      return this.startOpenWindow(args, userEnv);
    }
  }
  parseOpenUrl(args) {
    if (args["open-url"] && args._urls && args._urls.length > 0) {
      return coalesce(args._urls.map((url) => {
        try {
          return { uri: URI.parse(url), originalUrl: url };
        } catch (err) {
          return null;
        }
      }));
    }
    return [];
  }
  async startOpenWindow(args, userEnv) {
    const context = isLaunchedFromCli(userEnv) ? OpenContext.CLI : OpenContext.DESKTOP;
    let usedWindows = [];
    const waitMarkerFileURI = args.wait && args.waitMarkerFilePath ? URI.file(args.waitMarkerFilePath) : void 0;
    const remoteAuthority = args.remote || void 0;
    const baseConfig = {
      context,
      cli: args,
      /**
       * When opening a new window from a second instance that sent args and env
       * over to this instance, we want to preserve the environment only if that second
       * instance was spawned from the CLI or used the `--preserve-env` flag (example:
       * when using `open -n "VSCode.app" --args --preserve-env WORKSPACE_FOLDER`).
       *
       * This is done to ensure that the second window gets treated exactly the same
       * as the first window, for example, it gets the same resolved user shell environment.
       *
       * https://github.com/microsoft/vscode/issues/194736
       */
      userEnv: args["preserve-env"] || context === OpenContext.CLI ? userEnv : void 0,
      waitMarkerFileURI,
      remoteAuthority,
      forceProfile: args.profile,
      forceTempProfile: args["profile-temp"]
    };
    if (args.extensionDevelopmentPath) {
      await this.windowsMainService.openExtensionDevelopmentHostWindow(args.extensionDevelopmentPath, baseConfig);
    } else if (args["agents"]) {
      usedWindows = await this.windowsMainService.openAgentsWindow(baseConfig);
    } else if (!args._.length && !args["folder-uri"] && !args["file-uri"]) {
      let openNewWindow = false;
      if (args["new-window"] || baseConfig.forceProfile || baseConfig.forceTempProfile) {
        openNewWindow = true;
      } else if (args["reuse-window"]) {
        openNewWindow = false;
      } else {
        const windowConfig = this.configurationService.getValue("window");
        const openWithoutArgumentsInNewWindowConfig = windowConfig?.openWithoutArgumentsInNewWindow || "default";
        switch (openWithoutArgumentsInNewWindowConfig) {
          case "on":
            openNewWindow = true;
            break;
          case "off":
            openNewWindow = false;
            break;
          default:
            openNewWindow = !isMacintosh;
        }
      }
      if (openNewWindow) {
        usedWindows = await this.windowsMainService.open({
          ...baseConfig,
          forceNewWindow: true,
          forceEmpty: true
        });
      } else {
        const lastActive = this.windowsMainService.getLastActiveWindow();
        if (lastActive) {
          this.windowsMainService.openExistingWindow(lastActive, baseConfig);
          usedWindows = [lastActive];
        } else {
          usedWindows = await this.windowsMainService.open({
            ...baseConfig,
            forceEmpty: true
          });
        }
      }
    } else {
      usedWindows = await this.windowsMainService.open({
        ...baseConfig,
        forceNewWindow: args["new-window"],
        preferNewWindow: !args["reuse-window"] && !args.wait,
        forceReuseWindow: args["reuse-window"],
        diffMode: args.diff,
        mergeMode: args.merge,
        addMode: args.add,
        removeMode: args.remove,
        noRecentEntry: !!args["skip-add-to-recently-opened"],
        gotoLineMode: args.goto
      });
    }
    if (waitMarkerFileURI && usedWindows.length === 1 && usedWindows[0]) {
      return Promise.race([
        usedWindows[0].whenClosedOrLoaded,
        whenDeleted(waitMarkerFileURI.fsPath)
      ]).then(() => void 0, () => void 0);
    }
  }
  async getMainProcessId() {
    this.logService.trace("Received request for process ID from other instance.");
    return process.pid;
  }
};
LaunchMainService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWindowsMainService),
  __decorateParam(2, IURLService),
  __decorateParam(3, IConfigurationService)
], LaunchMainService);
export {
  ID,
  ILaunchMainService,
  LaunchMainService
};
