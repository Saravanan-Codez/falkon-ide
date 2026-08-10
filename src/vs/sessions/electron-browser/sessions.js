(async function() {
  performance.mark("code/didStartRenderer");
  const preloadGlobals = window.vscode;
  const safeProcess = preloadGlobals.process;
  function showSplash(configuration2) {
    performance.mark("code/willShowPartsSplash");
    let data = configuration2.partsSplash;
    if (data) {
      if (configuration2.autoDetectHighContrast && configuration2.colorScheme.highContrast) {
        if (configuration2.colorScheme.dark && data.baseTheme !== "hc-black" || !configuration2.colorScheme.dark && data.baseTheme !== "hc-light") {
          data = void 0;
        }
      } else if (configuration2.autoDetectColorScheme) {
        if (configuration2.colorScheme.dark && data.baseTheme !== "vs-dark" || !configuration2.colorScheme.dark && data.baseTheme !== "vs") {
          data = void 0;
        }
      }
    }
    let baseTheme = "vs-dark";
    let shellBackground = "#1E1E1E";
    let shellForeground = "#CCCCCC";
    if (data) {
      baseTheme = data.baseTheme;
      shellBackground = data.baseTheme === "vs" ? data.colorInfo.background ?? data.colorInfo.editorBackground : data.colorInfo.editorBackground ?? data.colorInfo.background;
      shellForeground = data.colorInfo.foreground ?? shellForeground;
    } else if (configuration2.autoDetectHighContrast && configuration2.colorScheme.highContrast) {
      if (configuration2.colorScheme.dark) {
        baseTheme = "hc-black";
        shellBackground = "#000000";
        shellForeground = "#FFFFFF";
      } else {
        baseTheme = "hc-light";
        shellBackground = "#FFFFFF";
        shellForeground = "#000000";
      }
    } else if (configuration2.autoDetectColorScheme) {
      if (configuration2.colorScheme.dark) {
        baseTheme = "vs-dark";
        shellBackground = "#1E1E1E";
        shellForeground = "#CCCCCC";
      } else {
        baseTheme = "vs";
        shellBackground = "#F3F3F3";
        shellForeground = "#000000";
      }
    }
    const style = document.createElement("style");
    style.className = "initialShellColors";
    window.document.head.appendChild(style);
    style.textContent = `body { background-color: ${shellBackground}; color: ${shellForeground}; margin: 0; padding: 0; }`;
    if (typeof data?.zoomLevel === "number" && typeof preloadGlobals?.webFrame?.setZoomLevel === "function") {
      preloadGlobals.webFrame.setZoomLevel(data.zoomLevel);
    }
    const splash = document.createElement("div");
    splash.id = "monaco-parts-splash";
    splash.className = baseTheme ?? "vs-dark";
    window.document.body.appendChild(splash);
    performance.mark("code/didShowPartsSplash");
  }
  async function load(options) {
    const configuration2 = await resolveWindowConfiguration();
    options?.beforeImport?.(configuration2);
    const { enableDeveloperKeybindings, removeDeveloperKeybindingsAfterLoad, developerDeveloperKeybindingsDisposable, forceDisableShowDevtoolsOnError } = setupDeveloperKeybindings(configuration2, options);
    setupNLS(configuration2);
    const baseUrl = new URL(`${fileUriFromPath(configuration2.appRoot, { isWindows: safeProcess.platform === "win32", scheme: "vscode-file", fallbackAuthority: "vscode-app" })}/out/`);
    globalThis._VSCODE_FILE_ROOT = baseUrl.toString();
    globalThis._VSCODE_PRODUCT_JSON = { ...configuration2.product };
    setupCSSImportMaps(configuration2, baseUrl);
    try {
      let workbenchUrl;
      if (!!safeProcess.env["VSCODE_DEV"] && globalThis._VSCODE_USE_RELATIVE_IMPORTS) {
        workbenchUrl = "./sessions.desktop.main.js";
      } else {
        workbenchUrl = new URL(`vs/sessions/sessions.desktop.main.js`, baseUrl).href;
      }
      const result2 = await import(workbenchUrl);
      if (developerDeveloperKeybindingsDisposable && removeDeveloperKeybindingsAfterLoad) {
        developerDeveloperKeybindingsDisposable();
      }
      return { result: result2, configuration: configuration2 };
    } catch (error) {
      onUnexpectedError(error, enableDeveloperKeybindings && !forceDisableShowDevtoolsOnError);
      throw error;
    }
  }
  async function resolveWindowConfiguration() {
    const timeout = setTimeout(() => {
      console.error(`[resolve window config] Could not resolve window configuration within 10 seconds, but will continue to wait...`);
    }, 1e4);
    performance.mark("code/willWaitForWindowConfig");
    const configuration2 = await preloadGlobals.context.resolveConfiguration();
    performance.mark("code/didWaitForWindowConfig");
    clearTimeout(timeout);
    return configuration2;
  }
  function setupDeveloperKeybindings(configuration2, options) {
    const {
      forceEnableDeveloperKeybindings,
      disallowReloadKeybinding,
      removeDeveloperKeybindingsAfterLoad,
      forceDisableShowDevtoolsOnError
    } = typeof options?.configureDeveloperSettings === "function" ? options.configureDeveloperSettings(configuration2) : {
      forceEnableDeveloperKeybindings: false,
      disallowReloadKeybinding: false,
      removeDeveloperKeybindingsAfterLoad: false,
      forceDisableShowDevtoolsOnError: false
    };
    const isDev = !!safeProcess.env["VSCODE_DEV"];
    const enableDeveloperKeybindings = Boolean(isDev || forceEnableDeveloperKeybindings);
    let developerDeveloperKeybindingsDisposable = void 0;
    if (enableDeveloperKeybindings) {
      developerDeveloperKeybindingsDisposable = registerDeveloperKeybindings(disallowReloadKeybinding);
    }
    return {
      enableDeveloperKeybindings,
      removeDeveloperKeybindingsAfterLoad,
      developerDeveloperKeybindingsDisposable,
      forceDisableShowDevtoolsOnError
    };
  }
  function registerDeveloperKeybindings(disallowReloadKeybinding) {
    const ipcRenderer = preloadGlobals.ipcRenderer;
    const extractKey = function(e) {
      return [
        e.ctrlKey ? "ctrl-" : "",
        e.metaKey ? "meta-" : "",
        e.altKey ? "alt-" : "",
        e.shiftKey ? "shift-" : "",
        e.keyCode
      ].join("");
    };
    const TOGGLE_DEV_TOOLS_KB = safeProcess.platform === "darwin" ? "meta-alt-73" : "ctrl-shift-73";
    const TOGGLE_DEV_TOOLS_KB_ALT = "123";
    const RELOAD_KB = safeProcess.platform === "darwin" ? "meta-82" : "ctrl-82";
    let listener = function(e) {
      const key = extractKey(e);
      if (key === TOGGLE_DEV_TOOLS_KB || key === TOGGLE_DEV_TOOLS_KB_ALT) {
        ipcRenderer.send("vscode:toggleDevTools");
      } else if (key === RELOAD_KB && !disallowReloadKeybinding) {
        ipcRenderer.send("vscode:reloadWindow");
      }
    };
    window.addEventListener("keydown", listener);
    return function() {
      if (listener) {
        window.removeEventListener("keydown", listener);
        listener = void 0;
      }
    };
  }
  function setupNLS(configuration2) {
    globalThis._VSCODE_NLS_MESSAGES = configuration2.nls.messages;
    globalThis._VSCODE_NLS_LANGUAGE = configuration2.nls.language;
    let language = configuration2.nls.language || "en";
    if (language === "zh-tw") {
      language = "zh-Hant";
    } else if (language === "zh-cn") {
      language = "zh-Hans";
    }
    window.document.documentElement.setAttribute("lang", language);
  }
  function onUnexpectedError(error, showDevtoolsOnError) {
    if (showDevtoolsOnError) {
      const ipcRenderer = preloadGlobals.ipcRenderer;
      ipcRenderer.send("vscode:openDevTools");
    }
    console.error(`[uncaught exception]: ${error}`);
    if (error && typeof error !== "string" && error.stack) {
      console.error(error.stack);
    }
  }
  function fileUriFromPath(path, config) {
    let pathName = path.replace(/\\/g, "/");
    if (pathName.length > 0 && pathName.charAt(0) !== "/") {
      pathName = `/${pathName}`;
    }
    let uri;
    if (config.isWindows && pathName.startsWith("//")) {
      uri = encodeURI(`${config.scheme || "file"}:${pathName}`);
    } else {
      uri = encodeURI(`${config.scheme || "file"}://${config.fallbackAuthority || ""}${pathName}`);
    }
    return uri.replace(/#/g, "%23");
  }
  function setupCSSImportMaps(configuration2, baseUrl) {
    if (globalThis._VSCODE_DISABLE_CSS_IMPORT_MAP) {
      return;
    }
    if (Array.isArray(configuration2.cssModules) && configuration2.cssModules.length > 0) {
      performance.mark("code/willAddCssLoader");
      globalThis._VSCODE_CSS_LOAD = function(url) {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", url);
        window.document.head.appendChild(link);
      };
      const importMap = { imports: {} };
      for (const cssModule of configuration2.cssModules) {
        const cssUrl = new URL(cssModule, baseUrl).href;
        const jsSrc = `globalThis._VSCODE_CSS_LOAD('${cssUrl}');
`;
        const blob = new Blob([jsSrc], { type: "application/javascript" });
        importMap.imports[cssUrl] = URL.createObjectURL(blob);
      }
      const ttp = window.trustedTypes?.createPolicy("vscode-bootstrapImportMap", { createScript(value) {
        return value;
      } });
      const importMapSrc = JSON.stringify(importMap, void 0, 2);
      const importMapScript = document.createElement("script");
      importMapScript.type = "importmap";
      importMapScript.setAttribute("nonce", "0c6a828f1297");
      importMapScript.textContent = ttp?.createScript(importMapSrc) ?? importMapSrc;
      window.document.head.appendChild(importMapScript);
      performance.mark("code/didAddCssLoader");
    }
  }
  const { result, configuration } = await load(
    {
      configureDeveloperSettings: function(windowConfig) {
        return {
          // disable automated devtools opening on error when running extension tests
          // as this can lead to nondeterministic test execution (devtools steals focus)
          forceDisableShowDevtoolsOnError: typeof windowConfig.extensionTestsPath === "string" || windowConfig["enable-smoke-test-driver"] === true,
          // enable devtools keybindings in extension development window
          forceEnableDeveloperKeybindings: Array.isArray(windowConfig.extensionDevelopmentPath) && windowConfig.extensionDevelopmentPath.length > 0,
          removeDeveloperKeybindingsAfterLoad: true
        };
      },
      beforeImport: function(windowConfig) {
        showSplash(windowConfig);
        Object.defineProperty(window, "vscodeWindowId", {
          get: () => windowConfig.windowId
        });
        window.requestIdleCallback(() => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context?.clearRect(0, 0, canvas.width, canvas.height);
          canvas.remove();
        }, { timeout: 50 });
        performance.mark("code/willLoadWorkbenchMain");
      }
    }
  );
  performance.mark("code/didLoadWorkbenchMain");
  result.main(configuration);
})();
