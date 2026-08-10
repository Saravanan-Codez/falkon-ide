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
import { Action } from "../../../base/common/actions.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { localize } from "../../../nls.js";
import { INotificationService, Severity } from "../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { defaultExternalUriOpenerId } from "../../contrib/externalUriOpener/common/configuration.js";
import { ContributedExternalUriOpenersStore } from "../../contrib/externalUriOpener/common/contributedOpeners.js";
import { IExternalUriOpenerService } from "../../contrib/externalUriOpener/common/externalUriOpenerService.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadUriOpeners = class extends Disposable {
  constructor(context, storageService, externalUriOpenerService, extensionService, openerService, notificationService) {
    super();
    this.extensionService = extensionService;
    this.openerService = openerService;
    this.notificationService = notificationService;
    this._registeredOpeners = /* @__PURE__ */ new Map();
    this.proxy = context.getProxy(ExtHostContext.ExtHostUriOpeners);
    this._register(externalUriOpenerService.registerExternalOpenerProvider(this));
    this._contributedExternalUriOpenersStore = this._register(new ContributedExternalUriOpenersStore(storageService, extensionService));
  }
  async *getOpeners(targetUri) {
    if (targetUri.scheme !== Schemas.http && targetUri.scheme !== Schemas.https) {
      return;
    }
    await this.extensionService.activateByEvent(`onOpenExternalUri:${targetUri.scheme}`);
    for (const [id, openerMetadata] of this._registeredOpeners) {
      if (openerMetadata.schemes.has(targetUri.scheme)) {
        yield this.createOpener(id, openerMetadata);
      }
    }
  }
  createOpener(id, metadata) {
    return {
      id,
      label: metadata.label,
      canOpen: (uri, token) => {
        return this.proxy.$canOpenUri(id, uri, token);
      },
      openExternalUri: async (uri, ctx, token) => {
        try {
          await this.proxy.$openUri(id, { resolvedUri: uri, sourceUri: ctx.sourceUri }, token);
        } catch (e) {
          if (!isCancellationError(e)) {
            const openDefaultAction = new Action("default", localize("openerFailedUseDefault", "Open using default opener"), void 0, void 0, async () => {
              await this.openerService.open(uri, {
                allowTunneling: false,
                allowContributedOpeners: defaultExternalUriOpenerId
              });
            });
            openDefaultAction.tooltip = uri.toString();
            this.notificationService.notify({
              severity: Severity.Error,
              message: localize({
                key: "openerFailedMessage",
                comment: ["{0} is the id of the opener. {1} is the url being opened."]
              }, "Could not open uri with '{0}': {1}", id, e.toString()),
              actions: {
                primary: [
                  openDefaultAction
                ]
              }
            });
          }
        }
        return true;
      }
    };
  }
  async $registerUriOpener(id, schemes, extensionId, label) {
    if (this._registeredOpeners.has(id)) {
      throw new Error(`Opener with id '${id}' already registered`);
    }
    this._registeredOpeners.set(id, {
      schemes: new Set(schemes),
      label,
      extensionId
    });
    this._contributedExternalUriOpenersStore.didRegisterOpener(id, extensionId.value);
  }
  async $unregisterUriOpener(id) {
    this._registeredOpeners.delete(id);
    this._contributedExternalUriOpenersStore.delete(id);
  }
  dispose() {
    super.dispose();
    this._registeredOpeners.clear();
  }
};
MainThreadUriOpeners = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadUriOpeners),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IExternalUriOpenerService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, INotificationService)
], MainThreadUriOpeners);
export {
  MainThreadUriOpeners
};
