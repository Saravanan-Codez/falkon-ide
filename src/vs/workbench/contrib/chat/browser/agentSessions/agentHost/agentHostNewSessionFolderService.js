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
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { extUriBiasedIgnorePathCase } from "../../../../../../base/common/resources.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IChatService } from "../../../common/chatService/chatService.js";
const IAgentHostNewSessionFolderService = createDecorator("agentHostNewSessionFolderService");
function computeWorkingDirectories(primary, workspaceFolders, rootState, provider) {
  if (!primary) {
    return void 0;
  }
  const supportsMultiple = supportsMultipleWorkingDirectories(rootState, provider);
  if (!supportsMultiple || !workspaceFolders.some((folder) => extUriBiasedIgnorePathCase.isEqual(folder, primary))) {
    return [primary];
  }
  return computeDesiredWorkingDirectories(primary, [primary], workspaceFolders);
}
function supportsMultipleWorkingDirectories(rootState, provider) {
  const agent = rootState && !(rootState instanceof Error) ? rootState.agents.find((a) => a.provider === provider) : void 0;
  return !!agent?.capabilities?.multipleWorkingDirectories;
}
function hasImmutablePrimaryWorkingDirectory(rootState, provider) {
  const agent = rootState && !(rootState instanceof Error) ? rootState.agents.find((a) => a.provider === provider) : void 0;
  return agent?.capabilities?.multipleWorkingDirectories?.immutablePrimary === true;
}
function computeDesiredWorkingDirectories(primary, currentWorkingDirectories, workspaceFolders, extUri = extUriBiasedIgnorePathCase) {
  const desired = [primary];
  const addIfWorkspaceSecondary = (candidate) => {
    const alreadyIncluded = desired.some((existing) => extUri.isEqual(existing, candidate));
    if (alreadyIncluded || !workspaceFolders.some((folder) => extUri.isEqual(folder, candidate))) {
      return;
    }
    desired.push(candidate);
  };
  for (const currentSecondary of currentWorkingDirectories.slice(1)) {
    addIfWorkspaceSecondary(currentSecondary);
  }
  for (const folder of workspaceFolders) {
    addIfWorkspaceSecondary(folder);
  }
  return desired;
}
let AgentHostNewSessionFolderService = class extends Disposable {
  constructor(chatService, _workspaceContextService) {
    super();
    this._workspaceContextService = _workspaceContextService;
    this._folders = new ResourceMap();
    this._onDidChangeFolder = this._register(new Emitter());
    this.onDidChangeFolder = this._onDidChangeFolder.event;
    this._register(chatService.onDidDisposeSession((e) => {
      for (const sessionResource of e.sessionResources) {
        this.clear(sessionResource);
      }
    }));
  }
  getFolder(sessionResource) {
    return this._folders.get(sessionResource);
  }
  setFolder(sessionResource, folder) {
    this._defaultFolder = folder;
    const existing = this._folders.get(sessionResource);
    if (existing?.toString() === folder.toString()) {
      return;
    }
    this._folders.set(sessionResource, folder);
    this._onDidChangeFolder.fire(sessionResource);
  }
  clear(sessionResource) {
    if (this._folders.delete(sessionResource)) {
      this._onDidChangeFolder.fire(sessionResource);
    }
  }
  getDefaultFolder() {
    const stored = this._defaultFolder;
    if (stored && this._workspaceContextService.getWorkspace().folders.some((folder) => extUriBiasedIgnorePathCase.isEqual(folder.uri, stored))) {
      return stored;
    }
    return void 0;
  }
};
AgentHostNewSessionFolderService = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IWorkspaceContextService)
], AgentHostNewSessionFolderService);
registerSingleton(IAgentHostNewSessionFolderService, AgentHostNewSessionFolderService, InstantiationType.Delayed);
export {
  AgentHostNewSessionFolderService,
  IAgentHostNewSessionFolderService,
  computeDesiredWorkingDirectories,
  computeWorkingDirectories,
  hasImmutablePrimaryWorkingDirectory,
  supportsMultipleWorkingDirectories
};
