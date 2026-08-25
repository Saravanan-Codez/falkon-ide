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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import {
  computeHostKeyStoreKey
} from "../common/sshHostKeyTrust.js";
const SSH_HOST_KEY_TRUST_STORAGE_KEY = "sshRemoteAgentHost.trustedHostKeys";
function parseTrustedHostKey(value) {
  if (typeof value !== "object" || value === null) {
    return void 0;
  }
  const { keyType, fingerprint, addedAt, alias } = value;
  if (typeof keyType !== "string" || !keyType || typeof fingerprint !== "string" || !fingerprint || typeof addedAt !== "number" || !Number.isFinite(addedAt)) {
    return void 0;
  }
  return {
    keyType,
    fingerprint,
    addedAt,
    ...typeof alias === "string" && alias ? { alias } : void 0
  };
}
function parseTrustedHostKeys(raw) {
  const hosts = /* @__PURE__ */ new Map();
  if (!raw) {
    return hosts;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return hosts;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return hosts;
  }
  for (const [storeKey, value] of Object.entries(parsed)) {
    if (!storeKey || !Array.isArray(value)) {
      continue;
    }
    const keys = [];
    for (const entry of value) {
      const key = parseTrustedHostKey(entry);
      if (key) {
        keys.push(key);
      }
    }
    if (keys.length) {
      hosts.set(storeKey, keys);
    }
  }
  return hosts;
}
function parseStoreKey(storeKey) {
  const separator = storeKey.lastIndexOf(":");
  if (separator <= 0) {
    return void 0;
  }
  const host = storeKey.substring(0, separator);
  const port = Number(storeKey.substring(separator + 1));
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return void 0;
  }
  return { host, port };
}
let SSHHostKeyTrustService = class extends Disposable {
  constructor(_storageService) {
    super();
    this._storageService = _storageService;
    this._onDidChangeTrustedHosts = this._register(new Emitter());
    this.onDidChangeTrustedHosts = this._onDidChangeTrustedHosts.event;
  }
  getTrustedKeys(host, port) {
    return this._read().get(computeHostKeyStoreKey(host, port)) ?? [];
  }
  trustHostKey(host, port, key) {
    const storeKey = computeHostKeyStoreKey(host, port);
    const hosts = this._read();
    const existing = hosts.get(storeKey) ?? [];
    const keys = existing.filter((k) => k.keyType !== key.keyType);
    keys.push(key);
    hosts.set(storeKey, keys);
    this._write(hosts);
    this._onDidChangeTrustedHosts.fire(storeKey);
  }
  forgetHost(host, port) {
    const storeKey = computeHostKeyStoreKey(host, port);
    const hosts = this._read();
    if (!hosts.delete(storeKey)) {
      return;
    }
    this._write(hosts);
    this._onDidChangeTrustedHosts.fire(storeKey);
  }
  listTrustedHosts() {
    const result = [];
    for (const [storeKey, keys] of this._read()) {
      const parsed = parseStoreKey(storeKey);
      if (parsed) {
        result.push({ host: parsed.host, port: parsed.port, keys });
      }
    }
    return result;
  }
  _read() {
    return parseTrustedHostKeys(this._storageService.get(SSH_HOST_KEY_TRUST_STORAGE_KEY, StorageScope.APPLICATION));
  }
  _write(hosts) {
    if (hosts.size === 0) {
      this._storageService.remove(SSH_HOST_KEY_TRUST_STORAGE_KEY, StorageScope.APPLICATION);
      return;
    }
    this._storageService.store(
      SSH_HOST_KEY_TRUST_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(hosts)),
      StorageScope.APPLICATION,
      StorageTarget.MACHINE
    );
  }
};
SSHHostKeyTrustService = __decorateClass([
  __decorateParam(0, IStorageService)
], SSHHostKeyTrustService);
export {
  SSHHostKeyTrustService,
  SSH_HOST_KEY_TRUST_STORAGE_KEY,
  parseTrustedHostKeys
};
