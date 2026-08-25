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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { IPromptsService } from "../common/promptSyntax/service/promptsService.js";
import { PromptsType } from "../common/promptSyntax/promptTypes.js";
import { ILanguageModelToolsService } from "../common/tools/languageModelToolsService.js";
import { TipEligibilityStorageKeys } from "./chatTipStorageKeys.js";
let TipEligibilityTracker = class extends Disposable {
  constructor(tips, commandService, _storageService, _promptsService, _languageModelToolsService, _logService) {
    super();
    this._storageService = _storageService;
    this._promptsService = _promptsService;
    this._languageModelToolsService = _languageModelToolsService;
    this._logService = _logService;
    this._commandListener = this._register(new MutableDisposable());
    this._toolListener = this._register(new MutableDisposable());
    /**
     * Tip IDs excluded because prompt files of the required type exist in the workspace.
     * Tips with `excludeUntilChecked` are pre-added and removed if no files are found.
     */
    this._excludedByFiles = /* @__PURE__ */ new Set();
    /** Generation counter per tip ID to discard stale async file-check results. */
    this._fileCheckGeneration = /* @__PURE__ */ new Map();
    this._fileChecksInFlight = /* @__PURE__ */ new Map();
    const storedCmds = this._readApplicationWithProfileFallback(TipEligibilityStorageKeys.ExecutedCommands);
    this._executedCommands = new Set(storedCmds ? JSON.parse(storedCmds) : []);
    const storedModes = this._readApplicationWithProfileFallback(TipEligibilityStorageKeys.UsedModes);
    this._usedModes = new Set(storedModes ? JSON.parse(storedModes) : []);
    const storedTools = this._readApplicationWithProfileFallback(TipEligibilityStorageKeys.InvokedTools);
    this._invokedTools = new Set(storedTools ? JSON.parse(storedTools) : []);
    this._pendingCommands = /* @__PURE__ */ new Set();
    for (const tip of tips) {
      for (const cmd of tip.excludeWhenCommandsExecuted ?? []) {
        if (!this._executedCommands.has(cmd)) {
          this._pendingCommands.add(cmd);
        }
      }
    }
    this._pendingModes = /* @__PURE__ */ new Set();
    for (const tip of tips) {
      for (const mode of tip.excludeWhenModesUsed ?? []) {
        if (!this._usedModes.has(mode)) {
          this._pendingModes.add(mode);
        }
      }
    }
    this._pendingTools = /* @__PURE__ */ new Set();
    for (const tip of tips) {
      for (const toolId of tip.excludeWhenToolsInvoked ?? []) {
        if (!this._invokedTools.has(toolId)) {
          this._pendingTools.add(toolId);
        }
      }
    }
    if (this._pendingCommands.size > 0) {
      this._commandListener.value = commandService.onDidExecuteCommand((e) => {
        this.recordCommandExecuted(e.commandId);
      });
    }
    if (this._pendingTools.size > 0) {
      this._toolListener.value = this._languageModelToolsService.onDidInvokeTool((e) => {
        if (this._pendingTools.has(e.toolId)) {
          this._invokedTools.add(e.toolId);
          this._pendingTools.delete(e.toolId);
          this._persistSet(TipEligibilityStorageKeys.InvokedTools, this._invokedTools);
        }
        if (this._pendingTools.size === 0) {
          this._toolListener.clear();
        }
      });
    }
    this._tipsWithFileExclusions = tips.filter((t) => t.excludeWhenPromptFilesExist);
    for (const tip of this._tipsWithFileExclusions) {
      if (tip.excludeWhenPromptFilesExist.excludeUntilChecked) {
        this._excludedByFiles.add(tip.id);
      }
      this._checkForPromptFiles(tip);
    }
    this._register(this._promptsService.onDidChangeCustomAgents(() => {
      for (const tip of this._tipsWithFileExclusions) {
        if (tip.excludeWhenPromptFilesExist.promptType === PromptsType.agent) {
          this._checkForPromptFiles(tip);
        }
      }
    }));
  }
  recordCommandExecuted(commandId) {
    if (!this._pendingCommands.has(commandId)) {
      return;
    }
    this._executedCommands.add(commandId);
    this._persistSet(TipEligibilityStorageKeys.ExecutedCommands, this._executedCommands);
    this._pendingCommands.delete(commandId);
    if (this._pendingCommands.size === 0) {
      this._commandListener.clear();
    }
  }
  /**
   * Records the current chat mode (kind + name) so future tip eligibility
   * checks can exclude mode-related tips. No-ops once all tracked modes
   * have been observed.
   */
  recordCurrentMode(contextKeyService) {
    if (this._pendingModes.size === 0) {
      return;
    }
    let changed = false;
    const kind = contextKeyService.getContextKeyValue(ChatContextKeys.chatModeKind.key);
    if (kind && !this._usedModes.has(kind)) {
      this._usedModes.add(kind);
      this._pendingModes.delete(kind);
      changed = true;
    }
    const name = contextKeyService.getContextKeyValue(ChatContextKeys.chatModeName.key);
    if (name && !this._usedModes.has(name)) {
      this._usedModes.add(name);
      this._pendingModes.delete(name);
      changed = true;
    }
    if (changed) {
      this._persistSet(TipEligibilityStorageKeys.UsedModes, this._usedModes);
    }
  }
  /**
   * Returns `true` when the tip should be **excluded** from the eligible set.
   */
  isExcluded(tip) {
    if (tip.excludeWhenCommandsExecuted) {
      for (const cmd of tip.excludeWhenCommandsExecuted) {
        if (this._executedCommands.has(cmd)) {
          this._logService.debug("#ChatTips: tip excluded because command was executed", tip.id, cmd);
          return true;
        }
      }
    }
    if (tip.excludeWhenModesUsed) {
      for (const mode of tip.excludeWhenModesUsed) {
        if (this._usedModes.has(mode)) {
          this._logService.debug("#ChatTips: tip excluded because mode was used", tip.id, mode);
          return true;
        }
      }
    }
    if (tip.excludeWhenToolsInvoked) {
      for (const toolId of tip.excludeWhenToolsInvoked) {
        if (this._invokedTools.has(toolId)) {
          this._logService.debug("#ChatTips: tip excluded because tool was invoked", tip.id, toolId);
          return true;
        }
      }
    }
    if (tip.excludeWhenPromptFilesExist && this._excludedByFiles.has(tip.id)) {
      this._logService.debug("#ChatTips: tip excluded because prompt files exist", tip.id);
      return true;
    }
    return false;
  }
  /**
   * Revalidates all file-based tip exclusions. Tips with `excludeUntilChecked`
   * are conservatively hidden until the re-check completes.
   */
  refreshPromptFileExclusions() {
    for (const tip of this._tipsWithFileExclusions) {
      if (tip.excludeWhenPromptFilesExist.excludeUntilChecked) {
        this._excludedByFiles.add(tip.id);
      }
      this._checkForPromptFiles(tip);
    }
  }
  async _checkForPromptFiles(tip) {
    const inFlight = this._fileChecksInFlight.get(tip.id);
    if (inFlight) {
      await inFlight;
      return;
    }
    const checkPromise = this._doCheckForPromptFiles(tip);
    this._fileChecksInFlight.set(tip.id, checkPromise);
    try {
      await checkPromise;
    } finally {
      if (this._fileChecksInFlight.get(tip.id) === checkPromise) {
        this._fileChecksInFlight.delete(tip.id);
      }
    }
  }
  async _doCheckForPromptFiles(tip) {
    const config = tip.excludeWhenPromptFilesExist;
    const generation = (this._fileCheckGeneration.get(tip.id) ?? 0) + 1;
    this._fileCheckGeneration.set(tip.id, generation);
    try {
      const [promptFiles, agentInstructions] = await Promise.all([
        this._promptsService.listPromptFiles(config.promptType, CancellationToken.None),
        config.agentFileType ? this._promptsService.listAgentInstructions(CancellationToken.None) : Promise.resolve([])
      ]);
      if (this._fileCheckGeneration.get(tip.id) !== generation) {
        return;
      }
      const hasPromptFiles = promptFiles.length > 0;
      const hasAgentFile = config.agentFileType ? agentInstructions.some((f) => f.type === config.agentFileType) : false;
      const hasPromptFilesOrAgentFile = hasPromptFiles || hasAgentFile;
      if (hasPromptFilesOrAgentFile) {
        this._excludedByFiles.add(tip.id);
      } else {
        this._excludedByFiles.delete(tip.id);
      }
    } catch {
      if (this._fileCheckGeneration.get(tip.id) !== generation) {
        return;
      }
      if (config.excludeUntilChecked) {
        this._excludedByFiles.add(tip.id);
      }
    }
  }
  _persistSet(key, set) {
    this._storageService.store(key, JSON.stringify([...set]), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  _readApplicationWithProfileFallback(key) {
    const applicationValue = this._storageService.get(key, StorageScope.APPLICATION);
    if (applicationValue) {
      return applicationValue;
    }
    const profileValue = this._storageService.get(key, StorageScope.PROFILE);
    if (profileValue) {
      this._storageService.store(key, profileValue, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    return profileValue;
  }
};
TipEligibilityTracker = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IPromptsService),
  __decorateParam(4, ILanguageModelToolsService),
  __decorateParam(5, ILogService)
], TipEligibilityTracker);
export {
  TipEligibilityTracker
};
