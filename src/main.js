import * as path from "node:path";
import * as fs from "original-fs";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { configurePortable } from "./bootstrap-node.js";
import { bootstrapESM } from "./bootstrap-esm.js";
import { app, protocol, crashReporter, Menu, contentTracing } from "electron";
import minimist from "minimist";
import { product } from "./bootstrap-meta.js";
import { parse } from "./vs/base/common/jsonc.js";
import { getUserDataPath } from "./vs/platform/environment/node/userDataPath.js";
import * as perf from "./vs/base/common/performance.js";
import { resolveNLSConfiguration } from "./vs/base/node/nls.js";
import { getUNCHost, addUNCHostToAllowlist } from "./vs/base/node/unc.js";
perf.mark("code/didStartMain");
perf.mark("code/willLoadMainBundle", {
  // When built, the main bundle is a single JS file with all
  // dependencies inlined. As such, we mark `willLoadMainBundle`
  // as the start of the main bundle loading process.
  startTime: Math.floor(performance.timeOrigin)
});
perf.mark("code/didLoadMainBundle");
const portable = configurePortable(product);
const args = parseCLIArgs();
const argvConfig = configureCommandlineSwitchesSync(args);
if (args["sandbox"] && !args["disable-chromium-sandbox"] && !argvConfig["disable-chromium-sandbox"]) {
  app.enableSandbox();
} else if (app.commandLine.hasSwitch("no-sandbox") && !app.commandLine.hasSwitch("disable-gpu-sandbox")) {
  app.commandLine.appendSwitch("disable-gpu-sandbox");
} else {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}
const userDataPath = getUserDataPath(args, product.nameShort ?? "code-oss-dev");
if (process.platform === "win32") {
  const userDataUNCHost = getUNCHost(userDataPath);
  if (userDataUNCHost) {
    addUNCHostToAllowlist(userDataUNCHost);
  }
}
app.setPath("userData", userDataPath);
const codeCachePath = getCodeCachePath();
Menu.setApplicationMenu(null);
perf.mark("code/willStartCrashReporter");
if (args["crash-reporter-directory"] || argvConfig["enable-crash-reporter"] && !args["disable-crash-reporter"]) {
  configureCrashReporter();
}
perf.mark("code/didStartCrashReporter");
if (portable.isPortable) {
  app.setAppLogsPath(path.join(userDataPath, "logs"));
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "vscode-webview",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, codeCache: true }
  },
  {
    scheme: "vscode-file",
    privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, codeCache: true }
  },
  {
    scheme: "vscode-remote-resource",
    privileges: { secure: true, supportFetchAPI: true, corsEnabled: true }
  },
  {
    scheme: "vscode-managed-remote-resource",
    privileges: { secure: true, supportFetchAPI: true, corsEnabled: true }
  }
]);
registerListeners();
let nlsConfigurationPromise = void 0;
const osLocale = processZhLocale((app.getPreferredSystemLanguages()?.[0] ?? "en").toLowerCase());
const userLocale = getUserDefinedLocale(argvConfig);
if (userLocale) {
  nlsConfigurationPromise = resolveNLSConfiguration({
    userLocale,
    osLocale,
    commit: product.commit,
    userDataPath,
    nlsMetadataPath: import.meta.dirname
  });
}
if (process.platform === "win32" || process.platform === "linux") {
  const electronLocale = !userLocale || userLocale === "qps-ploc" ? "en" : userLocale;
  app.commandLine.appendSwitch("lang", electronLocale);
}
app.once("ready", function() {
  if (args["trace"]) {
    let traceOptions;
    if (args["trace-memory-infra"]) {
      const customCategories = args["trace-category-filter"]?.split(",") || [];
      customCategories.push("disabled-by-default-memory-infra", "disabled-by-default-memory-infra.v8.code_stats");
      traceOptions = {
        included_categories: customCategories,
        excluded_categories: ["*"],
        memory_dump_config: {
          allowed_dump_modes: ["light", "detailed"],
          triggers: [
            {
              type: "periodic_interval",
              mode: "detailed",
              min_time_between_dumps_ms: 1e4
            },
            {
              type: "periodic_interval",
              mode: "light",
              min_time_between_dumps_ms: 1e3
            }
          ]
        }
      };
    } else {
      traceOptions = {
        categoryFilter: args["trace-category-filter"] || "*",
        traceOptions: args["trace-options"] || "record-until-full,enable-sampling"
      };
    }
    contentTracing.startRecording(traceOptions).finally(() => onReady());
  } else {
    onReady();
  }
});
async function onReady() {
  perf.mark("code/mainAppReady");
  try {
    const [, nlsConfig] = await Promise.all([
      mkdirpIgnoreError(codeCachePath),
      resolveNlsConfiguration()
    ]);
    await startup(codeCachePath, nlsConfig);
  } catch (error) {
    console.error(error);
  }
}
async function startup(codeCachePath2, nlsConfig) {
  process.env["VSCODE_NLS_CONFIG"] = JSON.stringify(nlsConfig);
  process.env["VSCODE_CODE_CACHE_PATH"] = codeCachePath2 || "";
  await bootstrapESM();
  await import("./vs/code/electron-main/main.js");
  perf.mark("code/didRunMainBundle");
}
function configureCommandlineSwitchesSync(cliArgs) {
  const SUPPORTED_ELECTRON_SWITCHES = [
    // alias from us for --disable-gpu
    "disable-hardware-acceleration",
    // override for the color profile to use
    "force-color-profile",
    // disable LCD font rendering, a Chromium flag
    "disable-lcd-text",
    // bypass any specified proxy for the given semi-colon-separated list of hosts
    "proxy-bypass-list",
    "remote-debugging-port"
  ];
  if (process.platform === "linux") {
    SUPPORTED_ELECTRON_SWITCHES.push("force-renderer-accessibility");
    SUPPORTED_ELECTRON_SWITCHES.push("password-store");
  }
  const SUPPORTED_MAIN_PROCESS_SWITCHES = [
    // Persistently enable proposed api via argv.json: https://github.com/microsoft/vscode/issues/99775
    "enable-proposed-api",
    // Log level to use. Default is 'info'. Allowed values are 'error', 'warn', 'info', 'debug', 'trace', 'off'.
    "log-level",
    // Use an in-memory storage for secrets
    "use-inmemory-secretstorage",
    // Enables display tracking to restore maximized windows under RDP: https://github.com/electron/electron/issues/47016
    "enable-rdp-display-tracking"
  ];
  const argvConfig2 = readArgvConfigSync();
  Object.keys(argvConfig2).forEach((argvKey) => {
    const argvValue = argvConfig2[argvKey];
    if (SUPPORTED_ELECTRON_SWITCHES.indexOf(argvKey) !== -1) {
      if (argvValue === true || argvValue === "true") {
        if (argvKey === "disable-hardware-acceleration") {
          app.disableHardwareAcceleration();
        } else {
          app.commandLine.appendSwitch(argvKey);
        }
      } else if (typeof argvValue === "string" && argvValue) {
        if (argvKey === "password-store") {
          let migratedArgvValue = argvValue;
          if (argvValue === "gnome" || argvValue === "gnome-keyring") {
            migratedArgvValue = "gnome-libsecret";
          }
          app.commandLine.appendSwitch(argvKey, migratedArgvValue);
        } else {
          app.commandLine.appendSwitch(argvKey, argvValue);
        }
      }
    } else if (SUPPORTED_MAIN_PROCESS_SWITCHES.indexOf(argvKey) !== -1) {
      switch (argvKey) {
        case "enable-proposed-api":
          if (Array.isArray(argvValue)) {
            argvValue.forEach((id) => id && typeof id === "string" && process.argv.push("--enable-proposed-api", id));
          } else {
            console.error(`Unexpected value for \`enable-proposed-api\` in argv.json. Expected array of extension ids.`);
          }
          break;
        case "log-level":
          if (typeof argvValue === "string") {
            process.argv.push("--log", argvValue);
          } else if (Array.isArray(argvValue)) {
            for (const value of argvValue) {
              process.argv.push("--log", value);
            }
          }
          break;
        case "use-inmemory-secretstorage":
          if (argvValue) {
            process.argv.push("--use-inmemory-secretstorage");
          }
          break;
        case "enable-rdp-display-tracking":
          if (argvValue) {
            process.argv.push("--enable-rdp-display-tracking");
          }
          break;
      }
    }
  });
  const featuresToEnable = `NetAdapterMaxBufSizeFeature:NetAdapterMaxBufSize/8192,DocumentPolicyIncludeJSCallStacksInCrashReports,EarlyEstablishGpuChannel,EstablishGpuChannelAsync${process.platform === "linux" ? ",GlobalShortcutsPortal" : ""},${app.commandLine.getSwitchValue("enable-features")}`;
  app.commandLine.appendSwitch("enable-features", featuresToEnable);
  const featuresToDisable = `CalculateNativeWinOcclusion,${app.commandLine.getSwitchValue("disable-features")}`;
  app.commandLine.appendSwitch("disable-features", featuresToDisable);
  const blinkFeaturesToDisable = `FontMatchingCTMigration,StandardizedBrowserZoom,${app.commandLine.getSwitchValue("disable-blink-features")}`;
  app.commandLine.appendSwitch("disable-blink-features", blinkFeaturesToDisable);
  const jsFlags = getJSFlags(cliArgs, argvConfig2);
  if (jsFlags) {
    app.commandLine.appendSwitch("js-flags", jsFlags);
  }
  app.commandLine.appendSwitch("xdg-portal-required-version", "4");
  app.commandLine.appendSwitch("max-active-webgl-contexts", "32");
  return argvConfig2;
}
function readArgvConfigSync() {
  const argvConfigPath = getArgvConfigPath();
  let argvConfig2 = void 0;
  try {
    argvConfig2 = parse(fs.readFileSync(argvConfigPath).toString());
  } catch (error) {
    if (error && error.code === "ENOENT") {
      createDefaultArgvConfigSync(argvConfigPath);
    } else {
      console.warn(`Unable to read argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
    }
  }
  if (!argvConfig2) {
    argvConfig2 = {};
  }
  return argvConfig2;
}
function createDefaultArgvConfigSync(argvConfigPath) {
  try {
    const argvConfigPathDirname = path.dirname(argvConfigPath);
    if (!fs.existsSync(argvConfigPathDirname)) {
      fs.mkdirSync(argvConfigPathDirname);
    }
    const defaultArgvConfigContent = [
      "// This configuration file allows you to pass permanent command line arguments to VS Code.",
      "// Only a subset of arguments is currently supported to reduce the likelihood of breaking",
      "// the installation.",
      "//",
      "// PLEASE DO NOT CHANGE WITHOUT UNDERSTANDING THE IMPACT",
      "//",
      "// NOTE: Changing this file requires a restart of VS Code.",
      "{",
      "	// Use software rendering instead of hardware accelerated rendering.",
      "	// This can help in cases where you see rendering issues in VS Code.",
      '	// "disable-hardware-acceleration": true',
      "}"
    ];
    fs.writeFileSync(argvConfigPath, defaultArgvConfigContent.join("\n"));
  } catch (error) {
    console.error(`Unable to create argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
  }
}
function getArgvConfigPath() {
  const vscodePortable = process.env["VSCODE_PORTABLE"];
  if (vscodePortable) {
    return path.join(vscodePortable, "argv.json");
  }
  let dataFolderName = product.dataFolderName;
  if (process.env["VSCODE_DEV"]) {
    dataFolderName = `${dataFolderName}-dev`;
  }
  return path.join(os.homedir(), dataFolderName, "argv.json");
}
function configureCrashReporter() {
  let crashReporterDirectory = args["crash-reporter-directory"];
  let submitURL = "";
  if (crashReporterDirectory) {
    crashReporterDirectory = path.normalize(crashReporterDirectory);
    if (!path.isAbsolute(crashReporterDirectory)) {
      console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory must be absolute.`);
      app.exit(1);
    }
    if (!fs.existsSync(crashReporterDirectory)) {
      try {
        fs.mkdirSync(crashReporterDirectory, { recursive: true });
      } catch (error) {
        console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory does not seem to exist or cannot be created.`);
        app.exit(1);
      }
    }
    console.log(`Found --crash-reporter-directory argument. Setting crashDumps directory to be '${crashReporterDirectory}'`);
    app.setPath("crashDumps", crashReporterDirectory);
  } else {
    const appCenter = product.appCenter;
    if (appCenter) {
      const isWindows = process.platform === "win32";
      const isLinux = process.platform === "linux";
      const isDarwin = process.platform === "darwin";
      const crashReporterId = argvConfig["crash-reporter-id"];
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (crashReporterId && uuidPattern.test(crashReporterId)) {
        if (isWindows) {
          switch (process.arch) {
            case "x64":
              submitURL = appCenter["win32-x64"];
              break;
            case "arm64":
              submitURL = appCenter["win32-arm64"];
              break;
          }
        } else if (isDarwin) {
          if (product.darwinUniversalAssetId) {
            submitURL = appCenter["darwin-universal"];
          } else {
            switch (process.arch) {
              case "x64":
                submitURL = appCenter["darwin"];
                break;
              case "arm64":
                submitURL = appCenter["darwin-arm64"];
                break;
            }
          }
        } else if (isLinux) {
          submitURL = appCenter["linux-x64"];
        }
        submitURL = submitURL.concat("&uid=", crashReporterId, "&iid=", crashReporterId, "&sid=", crashReporterId);
        const argv = process.argv;
        const endOfArgsMarkerIndex = argv.indexOf("--");
        if (endOfArgsMarkerIndex === -1) {
          argv.push("--crash-reporter-id", crashReporterId);
        } else {
          argv.splice(endOfArgsMarkerIndex, 0, "--crash-reporter-id", crashReporterId);
        }
      }
    }
  }
  const productName = (product.crashReporter ? product.crashReporter.productName : void 0) || product.nameShort;
  const companyName = (product.crashReporter ? product.crashReporter.companyName : void 0) || "Microsoft";
  const uploadToServer = Boolean(!process.env["VSCODE_DEV"] && submitURL && !crashReporterDirectory);
  crashReporter.start({
    companyName,
    productName: process.env["VSCODE_DEV"] ? `${productName} Dev` : productName,
    submitURL,
    uploadToServer,
    compress: true,
    ignoreSystemCrashHandler: true
  });
}
function getJSFlags(cliArgs, argvConfig2) {
  const jsFlags = [];
  if (cliArgs["js-flags"]) {
    jsFlags.push(cliArgs["js-flags"]);
  }
  if (typeof argvConfig2["js-flags"] === "string" && argvConfig2["js-flags"]) {
    jsFlags.push(argvConfig2["js-flags"]);
  }
  return jsFlags.length > 0 ? jsFlags.join(" ") : null;
}
function parseCLIArgs() {
  return minimist(process.argv, {
    string: [
      "user-data-dir",
      "locale",
      "js-flags",
      "crash-reporter-directory"
    ],
    boolean: [
      "disable-chromium-sandbox"
    ],
    default: {
      "sandbox": true
    },
    alias: {
      "no-sandbox": "sandbox"
    }
  });
}
function registerListeners() {
  const macOpenFiles = [];
  globalThis.macOpenFiles = macOpenFiles;
  app.on("open-file", function(event, path2) {
    macOpenFiles.push(path2);
  });
  const openUrls = [];
  const onOpenUrl = function(event, url) {
    event.preventDefault();
    openUrls.push(url);
  };
  app.on("will-finish-launching", function() {
    app.on("open-url", onOpenUrl);
  });
  globalThis.getOpenUrls = function() {
    app.removeListener("open-url", onOpenUrl);
    return openUrls;
  };
}
function getCodeCachePath() {
  if (process.argv.indexOf("--no-cached-data") > 0) {
    return void 0;
  }
  if (process.env["VSCODE_DEV"]) {
    return void 0;
  }
  const commit = product.commit;
  if (!commit) {
    return void 0;
  }
  return path.join(userDataPath, "CachedData", commit);
}
async function mkdirpIgnoreError(dir) {
  if (typeof dir === "string") {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      return dir;
    } catch (error) {
    }
  }
  return void 0;
}
function processZhLocale(appLocale) {
  if (appLocale.startsWith("zh")) {
    const region = appLocale.split("-")[1];
    if (["hans", "cn", "sg", "my"].includes(region)) {
      return "zh-cn";
    }
    return "zh-tw";
  }
  return appLocale;
}
async function resolveNlsConfiguration() {
  const nlsConfiguration = nlsConfigurationPromise ? await nlsConfigurationPromise : void 0;
  if (nlsConfiguration) {
    return nlsConfiguration;
  }
  let userLocale2 = app.getLocale();
  if (!userLocale2) {
    return {
      userLocale: "en",
      osLocale,
      resolvedLanguage: "en",
      defaultMessagesFile: path.join(import.meta.dirname, "nls.messages.json"),
      // NLS: below 2 are a relic from old times only used by vscode-nls and deprecated
      locale: "en",
      availableLanguages: {}
    };
  }
  userLocale2 = processZhLocale(userLocale2.toLowerCase());
  return resolveNLSConfiguration({
    userLocale: userLocale2,
    osLocale,
    commit: product.commit,
    userDataPath,
    nlsMetadataPath: import.meta.dirname
  });
}
function getUserDefinedLocale(argvConfig2) {
  const locale = args["locale"];
  if (locale) {
    return locale.toLowerCase();
  }
  return typeof argvConfig2?.locale === "string" ? argvConfig2.locale.toLowerCase() : void 0;
}
