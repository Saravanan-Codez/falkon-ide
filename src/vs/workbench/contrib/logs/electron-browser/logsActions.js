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
import { Action } from "../../../../base/common/actions.js";
import * as nls from "../../../../nls.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { joinPath } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
let OpenLogsFolderAction = class extends Action {
  constructor(id, label, environmentService, nativeHostService) {
    super(id, label);
    this.environmentService = environmentService;
    this.nativeHostService = nativeHostService;
  }
  static {
    this.ID = "workbench.action.openLogsFolder";
  }
  static {
    this.TITLE = nls.localize2("openLogsFolder", "Open Logs Folder");
  }
  run() {
    return this.nativeHostService.showItemInFolder(joinPath(this.environmentService.logsHome, "main.log").with({ scheme: Schemas.file }).fsPath);
  }
};
OpenLogsFolderAction = __decorateClass([
  __decorateParam(2, INativeWorkbenchEnvironmentService),
  __decorateParam(3, INativeHostService)
], OpenLogsFolderAction);
let OpenExtensionLogsFolderAction = class extends Action {
  constructor(id, label, environmentSerice, fileService, nativeHostService) {
    super(id, label);
    this.environmentSerice = environmentSerice;
    this.fileService = fileService;
    this.nativeHostService = nativeHostService;
  }
  static {
    this.ID = "workbench.action.openExtensionLogsFolder";
  }
  static {
    this.TITLE = nls.localize2("openExtensionLogsFolder", "Open Extension Logs Folder");
  }
  async run() {
    const folderStat = await this.fileService.resolve(this.environmentSerice.extHostLogsPath);
    if (folderStat.children && folderStat.children[0]) {
      return this.nativeHostService.showItemInFolder(folderStat.children[0].resource.with({ scheme: Schemas.file }).fsPath);
    }
  }
};
OpenExtensionLogsFolderAction = __decorateClass([
  __decorateParam(2, INativeWorkbenchEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, INativeHostService)
], OpenExtensionLogsFolderAction);
export {
  OpenExtensionLogsFolderAction,
  OpenLogsFolderAction
};
