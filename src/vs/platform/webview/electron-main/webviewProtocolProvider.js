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
import { protocol } from "electron";
import { COI, FileAccess, Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
import { IFileService } from "../../files/common/files.js";
let WebviewProtocolProvider = class {
  constructor(_fileService) {
    this._fileService = _fileService;
    const webviewHandler = this.handleWebviewRequest.bind(this);
    protocol.handle(Schemas.vscodeWebview, webviewHandler);
  }
  static {
    this.validWebviewFilePaths = /* @__PURE__ */ new Map([
      ["/index.html", { mime: "text/html" }],
      ["/fake.html", { mime: "text/html" }],
      ["/service-worker.js", { mime: "application/javascript" }]
    ]);
  }
  dispose() {
    protocol.unhandle(Schemas.vscodeWebview);
  }
  async handleWebviewRequest(request) {
    try {
      const uri = URI.parse(request.url);
      const entry = WebviewProtocolProvider.validWebviewFilePaths.get(uri.path);
      if (entry) {
        const relativeResourcePath = `vs/workbench/contrib/webview/browser/pre${uri.path}`;
        const url = FileAccess.asFileUri(relativeResourcePath);
        const content = await this._fileService.readFile(url);
        return new Response(content.value.buffer, {
          headers: {
            "Content-Type": entry.mime,
            ...COI.getHeadersFromQuery(request.url),
            "Cross-Origin-Resource-Policy": "cross-origin"
          }
        });
      } else {
        return new Response(null, { status: 403 });
      }
    } catch {
    }
    return new Response(null, { status: 500 });
  }
};
WebviewProtocolProvider = __decorateClass([
  __decorateParam(0, IFileService)
], WebviewProtocolProvider);
export {
  WebviewProtocolProvider
};
