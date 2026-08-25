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
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { BaseConfigurationResolverService } from "./baseConfigurationResolverService.js";
import { IConfigurationResolverService } from "../common/configurationResolver.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IPathService } from "../../path/common/pathService.js";
let ConfigurationResolverService = class extends BaseConfigurationResolverService {
  constructor(editorService, configurationService, commandService, workspaceContextService, quickInputService, labelService, pathService, extensionService, storageService) {
    super(
      { getAppRoot: () => void 0, getExecPath: () => void 0 },
      Promise.resolve(/* @__PURE__ */ Object.create(null)),
      editorService,
      configurationService,
      commandService,
      workspaceContextService,
      quickInputService,
      labelService,
      pathService,
      extensionService,
      storageService
    );
  }
};
ConfigurationResolverService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IPathService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IStorageService)
], ConfigurationResolverService);
registerSingleton(IConfigurationResolverService, ConfigurationResolverService, InstantiationType.Delayed);
export {
  ConfigurationResolverService
};
