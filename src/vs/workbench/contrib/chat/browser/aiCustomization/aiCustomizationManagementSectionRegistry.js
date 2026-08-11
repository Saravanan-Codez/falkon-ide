import { toDisposable } from "../../../../../base/common/lifecycle.js";
class AICustomizationManagementSectionRegistry {
  constructor() {
    this.contributions = /* @__PURE__ */ new Map();
  }
  register(contribution) {
    const contributions = this.contributions.get(contribution.id) ?? [];
    contributions.push(contribution);
    this.contributions.set(contribution.id, contributions);
    return toDisposable(() => {
      const index = contributions.indexOf(contribution);
      if (index !== -1) {
        contributions.splice(index, 1);
      }
      if (contributions.length === 0) {
        this.contributions.delete(contribution.id);
      }
    });
  }
  has(id) {
    return this.contributions.has(id);
  }
  getDefault(id) {
    return this.contributions.get(id)?.[0];
  }
  get(id, harnessId) {
    return this.contributions.get(id)?.find((contribution) => contribution.supportsHarness(harnessId));
  }
}
const aiCustomizationManagementSectionRegistry = new AICustomizationManagementSectionRegistry();
export {
  aiCustomizationManagementSectionRegistry
};
