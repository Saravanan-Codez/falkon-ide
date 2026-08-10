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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { IUserDataSyncLogService, IUserDataSyncStoreService, UserDataSyncErrorCode } from "./userDataSync.js";
const IUserDataSyncAccountService = createDecorator("IUserDataSyncAccountService");
let UserDataSyncAccountService = class extends Disposable {
  constructor(userDataSyncStoreService, logService) {
    super();
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.logService = logService;
    this._onDidChangeAccount = this._register(new Emitter());
    this.onDidChangeAccount = this._onDidChangeAccount.event;
    this._onTokenFailed = this._register(new Emitter());
    this.onTokenFailed = this._onTokenFailed.event;
    this.wasTokenFailed = false;
    this._register(userDataSyncStoreService.onTokenFailed((code) => {
      this.logService.info("Settings Sync auth token failed", this.account?.authenticationProviderId, this.wasTokenFailed, code);
      this.updateAccount(void 0);
      if (code === UserDataSyncErrorCode.Forbidden) {
        this._onTokenFailed.fire(
          true
          /*bail out immediately*/
        );
      } else {
        this._onTokenFailed.fire(
          this.wasTokenFailed
          /* bail out if token failed before */
        );
      }
      this.wasTokenFailed = true;
    }));
    this._register(userDataSyncStoreService.onTokenSucceed(() => this.wasTokenFailed = false));
  }
  get account() {
    return this._account;
  }
  async updateAccount(account) {
    if (account && this._account ? account.token !== this._account.token || account.authenticationProviderId !== this._account.authenticationProviderId : account !== this._account) {
      this._account = account;
      if (this._account) {
        this.userDataSyncStoreService.setAuthToken(this._account.token, this._account.authenticationProviderId);
      }
      this._onDidChangeAccount.fire(account);
    }
  }
};
UserDataSyncAccountService = __decorateClass([
  __decorateParam(0, IUserDataSyncStoreService),
  __decorateParam(1, IUserDataSyncLogService)
], UserDataSyncAccountService);
export {
  IUserDataSyncAccountService,
  UserDataSyncAccountService
};
