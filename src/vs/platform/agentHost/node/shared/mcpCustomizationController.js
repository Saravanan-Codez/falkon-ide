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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { derived, observableValue, transaction } from "../../../../base/common/observable.js";
import { ActionType } from "../../common/state/protocol/common/actions.js";
import { CustomizationType, McpServerStatus } from "../../common/state/protocol/channels-session/state.js";
import { DEFAULT_MCP_APP, DEFAULT_MCP_APP_CAPABILITIES } from "../../common/state/protocol/mcpAppDefaults.js";
import { IAgentHostStateManager } from "../agentHostStateManager.js";
function buildMcpTopLevelCustomizationId(providerId, sessionId, serverName) {
  return `mcp-top-level:${providerId}:${sessionId}:${serverName}`;
}
function buildMcpChannel(providerId, sessionId, serverName) {
  return `mcp://${providerId}/${encodeURIComponent(sessionId)}/${encodeURIComponent(serverName)}`;
}
let McpCustomizationController = class extends Disposable {
  constructor(_options, _stateManager) {
    super();
    this._options = _options;
    this._stateManager = _stateManager;
    /** Per-server live entries, keyed by server name. */
    this._live = observableValue(this, /* @__PURE__ */ new Map());
    this.runtimeStates = derived(this, (reader) => {
      const out = /* @__PURE__ */ new Map();
      for (const entry of this._live.read(reader).values()) {
        const id = entry.topLevelId ?? this._options.resolveChildId(entry.serverName);
        if (id === void 0) {
          continue;
        }
        out.set(id, { state: entry.state, channel: this._buildChannel(entry.serverName, entry.state) });
      }
      return out;
    });
  }
  /** Snapshot for inclusion in `getSessionCustomizations()` results. */
  topLevelCustomizations() {
    const out = [];
    for (const entry of this._live.get().values()) {
      if (entry.topLevelId === void 0) {
        continue;
      }
      out.push(this._buildTopLevel(entry.topLevelId, entry.serverName, entry.state, entry.enabled));
    }
    return out;
  }
  /**
   * Names of MCP servers currently in {@link McpServerStatus.Ready},
   * paired with their channel URI. Used by providers to drive
   * polling-based notification streams (e.g. re-fetch `tools/list`
   * after a refresh hint and fire
   * `notifications/tools/list_changed` if the result changed).
   */
  readyChannels() {
    const out = [];
    for (const entry of this._live.get().values()) {
      if (entry.state.kind !== McpServerStatus.Ready) {
        continue;
      }
      const channel = this._buildChannel(entry.serverName, entry.state);
      if (channel !== void 0) {
        out.push({ serverName: entry.serverName, channel });
      }
    }
    return out;
  }
  /**
   * Returns the customization id currently associated with the MCP
   * server named `serverName`, or `undefined` when no customization
   * exists. Top-level entries return the minted top-level id; child
   * entries return whatever {@link IMcpChildIdResolver} resolves to
   * for that server. Used by providers to tag
   * {@link ToolCallMcpContributor.customizationId | tool-call contributors}
   * so clients can correlate MCP tool calls with the originating
   * server customization.
   */
  customizationIdForServer(serverName) {
    const live = this._live.get().get(serverName);
    if (live?.topLevelId !== void 0) {
      return live.topLevelId;
    }
    return this._options.resolveChildId(serverName);
  }
  /** Returns the live server name associated with a customization id. */
  serverNameForCustomizationId(id) {
    for (const entry of this._live.get().values()) {
      const entryId = entry.topLevelId ?? this._options.resolveChildId(entry.serverName);
      if (entryId === id) {
        return entry.serverName;
      }
    }
    return void 0;
  }
  /** Returns the last live state recorded for the MCP server named `serverName`. */
  stateForServer(serverName) {
    return this._live.get().get(serverName)?.state;
  }
  /** Snapshot used by providers to reconcile desired and observed enablement. */
  serverEnablement() {
    const result = [];
    for (const entry of this._live.get().values()) {
      const customizationId = entry.topLevelId ?? this._options.resolveChildId(entry.serverName);
      if (customizationId !== void 0) {
        result.push({ serverName: entry.serverName, customizationId, enabled: entry.enabled });
      }
    }
    return result;
  }
  /**
   * Returns the `mcp://` AHP channel URI currently advertised for the
   * MCP server named `serverName`, or `undefined` when the server is
   * not in {@link McpServerStatus.Ready}. Used by providers to attach
   * the channel to MCP App `_meta.ui` so clients can route App
   * sub-RPCs (tools/call, resources/read, sampling/createMessage)
   * back through {@link IAgentHostService.handleMcpRequest}.
   */
  channelForServer(serverName) {
    const live = this._live.get().get(serverName);
    if (!live || live.state.kind !== McpServerStatus.Ready) {
      return void 0;
    }
    return this._buildChannel(serverName, live.state);
  }
  /**
   * Replaces the live inventory with `servers`. Servers no longer
   * present are removed; new servers and changed servers are upserted.
   * Batched in a single transaction so {@link runtimeStates} observers
   * see one coalesced update.
   */
  applyAll(servers) {
    transaction((tx) => {
      const seen = /* @__PURE__ */ new Set();
      for (const server of servers) {
        seen.add(server.name);
        this._applyOne(server, tx);
      }
      for (const name of [...this._live.get().keys()]) {
        if (!seen.has(name)) {
          this._remove(name, tx);
        }
      }
    });
  }
  /** Upserts a single server. */
  applyOne(server) {
    transaction((tx) => this._applyOne(server, tx));
  }
  _applyOne(server, tx) {
    const previous = this._live.get().get(server.name);
    const state = this._stateForUpdate(previous?.state, server.state);
    const enabled = server.enabled ?? previous?.enabled ?? true;
    let topLevelId = previous?.topLevelId;
    if (topLevelId === void 0) {
      const childId = this._options.resolveChildId(server.name);
      if (childId !== void 0) {
        this._setLiveEntry(server.name, { serverName: server.name, state, enabled, topLevelId: void 0 }, tx);
        this._options.emit({
          type: ActionType.SessionMcpServerStateChanged,
          id: childId,
          state,
          channel: this._buildChannel(server.name, state)
        });
        return;
      }
      topLevelId = this._mintTopLevelId(server.name);
    }
    this._setLiveEntry(server.name, { serverName: server.name, state, enabled, topLevelId }, tx);
    this._options.emit({
      type: ActionType.SessionCustomizationUpdated,
      customization: this._buildTopLevel(topLevelId, server.name, state, enabled)
    });
  }
  /**
   * Removes a server from the live inventory. For top-level entries
   * (bare servers with no plugin-derived child) emits
   * {@link ActionType.SessionCustomizationRemoved} so the entry is
   * dropped from session state, not just from the in-memory live
   * inventory.
   *
   * For child entries we emit a final {@link ActionType.SessionMcpServerStateChanged}
   * carrying {@link McpServerStatus.Stopped} so the UI sees the
   * server settle into a terminal state; the plugin layer owns the
   * actual removal of the child container.
   */
  remove(serverName) {
    transaction((tx) => this._remove(serverName, tx));
  }
  _remove(serverName, tx) {
    const entry = this._live.get().get(serverName);
    if (!entry) {
      return;
    }
    this._deleteLiveEntry(serverName, tx);
    if (entry.topLevelId !== void 0) {
      this._options.emit({
        type: ActionType.SessionCustomizationRemoved,
        id: entry.topLevelId
      });
      return;
    }
    const childId = this._options.resolveChildId(serverName);
    if (childId === void 0) {
      return;
    }
    this._options.emit({
      type: ActionType.SessionMcpServerStateChanged,
      id: childId,
      state: { kind: McpServerStatus.Stopped }
    });
  }
  // ---- internals ---------------------------------------------------------
  /** Immutable upsert into the {@link _live} observable. */
  _setLiveEntry(serverName, entry, tx) {
    const next = new Map(this._live.get());
    next.set(serverName, entry);
    this._live.set(next, tx);
  }
  /** Immutable delete from the {@link _live} observable. */
  _deleteLiveEntry(serverName, tx) {
    const current = this._live.get();
    if (!current.has(serverName)) {
      return;
    }
    const next = new Map(current);
    next.delete(serverName);
    this._live.set(next, tx);
  }
  _stateForUpdate(previous, next) {
    if (previous?.kind === McpServerStatus.AuthRequired && next.kind === McpServerStatus.Starting) {
      return previous;
    }
    return next;
  }
  _mintTopLevelId(serverName) {
    return buildMcpTopLevelCustomizationId(this._options.providerId, this._options.sessionId, serverName);
  }
  _buildChannel(serverName, state) {
    if (state.kind !== McpServerStatus.Ready) {
      return void 0;
    }
    return buildMcpChannel(this._options.providerId, this._options.sessionId, serverName);
  }
  _buildTopLevel(id, serverName, state, enabled) {
    const channel = this._buildChannel(serverName, state);
    const mcpApp = this._options.capabilities ? { capabilities: this._options.capabilities } : DEFAULT_MCP_APP;
    return {
      type: CustomizationType.McpServer,
      id,
      uri: this._mintTopLevelId(serverName),
      name: serverName,
      enabled: getEffectiveMcpServerCustomizations(this._stateManager.getSessionState(this._options.sessionUri.toString())?.customizations ?? []).find((customization) => customization.id === id)?.enabled ?? enabled,
      state,
      channel,
      mcpApp
    };
  }
};
McpCustomizationController = __decorateClass([
  __decorateParam(1, IAgentHostStateManager)
], McpCustomizationController);
function findMcpChildId(customizations, serverName) {
  return getMcpServerCustomizations(customizations).find((server) => server.name === serverName)?.id;
}
function getMcpServerCustomizations(customizations) {
  const result = [];
  for (const top of customizations) {
    if (top.type === CustomizationType.McpServer) {
      result.push(top);
    } else {
      for (const child of top.children ?? []) {
        if (child.type === CustomizationType.McpServer) {
          result.push(child);
        }
      }
    }
  }
  return result;
}
function getEffectiveMcpServerCustomizations(customizations) {
  const result = [];
  for (const top of customizations) {
    if (top.type === CustomizationType.McpServer) {
      result.push(top);
    } else {
      for (const child of top.children ?? []) {
        if (child.type === CustomizationType.McpServer) {
          result.push(top.enabled ? child : { ...child, enabled: false });
        }
      }
    }
  }
  return result;
}
function applyMcpServerEnablement(customizations, desired) {
  const desiredById = new Map(getEffectiveMcpServerCustomizations(desired).map((server) => [server.id, server.enabled]));
  return customizations.map((customization) => {
    if (customization.type === CustomizationType.McpServer) {
      return applyMcpEnablement(customization, desiredById);
    }
    let changed = false;
    const children = customization.children?.map((child) => {
      const next = child.type === CustomizationType.McpServer ? applyMcpEnablement(child, desiredById) : child;
      changed ||= next !== child;
      return next;
    });
    return changed ? { ...customization, children } : customization;
  });
}
function applyMcpEnablement(customization, desiredById) {
  const enabled = desiredById.get(customization.id);
  return enabled === void 0 || enabled === customization.enabled ? customization : { ...customization, enabled };
}
function findMcpServerName(customizations, id) {
  return getMcpServerCustomizations(customizations).find((server) => server.id === id)?.name;
}
function parseMcpChannelUri(uri) {
  const prefix = "mcp://";
  if (!uri.startsWith(prefix)) {
    return void 0;
  }
  const rest = uri.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) {
    return void 0;
  }
  const providerId = rest.slice(0, slash);
  const tail = rest.slice(slash + 1);
  const sep = tail.indexOf("/");
  if (sep <= 0 || sep === tail.length - 1) {
    return void 0;
  }
  let sessionId;
  let serverName;
  try {
    sessionId = decodeURIComponent(tail.slice(0, sep));
    serverName = decodeURIComponent(tail.slice(sep + 1));
  } catch {
    return void 0;
  }
  if (!providerId || !sessionId || !serverName) {
    return void 0;
  }
  return { providerId, sessionId, serverName };
}
export {
  DEFAULT_MCP_APP,
  DEFAULT_MCP_APP_CAPABILITIES,
  McpCustomizationController,
  applyMcpServerEnablement,
  buildMcpChannel,
  buildMcpTopLevelCustomizationId,
  findMcpChildId,
  findMcpServerName,
  getEffectiveMcpServerCustomizations,
  getMcpServerCustomizations,
  parseMcpChannelUri
};
