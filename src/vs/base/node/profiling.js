import { timeout } from "../common/async.js";
async function connectWithRetry(host, port, tries = 10, retryWait = 50, errors = [], target) {
  if (typeof target === "undefined") {
    target = function(targets) {
      const target2 = targets.find((target3) => {
        if (target3.webSocketDebuggerUrl) {
          if (target3.type === "page") {
            return target3.url.indexOf("bootstrap/index.html") > 0;
          } else {
            return true;
          }
        }
        return false;
      });
      if (!target2) {
        throw new class extends Error {
          constructor() {
            super("no target");
            this.code = "ECONNREFUSED";
          }
        }();
      }
      return target2;
    };
  }
  const { default: cdp } = await import("chrome-remote-interface");
  try {
    return await cdp({
      host,
      port,
      target,
      local: true
    });
  } catch (e) {
    errors.push(e);
    if (tries <= 1) {
      throw new class extends Error {
        constructor() {
          super("failed to connect");
          this.errors = errors;
        }
      }();
    }
    await timeout(retryWait);
    return connectWithRetry(host, port, tries - 1, retryWait, errors, target);
  }
}
async function startProfiling(options) {
  const client = await connectWithRetry(options.host, options.port, options.tries, options.retryWait, [], options.target);
  const { Runtime, Profiler } = client;
  if (options.checkForPaused) {
    const { Debugger } = client;
    let isPaused = false;
    client.on("event", (message) => {
      if (message.method === "Debugger.paused") {
        isPaused = true;
      }
    });
    await Debugger.enable();
    if (isPaused) {
      throw new Error("runtime is paused");
    }
  } else {
    await Runtime.runIfWaitingForDebugger();
  }
  await Profiler.enable();
  await Profiler.setSamplingInterval({ interval: 100 });
  await Profiler.start();
  return {
    stop: async function(n = 0) {
      if (n > 0) {
        await timeout(n);
      }
      const data = await Profiler.stop();
      await client.close();
      return data;
    }
  };
}
export {
  startProfiling
};
