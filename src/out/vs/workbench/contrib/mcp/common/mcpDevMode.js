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
import { equals as arraysEqual } from "../../../../base/common/arrays.js";
import { assertNever } from "../../../../base/common/assert.js";
import { Throttler } from "../../../../base/common/async.js";
import * as glob from "../../../../base/common/glob.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { equals as objectsEqual } from "../../../../base/common/objects.js";
import { autorun, autorunDelta, derivedOpts } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { FileSystemProviderCapabilities, IFileService } from "../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IDebugService } from "../../debug/common/debug.js";
import { IMcpRegistry } from "./mcpRegistryTypes.js";
import { McpServerTransportType } from "./mcpTypes.js";
let McpDevModeServerAttache = class extends Disposable {
  constructor(server, fwdRef, registry, fileService, workspaceContextService) {
    super();
    const workspaceFolder = server.readDefinitions().map(({ collection }) => collection?.presentation?.origin && workspaceContextService.getWorkspaceFolder(collection.presentation?.origin)?.uri);
    const restart = async () => {
      const lastDebugged = fwdRef.lastModeDebugged;
      await server.stop();
      await server.start({ debug: lastDebugged });
    };
    let didAutoStart = false;
    this._register(autorun((reader) => {
      const defs = server.readDefinitions().read(reader);
      if (!defs.collection || !defs.server || !defs.server.devMode) {
        didAutoStart = false;
        return;
      }
      if (didAutoStart) {
        return;
      }
      const delegates = registry.delegates.read(reader);
      if (!delegates.some((d) => d.canStart(defs.collection, defs.server))) {
        return;
      }
      server.start();
      didAutoStart = true;
    }));
    const debugMode = server.readDefinitions().map((d) => !!d.server?.devMode?.debug);
    this._register(autorunDelta(debugMode, ({ lastValue, newValue }) => {
      if (!!newValue && !objectsEqual(lastValue, newValue)) {
        restart();
      }
    }));
    const watchObs = derivedOpts({ equalsFn: arraysEqual }, (reader) => {
      const def = server.readDefinitions().read(reader);
      const watch = def.server?.devMode?.watch;
      return typeof watch === "string" ? [watch] : watch;
    });
    const restartScheduler = this._register(new Throttler());
    this._register(autorun((reader) => {
      const pattern = watchObs.read(reader);
      const wf = workspaceFolder.read(reader);
      if (!pattern || !wf) {
        return;
      }
      const includes = pattern.filter((p) => !p.startsWith("!"));
      const excludes = pattern.filter((p) => p.startsWith("!")).map((p) => p.slice(1));
      reader.store.add(fileService.watch(wf, { includes, excludes, recursive: true }));
      const ignoreCase = !fileService.hasCapability(wf, FileSystemProviderCapabilities.PathCaseSensitive);
      const includeParse = includes.map((p) => glob.parse({ base: wf.fsPath, pattern: p }, { ignoreCase }));
      const excludeParse = excludes.map((p) => glob.parse({ base: wf.fsPath, pattern: p }, { ignoreCase }));
      reader.store.add(fileService.onDidFilesChange((e) => {
        for (const change of [e.rawAdded, e.rawDeleted, e.rawUpdated]) {
          for (const uri of change) {
            if (includeParse.some((i) => i(uri.fsPath)) && !excludeParse.some((e2) => e2(uri.fsPath))) {
              restartScheduler.queue(restart);
              break;
            }
          }
        }
      }));
    }));
  }
};
McpDevModeServerAttache = __decorateClass([
  __decorateParam(2, IMcpRegistry),
  __decorateParam(3, IFileService),
  __decorateParam(4, IWorkspaceContextService)
], McpDevModeServerAttache);
const IMcpDevModeDebugging = createDecorator("mcpDevModeDebugging");
const DEBUG_HOST = "127.0.0.1";
let McpDevModeDebugging = class {
  constructor(_debugService, _commandService) {
    this._debugService = _debugService;
    this._commandService = _commandService;
  }
  async transform(definition, launch) {
    if (!definition.devMode?.debug || launch.type !== McpServerTransportType.Stdio) {
      return launch;
    }
    const port = await this.getDebugPort();
    const name = `MCP: ${definition.label}`;
    const options = { startedByUser: false, suppressDebugView: true };
    const commonConfig = {
      internalConsoleOptions: "neverOpen",
      suppressMultipleSessionWarning: true
    };
    switch (definition.devMode.debug.type) {
      case "node": {
        if (!/node[0-9]*$/.test(launch.command)) {
          throw new Error(localize("mcp.debug.nodeBinReq", 'MCP server must be launched with the "node" executable to enable debugging, but was launched with "{0}"', launch.command));
        }
        this._debugService.startDebugging(void 0, {
          type: "pwa-node",
          request: "attach",
          name,
          port,
          host: DEBUG_HOST,
          timeout: 3e4,
          continueOnAttach: true,
          ...commonConfig
        }, options);
        return { ...launch, args: [`--inspect-brk=${DEBUG_HOST}:${port}`, ...launch.args] };
      }
      case "debugpy": {
        if (!/python[0-9.]*$/.test(launch.command)) {
          throw new Error(localize("mcp.debug.pythonBinReq", 'MCP server must be launched with the "python" executable to enable debugging, but was launched with "{0}"', launch.command));
        }
        let command;
        let args = ["--wait-for-client", "--connect", `${DEBUG_HOST}:${port}`, ...launch.args];
        if (definition.devMode.debug.debugpyPath) {
          command = definition.devMode.debug.debugpyPath;
        } else {
          try {
            const debugPyPath = await this._commandService.executeCommand("python.getDebugpyPackagePath");
            if (debugPyPath) {
              command = launch.command;
              args = [debugPyPath, ...args];
            }
          } catch {
          }
        }
        if (!command) {
          command = "debugpy";
        }
        await Promise.race([
          // eslint-disable-next-line local/code-no-dangerous-type-assertions
          this._debugService.startDebugging(void 0, {
            type: "debugpy",
            name,
            request: "attach",
            listen: {
              host: DEBUG_HOST,
              port
            },
            ...commonConfig
          }, options),
          this.ensureListeningOnPort(port)
        ]);
        return { ...launch, command, args };
      }
      default:
        assertNever(definition.devMode.debug, `Unknown debug type ${JSON.stringify(definition.devMode.debug)}`);
    }
  }
  ensureListeningOnPort(port) {
    return Promise.resolve();
  }
  getDebugPort() {
    return Promise.resolve(9230);
  }
};
McpDevModeDebugging = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, ICommandService)
], McpDevModeDebugging);
export {
  IMcpDevModeDebugging,
  McpDevModeDebugging,
  McpDevModeServerAttache
};
