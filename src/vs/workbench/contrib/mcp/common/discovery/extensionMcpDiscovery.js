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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { isFalsyOrWhitespace } from "../../../../../base/common/strings.js";
import { localize } from "../../../../../nls.js";
import { ConfigurationTarget } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { mcpActivationEvent, mcpContributionPoint } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { extensionPrefixedIdentifier, McpCollectionSortOrder, McpServerDefinition, McpServerTrust } from "../mcpTypes.js";
const cacheKey = "mcp.extCachedServers";
const _mcpExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint(mcpContributionPoint);
var PersistWhen = /* @__PURE__ */ ((PersistWhen2) => {
  PersistWhen2[PersistWhen2["CollectionExists"] = 0] = "CollectionExists";
  PersistWhen2[PersistWhen2["Always"] = 1] = "Always";
  return PersistWhen2;
})(PersistWhen || {});
let ExtensionMcpDiscovery = class extends Disposable {
  constructor(_mcpRegistry, storageService, _extensionService, _contextKeyService) {
    super();
    this._mcpRegistry = _mcpRegistry;
    this._extensionService = _extensionService;
    this._contextKeyService = _contextKeyService;
    this.fromGallery = false;
    this._extensionCollectionIdsToPersist = /* @__PURE__ */ new Map();
    this._conditionalCollections = this._register(new DisposableMap());
    this.cachedServers = storageService.getObject(cacheKey, StorageScope.WORKSPACE, {});
    this._register(storageService.onWillSaveState(() => {
      let updated = false;
      for (const [collectionId, behavior] of this._extensionCollectionIdsToPersist.entries()) {
        const collection = this._mcpRegistry.collections.get().find((c) => c.id === collectionId);
        let defs = collection?.serverDefinitions.get();
        if (!collection || collection.lazy) {
          if (behavior === 1 /* Always */) {
            defs = [];
          } else {
            continue;
          }
        }
        if (defs) {
          updated = true;
          this.cachedServers[collectionId] = { servers: defs.map(McpServerDefinition.toSerialized) };
        }
      }
      if (updated) {
        storageService.store(cacheKey, this.cachedServers, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    }));
  }
  start() {
    const extensionCollections = this._register(new DisposableMap());
    this._register(_mcpExtensionPoint.setHandler((_extensions, delta) => {
      const { added, removed } = delta;
      for (const collections of removed) {
        for (const coll of collections.value) {
          const id = extensionPrefixedIdentifier(collections.description.identifier, coll.id);
          extensionCollections.deleteAndDispose(id);
          this._conditionalCollections.deleteAndDispose(id);
        }
      }
      for (const collections of added) {
        if (!ExtensionMcpDiscovery._validate(collections)) {
          continue;
        }
        for (const coll of collections.value) {
          const id = extensionPrefixedIdentifier(collections.description.identifier, coll.id);
          this._extensionCollectionIdsToPersist.set(id, 0 /* CollectionExists */);
          if (coll.when) {
            this._registerConditionalCollection(id, coll, collections, extensionCollections);
          } else {
            this._registerCollection(id, coll, collections, extensionCollections);
          }
        }
      }
    }));
  }
  _registerCollection(id, coll, collections, extensionCollections) {
    const serverDefs = this.cachedServers.hasOwnProperty(id) ? this.cachedServers[id].servers : void 0;
    const dispo = this._mcpRegistry.registerCollection({
      id,
      label: coll.label,
      remoteAuthority: null,
      trustBehavior: McpServerTrust.Kind.Trusted,
      scope: StorageScope.WORKSPACE,
      configTarget: ConfigurationTarget.USER,
      order: McpCollectionSortOrder.Extension,
      serverDefinitions: observableValue(this, serverDefs?.map(McpServerDefinition.fromSerialized) || []),
      lazy: {
        isCached: !!serverDefs,
        load: () => this._activateExtensionServers(coll.id).then(() => {
          this._extensionCollectionIdsToPersist.set(id, 1 /* Always */);
        }),
        removed: () => {
          extensionCollections.deleteAndDispose(id);
          this._conditionalCollections.deleteAndDispose(id);
        }
      },
      source: collections.description.identifier
    });
    extensionCollections.set(id, dispo);
  }
  _registerConditionalCollection(id, coll, collections, extensionCollections) {
    const whenClause = ContextKeyExpr.deserialize(coll.when);
    if (!whenClause) {
      return;
    }
    const evaluate = () => {
      const nowSatisfied = this._contextKeyService.contextMatchesRules(whenClause);
      const isRegistered = extensionCollections.has(id);
      if (nowSatisfied && !isRegistered) {
        this._registerCollection(id, coll, collections, extensionCollections);
      } else if (!nowSatisfied && isRegistered) {
        extensionCollections.deleteAndDispose(id);
      }
    };
    const contextKeyListener = this._contextKeyService.onDidChangeContext(evaluate);
    evaluate();
    this._conditionalCollections.set(id, contextKeyListener);
  }
  async _activateExtensionServers(collectionId) {
    await this._extensionService.activateByEvent(mcpActivationEvent(collectionId));
    await Promise.all(this._mcpRegistry.delegates.get().map((r) => r.waitForInitialProviderPromises()));
  }
  static _validate(user) {
    if (!Array.isArray(user.value)) {
      user.collector.error(localize("invalidData", "Expected an array of MCP collections"));
      return false;
    }
    for (const contribution of user.value) {
      if (typeof contribution.id !== "string" || isFalsyOrWhitespace(contribution.id)) {
        user.collector.error(localize("invalidId", "Expected 'id' to be a non-empty string."));
        return false;
      }
      if (typeof contribution.label !== "string" || isFalsyOrWhitespace(contribution.label)) {
        user.collector.error(localize("invalidLabel", "Expected 'label' to be a non-empty string."));
        return false;
      }
      if (contribution.when !== void 0 && (typeof contribution.when !== "string" || isFalsyOrWhitespace(contribution.when))) {
        user.collector.error(localize("invalidWhen", "Expected 'when' to be a non-empty string."));
        return false;
      }
    }
    return true;
  }
};
ExtensionMcpDiscovery = __decorateClass([
  __decorateParam(0, IMcpRegistry),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IContextKeyService)
], ExtensionMcpDiscovery);
export {
  ExtensionMcpDiscovery
};
