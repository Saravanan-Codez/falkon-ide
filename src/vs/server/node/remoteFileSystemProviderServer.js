import { URI } from "../../base/common/uri.js";
import { createURITransformer } from "../../base/common/uriTransformer.js";
import { DiskFileSystemProvider } from "../../platform/files/node/diskFileSystemProvider.js";
import { posix, delimiter } from "../../base/common/path.js";
import { AbstractDiskFileSystemProviderChannel, AbstractSessionFileWatcher } from "../../platform/files/node/diskFileSystemProviderServer.js";
class RemoteAgentFileSystemProviderChannel extends AbstractDiskFileSystemProviderChannel {
  constructor(logService, environmentService, configurationService) {
    super(new DiskFileSystemProvider(logService), logService);
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.uriTransformerCache = /* @__PURE__ */ new Map();
    this._register(this.provider);
  }
  getUriTransformer(ctx) {
    let transformer = this.uriTransformerCache.get(ctx.remoteAuthority);
    if (!transformer) {
      transformer = createURITransformer(ctx.remoteAuthority);
      this.uriTransformerCache.set(ctx.remoteAuthority, transformer);
    }
    return transformer;
  }
  transformIncoming(uriTransformer, _resource, supportVSCodeResource = false) {
    if (supportVSCodeResource && _resource.path === "/vscode-resource" && _resource.query) {
      const requestResourcePath = JSON.parse(_resource.query).requestResourcePath;
      return URI.from({ scheme: "file", path: requestResourcePath });
    }
    return URI.revive(uriTransformer.transformIncoming(_resource));
  }
  //#region File Watching
  createSessionFileWatcher(uriTransformer, emitter) {
    return new SessionFileWatcher(uriTransformer, emitter, this.logService, this.environmentService, this.configurationService);
  }
  //#endregion
}
class SessionFileWatcher extends AbstractSessionFileWatcher {
  constructor(uriTransformer, sessionEmitter, logService, environmentService, configurationService) {
    super(uriTransformer, sessionEmitter, logService, environmentService);
  }
  getRecursiveWatcherOptions(environmentService) {
    const fileWatcherPolling = environmentService.args["file-watcher-polling"];
    if (fileWatcherPolling) {
      const segments = fileWatcherPolling.split(delimiter);
      const pollingInterval = Number(segments[0]);
      if (pollingInterval > 0) {
        const usePolling = segments.length > 1 ? segments.slice(1) : true;
        return { usePolling, pollingInterval };
      }
    }
    return void 0;
  }
  getExtraExcludes(environmentService) {
    if (environmentService.extensionsPath) {
      return [posix.join(environmentService.extensionsPath, "**")];
    }
    return void 0;
  }
}
export {
  RemoteAgentFileSystemProviderChannel
};
