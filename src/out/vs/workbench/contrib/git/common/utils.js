import { equalsIgnoreCase } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
function hasGitHubRemotes(repositoryState) {
  const hosts = ["github.com", "ghe.com"];
  const remotes = getOrderedRemotes(repositoryState).filter((remote) => !!remote.fetchUrl).map((remote) => parseRemoteUrl(remote.fetchUrl));
  for (const remote of remotes) {
    if (!remote?.host) {
      continue;
    }
    if (hosts.some((host) => equalsIgnoreCase(remote.host, host)) || hosts.some((host) => remote.host.endsWith(host))) {
      return true;
    }
  }
  return false;
}
function getGitHubRemoteInfo(repositoryState) {
  for (const remote of getOrderedRemotes(repositoryState)) {
    if (remote.fetchUrl) {
      const repository = getGitHubRepositoryFromRemoteUrl(remote.fetchUrl);
      if (repository) {
        return repository;
      }
    }
  }
  return void 0;
}
function getGitHubRepositoryFromRemoteUrl(remoteUrl) {
  const remote = parseRemoteUrl(remoteUrl);
  if (!remote) {
    return void 0;
  }
  const host = equalsIgnoreCase(remote.scheme, "ssh") ? remote.host : remote.rawHost;
  if (!equalsIgnoreCase(host, "github.com") && !equalsIgnoreCase(host, "www.github.com")) {
    return void 0;
  }
  const segments = remote.path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/i, "").split("/");
  return segments.length === 2 && segments[0] && segments[1] ? { owner: segments[0], repo: segments[1] } : void 0;
}
function getOrderedRemotes(repositoryState) {
  if (repositoryState.remotes.length < 2) {
    return repositoryState.remotes;
  }
  const remotes = /* @__PURE__ */ new Map();
  const remoteIndex = repositoryState.remotes.findIndex((r) => r.name === repositoryState.HEAD?.upstream?.remote);
  if (remoteIndex !== -1) {
    const fetchUrl = repositoryState.remotes[remoteIndex].fetchUrl;
    if (fetchUrl) {
      remotes.set(repositoryState.remotes[remoteIndex].name, repositoryState.remotes[remoteIndex]);
    }
  }
  const originIndex = repositoryState.remotes.findIndex((r) => r.name === "origin");
  if (originIndex !== -1) {
    const fetchUrl = repositoryState.remotes[originIndex].fetchUrl;
    if (fetchUrl) {
      remotes.set(repositoryState.remotes[originIndex].name, repositoryState.remotes[originIndex]);
    }
  }
  for (const remote of repositoryState.remotes) {
    if (!remotes.has(remote.name)) {
      remotes.set(remote.name, remote);
    }
  }
  return Array.from(remotes.values());
}
function parseRemoteUrl(fetchUrl) {
  fetchUrl = fetchUrl.trim();
  try {
    if (/^[\w\d\-]+@/i.test(fetchUrl)) {
      const parts = fetchUrl.split(":");
      if (parts.length !== 2) {
        return void 0;
      }
      fetchUrl = "ssh://" + parts[0] + "/" + parts[1];
    }
    const repoUrl = URI.parse(fetchUrl);
    const authority = repoUrl.authority;
    const path = repoUrl.path;
    if (!(equalsIgnoreCase(repoUrl.scheme, "ssh") || equalsIgnoreCase(repoUrl.scheme, "https") || equalsIgnoreCase(repoUrl.scheme, "http"))) {
      return;
    }
    const splitAuthority = authority.split("@");
    if (splitAuthority.length > 2) {
      return void 0;
    }
    const extractedHost = splitAuthority.at(-1);
    if (!extractedHost) {
      return;
    }
    const rawHost = extractedHost.toLowerCase().replace(/:\d+$/, "");
    const normalizedHost = rawHost.replace(/^[\w\-]+-/, "").replace(/-[\w\-]+$/, "");
    return { scheme: repoUrl.scheme, host: normalizedHost, rawHost, path };
  } catch (err) {
    return void 0;
  }
}
export {
  getGitHubRemoteInfo,
  getGitHubRepositoryFromRemoteUrl,
  hasGitHubRemotes
};
