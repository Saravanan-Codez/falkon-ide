import { URI } from "../../../base/common/uri.js";
const GIT_BLOB_SCHEME = "git-blob";
function buildGitBlobUri(sessionUri, sha, repoRelativePath, absolutePath) {
  return URI.from({
    scheme: GIT_BLOB_SCHEME,
    path: absolutePath,
    query: JSON.stringify({ sessionUri, sha, repoRelativePath })
  }).toString();
}
function parseGitBlobUri(raw) {
  let parsed;
  try {
    parsed = URI.parse(raw);
  } catch {
    return void 0;
  }
  if (parsed.scheme !== GIT_BLOB_SCHEME || !parsed.query) {
    return void 0;
  }
  try {
    const query = JSON.parse(parsed.query);
    if (typeof query.sessionUri === "string" && typeof query.sha === "string" && typeof query.repoRelativePath === "string") {
      return {
        sessionUri: query.sessionUri,
        sha: query.sha,
        repoRelativePath: query.repoRelativePath
      };
    }
  } catch {
    return void 0;
  }
  return void 0;
}
export {
  buildGitBlobUri,
  parseGitBlobUri
};
