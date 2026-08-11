import { Registry } from "../../../../platform/registry/common/platform.js";
function registerTerminalContribution(id, ctor, canRunInDetachedTerminals = false) {
  TerminalContributionRegistry.INSTANCE.registerTerminalContribution({ id, ctor, canRunInDetachedTerminals });
}
var TerminalExtensionsRegistry;
((TerminalExtensionsRegistry2) => {
  function getTerminalContributions() {
    return TerminalContributionRegistry.INSTANCE.getTerminalContributions();
  }
  TerminalExtensionsRegistry2.getTerminalContributions = getTerminalContributions;
})(TerminalExtensionsRegistry || (TerminalExtensionsRegistry = {}));
class TerminalContributionRegistry {
  constructor() {
    this._terminalContributions = [];
  }
  static {
    this.INSTANCE = new TerminalContributionRegistry();
  }
  registerTerminalContribution(description) {
    this._terminalContributions.push(description);
  }
  getTerminalContributions() {
    return this._terminalContributions.slice(0);
  }
}
var Extensions = /* @__PURE__ */ ((Extensions2) => {
  Extensions2["TerminalContributions"] = "terminal.contributions";
  return Extensions2;
})(Extensions || {});
Registry.add("terminal.contributions" /* TerminalContributions */, TerminalContributionRegistry.INSTANCE);
export {
  TerminalExtensionsRegistry,
  registerTerminalContribution
};
