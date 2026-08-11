import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
var Extensions;
((Extensions2) => {
  Extensions2.ExtensionFeaturesRegistry = "workbench.registry.extensionFeatures";
})(Extensions || (Extensions = {}));
const IExtensionFeaturesManagementService = createDecorator("IExtensionFeaturesManagementService");
class ExtensionFeaturesRegistry {
  constructor() {
    this.extensionFeatures = /* @__PURE__ */ new Map();
  }
  registerExtensionFeature(descriptor) {
    if (this.extensionFeatures.has(descriptor.id)) {
      throw new Error(`Extension feature with id '${descriptor.id}' already exists`);
    }
    this.extensionFeatures.set(descriptor.id, descriptor);
    return {
      dispose: () => this.extensionFeatures.delete(descriptor.id)
    };
  }
  getExtensionFeature(id) {
    return this.extensionFeatures.get(id);
  }
  getExtensionFeatures() {
    return Array.from(this.extensionFeatures.values());
  }
}
Registry.add(Extensions.ExtensionFeaturesRegistry, new ExtensionFeaturesRegistry());
export {
  Extensions,
  IExtensionFeaturesManagementService
};
