import { localize } from "../../../../nls.js";
var BrowserSearchEngineId = /* @__PURE__ */ ((BrowserSearchEngineId2) => {
  BrowserSearchEngineId2["Bing"] = "bing";
  BrowserSearchEngineId2["Google"] = "google";
  BrowserSearchEngineId2["Yahoo"] = "yahoo";
  BrowserSearchEngineId2["DuckDuckGo"] = "duckduckgo";
  return BrowserSearchEngineId2;
})(BrowserSearchEngineId || {});
const BrowserSearchEngineSettingId = "workbench.browser.searchEngine";
const BROWSER_SEARCH_NONE = "none";
function encodeQuery(query) {
  return encodeURIComponent(query).replace(/%20/g, "+");
}
const BROWSER_SEARCH_ENGINES = [
  {
    id: "bing" /* Bing */,
    label: localize("browser.search.engine.bing", "Bing"),
    buildSearchUrl: (q) => `https://www.bing.com/search?q=${encodeQuery(q)}`
  },
  {
    id: "google" /* Google */,
    label: localize("browser.search.engine.google", "Google"),
    buildSearchUrl: (q) => `https://www.google.com/search?q=${encodeQuery(q)}`
  },
  {
    id: "yahoo" /* Yahoo */,
    label: localize("browser.search.engine.yahoo", "Yahoo!"),
    buildSearchUrl: (q) => `https://search.yahoo.com/search?p=${encodeQuery(q)}`
  },
  {
    id: "duckduckgo" /* DuckDuckGo */,
    label: localize("browser.search.engine.duckduckgo", "DuckDuckGo"),
    buildSearchUrl: (q) => `https://duckduckgo.com/?q=${encodeQuery(q)}`
  }
];
const KNOWN_URL_SCHEMES = /* @__PURE__ */ new Set([
  "file",
  "ftp",
  "ftps",
  "about",
  "data",
  "view-source",
  "mailto",
  "chrome",
  "edge",
  "vscode",
  "vscode-insiders"
]);
const ALL_KNOWN_SCHEMES = /* @__PURE__ */ new Set([...KNOWN_URL_SCHEMES, "http", "https", "javascript"]);
const SUBDOMAIN_REQUIRED_TLDS = /* @__PURE__ */ new Set(["example", "test", "local", "internal"]);
const SCHEME_REGEX = /^([a-z][a-z0-9+\-.]*):/i;
const JAVASCRIPT_QUERY_REGEX = /^javascript:[^;=().\"]*$/i;
const USERINFO_WITH_PASSWORD_REGEX = /^[^\s:@/?#]+:[^\s@/?#]+@/;
const HOST_CHARS_REGEX = /^[a-zA-Z0-9\-._~%]+$/;
const PORT_REGEX = /^\d+$/;
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
function toAsciiHost(host) {
  const needsUrlParse = host.startsWith("[") || !/^[\x00-\x7F]*$/.test(host);
  if (!needsUrlParse) {
    return host;
  }
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return void 0;
  }
}
function parseHostAndPath(rest) {
  const sepMatch = /[/?#]/.exec(rest);
  const authority = sepMatch ? rest.slice(0, sepMatch.index) : rest;
  const pathAndRest = sepMatch ? rest.slice(sepMatch.index) : "";
  let userinfo;
  let hostport = authority;
  const atIdx = authority.lastIndexOf("@");
  if (atIdx >= 0) {
    userinfo = authority.slice(0, atIdx);
    hostport = authority.slice(atIdx + 1);
  }
  let host = hostport;
  let port;
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end >= 0) {
      const after = host.slice(end + 1);
      if (after.startsWith(":") && PORT_REGEX.test(after.slice(1))) {
        port = after.slice(1);
        host = host.slice(0, end + 1);
      } else if (after.length === 0) {
        host = host.slice(0, end + 1);
      }
    }
  } else {
    const colonIdx = host.lastIndexOf(":");
    if (colonIdx >= 0) {
      const maybePort = host.slice(colonIdx + 1);
      if (PORT_REGEX.test(maybePort)) {
        port = maybePort;
        host = host.slice(0, colonIdx);
      }
    }
  }
  return { userinfo, host, port, pathAndRest };
}
function hasKnownTld(host) {
  const trimmed = host.toLowerCase().replace(/\.$/, "");
  const labels = trimmed.split(".");
  if (labels.length < 2) {
    return false;
  }
  const last = labels[labels.length - 1];
  if (last === "invalid") {
    return false;
  }
  if (/^[a-z]{2,}$/.test(last)) {
    return true;
  }
  if (last.startsWith("xn--") && last.length >= 5) {
    return true;
  }
  if (SUBDOMAIN_REQUIRED_TLDS.has(last)) {
    return trimmed.length > last.length + 1;
  }
  return false;
}
function resolveAddressBarInputType(rawInput) {
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return "empty";
  }
  const schemeMatch = SCHEME_REGEX.exec(trimmed);
  const candidateScheme = schemeMatch?.[1].toLowerCase();
  const afterScheme = schemeMatch ? trimmed.slice(schemeMatch[0].length) : "";
  const hasSchemeSeparator = afterScheme.startsWith("//");
  const scheme = candidateScheme && (ALL_KNOWN_SCHEMES.has(candidateScheme) || hasSchemeSeparator) ? candidateScheme : void 0;
  const isHttpScheme = scheme === "http" || scheme === "https";
  if (scheme && !isHttpScheme) {
    if (scheme === "file") {
      return "url";
    }
    if (scheme === "javascript") {
      return JAVASCRIPT_QUERY_REGEX.test(trimmed) ? "unknown" : "url";
    }
    if (KNOWN_URL_SCHEMES.has(scheme)) {
      return "url";
    }
    if (USERINFO_WITH_PASSWORD_REGEX.test(trimmed) && !/\s/.test(trimmed)) {
      return "url";
    }
    return "unknown";
  }
  if (candidateScheme && !scheme && !/^\d+(?:[/?#]|$)/.test(afterScheme)) {
    if (USERINFO_WITH_PASSWORD_REGEX.test(trimmed) && !/\s/.test(trimmed)) {
      return "url";
    }
    return "unknown";
  }
  let rest = trimmed;
  if (scheme) {
    rest = trimmed.slice(schemeMatch[0].length);
    if (rest.startsWith("//")) {
      rest = rest.slice(2);
    }
  }
  const { userinfo, host: rawHost, port, pathAndRest } = parseHostAndPath(rest);
  if (rawHost.length === 0) {
    return pathAndRest.startsWith("/") ? "url" : "query";
  }
  const host = toAsciiHost(rawHost);
  if (host === void 0) {
    return "query";
  }
  if (host.startsWith("[") && host.endsWith("]")) {
    return "url";
  }
  if (!HOST_CHARS_REGEX.test(host)) {
    return "query";
  }
  const ipv4Match = IPV4_REGEX.exec(host);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.every((o) => o <= 255)) {
      const allZero = octets.every((o) => o === 0);
      if (octets[0] !== 0 || allZero) {
        return "url";
      }
      return "query";
    }
  }
  if (userinfo !== void 0 && /\s/.test(userinfo) && !isHttpScheme) {
    return "unknown";
  }
  if (host.toLowerCase() === "localhost") {
    return "url";
  }
  if (isHttpScheme) {
    return "url";
  }
  if (pathAndRest.length > 0 && (pathAndRest.endsWith("/") || pathAndRest.endsWith("\\"))) {
    return "url";
  }
  if (port !== void 0) {
    return "url";
  }
  if (hasKnownTld(host)) {
    return "url";
  }
  if (userinfo !== void 0) {
    return "unknown";
  }
  const hasPath = pathAndRest.startsWith("/");
  const hasQuery = pathAndRest.includes("?");
  const hasFragment = pathAndRest.includes("#");
  const nonHostComponents = (hasPath ? 1 : 0) + (hasQuery ? 1 : 0) + (hasFragment ? 1 : 0);
  if (nonHostComponents > 1) {
    return "url";
  }
  return "unknown";
}
function buildSearchUrl(query, engineId) {
  const engine = BROWSER_SEARCH_ENGINES.find((e) => e.id === engineId) ?? BROWSER_SEARCH_ENGINES[0];
  return engine.buildSearchUrl(query.trim().replace(/\s+/g, " "));
}
function getBrowserSearchEngineLabel(engineId) {
  const engine = BROWSER_SEARCH_ENGINES.find((e) => e.id === engineId) ?? BROWSER_SEARCH_ENGINES[0];
  return engine.label;
}
export {
  BROWSER_SEARCH_ENGINES,
  BROWSER_SEARCH_NONE,
  BrowserSearchEngineId,
  BrowserSearchEngineSettingId,
  buildSearchUrl,
  getBrowserSearchEngineLabel,
  resolveAddressBarInputType
};
