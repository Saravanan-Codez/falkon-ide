import { Codicon } from "../../../../../base/common/codicons.js";
function getAgentHostModeIcon(value) {
  switch (value) {
    case "plan":
      return Codicon.checklist;
    case "autopilot":
      return Codicon.rocket;
    case "interactive":
      return Codicon.comment;
    default:
      return void 0;
  }
}
export {
  getAgentHostModeIcon
};
