import { OperatingSystem } from "../../../base/common/platform.js";
import { matchesTerminalSandboxCommandRule } from "./terminalSandboxCommandRules.js";
var TerminalSandboxRuntimeConfigurationOperation = /* @__PURE__ */ ((TerminalSandboxRuntimeConfigurationOperation2) => {
  TerminalSandboxRuntimeConfigurationOperation2["GnuPG"] = "gnupg";
  TerminalSandboxRuntimeConfigurationOperation2["Node"] = "node";
  return TerminalSandboxRuntimeConfigurationOperation2;
})(TerminalSandboxRuntimeConfigurationOperation || {});
const terminalSandboxRuntimeConfigurationCommandRules = [
  {
    keywords: ["node", "npm", "npx", "pnpm", "yarn", "corepack", "bun", "deno", "nvm", "volta", "fnm", "asdf", "mise"],
    value: "node" /* Node */
  },
  {
    keywords: ["git"],
    value: "gnupg" /* GnuPG */,
    condition: ({ os }) => os !== OperatingSystem.Windows
  }
];
function getTerminalSandboxRuntimeConfigurationForOperation(operation, os) {
  switch (operation) {
    case "gnupg" /* GnuPG */:
      switch (os) {
        case OperatingSystem.Windows:
          return {};
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return {
            network: {
              allowAllUnixSockets: true
            },
            filesystem: {
              allowRead: [
                "~/.gnupg"
              ],
              allowWrite: [
                "~/.gnupg"
              ]
            }
          };
      }
    case "node" /* Node */:
      switch (os) {
        case OperatingSystem.Windows:
          return {};
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return {
            filesystem: {
              allowWrite: [
                "~/.volta/"
              ]
            }
          };
      }
  }
}
function getTerminalSandboxRuntimeConfigurationForCommands(os, commandDetails) {
  const operations = /* @__PURE__ */ new Set();
  for (const command of commandDetails) {
    for (const rule of terminalSandboxRuntimeConfigurationCommandRules) {
      if (matchesTerminalSandboxCommandRule(command, rule, { os }) && shouldApplyRuntimeConfigurationOperation(rule.value, commandDetails)) {
        operations.add(rule.value);
      }
    }
  }
  const configuration = {};
  for (const operation of operations) {
    mergeAdditionalSandboxConfigProperties(configuration, getTerminalSandboxRuntimeConfigurationForOperation(operation, os));
  }
  return configuration;
}
function shouldApplyRuntimeConfigurationOperation(operation, commandDetails) {
  switch (operation) {
    case "gnupg" /* GnuPG */:
      return commandDetails.every((command) => !command.keyword.toLowerCase().startsWith("docker"));
    case "node" /* Node */:
      return true;
  }
}
function mergeAdditionalSandboxConfigProperties(target, additional) {
  for (const [key, value] of Object.entries(additional)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = value;
      continue;
    }
    const existingValue = target[key];
    if (Array.isArray(existingValue) && Array.isArray(value)) {
      target[key] = [.../* @__PURE__ */ new Set([...existingValue, ...value])];
      continue;
    }
    if (isObjectForSandboxConfigMerge(existingValue) && isObjectForSandboxConfigMerge(value)) {
      mergeAdditionalSandboxConfigProperties(existingValue, value);
    }
  }
}
function isObjectForSandboxConfigMerge(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export {
  TerminalSandboxRuntimeConfigurationOperation,
  getTerminalSandboxRuntimeConfigurationForCommands
};
