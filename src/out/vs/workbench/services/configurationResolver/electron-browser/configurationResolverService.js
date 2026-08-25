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
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IConfigurationResolverService } from "../common/configurationResolver.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { BaseConfigurationResolverService } from "../browser/baseConfigurationResolverService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IShellEnvironmentService } from "../../environment/electron-browser/shellEnvironmentService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let ConfigurationResolverService = class extends BaseConfigurationResolverService {
  constructor(editorService, environmentService, configurationService, commandService, workspaceContextService, quickInputService, labelService, shellEnvironmentService, pathService, extensionService, storageService) {
    super(
      {
        getAppRoot: () => {
          return environmentService.appRoot;
        },
        getExecPath: () => {
          return environmentService.execPath;
        }
      },
      shellEnvironmentService.getShellEnv(),
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
  __decorateParam(1, INativeWorkbenchEnvironmentService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IShellEnvironmentService),
  __decorateParam(8, IPathService),
  __decorateParam(9, IExtensionService),
  __decorateParam(10, IStorageService)
], ConfigurationResolverService);
registerSingleton(IConfigurationResolverService, ConfigurationResolverService, InstantiationType.Delayed);
export {
  ConfigurationResolverService
};
