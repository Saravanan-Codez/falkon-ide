import { Emitter } from "../../../../base/common/event.js";
class OnboardingScenarioRegistry {
  constructor() {
    this._scenarios = /* @__PURE__ */ new Map();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  register(scenario) {
    const id = scenario.id;
    if (this._scenarios.has(id)) {
      throw new Error(`An onboarding scenario with id '${id}' is already registered.`);
    }
    this._scenarios.set(id, scenario);
    this._onDidChange.fire();
    return {
      dispose: () => {
        if (this._scenarios.get(id) === scenario) {
          this._scenarios.delete(id);
          this._onDidChange.fire();
        }
      }
    };
  }
  getScenarios() {
    return Array.from(this._scenarios.values());
  }
  getScenario(id) {
    return this._scenarios.get(id);
  }
}
const onboardingScenarioRegistry = new OnboardingScenarioRegistry();
export {
  onboardingScenarioRegistry
};
