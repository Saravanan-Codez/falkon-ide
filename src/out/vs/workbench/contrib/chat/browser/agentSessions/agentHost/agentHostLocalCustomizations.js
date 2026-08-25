import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Iterable } from "../../../../../../base/common/iterator.js";
import { basename, isEqualOrParent } from "../../../../../../base/common/resources.js";
import { parseRemoteAgentHostHarness } from "../../../../../../platform/agentHost/common/agentHostSessionType.js";
import { CustomizationType } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { customizationId } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { ExtensionIdentifier } from "../../../../../../platform/extensions/common/extensions.js";
import { McpServerType } from "../../../../../../platform/mcp/common/mcpPlatformTypes.js";
import { AICustomizationSources } from "../../../common/aiCustomizationWorkspaceService.js";
import { PromptsType } from "../../../common/promptSyntax/promptTypes.js";
import { isUserToggleableCustomization, matchesSessionType, PromptsStorage } from "../../../common/promptSyntax/service/promptsService.js";
import { isContributionEnabled } from "../../../common/enablement.js";
import { MCP_PLUGIN_COLLECTION_ID_PREFIX } from "../../../../mcp/common/discovery/pluginMcpDiscovery.js";
import { extensionPrefixedIdentifier, McpCollectionDefinition, McpServerTransportType } from "../../../../mcp/common/mcpTypes.js";
import { ConfigurationResolverExpression } from "../../../../../services/configurationResolver/common/configurationResolverExpression.js";
import { AGENT_HOST_COPILOT_CLI_SESSION_TYPE } from "./agentHostToolSetEnablementService.js";
import { isDefined } from "../../../../../../base/common/types.js";
import { PromptFileParser } from "../../../common/promptSyntax/promptFileParser.js";
const COPILOT_CHAT_EXTENSION_ID = "github.copilot-chat";
const COPILOT_CHAT_GITHUB_MCP_COLLECTION_ID = extensionPrefixedIdentifier(new ExtensionIdentifier(COPILOT_CHAT_EXTENSION_ID), "github");
function hasBuiltInGitHubMcpServer(sessionType) {
  return sessionType === AGENT_HOST_COPILOT_CLI_SESSION_TYPE || parseRemoteAgentHostHarness(sessionType) === "copilotcli";
}
const SYNCABLE_PROMPT_TYPES = [
  PromptsType.agent,
  PromptsType.skill,
  PromptsType.instructions,
  PromptsType.prompt
];
const SYNCABLE_STORAGE_SOURCES = [
  PromptsStorage.local,
  PromptsStorage.plugin,
  PromptsStorage.extension,
  PromptsStorage.builtIn
];
async function enumerateLocalCustomizationsForHarness(promptsService, syncProvider, sessionType, token, options) {
  const result = [];
  const storageSources = options?.includeUserStorage ? [PromptsStorage.user, ...SYNCABLE_STORAGE_SOURCES] : SYNCABLE_STORAGE_SOURCES;
  for (const type of SYNCABLE_PROMPT_TYPES) {
    const userDisabled = promptsService.getDisabledPromptFiles(type);
    const lists = await Promise.all(
      storageSources.map((storage) => promptsService.listPromptFilesForStorage(type, storage, token))
    );
    for (let i = 0; i < lists.length; i++) {
      const source = storageSources[i];
      const honourUserDisabled = isUserToggleableCustomization(type, source);
      for (const file of lists[i]) {
        if (matchesSessionType(file.sessionTypes, sessionType)) {
          result.push({
            uri: file.uri,
            type,
            source,
            pluginUri: file.pluginUri,
            extensionId: file.extension?.identifier.value,
            disabled: syncProvider.isDisabled(file.uri) || honourUserDisabled && userDisabled.has(file.uri)
          });
        }
      }
    }
  }
  return result;
}
async function resolveLocalCustomAgents(fileService, promptsService, syncProvider, agentPluginService, sessionType, options) {
  const plugins = agentPluginService.plugins.get();
  const result = [];
  const parser = new PromptFileParser();
  const pending = [];
  const enumerated = await enumerateLocalCustomizationsForHarness(promptsService, syncProvider, sessionType, CancellationToken.None, options);
  for (const agent of enumerated) {
    if (agent.type !== PromptsType.agent || agent.disabled) {
      continue;
    }
    const plugin = agent.source === AICustomizationSources.plugin ? plugins.find((candidate) => isEqualOrParent(agent.uri, candidate.uri)) : void 0;
    if (agent.source === AICustomizationSources.plugin && (!plugin || syncProvider.isDisabled(plugin.uri) || !isContributionEnabled(plugin.enablement.get()))) {
      continue;
    }
    const pluginAgent = plugin?.agents.get().find((candidate) => candidate.uri.toString() === agent.uri.toString());
    pending.push((async () => {
      let name = pluginAgent?.name ?? basename(agent.uri, ".agent.md");
      let description = pluginAgent?.description;
      let disableUserInvocation;
      try {
        const content = await fileService.readFile(agent.uri);
        const header = parser.parse(agent.uri, content.value.toString()).header;
        name = header?.name ?? name;
        description = header?.description ?? description;
        disableUserInvocation = header?.userInvocable === false || void 0;
      } catch {
      }
      result.push({
        type: CustomizationType.Agent,
        id: agent.uri.toString(),
        uri: agent.uri.toString(),
        name,
        description,
        disableUserInvocation
      });
    })());
  }
  await Promise.all(pending);
  result.sort((a, b) => a.name.localeCompare(b.name) || a.uri.toString().localeCompare(b.uri.toString()));
  return result;
}
function launchToMcpServerConfiguration(launch) {
  switch (launch.type) {
    case McpServerTransportType.Stdio:
      if (!launch.command) {
        return void 0;
      }
      return {
        type: McpServerType.LOCAL,
        command: launch.command,
        args: launch.args.length > 0 ? [...launch.args] : void 0,
        env: Object.keys(launch.env).length > 0 ? { ...launch.env } : void 0,
        envFile: launch.envFile,
        cwd: launch.cwd
      };
    case McpServerTransportType.HTTP:
      return {
        type: McpServerType.REMOTE,
        url: launch.uri.toString(),
        headers: launch.headers.length > 0 ? Object.fromEntries(launch.headers) : void 0
      };
  }
}
async function resolveConfigurationForSync(configurationResolverService, folder, configuration) {
  const expr = ConfigurationResolverExpression.parse(configuration);
  for (const replacement of expr.unresolved()) {
    if (replacement.name === "input" || replacement.name === "command") {
      return void 0;
    }
  }
  try {
    await configurationResolverService.resolveAsync(folder, expr);
  } catch {
    return void 0;
  }
  if (!Iterable.isEmpty(expr.unresolved())) {
    return void 0;
  }
  return expr.toObject();
}
function shouldSyncWorkspaceDotMcp(sessionType, workspaceFolderCount, multiRootSettingEnabled) {
  return sessionType === AGENT_HOST_COPILOT_CLI_SESSION_TYPE && workspaceFolderCount > 1 && multiRootSettingEnabled;
}
async function collectNonPluginMcpServers(mcpService, configurationResolverService, sessionType, includeWorkspaceDotMcp) {
  const result = [];
  for (const server of mcpService.servers.get()) {
    if (server.collection.id.startsWith(MCP_PLUGIN_COLLECTION_ID_PREFIX)) {
      continue;
    }
    if (!isContributionEnabled(server.enablement.get())) {
      continue;
    }
    const definitions = server.readDefinitions().get();
    const definition = definitions.server;
    const launch = definition?.launch;
    if (!launch) {
      continue;
    }
    const collection = definitions.collection;
    if (hasBuiltInGitHubMcpServer(sessionType) && collection?.id === COPILOT_CHAT_GITHUB_MCP_COLLECTION_ID && collection.source instanceof ExtensionIdentifier && ExtensionIdentifier.equals(collection.source, COPILOT_CHAT_EXTENSION_ID)) {
      continue;
    }
    let configuration = launchToMcpServerConfiguration(launch);
    if (!configuration) {
      continue;
    }
    if (collection && McpCollectionDefinition.isWorkspaceDiscovered(collection)) {
      if (McpCollectionDefinition.isVscodeMcpJson(collection)) {
        const resolved = await resolveConfigurationForSync(configurationResolverService, definition.variableReplacement?.folder, configuration);
        if (!resolved) {
          continue;
        }
        configuration = resolved;
      } else if (includeWorkspaceDotMcp && McpCollectionDefinition.isWorkspaceDotMcpJson(collection)) {
      } else {
        continue;
      }
    }
    result.push({ name: server.definition.label, configuration });
  }
  return result;
}
async function resolveCustomizationRefs(fileService, promptsService, syncProvider, agentPluginService, mcpService, configurationResolverService, bundler, sessionType, includeWorkspaceDotMcp = false, options) {
  const enumerated = await enumerateLocalCustomizationsForHarness(promptsService, syncProvider, sessionType, CancellationToken.None, options);
  const enabled = enumerated.filter((e) => !e.disabled);
  const plugins = agentPluginService.plugins.get();
  const pluginRefs = /* @__PURE__ */ new Map();
  const looseFiles = [];
  const addPluginRef = (plugin) => {
    const key = plugin.uri.toString();
    if (!pluginRefs.has(key)) {
      const promise = (async () => {
        let nonce;
        try {
          nonce = (await fileService.stat(plugin.uri)).mtime;
        } catch {
        }
        return {
          type: CustomizationType.Plugin,
          id: customizationId(key),
          uri: key,
          name: plugin.label,
          nonce: nonce?.toString(16),
          enabled: true
        };
      })();
      pluginRefs.set(key, promise);
    }
  };
  for (const entry of enabled) {
    if (entry.source === AICustomizationSources.plugin) {
      const plugin = plugins.find((p) => isEqualOrParent(entry.uri, p.uri));
      if (!plugin) {
        continue;
      }
      if (syncProvider.isDisabled(plugin.uri)) {
        continue;
      }
      if (!isContributionEnabled(plugin.enablement.get())) {
        continue;
      }
      addPluginRef(plugin);
    } else {
      looseFiles.push({ uri: entry.uri, type: entry.type, source: entry.source, extensionId: entry.extensionId, pluginUri: entry.pluginUri });
    }
  }
  for (const plugin of plugins) {
    if (pluginRefs.has(plugin.uri.toString())) {
      continue;
    }
    if (syncProvider.isDisabled(plugin.uri)) {
      continue;
    }
    if (!isContributionEnabled(plugin.enablement.get())) {
      continue;
    }
    if (plugin.hooks.get().length === 0 && plugin.commands.get().length === 0 && plugin.skills.get().length === 0 && plugin.agents.get().length === 0 && plugin.instructions.get().length === 0 && plugin.mcpServerDefinitions.get().length === 0) {
      continue;
    }
    addPluginRef(plugin);
  }
  const refs = [...pluginRefs.values()];
  const mcpServers = await collectNonPluginMcpServers(mcpService, configurationResolverService, sessionType, includeWorkspaceDotMcp);
  if (looseFiles.length > 0 || mcpServers.length > 0) {
    refs.push(bundler.bundle(looseFiles, mcpServers).then((r) => r?.ref));
  }
  return await Promise.all(refs).then((r) => r.filter(isDefined));
}
export {
  SYNCABLE_PROMPT_TYPES,
  SYNCABLE_STORAGE_SOURCES,
  collectNonPluginMcpServers,
  enumerateLocalCustomizationsForHarness,
  resolveCustomizationRefs,
  resolveLocalCustomAgents,
  shouldSyncWorkspaceDotMcp
};
