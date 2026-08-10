import { isUNC } from "../../../../base/common/extpath.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { getWebviewContentMimeType } from "../../../../platform/webview/common/mimeTypes.js";
var WebviewResourceResponse;
((WebviewResourceResponse2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Success"] = 0] = "Success";
    Type2[Type2["Failed"] = 1] = "Failed";
    Type2[Type2["AccessDenied"] = 2] = "AccessDenied";
    Type2[Type2["NotModified"] = 3] = "NotModified";
  })(Type = WebviewResourceResponse2.Type || (WebviewResourceResponse2.Type = {}));
  class StreamSuccess {
    constructor(stream, etag, mtime, mimeType, size) {
      this.stream = stream;
      this.etag = etag;
      this.mtime = mtime;
      this.mimeType = mimeType;
      this.size = size;
      this.type = 0 /* Success */;
    }
  }
  WebviewResourceResponse2.StreamSuccess = StreamSuccess;
  WebviewResourceResponse2.Failed = { type: 1 /* Failed */ };
  WebviewResourceResponse2.AccessDenied = { type: 2 /* AccessDenied */ };
  class NotModified {
    constructor(mimeType, mtime) {
      this.mimeType = mimeType;
      this.mtime = mtime;
      this.type = 3 /* NotModified */;
    }
  }
  WebviewResourceResponse2.NotModified = NotModified;
})(WebviewResourceResponse || (WebviewResourceResponse = {}));
async function loadLocalResource(accessor, requestUri, options, token) {
  const uriIdentityService = accessor.get(IUriIdentityService);
  const fileService = accessor.get(IFileService);
  const logService = accessor.get(ILogService);
  const resourceToLoad = getResourceToLoad(requestUri, options.roots, uriIdentityService);
  logService.trace(`Webview.loadLocalResource - trying to load resource. requestUri=${requestUri}, resourceToLoad=${resourceToLoad}`);
  if (!resourceToLoad) {
    logService.trace(`Webview.loadLocalResource - access denied. requestUri=${requestUri}, resourceToLoad=${resourceToLoad}`);
    return WebviewResourceResponse.AccessDenied;
  }
  const mime = getWebviewContentMimeType(requestUri);
  try {
    const readOptions = { etag: options.ifNoneMatch };
    if (options.range) {
      readOptions.position = options.range.start;
      if (options.range.end !== void 0) {
        if (options.range.end < options.range.start) {
          return WebviewResourceResponse.Failed;
        }
        readOptions.length = options.range.end - options.range.start + 1;
      }
    }
    const result = await fileService.readFileStream(resourceToLoad, readOptions, token);
    logService.trace(`Webview.loadLocalResource - Loaded. requestUri=${requestUri}, resourceToLoad=${resourceToLoad}`);
    return new WebviewResourceResponse.StreamSuccess(result.value, result.etag, result.mtime, mime, result.size);
  } catch (err) {
    if (err instanceof FileOperationError) {
      const result = err.fileOperationResult;
      if (result === FileOperationResult.FILE_NOT_MODIFIED_SINCE) {
        logService.trace(`Webview.loadLocalResource - not modified. requestUri=${requestUri}, resourceToLoad=${resourceToLoad}`);
        return new WebviewResourceResponse.NotModified(mime, err.options?.mtime);
      }
    }
    logService.error(`Webview.loadLocalResource - Error using fileReader. requestUri=${requestUri}, resourceToLoad=${resourceToLoad}`);
    return WebviewResourceResponse.Failed;
  }
}
function getResourceToLoad(requestUri, roots, uriIdentityService) {
  const requestUriNoQueryString = requestUri.with({ query: "" });
  for (const root of roots) {
    if (containsResource(root, requestUriNoQueryString, uriIdentityService)) {
      return normalizeResourcePath(requestUri);
    }
  }
  return void 0;
}
function containsResource(root, resource, uriIdentityService) {
  if (uriIdentityService.extUri.isEqual(
    root,
    resource,
    /* ignoreFragment */
    true
  )) {
    return false;
  }
  if (root.scheme === Schemas.file && isUNC(root.fsPath)) {
    if (resource.scheme === Schemas.file && isUNC(resource.fsPath)) {
      return uriIdentityService.extUri.isEqualOrParent(
        resource.with({
          path: resource.path.toLowerCase(),
          authority: resource.authority.toLowerCase()
        }),
        root.with({
          path: root.path.toLowerCase(),
          authority: root.authority.toLowerCase()
        }),
        /* ignoreFragment */
        true
      );
    }
    return false;
  }
  return uriIdentityService.extUri.isEqualOrParent(
    resource,
    root,
    /* ignoreFragment */
    true
  );
}
function normalizeResourcePath(resource) {
  if (resource.scheme === Schemas.vscodeRemote) {
    return URI.from({
      scheme: Schemas.vscodeRemote,
      authority: resource.authority,
      path: "/vscode-resource",
      query: JSON.stringify({
        requestResourcePath: resource.path
      })
    });
  }
  return resource;
}
export {
  WebviewResourceResponse,
  getResourceToLoad,
  loadLocalResource
};
