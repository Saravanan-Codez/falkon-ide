import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { TerminalCapability } from "./capabilities.js";
class CwdDetectionCapability extends Disposable {
  constructor() {
    super(...arguments);
    this.type = TerminalCapability.CwdDetection;
    this._cwd = "";
    this._isTrusted = true;
    this._cwds = /* @__PURE__ */ new Map();
    this._onDidChangeCwd = this._register(new Emitter());
    this.onDidChangeCwd = this._onDidChangeCwd.event;
  }
  /**
   * Gets the list of cwds seen in this session in order of last accessed.
   */
  get cwds() {
    return Array.from(this._cwds.keys());
  }
  get isTrusted() {
    return this._isTrusted;
  }
  getCwd() {
    return this._cwd;
  }
  updateCwd(cwd, isTrusted = true) {
    const didChange = this._cwd !== cwd || this._isTrusted !== isTrusted;
    this._cwd = cwd;
    this._isTrusted = isTrusted;
    const count = this._cwds.get(this._cwd) || 0;
    this._cwds.delete(this._cwd);
    this._cwds.set(this._cwd, count + 1);
    if (didChange) {
      this._onDidChangeCwd.fire(cwd);
    }
  }
}
export {
  CwdDetectionCapability
};
