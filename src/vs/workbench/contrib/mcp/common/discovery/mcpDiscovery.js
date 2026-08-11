class McpDiscoveryRegistry {
  constructor() {
    this._discovery = [];
  }
  register(discovery) {
    this._discovery.push(discovery);
  }
  getAll() {
    return this._discovery;
  }
}
const mcpDiscoveryRegistry = new McpDiscoveryRegistry();
export {
  mcpDiscoveryRegistry
};
