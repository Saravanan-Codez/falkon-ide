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
import { Schemas } from "../../../base/common/network.js";
import { isFalsyOrWhitespace } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { decodeBase64 } from "../../../base/common/buffer.js";
let ExtHostWindow = class {
  constructor(initData, extHostRpc) {
    this._onDidChangeWindowState = new Emitter();
    this.onDidChangeWindowState = this._onDidChangeWindowState.event;
    this._state = ExtHostWindow.InitialState;
    if (initData.handle) {
      this._nativeHandle = decodeBase64(initData.handle).buffer;
    }
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadWindow);
    this._proxy.$getInitialState().then(({ isFocused, isActive }) => {
      this.onDidChangeWindowProperty("focused", isFocused);
      this.onDidChangeWindowProperty("active", isActive);
    });
  }
  static {
    this.InitialState = {
      focused: true,
      active: true
    };
  }
  getState() {
    const state = this._state;
    return {
      get focused() {
        return state.focused;
      },
      get active() {
        return state.active;
      }
    };
  }
  get nativeHandle() {
    return this._nativeHandle;
  }
  $onDidChangeActiveNativeWindowHandle(handle) {
    this._nativeHandle = handle ? decodeBase64(handle).buffer : void 0;
  }
  $onDidChangeWindowFocus(value) {
    this.onDidChangeWindowProperty("focused", value);
  }
  $onDidChangeWindowActive(value) {
    this.onDidChangeWindowProperty("active", value);
  }
  onDidChangeWindowProperty(property, value) {
    if (value === this._state[property]) {
      return;
    }
    this._state = { ...this._state, [property]: value };
    this._onDidChangeWindowState.fire(this._state);
  }
  openUri(stringOrUri, options) {
    let uriAsString;
    if (typeof stringOrUri === "string") {
      uriAsString = stringOrUri;
      try {
        stringOrUri = URI.parse(stringOrUri);
      } catch (e) {
        return Promise.reject(`Invalid uri - '${stringOrUri}'`);
      }
    }
    if (isFalsyOrWhitespace(stringOrUri.scheme)) {
      return Promise.reject("Invalid scheme - cannot be empty");
    } else if (stringOrUri.scheme === Schemas.command) {
      return Promise.reject(`Invalid scheme '${stringOrUri.scheme}'`);
    }
    return this._proxy.$openUri(stringOrUri, uriAsString, options);
  }
  async asExternalUri(uri, options) {
    if (isFalsyOrWhitespace(uri.scheme)) {
      return Promise.reject("Invalid scheme - cannot be empty");
    }
    const result = await this._proxy.$asExternalUri(uri, options);
    return URI.from(result);
  }
};
ExtHostWindow = __decorateClass([
  __decorateParam(0, IExtHostInitDataService),
  __decorateParam(1, IExtHostRpcService)
], ExtHostWindow);
const IExtHostWindow = createDecorator("IExtHostWindow");
export {
  ExtHostWindow,
  IExtHostWindow
};
