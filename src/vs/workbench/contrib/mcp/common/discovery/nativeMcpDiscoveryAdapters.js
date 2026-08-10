import { Platform } from "../../../../../base/common/platform.js";
import { URI } from "../../../../../base/common/uri.js";
import { DiscoverySource } from "../mcpConfiguration.js";
import { McpCollectionSortOrder, McpServerLaunch, McpServerTransportType } from "../mcpTypes.js";
async function claudeConfigToServerDefinition(idPrefix, contents, cwd) {
  let parsed;
  try {
    parsed = JSON.parse(contents.toString());
  } catch {
    return;
  }
  return Promise.all(Object.entries(parsed.mcpServers).map(async ([name, server]) => {
    const launch = server.url ? {
      type: McpServerTransportType.HTTP,
      uri: URI.parse(server.url),
      headers: Object.entries(server.headers ?? {})
    } : {
      type: McpServerTransportType.Stdio,
      args: server.args || [],
      command: server.command,
      env: server.env || {},
      envFile: void 0,
      cwd: cwd?.fsPath,
      sandbox: void 0
    };
    return {
      id: `${idPrefix}.${name}`,
      label: name,
      launch,
      cacheNonce: await McpServerLaunch.hash(launch)
    };
  }));
}
class ClaudeDesktopMpcDiscoveryAdapter {
  constructor(remoteAuthority) {
    this.remoteAuthority = remoteAuthority;
    this.order = McpCollectionSortOrder.Filesystem;
    this.discoverySource = DiscoverySource.ClaudeDesktop;
    this.id = `claude-desktop.${this.remoteAuthority}`;
  }
  getFilePath({ platform, winAppData, xdgHome, homedir }) {
    if (platform === Platform.Windows) {
      const appData = winAppData || URI.joinPath(homedir, "AppData", "Roaming");
      return URI.joinPath(appData, "Claude", "claude_desktop_config.json");
    } else if (platform === Platform.Mac) {
      return URI.joinPath(homedir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    } else {
      const configDir = xdgHome || URI.joinPath(homedir, ".config");
      return URI.joinPath(configDir, "Claude", "claude_desktop_config.json");
    }
  }
  adaptFile(contents, { homedir }) {
    return claudeConfigToServerDefinition(this.id, contents, homedir);
  }
}
class WindsurfDesktopMpcDiscoveryAdapter extends ClaudeDesktopMpcDiscoveryAdapter {
  constructor(remoteAuthority) {
    super(remoteAuthority);
    this.discoverySource = DiscoverySource.Windsurf;
    this.id = `windsurf.${this.remoteAuthority}`;
  }
  getFilePath({ homedir }) {
    return URI.joinPath(homedir, ".codeium", "windsurf", "mcp_config.json");
  }
}
class CursorDesktopMpcDiscoveryAdapter extends ClaudeDesktopMpcDiscoveryAdapter {
  constructor(remoteAuthority) {
    super(remoteAuthority);
    this.discoverySource = DiscoverySource.CursorGlobal;
    this.id = `cursor.${this.remoteAuthority}`;
  }
  getFilePath({ homedir }) {
    return URI.joinPath(homedir, ".cursor", "mcp.json");
  }
}
export {
  ClaudeDesktopMpcDiscoveryAdapter,
  CursorDesktopMpcDiscoveryAdapter,
  WindsurfDesktopMpcDiscoveryAdapter,
  claudeConfigToServerDefinition
};
