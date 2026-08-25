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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IAICustomizationWorkspaceService } from "../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
import { IPromptsService, PromptsStorage } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js";
import { PromptsType } from "../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js";
import { AICustomizationManagementSection } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.js";
import { IMcpService } from "../../../../workbench/contrib/mcp/common/mcpTypes.js";
const PROMPT_SECTIONS = [
  { section: AICustomizationManagementSection.Agents, type: PromptsType.agent },
  { section: AICustomizationManagementSection.Skills, type: PromptsType.skill },
  { section: AICustomizationManagementSection.Instructions, type: PromptsType.instructions },
  { section: AICustomizationManagementSection.Hooks, type: PromptsType.hook }
];
let CustomizationsDebugLogContribution = class extends Disposable {
  constructor(loggerService, _promptsService, _workspaceService, _workspaceContextService, _mcpService) {
    super();
    this._promptsService = _promptsService;
    this._workspaceService = _workspaceService;
    this._workspaceContextService = _workspaceContextService;
    this._mcpService = _mcpService;
    this._snapshotDirty = false;
    this._logger = this._register(loggerService.createLogger("customizationsDebug", { name: "Customizations Debug" }));
    this._register(this._promptsService.onDidChangeCustomAgents(() => this._logSnapshot()));
    this._register(this._promptsService.onDidChangeSlashCommands(() => this._logSnapshot()));
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => this._logSnapshot()));
    this._register(autorun((reader) => {
      this._workspaceService.activeProjectRoot.read(reader);
      this._logSnapshot();
    }));
    this._register(autorun((reader) => {
      this._mcpService.servers.read(reader);
      this._logSnapshot();
    }));
  }
  static {
    this.ID = "sessions.customizationsDebugLog";
  }
  _logSnapshot() {
    if (this._pendingSnapshot) {
      this._snapshotDirty = true;
      return;
    }
    this._pendingSnapshot = this._doLogSnapshot().finally(() => {
      this._pendingSnapshot = void 0;
      if (this._snapshotDirty) {
        this._snapshotDirty = false;
        this._logSnapshot();
      }
    });
  }
  async _doLogSnapshot() {
    const root = this._workspaceService.getActiveProjectRoot()?.fsPath ?? "(none)";
    this._logger.info("");
    this._logger.info("=== Customizations Snapshot ===");
    this._logger.info(`  Root: ${root}`);
    this._logger.info(`  Sections: ${this._workspaceService.managementSections.join(", ")}`);
    this._logger.info("");
    this._logger.info(`  ${"Section".padEnd(16)} ${"Local".padStart(6)} ${"User".padStart(6)} ${"Ext".padStart(6)} ${"Total".padStart(7)}`);
    this._logger.info(`  ${"--------".padEnd(16)} ${"-----".padStart(6)} ${"----".padStart(6)} ${"---".padStart(6)} ${"-----".padStart(7)}`);
    for (const { section, type } of PROMPT_SECTIONS) {
      await this._logSectionRow(section, type);
    }
    this._logger.info("");
    for (const { section, type } of PROMPT_SECTIONS) {
      await this._logSectionDetails(section, type);
    }
    this._logMcpServers();
  }
  _logMcpServers() {
    const servers = this._mcpService.servers.get();
    this._logger.info(`  -- MCP Servers (${servers.length}) --`);
    if (servers.length === 0) {
      this._logger.info("     (none registered)");
    }
    for (const server of servers) {
      const state = server.connectionState.get();
      const stateStr = state?.state ?? "unknown";
      this._logger.info(`     ${server.definition.label} [${stateStr}] id=${server.definition.id}`);
    }
    this._logger.info("");
  }
  async _logSectionRow(section, type) {
    try {
      const [localFiles, userFiles, extensionFiles] = await Promise.all([
        this._promptsService.listPromptFilesForStorage(type, PromptsStorage.local, CancellationToken.None),
        this._promptsService.listPromptFilesForStorage(type, PromptsStorage.user, CancellationToken.None),
        this._promptsService.listPromptFilesForStorage(type, PromptsStorage.extension, CancellationToken.None)
      ]);
      const all = [...localFiles, ...userFiles, ...extensionFiles];
      const local = all.filter((f) => f.storage === PromptsStorage.local).length;
      const user = all.filter((f) => f.storage === PromptsStorage.user).length;
      const ext = all.filter((f) => f.storage === PromptsStorage.extension).length;
      this._logger.info(`  ${section.padEnd(16)} ${String(local).padStart(6)} ${String(user).padStart(6)} ${String(ext).padStart(6)} ${String(all.length).padStart(7)}`);
    } catch {
      this._logger.info(`  ${section.padEnd(16)}  (error)`);
    }
  }
  async _logSectionDetails(section, type) {
    try {
      const sourceFolders = await this._promptsService.getSourceFolders(type);
      if (sourceFolders.length > 0) {
        this._logger.info(`  -- ${section} --`);
        this._logger.info(`     Search paths:`);
        for (const sf of sourceFolders) {
          this._logger.info(`       [${sf.storage}] ${sf.uri.fsPath}`);
        }
      }
      const [localFiles, userFiles, extensionFiles] = await Promise.all([
        this._promptsService.listPromptFilesForStorage(type, PromptsStorage.local, CancellationToken.None),
        this._promptsService.listPromptFilesForStorage(type, PromptsStorage.user, CancellationToken.None),
        this._promptsService.listPromptFilesForStorage(type, PromptsStorage.extension, CancellationToken.None)
      ]);
      const all = [...localFiles, ...userFiles, ...extensionFiles];
      if (all.length > 0) {
        if (sourceFolders.length === 0) {
          this._logger.info(`  -- ${section} --`);
        }
        this._logger.info(`     Found ${all.length} item(s):`);
        for (const f of all) {
          this._logger.info(`       [${f.storage}] ${f.uri.fsPath}`);
        }
      }
      if (sourceFolders.length > 0 || all.length > 0) {
        this._logger.info("");
      }
    } catch {
    }
  }
};
CustomizationsDebugLogContribution = __decorateClass([
  __decorateParam(0, ILoggerService),
  __decorateParam(1, IPromptsService),
  __decorateParam(2, IAICustomizationWorkspaceService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IMcpService)
], CustomizationsDebugLogContribution);
registerWorkbenchContribution2(
  CustomizationsDebugLogContribution.ID,
  CustomizationsDebugLogContribution,
  WorkbenchPhase.AfterRestored
);
