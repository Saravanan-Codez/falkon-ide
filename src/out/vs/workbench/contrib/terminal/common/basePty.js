import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { mark } from "../../../../base/common/performance.js";
import { isString } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { ProcessPropertyType } from "../../../../platform/terminal/common/terminal.js";
class BasePty extends Disposable {
  constructor(id, shouldPersist) {
    super();
    this.id = id;
    this.shouldPersist = shouldPersist;
    this._properties = {
      cwd: "",
      initialCwd: "",
      fixedDimensions: { cols: void 0, rows: void 0 },
      title: "",
      shellType: void 0,
      hasChildProcesses: true,
      resolvedShellLaunchConfig: {},
      overrideDimensions: void 0,
      failedShellIntegrationActivation: false,
      usedShellIntegrationInjection: void 0,
      shellIntegrationInjectionFailureReason: void 0
    };
    this._lastDimensions = { cols: -1, rows: -1 };
    this._inReplay = false;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessReplayComplete = this._register(new Emitter());
    this.onProcessReplayComplete = this._onProcessReplayComplete.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
    this._onRestoreCommands = this._register(new Emitter());
    this.onRestoreCommands = this._onRestoreCommands.event;
  }
  async getInitialCwd() {
    return this._properties.initialCwd;
  }
  async getCwd() {
    return this._properties.cwd || this._properties.initialCwd;
  }
  handleData(e) {
    this._onProcessData.fire(e);
  }
  handleExit(e) {
    this._onProcessExit.fire(e);
  }
  handleReady(e) {
    this._onProcessReady.fire(e);
  }
  handleDidChangeProperty({ type, value }) {
    switch (type) {
      case ProcessPropertyType.Cwd:
        this._properties.cwd = value;
        break;
      case ProcessPropertyType.InitialCwd:
        this._properties.initialCwd = value;
        break;
      case ProcessPropertyType.ResolvedShellLaunchConfig: {
        const cast = value;
        if (cast.cwd && !isString(cast.cwd)) {
          cast.cwd = URI.revive(cast.cwd);
        }
        break;
      }
    }
    this._onDidChangeProperty.fire({ type, value });
  }
  async handleReplay(e) {
    mark(`code/terminal/willHandleReplay/${this.id}`);
    try {
      this._inReplay = true;
      for (const innerEvent of e.events) {
        if (innerEvent.cols !== 0 || innerEvent.rows !== 0) {
          this._onDidChangeProperty.fire({ type: ProcessPropertyType.OverrideDimensions, value: { cols: innerEvent.cols, rows: innerEvent.rows, forceExactSize: true } });
        }
        const e2 = { data: innerEvent.data, trackCommit: true };
        this._onProcessData.fire(e2);
        await e2.writePromise;
      }
    } finally {
      this._inReplay = false;
    }
    if (e.commands) {
      this._onRestoreCommands.fire(e.commands);
    }
    this._onDidChangeProperty.fire({ type: ProcessPropertyType.OverrideDimensions, value: void 0 });
    mark(`code/terminal/didHandleReplay/${this.id}`);
    this._onProcessReplayComplete.fire();
  }
}
export {
  BasePty
};
