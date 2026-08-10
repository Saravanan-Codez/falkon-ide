import { createDecorator } from "../../instantiation/common/instantiation.js";
const GitHubPaths = {
  copilotSettings: "settings/copilot/features",
  billingBudgets: "settings/copilot/features?utm_source=vscode",
  copilotUpgrade: "github-copilot/upgrade?utm_source=vscode"
};
const IDefaultAccountService = createDecorator("defaultAccountService");
export {
  GitHubPaths,
  IDefaultAccountService
};
