import * as os from "os";
const loopbackHosts = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1", "0000:0000:0000:0000:0000:0000:0000:0001"]);
const wildcardHosts = /* @__PURE__ */ new Set(["0.0.0.0", "::", "0000:0000:0000:0000:0000:0000:0000:0000"]);
function resolveServerUrls(host, port, networkInterfaces = os.networkInterfaces()) {
  if (host === void 0) {
    return { local: [formatWebSocketUrl("localhost", port)], network: [] };
  }
  if (!wildcardHosts.has(host)) {
    const url = formatWebSocketUrl(host, port);
    return loopbackHosts.has(host) ? { local: [url], network: [] } : { local: [], network: [url] };
  }
  const network = /* @__PURE__ */ new Set();
  for (const netInterface of Object.values(networkInterfaces)) {
    for (const detail of netInterface ?? []) {
      if (detail.family !== "IPv4" || detail.internal) {
        continue;
      }
      network.add(formatWebSocketUrl(detail.address, port));
    }
  }
  return {
    local: [formatWebSocketUrl("localhost", port)],
    network: [...network]
  };
}
function formatWebSocketUrl(host, port) {
  const normalizedHost = host.includes(":") ? `[${host}]` : host;
  return `ws://${normalizedHost}:${port}`;
}
export {
  formatWebSocketUrl,
  resolveServerUrls
};
