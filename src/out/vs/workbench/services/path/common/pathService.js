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
import { isValidBasename } from "../../../../base/common/extpath.js";
import { Schemas } from "../../../../base/common/network.js";
import { win32, posix } from "../../../../base/common/path.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { getVirtualWorkspaceScheme } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
const IPathService = createDecorator("pathService");
let AbstractPathService = class {
  constructor(localUserHome, remoteAgentService, environmentService, contextService) {
    this.localUserHome = localUserHome;
    this.remoteAgentService = remoteAgentService;
    this.environmentService = environmentService;
    this.contextService = contextService;
    this.resolveOS = (async () => {
      const env = await this.remoteAgentService.getEnvironment();
      return env?.os || OS;
    })();
    this.resolveUserHome = (async () => {
      const env = await this.remoteAgentService.getEnvironment();
      const userHome = this.maybeUnresolvedUserHome = env?.userHome ?? localUserHome;
      return userHome;
    })();
  }
  hasValidBasename(resource, arg2, basename2) {
    if (typeof arg2 === "string" || typeof arg2 === "undefined") {
      return this.resolveOS.then((os) => this.doHasValidBasename(resource, os, arg2));
    }
    return this.doHasValidBasename(resource, arg2, basename2);
  }
  doHasValidBasename(resource, os, name) {
    if (resource.scheme === Schemas.file || resource.scheme === Schemas.vscodeRemote) {
      return isValidBasename(name ?? basename(resource), os === OperatingSystem.Windows);
    }
    return true;
  }
  get defaultUriScheme() {
    return AbstractPathService.findDefaultUriScheme(this.environmentService, this.contextService);
  }
  static findDefaultUriScheme(environmentService, contextService) {
    if (environmentService.remoteAuthority) {
      return Schemas.vscodeRemote;
    }
    const virtualWorkspace = getVirtualWorkspaceScheme(contextService.getWorkspace());
    if (virtualWorkspace) {
      return virtualWorkspace;
    }
    const firstFolder = contextService.getWorkspace().folders[0];
    if (firstFolder) {
      return firstFolder.uri.scheme;
    }
    const configuration = contextService.getWorkspace().configuration;
    if (configuration) {
      return configuration.scheme;
    }
    return Schemas.file;
  }
  userHome(options) {
    return options?.preferLocal ? this.localUserHome : this.resolveUserHome;
  }
  get resolvedUserHome() {
    return this.maybeUnresolvedUserHome;
  }
  get path() {
    return this.resolveOS.then((os) => {
      return os === OperatingSystem.Windows ? win32 : posix;
    });
  }
  async fileURI(_path) {
    let authority = "";
    const os = await this.resolveOS;
    if (os === OperatingSystem.Windows) {
      _path = _path.replace(/\\/g, "/");
    }
    if (_path[0] === "/" && _path[1] === "/") {
      const idx = _path.indexOf("/", 2);
      if (idx === -1) {
        authority = _path.substring(2);
        _path = "/";
      } else {
        authority = _path.substring(2, idx);
        _path = _path.substring(idx) || "/";
      }
    }
    return URI.from({
      scheme: Schemas.file,
      authority,
      path: _path,
      query: "",
      fragment: ""
    });
  }
};
AbstractPathService = __decorateClass([
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IWorkspaceContextService)
], AbstractPathService);
export {
  AbstractPathService,
  IPathService
};
