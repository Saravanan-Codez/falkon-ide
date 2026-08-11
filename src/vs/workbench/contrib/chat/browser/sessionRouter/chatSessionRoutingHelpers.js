import { isHighConfidenceSessionRoute } from "../../common/sessionRouter.js";
const ROUTE_ENRICH_MAX_CANDIDATES = 12;
const RELATED_SESSION_FOLDER_CONFIDENCE = 0.35;
function parseExplicitNewSessionRequest(utterance) {
  const match = /^(?:please\s+)?(?:create|start|open)\s+(?:a\s+)?new\s+(?:chat\s+)?session(?:\s+(?:to|for|and)\s+|\s*[:,-]\s*)(.+)$/i.exec(utterance.trim());
  const task = match?.[1]?.trim();
  return task || void 0;
}
function resolveNewSessionWorkspaceFolder(utterance, folders, results, candidates, defaultFolder) {
  return folderMentionedInUtterance(utterance, folders) ?? folderFromRelatedSession(results, candidates, folders) ?? defaultFolder ?? folders[0]?.uri;
}
function selectRouterShortlist(candidates, preliminaryResults, limit = ROUTE_ENRICH_MAX_CANDIDATES) {
  if (candidates.length <= limit) {
    return [...candidates];
  }
  const candidatesById = new Map(candidates.map((candidate) => [candidate.sessionId, candidate]));
  const selectedIds = /* @__PURE__ */ new Set();
  const shortlist = [];
  for (const result of preliminaryResults) {
    const candidate = candidatesById.get(result.sessionId);
    if (candidate && !selectedIds.has(candidate.sessionId)) {
      selectedIds.add(candidate.sessionId);
      shortlist.push(candidate);
      if (shortlist.length === limit) {
        return shortlist;
      }
    }
  }
  const fallback = candidates.filter((candidate) => !selectedIds.has(candidate.sessionId)).sort((a, b) => sessionStatusPriority(b.status) - sessionStatusPriority(a.status) || (b.lastActivity ?? 0) - (a.lastActivity ?? 0) || a.label.localeCompare(b.label) || a.sessionId.localeCompare(b.sessionId));
  shortlist.push(...fallback.slice(0, limit - shortlist.length));
  return shortlist;
}
function selectBestSessionRoute(results) {
  const top = results[0];
  return top && isHighConfidenceSessionRoute(top) ? top : void 0;
}
function sessionStatusPriority(status) {
  return status === "working" ? 2 : status === "idle" ? 1 : 0;
}
function folderMentionedInUtterance(utterance, folders) {
  const normalizedUtterance = utterance.toLocaleLowerCase();
  let best;
  for (const folder of folders) {
    const names = /* @__PURE__ */ new Set([folder.name, folder.uri.path.split("/").filter(Boolean).at(-1)]);
    for (const name of names) {
      if (!name || name.length < 3) {
        continue;
      }
      const normalizedName = name.toLocaleLowerCase();
      let start = normalizedUtterance.indexOf(normalizedName);
      while (start >= 0) {
        if (isWordBoundary(normalizedUtterance[start - 1]) && isWordBoundary(normalizedUtterance[start + normalizedName.length])) {
          if (!best || normalizedName.length > best.length) {
            best = { folder, length: normalizedName.length };
          }
          break;
        }
        start = normalizedUtterance.indexOf(normalizedName, start + normalizedName.length);
      }
    }
  }
  return best?.folder.uri;
}
function folderFromRelatedSession(results, candidates, folders) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.sessionId, candidate]));
  for (const result of results) {
    if (result.confidence < RELATED_SESSION_FOLDER_CONFIDENCE) {
      continue;
    }
    const candidate = candidateById.get(result.sessionId);
    const folder = candidate && folderForSessionMetadata(candidate, folders);
    if (folder) {
      return folder.uri;
    }
  }
  return void 0;
}
function folderForSessionMetadata(candidate, folders) {
  for (const path of [candidate.cwd, candidate.repo]) {
    if (!path) {
      continue;
    }
    const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/, "").replace(/^([a-zA-Z]:\/)/, "/$1").toLocaleLowerCase();
    const match = folders.filter((folder) => {
      const folderPath = folder.uri.path.replace(/\/+$/, "").toLocaleLowerCase();
      return normalizedPath === folderPath || normalizedPath.startsWith(`${folderPath}/`) || normalizedPath.endsWith(`/${folder.name.toLocaleLowerCase()}`) || normalizedPath.endsWith(`/${folder.name.toLocaleLowerCase()}.git`);
    }).sort((a, b) => b.uri.path.length - a.uri.path.length)[0];
    if (match) {
      return match;
    }
  }
  return void 0;
}
function isWordBoundary(value) {
  return value === void 0 || !/[\p{L}\p{N}_-]/u.test(value);
}
export {
  ROUTE_ENRICH_MAX_CANDIDATES,
  parseExplicitNewSessionRequest,
  resolveNewSessionWorkspaceFolder,
  selectBestSessionRoute,
  selectRouterShortlist
};
