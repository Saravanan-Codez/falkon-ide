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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { localize } from "../../../../nls.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ProfileResourceType } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { TreeItemCollapsibleState } from "../../../common/views.js";
import { IUserDataProfileService } from "../common/userDataProfile.js";
let McpResourceInitializer = class {
  constructor(userDataProfileService, fileService, logService) {
    this.userDataProfileService = userDataProfileService;
    this.fileService = fileService;
    this.logService = logService;
  }
  async initialize(content) {
    const mcpContent = JSON.parse(content);
    if (!mcpContent.mcp) {
      this.logService.info(`Initializing Profile: No MCP servers to apply...`);
      return;
    }
    await this.fileService.writeFile(this.userDataProfileService.currentProfile.mcpResource, VSBuffer.fromString(mcpContent.mcp));
  }
};
McpResourceInitializer = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], McpResourceInitializer);
let McpProfileResource = class {
  constructor(fileService, logService) {
    this.fileService = fileService;
    this.logService = logService;
  }
  async getContent(profile) {
    const mcpContent = await this.getMcpResourceContent(profile);
    return JSON.stringify(mcpContent);
  }
  async getMcpResourceContent(profile) {
    const mcpContent = await this.getMcpContent(profile);
    return { mcp: mcpContent };
  }
  async apply(content, profile) {
    const mcpContent = JSON.parse(content);
    if (!mcpContent.mcp) {
      this.logService.info(`Importing Profile (${profile.name}): No MCP servers to apply...`);
      return;
    }
    await this.fileService.writeFile(profile.mcpResource, VSBuffer.fromString(mcpContent.mcp));
  }
  async getMcpContent(profile) {
    try {
      const content = await this.fileService.readFile(profile.mcpResource);
      return content.value.toString();
    } catch (error) {
      if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
        return null;
      } else {
        throw error;
      }
    }
  }
};
McpProfileResource = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILogService)
], McpProfileResource);
let McpResourceTreeItem = class {
  constructor(profile, uriIdentityService, instantiationService) {
    this.profile = profile;
    this.uriIdentityService = uriIdentityService;
    this.instantiationService = instantiationService;
    this.type = ProfileResourceType.Mcp;
    this.handle = ProfileResourceType.Mcp;
    this.label = { label: localize("mcp", "MCP Servers") };
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
  }
  async getChildren() {
    return [{
      handle: this.profile.mcpResource.toString(),
      resourceUri: this.profile.mcpResource,
      collapsibleState: TreeItemCollapsibleState.None,
      parent: this,
      accessibilityInformation: {
        label: this.uriIdentityService.extUri.basename(this.profile.mcpResource)
      },
      command: {
        id: API_OPEN_EDITOR_COMMAND_ID,
        title: "",
        arguments: [this.profile.mcpResource, void 0, void 0]
      }
    }];
  }
  async hasContent() {
    const mcpContent = await this.instantiationService.createInstance(McpProfileResource).getMcpResourceContent(this.profile);
    return mcpContent.mcp !== null;
  }
  async getContent() {
    return this.instantiationService.createInstance(McpProfileResource).getContent(this.profile);
  }
  isFromDefaultProfile() {
    return !this.profile.isDefault && !!this.profile.useDefaultFlags?.mcp;
  }
};
McpResourceTreeItem = __decorateClass([
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IInstantiationService)
], McpResourceTreeItem);
export {
  McpProfileResource,
  McpResourceInitializer,
  McpResourceTreeItem
};
