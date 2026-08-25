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
import { joinPath } from "../../../base/common/resources.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { refineServiceDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService, AGENTS_WINDOW_PROFILE_ID } from "../common/userDataProfile.js";
import { UserDataProfilesService } from "../node/userDataProfile.js";
import { IStateService } from "../../state/node/state.js";
import { URI } from "../../../base/common/uri.js";
import { env } from "../../../base/common/process.js";
import { join, resolve } from "../../../base/common/path.js";
const IUserDataProfilesMainService = refineServiceDecorator(IUserDataProfilesService);
let UserDataProfilesMainService = class extends UserDataProfilesService {
  constructor(stateService, uriIdentityService, environmentService, fileService, logService, productService) {
    super(stateService, uriIdentityService, environmentService, fileService, logService);
    this.agentPluginsHome = URI.file(getAgentPluginsPath(environmentService.args, joinPath(environmentService.userHome, productService.dataFolderName)));
  }
  createDefaultProfile() {
    return {
      ...super.createDefaultProfile(),
      agentPluginsHome: this.agentPluginsHome
    };
  }
  async createAgentsWindowProfile() {
    const existing = this.profiles.find((p) => p.id === AGENTS_WINDOW_PROFILE_ID);
    if (existing) {
      return existing;
    }
    return this.createProfile(AGENTS_WINDOW_PROFILE_ID, "Agents");
  }
  getAssociatedEmptyWindows() {
    const emptyWindows = [];
    for (const id of this.profilesObject.emptyWindows.keys()) {
      emptyWindows.push({ id });
    }
    return emptyWindows;
  }
};
UserDataProfilesMainService = __decorateClass([
  __decorateParam(0, IStateService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, INativeEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IProductService)
], UserDataProfilesMainService);
function getAgentPluginsPath(args, userHome) {
  const cliAgentPluginsDir = args["agent-plugins-dir"];
  if (cliAgentPluginsDir) {
    return resolve(cliAgentPluginsDir);
  }
  const vscodeAgentPlugins = env["VSCODE_AGENT_PLUGINS"];
  if (vscodeAgentPlugins) {
    return vscodeAgentPlugins;
  }
  const vscodePortable = env["VSCODE_PORTABLE"];
  if (vscodePortable) {
    return join(vscodePortable, "agent-plugins");
  }
  return joinPath(userHome, "agent-plugins").fsPath;
}
export {
  IUserDataProfilesMainService,
  UserDataProfilesMainService
};
