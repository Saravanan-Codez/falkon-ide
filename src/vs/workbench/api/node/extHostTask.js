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
import * as path from "../../../base/common/path.js";
import { URI } from "../../../base/common/uri.js";
import { findExecutable } from "../../../base/node/processes.js";
import { IExtHostWorkspace } from "../common/extHostWorkspace.js";
import { IExtHostDocumentsAndEditors } from "../common/extHostDocumentsAndEditors.js";
import { IExtHostConfiguration } from "../common/extHostConfiguration.js";
import { WorkspaceFolder } from "../../../platform/workspace/common/workspace.js";
import { IExtHostTerminalService } from "../common/extHostTerminalService.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { IExtHostInitDataService } from "../common/extHostInitDataService.js";
import { ExtHostTaskBase, TaskHandleDTO, TaskDTO, CustomExecutionDTO } from "../common/extHostTask.js";
import { Schemas } from "../../../base/common/network.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IExtHostApiDeprecationService } from "../common/extHostApiDeprecationService.js";
import * as resources from "../../../base/common/resources.js";
import { homedir } from "os";
import { IExtHostVariableResolverProvider } from "../common/extHostVariableResolverService.js";
let ExtHostTask = class extends ExtHostTaskBase {
  constructor(extHostRpc, initData, workspaceService, editorService, configurationService, extHostTerminalService, logService, deprecationService, variableResolver) {
    super(extHostRpc, initData, workspaceService, editorService, configurationService, extHostTerminalService, logService, deprecationService);
    this.workspaceService = workspaceService;
    this.variableResolver = variableResolver;
    if (initData.remote.isRemote && initData.remote.authority) {
      this.registerTaskSystem(Schemas.vscodeRemote, {
        scheme: Schemas.vscodeRemote,
        authority: initData.remote.authority,
        platform: process.platform
      });
    } else {
      this.registerTaskSystem(Schemas.file, {
        scheme: Schemas.file,
        authority: "",
        platform: process.platform
      });
    }
    this._proxy.$registerSupportedExecutions(true, true, true);
  }
  async executeTask(extension, task) {
    const tTask = task;
    if (!task.execution && tTask._id === void 0) {
      throw new Error("Tasks to execute must include an execution");
    }
    if (tTask._id !== void 0) {
      const handleDto = TaskHandleDTO.from(tTask, this.workspaceService);
      const executionDTO = await this._proxy.$getTaskExecution(handleDto);
      if (executionDTO.task === void 0) {
        throw new Error("Task from execution DTO is undefined");
      }
      const execution = await this.getTaskExecution(executionDTO, task);
      this._proxy.$executeTask(handleDto).catch(() => {
      });
      return execution;
    } else {
      const dto = TaskDTO.from(task, extension);
      if (dto === void 0) {
        return Promise.reject(new Error("Task is not valid"));
      }
      if (CustomExecutionDTO.is(dto.execution)) {
        await this.addCustomExecution(dto, task, false);
      }
      const execution = await this.getTaskExecution(await this._proxy.$getTaskExecution(dto), task);
      this._proxy.$executeTask(dto).catch(() => {
      });
      return execution;
    }
  }
  provideTasksInternal(validTypes, taskIdPromises, handler, value) {
    const taskDTOs = [];
    if (value) {
      for (const task of value) {
        this.checkDeprecation(task, handler);
        if (!task.definition || !validTypes[task.definition.type]) {
          this._logService.warn(`The task [${task.source}, ${task.name}] uses an undefined task type. The task will be ignored in the future.`);
        }
        const taskDTO = TaskDTO.from(task, handler.extension);
        if (taskDTO) {
          taskDTOs.push(taskDTO);
          if (CustomExecutionDTO.is(taskDTO.execution)) {
            taskIdPromises.push(this.addCustomExecution(taskDTO, task, true));
          }
        }
      }
    }
    return {
      tasks: taskDTOs,
      extension: handler.extension
    };
  }
  async resolveTaskInternal(resolvedTaskDTO) {
    return resolvedTaskDTO;
  }
  async getAFolder(workspaceFolders) {
    let folder = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0] : void 0;
    if (!folder) {
      const userhome = URI.file(homedir());
      folder = new WorkspaceFolder({ uri: userhome, name: resources.basename(userhome), index: 0 });
    }
    return {
      uri: folder.uri,
      name: folder.name,
      index: folder.index,
      toResource: () => {
        throw new Error("Not implemented");
      }
    };
  }
  async $resolveVariables(uriComponents, toResolve) {
    const uri = URI.revive(uriComponents);
    const result = {
      process: void 0,
      variables: /* @__PURE__ */ Object.create(null)
    };
    const workspaceFolder = await this._workspaceProvider.resolveWorkspaceFolder(uri);
    const workspaceFolders = await this._workspaceProvider.getWorkspaceFolders2() ?? [];
    const resolver = await this.variableResolver.getResolver();
    const ws = workspaceFolder ? {
      uri: workspaceFolder.uri,
      name: workspaceFolder.name,
      index: workspaceFolder.index,
      toResource: () => {
        throw new Error("Not implemented");
      }
    } : await this.getAFolder(workspaceFolders);
    for (const variable of toResolve.variables) {
      result.variables[variable] = await resolver.resolveAsync(ws, variable);
    }
    if (toResolve.process !== void 0) {
      let paths = void 0;
      if (toResolve.process.path !== void 0) {
        paths = toResolve.process.path.split(path.delimiter);
        for (let i = 0; i < paths.length; i++) {
          paths[i] = await resolver.resolveAsync(ws, paths[i]);
        }
      }
      const processName = await resolver.resolveAsync(ws, toResolve.process.name);
      const cwd = toResolve.process.cwd !== void 0 ? await resolver.resolveAsync(ws, toResolve.process.cwd) : void 0;
      const foundExecutable = await findExecutable(processName, cwd, paths);
      if (foundExecutable) {
        result.process = foundExecutable;
      } else if (path.isAbsolute(processName)) {
        result.process = processName;
      } else {
        result.process = path.join(cwd ?? "", processName);
      }
    }
    return result;
  }
  async $jsonTasksSupported() {
    return true;
  }
  async $findExecutable(command, cwd, paths) {
    return findExecutable(command, cwd, paths);
  }
};
ExtHostTask = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, IExtHostWorkspace),
  __decorateParam(3, IExtHostDocumentsAndEditors),
  __decorateParam(4, IExtHostConfiguration),
  __decorateParam(5, IExtHostTerminalService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IExtHostApiDeprecationService),
  __decorateParam(8, IExtHostVariableResolverProvider)
], ExtHostTask);
export {
  ExtHostTask
};
