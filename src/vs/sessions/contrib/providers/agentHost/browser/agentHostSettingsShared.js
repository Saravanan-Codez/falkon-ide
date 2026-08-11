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
import { DisposableMap, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { createFileSystemProviderError, FileSystemProviderErrorCode } from "../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { isAgentHostProvider } from "../../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import {
  AbstractAgentHostConfigFileSystemProvider,
  AbstractAgentHostConfigSchemaRegistrar
} from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostConfigEditor.js";
import {
  buildAgentHostConfigJsonSchema,
  convertPropertySchema,
  serializeAgentHostConfigDocument
} from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostConfigEditor.js";
let AbstractSessionsAgentHostConfigFileSystemProvider = class extends AbstractAgentHostConfigFileSystemProvider {
  constructor(_sessionsProvidersService, logService) {
    super(logService);
    this._sessionsProvidersService = _sessionsProvidersService;
  }
  _resolveTarget(ctx) {
    return this._lookupProvider(ctx.providerId);
  }
  _missingTargetError(ctx) {
    return createFileSystemProviderError(`Unknown agent host provider: ${ctx.providerId}`, FileSystemProviderErrorCode.FileNotFound);
  }
  _lookupProvider(providerId) {
    const provider = this._sessionsProvidersService.getProvider(providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return void 0;
    }
    return provider;
  }
};
AbstractSessionsAgentHostConfigFileSystemProvider = __decorateClass([
  __decorateParam(0, ISessionsProvidersService),
  __decorateParam(1, ILogService)
], AbstractSessionsAgentHostConfigFileSystemProvider);
let AbstractMultiProviderAgentHostConfigSchemaRegistrar = class extends AbstractAgentHostConfigSchemaRegistrar {
  constructor(_sessionsProvidersService) {
    super();
    this._sessionsProvidersService = _sessionsProvidersService;
    /** Per-provider subscriptions. */
    this._providerSubscriptions = this._register(new DisposableMap());
    for (const provider of this._sessionsProvidersService.getProviders()) {
      this._onProviderAdded(provider);
    }
    this._register(this._sessionsProvidersService.onDidChangeProviders((e) => {
      for (const provider of e.added) {
        this._onProviderAdded(provider);
      }
      for (const provider of e.removed) {
        this._providerSubscriptions.deleteAndDispose(provider.id);
      }
    }));
  }
  // ---- Internal -----------------------------------------------------------
  _onProviderAdded(provider) {
    if (!isAgentHostProvider(provider)) {
      return;
    }
    const store = new DisposableStore();
    store.add(this._observeProvider(
      provider,
      (target) => {
        if (!this._isRegistered(target)) {
          return;
        }
        this._refreshSchema(target);
      },
      (target) => this._disposeSchemaForTarget(target)
    ));
    store.add(toDisposable(() => {
      for (const target of this._targetsForProvider(provider)) {
        this._disposeSchemaForTarget(target);
      }
    }));
    this._providerSubscriptions.set(provider.id, store);
  }
};
AbstractMultiProviderAgentHostConfigSchemaRegistrar = __decorateClass([
  __decorateParam(0, ISessionsProvidersService)
], AbstractMultiProviderAgentHostConfigSchemaRegistrar);
export {
  AbstractMultiProviderAgentHostConfigSchemaRegistrar,
  AbstractSessionsAgentHostConfigFileSystemProvider,
  buildAgentHostConfigJsonSchema,
  convertPropertySchema,
  serializeAgentHostConfigDocument
};
