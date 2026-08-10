import { Disposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
var Extensions;
((Extensions2) => {
  Extensions2.PreferencesEditorPane = "workbench.registry.preferences.editorPanes";
})(Extensions || (Extensions = {}));
class PreferencesEditorPaneRegistryImpl extends Disposable {
  constructor() {
    super();
    this.descriptors = /* @__PURE__ */ new Map();
    this._onDidRegisterPreferencesEditorPanes = this._register(new Emitter());
    this.onDidRegisterPreferencesEditorPanes = this._onDidRegisterPreferencesEditorPanes.event;
    this._onDidDeregisterPreferencesEditorPanes = this._register(new Emitter());
    this.onDidDeregisterPreferencesEditorPanes = this._onDidDeregisterPreferencesEditorPanes.event;
  }
  registerPreferencesEditorPane(descriptor) {
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(`PreferencesEditorPane with id ${descriptor.id} already registered`);
    }
    this.descriptors.set(descriptor.id, descriptor);
    this._onDidRegisterPreferencesEditorPanes.fire([descriptor]);
    return {
      dispose: () => {
        if (this.descriptors.delete(descriptor.id)) {
          this._onDidDeregisterPreferencesEditorPanes.fire([descriptor]);
        }
      }
    };
  }
  getPreferencesEditorPanes() {
    return [...this.descriptors.values()].sort((a, b) => a.order - b.order);
  }
}
Registry.add(Extensions.PreferencesEditorPane, new PreferencesEditorPaneRegistryImpl());
export {
  Extensions
};
