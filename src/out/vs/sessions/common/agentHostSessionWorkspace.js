import { Codicon } from "../../base/common/codicons.js";
import { match as matchGlob } from "../../base/common/glob.js";
import { extUri, basename } from "../../base/common/resources.js";
function matchesAnyBranchProtectionPattern(branchName, patterns) {
  if (!patterns) {
    return false;
  }
  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (trimmed && matchGlob(trimmed, branchName)) {
      return true;
    }
  }
  return false;
}
function readBranchProtectionPatterns(configurationService, resource) {
  const raw = configurationService.getValue("git.branchProtection", { resource }) ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((p) => typeof p === "string" ? p.trim() : "").filter((p) => p !== "");
}
function agentHostSessionWorkspaceKey(workspace) {
  const folder = workspace?.folders[0];
  if (!workspace || !folder) {
    return void 0;
  }
  const folderKeys = workspace.folders.map((f) => {
    const repo = f.gitRepository;
    return [
      extUri.getComparisonKey(f.root),
      f.workingDirectory ? extUri.getComparisonKey(f.workingDirectory) : "",
      repo?.branchName ?? "",
      repo?.baseBranchName ?? "",
      String(repo?.baseBranchProtected ?? ""),
      String(repo?.hasGitHubRemote ?? ""),
      repo?.upstreamBranchName ?? "",
      String(repo?.incomingChanges ?? ""),
      String(repo?.outgoingChanges ?? ""),
      String(repo?.uncommittedChanges ?? "")
    ].join("");
  });
  return [workspace.label, ...folderKeys].join("\n");
}
function buildAgentHostSessionWorkspace(project, workingDirectories, options, gitHubInfo, gitState) {
  const baseBranchName = gitState?.baseBranchName;
  const baseBranchProtected = baseBranchName !== void 0 ? matchesAnyBranchProtectionPattern(baseBranchName, options.branchProtectionPatterns) : void 0;
  const hasGitHubRemote = gitState?.hasGitHubRemote;
  const upstreamBranchName = gitState?.upstreamBranchName;
  const incomingChanges = gitState?.incomingChanges;
  const outgoingChanges = gitState?.outgoingChanges;
  const uncommittedChanges = gitState?.uncommittedChanges;
  const branchName = gitState?.branchName;
  const gitFields = { branchName, baseBranchName, baseBranchProtected, hasGitHubRemote, upstreamBranchName, incomingChanges, outgoingChanges, uncommittedChanges };
  const primary = workingDirectories?.[0];
  const additionalFolders = (workingDirectories ?? []).slice(1).map((dir) => {
    const name = basename(dir) || dir.path;
    return { root: dir, workingDirectory: dir, name, description: options.description };
  });
  if (project) {
    const workTreeUri = extUri.isEqual(primary, project.uri) ? void 0 : primary;
    const label2 = options.providerLabel ? `${project.displayName} [${options.providerLabel}]` : project.displayName;
    return {
      uri: project.uri,
      label: label2,
      description: options.description,
      icon: Codicon.repo,
      group: options.group,
      folders: [{
        root: project.uri,
        workingDirectory: primary ?? project.uri,
        name: project.displayName,
        description: options.description,
        gitRepository: { uri: project.uri, workTreeUri, gitHubInfo, ...gitFields }
      }, ...additionalFolders],
      requiresWorkspaceTrust: options.requiresWorkspaceTrust,
      isVirtualWorkspace: false
    };
  }
  if (!primary) {
    return void 0;
  }
  const folderName = basename(primary) || primary.path;
  const label = options.providerLabel ? `${folderName} [${options.providerLabel}]` : folderName;
  return {
    uri: primary,
    label,
    description: options.description,
    icon: options.fallbackIcon,
    group: options.group,
    folders: [{
      root: primary,
      workingDirectory: primary,
      name: folderName,
      description: options.description,
      gitRepository: { uri: primary, workTreeUri: void 0, gitHubInfo, ...gitFields }
    }, ...additionalFolders],
    requiresWorkspaceTrust: options.requiresWorkspaceTrust,
    isVirtualWorkspace: false
  };
}
export {
  agentHostSessionWorkspaceKey,
  buildAgentHostSessionWorkspace,
  matchesAnyBranchProtectionPattern,
  readBranchProtectionPatterns
};
