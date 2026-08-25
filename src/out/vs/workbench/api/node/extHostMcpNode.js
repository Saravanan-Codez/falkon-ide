import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { parseEnvFile } from "../../../base/common/envfile.js";
import { untildify } from "../../../base/common/labels.js";
import { Lazy } from "../../../base/common/lazy.js";
import { DisposableMap } from "../../../base/common/lifecycle.js";
import * as path from "../../../base/common/path.js";
import { URI } from "../../../base/common/uri.js";
import { StreamSplitter } from "../../../base/node/nodeStreams.js";
import { findExecutable } from "../../../base/node/processes.js";
import { LogLevel } from "../../../platform/log/common/log.js";
import { McpConnectionState, McpServerTransportType } from "../../contrib/mcp/common/mcpTypes.js";
import { McpStdioStateHandler } from "../../contrib/mcp/node/mcpStdioStateHandler.js";
import { ExtHostMcpService, McpHTTPHandle } from "../common/extHostMcp.js";
class NodeExtHostMpcService extends ExtHostMcpService {
  constructor() {
    super(...arguments);
    this.nodeServers = this._register(new DisposableMap());
  }
  _startMcp(id, launch, defaultCwd, errorOnUserInteraction) {
    if (launch.type === McpServerTransportType.Stdio) {
      this.startNodeMpc(id, launch, defaultCwd);
    } else if (launch.type === McpServerTransportType.HTTP) {
      this._sseEventSources.set(id, new McpHTTPHandleNode(id, launch, this._proxy, this._logService, errorOnUserInteraction));
    } else {
      super._startMcp(id, launch, defaultCwd, errorOnUserInteraction);
    }
  }
  $stopMcp(id) {
    const nodeServer = this.nodeServers.get(id);
    if (nodeServer) {
      nodeServer.stop();
    } else {
      super.$stopMcp(id);
    }
  }
  $sendMessage(id, message) {
    const nodeServer = this.nodeServers.get(id);
    if (nodeServer) {
      nodeServer.write(message);
    } else {
      super.$sendMessage(id, message);
    }
  }
  async startNodeMpc(id, launch, defaultCwd) {
    const onError = (err) => this._proxy.$onDidChangeState(id, {
      state: McpConnectionState.Kind.Error,
      // eslint-disable-next-line local/code-no-any-casts
      code: err.hasOwnProperty("code") ? String(err.code) : void 0,
      message: typeof err === "string" ? err : err.message
    });
    const env = { ...process.env };
    if (launch.envFile) {
      try {
        for (const [key, value] of parseEnvFile(await readFile(launch.envFile, "utf-8"))) {
          env[key] = value;
        }
      } catch (e) {
        onError(`Failed to read envFile '${launch.envFile}': ${e.message}`);
        return;
      }
    }
    for (const [key, value] of Object.entries(launch.env)) {
      if (key.toUpperCase() === "PATH" && value !== null) {
        env[key] = env[key] ? `${env[key]}${path.delimiter}${String(value)}` : String(value);
        continue;
      }
      env[key] = value === null ? void 0 : String(value);
    }
    let child;
    try {
      const home = homedir();
      let cwd = launch.cwd ? untildify(launch.cwd, home) : defaultCwd?.fsPath || home;
      if (!path.isAbsolute(cwd)) {
        cwd = defaultCwd ? path.join(defaultCwd.fsPath, cwd) : path.join(home, cwd);
      }
      const { executable, args, shell } = await formatSubprocessArguments(
        untildify(launch.command, home),
        launch.args.map((a) => untildify(a, home)),
        cwd,
        env
      );
      this._proxy.$onDidPublishLog(id, LogLevel.Debug, `Server command line: ${executable} ${args.join(" ")}`);
      child = spawn(executable, args, {
        stdio: "pipe",
        cwd,
        env,
        shell
      });
    } catch (e) {
      onError(e);
      return;
    }
    const connectionManager = new McpStdioStateHandler(child);
    this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Starting });
    child.stdout.pipe(new StreamSplitter("\n")).on("data", (line) => this._proxy.$onDidReceiveMessage(id, line.toString()));
    child.stdin.on("error", onError);
    child.stdout.on("error", onError);
    child.stderr.pipe(new StreamSplitter("\n")).on("data", (line) => this._proxy.$onDidPublishLog(id, LogLevel.Warning, `[server stderr] ${line.toString().trimEnd()}`));
    child.on("spawn", () => this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Running }));
    child.on("error", (e) => {
      onError(e);
    });
    child.on("exit", (code) => {
      this.nodeServers.deleteAndDispose(id);
      if (code === 0 || connectionManager.stopped) {
        this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Stopped });
      } else {
        this._proxy.$onDidChangeState(id, {
          state: McpConnectionState.Kind.Error,
          message: `Process exited with code ${code}`
        });
      }
    });
    this.nodeServers.set(id, connectionManager);
  }
}
class McpHTTPHandleNode extends McpHTTPHandle {
  constructor() {
    super(...arguments);
    this._undici = new Lazy(() => import("undici"));
  }
  async _fetchInternal(url, init) {
    const { fetch, Agent } = await this._undici.value;
    const undiciInit = { ...init };
    let httpUrl = url;
    const uri = URI.parse(url);
    if (uri.scheme === "unix" || uri.scheme === "pipe") {
      undiciInit.dispatcher = new Agent({
        socketPath: uri.path
      });
      httpUrl = uri.with({
        scheme: "http",
        authority: "localhost",
        // HTTP always wants a host (not that we're using it), but if we're using a socket or pipe then localhost is sorta right anyway
        path: uri.fragment
      }).toString(true);
    } else {
      return super._fetchInternal(url, init);
    }
    const undiciResponse = await fetch(httpUrl, undiciInit);
    return {
      status: undiciResponse.status,
      statusText: undiciResponse.statusText,
      headers: undiciResponse.headers,
      // undici `Headers` class no longer overlaps with lib.dom `Headers` (`SpecIterableIterator` vs `HeadersIterator`)
      body: undiciResponse.body,
      // Way down in `ReadableStreamReadDoneResult<T>`, `value` is optional in the undici type but required (yet can be `undefined`) in the standard type
      url: undiciResponse.url,
      json: () => undiciResponse.json(),
      text: () => undiciResponse.text()
    };
  }
}
const windowsShellScriptRe = /\.(bat|cmd)$/i;
const escapeCmdArg = (s) => `"${s.replace(/"/g, '""')}"`;
const formatSubprocessArguments = async (executable, args, cwd, env) => {
  if (process.platform !== "win32") {
    return { executable, args, shell: false };
  }
  const found = await findExecutable(executable, cwd, void 0, env);
  if (found && windowsShellScriptRe.test(found)) {
    return {
      executable: escapeCmdArg(found),
      args: args.map(escapeCmdArg),
      shell: true
    };
  }
  return { executable, args, shell: false };
};
export {
  NodeExtHostMpcService,
  escapeCmdArg,
  formatSubprocessArguments
};
