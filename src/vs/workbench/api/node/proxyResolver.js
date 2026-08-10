import { URI } from "../../../base/common/uri.js";
import { LogLevel as LogServiceLevel } from "../../../platform/log/common/log.js";
import { LogLevel, createHttpPatch, createProxyAuthorizationLookup, createProxyResolver, createTlsPatch, createNetPatch, loadSystemCertificates } from "@vscode/proxy-agent";
import { systemCertificatesNodeDefault } from "../../../platform/request/common/request.js";
import { createRequire } from "node:module";
import { lookupKerberosAuthorization } from "../../../platform/request/node/requestService.js";
import * as proxyAgent from "@vscode/proxy-agent";
const require2 = createRequire(import.meta.url);
const http = require2("http");
const https = require2("https");
const tls = require2("tls");
const net = require2("net");
const systemCertificatesV2Default = false;
const useElectronFetchDefault = false;
function connectProxyResolver(extHostWorkspace, configProvider, extensionService, extHostLogService, mainThreadTelemetry, initData, disposables) {
  const isRemote = initData.remote.isRemote;
  const useHostProxyDefault = initData.environment.useHostProxy ?? !isRemote;
  const fallbackToLocalKerberos = useHostProxyDefault;
  const loadLocalCertificates = useHostProxyDefault;
  const isUseHostProxyEnabled = () => !isRemote || configProvider.getConfiguration("http").get("useLocalProxyConfiguration", useHostProxyDefault);
  const timedResolveProxy = createTimedResolveProxy(extHostWorkspace, mainThreadTelemetry);
  const params = {
    resolveProxy: timedResolveProxy,
    lookupProxyAuthorization: createProxyAuthorizationLookup({
      log: extHostLogService,
      lookupKerberosAuthorization: async (proxyURL) => {
        try {
          const spnConfig = getExtHostConfigValue(configProvider, isRemote, "http.proxyKerberosServicePrincipal");
          const response = await lookupKerberosAuthorization(proxyURL, spnConfig, extHostLogService, "ProxyResolver#lookupProxyAuthorization");
          return "Negotiate " + response;
        } catch (err) {
          extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Kerberos authentication failed", err);
        }
        if (isRemote && fallbackToLocalKerberos) {
          extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Kerberos authentication lookup on host", `proxyURL:${proxyURL}`);
          const auth = await extHostWorkspace.lookupKerberosAuthorization(proxyURL);
          if (auth) {
            return auth;
          }
        }
        return void 0;
      },
      lookupAuthorization: (authInfo) => extHostWorkspace.lookupAuthorization(authInfo),
      onDidRequestAuthentication: (authenticate) => sendTelemetry(mainThreadTelemetry, authenticate, isRemote)
    }),
    getProxyURL: () => getExtHostConfigValue(configProvider, isRemote, "http.proxy"),
    getProxySupport: () => getExtHostConfigValue(configProvider, isRemote, "http.proxySupport") || "off",
    getNoProxyConfig: () => getExtHostConfigValue(configProvider, isRemote, "http.noProxy") || [],
    isAdditionalFetchSupportEnabled: () => getExtHostConfigValue(configProvider, isRemote, "http.fetchAdditionalSupport", true),
    isWebSocketPatchEnabled: () => getExtHostConfigValue(configProvider, isRemote, "http.webSocketAdditionalSupport", true),
    addCertificatesV1: () => certSettingV1(configProvider, isRemote),
    addCertificatesV2: () => certSettingV2(configProvider, isRemote),
    loadSystemCertificatesFromNode: () => getExtHostConfigValue(configProvider, isRemote, "http.systemCertificatesNode", systemCertificatesNodeDefault),
    log: extHostLogService,
    getLogLevel: () => {
      const level = extHostLogService.getLevel();
      switch (level) {
        case LogServiceLevel.Trace:
          return LogLevel.Trace;
        case LogServiceLevel.Debug:
          return LogLevel.Debug;
        case LogServiceLevel.Info:
          return LogLevel.Info;
        case LogServiceLevel.Warning:
          return LogLevel.Warning;
        case LogServiceLevel.Error:
          return LogLevel.Error;
        case LogServiceLevel.Off:
          return LogLevel.Off;
        default:
          return never(level);
      }
      function never(level2) {
        extHostLogService.error("Unknown log level", level2);
        return LogLevel.Debug;
      }
    },
    proxyResolveTelemetry: () => {
    },
    isUseHostProxyEnabled,
    getNetworkInterfaceCheckInterval: () => {
      const intervalSeconds = getExtHostConfigValue(configProvider, isRemote, "http.experimental.networkInterfaceCheckInterval", 300);
      return intervalSeconds * 1e3;
    },
    loadAdditionalCertificates: async () => {
      const useNodeSystemCerts = getExtHostConfigValue(configProvider, isRemote, "http.systemCertificatesNode", systemCertificatesNodeDefault);
      const promises = [];
      if (isRemote) {
        promises.push(loadSystemCertificates({
          loadSystemCertificatesFromNode: () => useNodeSystemCerts,
          log: extHostLogService
        }));
      }
      if (loadLocalCertificates) {
        if (!isRemote && useNodeSystemCerts) {
          promises.push(loadSystemCertificates({
            loadSystemCertificatesFromNode: () => useNodeSystemCerts,
            log: extHostLogService
          }));
        } else {
          extHostLogService.trace("ProxyResolver#loadAdditionalCertificates: Loading certificates from main process");
          const certs = extHostWorkspace.loadCertificates();
          certs.then((certs2) => extHostLogService.trace("ProxyResolver#loadAdditionalCertificates: Loaded certificates from main process", certs2.length));
          promises.push(certs);
        }
      }
      const result = (await Promise.all(promises)).flat();
      mainThreadTelemetry.$publicLog2("additionalCertificates", {
        count: result.length,
        isRemote,
        loadLocalCertificates,
        useNodeSystemCerts
      });
      return result;
    },
    env: process.env
  };
  const { resolveProxyWithRequest, resolveProxyURL, resolveProxyByURL } = createProxyResolver(params);
  const target = proxyAgent.default || proxyAgent;
  target.resolveProxyURL = resolveProxyURL;
  target.resolveProxyByURL = resolveProxyByURL;
  patchGlobalFetch(params, configProvider, mainThreadTelemetry, initData, resolveProxyURL, disposables);
  patchGlobalWebSocket(params, resolveProxyURL);
  const lookup = createPatchedModules(params, resolveProxyWithRequest);
  return configureModuleLoading(extensionService, lookup);
}
const unsafeHeaders = [
  "content-length",
  "host",
  "trailer",
  "te",
  "upgrade",
  "cookie2",
  "keep-alive",
  "transfer-encoding",
  "set-cookie"
];
function patchGlobalFetch(params, configProvider, mainThreadTelemetry, initData, resolveProxyURL, disposables) {
  if (!globalThis.__vscodeOriginalFetch) {
    const originalFetch = globalThis.fetch;
    globalThis.__vscodeOriginalFetch = originalFetch;
    const createPatchedFetch = (options) => proxyAgent.createFetchPatch(params, originalFetch, resolveProxyURL, options);
    const patchedFetch = createPatchedFetch();
    globalThis.__vscodePatchedFetch = patchedFetch;
    globalThis.__vscodeCreateFetchPatch = createPatchedFetch;
    let useElectronFetch = false;
    if (!initData.remote.isRemote) {
      useElectronFetch = configProvider.getConfiguration("http").get("electronFetch", useElectronFetchDefault);
      disposables.add(configProvider.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("http.electronFetch")) {
          useElectronFetch = configProvider.getConfiguration("http").get("electronFetch", useElectronFetchDefault);
        }
      }));
    }
    globalThis.fetch = async function fetch(input, init) {
      function getRequestProperty(name) {
        return init && name in init ? init[name] : typeof input === "object" && "cache" in input ? input[name] : void 0;
      }
      const urlString = typeof input === "string" ? input : "cache" in input ? input.url : input.toString();
      const isDataUrl = urlString.startsWith("data:");
      if (isDataUrl) {
        recordFetchFeatureUse(mainThreadTelemetry, "data");
      }
      const isBlobUrl = urlString.startsWith("blob:");
      if (isBlobUrl) {
        recordFetchFeatureUse(mainThreadTelemetry, "blob");
      }
      const isManualRedirect = getRequestProperty("redirect") === "manual";
      if (isManualRedirect) {
        recordFetchFeatureUse(mainThreadTelemetry, "manualRedirect");
      }
      const integrity = getRequestProperty("integrity");
      if (integrity) {
        recordFetchFeatureUse(mainThreadTelemetry, "integrity");
      }
      if (!useElectronFetch || isDataUrl || isBlobUrl || isManualRedirect || integrity) {
        const response2 = await patchedFetch(input, init);
        monitorResponseProperties(mainThreadTelemetry, response2, urlString);
        return response2;
      }
      if (init?.headers) {
        const headers = new Headers(init.headers);
        for (const header of unsafeHeaders) {
          headers.delete(header);
        }
        init = { ...init, headers };
      }
      const electronInput = input instanceof URL ? input.toString() : input;
      const electron = require2("electron");
      const response = await electron.net.fetch(electronInput, init);
      monitorResponseProperties(mainThreadTelemetry, response, urlString);
      return response;
    };
  }
}
function patchGlobalWebSocket(params, resolveProxyURL) {
  if (!globalThis.__vscodeOriginalWebSocket) {
    const originalWebSocket = globalThis.WebSocket;
    globalThis.__vscodeOriginalWebSocket = originalWebSocket;
    globalThis.WebSocket = proxyAgent.createWebSocketPatch(params, originalWebSocket, resolveProxyURL);
  }
}
function monitorResponseProperties(mainThreadTelemetry, response, urlString) {
  const originalUrl = response.url;
  Object.defineProperty(response, "url", {
    get() {
      recordFetchFeatureUse(mainThreadTelemetry, "url");
      return originalUrl || urlString;
    }
  });
  const originalType = response.type;
  Object.defineProperty(response, "type", {
    get() {
      recordFetchFeatureUse(mainThreadTelemetry, "typeProperty");
      return originalType !== "default" ? originalType : "basic";
    }
  });
}
const fetchFeatureUse = {
  url: 0,
  typeProperty: 0,
  data: 0,
  blob: 0,
  integrity: 0,
  manualRedirect: 0
};
let timer;
const enableFeatureUseTelemetry = false;
function recordFetchFeatureUse(mainThreadTelemetry, feature) {
  if (enableFeatureUseTelemetry && !fetchFeatureUse[feature]++) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      mainThreadTelemetry.$publicLog2("fetchFeatureUse", fetchFeatureUse);
    }, 1e4);
    timer.unref?.();
  }
}
const proxyResolveStats = {
  count: 0,
  totalDuration: 0,
  minDuration: Number.MAX_SAFE_INTEGER,
  maxDuration: 0,
  types: /* @__PURE__ */ new Set(),
  lastSentTime: 0
};
const telemetryInterval = 60 * 60 * 1e3;
function proxyResolveType(proxy) {
  const type = proxy ? String(proxy).trim().split(/\s+/, 1)[0] : "EMPTY";
  if (["DIRECT", "PROXY", "HTTPS", "SOCKS", "EMPTY"].indexOf(type) === -1) {
    return "UNKNOWN";
  }
  return type;
}
function sendProxyResolveStats(mainThreadTelemetry) {
  if (proxyResolveStats.count > 0) {
    const avgDuration = proxyResolveStats.totalDuration / proxyResolveStats.count;
    mainThreadTelemetry.$publicLog2("proxyResolveStats", {
      count: proxyResolveStats.count,
      totalDuration: proxyResolveStats.totalDuration,
      minDuration: proxyResolveStats.minDuration,
      maxDuration: proxyResolveStats.maxDuration,
      avgDuration,
      type: [...proxyResolveStats.types].sort().join(",")
    });
    proxyResolveStats.count = 0;
    proxyResolveStats.totalDuration = 0;
    proxyResolveStats.minDuration = Number.MAX_SAFE_INTEGER;
    proxyResolveStats.maxDuration = 0;
    proxyResolveStats.types.clear();
  }
  proxyResolveStats.lastSentTime = Date.now();
}
function createTimedResolveProxy(extHostWorkspace, mainThreadTelemetry) {
  return async (url) => {
    const startTime = performance.now();
    let proxy;
    try {
      proxy = await extHostWorkspace.resolveProxy(url);
      return proxy;
    } finally {
      const duration = performance.now() - startTime;
      proxyResolveStats.count++;
      proxyResolveStats.totalDuration += duration;
      proxyResolveStats.minDuration = Math.min(proxyResolveStats.minDuration, duration);
      proxyResolveStats.maxDuration = Math.max(proxyResolveStats.maxDuration, duration);
      proxyResolveStats.types.add(proxyResolveType(proxy));
      const now = Date.now();
      if (now - proxyResolveStats.lastSentTime >= telemetryInterval) {
        sendProxyResolveStats(mainThreadTelemetry);
      }
    }
  };
}
function createPatchedModules(params, resolveProxy) {
  function mergeModules(module, patch) {
    const target = module.default || module;
    target.__vscodeOriginal = Object.assign({}, target);
    return Object.assign(target, patch);
  }
  return {
    http: mergeModules(http, createHttpPatch(params, http, resolveProxy)),
    https: mergeModules(https, createHttpPatch(params, https, resolveProxy)),
    net: mergeModules(net, createNetPatch(params, net)),
    tls: mergeModules(tls, createTlsPatch(params, tls))
  };
}
function certSettingV1(configProvider, isRemote) {
  return !getExtHostConfigValue(configProvider, isRemote, "http.experimental.systemCertificatesV2", systemCertificatesV2Default) && !!getExtHostConfigValue(configProvider, isRemote, "http.systemCertificates");
}
function certSettingV2(configProvider, isRemote) {
  return !!getExtHostConfigValue(configProvider, isRemote, "http.experimental.systemCertificatesV2", systemCertificatesV2Default) && !!getExtHostConfigValue(configProvider, isRemote, "http.systemCertificates");
}
const modulesCache = /* @__PURE__ */ new Map();
function configureModuleLoading(extensionService, lookup) {
  return extensionService.getExtensionPathIndex().then((extensionPaths) => {
    const node_module = require2("module");
    const original = node_module._load;
    node_module._load = function load(request, parent, isMain) {
      if (request === "net") {
        return lookup.net;
      }
      if (request === "tls") {
        return lookup.tls;
      }
      if (request !== "http" && request !== "https" && request !== "undici") {
        return original.apply(this, arguments);
      }
      const ext = extensionPaths.findSubstr(URI.file(parent.filename));
      let cache = modulesCache.get(ext);
      if (!cache) {
        modulesCache.set(ext, cache = {});
      }
      if (!cache[request]) {
        if (request === "undici") {
          const undici = original.apply(this, arguments);
          proxyAgent.patchUndici(undici);
          cache[request] = undici;
        } else {
          const mod = lookup[request];
          cache[request] = { ...mod };
        }
      }
      return cache[request];
    };
  });
}
let telemetrySent = false;
const enableProxyAuthenticationTelemetry = false;
function sendTelemetry(mainThreadTelemetry, authenticate, isRemote) {
  if (!enableProxyAuthenticationTelemetry || telemetrySent || !authenticate.length) {
    return;
  }
  telemetrySent = true;
  mainThreadTelemetry.$publicLog2("proxyAuthenticationRequest", {
    authenticationType: authenticate.map((a) => a.split(" ")[0]).join(","),
    extensionHostType: isRemote ? "remote" : "local"
  });
}
function getExtHostConfigValue(configProvider, isRemote, key, fallback) {
  if (isRemote) {
    return configProvider.getConfiguration().get(key) ?? fallback;
  }
  const values = configProvider.getConfiguration().inspect(key);
  return values?.globalLocalValue ?? values?.defaultValue ?? fallback;
}
export {
  connectProxyResolver
};
