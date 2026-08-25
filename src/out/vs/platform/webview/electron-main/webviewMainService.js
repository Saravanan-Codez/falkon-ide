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
import { webContents } from "electron";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { WebviewProtocolProvider } from "./webviewProtocolProvider.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
import { IFileService } from "../../files/common/files.js";
let WebviewMainService = class extends Disposable {
  constructor(fileService, windowsMainService) {
    super();
    this.windowsMainService = windowsMainService;
    this._onFoundInFrame = this._register(new Emitter());
    this.onFoundInFrame = this._onFoundInFrame.event;
    this._register(new WebviewProtocolProvider(fileService));
  }
  async setIgnoreMenuShortcuts(id, enabled) {
    let contents;
    if (typeof id.windowId === "number") {
      const { windowId } = id;
      const window = this.windowsMainService.getWindowById(windowId);
      if (!window?.win) {
        throw new Error(`Invalid windowId: ${windowId}`);
      }
      contents = window.win.webContents;
    } else {
      const { webContentsId } = id;
      contents = webContents.fromId(webContentsId);
      if (!contents) {
        throw new Error(`Invalid webContentsId: ${webContentsId}`);
      }
    }
    if (!contents.isDestroyed()) {
      contents.setIgnoreMenuShortcuts(enabled);
    }
  }
  async findInFrame(windowId, frameName, text, options) {
    const initialFrame = this.getFrameByName(windowId, frameName);
    const frame = initialFrame;
    if (typeof frame.findInFrame === "function") {
      frame.findInFrame(text, {
        findNext: options.findNext,
        forward: options.forward
      });
      const foundInFrameHandler = (_, result) => {
        if (result.finalUpdate) {
          this._onFoundInFrame.fire(result);
          frame.removeListener("found-in-frame", foundInFrameHandler);
        }
      };
      frame.on("found-in-frame", foundInFrameHandler);
    }
  }
  async stopFindInFrame(windowId, frameName, options) {
    const initialFrame = this.getFrameByName(windowId, frameName);
    const frame = initialFrame;
    if (typeof frame.stopFindInFrame === "function") {
      frame.stopFindInFrame(options.keepSelection ? "keepSelection" : "clearSelection");
    }
  }
  getFrameByName(windowId, frameName) {
    const window = this.windowsMainService.getWindowById(windowId.windowId);
    if (!window?.win) {
      throw new Error(`Invalid windowId: ${windowId}`);
    }
    const frame = window.win.webContents.mainFrame.framesInSubtree.find((frame2) => {
      return frame2.name === frameName;
    });
    if (!frame) {
      throw new Error(`Unknown frame: ${frameName}`);
    }
    return frame;
  }
};
WebviewMainService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IWindowsMainService)
], WebviewMainService);
export {
  WebviewMainService
};
