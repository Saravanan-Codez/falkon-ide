import { join } from "../../../base/common/path.js";
function getCopilotHomePath(userHomePath, environment) {
  return environment["COPILOT_HOME"] || join(userHomePath, ".copilot");
}
function getCopilotRootPaths(userHomePath, environment) {
  return [.../* @__PURE__ */ new Set([
    getCopilotHomePath(userHomePath, environment),
    join(userHomePath, ".copilot")
  ])];
}
export {
  getCopilotHomePath,
  getCopilotRootPaths
};
