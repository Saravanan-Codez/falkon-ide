var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { IMcpManagementService } from "./mcpManagement.js";
let McpManagementCli = class {
  constructor(_logger, _mcpManagementService) {
    this._logger = _logger;
    this._mcpManagementService = _mcpManagementService;
  }
  async addMcpDefinitions(definitions) {
    const configs = definitions.map((config) => this.validateConfiguration(config));
    await this.updateMcpInResource(configs);
    this._logger.info(`Added MCP servers: ${configs.map((c) => c.name).join(", ")}`);
  }
  async updateMcpInResource(configs) {
    await Promise.all(configs.map(({ name, config, inputs }) => this._mcpManagementService.install({ name, config, inputs })));
  }
  validateConfiguration(config) {
    let parsed;
    try {
      parsed = JSON.parse(config);
    } catch (e) {
      throw new InvalidMcpOperationError(`Invalid JSON '${config}': ${e}`);
    }
    if (!parsed.name) {
      throw new InvalidMcpOperationError(`Missing name property in ${config}`);
    }
    if (!("command" in parsed) && !("url" in parsed)) {
      throw new InvalidMcpOperationError(`Missing command or URL property in ${config}`);
    }
    const { name, inputs, ...rest } = parsed;
    return { name, inputs, config: rest };
  }
};
McpManagementCli = __decorateClass([
  __decorateParam(1, IMcpManagementService)
], McpManagementCli);
class InvalidMcpOperationError extends Error {
  constructor(message) {
    super(message);
    this.stack = message;
  }
}
export {
  McpManagementCli
};
