import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
var ExplorerExtensions = /* @__PURE__ */ ((ExplorerExtensions2) => {
  ExplorerExtensions2["FileContributionRegistry"] = "workbench.registry.explorer.fileContributions";
  return ExplorerExtensions2;
})(ExplorerExtensions || {});
class ExplorerFileContributionRegistry extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidRegisterDescriptor = this._register(new Emitter());
    this.onDidRegisterDescriptor = this._onDidRegisterDescriptor.event;
    this.descriptors = [];
  }
  /** @inheritdoc */
  register(descriptor) {
    this.descriptors.push(descriptor);
    this._onDidRegisterDescriptor.fire(descriptor);
  }
  /**
   * Creates a new instance of all registered contributions.
   */
  create(insta, container, store) {
    return this.descriptors.map((d) => {
      const i = d.create(insta, container);
      store.add(i);
      return i;
    });
  }
}
const explorerFileContribRegistry = new ExplorerFileContributionRegistry();
Registry.add("workbench.registry.explorer.fileContributions" /* FileContributionRegistry */, explorerFileContribRegistry);
export {
  ExplorerExtensions,
  explorerFileContribRegistry
};
