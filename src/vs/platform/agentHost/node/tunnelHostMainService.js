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
import { connect } from "net";
import { hostname } from "os";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { joinPath } from "../../../base/common/resources.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { ILoggerService } from "../../log/common/log.js";
import { localize } from "../../../nls.js";
import { CONFIGURATION_KEY_HOST_NAME, normalizeTunnelName, tunnelNameFromHostname } from "../../remoteTunnel/common/remoteTunnel.js";
import {
  PROTOCOL_VERSION_TAG_PREFIX,
  TUNNEL_AGENT_HOST_PORT,
  TUNNEL_HOST_LOG_ID,
  TUNNEL_LAUNCHER_LABEL,
  TUNNEL_MIN_PROTOCOL_VERSION
} from "../common/tunnelAgentHost.js";
let TunnelHostMainService = class extends Disposable {
  constructor(_configurationService, loggerService, environmentService) {
    super();
    this._configurationService = _configurationService;
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this._activeTunnel = this._register(new MutableDisposable());
    this._logger = this._register(loggerService.createLogger(
      joinPath(environmentService.logsHome, `${TUNNEL_HOST_LOG_ID}.log`),
      { id: TUNNEL_HOST_LOG_ID, name: localize("tunnelHost.log", "Remote Connections") }
    ));
  }
  async startHosting(token, authProvider, socketInfo) {
    if (this._active) {
      await this.stopHosting();
    }
    const tunnelName = this._getTunnelName();
    this._logger.info(`Starting tunnel hosting as '${tunnelName}'...`);
    const client = await this._createManagementClient(token, authProvider);
    const protocolVersionTag = `${PROTOCOL_VERSION_TAG_PREFIX}${TUNNEL_MIN_PROTOCOL_VERSION}`;
    const agentHostPort = {
      portNumber: TUNNEL_AGENT_HOST_PORT,
      protocol: "https"
    };
    const labels = [TUNNEL_LAUNCHER_LABEL, tunnelName, protocolVersionTag];
    const newTunnel = {
      ports: [agentHostPort],
      labels
    };
    const tunnelRequestOptions = () => ({
      tokenScopes: ["host", "connect"],
      includePorts: true
    });
    const [existingTunnel] = await client.listTunnels(void 0, void 0, {
      labels: [TUNNEL_LAUNCHER_LABEL, tunnelName],
      requireAllLabels: true,
      includePorts: true,
      tokenScopes: ["host", "connect"],
      limit: 1
    });
    const rawHostConnectionCount = existingTunnel?.status?.hostConnectionCount;
    const hostConnectionCount = typeof rawHostConnectionCount === "number" ? rawHostConnectionCount : rawHostConnectionCount?.current ?? 0;
    let tunnel;
    let created = false;
    if (existingTunnel && hostConnectionCount === 0) {
      try {
        const existingLabels = existingTunnel.labels ?? [];
        const hasCurrentLabels = labels.every((l) => existingLabels.includes(l)) && !existingLabels.some((l) => l.startsWith(PROTOCOL_VERSION_TAG_PREFIX) && l !== protocolVersionTag);
        const hasAgentHostPort = existingTunnel.ports?.some((p) => p.portNumber === TUNNEL_AGENT_HOST_PORT) ?? false;
        if (hasCurrentLabels && hasAgentHostPort) {
          tunnel = existingTunnel;
        } else {
          let adopted = existingTunnel;
          if (!hasCurrentLabels) {
            adopted = await client.updateTunnel({
              tunnelId: existingTunnel.tunnelId,
              clusterId: existingTunnel.clusterId,
              labels
            }, tunnelRequestOptions());
          }
          if (!hasAgentHostPort) {
            await client.createOrUpdateTunnelPort(adopted, agentHostPort, tunnelRequestOptions());
          }
          tunnel = await client.getTunnel(adopted, tunnelRequestOptions()) ?? adopted;
        }
        this._logger.info(`Adopted existing inactive tunnel: ${tunnel.tunnelId} in cluster ${tunnel.clusterId}`);
      } catch (err) {
        this._logger.warn(`Failed to adopt existing tunnel ${existingTunnel.tunnelId}, creating a new one instead`, err);
      }
    } else if (existingTunnel) {
      this._logger.warn(`Tunnel name '${tunnelName}' is already in use by another active host; creating a new tunnel`);
    }
    if (!tunnel) {
      tunnel = await client.createOrUpdateTunnel(newTunnel, tunnelRequestOptions());
      created = true;
      this._logger.info(`Tunnel created: ${tunnel.tunnelId} in cluster ${tunnel.clusterId}`);
    }
    const { TunnelRelayTunnelHost } = await import("@microsoft/dev-tunnels-connections");
    const host = new TunnelRelayTunnelHost(client);
    host.forwardConnectionsToLocalPorts = false;
    host.trace = (_level, _eventId, msg) => {
      this._logger.debug(`relay: ${msg}`);
    };
    const { socketPath } = socketInfo;
    host.forwardedPortConnecting((e) => {
      if (e.port === TUNNEL_AGENT_HOST_PORT) {
        this._logger.info(`Incoming connection on port ${TUNNEL_AGENT_HOST_PORT}, piping to local agent host`);
        this._pipeToLocalAgentHost(e.stream, socketPath);
      } else {
        this._logger.warn(`Unexpected port ${e.port}, closing stream`);
        e.stream.end?.();
      }
    });
    await host.connect(tunnel);
    this._logger.info(`Tunnel relay host connected`);
    const domain = tunnel.ports?.find((p) => p.portNumber === TUNNEL_AGENT_HOST_PORT)?.portForwardingUris?.[0] ?? `${tunnel.tunnelId}.${tunnel.clusterId}.devtunnels.ms`;
    const info = {
      tunnelName,
      tunnelId: tunnel.tunnelId,
      clusterId: tunnel.clusterId,
      domain: typeof domain === "string" ? domain : `${tunnel.tunnelId}.${tunnel.clusterId}.devtunnels.ms`
    };
    this._active = { info, tunnel, host, client, created };
    this._activeTunnel.value = {
      dispose: () => {
        host.dispose();
        this._active = void 0;
      }
    };
    this._onDidChangeStatus.fire({ active: true, info });
    return info;
  }
  async stopHosting() {
    if (!this._active) {
      return;
    }
    const { tunnel, client, created } = this._active;
    this._logger.info(`Stopping tunnel hosting...`);
    if (created) {
      try {
        await client.deleteTunnel(tunnel);
        this._logger.info(`Tunnel deleted`);
      } catch (err) {
        this._logger.warn(`Failed to delete tunnel`, err);
      }
    } else {
      this._logger.info(`Leaving adopted tunnel ${tunnel.tunnelId} in place`);
    }
    this._activeTunnel.clear();
    this._onDidChangeStatus.fire({ active: false });
  }
  async getStatus() {
    if (this._active) {
      return { active: true, info: this._active.info };
    }
    return { active: false };
  }
  /**
   * Get the sanitized tunnel name from configuration or OS hostname.
   */
  _getTunnelName() {
    const configured = this._configurationService.getValue(CONFIGURATION_KEY_HOST_NAME);
    return (configured ? normalizeTunnelName(configured) : tunnelNameFromHostname(hostname())) || "vscode";
  }
  async _createManagementClient(token, authProvider) {
    const mgmt = await import("@microsoft/dev-tunnels-management");
    const authHeader = authProvider === "github" ? `github ${token}` : `Bearer ${token}`;
    return new mgmt.TunnelManagementHttpClient(
      "vscode-sessions",
      mgmt.ManagementApiVersions.Version20230927preview,
      async () => authHeader
    );
  }
  /**
   * Pipe an incoming tunnel stream to the local agent host.
   * The SshStream from the dev tunnels SDK is a Node.js duplex stream — we
   * connect to the agent host's local socket and bidirectionally pipe data.
   */
  _pipeToLocalAgentHost(incomingStream, socketPath) {
    const socket = connect(socketPath);
    socket.on("connect", () => {
      this._logger.debug(`Connected to local agent host socket`);
      incomingStream.pipe(socket);
      socket.pipe(incomingStream);
    });
    socket.on("error", (err) => {
      this._logger.error(`Socket error`, err);
      incomingStream.end?.();
    });
    incomingStream.on("error", () => {
      socket.destroy();
    });
  }
  dispose() {
    if (this._active) {
      this.stopHosting().catch(() => {
      });
    }
    super.dispose();
  }
};
TunnelHostMainService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ILoggerService),
  __decorateParam(2, INativeEnvironmentService)
], TunnelHostMainService);
export {
  TunnelHostMainService
};
