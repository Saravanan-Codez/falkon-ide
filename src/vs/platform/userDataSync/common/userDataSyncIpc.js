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
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IProductService } from "../../product/common/productService.js";
import { IStorageService } from "../../storage/common/storage.js";
import { AbstractUserDataSyncStoreManagementService } from "./userDataSyncStoreService.js";
class UserDataSyncAccountServiceChannel {
  constructor(service) {
    this.service = service;
  }
  listen(_, event) {
    switch (event) {
      case "onDidChangeAccount":
        return this.service.onDidChangeAccount;
      case "onTokenFailed":
        return this.service.onTokenFailed;
    }
    throw new Error(`[UserDataSyncAccountServiceChannel] Event not found: ${event}`);
  }
  call(context, command, args) {
    switch (command) {
      case "_getInitialData":
        return Promise.resolve(this.service.account);
      case "updateAccount":
        return this.service.updateAccount(args);
    }
    throw new Error("Invalid call");
  }
}
class UserDataSyncAccountServiceChannelClient extends Disposable {
  constructor(channel) {
    super();
    this.channel = channel;
    this._onDidChangeAccount = this._register(new Emitter());
    this.onDidChangeAccount = this._onDidChangeAccount.event;
    this.channel.call("_getInitialData").then((account) => {
      this._account = account;
      this._register(this.channel.listen("onDidChangeAccount")((account2) => {
        this._account = account2;
        this._onDidChangeAccount.fire(account2);
      }));
    });
  }
  get account() {
    return this._account;
  }
  get onTokenFailed() {
    return this.channel.listen("onTokenFailed");
  }
  updateAccount(account) {
    return this.channel.call("updateAccount", account);
  }
}
class UserDataSyncStoreManagementServiceChannel {
  constructor(service) {
    this.service = service;
  }
  listen(_, event) {
    switch (event) {
      case "onDidChangeUserDataSyncStore":
        return this.service.onDidChangeUserDataSyncStore;
    }
    throw new Error(`[UserDataSyncStoreManagementServiceChannel] Event not found: ${event}`);
  }
  call(context, command, args) {
    switch (command) {
      case "switch":
        return this.service.switch(args[0]);
      case "getPreviousUserDataSyncStore":
        return this.service.getPreviousUserDataSyncStore();
    }
    throw new Error("Invalid call");
  }
}
let UserDataSyncStoreManagementServiceChannelClient = class extends AbstractUserDataSyncStoreManagementService {
  constructor(channel, productService, configurationService, storageService) {
    super(productService, configurationService, storageService);
    this.channel = channel;
    this._register(this.channel.listen("onDidChangeUserDataSyncStore")(() => this.updateUserDataSyncStore()));
  }
  async switch(type) {
    return this.channel.call("switch", [type]);
  }
  async getPreviousUserDataSyncStore() {
    const userDataSyncStore = await this.channel.call("getPreviousUserDataSyncStore");
    return this.revive(userDataSyncStore);
  }
  revive(userDataSyncStore) {
    return {
      url: URI.revive(userDataSyncStore.url),
      type: userDataSyncStore.type,
      defaultUrl: URI.revive(userDataSyncStore.defaultUrl),
      insidersUrl: URI.revive(userDataSyncStore.insidersUrl),
      stableUrl: URI.revive(userDataSyncStore.stableUrl),
      canSwitch: userDataSyncStore.canSwitch,
      authenticationProviders: userDataSyncStore.authenticationProviders
    };
  }
};
UserDataSyncStoreManagementServiceChannelClient = __decorateClass([
  __decorateParam(1, IProductService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IStorageService)
], UserDataSyncStoreManagementServiceChannelClient);
export {
  UserDataSyncAccountServiceChannel,
  UserDataSyncAccountServiceChannelClient,
  UserDataSyncStoreManagementServiceChannel,
  UserDataSyncStoreManagementServiceChannelClient
};
