import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/path.js";
import { URI } from "../../../../base/common/uri.js";
import { tryResolvePrimaryWorktreeRoot } from "../../common/agentHostGitService.js";
async function resolveGitProject(workingDirectory, gitService) {
  if (!workingDirectory || workingDirectory.scheme !== Schemas.file) {
    return void 0;
  }
  const repositoryRoot = await gitService.getRepositoryRoot(workingDirectory);
  if (!repositoryRoot) {
    return void 0;
  }
  const uri = await tryResolvePrimaryWorktreeRoot(gitService, repositoryRoot) ?? repositoryRoot;
  return { uri, displayName: basename(uri.fsPath) || uri.toString() };
}
function projectFromRepository(repository) {
  const uri = repository.includes("://") ? URI.parse(repository) : URI.parse(`https://github.com/${repository}`);
  const rawDisplayName = basename(uri.path) || repository.split("/").filter(Boolean).pop() || repository;
  const displayName = rawDisplayName.endsWith(".git") ? rawDisplayName.slice(0, -".git".length) : rawDisplayName;
  return { uri, displayName };
}
async function projectFromCopilotContext(context, gitService) {
  const workingDirectory = typeof context?.cwd === "string" ? URI.file(context.cwd) : typeof context?.gitRoot === "string" ? URI.file(context.gitRoot) : void 0;
  const gitProject = await resolveGitProject(workingDirectory, gitService);
  if (gitProject) {
    return gitProject;
  }
  if (context?.repository) {
    return projectFromRepository(context.repository);
  }
  return void 0;
}
export {
  projectFromCopilotContext,
  projectFromRepository,
  resolveGitProject
};
