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
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { CancellationError } from "../../../../../../base/common/errors.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IExtensionService } from "../../../../../services/extensions/common/extensions.js";
import { IFilesConfigurationService } from "../../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { getSkillFolderName } from "../config/promptFileLocations.js";
import { PromptFileParser } from "../promptFileParser.js";
import { PromptFileSource, PromptsType } from "../promptTypes.js";
import {
  CUSTOM_AGENT_PROVIDER_ACTIVATION_EVENT,
  INSTRUCTIONS_PROVIDER_ACTIVATION_EVENT,
  PROMPT_FILE_PROVIDER_ACTIVATION_EVENT,
  PromptsStorage,
  SKILL_PROVIDER_ACTIVATION_EVENT
} from "./promptsService.js";
const ALL_PROMPT_TYPES = [
  PromptsType.prompt,
  PromptsType.instructions,
  PromptsType.agent,
  PromptsType.skill,
  PromptsType.hook
];
let ExtensionPromptFileService = class extends Disposable {
  constructor(logger, fileService, modelService, extensionService, filesConfigService, contextKeyService) {
    super();
    this.logger = logger;
    this.fileService = fileService;
    this.modelService = modelService;
    this.extensionService = extensionService;
    this.filesConfigService = filesConfigService;
    this.contextKeyService = contextKeyService;
    /**
     * Files contributed via extension contribution points, keyed by type then URI.
     */
    this.contributedFiles = {
      [PromptsType.prompt]: new ResourceMap(),
      [PromptsType.instructions]: new ResourceMap(),
      [PromptsType.agent]: new ResourceMap(),
      [PromptsType.skill]: new ResourceMap(),
      [PromptsType.hook]: new ResourceMap()
    };
    /**
     * Providers registered via the proposed extension API.
     */
    this._promptFileProviders = [];
    /**
     * Context keys referenced by tracked `when` clauses (from contributed
     * files and provider results). Used to know when to re-evaluate.
     */
    this._contributedWhenKeys = /* @__PURE__ */ new Set();
    this._contributedWhenClauses = /* @__PURE__ */ new Map();
    this._providerWhenClauses = /* @__PURE__ */ new Map();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    /**
     * Pending URIs to mark as readonly, flushed on the next microtask.
     * Batches multiple `registerContributedFile` calls (which happen
     * synchronously in the extension point handler) into a single
     * `updateReadonly` call to avoid firing `onDidChangeReadonly` per file.
     */
    this._pendingReadonlyUris = [];
    this._pendingReadonlyFlush = false;
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this._contributedWhenKeys)) {
        for (const type of ALL_PROMPT_TYPES) {
          this._onDidChange.fire({ type });
        }
      }
    }));
  }
  /**
   * Returns the merged list of extension-contributed prompt files for the
   * given type, filtered by their `when` clause.
   */
  async getExtensionPromptFiles(type, token) {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const settledResults = await Promise.allSettled(this.contributedFiles[type].values());
    const contributedFiles = settledResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const activationEvent = this._getProviderActivationEvent(type);
    const providerFiles = activationEvent ? await this._listFromProviders(type, activationEvent, token) : [];
    return [...contributedFiles, ...providerFiles].filter((file) => {
      if (!file.when) {
        return true;
      }
      const when = ContextKeyExpr.deserialize(file.when);
      if (!when) {
        this.logger.warn(`[getExtensionPromptFiles] Ignoring contributed prompt file with invalid when clause: ${file.when}`);
        return false;
      }
      return this.contextKeyService.contextMatchesRules(when);
    });
  }
  /**
   * Registers a file contributed via a static contribution point. Returns
   * a disposable that removes the contribution.
   */
  registerContributedFile(type, uri, extension, name, description, when, sessionTypes) {
    const bucket = this.contributedFiles[type];
    if (bucket.has(uri)) {
      return Disposable.None;
    }
    const entryPromise = (async () => {
      if (type === PromptsType.skill) {
        try {
          const validated = await this._validateAndSanitizeSkillFile(uri, CancellationToken.None);
          name = validated.name;
          description = validated.description;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(`[registerContributedFile] Extension '${extension.identifier.value}' failed to validate skill file: ${uri}`, msg);
          throw e;
        }
      }
      return { uri, name, description, when, sessionTypes, storage: PromptsStorage.extension, type, extension, source: PromptFileSource.ExtensionContribution };
    })();
    bucket.set(uri, entryPromise);
    this._enqueueReadonlyUpdate(uri);
    if (when) {
      this._contributedWhenClauses.set(`${type}/${uri.toString()}`, when);
      this._updateContributedWhenKeys();
    }
    this._onDidChange.fire({ type });
    return {
      dispose: () => {
        bucket.delete(uri);
        if (when) {
          this._contributedWhenClauses.delete(`${type}/${uri.toString()}`);
          this._updateContributedWhenKeys();
        }
        this._onDidChange.fire({ type });
      }
    };
  }
  /**
   * Registers a prompt file provider (CustomAgentProvider, InstructionsProvider, or PromptFileProvider).
   * This is called by the extension host bridge when an extension registers a provider via
   * vscode.chat.registerCustomAgentProvider(), registerInstructionsProvider(), or
   * registerPromptFileProvider().
   */
  registerPromptFileProvider(extension, type, provider) {
    const providerEntry = { extension, type, ...provider };
    this._promptFileProviders.push(providerEntry);
    const disposables = new DisposableStore();
    if (provider.onDidChangePromptFiles) {
      disposables.add(provider.onDidChangePromptFiles(() => {
        this._onDidChange.fire({ type });
      }));
    }
    this._onDidChange.fire({ type });
    disposables.add({
      dispose: () => {
        const index = this._promptFileProviders.findIndex((p) => p === providerEntry);
        if (index >= 0) {
          this._promptFileProviders.splice(index, 1);
          this._providerWhenClauses.delete(providerEntry);
          this._updateContributedWhenKeys();
          this._onDidChange.fire({ type });
        }
      }
    });
    return disposables;
  }
  async _listFromProviders(type, activationEvent, token) {
    const result = [];
    const readonlyUris = [];
    await this.extensionService.activateByEvent(activationEvent);
    const providers = this._promptFileProviders.filter((p) => p.type === type);
    if (providers.length === 0) {
      return result;
    }
    for (const providerEntry of providers) {
      try {
        const files = await providerEntry.providePromptFiles({}, token);
        this._providerWhenClauses.set(providerEntry, files?.flatMap((file) => file.when ? [file.when] : []) ?? []);
        this._updateContributedWhenKeys();
        if (!files || token.isCancellationRequested) {
          continue;
        }
        for (const file of files) {
          readonlyUris.push(file.uri);
          result.push({
            uri: file.uri,
            storage: PromptsStorage.extension,
            type,
            extension: providerEntry.extension,
            source: PromptFileSource.ExtensionAPI,
            name: file.name,
            description: file.description,
            when: file.when,
            sessionTypes: file.sessionTypes
          });
        }
      } catch (e) {
        this.logger.error(`[listFromProviders] Failed to get ${type} files from provider`, e instanceof Error ? e.message : String(e));
      }
    }
    void this.filesConfigService.updateReadonly(readonlyUris, true);
    return result;
  }
  _getProviderActivationEvent(type) {
    switch (type) {
      case PromptsType.agent:
        return CUSTOM_AGENT_PROVIDER_ACTIVATION_EVENT;
      case PromptsType.instructions:
        return INSTRUCTIONS_PROVIDER_ACTIVATION_EVENT;
      case PromptsType.prompt:
        return PROMPT_FILE_PROVIDER_ACTIVATION_EVENT;
      case PromptsType.skill:
        return SKILL_PROVIDER_ACTIVATION_EVENT;
      case PromptsType.hook:
        return void 0;
    }
  }
  _enqueueReadonlyUpdate(uri) {
    this._pendingReadonlyUris.push(uri);
    if (!this._pendingReadonlyFlush) {
      this._pendingReadonlyFlush = true;
      queueMicrotask(() => {
        const uris = this._pendingReadonlyUris;
        this._pendingReadonlyUris = [];
        this._pendingReadonlyFlush = false;
        void this.filesConfigService.updateReadonly(uris, true);
      });
    }
  }
  _updateContributedWhenKeys() {
    this._contributedWhenKeys.clear();
    for (const whenClause of this._contributedWhenClauses.values()) {
      const expr = ContextKeyExpr.deserialize(whenClause);
      for (const key of expr?.keys() ?? []) {
        this._contributedWhenKeys.add(key);
      }
    }
    for (const whenClauses of this._providerWhenClauses.values()) {
      for (const whenClause of whenClauses) {
        const expr = ContextKeyExpr.deserialize(whenClause);
        for (const key of expr?.keys() ?? []) {
          this._contributedWhenKeys.add(key);
        }
      }
    }
  }
  // Skill validation
  async _validateAndSanitizeSkillFile(uri, token) {
    const parsedFile = await this._parsePromptFile(uri, token);
    const folderName = getSkillFolderName(uri);
    let name = parsedFile.header?.name;
    if (!name) {
      this.logger.debug(`[validateAndSanitizeSkillFile] Agent skill file missing name attribute, using folder name "${folderName}": ${uri}`);
      name = folderName;
    }
    const description = parsedFile.header?.description;
    let sanitizedName = this._truncateAgentSkillName(name, uri);
    if (sanitizedName !== folderName) {
      this.logger.debug(`[validateAndSanitizeSkillFile] Agent skill name "${sanitizedName}" does not match folder name "${folderName}", using folder name: ${uri}`);
      sanitizedName = folderName;
    }
    const sanitizedDescription = description ? this._truncateAgentSkillDescription(description, uri) : void 0;
    return { name: sanitizedName, description: sanitizedDescription };
  }
  async _parsePromptFile(uri, token) {
    const model = this.modelService.getModel(uri);
    if (model) {
      return new PromptFileParser().parse(uri, model.getValue());
    }
    const fileContent = await this.fileService.readFile(uri);
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    return new PromptFileParser().parse(uri, fileContent.value.toString());
  }
  _sanitizeAgentSkillText(text) {
    return text.replace(/<[^>]+>/g, "");
  }
  _truncateAgentSkillName(name, uri) {
    const MAX_NAME_LENGTH = 64;
    const sanitized = this._sanitizeAgentSkillText(name);
    if (sanitized !== name) {
      this.logger.debug(`[findAgentSkills] Agent skill name contains XML tags, removed: ${uri}`);
    }
    if (sanitized.length > MAX_NAME_LENGTH) {
      this.logger.debug(`[findAgentSkills] Agent skill name exceeds ${MAX_NAME_LENGTH} characters, truncated: ${uri}`);
      return sanitized.substring(0, MAX_NAME_LENGTH);
    }
    return sanitized;
  }
  _truncateAgentSkillDescription(description, uri) {
    const MAX_DESCRIPTION_LENGTH = 1024;
    const sanitized = this._sanitizeAgentSkillText(description);
    if (sanitized !== description) {
      this.logger.debug(`[findAgentSkills] Agent skill description contains XML tags, removed: ${uri}`);
    }
    if (sanitized.length > MAX_DESCRIPTION_LENGTH) {
      this.logger.debug(`[findAgentSkills] Agent skill description exceeds ${MAX_DESCRIPTION_LENGTH} characters, truncated: ${uri}`);
      return sanitized.substring(0, MAX_DESCRIPTION_LENGTH);
    }
    return sanitized;
  }
};
ExtensionPromptFileService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IFilesConfigurationService),
  __decorateParam(5, IContextKeyService)
], ExtensionPromptFileService);
export {
  ExtensionPromptFileService
};
