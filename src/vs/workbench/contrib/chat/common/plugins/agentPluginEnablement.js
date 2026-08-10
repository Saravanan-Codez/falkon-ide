import { PluginSourceKind } from "./pluginMarketplaceService.js";
import { CollisionEnablementModel } from "../enablement.js";
const COPILOT_CLI_INSTALL_PATH_FRAGMENT = "/.copilot/installed-plugins/";
class AgentPluginCollisionEnablementModel extends CollisionEnablementModel {
  constructor(base, collisionGroups) {
    super(base, collisionGroups);
  }
}
function getSortedAgentPlugins(discoveries) {
  return getUniqueAgentPluginCandidates(discoveries).map((candidate) => candidate.plugin).sort((a, b) => a.uri.toString().localeCompare(b.uri.toString()));
}
function getCanonicalAgentPluginCollisionGroups(discoveries, isBlocked) {
  const candidates = getUniqueAgentPluginCandidates(discoveries);
  const byCanonicalKey = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    if (isBlocked?.(candidate.plugin)) {
      continue;
    }
    let group = byCanonicalKey.get(candidate.canonicalKey);
    if (!group) {
      group = [];
      byCanonicalKey.set(candidate.canonicalKey, group);
    }
    group.push(candidate.plugin.uri.toString());
  }
  const groups = /* @__PURE__ */ new Map();
  for (const group of byCanonicalKey.values()) {
    if (group.length < 2) {
      continue;
    }
    for (const key of group) {
      groups.set(key, group);
    }
  }
  return groups;
}
function isAgentPluginBlockedByPolicy(plugin, enabledPluginsPolicy) {
  const pluginId = getAgentPluginPolicyId(plugin);
  return pluginId !== void 0 && enabledPluginsPolicy?.[pluginId] === false;
}
function isAgentPluginForceEnabledByPolicy(plugin, enabledPluginsPolicy) {
  const pluginId = getAgentPluginPolicyId(plugin);
  return pluginId !== void 0 && enabledPluginsPolicy?.[pluginId] === true;
}
function getAgentPluginPolicyId(plugin) {
  const identity = getPolicyIdentity(plugin);
  return identity ? `${identity.name}@${identity.marketplace}` : void 0;
}
function getAgentPluginCandidates(discoveries) {
  const candidates = [];
  for (const discovery of discoveries) {
    for (let pluginOrder = 0; pluginOrder < discovery.plugins.length; pluginOrder++) {
      const plugin = discovery.plugins[pluginOrder];
      candidates.push({
        plugin,
        priority: discovery.priority,
        order: discovery.order,
        pluginOrder,
        canonicalKey: getCanonicalPluginIdentity(plugin)
      });
    }
  }
  return candidates.sort(
    (a, b) => a.priority - b.priority || a.order - b.order || a.pluginOrder - b.pluginOrder || a.plugin.uri.toString().localeCompare(b.plugin.uri.toString())
  );
}
function getUniqueAgentPluginCandidates(discoveries) {
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of getAgentPluginCandidates(discoveries)) {
    const key = candidate.plugin.uri.toString();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}
function getCanonicalPluginIdentity(plugin) {
  return getMarketplaceCanonicalIdentity(plugin.fromMarketplace) ?? getCopilotCliInstallCanonicalIdentity(plugin) ?? `uri:${plugin.uri.toString()}`;
}
function getMarketplaceCanonicalIdentity(plugin) {
  if (!plugin) {
    return void 0;
  }
  const normalizedName = normalizePluginIdentitySegment(plugin.name);
  const source = plugin.sourceDescriptor;
  switch (source.kind) {
    case PluginSourceKind.RelativePath: {
      if (plugin.marketplaceReference.githubRepo) {
        return `github:${plugin.marketplaceReference.githubRepo.toLowerCase()}|${normalizedName}`;
      }
      return `marketplace:${plugin.marketplaceReference.canonicalId}|${normalizedName}`;
    }
    case PluginSourceKind.GitHub: {
      const github = source;
      return `github:${github.repo.toLowerCase()}|${normalizedName}`;
    }
    case PluginSourceKind.GitUrl: {
      const git = source;
      return `git:${git.url.toLowerCase()}|${normalizedName}`;
    }
    case PluginSourceKind.Npm: {
      const npm = source;
      return `npm:${npm.package.toLowerCase()}|${normalizedName}`;
    }
    case PluginSourceKind.Pip: {
      const pip = source;
      return `pip:${pip.package.toLowerCase()}|${normalizedName}`;
    }
  }
}
function getCopilotCliInstallCanonicalIdentity(plugin) {
  if (plugin.uri.scheme !== "file") {
    return void 0;
  }
  const idx = plugin.uri.path.indexOf(COPILOT_CLI_INSTALL_PATH_FRAGMENT);
  if (idx === -1) {
    return void 0;
  }
  const segments = plugin.uri.path.slice(idx + COPILOT_CLI_INSTALL_PATH_FRAGMENT.length).split("/").filter((s) => s.length > 0);
  if (segments.length !== 2) {
    return void 0;
  }
  const [bucket, installName] = segments;
  const normalizedName = normalizePluginIdentitySegment(plugin.label || installName);
  if (bucket !== "_direct") {
    return `copilot-cli-marketplace:${normalizePluginIdentitySegment(bucket)}|${normalizedName}`;
  }
  const match = /^(?<owner>.+)--(?<repo>.+)--(?<plugin>.+)$/.exec(installName);
  const groups = match?.groups;
  if (!groups) {
    return void 0;
  }
  return `github:${groups.owner.toLowerCase()}/${groups.repo.toLowerCase()}|${normalizePluginIdentitySegment(groups.plugin)}`;
}
function normalizePluginIdentitySegment(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_.:-]/g, "-").replace(/-+/g, "-").replace(/^[-:.]+|[-:.]+$/g, "");
}
function getPolicyIdentity(plugin) {
  const m = plugin.fromMarketplace;
  if (m) {
    return { name: m.name, marketplace: m.marketplace, marketplaceReference: m.marketplaceReference };
  }
  if (plugin.uri.scheme !== "file") {
    return void 0;
  }
  const idx = plugin.uri.path.indexOf(COPILOT_CLI_INSTALL_PATH_FRAGMENT);
  if (idx === -1) {
    return void 0;
  }
  const segments = plugin.uri.path.slice(idx + COPILOT_CLI_INSTALL_PATH_FRAGMENT.length).split("/").filter((s) => s.length > 0);
  if (segments.length !== 2) {
    return void 0;
  }
  const [marketplace, name] = segments;
  if (marketplace === "_direct") {
    return void 0;
  }
  return { name, marketplace };
}
export {
  AgentPluginCollisionEnablementModel,
  getAgentPluginPolicyId,
  getCanonicalAgentPluginCollisionGroups,
  getSortedAgentPlugins,
  isAgentPluginBlockedByPolicy,
  isAgentPluginForceEnabledByPolicy
};
