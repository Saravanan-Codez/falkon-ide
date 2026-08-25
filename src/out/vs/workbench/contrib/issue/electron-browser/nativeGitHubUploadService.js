var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
let NativeGitHubUploadService = class extends Disposable {
  constructor(logService, nativeHostService) {
    super();
    this.logService = logService;
    this.nativeHostService = nativeHostService;
  }
  async resolveRepositoryId(owner, repo, token) {
    const headers = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`Repo ID lookup failed for ${owner}/${repo}: ${r.status} ${r.statusText}${body ? ` \u2014 ${body.substring(0, 300)}` : ""}`);
    }
    const json = await r.json();
    return String(json.id);
  }
  async uploadViaMobileApi(token, repoId, files) {
    const results = [];
    for (const file of files) {
      const result = await this.nativeHostService.uploadFileViaMobileApi(
        token,
        repoId,
        file.name,
        VSBuffer.wrap(file.bytes),
        file.contentType
      );
      this.logService.info(`[GitHubUpload] Uploaded ${file.name} (${file.bytes.length} bytes) -> ${result.assetUrl}`);
      results.push(result);
    }
    return results;
  }
};
NativeGitHubUploadService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, INativeHostService)
], NativeGitHubUploadService);
export {
  NativeGitHubUploadService
};
