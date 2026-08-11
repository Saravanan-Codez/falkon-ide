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
import { createRandomIPCHandle } from "../../../base/parts/ipc/node/ipc.net.js";
import * as fs from "fs";
import { IExtHostCommands } from "../common/extHostCommands.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { hasWorkspaceFileExtension } from "../../../platform/workspace/common/workspace.js";
class CLIServerBase {
  constructor(_commands, logService, _ipcHandlePath) {
    this._commands = _commands;
    this.logService = logService;
    this._ipcHandlePath = _ipcHandlePath;
    this._server = void 0;
    this._disposed = false;
    this.setup();
  }
  get ipcHandlePath() {
    return this._ipcHandlePath;
  }
  async setup() {
    try {
      const http = await import("http");
      if (this._disposed) {
        return;
      }
      this._server = http.createServer((req, res) => this.onRequest(req, res));
      try {
        this._server.listen(this.ipcHandlePath);
        this._server.on("error", (err) => this.logService.error(err));
      } catch (err) {
        this.logService.error("Could not start open from terminal server.");
      }
    } catch (error) {
      this.logService.error("Error setting up CLI server", error);
    }
  }
  onRequest(req, res) {
    const sendResponse = (statusCode, returnObj) => {
      res.writeHead(statusCode, { "content-type": "application/json" });
      res.end(JSON.stringify(returnObj || null), (err) => err && this.logService.error(err));
    };
    const chunks = [];
    req.setEncoding("utf8");
    req.on("data", (d) => chunks.push(d));
    req.on("end", async () => {
      try {
        const data = JSON.parse(chunks.join(""));
        let returnObj;
        switch (data.type) {
          case "open":
            returnObj = await this.open(data);
            break;
          case "openExternal":
            returnObj = await this.openExternal(data);
            break;
          case "status":
            returnObj = await this.getStatus(data);
            break;
          case "extensionManagement":
            returnObj = await this.manageExtensions(data);
            break;
          default:
            sendResponse(404, `Unknown message type: ${data.type}`);
            break;
        }
        sendResponse(200, returnObj);
      } catch (e) {
        const message = e instanceof Error ? e.message : JSON.stringify(e);
        sendResponse(500, message);
        this.logService.error("Error while processing pipe request", e);
      }
    });
  }
  async open(data) {
    const { fileURIs, folderURIs, forceNewWindow, diffMode, mergeMode, addMode, removeMode, forceReuseWindow, gotoLineMode, waitMarkerFilePath, remoteAuthority } = data;
    const urisToOpen = [];
    if (Array.isArray(folderURIs)) {
      for (const s of folderURIs) {
        try {
          urisToOpen.push({ folderUri: URI.parse(s) });
        } catch (e) {
        }
      }
    }
    if (Array.isArray(fileURIs)) {
      for (const s of fileURIs) {
        try {
          if (hasWorkspaceFileExtension(s)) {
            urisToOpen.push({ workspaceUri: URI.parse(s) });
          } else {
            urisToOpen.push({ fileUri: URI.parse(s) });
          }
        } catch (e) {
        }
      }
    }
    const waitMarkerFileURI = waitMarkerFilePath ? URI.file(waitMarkerFilePath) : void 0;
    const preferNewWindow = !forceReuseWindow && !waitMarkerFileURI && !addMode && !removeMode;
    const windowOpenArgs = { forceNewWindow, diffMode, mergeMode, addMode, removeMode, gotoLineMode, forceReuseWindow, preferNewWindow, waitMarkerFileURI, remoteAuthority };
    this._commands.executeCommand("_remoteCLI.windowOpen", urisToOpen, windowOpenArgs);
  }
  async openExternal(data) {
    for (const uriString of data.uris) {
      const uri = URI.parse(uriString);
      if (uri.scheme === "file") {
        continue;
      }
      await this._commands.executeCommand("_remoteCLI.openExternal", uriString);
    }
  }
  async manageExtensions(data) {
    const toExtOrVSIX = (inputs) => inputs?.map((input) => /\.vsix$/i.test(input) ? URI.parse(input) : input);
    const commandArgs = {
      list: data.list,
      install: toExtOrVSIX(data.install),
      uninstall: toExtOrVSIX(data.uninstall),
      force: data.force
    };
    return await this._commands.executeCommand("_remoteCLI.manageExtensions", commandArgs);
  }
  async getStatus(data) {
    return await this._commands.executeCommand("_remoteCLI.getSystemStatus");
  }
  dispose() {
    this._disposed = true;
    this._server?.close();
    if (this._ipcHandlePath && process.platform !== "win32" && fs.existsSync(this._ipcHandlePath)) {
      fs.unlinkSync(this._ipcHandlePath);
    }
  }
}
let CLIServer = class extends CLIServerBase {
  constructor(commands, logService) {
    super(commands, logService, createRandomIPCHandle());
  }
};
CLIServer = __decorateClass([
  __decorateParam(0, IExtHostCommands),
  __decorateParam(1, ILogService)
], CLIServer);
export {
  CLIServer,
  CLIServerBase
};
