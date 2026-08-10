(function() {
  const { ipcRenderer, webFrame, contextBridge, webUtils } = require("electron");
  function validateIPC(channel) {
    if (!channel?.startsWith("vscode:")) {
      throw new Error(`Unsupported event IPC channel '${channel}'`);
    }
    return true;
  }
  function parseArgv(key) {
    for (const arg of process.argv) {
      if (arg.indexOf(`--${key}=`) === 0) {
        return arg.split("=")[1];
      }
    }
    return void 0;
  }
  let configuration = void 0;
  const resolveConfiguration = (async () => {
    const windowConfigIpcChannel = parseArgv("vscode-window-config");
    if (!windowConfigIpcChannel) {
      throw new Error("Preload: did not find expected vscode-window-config in renderer process arguments list.");
    }
    try {
      validateIPC(windowConfigIpcChannel);
      const resolvedConfiguration = configuration = await ipcRenderer.invoke(windowConfigIpcChannel);
      Object.assign(process.env, resolvedConfiguration.userEnv);
      webFrame.setZoomLevel(resolvedConfiguration.zoomLevel ?? 0);
      return resolvedConfiguration;
    } catch (error) {
      throw new Error(`Preload: unable to fetch vscode-window-config: ${error}`);
    }
  })();
  const resolveShellEnv = (async () => {
    const [userEnv, shellEnv] = await Promise.all([
      (async () => (await resolveConfiguration).userEnv)(),
      ipcRenderer.invoke("vscode:fetchShellEnv")
    ]);
    return { ...process.env, ...shellEnv, ...userEnv };
  })();
  const globals = {
    /**
     * A minimal set of methods exposed from Electron's `ipcRenderer`
     * to support communication to main process.
     */
    ipcRenderer: {
      send(channel, ...args) {
        if (validateIPC(channel)) {
          ipcRenderer.send(channel, ...args);
        }
      },
      invoke(channel, ...args) {
        validateIPC(channel);
        return ipcRenderer.invoke(channel, ...args);
      },
      on(channel, listener) {
        validateIPC(channel);
        ipcRenderer.on(channel, listener);
        return this;
      },
      once(channel, listener) {
        validateIPC(channel);
        ipcRenderer.once(channel, listener);
        return this;
      },
      removeListener(channel, listener) {
        validateIPC(channel);
        ipcRenderer.removeListener(channel, listener);
        return this;
      }
    },
    ipcMessagePort: {
      acquire(responseChannel, nonce) {
        if (validateIPC(responseChannel)) {
          const responseListener = (e, responseNonce) => {
            if (nonce === responseNonce) {
              ipcRenderer.off(responseChannel, responseListener);
              window.postMessage(nonce, "*", e.ports);
            }
          };
          ipcRenderer.on(responseChannel, responseListener);
        }
      }
    },
    /**
     * Support for subset of methods of Electron's `webFrame` type.
     */
    webFrame: {
      setZoomLevel(level) {
        if (typeof level === "number") {
          webFrame.setZoomLevel(level);
        }
      }
    },
    /**
     * Support for subset of Electron's `webUtils` type.
     */
    webUtils: {
      getPathForFile(file) {
        return webUtils.getPathForFile(file);
      }
    },
    /**
     * Support for a subset of access to node.js global `process`.
     *
     * Note: when `sandbox` is enabled, the only properties available
     * are https://github.com/electron/electron/blob/master/docs/api/process.md#sandbox
     */
    process: {
      get platform() {
        return process.platform;
      },
      get arch() {
        return process.arch;
      },
      get env() {
        return { ...process.env };
      },
      get versions() {
        return process.versions;
      },
      get type() {
        return "renderer";
      },
      get execPath() {
        return process.execPath;
      },
      cwd() {
        return process.env["VSCODE_CWD"] || process.execPath.substr(0, process.execPath.lastIndexOf(process.platform === "win32" ? "\\" : "/"));
      },
      shellEnv() {
        return resolveShellEnv;
      },
      getProcessMemoryInfo() {
        return process.getProcessMemoryInfo();
      },
      on(type, callback) {
        process.on(type, callback);
      }
    },
    /**
     * Some information about the context we are running in.
     */
    context: {
      /**
       * A configuration object made accessible from the main side
       * to configure the sandbox browser window.
       *
       * Note: intentionally not using a getter here because the
       * actual value will be set after `resolveConfiguration`
       * has finished.
       */
      configuration() {
        return configuration;
      },
      /**
       * Allows to await the resolution of the configuration object.
       */
      async resolveConfiguration() {
        return resolveConfiguration;
      }
    }
  };
  try {
    contextBridge.exposeInMainWorld("vscode", globals);
  } catch (error) {
    console.error(error);
  }
})();
