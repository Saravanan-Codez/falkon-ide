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
import electron from "electron";
import { Queue } from "../../../base/common/async.js";
import { hash } from "../../../base/common/hash.js";
import { mnemonicButtonLabel } from "../../../base/common/labels.js";
import { Disposable, dispose, toDisposable } from "../../../base/common/lifecycle.js";
import { normalizeNFC } from "../../../base/common/normalization.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { Promises } from "../../../base/node/pfs.js";
import { localize } from "../../../nls.js";
import { massageMessageBoxOptions } from "./dialogMainUtils.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { WORKSPACE_FILTER } from "../../workspace/common/workspace.js";
const IDialogMainService = createDecorator("dialogMainService");
let DialogMainService = class {
  constructor(logService, productService) {
    this.logService = logService;
    this.productService = productService;
    this.windowFileDialogLocks = /* @__PURE__ */ new Map();
    this.windowDialogQueues = /* @__PURE__ */ new Map();
    this.noWindowDialogueQueue = new Queue();
  }
  pickFileFolder(options, window) {
    return this.doPick({ ...options, pickFolders: true, pickFiles: true, title: localize("open", "Open") }, window);
  }
  pickFolder(options, window) {
    let optionsInternal = {
      ...options,
      pickFolders: true,
      title: localize("openFolder", "Open Folder")
    };
    if (isWindows) {
      optionsInternal = {
        ...optionsInternal,
        buttonLabel: mnemonicButtonLabel(localize({ key: "selectFolder", comment: ["&& denotes a mnemonic"] }, "&&Select folder")).withMnemonic
      };
    }
    return this.doPick(optionsInternal, window);
  }
  pickFile(options, window) {
    return this.doPick({ ...options, pickFiles: true, title: localize("openFile", "Open File") }, window);
  }
  pickWorkspace(options, window) {
    const title = localize("openWorkspaceTitle", "Open Workspace from File");
    const buttonLabel = mnemonicButtonLabel(localize({ key: "openWorkspace", comment: ["&& denotes a mnemonic"] }, "&&Open")).withMnemonic;
    const filters = WORKSPACE_FILTER;
    return this.doPick({ ...options, pickFiles: true, title, filters, buttonLabel }, window);
  }
  async doPick(options, window) {
    const dialogOptions = {
      title: options.title,
      buttonLabel: options.buttonLabel,
      filters: options.filters,
      defaultPath: options.defaultPath
    };
    if (typeof options.pickFiles === "boolean" || typeof options.pickFolders === "boolean") {
      dialogOptions.properties = void 0;
      if (options.pickFiles && options.pickFolders) {
        dialogOptions.properties = ["multiSelections", "openDirectory", "openFile", "createDirectory"];
      }
    }
    if (!dialogOptions.properties) {
      dialogOptions.properties = ["multiSelections", options.pickFolders ? "openDirectory" : "openFile", "createDirectory"];
    }
    if (isMacintosh) {
      dialogOptions.properties.push("treatPackageAsDirectory");
    }
    const result = await this.showOpenDialog(dialogOptions, (window || electron.BrowserWindow.getFocusedWindow()) ?? void 0);
    if (result?.filePaths && result.filePaths.length > 0) {
      return result.filePaths;
    }
    return void 0;
  }
  getWindowDialogQueue(window) {
    if (window) {
      let windowDialogQueue = this.windowDialogQueues.get(window.id);
      if (!windowDialogQueue) {
        windowDialogQueue = new Queue();
        this.windowDialogQueues.set(window.id, windowDialogQueue);
      }
      return windowDialogQueue;
    } else {
      return this.noWindowDialogueQueue;
    }
  }
  showMessageBox(rawOptions, window) {
    return this.getWindowDialogQueue(window).queue(async () => {
      const { options, buttonIndeces } = massageMessageBoxOptions(rawOptions, this.productService);
      let result = void 0;
      if (window) {
        result = await electron.dialog.showMessageBox(window, options);
      } else {
        result = await electron.dialog.showMessageBox(options);
      }
      return {
        response: buttonIndeces[result.response],
        checkboxChecked: result.checkboxChecked
      };
    });
  }
  async showSaveDialog(options, window) {
    const fileDialogLock = this.acquireFileDialogLock(options, window);
    if (!fileDialogLock) {
      this.logService.error("[DialogMainService]: file save dialog is already or will be showing for the window with the same configuration");
      return { canceled: true, filePath: "" };
    }
    try {
      return await this.getWindowDialogQueue(window).queue(async () => {
        let result;
        if (window) {
          result = await electron.dialog.showSaveDialog(window, options);
        } else {
          result = await electron.dialog.showSaveDialog(options);
        }
        result.filePath = this.normalizePath(result.filePath);
        return result;
      });
    } finally {
      dispose(fileDialogLock);
    }
  }
  normalizePath(path) {
    if (path && isMacintosh) {
      path = normalizeNFC(path);
    }
    return path;
  }
  normalizePaths(paths) {
    return paths.map((path) => this.normalizePath(path));
  }
  async showOpenDialog(options, window) {
    if (options.defaultPath) {
      const pathExists = await Promises.exists(options.defaultPath);
      if (!pathExists) {
        options.defaultPath = void 0;
      }
    }
    const fileDialogLock = this.acquireFileDialogLock(options, window);
    if (!fileDialogLock) {
      this.logService.error("[DialogMainService]: file open dialog is already or will be showing for the window with the same configuration");
      return { canceled: true, filePaths: [] };
    }
    try {
      return await this.getWindowDialogQueue(window).queue(async () => {
        let result;
        if (window) {
          result = await electron.dialog.showOpenDialog(window, options);
        } else {
          result = await electron.dialog.showOpenDialog(options);
        }
        result.filePaths = this.normalizePaths(result.filePaths);
        return result;
      });
    } finally {
      dispose(fileDialogLock);
    }
  }
  acquireFileDialogLock(options, window) {
    if (!window) {
      return Disposable.None;
    }
    this.logService.trace("[DialogMainService]: request to acquire file dialog lock", options);
    let windowFileDialogLocks = this.windowFileDialogLocks.get(window.id);
    if (!windowFileDialogLocks) {
      windowFileDialogLocks = /* @__PURE__ */ new Set();
      this.windowFileDialogLocks.set(window.id, windowFileDialogLocks);
    }
    const optionsHash = hash(options);
    if (windowFileDialogLocks.has(optionsHash)) {
      return void 0;
    }
    this.logService.trace("[DialogMainService]: new file dialog lock created", options);
    windowFileDialogLocks.add(optionsHash);
    return toDisposable(() => {
      this.logService.trace("[DialogMainService]: file dialog lock disposed", options);
      windowFileDialogLocks?.delete(optionsHash);
      if (windowFileDialogLocks?.size === 0) {
        this.windowFileDialogLocks.delete(window.id);
      }
    });
  }
};
DialogMainService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IProductService)
], DialogMainService);
export {
  DialogMainService,
  IDialogMainService
};
