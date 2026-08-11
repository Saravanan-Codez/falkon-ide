import { SyncDescriptor } from "./descriptors.js";
const _registry = [];
var InstantiationType = /* @__PURE__ */ ((InstantiationType2) => {
  InstantiationType2[InstantiationType2["Eager"] = 0] = "Eager";
  InstantiationType2[InstantiationType2["Delayed"] = 1] = "Delayed";
  return InstantiationType2;
})(InstantiationType || {});
function registerSingleton(id, ctorOrDescriptor, supportsDelayedInstantiation) {
  if (!(ctorOrDescriptor instanceof SyncDescriptor)) {
    ctorOrDescriptor = new SyncDescriptor(ctorOrDescriptor, [], Boolean(supportsDelayedInstantiation));
  }
  _registry.push([id, ctorOrDescriptor]);
}
function getSingletonServiceDescriptors() {
  return _registry;
}
export {
  InstantiationType,
  getSingletonServiceDescriptors,
  registerSingleton
};
