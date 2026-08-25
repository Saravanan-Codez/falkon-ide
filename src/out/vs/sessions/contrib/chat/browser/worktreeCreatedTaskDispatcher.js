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
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, registerAutorunSelfDisposable } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsTasksService } from "./sessionsTasksService.js";
const LOG_PREFIX = "[WorktreeCreatedTaskDispatcher]";
const AGENT_HOST_RUN_WORKTREE_CREATED_TASKS_SETTING = "chat.agentHost.runWorktreeCreatedTasks";
let WorktreeCreatedTaskDispatcher = class extends Disposable {
  constructor(_sessionsManagementService, _sessionsTasksService, _configurationService, _logService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsTasksService = _sessionsTasksService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    // Track per-session disposables (one per in-flight session subscription) so
    // we tear them down when the session is removed.
    this._sessionDisposables = this._register(new DisposableMap());
    this._register(this._sessionsManagementService.onDidStartSession((session) => this._trackSession(session)));
    this._register(this._sessionsManagementService.onDidChangeSessions((e) => this._onDidRemoveSessions(e.removed)));
  }
  static {
    this.ID = "workbench.contrib.sessions.worktreeCreatedTaskDispatcher";
  }
  _onDidRemoveSessions(removed) {
    for (const session of removed) {
      this._sessionDisposables.deleteAndDispose(session.sessionId);
    }
  }
  _trackSession(session) {
    if (session.capabilities.get().runsWorktreeCreatedTasks) {
      return;
    }
    if (this._sessionDisposables.get(session.sessionId)) {
      return;
    }
    const store = new DisposableStore();
    this._sessionDisposables.set(session.sessionId, store);
    const taskHandles = store.add(new DisposableStore());
    registerAutorunSelfDisposable(store, (reader) => {
      if (session.loading.read(reader)) {
        return;
      }
      if (session.status.read(reader) === SessionStatus.Untitled) {
        return;
      }
      if (!session.workspace.read(reader)?.folders.some((folder) => !!folder.gitRepository?.workTreeUri)) {
        return;
      }
      reader.dispose();
      this._dispatchWorktreeCreatedTasks(session, taskHandles);
    });
    store.add(autorun((reader) => {
      if (session.isArchived.read(reader)) {
        taskHandles.clear();
      }
    }));
  }
  async _dispatchWorktreeCreatedTasks(session, taskHandles) {
    if (isAgentHostProviderId(session.providerId) && !this._configurationService.getValue(AGENT_HOST_RUN_WORKTREE_CREATED_TASKS_SETTING)) {
      this._logService.trace(`${LOG_PREFIX} Skipping worktreeCreated tasks for agent host session '${session.sessionId}' \u2014 '${AGENT_HOST_RUN_WORKTREE_CREATED_TASKS_SETTING}' is disabled.`);
      return;
    }
    let tasks;
    try {
      tasks = await this._sessionsTasksService.getSessionTasksOnce(session);
    } catch (err) {
      this._logService.warn(`${LOG_PREFIX} Failed to read tasks for session '${session.sessionId}': ${err}`);
      return;
    }
    for (const { task } of tasks) {
      if (task.runOptions?.runOn !== "worktreeCreated") {
        continue;
      }
      this._logService.trace(`${LOG_PREFIX} Running worktreeCreated task '${task.label}' for session '${session.sessionId}'`);
      try {
        const handle = await this._sessionsTasksService.runTask(task, session);
        if (handle) {
          if (session.isArchived.get()) {
            handle.dispose();
          } else {
            taskHandles.add(handle);
          }
        }
      } catch (err) {
        this._logService.warn(`${LOG_PREFIX} Failed to run task '${task.label}' for session '${session.sessionId}': ${err}`);
      }
    }
  }
};
WorktreeCreatedTaskDispatcher = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsTasksService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILogService)
], WorktreeCreatedTaskDispatcher);
export {
  AGENT_HOST_RUN_WORKTREE_CREATED_TASKS_SETTING,
  WorktreeCreatedTaskDispatcher
};
