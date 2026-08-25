import { spawn } from "child_process";
import { chmodSync, existsSync, readFileSync, statSync, truncateSync, unlinkSync } from "fs";
import { homedir, tmpdir } from "os";
import { startProfiling } from "../../base/node/profiling.js";
import { Event } from "../../base/common/event.js";
import { isAbsolute, resolve, join, dirname } from "../../base/common/path.js";
import { isMacintosh, isWindows } from "../../base/common/platform.js";
import { randomPort } from "../../base/common/ports.js";
import { whenDeleted, writeFileSync } from "../../base/node/pfs.js";
import { findFreePort } from "../../base/node/ports.js";
import { watchFileContents } from "../../platform/files/node/watcher/nodejs/nodejsWatcherLib.js";
import { buildHelpMessage, buildStdinMessage, buildVersionMessage, NATIVE_CLI_COMMANDS, OPTIONS } from "../../platform/environment/node/argv.js";
import { addArg, parseCLIProcessArgv } from "../../platform/environment/node/argvHelper.js";
import { combineUriFlags } from "./cliArgs.js";
import { getStdinFilePath, hasStdinWithoutTty, readFromStdin, stdinDataListener } from "../../platform/environment/node/stdin.js";
import { createWaitMarkerFileSync } from "../../platform/environment/node/wait.js";
import product from "../../platform/product/common/product.js";
import { CancellationTokenSource } from "../../base/common/cancellation.js";
import { isUNC, randomPath } from "../../base/common/extpath.js";
import { Utils } from "../../platform/profiling/common/profiling.js";
import { FileAccess } from "../../base/common/network.js";
import { cwd } from "../../base/common/process.js";
import { addUNCHostToAllowlist } from "../../base/node/unc.js";
import { URI } from "../../base/common/uri.js";
import { DeferredPromise } from "../../base/common/async.js";
function shouldSpawnCliProcess(argv) {
  return !!argv["install-source"] || !!argv["list-extensions"] || !!argv["install-extension"] || !!argv["uninstall-extension"] || !!argv["update-extensions"] || !!argv["locate-extension"] || !!argv["add-mcp"] || !!argv["telemetry"];
}
async function main(argv) {
  let args;
  try {
    args = parseCLIProcessArgv(argv);
  } catch (err) {
    console.error(err.message);
    return;
  }
  for (const subcommand of NATIVE_CLI_COMMANDS) {
    if (args[subcommand]) {
      if (!product.tunnelApplicationName) {
        console.error(`'${subcommand}' command not supported in ${product.applicationName}`);
        return;
      }
      const env = {
        ...process.env
      };
      delete env["ELECTRON_RUN_AS_NODE"];
      const tunnelArgs = argv.slice(argv.indexOf(subcommand) + 1);
      return new Promise((resolve2, reject) => {
        let tunnelProcess;
        const stdio = ["ignore", "pipe", "pipe"];
        if (process.env["VSCODE_DEV"]) {
          tunnelProcess = spawn("cargo", ["run", "--", subcommand, ...tunnelArgs], { cwd: join(getAppRoot(), "cli"), stdio, env });
        } else {
          const appPath = process.platform === "darwin" ? join(dirname(dirname(process.execPath)), "Resources", "app") : dirname(process.execPath);
          const tunnelCommand = join(appPath, "bin", `${product.tunnelApplicationName}${isWindows ? ".exe" : ""}`);
          tunnelProcess = spawn(tunnelCommand, [subcommand, ...tunnelArgs], { cwd: cwd(), stdio, env });
        }
        tunnelProcess.stdout.pipe(process.stdout);
        tunnelProcess.stderr.pipe(process.stderr);
        tunnelProcess.on("exit", resolve2);
        tunnelProcess.on("error", reject);
      });
    }
  }
  if (args.help) {
    const executable = `${product.applicationName}${isWindows ? ".exe" : ""}`;
    console.log(buildHelpMessage(product.nameLong, executable, product.version, OPTIONS));
  } else if (args.chat?.help) {
    const executable = `${product.applicationName}${isWindows ? ".exe" : ""}`;
    console.log(buildHelpMessage(product.nameLong, executable, product.version, OPTIONS.chat.options, { isChat: true }));
  } else if (args.version) {
    console.log(buildVersionMessage(product.version, product.commit));
  } else if (args["locate-shell-integration-path"]) {
    let file;
    switch (args["locate-shell-integration-path"]) {
      // Usage: `[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"`
      case "bash":
        file = "shellIntegration-bash.sh";
        break;
      // Usage: `if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }`
      case "pwsh":
        file = "shellIntegration.ps1";
        break;
      // Usage: `[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"`
      case "zsh":
        file = "shellIntegration-rc.zsh";
        break;
      // Usage: `string match -q "$TERM_PROGRAM" "vscode"; and . (code --locate-shell-integration-path fish)`
      case "fish":
        file = "shellIntegration.fish";
        break;
      default:
        throw new Error("Error using --locate-shell-integration-path: Invalid shell type");
    }
    console.log(join(getAppRoot(), "out", "vs", "workbench", "contrib", "terminal", "common", "scripts", file));
  } else if (shouldSpawnCliProcess(args)) {
    let cliProcessMain;
    if (process.env["VSCODE_DEV"]) {
      cliProcessMain = "./cliProcessMain.js";
    } else {
      cliProcessMain = "./vs/code/node/cliProcessMain.js";
    }
    const cli = await import(cliProcessMain);
    await cli.main(args);
    return;
  } else if (args["file-write"]) {
    const argsFile = args._[0];
    if (!argsFile || !isAbsolute(argsFile) || !existsSync(argsFile) || !statSync(argsFile).isFile()) {
      throw new Error("Using --file-write with invalid arguments.");
    }
    let source;
    let target;
    try {
      const argsContents = JSON.parse(readFileSync(argsFile, "utf8"));
      source = argsContents.source;
      target = argsContents.target;
    } catch (error) {
      throw new Error("Using --file-write with invalid arguments.");
    }
    if (isWindows) {
      for (const path of [source, target]) {
        if (typeof path === "string" && isUNC(path)) {
          addUNCHostToAllowlist(URI.file(path).authority);
        }
      }
    }
    if (!source || !target || source === target || // make sure source and target are provided and are not the same
    !isAbsolute(source) || !isAbsolute(target) || // make sure both source and target are absolute paths
    !existsSync(source) || !statSync(source).isFile() || // make sure source exists as file
    !existsSync(target) || !statSync(target).isFile()) {
      throw new Error("Using --file-write with invalid arguments.");
    }
    try {
      let targetMode = 0;
      let restoreMode = false;
      if (args["file-chmod"]) {
        targetMode = statSync(target).mode;
        if (!(targetMode & 128)) {
          chmodSync(target, targetMode | 128);
          restoreMode = true;
        }
      }
      const data = readFileSync(source);
      if (isWindows) {
        truncateSync(target, 0);
        writeFileSync(target, data, { flag: "r+" });
      } else {
        writeFileSync(target, data);
      }
      if (restoreMode) {
        chmodSync(target, targetMode);
      }
    } catch (error) {
      error.message = `Error using --file-write: ${error.message}`;
      throw error;
    }
  } else {
    const env = {
      ...process.env,
      "ELECTRON_NO_ATTACH_CONSOLE": "1"
    };
    delete env["ELECTRON_RUN_AS_NODE"];
    const processCallbacks = [];
    if (args.verbose) {
      env["ELECTRON_ENABLE_LOGGING"] = "1";
    }
    if (args.verbose || args.status) {
      processCallbacks.push(async (child2) => {
        child2.stdout?.on("data", (data) => console.log(data.toString("utf8").trim()));
        child2.stderr?.on("data", (data) => console.log(data.toString("utf8").trim()));
        await Event.toPromise(Event.fromNodeEventEmitter(child2, "exit"));
      });
    }
    if (args["transient"]) {
      const tempParentDir = randomPath(tmpdir(), "vscode");
      const tempUserDataDir = join(tempParentDir, "data");
      const tempExtensionsDir = join(tempParentDir, "extensions");
      const tempSharedDataDir = join(tempParentDir, "shared");
      const tempAgentPluginsDir = join(tempParentDir, "agent-plugins");
      const tempAgentsUserDataDir = join(tempParentDir, "agents-data");
      const tempAgentsExtensionsDir = join(tempParentDir, "agents-extensions");
      addArg(argv, "--user-data-dir", tempUserDataDir);
      addArg(argv, "--extensions-dir", tempExtensionsDir);
      addArg(argv, "--shared-data-dir", tempSharedDataDir);
      addArg(argv, "--agent-plugins-dir", tempAgentPluginsDir);
      addArg(argv, "--agents-user-data-dir", tempAgentsUserDataDir);
      addArg(argv, "--agents-extensions-dir", tempAgentsExtensionsDir);
      console.log(`State is temporarily stored. Relaunch this state with: ${product.applicationName} --user-data-dir "${tempUserDataDir}" --extensions-dir "${tempExtensionsDir}" --shared-data-dir "${tempSharedDataDir}" --agent-plugins-dir "${tempAgentPluginsDir}" --agents-user-data-dir "${tempAgentsUserDataDir}" --agents-extensions-dir "${tempAgentsExtensionsDir}"`);
    }
    const hasReadStdinArg = args._.some((arg) => arg === "-") || args.chat?._.some((arg) => arg === "-");
    if (hasReadStdinArg) {
      args._ = args._.filter((a) => a !== "-");
      argv = argv.filter((a) => a !== "-");
    }
    let stdinFilePath;
    if (hasStdinWithoutTty()) {
      if (hasReadStdinArg) {
        stdinFilePath = getStdinFilePath();
        try {
          const readFromStdinDone = new DeferredPromise();
          await readFromStdin(stdinFilePath, !!args.verbose, () => readFromStdinDone.complete());
          if (!args.wait) {
            processCallbacks.push(() => readFromStdinDone.p);
          }
          if (args.chat) {
            addArg(argv, "--add-file", stdinFilePath);
          } else {
            addArg(argv, stdinFilePath);
            addArg(argv, "--skip-add-to-recently-opened");
          }
          console.log(`Reading from stdin via: ${stdinFilePath}`);
        } catch (e) {
          console.log(`Failed to create file to read via stdin: ${e.toString()}`);
          stdinFilePath = void 0;
        }
      } else {
        processCallbacks.push((_) => stdinDataListener(1e3).then((dataReceived) => {
          if (dataReceived) {
            console.log(buildStdinMessage(product.applicationName, !!args.chat));
          }
        }));
      }
    }
    let waitMarkerFilePath;
    if (args.wait) {
      waitMarkerFilePath = createWaitMarkerFileSync(args.verbose);
      if (waitMarkerFilePath) {
        addArg(argv, "--waitMarkerFilePath", waitMarkerFilePath);
      }
      processCallbacks.push(async (child2) => {
        let childExitPromise;
        if (isMacintosh) {
          childExitPromise = new Promise((resolve2) => {
            child2.on("exit", (code, signal) => {
              if (code !== 0 || signal) {
                resolve2();
              }
            });
          });
        } else {
          childExitPromise = Event.toPromise(Event.fromNodeEventEmitter(child2, "exit"));
        }
        try {
          await Promise.race([
            whenDeleted(waitMarkerFilePath),
            Event.toPromise(Event.fromNodeEventEmitter(child2, "error")),
            childExitPromise
          ]);
        } finally {
          if (stdinFilePath) {
            unlinkSync(stdinFilePath);
          }
        }
      });
    }
    if (args["prof-startup"]) {
      const profileHost = "127.0.0.1";
      const portMain = await findFreePort(randomPort(), 10, 3e3);
      const portRenderer = await findFreePort(portMain + 1, 10, 3e3);
      const portExthost = await findFreePort(portRenderer + 1, 10, 3e3);
      if (portMain * portRenderer * portExthost === 0) {
        throw new Error("Failed to find free ports for profiler. Make sure to shutdown all instances of the editor first.");
      }
      const filenamePrefix = randomPath(homedir(), "prof");
      addArg(argv, `--inspect-brk=${portMain}`);
      addArg(argv, `--remote-debugging-port=${portRenderer}`);
      addArg(argv, `--inspect-brk-extensions=${portExthost}`);
      addArg(argv, `--prof-startup-prefix`, filenamePrefix);
      addArg(argv, `--no-cached-data`);
      writeFileSync(filenamePrefix, argv.slice(-6).join("|"));
      processCallbacks.push(async (_child) => {
        class Profiler {
          static async start(name, filenamePrefix2, opts) {
            let session;
            try {
              session = await startProfiling({ ...opts, host: profileHost });
            } catch (err) {
              console.error(`FAILED to start profiling for '${name}' on port '${opts.port}'`);
            }
            return {
              async stop() {
                if (!session) {
                  return;
                }
                let suffix = "";
                const result = await session.stop();
                if (!process.env["VSCODE_DEV"]) {
                  result.profile = Utils.rewriteAbsolutePaths(result.profile, "piiRemoved");
                  suffix = ".txt";
                }
                writeFileSync(`${filenamePrefix2}.${name}.cpuprofile${suffix}`, JSON.stringify(result.profile, void 0, 4));
              }
            };
          }
        }
        try {
          const mainProfileRequest = Profiler.start("main", filenamePrefix, { port: portMain });
          const extHostProfileRequest = Profiler.start("extHost", filenamePrefix, { port: portExthost, tries: 300 });
          const rendererProfileRequest = Profiler.start("renderer", filenamePrefix, {
            port: portRenderer,
            tries: 200,
            target: function(targets) {
              return targets.filter((target) => {
                if (!target.webSocketDebuggerUrl) {
                  return false;
                }
                if (target.type === "page") {
                  return target.url.indexOf("workbench/workbench.html") > 0 || target.url.indexOf("workbench/workbench-dev.html") > 0;
                } else {
                  return true;
                }
              })[0];
            }
          });
          const main2 = await mainProfileRequest;
          const extHost = await extHostProfileRequest;
          const renderer = await rendererProfileRequest;
          await whenDeleted(filenamePrefix);
          await main2.stop();
          await renderer.stop();
          await extHost.stop();
          writeFileSync(filenamePrefix, "");
        } catch (e) {
          console.error("Failed to profile startup. Make sure to quit Code first.");
        }
      });
    }
    const options = {
      detached: true,
      env
    };
    if (!args.verbose) {
      options["stdio"] = "ignore";
    }
    let child;
    if (!isMacintosh) {
      if (!args.verbose && args.status) {
        options["stdio"] = ["ignore", "pipe", "ignore"];
      }
      const spawnArgs = isWindows ? combineUriFlags(argv.slice(2)) : argv.slice(2);
      child = spawn(process.execPath, spawnArgs, options);
    } else {
      const spawnArgs = ["-n", "-g"];
      spawnArgs.push("-a", process.execPath);
      if (args.verbose || args.status) {
        spawnArgs.push("--wait-apps");
        for (const outputType of args.verbose ? ["stdout", "stderr"] : ["stdout"]) {
          const tmpName = randomPath(tmpdir(), `code-${outputType}`);
          writeFileSync(tmpName, "");
          spawnArgs.push(`--${outputType}`, tmpName);
          processCallbacks.push(async (child2) => {
            try {
              const stream = outputType === "stdout" ? process.stdout : process.stderr;
              const cts = new CancellationTokenSource();
              child2.on("close", () => {
                setTimeout(() => cts.dispose(true), 200);
              });
              await watchFileContents(tmpName, (chunk) => stream.write(chunk), () => {
              }, cts.token);
            } finally {
              unlinkSync(tmpName);
            }
          });
        }
      }
      for (const e in env) {
        if (e !== "_") {
          spawnArgs.push("--env");
          spawnArgs.push(`${e}=${env[e]}`);
        }
      }
      spawnArgs.push("--args", ...argv.slice(2));
      if (env["VSCODE_DEV"]) {
        const curdir = ".";
        const launchDirIndex = spawnArgs.indexOf(curdir);
        if (launchDirIndex !== -1) {
          spawnArgs[launchDirIndex] = resolve(curdir);
        }
      }
      child = spawn("open", spawnArgs, { ...options, env: {} });
    }
    await Promise.all(processCallbacks.map((callback) => callback(child)));
  }
}
function getAppRoot() {
  return dirname(FileAccess.asFileUri("").fsPath);
}
function eventuallyExit(code) {
  setTimeout(() => process.exit(code), 0);
}
main(process.argv).then(() => eventuallyExit(0)).then(null, (err) => {
  console.error(err.message || err.stack || err);
  eventuallyExit(1);
});
export {
  main
};
