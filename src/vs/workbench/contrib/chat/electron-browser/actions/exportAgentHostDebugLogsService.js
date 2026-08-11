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
import { Schemas } from "../../../../../base/common/network.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { hasKey } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { INativeHostService } from "../../../../../platform/native/common/native.js";
import { IAgentHostDebugLogsExportService } from "../../browser/actions/exportAgentHostDebugLogsAction.js";
let NativeAgentHostDebugLogsExportService = class {
  constructor(fileDialogService, nativeHostService) {
    this.fileDialogService = fileDialogService;
    this.nativeHostService = nativeHostService;
  }
  async save(exportName, files) {
    const defaultUri = joinPath(await this.fileDialogService.preferredHome(Schemas.file), `${exportName}.zip`);
    const saveUri = await this.fileDialogService.showSaveDialog({
      title: localize("exportDebugLogs.saveDialogTitle", "Export Agent Host Debug Logs"),
      defaultUri,
      filters: [{ name: localize("exportDebugLogs.zipFilter", "Zip Archive"), extensions: ["zip"] }],
      availableFileSystems: [Schemas.file]
    });
    if (!saveUri) {
      return false;
    }
    await this.nativeHostService.createZipFile(saveUri, files.map((file) => {
      return hasKey(file, { contents: true }) ? file : { path: file.path, source: file.resource, size: file.size };
    }));
    return true;
  }
};
NativeAgentHostDebugLogsExportService = __decorateClass([
  __decorateParam(0, IFileDialogService),
  __decorateParam(1, INativeHostService)
], NativeAgentHostDebugLogsExportService);
registerSingleton(IAgentHostDebugLogsExportService, NativeAgentHostDebugLogsExportService, InstantiationType.Delayed);
