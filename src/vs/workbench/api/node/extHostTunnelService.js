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
import * as fs from "fs";
import { exec } from "child_process";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { MovingAverage } from "../../../base/common/numbers.js";
import { isLinux } from "../../../base/common/platform.js";
import * as resources from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import * as pfs from "../../../base/node/pfs.js";
import { SocketCloseEventType } from "../../../base/parts/ipc/common/ipc.net.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ManagedSocket, connectManagedSocket } from "../../../platform/remote/common/managedSocket.js";
import { ManagedRemoteConnection } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { ISignService } from "../../../platform/sign/common/sign.js";
import { isAllInterfaces, isLocalhost } from "../../../platform/tunnel/common/tunnel.js";
import { NodeRemoteTunnel } from "../../../platform/tunnel/node/tunnelService.js";
import { IExtHostInitDataService } from "../common/extHostInitDataService.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { ExtHostTunnelService } from "../common/extHostTunnelService.js";
import { parseAddress } from "../../services/remote/common/tunnelModel.js";
import { IExtHostConfiguration } from "../common/extHostConfiguration.js";
function getSockets(stdout) {
  const lines = stdout.trim().split("\n");
  const mapped = [];
  lines.forEach((line) => {
    const match = /\/proc\/(\d+)\/fd\/\d+ -> socket:\[(\d+)\]/.exec(line);
    if (match && match.length >= 3) {
      mapped.push({
        pid: parseInt(match[1], 10),
        socket: parseInt(match[2], 10)
      });
    }
  });
  const socketMap = mapped.reduce((m, socket) => {
    m[socket.socket] = socket;
    return m;
  }, {});
  return socketMap;
}
function loadListeningPorts(...stdouts) {
  const table = [].concat(...stdouts.map(loadConnectionTable));
  return [
    ...new Map(
      table.filter((row) => row.st === "0A").map((row) => {
        const address = row.local_address.split(":");
        return {
          socket: parseInt(row.inode, 10),
          ip: parseIpAddress(address[0]),
          port: parseInt(address[1], 16)
        };
      }).map((port) => [port.ip + ":" + port.port, port])
    ).values()
  ];
}
function parseIpAddress(hex) {
  let result = "";
  if (hex.length === 8) {
    for (let i = hex.length - 2; i >= 0; i -= 2) {
      result += parseInt(hex.substr(i, 2), 16);
      if (i !== 0) {
        result += ".";
      }
    }
  } else {
    for (let i = 0; i < hex.length; i += 8) {
      const word = hex.substring(i, i + 8);
      let subWord = "";
      for (let j = 8; j >= 2; j -= 2) {
        subWord += word.substring(j - 2, j);
        if (j === 6 || j === 2) {
          subWord = parseInt(subWord, 16).toString(16);
          result += `${subWord}`;
          subWord = "";
          if (i + j !== hex.length - 6) {
            result += ":";
          }
        }
      }
    }
  }
  return result;
}
function loadConnectionTable(stdout) {
  const lines = stdout.trim().split("\n");
  const names = lines.shift().trim().split(/\s+/).filter((name) => name !== "rx_queue" && name !== "tm->when");
  const table = lines.map((line) => line.trim().split(/\s+/).reduce((obj, value, i) => {
    obj[names[i] || i] = value;
    return obj;
  }, {}));
  return table;
}
function knownExcludeCmdline(command) {
  if (command.length > 500) {
    return false;
  }
  return !!command.match(/.*\.vscode-server-[a-zA-Z]+\/bin.*/) || command.indexOf("out/server-main.js") !== -1 || command.indexOf("_productName=VSCode") !== -1;
}
function getRootProcesses(stdout) {
  const lines = stdout.trim().split("\n");
  const mapped = [];
  lines.forEach((line) => {
    const match = /^\d+\s+\D+\s+root\s+(\d+)\s+(\d+).+\d+\:\d+\:\d+\s+(.+)$/.exec(line);
    if (match && match.length >= 4) {
      mapped.push({
        pid: parseInt(match[1], 10),
        ppid: parseInt(match[2]),
        cmd: match[3]
      });
    }
  });
  return mapped;
}
async function findPorts(connections, socketMap, processes) {
  const processMap = processes.reduce((m, process2) => {
    m[process2.pid] = process2;
    return m;
  }, {});
  const ports = [];
  connections.forEach(({ socket, ip, port }) => {
    const pid = socketMap[socket] ? socketMap[socket].pid : void 0;
    const command = pid ? processMap[pid]?.cmd : void 0;
    if (pid && command && !knownExcludeCmdline(command)) {
      ports.push({ host: ip, port, detail: command, pid });
    }
  });
  return ports;
}
function tryFindRootPorts(connections, rootProcessesStdout, previousPorts) {
  const ports = /* @__PURE__ */ new Map();
  const rootProcesses = getRootProcesses(rootProcessesStdout);
  for (const connection of connections) {
    const previousPort = previousPorts.get(connection.port);
    if (previousPort) {
      ports.set(connection.port, previousPort);
      continue;
    }
    const rootProcessMatch = rootProcesses.find((value) => value.cmd.includes(`${connection.port}`));
    if (rootProcessMatch) {
      let bestMatch = rootProcessMatch;
      let mostChild;
      do {
        mostChild = rootProcesses.find((value) => value.ppid === bestMatch.pid);
        if (mostChild) {
          bestMatch = mostChild;
        }
      } while (mostChild);
      ports.set(connection.port, { host: connection.ip, port: connection.port, pid: bestMatch.pid, detail: bestMatch.cmd, ppid: bestMatch.ppid });
    } else {
      ports.set(connection.port, { host: connection.ip, port: connection.port, ppid: Number.MAX_VALUE });
    }
  }
  return ports;
}
let NodeExtHostTunnelService = class extends ExtHostTunnelService {
  constructor(extHostRpc, initData, logService, signService, configurationService) {
    super(extHostRpc, initData, logService);
    this.initData = initData;
    this.signService = signService;
    this.configurationService = configurationService;
    this._initialCandidates = void 0;
    this._foundRootPorts = /* @__PURE__ */ new Map();
    this._candidateFindingEnabled = false;
    if (isLinux && initData.remote.isRemote && initData.remote.authority) {
      this._proxy.$setRemoteTunnelService(process.pid);
      this.setInitialCandidates();
    }
  }
  async $registerCandidateFinder(enable) {
    if (enable && this._candidateFindingEnabled) {
      return;
    }
    this._candidateFindingEnabled = enable;
    let oldPorts = void 0;
    if (this._initialCandidates) {
      oldPorts = this._initialCandidates;
      await this._proxy.$onFoundNewCandidates(this._initialCandidates);
    }
    const movingAverage = new MovingAverage();
    let scanCount = 0;
    while (this._candidateFindingEnabled) {
      const startTime = (/* @__PURE__ */ new Date()).getTime();
      const newPorts = (await this.findCandidatePorts()).filter((candidate) => isLocalhost(candidate.host) || isAllInterfaces(candidate.host));
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) found candidate ports ${newPorts.map((port) => port.port).join(", ")}`);
      const timeTaken = (/* @__PURE__ */ new Date()).getTime() - startTime;
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) candidate port scan took ${timeTaken} ms.`);
      if (scanCount++ > 3) {
        movingAverage.update(timeTaken);
      }
      if (!oldPorts || JSON.stringify(oldPorts) !== JSON.stringify(newPorts)) {
        oldPorts = newPorts;
        await this._proxy.$onFoundNewCandidates(oldPorts);
      }
      const delay = this.calculateDelay(movingAverage.value);
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) next candidate port scan in ${delay} ms.`);
      await new Promise((resolve) => setTimeout(() => resolve(), delay));
    }
  }
  calculateDelay(movingAverage) {
    return Math.max(movingAverage * 20, 2e3);
  }
  async setInitialCandidates() {
    this._initialCandidates = await this.findCandidatePorts();
    this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) Initial candidates found: ${this._initialCandidates.map((c) => c.port).join(", ")}`);
  }
  async findCandidatePorts() {
    let tcp = "";
    let tcp6 = "";
    try {
      tcp = await fs.promises.readFile("/proc/net/tcp", "utf8");
      tcp6 = await fs.promises.readFile("/proc/net/tcp6", "utf8");
    } catch (e) {
    }
    const connections = loadListeningPorts(tcp, tcp6);
    const procSockets = await new Promise((resolve) => {
      exec("ls -l /proc/[0-9]*/fd/[0-9]* | grep socket:", (error, stdout, stderr) => {
        resolve(stdout);
      });
    });
    const socketMap = getSockets(procSockets);
    const procChildren = await pfs.Promises.readdir("/proc");
    const processes = [];
    for (const childName of procChildren) {
      try {
        const pid = Number(childName);
        const childUri = resources.joinPath(URI.file("/proc"), childName);
        const childStat = await fs.promises.stat(childUri.fsPath);
        if (childStat.isDirectory() && !isNaN(pid)) {
          const cwd = await fs.promises.readlink(resources.joinPath(childUri, "cwd").fsPath);
          const cmd = await fs.promises.readFile(resources.joinPath(childUri, "cmdline").fsPath, "utf8");
          processes.push({ pid, cwd, cmd });
        }
      } catch (e) {
      }
    }
    const unFoundConnections = [];
    const filteredConnections = connections.filter(((connection) => {
      const foundConnection = socketMap[connection.socket];
      if (!foundConnection) {
        unFoundConnections.push(connection);
      }
      return foundConnection;
    }));
    const foundPorts = findPorts(filteredConnections, socketMap, processes);
    let heuristicPorts;
    this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) number of possible root ports ${unFoundConnections.length}`);
    if (unFoundConnections.length > 0) {
      const rootProcesses = await new Promise((resolve) => {
        exec("ps -F -A -l | grep root", (error, stdout, stderr) => {
          resolve(stdout);
        });
      });
      this._foundRootPorts = tryFindRootPorts(unFoundConnections, rootProcesses, this._foundRootPorts);
      heuristicPorts = Array.from(this._foundRootPorts.values());
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) heuristic ports ${heuristicPorts.map((heuristicPort) => heuristicPort.port).join(", ")}`);
    }
    return foundPorts.then((foundCandidates) => {
      if (heuristicPorts) {
        return foundCandidates.concat(heuristicPorts);
      } else {
        return foundCandidates;
      }
    });
  }
  async defaultTunnelHost() {
    const settingValue = (await this.configurationService.getConfigProvider()).getConfiguration("remote").get("localPortHost");
    return !settingValue || settingValue === "localhost" ? "127.0.0.1" : "0.0.0.0";
  }
  makeManagedTunnelFactory(authority) {
    return async (tunnelOptions) => {
      const t = new NodeRemoteTunnel(
        {
          commit: this.initData.commit,
          quality: this.initData.quality,
          logService: this.logService,
          ipcLogger: null,
          // services and address providers have stubs since we don't need
          // the connection identification that the renderer process uses
          remoteSocketFactoryService: {
            _serviceBrand: void 0,
            async connect(_connectTo, path, query, debugLabel) {
              const result = await authority.makeConnection();
              return ExtHostManagedSocket.connect(result, path, query, debugLabel);
            },
            register() {
              throw new Error("not implemented");
            }
          },
          addressProvider: {
            getAddress() {
              return Promise.resolve({
                connectTo: new ManagedRemoteConnection(0),
                connectionToken: authority.connectionToken
              });
            }
          },
          signService: this.signService
        },
        await this.defaultTunnelHost(),
        tunnelOptions.remoteAddress.host || "localhost",
        tunnelOptions.remoteAddress.port,
        tunnelOptions.localAddressPort
      );
      await t.waitForReady();
      const disposeEmitter = new Emitter();
      return {
        localAddress: parseAddress(t.localAddress) ?? t.localAddress,
        remoteAddress: { port: t.tunnelRemotePort, host: t.tunnelRemoteHost },
        onDidDispose: disposeEmitter.event,
        dispose: () => {
          t.dispose();
          disposeEmitter.fire();
          disposeEmitter.dispose();
        }
      };
    };
  }
};
NodeExtHostTunnelService = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ISignService),
  __decorateParam(4, IExtHostConfiguration)
], NodeExtHostTunnelService);
class ExtHostManagedSocket extends ManagedSocket {
  constructor(passing, debugLabel, half) {
    super(debugLabel, half);
    this.passing = passing;
  }
  static connect(passing, path, query, debugLabel) {
    const d = new DisposableStore();
    const half = {
      onClose: d.add(new Emitter()),
      onData: d.add(new Emitter()),
      onEnd: d.add(new Emitter())
    };
    d.add(passing.onDidReceiveMessage((d2) => half.onData.fire(VSBuffer.wrap(d2))));
    d.add(passing.onDidEnd(() => half.onEnd.fire()));
    d.add(passing.onDidClose((error) => half.onClose.fire({
      type: SocketCloseEventType.NodeSocketCloseEvent,
      error,
      hadError: !!error
    })));
    const socket = new ExtHostManagedSocket(passing, debugLabel, half);
    socket._register(d);
    return connectManagedSocket(socket, path, query, debugLabel, half);
  }
  write(buffer) {
    this.passing.send(buffer.buffer);
  }
  closeRemote() {
    this.passing.end();
  }
  async drain() {
    await this.passing.drain?.();
  }
}
export {
  ExtHostManagedSocket,
  NodeExtHostTunnelService,
  findPorts,
  getRootProcesses,
  getSockets,
  loadConnectionTable,
  loadListeningPorts,
  parseIpAddress,
  tryFindRootPorts
};
