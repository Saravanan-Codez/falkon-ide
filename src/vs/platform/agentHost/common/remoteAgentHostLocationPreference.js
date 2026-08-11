import { createDecorator } from "../../instantiation/common/instantiation.js";
function isRemoteAgentHostLocationPreference(value) {
  return value === "dedicated" || value === "editor";
}
const IRemoteAgentHostLocationPreferenceService = createDecorator("remoteAgentHostLocationPreferenceService");
export {
  IRemoteAgentHostLocationPreferenceService,
  isRemoteAgentHostLocationPreference
};
