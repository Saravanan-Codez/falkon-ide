import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { GITHUB_REMOTE_FILE_SCHEME } from "../../../services/sessions/common/session.js";
function toPRContentUri(fileName, params) {
  return URI.from({
    scheme: Schemas.copilotPr,
    path: `/${fileName}`,
    query: JSON.stringify({ ...params, fileName })
  });
}
function getPullRequestKey(owner, repo, prNumber) {
  return `${owner}/${repo}/${prNumber}`;
}
function getGitHubRepositoryFromUri(uri) {
  if (uri.scheme !== GITHUB_REMOTE_FILE_SCHEME) {
    return void 0;
  }
  const segments = uri.path.split("/").filter(Boolean);
  if (segments.length < 2) {
    return void 0;
  }
  try {
    return {
      owner: decodeURIComponent(segments[0]),
      repo: decodeURIComponent(segments[1])
    };
  } catch {
    return void 0;
  }
}
export {
  getGitHubRepositoryFromUri,
  getPullRequestKey,
  toPRContentUri
};
