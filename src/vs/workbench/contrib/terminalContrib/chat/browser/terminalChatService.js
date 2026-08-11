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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { OS } from "../../../../../base/common/platform.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IChatService } from "../../../chat/common/chatService/chatService.js";
import { generateAutoApproveActions } from "../../chatAgentTools/browser/runInTerminalHelpers.js";
import { TreeSitterCommandParser, TreeSitterCommandParserLanguage } from "../../chatAgentTools/browser/treeSitterCommandParser.js";
import { CommandLineAutoApprover } from "../../chatAgentTools/browser/tools/commandLineAnalyzer/autoApprove/commandLineAutoApprover.js";
import { TerminalChatContextKeys } from "./terminalChat.js";
import { LocalChatSessionUri } from "../../../chat/common/model/chatUri.js";
import { isNumber, isString } from "../../../../../base/common/types.js";
var StorageKeys = /* @__PURE__ */ ((StorageKeys2) => {
  StorageKeys2["ToolSessionMappings"] = "terminalChat.toolSessionMappings";
  StorageKeys2["CommandIdMappings"] = "terminalChat.commandIdMappings";
  return StorageKeys2;
})(StorageKeys || {});
let TerminalChatService = class extends Disposable {
  constructor(_logService, _terminalService, _storageService, _contextKeyService, _chatService, _instantiationService) {
    super();
    this._logService = _logService;
    this._terminalService = _terminalService;
    this._storageService = _storageService;
    this._contextKeyService = _contextKeyService;
    this._chatService = _chatService;
    this._instantiationService = _instantiationService;
    this._terminalInstancesByToolSessionId = /* @__PURE__ */ new Map();
    this._toolSessionIdByTerminalInstance = /* @__PURE__ */ new Map();
    this._chatSessionResourceByTerminalInstance = /* @__PURE__ */ new Map();
    this._terminalInstanceListenersByToolSessionId = this._register(new DisposableMap());
    this._chatSessionListenersByTerminalInstance = this._register(new DisposableMap());
    this._terminalInstancesByExecutionId = /* @__PURE__ */ new Map();
    this._terminalInstanceListenersByExecutionId = this._register(new DisposableMap());
    this._ahpCommandSources = /* @__PURE__ */ new Map();
    this._outputSources = /* @__PURE__ */ new Map();
    this._onDidContinueInBackground = this._register(new Emitter());
    this.onDidContinueInBackground = this._onDidContinueInBackground.event;
    this._onDidRegisterTerminalInstanceForToolSession = this._register(new Emitter());
    this.onDidRegisterTerminalInstanceWithToolSession = this._onDidRegisterTerminalInstanceForToolSession.event;
    this._onDidRegisterOutputSource = this._register(new Emitter());
    this.onDidRegisterOutputSource = this._onDidRegisterOutputSource.event;
    this._activeProgressParts = /* @__PURE__ */ new Set();
    /**
     * Pending mappings restored from storage that have not yet been matched to a live terminal
     * instance (we match by persistentProcessId when it becomes available after reconnection).
     * toolSessionId -> persistentProcessId
     */
    this._pendingRestoredMappings = /* @__PURE__ */ new Map();
    /**
     * Tracks chat session resources that have auto approval enabled for all commands. This is a temporary
     * approval that lasts only for the duration of the session.
     */
    this._sessionAutoApprovalEnabled = new ResourceMap();
    /**
     * Tracks session-scoped auto-approve rules per chat session. These are temporary rules that
     * last only for the duration of the chat session (not persisted to disk).
     */
    this._sessionAutoApproveRules = new ResourceMap();
    this._hasToolTerminalContext = TerminalChatContextKeys.hasChatTerminals.bindTo(this._contextKeyService);
    this._hasHiddenToolTerminalContext = TerminalChatContextKeys.hasHiddenChatTerminals.bindTo(this._contextKeyService);
    this._restoreFromStorage();
    this._register(this._chatService.onDidDisposeSession((e) => {
      for (const resource of e.sessionResources) {
        this._sessionAutoApproveRules.delete(resource);
        this._sessionAutoApprovalEnabled.delete(resource);
      }
    }));
    this._register(this._terminalService.onDidChangeInstances(() => this._updateHasToolTerminalContextKeys()));
  }
  registerTerminalInstanceWithToolSession(terminalToolSessionId, instance) {
    if (!terminalToolSessionId) {
      this._logService.warn("Attempted to register a terminal instance with an undefined tool session ID");
      return;
    }
    const existingToolSessionId = this._toolSessionIdByTerminalInstance.get(instance);
    if (existingToolSessionId === terminalToolSessionId) {
      return;
    }
    if (existingToolSessionId !== void 0) {
      this._terminalInstanceListenersByToolSessionId.deleteAndDispose(existingToolSessionId);
      this._terminalInstancesByToolSessionId.delete(existingToolSessionId);
    }
    this._terminalInstancesByToolSessionId.set(terminalToolSessionId, instance);
    this._toolSessionIdByTerminalInstance.set(instance, terminalToolSessionId);
    this._onDidRegisterTerminalInstanceForToolSession.fire(instance);
    const instanceStore = new DisposableStore();
    instanceStore.add(instance.onDisposed(() => {
      this._terminalInstancesByToolSessionId.delete(terminalToolSessionId);
      this._toolSessionIdByTerminalInstance.delete(instance);
      this._terminalInstanceListenersByToolSessionId.deleteAndDispose(terminalToolSessionId);
      this._persistToStorage();
      this._updateHasToolTerminalContextKeys();
    }));
    instanceStore.add(this._chatService.onDidDisposeSession((e) => {
      for (const resource of e.sessionResources) {
        if (LocalChatSessionUri.parseLocalSessionId(resource) === terminalToolSessionId) {
          this._terminalInstancesByToolSessionId.delete(terminalToolSessionId);
          this._toolSessionIdByTerminalInstance.delete(instance);
          this._terminalInstanceListenersByToolSessionId.deleteAndDispose(terminalToolSessionId);
          this._sessionAutoApprovalEnabled.delete(resource);
          this._persistToStorage();
          this._updateHasToolTerminalContextKeys();
        }
      }
    }));
    this._terminalInstanceListenersByToolSessionId.set(terminalToolSessionId, instanceStore);
    if (isNumber(instance.shellLaunchConfig?.attachPersistentProcess?.id) || isNumber(instance.persistentProcessId)) {
      this._persistToStorage();
    }
    this._updateHasToolTerminalContextKeys();
  }
  async getTerminalInstanceByToolSessionId(terminalToolSessionId) {
    await this._terminalService.whenConnected;
    if (!terminalToolSessionId) {
      return void 0;
    }
    const pendingAhp = this._ahpCommandSources.get(terminalToolSessionId);
    if (pendingAhp) {
      try {
        return await pendingAhp.promisedTerminal;
      } catch (error) {
        this._logService.error(`Failed to resolve AHP terminal for tool session '${terminalToolSessionId}'`, error);
        return void 0;
      }
    }
    if (this._pendingRestoredMappings.has(terminalToolSessionId)) {
      const instance = this._terminalService.instances.find((i) => i.shellLaunchConfig.attachPersistentProcess?.id === this._pendingRestoredMappings.get(terminalToolSessionId));
      if (instance) {
        this._tryAdoptRestoredMapping(instance);
        return instance;
      }
    }
    return this._terminalInstancesByToolSessionId.get(terminalToolSessionId);
  }
  getToolSessionTerminalInstances(hiddenOnly) {
    if (hiddenOnly) {
      const foregroundInstances = new Set(this._terminalService.foregroundInstances.map((i) => i.instanceId));
      const uniqueInstances = new Set(this._terminalInstancesByToolSessionId.values());
      return Array.from(uniqueInstances).filter((i) => !foregroundInstances.has(i.instanceId));
    }
    return Array.from(new Set(this._terminalInstancesByToolSessionId.values()));
  }
  getToolSessionIdForInstance(instance) {
    return this._toolSessionIdByTerminalInstance.get(instance);
  }
  registerTerminalInstanceWithExecutionId(terminalExecutionId, instance) {
    this._terminalInstanceListenersByExecutionId.deleteAndDispose(terminalExecutionId);
    this._terminalInstancesByExecutionId.set(terminalExecutionId, instance);
    const instanceStore = new DisposableStore();
    const unregister = () => {
      if (this._terminalInstancesByExecutionId.get(terminalExecutionId) !== instance) {
        return;
      }
      this._terminalInstancesByExecutionId.delete(terminalExecutionId);
      this._terminalInstanceListenersByExecutionId.deleteAndDispose(terminalExecutionId);
    };
    instanceStore.add(instance.onDisposed(unregister));
    this._terminalInstanceListenersByExecutionId.set(terminalExecutionId, instanceStore);
    return toDisposable(unregister);
  }
  getTerminalInstanceByExecutionId(terminalExecutionId) {
    return this._terminalInstancesByExecutionId.get(terminalExecutionId);
  }
  registerTerminalInstanceWithChatSession(chatSessionResource, instance) {
    const existingResource = this._chatSessionResourceByTerminalInstance.get(instance);
    if (existingResource && existingResource.toString() === chatSessionResource.toString()) {
      return;
    }
    this._chatSessionListenersByTerminalInstance.deleteAndDispose(instance);
    this._chatSessionResourceByTerminalInstance.set(instance, chatSessionResource);
    const disposable = instance.onDisposed(() => {
      this._chatSessionResourceByTerminalInstance.delete(instance);
      this._chatSessionListenersByTerminalInstance.deleteAndDispose(instance);
    });
    this._chatSessionListenersByTerminalInstance.set(instance, disposable);
  }
  getChatSessionResourceForInstance(instance) {
    return this._chatSessionResourceByTerminalInstance.get(instance);
  }
  registerOutputSource(terminalToolSessionId, source) {
    this._outputSources.set(terminalToolSessionId, source);
    this._onDidRegisterOutputSource.fire(terminalToolSessionId);
    return toDisposable(() => {
      if (this._outputSources.get(terminalToolSessionId) === source) {
        this._outputSources.delete(terminalToolSessionId);
      }
    });
  }
  getOutputSource(terminalToolSessionId) {
    return terminalToolSessionId ? this._outputSources.get(terminalToolSessionId) : void 0;
  }
  isBackgroundTerminal(terminalToolSessionId) {
    if (!terminalToolSessionId) {
      return false;
    }
    const instance = this._terminalInstancesByToolSessionId.get(terminalToolSessionId);
    if (!instance) {
      return false;
    }
    return this._terminalService.instances.includes(instance) && !this._terminalService.foregroundInstances.includes(instance);
  }
  registerProgressPart(part) {
    this._activeProgressParts.add(part);
    if (this._isAfter(part, this._mostRecentProgressPart)) {
      this._mostRecentProgressPart = part;
    }
    return toDisposable(() => {
      this._activeProgressParts.delete(part);
      if (this._focusedProgressPart === part) {
        this._focusedProgressPart = void 0;
      }
      if (this._mostRecentProgressPart === part) {
        this._mostRecentProgressPart = this._getLastActiveProgressPart();
      }
    });
  }
  setFocusedProgressPart(part) {
    this._focusedProgressPart = part;
  }
  clearFocusedProgressPart(part) {
    if (this._focusedProgressPart === part) {
      this._focusedProgressPart = void 0;
    }
  }
  getFocusedProgressPart() {
    return this._focusedProgressPart;
  }
  getMostRecentProgressPart() {
    if (!this._mostRecentProgressPart || !this._activeProgressParts.has(this._mostRecentProgressPart)) {
      this._mostRecentProgressPart = this._getLastActiveProgressPart();
    }
    return this._mostRecentProgressPart;
  }
  _getLastActiveProgressPart() {
    let latest;
    for (const part of this._activeProgressParts) {
      if (this._isAfter(part, latest)) {
        latest = part;
      }
    }
    return latest;
  }
  _isAfter(candidate, current) {
    if (!current) {
      return true;
    }
    if (candidate.elementIndex === current.elementIndex) {
      return candidate.contentIndex >= current.contentIndex;
    }
    return candidate.elementIndex > current.elementIndex;
  }
  _restoreFromStorage() {
    try {
      const raw = this._storageService.get("terminalChat.toolSessionMappings" /* ToolSessionMappings */, StorageScope.WORKSPACE);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      for (const [toolSessionId, persistentProcessId] of parsed) {
        if (isString(toolSessionId) && isNumber(persistentProcessId)) {
          this._pendingRestoredMappings.set(toolSessionId, persistentProcessId);
        }
      }
    } catch (err) {
      this._logService.warn("Failed to restore terminal chat tool session mappings", err);
    }
  }
  _tryAdoptRestoredMapping(instance) {
    if (this._pendingRestoredMappings.size === 0) {
      return;
    }
    for (const [toolSessionId, persistentProcessId] of this._pendingRestoredMappings) {
      if (persistentProcessId === instance.shellLaunchConfig.attachPersistentProcess?.id) {
        this._terminalInstancesByToolSessionId.set(toolSessionId, instance);
        this._toolSessionIdByTerminalInstance.set(instance, toolSessionId);
        this._onDidRegisterTerminalInstanceForToolSession.fire(instance);
        this._terminalInstanceListenersByToolSessionId.set(toolSessionId, instance.onDisposed(() => {
          this._terminalInstancesByToolSessionId.delete(toolSessionId);
          this._toolSessionIdByTerminalInstance.delete(instance);
          this._terminalInstanceListenersByToolSessionId.deleteAndDispose(toolSessionId);
          this._persistToStorage();
        }));
        this._pendingRestoredMappings.delete(toolSessionId);
        this._persistToStorage();
        break;
      }
    }
  }
  _persistToStorage() {
    this._updateHasToolTerminalContextKeys();
    try {
      const entries = [];
      for (const [toolSessionId, instance] of this._terminalInstancesByToolSessionId.entries()) {
        const persistentId = isNumber(instance.persistentProcessId) ? instance.persistentProcessId : instance.shellLaunchConfig.attachPersistentProcess?.id;
        const shouldPersist = instance.shouldPersist || instance.shellLaunchConfig.forcePersist;
        if (isNumber(persistentId) && shouldPersist) {
          entries.push([toolSessionId, persistentId]);
        }
      }
      if (entries.length > 0) {
        this._storageService.store("terminalChat.toolSessionMappings" /* ToolSessionMappings */, JSON.stringify(entries), StorageScope.WORKSPACE, StorageTarget.MACHINE);
      } else {
        this._storageService.remove("terminalChat.toolSessionMappings" /* ToolSessionMappings */, StorageScope.WORKSPACE);
      }
    } catch (err) {
      this._logService.warn("Failed to persist terminal chat tool session mappings", err);
    }
  }
  _updateHasToolTerminalContextKeys() {
    const toolCount = this._terminalInstancesByToolSessionId.size;
    this._hasToolTerminalContext.set(toolCount > 0);
    const hiddenTerminalCount = this.getToolSessionTerminalInstances(true).length;
    this._hasHiddenToolTerminalContext.set(hiddenTerminalCount > 0);
  }
  setChatSessionAutoApproval(chatSessionResource, enabled) {
    if (enabled) {
      this._sessionAutoApprovalEnabled.set(chatSessionResource, true);
    } else {
      this._sessionAutoApprovalEnabled.delete(chatSessionResource);
    }
  }
  hasChatSessionAutoApproval(chatSessionResource) {
    return this._sessionAutoApprovalEnabled.has(chatSessionResource);
  }
  addSessionAutoApproveRule(chatSessionResource, key, value) {
    let sessionRules = this._sessionAutoApproveRules.get(chatSessionResource);
    if (!sessionRules) {
      sessionRules = {};
      this._sessionAutoApproveRules.set(chatSessionResource, sessionRules);
    }
    sessionRules[key] = value;
  }
  getSessionAutoApproveRules(chatSessionResource) {
    return this._sessionAutoApproveRules.get(chatSessionResource) ?? {};
  }
  async getAutoApproveActions(commandLine, language) {
    const trimmedCommandLine = commandLine.trimStart();
    if (trimmedCommandLine.length === 0) {
      return void 0;
    }
    this._autoApproveCommandParser ??= this._register(this._instantiationService.createInstance(TreeSitterCommandParser));
    const treeSitterLanguage = language === "powershell" ? TreeSitterCommandParserLanguage.PowerShell : TreeSitterCommandParserLanguage.Bash;
    let subCommands;
    try {
      const parseResult = await this._autoApproveCommandParser.extractAutoApprovalSubCommands(treeSitterLanguage, trimmedCommandLine);
      if (parseResult.hasUnanalyzableSyntax) {
        return void 0;
      }
      subCommands = parseResult.subCommands;
    } catch (e) {
      this._logService.warn("Failed to parse sub-commands when generating auto approve actions", e);
      return void 0;
    }
    if (subCommands.length === 0) {
      return void 0;
    }
    const shell = language === "powershell" ? "pwsh" : "bash";
    const evaluator = this._autoApproveEvaluator ??= this._register(this._instantiationService.createInstance(CommandLineAutoApprover));
    const subCommandResults = await Promise.all(subCommands.map((e) => evaluator.isCommandAutoApproved(e, shell, OS, void 0)));
    const commandLineResult = evaluator.isCommandLineAutoApproved(trimmedCommandLine);
    return generateAutoApproveActions(trimmedCommandLine, subCommands, { subCommandResults, commandLineResult }, { skipSessionScoped: true });
  }
  continueInBackground(terminalToolSessionId) {
    this._onDidContinueInBackground.fire(terminalToolSessionId);
  }
  registerAhpCommandSource(terminalToolSessionId, source, promisedTerminal) {
    this._ahpCommandSources.set(terminalToolSessionId, { source, promisedTerminal });
    return toDisposable(() => {
      if (this._ahpCommandSources.get(terminalToolSessionId)?.source === source) {
        this._ahpCommandSources.delete(terminalToolSessionId);
      }
    });
  }
  getAhpCommandSource(terminalToolSessionId) {
    return this._ahpCommandSources.get(terminalToolSessionId)?.source;
  }
};
TerminalChatService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ITerminalService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IInstantiationService)
], TerminalChatService);
export {
  TerminalChatService
};
