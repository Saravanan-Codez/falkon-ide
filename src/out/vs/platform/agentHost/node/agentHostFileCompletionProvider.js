import { isCancellationError } from "../../../base/common/errors.js";
import { compareItemsByFuzzyScore, prepareQuery, scoreItemFuzzy } from "../../../base/common/fuzzyScorer.js";
import { shorten } from "../../../base/common/labels.js";
import { basename, extUriBiasedIgnorePathCase } from "../../../base/common/resources.js";
import { compare } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { findDeepestContainingWorkingDirectory } from "../common/agentHostWorkingDirectories.js";
import { CompletionItemKind } from "../common/state/protocol/commands.js";
import { MessageAttachmentKind } from "../common/state/protocol/state.js";
import { CompletionTriggerCharacter } from "./agentHostCompletions.js";
import { resolveAgentHostFileCompletionRoots } from "./agentHostFileCompletionUtils.js";
const MAX_RESULTS = 50;
function extractAtToken(text, offset) {
  if (offset < 0 || offset > text.length) {
    return void 0;
  }
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text.charCodeAt(i);
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
      return void 0;
    }
    if (text[i] === CompletionTriggerCharacter.File || text[i] === CompletionTriggerCharacter.Hash) {
      if (i > 0) {
        const prev = text.charCodeAt(i - 1);
        const prevIsWs = prev === 32 || prev === 9 || prev === 10 || prev === 13;
        if (!prevIsWs) {
          return void 0;
        }
      }
      return { token: text.slice(i + 1, offset), triggerChar: text[i], rangeStart: i, rangeEnd: offset };
    }
  }
  return void 0;
}
class FileCompletionCandidateAccessor {
  getItemLabel(item) {
    return basename(item.uri);
  }
  getItemDescription(item) {
    const idx = item.relativePath.lastIndexOf("/");
    return idx > 0 ? item.relativePath.slice(0, idx) : void 0;
  }
  getItemPath(item) {
    return item.relativePath;
  }
}
class AgentHostFileCompletionProvider {
  constructor(_stateManager, _workspaceFiles, _logService) {
    this._stateManager = _stateManager;
    this._workspaceFiles = _workspaceFiles;
    this._logService = _logService;
    this.kinds = /* @__PURE__ */ new Set([CompletionItemKind.UserMessage]);
    this.triggerCharacters = [CompletionTriggerCharacter.File, CompletionTriggerCharacter.Hash];
  }
  async provideCompletionItems(params, token) {
    const workingDirectoryStrings = this._stateManager.getSessionState(params.channel)?.workingDirectories;
    if (!workingDirectoryStrings?.length) {
      return [];
    }
    const roots = resolveAgentHostFileCompletionRoots(workingDirectoryStrings.map((workingDirectory) => URI.parse(workingDirectory)));
    if (roots.enumerationRoots.length === 0) {
      return [];
    }
    const at = extractAtToken(params.text, params.offset);
    if (!at) {
      return [];
    }
    let filesByRoot;
    try {
      filesByRoot = await this._enumerateRootFiles(roots, token);
    } catch (err) {
      if (isCancellationError(err)) {
        return [];
      }
      throw err;
    }
    if (token.isCancellationRequested) {
      return [];
    }
    const query = prepareQuery(at.token);
    const candidates = [];
    const candidateCountByOwner = new Array(roots.logicalRoots.length).fill(0);
    const seen = /* @__PURE__ */ new Set();
    for (const files of filesByRoot) {
      for (const uri of files) {
        const key = extUriBiasedIgnorePathCase.getComparisonKey(uri);
        if (seen.has(key)) {
          continue;
        }
        const owner = findDeepestContainingWorkingDirectory(uri, roots.logicalRoots);
        const ownerIndex = owner ? roots.logicalRoots.indexOf(owner) : -1;
        if (!owner || ownerIndex < 0 || !query.normalized && candidateCountByOwner[ownerIndex] >= MAX_RESULTS) {
          continue;
        }
        const relativePath = extUriBiasedIgnorePathCase.relativePath(owner, uri);
        if (relativePath === void 0) {
          continue;
        }
        seen.add(key);
        candidateCountByOwner[ownerIndex]++;
        candidates.push({ uri, owner, ownerIndex, relativePath });
      }
    }
    if (candidates.length === 0) {
      return [];
    }
    const accessor = new FileCompletionCandidateAccessor();
    const cache = /* @__PURE__ */ Object.create(null);
    let results;
    if (!query.normalized) {
      results = this._takeFairResults(candidates);
    } else {
      const matching = candidates.filter((candidate) => scoreItemFuzzy(candidate, query, true, accessor, cache).score > 0);
      matching.sort(
        (a, b) => compareItemsByFuzzyScore(a, b, query, true, accessor, cache) || a.ownerIndex - b.ownerIndex || compare(a.relativePath, b.relativePath)
      );
      results = matching.slice(0, MAX_RESULTS);
    }
    const duplicateNames = /* @__PURE__ */ new Set();
    const names = /* @__PURE__ */ new Set();
    for (const candidate of results) {
      const name = basename(candidate.uri);
      if (names.has(name)) {
        duplicateNames.add(name);
      } else {
        names.add(name);
      }
    }
    const ownerLabels = this._getOwnerLabels(results);
    return results.map((candidate) => {
      const name = basename(candidate.uri);
      const ownerLabel = ownerLabels.get(extUriBiasedIgnorePathCase.getComparisonKey(candidate.owner)) ?? candidate.owner.path;
      return {
        insertText: at.triggerChar + name,
        rangeStart: at.rangeStart,
        rangeEnd: at.rangeEnd,
        attachment: {
          type: MessageAttachmentKind.Resource,
          uri: candidate.uri.toString(),
          label: duplicateNames.has(name) ? `${ownerLabel} \u2022 ${candidate.relativePath}` : name,
          displayKind: "document"
        }
      };
    });
  }
  /**
   * Uses root basenames when unique and shortens only roots whose basenames collide.
   */
  _getOwnerLabels(candidates) {
    const owners = /* @__PURE__ */ new Map();
    for (const candidate of candidates) {
      owners.set(extUriBiasedIgnorePathCase.getComparisonKey(candidate.owner), candidate.owner);
    }
    const entries = [...owners.entries()];
    const ownerNameCounts = /* @__PURE__ */ new Map();
    for (const [, owner] of entries) {
      const ownerName = basename(owner);
      ownerNameCounts.set(ownerName, (ownerNameCounts.get(ownerName) ?? 0) + 1);
    }
    const shortenedOwnerPaths = shorten(entries.map(([, owner]) => owner.path), "/");
    return new Map(entries.map(([key, owner], index) => {
      const ownerName = basename(owner);
      const label = ownerName && ownerNameCounts.get(ownerName) === 1 ? ownerName : shortenedOwnerPaths[index];
      return [key, label];
    }));
  }
  async _enumerateRootFiles(roots, token) {
    const filesByRoot = [];
    const queuedRoots = new Set(roots.enumerationRoots.map((root) => extUriBiasedIgnorePathCase.getComparisonKey(root)));
    let pendingRoots = [...roots.enumerationRoots];
    while (pendingRoots.length > 0) {
      const currentRoots = pendingRoots;
      pendingRoots = [];
      const enumerations = await Promise.all(currentRoots.map(async (root) => {
        try {
          const result = await this._workspaceFiles.getFiles(root, token);
          return { root, files: result.files, needsFallback: result.isTruncated };
        } catch (err) {
          if (isCancellationError(err)) {
            throw err;
          }
          this._logService.warn(`[AgentHostFileCompletionProvider] Failed to enumerate ${root.toString()}: ${err}`);
          return { root, files: [], needsFallback: true };
        }
      }));
      for (const enumeration of enumerations) {
        filesByRoot.push(enumeration.files);
        if (!enumeration.needsFallback) {
          continue;
        }
        const nestedRoots = roots.logicalRoots.filter(
          (root) => !extUriBiasedIgnorePathCase.isEqual(root, enumeration.root) && extUriBiasedIgnorePathCase.isEqualOrParent(root, enumeration.root) && !queuedRoots.has(extUriBiasedIgnorePathCase.getComparisonKey(root))
        );
        for (const fallbackRoot of resolveAgentHostFileCompletionRoots(nestedRoots).enumerationRoots) {
          queuedRoots.add(extUriBiasedIgnorePathCase.getComparisonKey(fallbackRoot));
          pendingRoots.push(fallbackRoot);
        }
      }
    }
    return filesByRoot;
  }
  /**
   * Interleaves empty-query candidates by logical root before applying the result limit.
   */
  _takeFairResults(candidates) {
    const buckets = [];
    for (const candidate of candidates) {
      (buckets[candidate.ownerIndex] ??= []).push(candidate);
    }
    const results = [];
    for (let index = 0; results.length < MAX_RESULTS; index++) {
      let added = false;
      for (const bucket of buckets) {
        if (!bucket) {
          continue;
        }
        const candidate = bucket[index];
        if (candidate) {
          results.push(candidate);
          added = true;
          if (results.length === MAX_RESULTS) {
            break;
          }
        }
      }
      if (!added) {
        break;
      }
    }
    return results;
  }
}
export {
  AgentHostFileCompletionProvider,
  extractAtToken
};
