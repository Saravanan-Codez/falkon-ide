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
import { assertNever } from "../../../base/common/assert.js";
import { Queue } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { parse } from "../../../base/common/json.js";
import { getParseErrorMessage } from "../../../base/common/jsonErrorMessages.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { ConfigurationTarget, ConfigurationTargetToString } from "../../configuration/common/configuration.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { McpServerType } from "./mcpPlatformTypes.js";
const IMcpResourceScannerService = createDecorator("IMcpResourceScannerService");
let McpResourceScannerService = class extends Disposable {
  constructor(fileService, uriIdentityService) {
    super();
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.resourcesAccessQueueMap = new ResourceMap();
  }
  async scanMcpServers(mcpResource, target) {
    return this.withProfileMcpServers(mcpResource, target);
  }
  async addMcpServers(servers, mcpResource, target) {
    await this.withProfileMcpServers(mcpResource, target, (scannedMcpServers) => {
      let updatedInputs = scannedMcpServers.inputs ?? [];
      const existingServers = scannedMcpServers.servers ?? {};
      for (const { name, config, inputs } of servers) {
        existingServers[name] = config;
        if (inputs) {
          const existingInputIds = new Set(updatedInputs.map((input) => input.id));
          const newInputs = inputs.filter((input) => !existingInputIds.has(input.id));
          updatedInputs = [...updatedInputs, ...newInputs];
        }
      }
      return { servers: existingServers, inputs: updatedInputs, sandbox: scannedMcpServers.sandbox };
    });
  }
  async updateSandboxConfig(updateFn, mcpResource, target) {
    await this.withProfileMcpServers(mcpResource, target, updateFn);
  }
  async removeMcpServers(serverNames, mcpResource, target) {
    await this.withProfileMcpServers(mcpResource, target, (scannedMcpServers) => {
      for (const serverName of serverNames) {
        if (scannedMcpServers.servers?.[serverName]) {
          delete scannedMcpServers.servers[serverName];
        }
      }
      return scannedMcpServers;
    });
  }
  async withProfileMcpServers(mcpResource, target, updateFn) {
    return this.getResourceAccessQueue(mcpResource).queue(async () => {
      target = target ?? ConfigurationTarget.USER;
      let scannedMcpServers = {};
      try {
        const content = await this.fileService.readFile(mcpResource);
        const errors = [];
        const result = parse(content.value.toString(), errors, { allowTrailingComma: true, allowEmptyContent: true }) || {};
        if (errors.length > 0) {
          throw new Error("Failed to parse scanned MCP servers: " + errors.map((e) => `[${e.offset}, ${e.length}] ${getParseErrorMessage(e.error)}`).join(", "));
        }
        if (target === ConfigurationTarget.USER) {
          scannedMcpServers = this.fromUserMcpServers(result);
        } else if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
          scannedMcpServers = this.fromWorkspaceFolderMcpServers(result);
        } else if (target === ConfigurationTarget.WORKSPACE) {
          const workspaceScannedMcpServers = result;
          if (workspaceScannedMcpServers.settings?.mcp) {
            scannedMcpServers = this.fromWorkspaceFolderMcpServers(workspaceScannedMcpServers.settings?.mcp);
          }
        }
      } catch (error) {
        if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
          throw error;
        }
      }
      if (updateFn) {
        scannedMcpServers = updateFn(scannedMcpServers ?? {});
        if (target === ConfigurationTarget.USER) {
          await this.writeScannedMcpServers(mcpResource, scannedMcpServers);
        } else if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
          await this.writeScannedMcpServersToWorkspaceFolder(mcpResource, scannedMcpServers);
        } else if (target === ConfigurationTarget.WORKSPACE) {
          await this.writeScannedMcpServersToWorkspace(mcpResource, scannedMcpServers);
        } else {
          assertNever(target, `Invalid Target: ${ConfigurationTargetToString(target)}`);
        }
      }
      return scannedMcpServers;
    });
  }
  async writeScannedMcpServers(mcpResource, scannedMcpServers) {
    if (scannedMcpServers.servers && Object.keys(scannedMcpServers.servers).length > 0 || scannedMcpServers.inputs && scannedMcpServers.inputs.length > 0 || scannedMcpServers.sandbox !== void 0) {
      await this.fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify(scannedMcpServers, null, "	")));
    } else {
      await this.fileService.del(mcpResource);
    }
  }
  async writeScannedMcpServersToWorkspaceFolder(mcpResource, scannedMcpServers) {
    await this.fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify(scannedMcpServers, null, "	")));
  }
  async writeScannedMcpServersToWorkspace(mcpResource, scannedMcpServers) {
    let scannedWorkspaceMcpServers;
    try {
      const content = await this.fileService.readFile(mcpResource);
      const errors = [];
      scannedWorkspaceMcpServers = parse(content.value.toString(), errors, { allowTrailingComma: true, allowEmptyContent: true });
      if (errors.length > 0) {
        throw new Error("Failed to parse scanned MCP servers: " + errors.map((e) => `[${e.offset}, ${e.length}] ${getParseErrorMessage(e.error)}`).join(", "));
      }
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        throw error;
      }
      scannedWorkspaceMcpServers = { settings: {} };
    }
    if (!scannedWorkspaceMcpServers.settings) {
      scannedWorkspaceMcpServers.settings = {};
    }
    scannedWorkspaceMcpServers.settings.mcp = scannedMcpServers;
    await this.fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify(scannedWorkspaceMcpServers, null, "	")));
  }
  fromUserMcpServers(scannedMcpServers) {
    const userMcpServers = {
      inputs: scannedMcpServers.inputs,
      sandbox: scannedMcpServers.sandbox
    };
    const servers = Object.entries(scannedMcpServers.servers ?? {});
    if (servers.length > 0) {
      userMcpServers.servers = {};
      for (const [serverName, server] of servers) {
        userMcpServers.servers[serverName] = this.sanitizeServer(server);
      }
    }
    return userMcpServers;
  }
  fromWorkspaceFolderMcpServers(scannedWorkspaceFolderMcpServers) {
    const scannedMcpServers = {
      inputs: scannedWorkspaceFolderMcpServers.inputs,
      sandbox: scannedWorkspaceFolderMcpServers.sandbox
    };
    const servers = Object.entries(scannedWorkspaceFolderMcpServers.servers ?? {});
    if (servers.length > 0) {
      scannedMcpServers.servers = {};
      for (const [serverName, config] of servers) {
        const serverConfig = this.sanitizeServer(config);
        scannedMcpServers.servers[serverName] = serverConfig;
      }
    }
    return scannedMcpServers;
  }
  sanitizeServer(serverOrConfig) {
    let server;
    if (serverOrConfig.config) {
      const oldScannedMcpServer = serverOrConfig;
      server = {
        ...oldScannedMcpServer.config,
        version: oldScannedMcpServer.version,
        gallery: oldScannedMcpServer.gallery
      };
    } else {
      server = serverOrConfig;
    }
    if (server.type === void 0 || server.type !== McpServerType.REMOTE && server.type !== McpServerType.LOCAL) {
      server.type = server.command ? McpServerType.LOCAL : McpServerType.REMOTE;
    }
    return server;
  }
  getResourceAccessQueue(file) {
    let resourceQueue = this.resourcesAccessQueueMap.get(file);
    if (!resourceQueue) {
      resourceQueue = new Queue();
      this.resourcesAccessQueueMap.set(file, resourceQueue);
    }
    return resourceQueue;
  }
};
McpResourceScannerService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUriIdentityService)
], McpResourceScannerService);
registerSingleton(IMcpResourceScannerService, McpResourceScannerService, InstantiationType.Delayed);
export {
  IMcpResourceScannerService,
  McpResourceScannerService
};
