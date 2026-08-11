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
import { TerminalCommandId } from "../common/terminal.js";
import { ITerminalService } from "./terminal.js";
import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { TerminalStatus } from "./terminalStatusList.js";
import Severity from "../../../../base/common/severity.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
let EnvironmentVariableInfoStale = class {
  constructor(_diff, _terminalId, _collection, _terminalService, _extensionService) {
    this._diff = _diff;
    this._terminalId = _terminalId;
    this._collection = _collection;
    this._terminalService = _terminalService;
    this._extensionService = _extensionService;
    this.requiresAction = true;
  }
  _getInfo(scope) {
    const extSet = /* @__PURE__ */ new Set();
    addExtensionIdentifiers(extSet, this._diff.added.values());
    addExtensionIdentifiers(extSet, this._diff.removed.values());
    addExtensionIdentifiers(extSet, this._diff.changed.values());
    let message = localize("extensionEnvironmentContributionInfoStale", "The following extensions want to relaunch the terminal to contribute to its environment:");
    message += getMergedDescription(this._collection, scope, this._extensionService, extSet);
    return message;
  }
  _getActions() {
    return [{
      label: localize("relaunchTerminalLabel", "Relaunch Terminal"),
      run: () => this._terminalService.getInstanceFromId(this._terminalId)?.relaunch(),
      commandId: TerminalCommandId.Relaunch
    }];
  }
  getStatus(scope) {
    return {
      id: TerminalStatus.RelaunchNeeded,
      severity: Severity.Warning,
      icon: Codicon.warning,
      tooltip: this._getInfo(scope),
      hoverActions: this._getActions()
    };
  }
};
EnvironmentVariableInfoStale = __decorateClass([
  __decorateParam(3, ITerminalService),
  __decorateParam(4, IExtensionService)
], EnvironmentVariableInfoStale);
let EnvironmentVariableInfoChangesActive = class {
  constructor(_collection, _commandService, _extensionService) {
    this._collection = _collection;
    this._commandService = _commandService;
    this._extensionService = _extensionService;
    this.requiresAction = false;
  }
  _getInfo(scope) {
    const extSet = /* @__PURE__ */ new Set();
    addExtensionIdentifiers(extSet, this._collection.getVariableMap(scope).values());
    let message = localize("extensionEnvironmentContributionInfoActive", "The following extensions have contributed to this terminal's environment:");
    message += getMergedDescription(this._collection, scope, this._extensionService, extSet);
    return message;
  }
  _getActions(scope) {
    return [{
      label: localize("showEnvironmentContributions", "Show Environment Contributions"),
      run: () => this._commandService.executeCommand(TerminalCommandId.ShowEnvironmentContributions, scope),
      commandId: TerminalCommandId.ShowEnvironmentContributions
    }];
  }
  getStatus(scope) {
    return {
      id: TerminalStatus.EnvironmentVariableInfoChangesActive,
      severity: Severity.Info,
      tooltip: void 0,
      // The action is present when details aren't shown
      detailedTooltip: this._getInfo(scope),
      hoverActions: this._getActions(scope)
    };
  }
};
EnvironmentVariableInfoChangesActive = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IExtensionService)
], EnvironmentVariableInfoChangesActive);
function getMergedDescription(collection, scope, extensionService, extSet) {
  const message = ["\n"];
  const globalDescriptions = collection.getDescriptionMap(void 0);
  const workspaceDescriptions = collection.getDescriptionMap(scope);
  for (const ext of extSet) {
    const globalDescription = globalDescriptions.get(ext);
    if (globalDescription) {
      message.push(`
- \`${getExtensionName(ext, extensionService)}\``);
      message.push(`: ${globalDescription}`);
    }
    const workspaceDescription = workspaceDescriptions.get(ext);
    if (workspaceDescription) {
      const workspaceSuffix = globalDescription ? ` (${localize("ScopedEnvironmentContributionInfo", "workspace")})` : "";
      message.push(`
- \`${getExtensionName(ext, extensionService)}${workspaceSuffix}\``);
      message.push(`: ${workspaceDescription}`);
    }
    if (!globalDescription && !workspaceDescription) {
      message.push(`
- \`${getExtensionName(ext, extensionService)}\``);
    }
  }
  return message.join("");
}
function addExtensionIdentifiers(extSet, diff) {
  for (const mutators of diff) {
    for (const mutator of mutators) {
      extSet.add(mutator.extensionIdentifier);
    }
  }
}
function getExtensionName(id, extensionService) {
  return extensionService.extensions.find((e) => e.id === id)?.displayName || id;
}
export {
  EnvironmentVariableInfoChangesActive,
  EnvironmentVariableInfoStale
};
