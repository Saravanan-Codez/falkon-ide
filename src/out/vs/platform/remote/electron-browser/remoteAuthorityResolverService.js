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
import { DeferredPromise } from "../../../base/common/async.js";
import * as errors from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { RemoteAuthorities } from "../../../base/common/network.js";
import { IProductService } from "../../product/common/productService.js";
import { RemoteConnectionType } from "../common/remoteAuthorityResolver.js";
let RemoteAuthorityResolverService = class extends Disposable {
  constructor(productService, remoteResourceLoader) {
    super();
    this.remoteResourceLoader = remoteResourceLoader;
    this._onDidChangeConnectionData = this._register(new Emitter());
    this.onDidChangeConnectionData = this._onDidChangeConnectionData.event;
    this._resolveAuthorityRequests = /* @__PURE__ */ new Map();
    this._connectionTokens = /* @__PURE__ */ new Map();
    this._canonicalURIRequests = /* @__PURE__ */ new Map();
    this._canonicalURIProvider = null;
    RemoteAuthorities.setServerRootPath(productService, void 0);
  }
  resolveAuthority(authority) {
    if (!this._resolveAuthorityRequests.has(authority)) {
      this._resolveAuthorityRequests.set(authority, new DeferredPromise());
    }
    return this._resolveAuthorityRequests.get(authority).p;
  }
  async getCanonicalURI(uri) {
    const key = uri.toString();
    const existing = this._canonicalURIRequests.get(key);
    if (existing) {
      return existing.result.p;
    }
    const result = new DeferredPromise();
    this._canonicalURIProvider?.(uri).then((uri2) => result.complete(uri2), (err) => result.error(err));
    this._canonicalURIRequests.set(key, { input: uri, result });
    return result.p;
  }
  getConnectionData(authority) {
    if (!this._resolveAuthorityRequests.has(authority)) {
      return null;
    }
    const request = this._resolveAuthorityRequests.get(authority);
    if (!request.isResolved) {
      return null;
    }
    const connectionToken = this._connectionTokens.get(authority);
    return {
      connectTo: request.value.authority.connectTo,
      connectionToken
    };
  }
  _clearResolvedAuthority(authority) {
    if (this._resolveAuthorityRequests.has(authority)) {
      this._resolveAuthorityRequests.get(authority).cancel();
      this._resolveAuthorityRequests.delete(authority);
    }
  }
  _setResolvedAuthority(resolvedAuthority, options) {
    if (this._resolveAuthorityRequests.has(resolvedAuthority.authority)) {
      const request = this._resolveAuthorityRequests.get(resolvedAuthority.authority);
      if (resolvedAuthority.connectTo.type === RemoteConnectionType.WebSocket) {
        RemoteAuthorities.set(resolvedAuthority.authority, resolvedAuthority.connectTo.host, resolvedAuthority.connectTo.port);
      } else {
        RemoteAuthorities.setDelegate(this.remoteResourceLoader.getResourceUriProvider());
      }
      if (resolvedAuthority.connectionToken) {
        RemoteAuthorities.setConnectionToken(resolvedAuthority.authority, resolvedAuthority.connectionToken);
      }
      request.complete({ authority: resolvedAuthority, options });
      this._onDidChangeConnectionData.fire();
    }
  }
  _setResolvedAuthorityError(authority, err) {
    if (this._resolveAuthorityRequests.has(authority)) {
      const request = this._resolveAuthorityRequests.get(authority);
      request.error(errors.ErrorNoTelemetry.fromError(err));
    }
  }
  _setAuthorityConnectionToken(authority, connectionToken) {
    this._connectionTokens.set(authority, connectionToken);
    RemoteAuthorities.setConnectionToken(authority, connectionToken);
    this._onDidChangeConnectionData.fire();
  }
  _setCanonicalURIProvider(provider) {
    this._canonicalURIProvider = provider;
    this._canonicalURIRequests.forEach(({ result, input }) => {
      this._canonicalURIProvider(input).then((uri) => result.complete(uri), (err) => result.error(err));
    });
  }
};
RemoteAuthorityResolverService = __decorateClass([
  __decorateParam(0, IProductService)
], RemoteAuthorityResolverService);
export {
  RemoteAuthorityResolverService
};
