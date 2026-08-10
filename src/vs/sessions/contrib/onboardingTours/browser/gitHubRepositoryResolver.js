import { Schemas } from "../../../../base/common/network.js";
import { dirname, isEqual, joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { FileOperationResult, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { getGitHubRepositoryFromRemoteUrl } from "../../../../workbench/contrib/git/common/utils.js";
const MAX_PARENT_LOOKUPS = 50;
async function resolveGitHubRepositoryFromGitConfig(fileService, workspaceUri) {
  const configUri = await findGitConfig(fileService, workspaceUri);
  if (!configUri) {
    return void 0;
  }
  const content = await readFileIfExists(fileService, configUri);
  return content ? parseGitHubRepositoryFromGitConfig(content) : void 0;
}
function parseGitHubRepositoryFromGitConfig(content) {
  const remotes = [];
  let remoteName;
  for (const line of content.split(/\r?\n/)) {
    const section = /^\s*\[\s*remote\s+"([^"]+)"\s*\]\s*$/i.exec(line);
    if (section) {
      remoteName = section[1];
      continue;
    }
    if (/^\s*\[/.test(line)) {
      remoteName = void 0;
      continue;
    }
    const url = remoteName ? /^\s*url\s*=\s*(.+?)\s*$/i.exec(line)?.[1] : void 0;
    if (url && remoteName) {
      remotes.push({ name: remoteName, url: stripQuotes(url) });
    }
  }
  remotes.sort((a, b) => Number(b.name === "origin") - Number(a.name === "origin"));
  for (const remote of remotes) {
    const repository = getGitHubRepositoryFromRemoteUrl(remote.url);
    if (repository) {
      return repository;
    }
  }
  return void 0;
}
async function findGitConfig(fileService, workspaceUri) {
  let current = workspaceUri;
  for (let i = 0; i < MAX_PARENT_LOOKUPS; i++) {
    const dotGit = joinPath(current, ".git");
    const stat = await statIfExists(fileService, dotGit);
    if (stat) {
      if (stat.isDirectory) {
        return joinPath(dotGit, "config");
      }
      const dotGitContent = await readFileIfExists(fileService, dotGit);
      const gitDirPath = dotGitContent ? /^\s*gitdir:\s*(.+?)\s*$/im.exec(dotGitContent)?.[1] : void 0;
      if (gitDirPath) {
        const gitDir = resolveGitPath(current, gitDirPath);
        const commonDirPath = await readFileIfExists(fileService, joinPath(gitDir, "commondir"));
        const configRoot = commonDirPath ? resolveGitPath(gitDir, commonDirPath.trim()) : gitDir;
        return joinPath(configRoot, "config");
      }
    }
    const parent = dirname(current);
    if (isEqual(parent, current)) {
      break;
    }
    current = parent;
  }
  return void 0;
}
function resolveGitPath(base, value) {
  const path = value.trim();
  if (/^[a-zA-Z]:[\\/]/.test(path)) {
    return URI.file(path);
  }
  const normalizedPath = path.replace(/\\/g, "/");
  if (normalizedPath.startsWith("/")) {
    return base.scheme === Schemas.file ? URI.file(path) : base.with({ path: normalizedPath });
  }
  return joinPath(base, normalizedPath);
}
async function statIfExists(fileService, resource) {
  try {
    return await fileService.stat(resource);
  } catch (error) {
    if (toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND) {
      return void 0;
    }
    throw error;
  }
}
async function readFileIfExists(fileService, resource) {
  try {
    return (await fileService.readFile(resource)).value.toString();
  } catch (error) {
    if (toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND) {
      return void 0;
    }
    throw error;
  }
}
function stripQuotes(value) {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
export {
  parseGitHubRepositoryFromGitConfig,
  resolveGitHubRepositoryFromGitConfig
};
