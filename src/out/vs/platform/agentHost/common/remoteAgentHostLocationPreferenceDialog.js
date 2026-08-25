import { Codicon } from "../../../base/common/codicons.js";
import { createMarkdownCommandLink, MarkdownString } from "../../../base/common/htmlContent.js";
import Severity from "../../../base/common/severity.js";
import { localize } from "../../../nls.js";
const ChangeRemoteAgentHostLocationPreferenceCommandId = "workbench.action.sessions.changeRemoteAgentHostLocationPreference";
function withCurrentPreferenceMarker(detail, preference, currentPreference) {
  return preference === currentPreference ? detail + localize("remoteAgentHostLocation.current", " (Current)") : detail;
}
function remoteAgentHostLocationOptions(productName, currentPreference) {
  return [
    {
      preference: "dedicated",
      label: localize("remoteAgentHostLocation.dedicated", "Keep My Agents Running in a Dedicated Process"),
      detail: withCurrentPreferenceMarker(localize("remoteAgentHostLocation.dedicated.detail", "Agents continue after you close {0} and stop when their work finishes.", productName), "dedicated", currentPreference)
    },
    {
      preference: "editor",
      label: localize("remoteAgentHostLocation.editor", "Stop My Agents if I Close {0}", productName),
      detail: withCurrentPreferenceMarker(localize("remoteAgentHostLocation.editor.detail", "Agents are available only while the remote {0} window is open.", productName), "editor", currentPreference)
    }
  ];
}
function orderRemoteAgentHostLocationOptions(productName, currentPreference) {
  const options = remoteAgentHostLocationOptions(productName, currentPreference);
  const current = options.find((option) => option.preference === currentPreference);
  if (!current) {
    return options;
  }
  return [current, ...options.filter((option) => option !== current)];
}
async function promptRemoteAgentHostLocationPreference(dialogService, hostLabel, productName, currentPreference, token) {
  const options = orderRemoteAgentHostLocationOptions(productName, currentPreference);
  const changeCommandLabel = localize("remoteAgentHostLocation.changeCommandLabel", "Chat: Change Preferred Remote Agent Location");
  const changeCommandLink = createMarkdownCommandLink({
    text: changeCommandLabel,
    id: ChangeRemoteAgentHostLocationPreferenceCommandId,
    tooltip: changeCommandLabel
  });
  const { result } = await dialogService.prompt({
    type: Severity.Info,
    message: localize("remoteAgentHostLocation.message", "How long should agents keep running on {0}?", hostLabel),
    detail: new MarkdownString(
      localize("remoteAgentHostLocation.reminder", "You can change this later with the **{0}** command.", changeCommandLink),
      { isTrusted: { enabledCommands: [ChangeRemoteAgentHostLocationPreferenceCommandId] } }
    ),
    cancelButton: true,
    buttons: options.map((option) => ({
      label: option.label,
      run: () => option.preference
    })),
    custom: {
      icon: Codicon.remote,
      buttonDetails: options.map((option) => option.detail),
      // Full-width stacked buttons read better for these longer,
      // descriptive two-choice options than the default side-by-side layout.
      alignment: "vertical"
    },
    token
  });
  return result;
}
export {
  ChangeRemoteAgentHostLocationPreferenceCommandId,
  orderRemoteAgentHostLocationOptions,
  promptRemoteAgentHostLocationPreference
};
