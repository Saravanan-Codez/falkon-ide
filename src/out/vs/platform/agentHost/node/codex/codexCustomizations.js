import { createHash } from "crypto";
import { Schemas } from "../../../../base/common/network.js";
import { isAbsolute, normalize } from "../../../../base/common/path.js";
import { extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { CustomizationLoadStatus, CustomizationType, customizationId } from "../../common/state/sessionState.js";
const CODEX_SKILLS_SCHEME = "codex-skills";
const CODEX_HOOKS_SCHEME = "codex-hooks";
function localFileComparisonKey(resource) {
  if (resource.scheme !== Schemas.file || !resource.path.startsWith("/") || !isAbsolute(resource.fsPath)) {
    return void 0;
  }
  const normalized = extUriBiasedIgnorePathCase.removeTrailingPathSeparator(URI.file(normalize(resource.fsPath)));
  return {
    key: extUriBiasedIgnorePathCase.getComparisonKey(normalized),
    resource: normalized
  };
}
function capabilityRootId(comparisonKey) {
  const digest = createHash("sha256").update("codex-selected-capability-root-v1\0").update(comparisonKey).digest("hex");
  return `codex-selected-capability-root-v1-${digest}`;
}
function codexSelectedCapabilityRootCandidates(workingDirectories) {
  const primaryKey = workingDirectories.length > 0 ? localFileComparisonKey(workingDirectories[0])?.key : void 0;
  const seenRoots = /* @__PURE__ */ new Set();
  const seenCandidates = /* @__PURE__ */ new Set();
  const result = [];
  for (const workingDirectory of workingDirectories.slice(1)) {
    const root = localFileComparisonKey(workingDirectory);
    if (!root || root.key === primaryKey || seenRoots.has(root.key)) {
      continue;
    }
    seenRoots.add(root.key);
    for (const segments of [[".agents", "skills"], [".codex", "skills"]]) {
      const candidate = localFileComparisonKey(URI.joinPath(root.resource, ...segments));
      if (!candidate || seenCandidates.has(candidate.key)) {
        continue;
      }
      seenCandidates.add(candidate.key);
      result.push({
        id: capabilityRootId(candidate.key),
        location: {
          type: "environment",
          environmentId: "local",
          path: candidate.resource.fsPath
        }
      });
    }
  }
  return result;
}
function skillScopeContainerName(scope) {
  switch (scope) {
    case "repo":
      return "Repository";
    case "user":
      return "User";
    case "system":
      return "Built-in";
    case "admin":
      return "Admin";
    default:
      return scope;
  }
}
const SKILL_SCOPE_ORDER = ["repo", "user", "system", "admin"];
function skillToCustomization(skill) {
  const uri = URI.file(skill.path).toString();
  return {
    type: CustomizationType.Skill,
    id: customizationId(uri),
    uri,
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled
  };
}
function codexSkillsToContainers(response) {
  const byScope = /* @__PURE__ */ new Map();
  for (const entry of response?.data ?? []) {
    for (const skill of entry.skills ?? []) {
      let scoped = byScope.get(skill.scope);
      if (!scoped) {
        scoped = /* @__PURE__ */ new Map();
        byScope.set(skill.scope, scoped);
      }
      if (!scoped.has(skill.path)) {
        scoped.set(skill.path, skill);
      }
    }
  }
  const containers = [];
  for (const scope of SKILL_SCOPE_ORDER) {
    const scoped = byScope.get(scope);
    if (!scoped || scoped.size === 0) {
      continue;
    }
    const children = [...scoped.values()].sort((a, b) => a.name.localeCompare(b.name)).map(skillToCustomization);
    const containerUri = URI.from({ scheme: CODEX_SKILLS_SCHEME, path: `/${scope}` }).toString();
    containers.push({
      type: CustomizationType.Directory,
      id: customizationId(containerUri),
      uri: containerUri,
      name: skillScopeContainerName(scope),
      enabled: true,
      contents: CustomizationType.Skill,
      writable: false,
      load: { kind: CustomizationLoadStatus.Loaded },
      children
    });
  }
  return containers;
}
function hookToCustomization(hook) {
  const uri = URI.file(hook.sourcePath).with({ fragment: hook.key }).toString();
  return {
    type: CustomizationType.Hook,
    id: customizationId(uri),
    uri,
    name: hook.eventName,
    enabled: hook.enabled
  };
}
function codexHooksToContainers(response) {
  const byKey = /* @__PURE__ */ new Map();
  for (const entry of response?.data ?? []) {
    for (const hook of entry.hooks ?? []) {
      if (!byKey.has(hook.key)) {
        byKey.set(hook.key, hook);
      }
    }
  }
  if (byKey.size === 0) {
    return [];
  }
  const children = [...byKey.values()].sort((a, b) => Number(a.displayOrder - b.displayOrder) || a.key.localeCompare(b.key)).map(hookToCustomization);
  const containerUri = URI.from({ scheme: CODEX_HOOKS_SCHEME, path: "/hooks" }).toString();
  return [{
    type: CustomizationType.Directory,
    id: customizationId(containerUri),
    uri: containerUri,
    name: "Hooks",
    enabled: true,
    contents: CustomizationType.Hook,
    writable: false,
    load: { kind: CustomizationLoadStatus.Loaded },
    children
  }];
}
export {
  codexHooksToContainers,
  codexSelectedCapabilityRootCandidates,
  codexSkillsToContainers
};
