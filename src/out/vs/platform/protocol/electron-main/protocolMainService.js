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
import { session } from "electron";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { COI, FileAccess, Schemas, CacheControlheaders, DocumentPolicyheaders } from "../../../base/common/network.js";
import { basename, extname, normalize } from "../../../base/common/path.js";
import { isLinux } from "../../../base/common/platform.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { ILogService } from "../../log/common/log.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
let ProtocolMainService = class extends Disposable {
  // https://github.com/microsoft/vscode/issues/119384
  constructor(environmentService, userDataProfilesService, logService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    this.validRoots = TernarySearchTree.forPaths(!isLinux);
    this.validExtensions = /* @__PURE__ */ new Set([".svg", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".mp4", ".otf", ".ttf"]);
    this.addValidFileRoot(environmentService.appRoot);
    this.addValidFileRoot(environmentService.extensionsPath);
    this.addValidFileRoot(userDataProfilesService.defaultProfile.globalStorageHome.with({ scheme: Schemas.file }).fsPath);
    this.addValidFileRoot(environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath);
    this.handleProtocols();
  }
  handleProtocols() {
    const { defaultSession } = session;
    defaultSession.protocol.registerFileProtocol(Schemas.vscodeFileResource, (request, callback) => this.handleResourceRequest(request, callback));
    defaultSession.protocol.interceptFileProtocol(Schemas.file, (request, callback) => this.handleFileRequest(request, callback));
    this._register(toDisposable(() => {
      defaultSession.protocol.unregisterProtocol(Schemas.vscodeFileResource);
      defaultSession.protocol.uninterceptProtocol(Schemas.file);
    }));
  }
  addValidFileRoot(root) {
    const normalizedRoot = normalize(root);
    if (!this.validRoots.get(normalizedRoot)) {
      this.validRoots.set(normalizedRoot, true);
      return toDisposable(() => this.validRoots.delete(normalizedRoot));
    }
    return Disposable.None;
  }
  //#region file://
  handleFileRequest(request, callback) {
    const uri = URI.parse(request.url);
    this.logService.error(`Refused to load resource ${uri.fsPath} from ${Schemas.file}: protocol (original URL: ${request.url})`);
    return callback({
      error: -3
      /* ABORTED */
    });
  }
  //#endregion
  //#region vscode-file://
  handleResourceRequest(request, callback) {
    const path = this.requestToNormalizedFilePath(request);
    const pathBasename = basename(path);
    let headers;
    if (this.environmentService.crossOriginIsolated) {
      if (pathBasename === "workbench.html" || pathBasename === "workbench-dev.html") {
        headers = COI.CoopAndCoep;
      } else {
        headers = COI.getHeadersFromQuery(request.url);
      }
    }
    if (!this.environmentService.isBuilt) {
      headers = {
        ...headers,
        ...CacheControlheaders
      };
    }
    if (pathBasename === "workbench.html" || pathBasename === "workbench-dev.html") {
      headers = {
        ...headers,
        ...DocumentPolicyheaders
      };
    }
    if (this.validRoots.findSubstr(path)) {
      return callback({ path, headers });
    }
    if (this.validExtensions.has(extname(path).toLowerCase())) {
      return callback({ path, headers });
    }
    this.logService.error(`${Schemas.vscodeFileResource}: Refused to load resource ${path} from ${Schemas.vscodeFileResource}: protocol (original URL: ${request.url})`);
    return callback({
      error: -3
      /* ABORTED */
    });
  }
  requestToNormalizedFilePath(request) {
    const requestUri = URI.parse(request.url);
    const unnormalizedFileUri = FileAccess.uriToFileUri(requestUri);
    return normalize(unnormalizedFileUri.fsPath);
  }
  //#endregion
  //#region IPC Object URLs
  createIPCObjectUrl() {
    let obj = void 0;
    const resource = URI.from({
      scheme: "vscode",
      // used for all our IPC communication (vscode:<channel>)
      path: generateUuid()
    });
    const channel = resource.toString();
    const handler = async () => obj;
    validatedIpcMain.handle(channel, handler);
    this.logService.trace(`IPC Object URL: Registered new channel ${channel}.`);
    return {
      resource,
      update: (updatedObj) => obj = updatedObj,
      dispose: () => {
        this.logService.trace(`IPC Object URL: Removed channel ${channel}.`);
        validatedIpcMain.removeHandler(channel);
      }
    };
  }
  //#endregion
};
ProtocolMainService = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, ILogService)
], ProtocolMainService);
export {
  ProtocolMainService
};
