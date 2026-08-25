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
import { safeStringify } from "../../../base/common/objects.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
let AbstractExtHostConsoleForwarder = class {
  constructor(extHostRpc, initData) {
    this._mainThreadConsole = extHostRpc.getProxy(MainContext.MainThreadConsole);
    this._includeStack = initData.consoleForward.includeStack;
    this._logNative = initData.consoleForward.logNative;
    this._wrapConsoleMethod("info", "log");
    this._wrapConsoleMethod("log", "log");
    this._wrapConsoleMethod("warn", "warn");
    this._wrapConsoleMethod("debug", "debug");
    this._wrapConsoleMethod("error", "error");
  }
  /**
   * Wraps a console message so that it is transmitted to the renderer. If
   * native logging is turned on, the original console message will be written
   * as well. This is needed since the console methods are "magic" in V8 and
   * are the only methods that allow later introspection of logged variables.
   *
   * The wrapped property is not defined with `writable: false` to avoid
   * throwing errors, but rather a no-op setting. See https://github.com/microsoft/vscode-extension-telemetry/issues/88
   */
  _wrapConsoleMethod(method, severity) {
    const that = this;
    const original = console[method];
    Object.defineProperty(console, method, {
      set: () => {
      },
      get: () => (...args) => {
        that._handleConsoleCall(method, severity, original, args);
      }
    });
  }
  _handleConsoleCall(method, severity, original, args) {
    this._mainThreadConsole.$logExtensionHostMessage({
      type: "__$console",
      severity,
      arguments: safeStringifyArgumentsToArray(args, this._includeStack)
    });
    if (this._logNative) {
      this._nativeConsoleLogMessage(method, original, args);
    }
  }
};
AbstractExtHostConsoleForwarder = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService)
], AbstractExtHostConsoleForwarder);
const MAX_LENGTH = 1e5;
function safeStringifyArgumentsToArray(args, includeStack) {
  const argsArray = [];
  if (args.length) {
    for (let i = 0; i < args.length; i++) {
      let arg = args[i];
      if (typeof arg === "undefined") {
        arg = "undefined";
      } else if (arg instanceof Error) {
        const errorObj = arg;
        if (errorObj.stack) {
          arg = errorObj.stack;
        } else {
          arg = errorObj.toString();
        }
      }
      argsArray.push(arg);
    }
  }
  if (includeStack) {
    const stack = new Error().stack;
    if (stack) {
      argsArray.push({ __$stack: stack.split("\n").slice(3).join("\n") });
    }
  }
  try {
    const res = safeStringify(argsArray);
    if (res.length > MAX_LENGTH) {
      return "Output omitted for a large object that exceeds the limits";
    }
    return res;
  } catch (error) {
    return `Output omitted for an object that cannot be inspected ('${error.toString()}')`;
  }
}
export {
  AbstractExtHostConsoleForwarder
};
