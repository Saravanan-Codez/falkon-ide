import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { RunOnceWorker } from "../../../../base/common/async.js";
class UrlFinder extends Disposable {
  constructor(terminalService, debugService) {
    super();
    this._onDidMatchLocalUrl = this._register(new Emitter());
    this.onDidMatchLocalUrl = this._onDidMatchLocalUrl.event;
    this.listeners = /* @__PURE__ */ new Map();
    this.terminalDataWorkers = this._register(new DisposableMap());
    this.replPositions = /* @__PURE__ */ new Map();
    terminalService.instances.forEach((instance) => {
      this.registerTerminalInstance(instance);
    });
    this._register(terminalService.onDidCreateInstance((instance) => {
      this.registerTerminalInstance(instance);
    }));
    this._register(terminalService.onDidDisposeInstance((instance) => {
      this.listeners.get(instance)?.dispose();
      this.listeners.delete(instance);
      this.terminalDataWorkers.deleteAndDispose(instance);
    }));
    this._register(debugService.onDidNewSession((session) => {
      if (!session.parentSession || session.parentSession && session.hasSeparateRepl()) {
        this.listeners.set(session.getId(), session.onDidChangeReplElements(() => {
          this.processNewReplElements(session);
        }));
      }
    }));
    this._register(debugService.onDidEndSession(({ session }) => {
      if (this.listeners.has(session.getId())) {
        this.listeners.get(session.getId())?.dispose();
        this.listeners.delete(session.getId());
      }
    }));
  }
  static {
    /**
     * Debounce time in ms before processing accumulated terminal data.
     */
    this.dataDebounceTimeout = 500;
  }
  static {
    /**
     * Maximum amount of data to accumulate before skipping URL detection.
     * When data exceeds this threshold, it indicates high-throughput scenarios
     * (like games or animations) where URL detection is unlikely to find useful results.
     */
    this.maxDataLength = 1e4;
  }
  static {
    /**
     * Local server url pattern matching following urls:
     * http://localhost:3000/ - commonly used across multiple frameworks
     * https://127.0.0.1:5001/ - ASP.NET
     * http://:8080 - Beego Golang
     * http://0.0.0.0:4000 - Elixir Phoenix
     */
    this.localUrlRegex = /\b\w{0,20}(?::\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|:\d{2,5})[\w\-\.\~:\/\?\#[\]\@!\$&\(\)\*\+\,\;\=]*/gim;
  }
  static {
    this.extractPortRegex = /(localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{1,5})/;
  }
  static {
    /**
     * https://github.com/microsoft/vscode-remote-release/issues/3949
     */
    this.localPythonServerRegex = /HTTP\son\s(127\.0\.0\.1|0\.0\.0\.0)\sport\s(\d+)/;
  }
  static {
    this.excludeTerminals = ["Dev Containers"];
  }
  registerTerminalInstance(instance) {
    if (!UrlFinder.excludeTerminals.includes(instance.title)) {
      this.listeners.set(instance, instance.onData((data) => {
        this.getOrCreateWorker(instance).work(data);
      }));
    }
  }
  getOrCreateWorker(instance) {
    let worker = this.terminalDataWorkers.get(instance);
    if (!worker) {
      worker = new RunOnceWorker((chunks) => this.processTerminalData(chunks), UrlFinder.dataDebounceTimeout);
      this.terminalDataWorkers.set(instance, worker);
    }
    return worker;
  }
  processTerminalData(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalLength > UrlFinder.maxDataLength) {
      return;
    }
    this.processData(chunks.join(""));
  }
  processNewReplElements(session) {
    const oldReplPosition = this.replPositions.get(session.getId());
    const replElements = session.getReplElements();
    this.replPositions.set(session.getId(), { position: replElements.length - 1, tail: replElements[replElements.length - 1] });
    if (!oldReplPosition && replElements.length > 0) {
      replElements.forEach((element) => this.processData(element.toString()));
    } else if (oldReplPosition && replElements.length - 1 !== oldReplPosition.position) {
      for (let i = replElements.length - 1; i >= 0; i--) {
        const element = replElements[i];
        if (element === oldReplPosition.tail) {
          break;
        } else {
          this.processData(element.toString());
        }
      }
    }
  }
  dispose() {
    super.dispose();
    for (const listener of this.listeners.values()) {
      listener.dispose();
    }
  }
  processData(data) {
    data = removeAnsiEscapeCodes(data);
    const urlMatches = data.match(UrlFinder.localUrlRegex) || [];
    if (urlMatches && urlMatches.length > 0) {
      urlMatches.forEach((match) => {
        let serverUrl;
        try {
          serverUrl = new URL(match);
        } catch (e) {
        }
        if (serverUrl) {
          const portMatch = match.match(UrlFinder.extractPortRegex);
          const port = parseFloat(serverUrl.port ? serverUrl.port : portMatch ? portMatch[2] : "NaN");
          if (!isNaN(port) && Number.isInteger(port) && port > 0 && port <= 65535) {
            let host = serverUrl.hostname;
            if (host !== "0.0.0.0" && host !== "127.0.0.1") {
              host = "localhost";
            }
            if (port !== 9229 && data.startsWith("Debugger listening on")) {
              return;
            }
            this._onDidMatchLocalUrl.fire({ port, host });
          }
        }
      });
    } else {
      const pythonMatch = data.match(UrlFinder.localPythonServerRegex);
      if (pythonMatch && pythonMatch.length === 3) {
        this._onDidMatchLocalUrl.fire({ host: pythonMatch[1], port: Number(pythonMatch[2]) });
      }
    }
  }
}
export {
  UrlFinder
};
