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
import { getMediaOrTextMime } from "../../../../base/common/mime.js";
import { URI } from "../../../../base/common/uri.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../platform/files/common/files.js";
let BrowserRemoteResourceLoader = class extends Disposable {
  constructor(fileService, provider) {
    super();
    this.provider = provider;
    this._register(provider.onDidReceiveRequest(async (request) => {
      let uri;
      try {
        uri = JSON.parse(decodeURIComponent(request.uri.query));
      } catch {
        return request.respondWith(404, new Uint8Array(), {});
      }
      let content;
      try {
        content = await fileService.readFile(URI.from(uri, true));
      } catch (e) {
        const str = VSBuffer.fromString(e.message).buffer;
        if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
          return request.respondWith(404, str, {});
        } else {
          return request.respondWith(500, str, {});
        }
      }
      const mime = uri.path && getMediaOrTextMime(uri.path);
      request.respondWith(200, content.value.buffer, mime ? { "content-type": mime } : {});
    }));
  }
  getResourceUriProvider() {
    const baseUri = URI.parse(document.location.href);
    return (uri) => baseUri.with({
      path: this.provider.path,
      query: JSON.stringify(uri)
    });
  }
};
BrowserRemoteResourceLoader = __decorateClass([
  __decorateParam(0, IFileService)
], BrowserRemoteResourceLoader);
export {
  BrowserRemoteResourceLoader
};
