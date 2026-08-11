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
import { Event } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { IExtensionHostDebugService } from "../../../../platform/debug/common/extensionHostDebug.js";
import { ExtensionHostDebugBroadcastChannel, ExtensionHostDebugChannelClient } from "../../../../platform/debug/common/extensionHostDebugIpc.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isFolderToOpen, isWorkspaceToOpen } from "../../../../platform/window/common/window.js";
import { IWorkspaceContextService, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier, hasWorkspaceFileExtension } from "../../../../platform/workspace/common/workspace.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
let BrowserExtensionHostDebugService = class extends ExtensionHostDebugChannelClient {
  static {
    this.LAST_EXTENSION_DEVELOPMENT_WORKSPACE_KEY = "debug.lastExtensionDevelopmentWorkspace";
  }
  constructor(remoteAgentService, environmentService, logService, hostService, contextService, storageService, fileService) {
    const connection = remoteAgentService.getConnection();
    let channel;
    if (connection) {
      channel = connection.getChannel(ExtensionHostDebugBroadcastChannel.ChannelName);
    } else {
      channel = { call: async () => Promise.resolve(void 0), listen: () => Event.None };
    }
    super(channel);
    this.storageService = storageService;
    this.fileService = fileService;
    if (environmentService.options && environmentService.options.workspaceProvider) {
      this.workspaceProvider = environmentService.options.workspaceProvider;
    } else {
      this.workspaceProvider = { open: async () => true, workspace: void 0, trusted: void 0 };
      logService.warn("Extension Host Debugging not available due to missing workspace provider.");
    }
    this._register(this.onReload((event) => {
      if (environmentService.isExtensionDevelopment && environmentService.debugExtensionHost.debugId === event.sessionId) {
        hostService.reload();
      }
    }));
    this._register(this.onClose((event) => {
      if (environmentService.isExtensionDevelopment && environmentService.debugExtensionHost.debugId === event.sessionId) {
        hostService.close();
      }
    }));
    if (environmentService.isExtensionDevelopment && !environmentService.extensionTestsLocationURI) {
      const workspaceId = toWorkspaceIdentifier(contextService.getWorkspace());
      if (isSingleFolderWorkspaceIdentifier(workspaceId) || isWorkspaceIdentifier(workspaceId)) {
        const serializedWorkspace = isSingleFolderWorkspaceIdentifier(workspaceId) ? { folderUri: workspaceId.uri.toJSON() } : { workspaceUri: workspaceId.configPath.toJSON() };
        storageService.store(BrowserExtensionHostDebugService.LAST_EXTENSION_DEVELOPMENT_WORKSPACE_KEY, JSON.stringify(serializedWorkspace), StorageScope.PROFILE, StorageTarget.MACHINE);
      } else {
        storageService.remove(BrowserExtensionHostDebugService.LAST_EXTENSION_DEVELOPMENT_WORKSPACE_KEY, StorageScope.PROFILE);
      }
    }
  }
  async openExtensionDevelopmentHostWindow(args, _debugRenderer) {
    const environment = /* @__PURE__ */ new Map();
    const fileUriArg = this.findArgument("file-uri", args);
    if (fileUriArg && !hasWorkspaceFileExtension(fileUriArg)) {
      environment.set("openFile", fileUriArg);
    }
    const copyArgs = [
      "extensionDevelopmentPath",
      "extensionTestsPath",
      "extensionEnvironment",
      "debugId",
      "inspect-brk-extensions",
      "inspect-extensions"
    ];
    for (const argName of copyArgs) {
      const value = this.findArgument(argName, args);
      if (value) {
        environment.set(argName, value);
      }
    }
    let debugWorkspace = void 0;
    const folderUriArg = this.findArgument("folder-uri", args);
    if (folderUriArg) {
      debugWorkspace = { folderUri: URI.parse(folderUriArg) };
    } else {
      const fileUriArg2 = this.findArgument("file-uri", args);
      if (fileUriArg2 && hasWorkspaceFileExtension(fileUriArg2)) {
        debugWorkspace = { workspaceUri: URI.parse(fileUriArg2) };
      }
    }
    const extensionTestsPath = this.findArgument("extensionTestsPath", args);
    if (!debugWorkspace && !extensionTestsPath) {
      const lastExtensionDevelopmentWorkspace = this.storageService.get(BrowserExtensionHostDebugService.LAST_EXTENSION_DEVELOPMENT_WORKSPACE_KEY, StorageScope.PROFILE);
      if (lastExtensionDevelopmentWorkspace) {
        try {
          const serializedWorkspace = JSON.parse(lastExtensionDevelopmentWorkspace);
          if (serializedWorkspace.workspaceUri) {
            debugWorkspace = { workspaceUri: URI.revive(serializedWorkspace.workspaceUri) };
          } else if (serializedWorkspace.folderUri) {
            debugWorkspace = { folderUri: URI.revive(serializedWorkspace.folderUri) };
          }
        } catch (error) {
        }
      }
    }
    if (debugWorkspace) {
      const debugWorkspaceResource = isFolderToOpen(debugWorkspace) ? debugWorkspace.folderUri : isWorkspaceToOpen(debugWorkspace) ? debugWorkspace.workspaceUri : void 0;
      if (debugWorkspaceResource) {
        const workspaceExists = await this.fileService.exists(debugWorkspaceResource);
        if (!workspaceExists) {
          debugWorkspace = void 0;
        }
      }
    }
    const success = await this.workspaceProvider.open(debugWorkspace, {
      reuse: false,
      // debugging always requires a new window
      payload: Array.from(environment.entries())
      // mandatory properties to enable debugging
    });
    return { success };
  }
  findArgument(key, args) {
    for (const a of args) {
      const k = `--${key}=`;
      if (a.indexOf(k) === 0) {
        return a.substring(k.length);
      }
    }
    return void 0;
  }
};
BrowserExtensionHostDebugService = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IHostService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IFileService)
], BrowserExtensionHostDebugService);
registerSingleton(IExtensionHostDebugService, BrowserExtensionHostDebugService, InstantiationType.Delayed);
