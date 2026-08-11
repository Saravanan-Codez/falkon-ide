import { $, addDisposableListener } from "../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID } from "../../common/constants.js";
import { AgentsWindowOpenSource } from "../../../../../platform/window/common/window.js";
function canShowAgentsBanner(chatEntitlementService) {
  const sentiment = chatEntitlementService.sentiment;
  if (sentiment.hidden || sentiment.disabled) {
    return false;
  }
  return !!CommandsRegistry.getCommand(OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID);
}
function createAgentsBanner(options, commandService, telemetryService) {
  const disposables = new DisposableStore();
  const label = options.label ?? localize("agentsBanner.tryAgentsAppLabel", "Try out the new Agents window");
  const button = $(
    "button.agents-banner-button",
    {
      title: label
    },
    $(".codicon.codicon-agent.icon-widget"),
    $("span.category-title", {}, label)
  );
  disposables.add(addDisposableListener(button, "click", () => {
    options.onButtonClick?.();
    telemetryService.publicLog2("agentsBanner.clicked", { source: options.source, action: "openAgentsWindow" });
    commandService.executeCommand(OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID, { source: AgentsWindowOpenSource.Banner });
  }));
  const element = $(`.${options.cssClass}`, {}, button);
  return { element, disposables };
}
export {
  canShowAgentsBanner,
  createAgentsBanner
};
