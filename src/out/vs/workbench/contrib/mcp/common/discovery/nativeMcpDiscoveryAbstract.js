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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { StorageScope } from "../../../../../platform/storage/common/storage.js";
import { discoverySourceLabel, mcpDiscoverySection } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { McpCollectionSortOrder, McpServerTrust } from "../mcpTypes.js";
import { ClaudeDesktopMpcDiscoveryAdapter, CursorDesktopMpcDiscoveryAdapter, WindsurfDesktopMpcDiscoveryAdapter } from "./nativeMcpDiscoveryAdapters.js";
let FilesystemMcpDiscovery = class extends Disposable {
  constructor(configurationService, _fileService, _mcpRegistry) {
    super();
    this._fileService = _fileService;
    this._mcpRegistry = _mcpRegistry;
    this.fromGallery = false;
    this._fsDiscoveryEnabled = observableConfigValue(mcpDiscoverySection, void 0, configurationService);
  }
  _isDiscoveryEnabled(reader, discoverySource) {
    const fsDiscovery = this._fsDiscoveryEnabled.read(reader);
    if (typeof fsDiscovery === "boolean") {
      return fsDiscovery;
    }
    if (discoverySource && fsDiscovery?.[discoverySource] === true) {
      return true;
    }
    return false;
  }
  watchFile(file, collection, discoverySource, adaptFile) {
    const store = new DisposableStore();
    const collectionRegistration = store.add(new MutableDisposable());
    const updateFile = async () => {
      let definitions = [];
      try {
        const contents = await this._fileService.readFile(file);
        definitions = await adaptFile(contents.value) || [];
      } catch {
      }
      if (!definitions.length) {
        collectionRegistration.clear();
      } else {
        collection.serverDefinitions.set(definitions, void 0);
        if (!collectionRegistration.value) {
          collectionRegistration.value = this._mcpRegistry.registerCollection(collection);
        }
      }
    };
    store.add(autorun((reader) => {
      if (!this._isDiscoveryEnabled(reader, discoverySource)) {
        collectionRegistration.clear();
        return;
      }
      const throttler = reader.store.add(new RunOnceScheduler(updateFile, 500));
      const watcher = reader.store.add(this._fileService.createWatcher(file, { recursive: false, excludes: [] }));
      reader.store.add(watcher.onDidChange(() => throttler.schedule()));
      updateFile();
    }));
    return store;
  }
};
FilesystemMcpDiscovery = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IMcpRegistry)
], FilesystemMcpDiscovery);
let NativeFilesystemMcpDiscovery = class extends FilesystemMcpDiscovery {
  constructor(remoteAuthority, labelService, fileService, instantiationService, mcpRegistry, configurationService) {
    super(configurationService, fileService, mcpRegistry);
    this.suffix = "";
    if (remoteAuthority) {
      this.suffix = " " + localize("onRemoteLabel", " on {0}", labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority));
    }
    this.adapters = [
      instantiationService.createInstance(ClaudeDesktopMpcDiscoveryAdapter, remoteAuthority),
      instantiationService.createInstance(CursorDesktopMpcDiscoveryAdapter, remoteAuthority),
      instantiationService.createInstance(WindsurfDesktopMpcDiscoveryAdapter, remoteAuthority)
    ];
  }
  setDetails(detailsDto) {
    if (!detailsDto) {
      return;
    }
    const details = {
      ...detailsDto,
      homedir: URI.revive(detailsDto.homedir),
      xdgHome: detailsDto.xdgHome ? URI.revive(detailsDto.xdgHome) : void 0,
      winAppData: detailsDto.winAppData ? URI.revive(detailsDto.winAppData) : void 0
    };
    for (const adapter of this.adapters) {
      const file = adapter.getFilePath(details);
      if (!file) {
        continue;
      }
      const collection = {
        id: adapter.id,
        label: discoverySourceLabel[adapter.discoverySource] + this.suffix,
        remoteAuthority: adapter.remoteAuthority,
        configTarget: ConfigurationTarget.USER,
        scope: StorageScope.PROFILE,
        trustBehavior: McpServerTrust.Kind.TrustedOnNonce,
        serverDefinitions: observableValue(this, []),
        order: adapter.order + (adapter.remoteAuthority ? McpCollectionSortOrder.RemoteBoost : 0),
        presentation: {
          origin: file
        }
      };
      this._register(this.watchFile(file, collection, adapter.discoverySource, (contents) => adapter.adaptFile(contents, details)));
    }
  }
};
NativeFilesystemMcpDiscovery = __decorateClass([
  __decorateParam(1, ILabelService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IMcpRegistry),
  __decorateParam(5, IConfigurationService)
], NativeFilesystemMcpDiscovery);
export {
  FilesystemMcpDiscovery,
  NativeFilesystemMcpDiscovery
};
