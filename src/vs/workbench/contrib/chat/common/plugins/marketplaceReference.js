import { URI } from "../../../../../base/common/uri.js";
import { ChatConfiguration } from "../constants.js";
import { extraKnownMarketplacesToConfigDict } from "../../../../../base/common/managedSettings.js";
var MarketplaceReferenceKind = /* @__PURE__ */ ((MarketplaceReferenceKind2) => {
  MarketplaceReferenceKind2["GitHubShorthand"] = "githubShorthand";
  MarketplaceReferenceKind2["GitUri"] = "gitUri";
  MarketplaceReferenceKind2["LocalFileUri"] = "localFileUri";
  return MarketplaceReferenceKind2;
})(MarketplaceReferenceKind || {});
const _githubShorthandRe = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:#.+)?$/;
function readConfiguredMarketplaces(configurationService) {
  const userValues = configurationService.getValue(ChatConfiguration.PluginMarketplaces) ?? [];
  const extraObj = configurationService.getValue(ChatConfiguration.ExtraMarketplaces) ?? {};
  const extraValues = Object.entries(extraObj).flatMap(([name, value]) => {
    if (typeof value !== "string") {
      return [];
    }
    const encoded = parseExtraMarketplaceConfigValue(value);
    const src = encoded?.source ?? value;
    const autoUpdate = encoded?.autoUpdate;
    const isGithubShorthand = _githubShorthandRe.test(src);
    return [isGithubShorthand ? { name, autoUpdate, source: { source: "github", repo: src } } : { name, autoUpdate, source: { source: "git", url: src } }];
  });
  return {
    userValues,
    extraValues,
    effectiveValues: [...userValues, ...extraValues]
  };
}
function parseExtraMarketplaceConfigValue(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && typeof parsed.source === "string" && typeof parsed.autoUpdate === "boolean" ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function parseMarketplaceReferences(values) {
  const byCanonicalId = /* @__PURE__ */ new Map();
  for (const value of values) {
    let parsed;
    if (typeof value === "string") {
      parsed = parseMarketplaceReference(value);
    } else if (value && typeof value === "object") {
      parsed = parseMarketplaceObjectEntry(value);
    }
    if (parsed) {
      const existing = byCanonicalId.get(parsed.canonicalId);
      if (!existing) {
        byCanonicalId.set(parsed.canonicalId, parsed);
      } else if (parsed.autoUpdate !== void 0) {
        byCanonicalId.set(parsed.canonicalId, { ...existing, autoUpdate: parsed.autoUpdate });
      }
    }
  }
  return [...byCanonicalId.values()];
}
function parseMarketplaceObjectEntry(entry) {
  let sourceType;
  let repo;
  let url;
  let ref;
  if (entry.source && typeof entry.source === "object") {
    const nested = entry.source;
    sourceType = nested.source;
    repo = nested.repo;
    url = nested.url;
    ref = nested.ref;
  } else {
    sourceType = entry.source;
    repo = entry.repo;
    url = entry.url;
    ref = entry.ref;
  }
  let parsed;
  if (sourceType === "github" && typeof repo === "string") {
    parsed = parseMarketplaceReference(appendMarketplaceRef(repo, ref));
  } else if (sourceType === "git" && typeof url === "string") {
    parsed = parseMarketplaceReference(appendMarketplaceRef(url, ref));
  }
  if (parsed && typeof entry.name === "string" && entry.name.length > 0) {
    parsed = { ...parsed, displayLabel: entry.name };
  }
  if (parsed && typeof entry.autoUpdate === "boolean") {
    parsed = { ...parsed, autoUpdate: entry.autoUpdate };
  }
  return parsed;
}
function appendMarketplaceRef(value, ref) {
  if (!ref) {
    return value;
  }
  const fragmentIndex = value.indexOf("#");
  const base = fragmentIndex === -1 ? value : value.slice(0, fragmentIndex);
  return `${base}#${ref}`;
}
function deduplicateMarketplaceReferences(primary, secondary) {
  const byCanonicalId = /* @__PURE__ */ new Map();
  for (const ref of primary) {
    byCanonicalId.set(ref.canonicalId, ref);
  }
  for (const ref of secondary) {
    if (!byCanonicalId.has(ref.canonicalId)) {
      byCanonicalId.set(ref.canonicalId, ref);
    }
  }
  return [...byCanonicalId.values()];
}
function parseMarketplaceReference(value) {
  const rawValue = value.trim();
  if (!rawValue) {
    return void 0;
  }
  const uriReference = parseUriMarketplaceReference(rawValue);
  if (uriReference) {
    return uriReference;
  }
  const scpReference = parseScpMarketplaceReference(rawValue);
  if (scpReference) {
    return scpReference;
  }
  const shorthandMatch = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:#(.+))?$/.exec(rawValue);
  if (shorthandMatch) {
    const owner = shorthandMatch[1];
    const repo = shorthandMatch[2];
    const ref = shorthandMatch[3];
    return {
      rawValue,
      displayLabel: rawValue,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
      canonicalId: getGitHubCanonicalId(owner, repo, ref),
      cacheSegments: ["github.com", owner, repo, ...getRefCacheSegments(ref)],
      kind: "githubShorthand" /* GitHubShorthand */,
      ref,
      githubRepo: `${owner}/${repo}`
    };
  }
  return void 0;
}
function parseUriMarketplaceReference(rawValue) {
  let uri;
  try {
    uri = URI.parse(rawValue);
  } catch {
    return void 0;
  }
  const scheme = uri.scheme.toLowerCase();
  if (scheme === "file" && /^file:\/\//i.test(rawValue)) {
    if (uri.fragment) {
      return void 0;
    }
    const localRepositoryUri = URI.file(uri.fsPath);
    return {
      rawValue,
      displayLabel: localRepositoryUri.fsPath,
      cloneUrl: rawValue,
      canonicalId: `file:${localRepositoryUri.toString().toLowerCase()}`,
      cacheSegments: [],
      kind: "localFileUri" /* LocalFileUri */,
      localRepositoryUri
    };
  }
  if (scheme !== "http" && scheme !== "https" && scheme !== "ssh") {
    return void 0;
  }
  if (!uri.authority) {
    return void 0;
  }
  const ref = uri.fragment || void 0;
  const cloneUri = uri.fragment ? uri.with({ fragment: "" }) : uri;
  const sanitizedAuthority = sanitizePathSegment(uri.authority.toLowerCase());
  const trimmedPath = uri.path.replace(/\/+/g, "/").replace(/\/+$/g, "").replace(/^\/+/, "");
  if (!trimmedPath) {
    return {
      rawValue,
      displayLabel: rawValue,
      cloneUrl: cloneUri.toString(),
      canonicalId: appendRefSuffix(`git:${uri.authority.toLowerCase()}/`, ref),
      cacheSegments: [sanitizedAuthority, ...getRefCacheSegments(ref)],
      kind: "gitUri" /* GitUri */,
      ref
    };
  }
  const gitSuffix = ".git";
  const pathHasGitSuffix = trimmedPath.toLowerCase().endsWith(gitSuffix);
  const pathWithoutGit = pathHasGitSuffix ? trimmedPath.slice(0, trimmedPath.length - gitSuffix.length) : trimmedPath;
  const pathSegments = pathWithoutGit.split("/").map(sanitizePathSegment);
  const canonicalPath = pathHasGitSuffix ? trimmedPath.toLowerCase() : `${trimmedPath.toLowerCase()}${gitSuffix}`;
  const githubRepo = extractGitHubRepo(uri.authority, pathWithoutGit);
  let canonicalId;
  if (githubRepo) {
    const [owner, repo] = githubRepo.split("/");
    canonicalId = getGitHubCanonicalId(owner, repo, ref);
  } else {
    canonicalId = appendRefSuffix(`git:${uri.authority.toLowerCase()}/${canonicalPath}`, ref);
  }
  return {
    rawValue,
    displayLabel: rawValue,
    cloneUrl: cloneUri.toString(),
    canonicalId,
    cacheSegments: [sanitizedAuthority, ...pathSegments, ...getRefCacheSegments(ref)],
    kind: "gitUri" /* GitUri */,
    ref,
    githubRepo
  };
}
function parseScpMarketplaceReference(rawValue) {
  const match = /^([^@\s]+)@([^:\s]+):(.+?\.git)(?:#(.+))?$/i.exec(rawValue);
  if (!match) {
    return void 0;
  }
  const gitSuffix = ".git";
  const authority = match[2];
  const pathWithGit = match[3].replace(/^\/+/, "");
  const ref = match[4];
  if (!pathWithGit.toLowerCase().endsWith(gitSuffix)) {
    return void 0;
  }
  const pathWithoutGit = pathWithGit.slice(0, -gitSuffix.length);
  const pathSegments = pathWithoutGit.split("/").map(sanitizePathSegment);
  const githubRepo = extractGitHubRepo(authority, pathWithoutGit);
  let canonicalId;
  if (githubRepo) {
    const [owner, repo] = githubRepo.split("/");
    canonicalId = getGitHubCanonicalId(owner, repo, ref);
  } else {
    canonicalId = appendRefSuffix(`git:${authority.toLowerCase()}/${pathWithGit.toLowerCase()}`, ref);
  }
  return {
    rawValue,
    displayLabel: rawValue,
    cloneUrl: `${match[1]}@${authority}:${pathWithGit}`,
    canonicalId,
    cacheSegments: [sanitizePathSegment(authority.toLowerCase()), ...pathSegments, ...getRefCacheSegments(ref)],
    kind: "gitUri" /* GitUri */,
    ref,
    githubRepo
  };
}
function extractGitHubRepo(authority, pathWithoutGit) {
  if (authority.toLowerCase() !== "github.com") {
    return void 0;
  }
  const parts = pathWithoutGit.split("/");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  return void 0;
}
function getGitHubCanonicalId(owner, repo, ref) {
  return appendRefSuffix(`github:${owner.toLowerCase()}/${repo.toLowerCase()}`, ref);
}
function appendRefSuffix(canonicalId, ref) {
  return ref ? `${canonicalId}#${encodeURIComponent(ref)}` : canonicalId;
}
function getRefCacheSegments(ref) {
  return ref ? [`ref_${encodeURIComponent(ref)}`] : [];
}
function sanitizePathSegment(value) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
export {
  MarketplaceReferenceKind,
  deduplicateMarketplaceReferences,
  extraKnownMarketplacesToConfigDict,
  parseMarketplaceObjectEntry,
  parseMarketplaceReference,
  parseMarketplaceReferences,
  readConfiguredMarketplaces
};
