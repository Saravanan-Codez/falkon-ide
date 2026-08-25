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
import { URI } from "../../../base/common/uri.js";
import { MainContext } from "./extHost.protocol.js";
import { Disposable, FileDecoration } from "./extHostTypes.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { asArray, groupBy } from "../../../base/common/arrays.js";
import { compare, count } from "../../../base/common/strings.js";
import { dirname } from "../../../base/common/path.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
let ExtHostDecorations = class {
  constructor(extHostRpc, _logService) {
    this._logService = _logService;
    this._provider = /* @__PURE__ */ new Map();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadDecorations);
  }
  static {
    this._handlePool = 0;
  }
  static {
    this._maxEventSize = 250;
  }
  registerFileDecorationProvider(provider, extensionDescription) {
    const handle = ExtHostDecorations._handlePool++;
    this._provider.set(handle, { provider, extensionDescription });
    this._proxy.$registerDecorationProvider(handle, extensionDescription.identifier.value);
    const listener = provider.onDidChangeFileDecorations && provider.onDidChangeFileDecorations((e) => {
      if (!e) {
        this._proxy.$onDidChange(handle, null);
        return;
      }
      const array = asArray(e);
      if (array.length <= ExtHostDecorations._maxEventSize) {
        this._proxy.$onDidChange(handle, array);
        return;
      }
      this._logService.warn("[Decorations] CAPPING events from decorations provider", extensionDescription.identifier.value, array.length);
      const mapped = array.map((uri) => ({ uri, rank: count(uri.path, "/") }));
      const groups = groupBy(mapped, (a, b) => a.rank - b.rank || compare(a.uri.path, b.uri.path));
      const picked = [];
      outer: for (const uris of groups) {
        let lastDirname;
        for (const obj of uris) {
          const myDirname = dirname(obj.uri.path);
          if (lastDirname !== myDirname) {
            lastDirname = myDirname;
            if (picked.push(obj.uri) >= ExtHostDecorations._maxEventSize) {
              break outer;
            }
          }
        }
      }
      this._proxy.$onDidChange(handle, picked);
    });
    return new Disposable(() => {
      listener?.dispose();
      this._proxy.$unregisterDecorationProvider(handle);
      this._provider.delete(handle);
    });
  }
  async $provideDecorations(handle, requests, token) {
    if (!this._provider.has(handle)) {
      return /* @__PURE__ */ Object.create(null);
    }
    const result = /* @__PURE__ */ Object.create(null);
    const { provider, extensionDescription: extensionId } = this._provider.get(handle);
    await Promise.all(requests.map(async (request) => {
      try {
        const { uri, id } = request;
        const data = await Promise.resolve(provider.provideFileDecoration(URI.revive(uri), token));
        if (!data) {
          return;
        }
        try {
          FileDecoration.validate(data);
          if (data.badge && typeof data.badge !== "string") {
            checkProposedApiEnabled(extensionId, "codiconDecoration");
          }
          result[id] = [data.propagate, data.tooltip, data.badge, data.color];
        } catch (e) {
          this._logService.warn(`INVALID decoration from extension '${extensionId.identifier.value}': ${e}`);
        }
      } catch (err) {
        this._logService.error(err);
      }
    }));
    return result;
  }
};
ExtHostDecorations = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService)
], ExtHostDecorations);
const IExtHostDecorations = createDecorator("IExtHostDecorations");
export {
  ExtHostDecorations,
  IExtHostDecorations
};
