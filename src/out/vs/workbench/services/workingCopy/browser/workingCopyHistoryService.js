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
import { IFileService } from "../../../../platform/files/common/files.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { WorkingCopyHistoryService } from "../common/workingCopyHistoryService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkingCopyHistoryService } from "../common/workingCopyHistory.js";
let BrowserWorkingCopyHistoryService = class extends WorkingCopyHistoryService {
  constructor(fileService, remoteAgentService, environmentService, uriIdentityService, labelService, logService, configurationService) {
    super(fileService, remoteAgentService, environmentService, uriIdentityService, labelService, logService, configurationService);
  }
  getModelOptions() {
    return {
      flushOnChange: true
      /* because browsers support no long running shutdown */
    };
  }
};
BrowserWorkingCopyHistoryService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IConfigurationService)
], BrowserWorkingCopyHistoryService);
registerSingleton(IWorkingCopyHistoryService, BrowserWorkingCopyHistoryService, InstantiationType.Delayed);
export {
  BrowserWorkingCopyHistoryService
};
