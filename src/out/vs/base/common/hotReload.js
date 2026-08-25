let _isHotReloadEnabled = false;
function enableHotReload() {
  _isHotReloadEnabled = true;
}
function isHotReloadEnabled() {
  return _isHotReloadEnabled;
}
function registerHotReloadHandler(handler) {
  if (!isHotReloadEnabled()) {
    return { dispose() {
    } };
  } else {
    const handlers = registerGlobalHotReloadHandler();
    handlers.add(handler);
    return {
      dispose() {
        handlers.delete(handler);
      }
    };
  }
}
function registerGlobalHotReloadHandler() {
  if (!hotReloadHandlers) {
    hotReloadHandlers = /* @__PURE__ */ new Set();
  }
  const g = globalThis;
  if (!g.$hotReload_applyNewExports) {
    g.$hotReload_applyNewExports = (args) => {
      const args2 = { config: { mode: void 0 }, ...args };
      const results = [];
      for (const h of hotReloadHandlers) {
        const result = h(args2);
        if (result) {
          results.push(result);
        }
      }
      if (results.length > 0) {
        return (newExports) => {
          let result = false;
          for (const r of results) {
            if (r(newExports)) {
              result = true;
            }
          }
          return result;
        };
      }
      return void 0;
    };
  }
  return hotReloadHandlers;
}
let hotReloadHandlers = void 0;
if (isHotReloadEnabled()) {
  registerHotReloadHandler(({ oldExports, newSrc, config }) => {
    if (config.mode !== "patch-prototype") {
      return void 0;
    }
    return (newExports) => {
      for (const key in newExports) {
        const exportedItem = newExports[key];
        console.log(`[hot-reload] Patching prototype methods of '${key}'`, { exportedItem });
        if (typeof exportedItem === "function" && exportedItem.prototype) {
          const oldExportedItem = oldExports[key];
          if (oldExportedItem) {
            for (const prop of Object.getOwnPropertyNames(exportedItem.prototype)) {
              const descriptor = Object.getOwnPropertyDescriptor(exportedItem.prototype, prop);
              const oldDescriptor = Object.getOwnPropertyDescriptor(oldExportedItem.prototype, prop);
              if (descriptor?.value?.toString() !== oldDescriptor?.value?.toString()) {
                console.log(`[hot-reload] Patching prototype method '${key}.${prop}'`);
              }
              Object.defineProperty(oldExportedItem.prototype, prop, descriptor);
            }
            newExports[key] = oldExportedItem;
          }
        }
      }
      return true;
    };
  });
}
export {
  enableHotReload,
  isHotReloadEnabled,
  registerHotReloadHandler
};
