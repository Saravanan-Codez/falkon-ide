import { equals } from "../../../base/common/objects.js";
function structuralToolsEqual(a, b) {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) {
    return false;
  }
  const byName = /* @__PURE__ */ new Map();
  for (const t of aa) {
    byName.set(t.name, t);
  }
  for (const t of bb) {
    const prev = byName.get(t.name);
    if (!prev) {
      return false;
    }
    if (prev.description !== t.description) {
      return false;
    }
    if (!equals(prev.inputSchema, t.inputSchema)) {
      return false;
    }
  }
  return true;
}
class ActiveClientToolSet {
  constructor() {
    this._byClient = /* @__PURE__ */ new Map();
  }
  /** Number of clients currently contributing tools. */
  get size() {
    return this._byClient.size;
  }
  /** Whether `clientId` currently contributes tools. */
  has(clientId) {
    return this._byClient.has(clientId);
  }
  /** The client ids currently contributing tools, in insertion order. */
  clientIds() {
    return this._byClient.keys();
  }
  /** This client's contributed tools, or an empty array when absent. */
  get(clientId) {
    return this._byClient.get(clientId) ?? [];
  }
  /**
   * Replace `clientId`'s contributed tools (full replacement). A new
   * `clientId` is appended after existing ones; re-setting an existing
   * `clientId` keeps its insertion position so merged ordering and tool
   * ownership stay stable across updates.
   */
  set(clientId, tools) {
    this._byClient.set(clientId, tools);
  }
  /** Remove `clientId`'s contribution. Returns whether anything was removed. */
  delete(clientId) {
    return this._byClient.delete(clientId);
  }
  /**
   * The union of every client's tools, deduplicated by `name` with the
   * first-inserted contributor winning. Order follows client insertion
   * order, then per-client tool order.
   */
  merged() {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const tools of this._byClient.values()) {
      for (const tool of tools) {
        if (seen.has(tool.name)) {
          continue;
        }
        seen.add(tool.name);
        result.push(tool);
      }
    }
    return result;
  }
  /**
   * The `clientId` that owns the tool named `toolName`, or `undefined` when
   * no active client provides it. When `preferredClientId` currently provides
   * the tool it wins; otherwise the first-inserted contributor wins.
   */
  ownerOf(toolName, preferredClientId) {
    if (preferredClientId && this.get(preferredClientId).some((tool) => tool.name === toolName)) {
      return preferredClientId;
    }
    for (const [clientId, tools] of this._byClient) {
      if (tools.some((tool) => tool.name === toolName)) {
        return clientId;
      }
    }
    return void 0;
  }
  /**
   * Structural comparison of the current {@link merged} tools against a
   * previously-applied snapshot (`name + description + inputSchema`,
   * order-insensitive). Returns `true` when no SDK restart is required.
   */
  structuralEquals(applied) {
    return structuralToolsEqual(this.merged(), applied);
  }
}
class ActiveClientState {
  constructor() {
    this._clientId = void 0;
    this._tools = [];
  }
  /** Live owning client id, or `undefined` when no client is currently connected. */
  get clientId() {
    return this._clientId;
  }
  /** Structural state (tool definitions). Changing these requires an SDK restart/rebind. */
  get tools() {
    return this._tools;
  }
  /**
   * Replace the owning `clientId` (`undefined` when no client is connected)
   * and the contributed tool list. A `clientId`-only change does NOT mark
   * structural dirt (see {@link structuralEquals}).
   */
  update(clientId, tools) {
    this._clientId = clientId;
    this._tools = tools;
  }
  /**
   * Structural comparison of the live tools against a previously-applied
   * snapshot (`name + description + inputSchema`, order-insensitive).
   * Returns `true` when no SDK restart is required.
   */
  structuralEquals(applied) {
    return structuralToolsEqual(this._tools, applied.tools);
  }
}
export {
  ActiveClientState,
  ActiveClientToolSet,
  structuralToolsEqual
};
