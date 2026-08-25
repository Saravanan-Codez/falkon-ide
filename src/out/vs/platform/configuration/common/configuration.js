import { assertNever } from "../../../base/common/assert.js";
import * as types from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IConfigurationService = createDecorator("configurationService");
function isConfigurationOverrides(obj) {
  const thing = obj;
  return thing && typeof thing === "object" && (!thing.overrideIdentifier || typeof thing.overrideIdentifier === "string") && (!thing.resource || thing.resource instanceof URI);
}
function isConfigurationUpdateOverrides(obj) {
  const thing = obj;
  return thing && typeof thing === "object" && (!thing.overrideIdentifiers || Array.isArray(thing.overrideIdentifiers)) && !thing.overrideIdentifier && (!thing.resource || thing.resource instanceof URI);
}
var ConfigurationTarget = /* @__PURE__ */ ((ConfigurationTarget2) => {
  ConfigurationTarget2[ConfigurationTarget2["APPLICATION"] = 1] = "APPLICATION";
  ConfigurationTarget2[ConfigurationTarget2["USER"] = 2] = "USER";
  ConfigurationTarget2[ConfigurationTarget2["USER_LOCAL"] = 3] = "USER_LOCAL";
  ConfigurationTarget2[ConfigurationTarget2["USER_REMOTE"] = 4] = "USER_REMOTE";
  ConfigurationTarget2[ConfigurationTarget2["WORKSPACE"] = 5] = "WORKSPACE";
  ConfigurationTarget2[ConfigurationTarget2["WORKSPACE_FOLDER"] = 6] = "WORKSPACE_FOLDER";
  ConfigurationTarget2[ConfigurationTarget2["DEFAULT"] = 7] = "DEFAULT";
  ConfigurationTarget2[ConfigurationTarget2["MEMORY"] = 8] = "MEMORY";
  return ConfigurationTarget2;
})(ConfigurationTarget || {});
function ConfigurationTargetToString(configurationTarget) {
  switch (configurationTarget) {
    case 1 /* APPLICATION */:
      return "APPLICATION";
    case 2 /* USER */:
      return "USER";
    case 3 /* USER_LOCAL */:
      return "USER_LOCAL";
    case 4 /* USER_REMOTE */:
      return "USER_REMOTE";
    case 5 /* WORKSPACE */:
      return "WORKSPACE";
    case 6 /* WORKSPACE_FOLDER */:
      return "WORKSPACE_FOLDER";
    case 7 /* DEFAULT */:
      return "DEFAULT";
    case 8 /* MEMORY */:
      return "MEMORY";
  }
}
function getConfigValueInTarget(configValue, scope) {
  switch (scope) {
    case 1 /* APPLICATION */:
      return configValue.applicationValue;
    case 2 /* USER */:
      return configValue.userValue;
    case 3 /* USER_LOCAL */:
      return configValue.userLocalValue;
    case 4 /* USER_REMOTE */:
      return configValue.userRemoteValue;
    case 5 /* WORKSPACE */:
      return configValue.workspaceValue;
    case 6 /* WORKSPACE_FOLDER */:
      return configValue.workspaceFolderValue;
    case 7 /* DEFAULT */:
      return configValue.defaultValue;
    case 8 /* MEMORY */:
      return configValue.memoryValue;
    default:
      assertNever(scope);
  }
}
function isConfigured(configValue) {
  return configValue.applicationValue !== void 0 || configValue.userValue !== void 0 || configValue.userLocalValue !== void 0 || configValue.userRemoteValue !== void 0 || configValue.workspaceValue !== void 0 || configValue.workspaceFolderValue !== void 0;
}
function toValuesTree(properties, conflictReporter) {
  const root = /* @__PURE__ */ Object.create(null);
  for (const key in properties) {
    addToValueTree(root, key, properties[key], conflictReporter);
  }
  return root;
}
function addToValueTree(settingsTreeRoot, key, value, conflictReporter) {
  const segments = key.split(".");
  const last = segments.pop();
  let curr = settingsTreeRoot;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    let obj = curr[s];
    switch (typeof obj) {
      case "undefined":
        obj = curr[s] = /* @__PURE__ */ Object.create(null);
        break;
      case "object":
        if (obj === null) {
          conflictReporter(`Ignoring ${key} as ${segments.slice(0, i + 1).join(".")} is null`);
          return;
        }
        break;
      default:
        conflictReporter(`Ignoring ${key} as ${segments.slice(0, i + 1).join(".")} is ${JSON.stringify(obj)}`);
        return;
    }
    curr = obj;
  }
  if (typeof curr === "object" && curr !== null) {
    try {
      curr[last] = value;
    } catch (e) {
      conflictReporter(`Ignoring ${key} as ${segments.join(".")} is ${JSON.stringify(curr)}`);
    }
  } else {
    conflictReporter(`Ignoring ${key} as ${segments.join(".")} is ${JSON.stringify(curr)}`);
  }
}
function removeFromValueTree(valueTree, key) {
  const segments = key.split(".");
  doRemoveFromValueTree(valueTree, segments);
}
function doRemoveFromValueTree(valueTree, segments) {
  if (!valueTree) {
    return;
  }
  const valueTreeRecord = valueTree;
  const first = segments.shift();
  if (segments.length === 0) {
    delete valueTreeRecord[first];
    return;
  }
  if (Object.keys(valueTreeRecord).indexOf(first) !== -1) {
    const value = valueTreeRecord[first];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      doRemoveFromValueTree(value, segments);
      if (Object.keys(value).length === 0) {
        delete valueTreeRecord[first];
      }
    }
  }
}
function getConfigurationValue(config, settingPath, defaultValue) {
  function accessSetting(config2, path2) {
    let current = config2;
    for (const component of path2) {
      if (typeof current !== "object" || current === null) {
        return void 0;
      }
      current = current[component];
    }
    return current;
  }
  const path = settingPath.split(".");
  const result = accessSetting(config, path);
  return typeof result === "undefined" ? defaultValue : result;
}
function merge(base, add, overwrite) {
  Object.keys(add).forEach((key) => {
    if (key !== "__proto__") {
      if (key in base) {
        if (types.isObject(base[key]) && types.isObject(add[key])) {
          merge(base[key], add[key], overwrite);
        } else if (overwrite) {
          base[key] = add[key];
        }
      } else {
        base[key] = add[key];
      }
    }
  });
}
function getLanguageTagSettingPlainKey(settingKey) {
  return settingKey.replace(/^\[/, "").replace(/]$/g, "").replace(/\]\[/g, ", ");
}
export {
  ConfigurationTarget,
  ConfigurationTargetToString,
  IConfigurationService,
  addToValueTree,
  getConfigValueInTarget,
  getConfigurationValue,
  getLanguageTagSettingPlainKey,
  isConfigurationOverrides,
  isConfigurationUpdateOverrides,
  isConfigured,
  merge,
  removeFromValueTree,
  toValuesTree
};
