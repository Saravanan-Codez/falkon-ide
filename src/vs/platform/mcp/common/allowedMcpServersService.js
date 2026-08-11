var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../base/common/lifecycle.js";
import * as nls from "../../../nls.js";
import { createCommandUri, MarkdownString } from "../../../base/common/htmlContent.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { Emitter } from "../../../base/common/event.js";
import { hasKey } from "../../../base/common/types.js";
import { checkMcpServerAllowed, getMcpServerMatchers, McpServerAllowResult } from "./allowedMcpServers.js";
import { mcpAccessConfig, mcpAllowedServersConfig, mcpDeniedServersConfig, McpAccessValue } from "./mcpManagement.js";
import { McpServerType } from "./mcpPlatformTypes.js";
import { COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG } from "../../policy/common/copilotManagedSettings.js";
let AllowedMcpServersService = class extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this._onDidChangeAllowedMcpServers = this._register(new Emitter());
    this.onDidChangeAllowedMcpServers = this._onDidChangeAllowedMcpServers.event;
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(mcpAccessConfig) || e.affectsConfiguration(mcpAllowedServersConfig) || e.affectsConfiguration(mcpDeniedServersConfig) || e.affectsConfiguration(COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG)) {
        this._onDidChangeAllowedMcpServers.fire();
      }
    }));
  }
  isAllowed(mcpServer) {
    return this.isServerAllowed(this.toIdentity(mcpServer));
  }
  isServerAllowed(identity) {
    if (this.configurationService.getValue(mcpAccessConfig) === McpAccessValue.None) {
      const settingsCommandLink = createCommandUri("workbench.action.openSettings", { query: `@id:${mcpAccessConfig}` }).toString();
      return new MarkdownString(nls.localize("mcp servers are not allowed", "Model Context Protocol servers are disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink));
    }
    const managedOnly = this.configurationService.getValue(COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG) === true;
    const allowlist = managedOnly ? getMcpServerMatchers(this.configurationService.inspect(mcpAllowedServersConfig).policyValue) ?? [] : getMcpServerMatchers(this.configurationService.getValue(mcpAllowedServersConfig));
    const denylist = managedOnly ? this.getAllConfiguredMatchers(mcpDeniedServersConfig) : getMcpServerMatchers(this.configurationService.getValue(mcpDeniedServersConfig));
    switch (checkMcpServerAllowed(allowlist, denylist, identity)) {
      case McpServerAllowResult.Denied:
        return new MarkdownString(nls.localize("mcp server is denied", "This Model Context Protocol server is blocked by your organization's policy. Please contact your administrator for more information."));
      case McpServerAllowResult.NotAllowed:
        return new MarkdownString(nls.localize("mcp server not in allowlist", "This Model Context Protocol server is not in the list of servers allowed by your organization. Please contact your administrator for more information."));
    }
    return true;
  }
  getAllConfiguredMatchers(key) {
    const inspected = this.configurationService.inspect(key);
    return [
      inspected.applicationValue,
      inspected.userValue,
      inspected.userLocalValue,
      inspected.userRemoteValue,
      inspected.workspaceValue,
      inspected.workspaceFolderValue,
      inspected.memoryValue,
      inspected.policyValue
    ].flatMap((value) => getMcpServerMatchers(value) ?? []);
  }
  toIdentity(mcpServer) {
    if (hasKey(mcpServer, { config: true })) {
      const config = mcpServer.config;
      if (config.type === McpServerType.REMOTE) {
        return { name: mcpServer.name, url: config.url };
      }
      return { name: mcpServer.name, command: [config.command, ...config.args ?? []] };
    }
    return { name: mcpServer.name, url: mcpServer.configuration.remotes?.[0]?.url };
  }
};
AllowedMcpServersService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], AllowedMcpServersService);
export {
  AllowedMcpServersService
};
