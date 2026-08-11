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
let TasksResourceInitializer = class {
  constructor(userDataProfileService, fileService, logService) {
    this.userDataProfileService = userDataProfileService;
    this.fileService = fileService;
    this.logService = logService;
  }
  async initialize(content) {
    const tasksContent = JSON.parse(content);
    if (!tasksContent.tasks) {
      this.logService.info(`Initializing Profile: No tasks to apply...`);
      return;
    }
    await this.fileService.writeFile(this.userDataProfileService.currentProfile.tasksResource, VSBuffer.fromString(tasksContent.tasks));
  }
};
TasksResourceInitializer = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], TasksResourceInitializer);
let TasksResource = class {
  constructor(fileService, logService) {
    this.fileService = fileService;
    this.logService = logService;
  }
  async getContent(profile) {
    const tasksContent = await this.getTasksResourceContent(profile);
    return JSON.stringify(tasksContent);
  }
  async getTasksResourceContent(profile) {
    const tasksContent = await this.getTasksContent(profile);
    return { tasks: tasksContent };
  }
  async apply(content, profile) {
    const tasksContent = JSON.parse(content);
    if (!tasksContent.tasks) {
      this.logService.info(`Importing Profile (${profile.name}): No tasks to apply...`);
      return;
    }
    await this.fileService.writeFile(profile.tasksResource, VSBuffer.fromString(tasksContent.tasks));
  }
  async getTasksContent(profile) {
    try {
      const content = await this.fileService.readFile(profile.tasksResource);
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
TasksResource = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILogService)
], TasksResource);
let TasksResourceTreeItem = class {
  constructor(profile, uriIdentityService, instantiationService) {
    this.profile = profile;
    this.uriIdentityService = uriIdentityService;
    this.instantiationService = instantiationService;
    this.type = ProfileResourceType.Tasks;
    this.handle = ProfileResourceType.Tasks;
    this.label = { label: localize("tasks", "Tasks") };
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
  }
  async getChildren() {
    return [{
      handle: this.profile.tasksResource.toString(),
      resourceUri: this.profile.tasksResource,
      collapsibleState: TreeItemCollapsibleState.None,
      parent: this,
      accessibilityInformation: {
        label: this.uriIdentityService.extUri.basename(this.profile.settingsResource)
      },
      command: {
        id: API_OPEN_EDITOR_COMMAND_ID,
        title: "",
        arguments: [this.profile.tasksResource, void 0, void 0]
      }
    }];
  }
  async hasContent() {
    const tasksContent = await this.instantiationService.createInstance(TasksResource).getTasksResourceContent(this.profile);
    return tasksContent.tasks !== null;
  }
  async getContent() {
    return this.instantiationService.createInstance(TasksResource).getContent(this.profile);
  }
  isFromDefaultProfile() {
    return !this.profile.isDefault && !!this.profile.useDefaultFlags?.tasks;
  }
};
TasksResourceTreeItem = __decorateClass([
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IInstantiationService)
], TasksResourceTreeItem);
export {
  TasksResource,
  TasksResourceInitializer,
  TasksResourceTreeItem
};
