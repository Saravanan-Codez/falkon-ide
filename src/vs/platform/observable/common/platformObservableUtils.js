import { DisposableStore } from "../../../base/common/lifecycle.js";
import { DebugLocation, derivedOpts, observableFromEvent, observableFromEventOpts } from "../../../base/common/observable.js";
function observableConfigValue(key, defaultValue, configurationService, debugLocation = DebugLocation.ofCaller()) {
  return observableFromEventOpts(
    { debugName: () => `Configuration Key "${key}"` },
    (handleChange) => configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(key)) {
        handleChange(e);
      }
    }),
    () => configurationService.getValue(key) ?? defaultValue,
    debugLocation
  );
}
function bindContextKey(key, service, computeValue, debugLocation = DebugLocation.ofCaller()) {
  const boundKey = key.bindTo(service);
  const store = new DisposableStore();
  derivedOpts({ debugName: () => `Set Context Key "${key.key}"` }, (reader) => {
    const value = computeValue(reader);
    boundKey.set(value);
    return value;
  }, debugLocation).recomputeInitiallyAndOnChange(store);
  return store;
}
function observableContextKey(key, contextKeyService, debugLocation = DebugLocation.ofCaller()) {
  return observableFromEvent(void 0, contextKeyService.onDidChangeContext, () => contextKeyService.getContextKeyValue(key), debugLocation);
}
export {
  bindContextKey,
  observableConfigValue,
  observableContextKey
};
