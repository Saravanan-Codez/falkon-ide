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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { TextEdit } from "../../../editor/common/languages.js";
import { ICodeMapperService } from "../../contrib/chat/common/editing/chatCodeMapperService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
let MainThreadChatCodemapper = class extends Disposable {
  constructor(extHostContext, codeMapperService) {
    super();
    this.codeMapperService = codeMapperService;
    this.providers = this._register(new DisposableMap());
    this._responseMap = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostCodeMapper);
  }
  $registerCodeMapperProvider(handle, displayName) {
    const impl = {
      displayName,
      mapCode: async (uiRequest, response, token) => {
        const requestId = String(MainThreadChatCodemapper._requestHandlePool++);
        this._responseMap.set(requestId, response);
        const extHostRequest = {
          requestId,
          codeBlocks: uiRequest.codeBlocks,
          chatRequestId: uiRequest.chatRequestId,
          chatRequestModel: uiRequest.chatRequestModel,
          chatSessionResource: uiRequest.chatSessionResource,
          location: uiRequest.location
        };
        try {
          return await this._proxy.$mapCode(handle, extHostRequest, token).then((result) => result ?? void 0);
        } finally {
          this._responseMap.delete(requestId);
        }
      }
    };
    const disposable = this.codeMapperService.registerCodeMapperProvider(handle, impl);
    this.providers.set(handle, disposable);
  }
  $unregisterCodeMapperProvider(handle) {
    this.providers.deleteAndDispose(handle);
  }
  $handleProgress(requestId, data) {
    const response = this._responseMap.get(requestId);
    if (response) {
      const edits = data.edits;
      const resource = URI.revive(data.uri);
      if (!edits.length) {
        response.textEdit(resource, []);
      } else if (edits.every(TextEdit.isTextEdit)) {
        response.textEdit(resource, edits);
      } else {
        response.notebookEdit(resource, edits.map(NotebookDto.fromCellEditOperationDto));
      }
    }
    return Promise.resolve();
  }
};
MainThreadChatCodemapper._requestHandlePool = 0;
MainThreadChatCodemapper = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadCodeMapper),
  __decorateParam(1, ICodeMapperService)
], MainThreadChatCodemapper);
export {
  MainThreadChatCodemapper
};
