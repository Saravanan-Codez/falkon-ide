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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
const EXTENSION_ENABLED_CONTEXT_KEY_PREFIX = "extensionEnabled:";
let ExtensionEnablementContextKeysContribution = class extends Disposable {
  constructor(contextKeyService, extensionService) {
    super();
    this.contextKeyService = contextKeyService;
    this.extensionService = extensionService;
    this._contextKeys = /* @__PURE__ */ new Map();
    this._reconcile();
    this._register(this.extensionService.onDidRegisterExtensions(() => this._reconcile()));
    this._register(this.extensionService.onDidChangeExtensions(() => this._reconcile()));
  }
  _reconcile() {
    const enabledKeys = /* @__PURE__ */ new Set();
    for (const extension of this.extensionService.extensions) {
      enabledKeys.add(EXTENSION_ENABLED_CONTEXT_KEY_PREFIX + ExtensionIdentifier.toKey(extension.identifier));
    }
    for (const [key, contextKey] of this._contextKeys) {
      contextKey.set(enabledKeys.has(key));
    }
    for (const key of enabledKeys) {
      if (!this._contextKeys.has(key)) {
        this._contextKeys.set(key, this.contextKeyService.createKey(key, true));
      }
    }
  }
};
ExtensionEnablementContextKeysContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IExtensionService)
], ExtensionEnablementContextKeysContribution);
export {
  EXTENSION_ENABLED_CONTEXT_KEY_PREFIX,
  ExtensionEnablementContextKeysContribution
};
