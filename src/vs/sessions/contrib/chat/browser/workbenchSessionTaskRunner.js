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
import { Schemas } from "../../../../base/common/network.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { TaskRunSource } from "../../../../workbench/contrib/tasks/common/tasks.js";
import { ITaskService } from "../../../../workbench/contrib/tasks/common/taskService.js";
let WorkbenchSessionTaskRunner = class {
  constructor(_taskService, _workspaceContextService) {
    this._taskService = _taskService;
    this._workspaceContextService = _workspaceContextService;
    this.id = "workbench";
    this.priority = 0;
  }
  canRun(session) {
    const cwd = this._getCwd(session);
    if (!cwd || cwd.scheme !== Schemas.file) {
      return false;
    }
    return !!this._workspaceContextService.getWorkspaceFolder(cwd);
  }
  async runTask(task, session) {
    const cwd = this._getCwd(session);
    if (!cwd) {
      return void 0;
    }
    const workspaceFolder = this._workspaceContextService.getWorkspaceFolder(cwd);
    if (!workspaceFolder) {
      return void 0;
    }
    const resolved = await this._taskService.getTask(workspaceFolder, task.label);
    if (!resolved) {
      return void 0;
    }
    await this._taskService.run(resolved, void 0, TaskRunSource.User);
    return toDisposable(() => {
      this._taskService.terminate(resolved);
    });
  }
  _getCwd(session) {
    const repo = session.workspace.get()?.folders[0];
    return repo?.workingDirectory ?? repo?.root;
  }
};
WorkbenchSessionTaskRunner = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IWorkspaceContextService)
], WorkbenchSessionTaskRunner);
export {
  WorkbenchSessionTaskRunner
};
