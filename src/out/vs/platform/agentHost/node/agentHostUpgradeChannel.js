const VSCODE_AGENT_HOST_MANAGEMENT_SOCKET_ENV = "VSCODE_AGENT_HOST_MANAGEMENT_SOCKET";
function getAgentHostManagementSocketPath() {
  const value = process.env[VSCODE_AGENT_HOST_MANAGEMENT_SOCKET_ENV];
  return value && value.length > 0 ? value : void 0;
}
async function requestAgentHostUpgrade(socketPath = getAgentHostManagementSocketPath()) {
  const http = await import("http");
  if (!socketPath) {
    return Promise.reject(new Error(`Cannot request upgrade: ${VSCODE_AGENT_HOST_MANAGEMENT_SOCKET_ENV} is not set.`));
  }
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath,
      method: "POST",
      path: "/upgrade",
      headers: { "content-length": "0" }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const status = res.statusCode ?? 0;
        let parsed;
        try {
          parsed = body ? JSON.parse(body) : void 0;
        } catch {
        }
        if (status >= 200 && status < 300 && parsed && parsed.ok !== false) {
          resolve(parsed);
        } else {
          const reason = parsed?.error || body || `HTTP ${status}`;
          reject(new Error(`Agent host upgrade request failed: ${reason}`));
        }
      });
      res.on("error", reject);
    });
    req.once("error", reject);
    req.end();
  });
}
export {
  VSCODE_AGENT_HOST_MANAGEMENT_SOCKET_ENV,
  getAgentHostManagementSocketPath,
  requestAgentHostUpgrade
};
