import { ActionType } from "../../common/state/protocol/common/actions.js";
class AgentServerToolHost {
  constructor(_stateManager, groups) {
    this._stateManager = _stateManager;
    this._groupByToolName = /* @__PURE__ */ new Map();
    for (const group of groups) {
      for (const def of group.definitions) {
        if (this._groupByToolName.has(def.name)) {
          throw new Error(`Duplicate server tool registered: ${def.name}`);
        }
        this._groupByToolName.set(def.name, group);
      }
    }
    this.definitions = groups.flatMap((group) => group.definitions);
    this.toolNames = this.definitions.map((def) => def.name);
  }
  advertise(sessionUri) {
    this._stateManager.dispatchServerAction(sessionUri, {
      type: ActionType.SessionServerToolsChanged,
      tools: [...this.definitions]
    });
  }
  canRequireConfirmation(toolName) {
    return this._groupByToolName.get(toolName)?.canRequireConfirmation?.(toolName) ?? false;
  }
  requiresConfirmation(sessionUri, toolName) {
    const group = this._groupByToolName.get(toolName);
    return group?.requiresConfirmation?.(this._stateManager, sessionUri, toolName) ?? group?.canRequireConfirmation?.(toolName) ?? false;
  }
  executeTool(sessionUri, toolName, rawArgs) {
    const group = this._groupByToolName.get(toolName);
    if (!group) {
      throw new Error(`Unknown server tool: ${toolName}`);
    }
    return group.execute(this._stateManager, sessionUri, toolName, rawArgs);
  }
}
export {
  AgentServerToolHost
};
