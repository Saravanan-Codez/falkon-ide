import { localize } from "../../nls.js";
const LINUX_SYSTEM_POLICY_FILE_PATH = "/etc/vscode/policy.json";
var PolicyCategory = /* @__PURE__ */ ((PolicyCategory2) => {
  PolicyCategory2["Extensions"] = "Extensions";
  PolicyCategory2["IntegratedTerminal"] = "IntegratedTerminal";
  PolicyCategory2["InteractiveSession"] = "InteractiveSession";
  PolicyCategory2["Telemetry"] = "Telemetry";
  PolicyCategory2["Update"] = "Update";
  return PolicyCategory2;
})(PolicyCategory || {});
const PolicyCategoryData = {
  ["Extensions" /* Extensions */]: {
    name: {
      key: "extensionsConfigurationTitle",
      value: localize("extensionsConfigurationTitle", "Extensions")
    }
  },
  ["IntegratedTerminal" /* IntegratedTerminal */]: {
    name: {
      key: "terminalIntegratedConfigurationTitle",
      value: localize("terminalIntegratedConfigurationTitle", "Integrated Terminal")
    }
  },
  ["InteractiveSession" /* InteractiveSession */]: {
    name: {
      key: "interactiveSessionConfigurationTitle",
      value: localize("interactiveSessionConfigurationTitle", "Chat")
    }
  },
  ["Telemetry" /* Telemetry */]: {
    name: {
      key: "telemetryConfigurationTitle",
      value: localize("telemetryConfigurationTitle", "Telemetry")
    }
  },
  ["Update" /* Update */]: {
    name: {
      key: "updateConfigurationTitle",
      value: localize("updateConfigurationTitle", "Update")
    }
  }
};
export {
  LINUX_SYSTEM_POLICY_FILE_PATH,
  PolicyCategory,
  PolicyCategoryData
};
