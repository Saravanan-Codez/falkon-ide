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
import { localize } from "../../../../nls.js";
import { observableMemento } from "../../../../platform/observable/common/observableMemento.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["SamplingRetentionDays"] = 7] = "SamplingRetentionDays";
  Constants2[Constants2["MsPerDay"] = 864e5] = "MsPerDay";
  Constants2[Constants2["SamplingRetentionMs"] = 6048e5] = "SamplingRetentionMs";
  Constants2[Constants2["SamplingLastNMessage"] = 30] = "SamplingLastNMessage";
  return Constants2;
})(Constants || {});
const samplingMemento = observableMemento({
  defaultValue: /* @__PURE__ */ new Map(),
  key: "mcp.sampling.logs",
  toStorage: (v) => JSON.stringify(Array.from(v.entries())),
  fromStorage: (v) => new Map(JSON.parse(v))
});
let McpSamplingLog = class extends Disposable {
  constructor(_storageService) {
    super();
    this._storageService = _storageService;
    this._logs = {};
  }
  has(server) {
    const storage = this._getLogStorageForServer(server);
    return storage.get().has(server.definition.id);
  }
  get(server) {
    const storage = this._getLogStorageForServer(server);
    return storage.get().get(server.definition.id);
  }
  getAsText(server) {
    const storage = this._getLogStorageForServer(server);
    const record = storage.get().get(server.definition.id);
    if (!record) {
      return "";
    }
    const parts = [];
    const total = record.bins.reduce((sum, value) => sum + value, 0);
    parts.push(localize("mcp.sampling.rpd", "{0} total requests in the last 7 days.", total));
    parts.push(this._formatRecentRequests(record));
    return parts.join("\n");
  }
  _formatRecentRequests(data) {
    if (!data.lastReqs.length) {
      return "\nNo recent requests.";
    }
    const result = [];
    for (let i = 0; i < data.lastReqs.length; i++) {
      const { request, response, at, model } = data.lastReqs[i];
      result.push(`
[${i + 1}] ${new Date(at).toISOString()} ${model}`);
      result.push("  Request:");
      for (const msg of request) {
        const role = msg.role.padEnd(9);
        let content = "";
        if ("text" in msg.content && msg.content.type === "text") {
          content = msg.content.text;
        } else if ("data" in msg.content) {
          content = `[${msg.content.type} data: ${msg.content.mimeType}]`;
        }
        result.push(`    ${role}: ${content}`);
      }
      result.push("  Response:");
      result.push(`    ${response}`);
    }
    return result.join("\n");
  }
  async add(server, request, response, model) {
    const now = Date.now();
    const utcOrdinal = Math.floor(now / 864e5 /* MsPerDay */);
    const storage = this._getLogStorageForServer(server);
    const next = new Map(storage.get());
    let record = next.get(server.definition.id);
    if (!record) {
      record = {
        head: utcOrdinal,
        bins: Array.from({ length: 7 /* SamplingRetentionDays */ }, () => 0),
        lastReqs: []
      };
    } else {
      for (let i = 0; i < utcOrdinal - record.head && i < 7 /* SamplingRetentionDays */; i++) {
        record.bins.pop();
        record.bins.unshift(0);
      }
      record.head = utcOrdinal;
    }
    record.bins[0]++;
    record.lastReqs.unshift({ request, response, at: now, model });
    while (record.lastReqs.length > 30 /* SamplingLastNMessage */) {
      record.lastReqs.pop();
    }
    next.set(server.definition.id, record);
    storage.set(next, void 0);
  }
  _getLogStorageForServer(server) {
    const scope = server.readDefinitions().get().collection?.scope ?? StorageScope.WORKSPACE;
    return this._logs[scope] ??= this._register(samplingMemento(scope, StorageTarget.MACHINE, this._storageService));
  }
};
McpSamplingLog = __decorateClass([
  __decorateParam(0, IStorageService)
], McpSamplingLog);
export {
  McpSamplingLog
};
