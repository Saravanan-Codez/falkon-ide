import { Sequencer } from "../../../base/common/async.js";
import { LRUCache } from "../../../base/common/map.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const META_DIFF_BASE_BRANCH = "agentHost.diffBaseBranch";
function resolveDiffBaseBranchName(persistedBaseBranch, sessionGitStateBaseBranch) {
  return persistedBaseBranch ?? sessionGitStateBaseBranch;
}
const EMPTY_TREE_OBJECT = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const IAgentHostGitService = createDecorator("agentHostGitService");
class PrimaryWorktreeRootResolver {
  constructor(_gitService) {
    this._gitService = _gitService;
    this._roots = new LRUCache(100);
    this._sequencer = new Sequencer();
  }
  async resolve(checkoutRoot) {
    const key = checkoutRoot.toString();
    const cached = this._roots.get(key);
    if (cached) {
      return cached;
    }
    return this._sequencer.queue(async () => {
      const cached2 = this._roots.get(key);
      if (cached2) {
        return cached2;
      }
      const roots = await this._gitService.getWorktreeRoots(checkoutRoot);
      const primaryRoot = roots[0];
      if (!primaryRoot) {
        return void 0;
      }
      this._roots.set(key, primaryRoot);
      for (const root of roots) {
        this._roots.set(root.toString(), primaryRoot);
      }
      return primaryRoot;
    });
  }
}
const primaryWorktreeRootResolvers = /* @__PURE__ */ new WeakMap();
function tryResolvePrimaryWorktreeRoot(gitService, checkoutRoot) {
  let resolver = primaryWorktreeRootResolvers.get(gitService);
  if (!resolver) {
    resolver = new PrimaryWorktreeRootResolver(gitService);
    primaryWorktreeRootResolvers.set(gitService, resolver);
  }
  return resolver.resolve(checkoutRoot);
}
var GitRefType = /* @__PURE__ */ ((GitRefType2) => {
  GitRefType2[GitRefType2["Head"] = 0] = "Head";
  GitRefType2[GitRefType2["RemoteHead"] = 1] = "RemoteHead";
  GitRefType2[GitRefType2["DetachedHead"] = 2] = "DetachedHead";
  GitRefType2[GitRefType2["Tag"] = 3] = "Tag";
  return GitRefType2;
})(GitRefType || {});
function getBranchPriority(branch, currentBranch, defaultBranch) {
  if (branch === currentBranch) {
    return 0;
  }
  if (branch === defaultBranch) {
    return 1;
  }
  return 2;
}
function parseUpstreamBranchName(upstreamBranchName) {
  const separatorIndex = upstreamBranchName?.indexOf("/") ?? -1;
  if (!upstreamBranchName || separatorIndex <= 0 || separatorIndex === upstreamBranchName.length - 1) {
    return void 0;
  }
  return {
    remote: upstreamBranchName.substring(0, separatorIndex),
    branch: upstreamBranchName.substring(separatorIndex + 1)
  };
}
function getBranchCompletions(branches, options) {
  const normalizedQuery = options?.query?.toLowerCase();
  const filtered = normalizedQuery ? branches.filter((branch) => branch.toLowerCase().includes(normalizedQuery)) : [...branches];
  filtered.sort((a, b) => getBranchPriority(a, options?.currentBranch, options?.defaultBranch) - getBranchPriority(b, options?.currentBranch, options?.defaultBranch));
  return options?.limit ? filtered.slice(0, options.limit) : filtered;
}
export {
  EMPTY_TREE_OBJECT,
  GitRefType,
  IAgentHostGitService,
  META_DIFF_BASE_BRANCH,
  getBranchCompletions,
  parseUpstreamBranchName,
  resolveDiffBaseBranchName,
  tryResolvePrimaryWorktreeRoot
};
