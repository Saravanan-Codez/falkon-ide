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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { IAgentHostTerminalService } from "../../../../../workbench/contrib/terminal/browser/agentHostTerminalService.js";
let RemoteAgentHostTerminalContribution = class extends Disposable {
  constructor(_remoteAgentHostService, _agentHostTerminalService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._agentHostTerminalService = _agentHostTerminalService;
    this._remoteEntries = this._register(new DisposableMap());
    this._register(this._remoteAgentHostService.onDidChangeConnections(() => this._reconcileRemote()));
    this._reconcileRemote();
  }
  _reconcileRemote() {
    const connectedAddresses = /* @__PURE__ */ new Set();
    for (const info of this._remoteAgentHostService.connections) {
      if (!RemoteAgentHostConnectionStatus.isConnected(info.status)) {
        continue;
      }
      const connection = this._remoteAgentHostService.getConnection(info.address);
      if (!connection) {
        continue;
      }
      connectedAddresses.add(info.address);
      if (!this._remoteEntries.has(info.address)) {
        this._remoteEntries.set(info.address, this._agentHostTerminalService.registerEntry({
          name: info.name || info.address,
          address: info.address,
          getConnection: () => connection
        }));
      }
    }
    for (const address of this._remoteEntries.keys()) {
      if (!connectedAddresses.has(address)) {
        this._remoteEntries.deleteAndDispose(address);
      }
    }
  }
};
RemoteAgentHostTerminalContribution = __decorateClass([
  __decorateParam(0, IRemoteAgentHostService),
  __decorateParam(1, IAgentHostTerminalService)
], RemoteAgentHostTerminalContribution);
registerWorkbenchContribution2("workbench.contrib.remoteAgentHostTerminal", RemoteAgentHostTerminalContribution, WorkbenchPhase.AfterRestored);
