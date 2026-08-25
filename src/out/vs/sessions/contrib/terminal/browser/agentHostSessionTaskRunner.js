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
import { localize } from "../../../../nls.js";
import { Schemas } from "../../../../base/common/network.js";
import { OS } from "../../../../base/common/platform.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AGENT_HOST_SCHEME, fromAgentHostUri } from "../../../../platform/agentHost/common/agentHostUri.js";
import { TerminalExitReason } from "../../../../platform/terminal/common/terminal.js";
import { IAgentHostTerminalService } from "../../../../workbench/contrib/terminal/browser/agentHostTerminalService.js";
import { ITerminalGroupService, ITerminalService } from "../../../../workbench/contrib/terminal/browser/terminal.js";
import { isAgentHostProvider } from "../../../common/agentHostSessionsProvider.js";
import { osToTaskTargetOS, resolveTaskCommand } from "../../chat/browser/taskCommand.js";
import { ISessionsTasksService } from "../../chat/browser/sessionsTasksService.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { IConfigurationResolverService } from "../../../../workbench/services/configurationResolver/common/configurationResolver.js";
import { basename } from "../../../../base/common/resources.js";
const LOG_PREFIX = "[AgentHostSessionTaskRunner]";
const LOCAL_AGENT_HOST_ADDRESS = "__local__";
let AgentHostSessionTaskRunner = class {
  constructor(_agentHostTerminalService, _sessionsProvidersService, _sessionsTasksService, _configurationResolverService, _terminalService, _terminalGroupService, _logService) {
    this._agentHostTerminalService = _agentHostTerminalService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._sessionsTasksService = _sessionsTasksService;
    this._configurationResolverService = _configurationResolverService;
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._logService = _logService;
    this.id = "agentHost";
    this.priority = 100;
  }
  canRun(session) {
    return this._getAddress(session) !== void 0;
  }
  async runTask(task, session) {
    const address = this._getAddress(session);
    if (!address) {
      return void 0;
    }
    const allTasks = await this._sessionsTasksService.getAllTasks(session);
    const byLabel = /* @__PURE__ */ new Map();
    for (const entry of allTasks) {
      byLabel.set(entry.task.label, entry.task);
    }
    const cwd = this._getCwd(session);
    const command = await resolveTaskCommand(task, {
      // Local host shares the renderer's OS, so use it to pick OS-specific
      // overrides; remote host OS is unknown, so fall back to the default.
      targetOS: address === LOCAL_AGENT_HOST_ADDRESS ? osToTaskTargetOS(OS) : void 0,
      lookup: (label) => byLabel.get(label),
      resolveVariables: this._createVariableResolver(address, cwd)
    });
    if (!command) {
      this._logService.trace(`${LOG_PREFIX} Skipping task '${task.label}' \u2014 no command could be resolved.`);
      return void 0;
    }
    const instance = await this._agentHostTerminalService.createTerminalForEntry(address, {
      cwd,
      name: localize("agentHostSessionTaskTerminalName", "Task: {0}", task.label)
    });
    if (!instance) {
      this._logService.warn(`${LOG_PREFIX} Failed to create terminal for task '${task.label}' on '${address}'.`);
      return void 0;
    }
    this._terminalService.setActiveInstance(instance);
    await this._terminalGroupService.showPanel(true);
    await instance.sendText(
      command,
      /*shouldExecute*/
      true
    );
    return toDisposable(() => {
      instance.dispose(TerminalExitReason.User);
    });
  }
  _getAddress(session) {
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return void 0;
    }
    return provider.remoteAddress ?? LOCAL_AGENT_HOST_ADDRESS;
  }
  _getCwd(session) {
    const folder = session.workspace.get()?.folders[0];
    const cwd = folder?.workingDirectory ?? folder?.root;
    if (!cwd) {
      return void 0;
    }
    if (cwd.scheme === AGENT_HOST_SCHEME) {
      return fromAgentHostUri(cwd);
    }
    if (cwd.scheme === Schemas.file) {
      return cwd;
    }
    return void 0;
  }
  /**
   * Builds the `${workspaceFolder}` resolver for a task, or `undefined` when
   * there is no working directory. Remote hosts only get a literal
   * `${workspaceFolder}` substitution (their OS may differ from the
   * renderer's); local hosts use the full resolver.
   */
  _createVariableResolver(address, cwd) {
    if (!cwd) {
      return void 0;
    }
    if (address !== LOCAL_AGENT_HOST_ADDRESS) {
      return (value) => Promise.resolve(value.replaceAll("${workspaceFolder}", cwd.path));
    }
    return async (value) => {
      try {
        return await this._configurationResolverService.resolveAsync(this._toFolderData(cwd), value);
      } catch {
        return value;
      }
    };
  }
  _toFolderData(cwd) {
    return { uri: cwd, name: basename(cwd), index: 0 };
  }
};
AgentHostSessionTaskRunner = __decorateClass([
  __decorateParam(0, IAgentHostTerminalService),
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, ISessionsTasksService),
  __decorateParam(3, IConfigurationResolverService),
  __decorateParam(4, ITerminalService),
  __decorateParam(5, ITerminalGroupService),
  __decorateParam(6, ILogService)
], AgentHostSessionTaskRunner);
export {
  AgentHostSessionTaskRunner
};
