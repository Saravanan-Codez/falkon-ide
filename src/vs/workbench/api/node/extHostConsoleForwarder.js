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
import { AbstractExtHostConsoleForwarder } from "../common/extHostConsoleForwarder.js";
import { IExtHostInitDataService } from "../common/extHostInitDataService.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { NativeLogMarkers } from "../../services/extensions/common/extensionHostProtocol.js";
const MAX_STREAM_BUFFER_LENGTH = 1024 * 1024;
let ExtHostConsoleForwarder = class extends AbstractExtHostConsoleForwarder {
  constructor(extHostRpc, initData) {
    super(extHostRpc, initData);
    this._isMakingConsoleCall = false;
    this._wrapStream("stderr", "error");
    this._wrapStream("stdout", "log");
  }
  _nativeConsoleLogMessage(method, original, args) {
    const stream = method === "error" || method === "warn" ? process.stderr : process.stdout;
    this._isMakingConsoleCall = true;
    stream.write(`
${NativeLogMarkers.Start}
`);
    original.apply(console, args);
    stream.write(`
${NativeLogMarkers.End}
`);
    this._isMakingConsoleCall = false;
  }
  /**
   * Wraps process.stderr/stdout.write() so that it is transmitted to the
   * renderer or CLI. It both calls through to the original method as well
   * as to console.log with complete lines so that they're made available
   * to the debugger/CLI.
   */
  _wrapStream(streamName, severity) {
    const stream = process[streamName];
    const original = stream.write;
    let buf = "";
    Object.defineProperty(stream, "write", {
      set: () => {
      },
      get: () => (chunk, encoding, callback) => {
        if (!this._isMakingConsoleCall) {
          buf += chunk.toString(encoding);
          const eol = buf.length > MAX_STREAM_BUFFER_LENGTH ? buf.length : buf.lastIndexOf("\n");
          if (eol !== -1) {
            console[severity](buf.slice(0, eol));
            buf = buf.slice(eol + 1);
          }
        }
        original.call(stream, chunk, encoding, callback);
      }
    });
  }
};
ExtHostConsoleForwarder = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService)
], ExtHostConsoleForwarder);
export {
  ExtHostConsoleForwarder
};
