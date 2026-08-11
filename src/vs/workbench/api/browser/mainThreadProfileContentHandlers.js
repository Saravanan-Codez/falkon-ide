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
import { revive } from "../../../base/common/marshalling.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IUserDataProfileImportExportService } from "../../services/userDataProfile/common/userDataProfile.js";
let MainThreadProfileContentHandlers = class extends Disposable {
  constructor(context, userDataProfileImportExportService) {
    super();
    this.userDataProfileImportExportService = userDataProfileImportExportService;
    this.registeredHandlers = this._register(new DisposableMap());
    this.proxy = context.getProxy(ExtHostContext.ExtHostProfileContentHandlers);
  }
  async $registerProfileContentHandler(id, name, description, extensionId) {
    this.registeredHandlers.set(id, this.userDataProfileImportExportService.registerProfileContentHandler(id, {
      name,
      description,
      extensionId,
      saveProfile: async (name2, content, token) => {
        const result = await this.proxy.$saveProfile(id, name2, content, token);
        return result ? revive(result) : null;
      },
      readProfile: async (uri, token) => {
        return this.proxy.$readProfile(id, uri, token);
      }
    }));
  }
  async $unregisterProfileContentHandler(id) {
    this.registeredHandlers.deleteAndDispose(id);
  }
};
MainThreadProfileContentHandlers = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadProfileContentHandlers),
  __decorateParam(1, IUserDataProfileImportExportService)
], MainThreadProfileContentHandlers);
export {
  MainThreadProfileContentHandlers
};
