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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { McpServerType } from "../../../../platform/mcp/common/mcpPlatformTypes.js";
import { mcpConfigurationSection } from "../../../contrib/mcp/common/mcpConfiguration.js";
import { IWorkbenchMcpManagementService } from "../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { parse } from "../../../../base/common/jsonc.js";
import { isObject } from "../../../../base/common/types.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IJSONEditingService } from "../../../services/configuration/common/jsonEditing.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { McpCommandIds } from "../common/mcpCommandIds.js";
import { localize } from "../../../../nls.js";
let McpConfigMigrationContribution = class extends Disposable {
  constructor(mcpManagementService, userDataProfileService, fileService, remoteAgentService, jsonEditingService, logService, notificationService, commandService) {
    super();
    this.mcpManagementService = mcpManagementService;
    this.userDataProfileService = userDataProfileService;
    this.fileService = fileService;
    this.remoteAgentService = remoteAgentService;
    this.jsonEditingService = jsonEditingService;
    this.logService = logService;
    this.notificationService = notificationService;
    this.commandService = commandService;
    this.migrateMcpConfig();
  }
  static {
    this.ID = "workbench.mcp.config.migration";
  }
  async migrateMcpConfig() {
    try {
      const userMcpConfig = await this.parseMcpConfig(this.userDataProfileService.currentProfile.settingsResource);
      if (userMcpConfig && userMcpConfig.servers && Object.keys(userMcpConfig.servers).length > 0) {
        await Promise.all(Object.entries(userMcpConfig.servers).map(([name, config], index) => this.mcpManagementService.install({ name, config, inputs: index === 0 ? userMcpConfig.inputs : void 0 })));
        await this.removeMcpConfig(this.userDataProfileService.currentProfile.settingsResource);
      }
    } catch (error) {
      this.logService.error(`MCP migration: Failed to migrate user MCP config`, error);
    }
    this.watchForMcpConfiguration(this.userDataProfileService.currentProfile.settingsResource, false);
    const remoteEnvironment = await this.remoteAgentService.getEnvironment();
    if (remoteEnvironment) {
      try {
        const userRemoteMcpConfig = await this.parseMcpConfig(remoteEnvironment.settingsPath);
        if (userRemoteMcpConfig && userRemoteMcpConfig.servers && Object.keys(userRemoteMcpConfig.servers).length > 0) {
          await Promise.all(Object.entries(userRemoteMcpConfig.servers).map(([name, config], index) => this.mcpManagementService.install({ name, config, inputs: index === 0 ? userRemoteMcpConfig.inputs : void 0 }, { target: ConfigurationTarget.USER_REMOTE })));
          await this.removeMcpConfig(remoteEnvironment.settingsPath);
        }
      } catch (error) {
        this.logService.error(`MCP migration: Failed to migrate remote MCP config`, error);
      }
      this.watchForMcpConfiguration(remoteEnvironment.settingsPath, true);
    }
  }
  watchForMcpConfiguration(file, isRemote) {
    this._register(this.fileService.watch(file));
    this._register(this.fileService.onDidFilesChange((e) => {
      if (e.contains(file)) {
        this.checkForMcpConfigInFile(file, isRemote);
      }
    }));
  }
  async checkForMcpConfigInFile(settingsFile, isRemote) {
    try {
      const mcpConfig = await this.parseMcpConfig(settingsFile);
      if (mcpConfig && mcpConfig.servers && Object.keys(mcpConfig.servers).length > 0) {
        this.showMcpConfigErrorNotification(isRemote);
      }
    } catch (error) {
    }
  }
  showMcpConfigErrorNotification(isRemote) {
    const message = isRemote ? localize("mcp.migration.remoteConfigFound", "MCP servers should no longer be configured in remote user settings. Use the dedicated MCP configuration instead.") : localize("mcp.migration.userConfigFound", "MCP servers should no longer be configured in user settings. Use the dedicated MCP configuration instead.");
    const openConfigLabel = isRemote ? localize("mcp.migration.openRemoteConfig", "Open Remote User MCP Configuration") : localize("mcp.migration.openUserConfig", "Open User MCP Configuration");
    const commandId = isRemote ? McpCommandIds.OpenRemoteUserMcp : McpCommandIds.OpenUserMcp;
    this.notificationService.prompt(
      Severity.Error,
      message,
      [{
        label: localize("mcp.migration.update", "Update Now"),
        run: async () => {
          await this.migrateMcpConfig();
          await this.commandService.executeCommand(commandId);
        }
      }, {
        label: openConfigLabel,
        keepOpen: true,
        run: () => this.commandService.executeCommand(commandId)
      }]
    );
  }
  async parseMcpConfig(settingsFile) {
    try {
      const content = await this.fileService.readFile(settingsFile);
      const settingsObject = parse(content.value.toString());
      if (!isObject(settingsObject)) {
        return void 0;
      }
      const mcpConfiguration = settingsObject[mcpConfigurationSection];
      if (mcpConfiguration && mcpConfiguration.servers) {
        for (const [, config] of Object.entries(mcpConfiguration.servers)) {
          if (config.type === void 0) {
            config.type = config.command ? McpServerType.LOCAL : McpServerType.REMOTE;
          }
        }
      }
      return mcpConfiguration;
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.warn(`MCP migration: Failed to parse MCP config from ${settingsFile}:`, error);
      }
      return;
    }
  }
  async removeMcpConfig(settingsFile) {
    try {
      await this.jsonEditingService.write(settingsFile, [
        {
          path: [mcpConfigurationSection],
          value: void 0
        }
      ], true);
    } catch (error) {
      this.logService.warn(`MCP migration: Failed to remove MCP config from ${settingsFile}:`, error);
    }
  }
};
McpConfigMigrationContribution = __decorateClass([
  __decorateParam(0, IWorkbenchMcpManagementService),
  __decorateParam(1, IUserDataProfileService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IRemoteAgentService),
  __decorateParam(4, IJSONEditingService),
  __decorateParam(5, ILogService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, ICommandService)
], McpConfigMigrationContribution);
export {
  McpConfigMigrationContribution
};
