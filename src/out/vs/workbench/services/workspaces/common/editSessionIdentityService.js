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
import { insert } from "../../../../base/common/arrays.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IEditSessionIdentityService } from "../../../../platform/workspace/common/editSessions.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
let EditSessionIdentityService = class {
  constructor(_extensionService, _logService) {
    this._extensionService = _extensionService;
    this._logService = _logService;
    this._editSessionIdentifierProviders = /* @__PURE__ */ new Map();
    this._participants = [];
  }
  registerEditSessionIdentityProvider(provider) {
    if (this._editSessionIdentifierProviders.get(provider.scheme)) {
      throw new Error(`A provider has already been registered for scheme ${provider.scheme}`);
    }
    this._editSessionIdentifierProviders.set(provider.scheme, provider);
    return toDisposable(() => {
      this._editSessionIdentifierProviders.delete(provider.scheme);
    });
  }
  async getEditSessionIdentifier(workspaceFolder, token) {
    const { scheme } = workspaceFolder.uri;
    const provider = await this.activateProvider(scheme);
    this._logService.trace(`EditSessionIdentityProvider for scheme ${scheme} available: ${!!provider}`);
    return provider?.getEditSessionIdentifier(workspaceFolder, token);
  }
  async provideEditSessionIdentityMatch(workspaceFolder, identity1, identity2, cancellationToken) {
    const { scheme } = workspaceFolder.uri;
    const provider = await this.activateProvider(scheme);
    this._logService.trace(`EditSessionIdentityProvider for scheme ${scheme} available: ${!!provider}`);
    return provider?.provideEditSessionIdentityMatch?.(workspaceFolder, identity1, identity2, cancellationToken);
  }
  async onWillCreateEditSessionIdentity(workspaceFolder, cancellationToken) {
    this._logService.debug("Running onWillCreateEditSessionIdentity participants...");
    for (const participant of this._participants) {
      await participant.participate(workspaceFolder, cancellationToken);
    }
    this._logService.debug(`Done running ${this._participants.length} onWillCreateEditSessionIdentity participants.`);
  }
  addEditSessionIdentityCreateParticipant(participant) {
    const dispose = insert(this._participants, participant);
    return toDisposable(() => dispose());
  }
  async activateProvider(scheme) {
    const transformedScheme = scheme === "vscode-remote" ? "file" : scheme;
    const provider = this._editSessionIdentifierProviders.get(scheme);
    if (provider) {
      return provider;
    }
    await this._extensionService.activateByEvent(`onEditSession:${transformedScheme}`);
    return this._editSessionIdentifierProviders.get(scheme);
  }
};
EditSessionIdentityService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, ILogService)
], EditSessionIdentityService);
registerSingleton(IEditSessionIdentityService, EditSessionIdentityService, InstantiationType.Delayed);
export {
  EditSessionIdentityService
};
