import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { ProcessPropertyType } from "../../../../platform/terminal/common/terminal.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
const IEmbedderTerminalService = createDecorator("embedderTerminalService");
class EmbedderTerminalService {
  constructor() {
    this._onDidCreateTerminal = new Emitter();
    this.onDidCreateTerminal = Event.buffer(this._onDidCreateTerminal.event, "onDidCreateTerminal");
  }
  createTerminal(options) {
    const slc = {
      name: options.name,
      isFeatureTerminal: true,
      customPtyImplementation(terminalId, cols, rows) {
        return new EmbedderTerminalProcess(terminalId, options.pty);
      }
    };
    this._onDidCreateTerminal.fire(slc);
  }
}
class EmbedderTerminalProcess extends Disposable {
  constructor(id, pty) {
    super();
    this.id = id;
    this.shouldPersist = false;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
    this._pty = pty;
    this.onProcessData = this._pty.onDidWrite;
    if (this._pty.onDidClose) {
      this._register(this._pty.onDidClose((e) => this._onProcessExit.fire(e || void 0)));
    }
    if (this._pty.onDidChangeName) {
      this._register(this._pty.onDidChangeName((e) => this._onDidChangeProperty.fire({
        type: ProcessPropertyType.Title,
        value: e
      })));
    }
  }
  async start() {
    this._onProcessReady.fire({ pid: -1, cwd: "", windowsPty: void 0 });
    this._pty.open();
    return void 0;
  }
  shutdown() {
    this._pty.close();
  }
  // TODO: A lot of these aren't useful for some implementations of ITerminalChildProcess, should
  // they be optional? Should there be a base class for "external" consumers to implement?
  input() {
  }
  sendSignal() {
  }
  async processBinary() {
  }
  resize() {
  }
  clearBuffer() {
  }
  acknowledgeDataEvent() {
  }
  async setUnicodeVersion() {
  }
  async getInitialCwd() {
    return "";
  }
  async getCwd() {
    return "";
  }
  refreshProperty(property) {
    throw new Error(`refreshProperty is not suppported in EmbedderTerminalProcess. property: ${property}`);
  }
  updateProperty(property, value) {
    throw new Error(`updateProperty is not suppported in EmbedderTerminalProcess. property: ${property}, value: ${value}`);
  }
}
registerSingleton(IEmbedderTerminalService, EmbedderTerminalService, InstantiationType.Delayed);
export {
  IEmbedderTerminalService
};
