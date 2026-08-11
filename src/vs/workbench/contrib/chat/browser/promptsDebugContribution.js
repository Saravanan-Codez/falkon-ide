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
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { OS } from "../../../../base/common/platform.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IChatDebugService } from "../common/chatDebugService.js";
import { isAgentHostTarget } from "../common/chatSessionsService.js";
import { getChatSessionType } from "../common/model/chatUri.js";
import { IChatAgentService } from "../common/participants/chatAgents.js";
import { IChatService } from "../common/chatService/chatService.js";
import { formatHookCommandLabel } from "../common/promptSyntax/hookSchema.js";
import { HookType } from "../common/promptSyntax/hookTypes.js";
import { PromptsType } from "../common/promptSyntax/promptTypes.js";
import { IPromptsService } from "../common/promptSyntax/service/promptsService.js";
import { lastInstructionsCollectionResult } from "../common/promptSyntax/computeAutomaticInstructions.js";
let PromptsDebugContribution = class extends Disposable {
  constructor(promptsService, chatAgentService, chatService, chatDebugService, logService) {
    super();
    this.promptsService = promptsService;
    /**
     * Maps debug event IDs to their discovery info, so that
     * {@link IChatDebugService.resolveEvent} can return rich details.
     */
    this._discoveryEventDetails = /* @__PURE__ */ new Map();
    this._customizationEventDetails = /* @__PURE__ */ new Map();
    this._loggedSessions = /* @__PURE__ */ new Set();
    this._register(chatService.onDidDisposeSession((e) => {
      for (const sessionResource of e.sessionResources) {
        this._loggedSessions.delete(sessionResource.toString());
      }
    }));
    this._register(chatAgentService.onWillInvokeAgent(async (e) => {
      const sessionKey = e.request.sessionResource.toString();
      const isFirstInvocation = !this._loggedSessions.has(sessionKey);
      this._loggedSessions.add(sessionKey);
      const sessionResource = e.request.sessionResource;
      if (isFirstInvocation) {
        const cts = new CancellationTokenSource();
        try {
          const discoveryTypes = isAgentHostTarget(getChatSessionType(sessionResource)) ? [PromptsType.instructions, PromptsType.hook] : [PromptsType.agent, PromptsType.instructions, PromptsType.prompt, PromptsType.skill, PromptsType.hook];
          const discoveryInfos = await Promise.all(discoveryTypes.map((type) => this.promptsService.getDiscoveryInfo(type, cts.token)));
          for (const discoveryInfo of discoveryInfos) {
            const { name, details } = this.getDiscoveryLogEntry(discoveryInfo);
            const eventId = generateUuid();
            this._discoveryEventDetails.set(eventId, discoveryInfo);
            if (this._discoveryEventDetails.size > PromptsDebugContribution.MAX_DISCOVERY_DETAILS) {
              const first = this._discoveryEventDetails.keys().next().value;
              if (first !== void 0) {
                this._discoveryEventDetails.delete(first);
              }
            }
            const loaded = discoveryInfo.files.filter((f) => f.status === "loaded").map((f) => f.promptPath.name ?? f.promptPath.uri.path.split("/").pop() ?? f.promptPath.uri.toString());
            const skipped = discoveryInfo.files.filter((f) => f.status === "skipped").map((f) => {
              const label = f.promptPath.uri.toString();
              return f.skipReason ? `${label} (${f.skipReason})` : label;
            });
            const folders = discoveryInfo.sourceFolders?.map((sf) => sf.uri.path) ?? [];
            const parts = [];
            if (details) {
              parts.push(details);
            }
            if (loaded.length > 0) {
              parts.push(`loaded: [${truncateList(loaded)}]`);
            }
            if (skipped.length > 0) {
              parts.push(`skipped: [${truncateList(skipped)}]`);
            }
            if (folders.length > 0) {
              parts.push(`folders: [${truncateList(folders)}]`);
            }
            const newDetails = parts.join(" | ") || void 0;
            chatDebugService.log(
              sessionResource,
              name,
              newDetails,
              void 0,
              { id: eventId, category: "discovery" }
            );
          }
        } catch (error) {
          logService.error("Error while logging prompt discovery info to chat debug service", error);
        } finally {
          cts.dispose();
        }
      }
      const lastResult = lastInstructionsCollectionResult;
      if (!isFirstInvocation && lastResult) {
        const { telemetryEvent: collectionEvent, debugInfo } = lastResult;
        let resolvedHooks;
        try {
          const hookDiscoveryInfo = await this.promptsService.getDiscoveryInfo(PromptsType.hook, CancellationToken.None);
          resolvedHooks = hookDiscoveryInfo.hooksInfo?.hooks;
        } catch (error) {
          logService.warn("Error while fetching hooks for customization debug event", error);
        }
        const parts = [];
        if (collectionEvent.applyingInstructionsCount > 0) {
          parts.push(localize("customizations.applying", "{0} applying", collectionEvent.applyingInstructionsCount));
        }
        if (collectionEvent.referencedInstructionsCount > 0) {
          parts.push(localize("customizations.referenced", "{0} referenced", collectionEvent.referencedInstructionsCount));
        }
        if (collectionEvent.agentInstructionsCount > 0) {
          parts.push(localize("customizations.agent", "{0} agent", collectionEvent.agentInstructionsCount));
        }
        if (collectionEvent.listedInstructionsCount > 0) {
          parts.push(localize("customizations.listed", "{0} listed", collectionEvent.listedInstructionsCount));
        }
        const durationStr = debugInfo.durationInMillis.toFixed(1);
        const summary = parts.length > 0 ? localize("customizationsResolved.details", "Resolved {0} customizations ({1}) in {2}ms", collectionEvent.totalInstructionsCount, parts.join(", "), durationStr) : localize("customizationsResolved.none", "No customizations resolved");
        const detailSummaries = debugInfo.debugDetails.map((e2) => {
          const detail = e2.reason ? `${e2.name} \u2014 ${e2.reason}` : e2.name;
          return `[${e2.category}] ${detail}`;
        });
        const details = detailSummaries.length > 0 ? `${summary} | ${detailSummaries.join(", ")}` : summary;
        const customizationEventId = generateUuid();
        this._customizationEventDetails.set(customizationEventId, { debugInfo, hooks: resolvedHooks });
        if (this._customizationEventDetails.size > PromptsDebugContribution.MAX_DISCOVERY_DETAILS) {
          const first = this._customizationEventDetails.keys().next().value;
          if (first !== void 0) {
            this._customizationEventDetails.delete(first);
          }
        }
        chatDebugService.log(
          sessionResource,
          localize("customizationsResolved", "Resolve Customizations"),
          details,
          void 0,
          { id: customizationEventId, category: "customization" }
        );
      }
    }));
    this._register(chatDebugService.registerProvider({
      provideChatDebugLog: async () => void 0,
      resolveChatDebugLogEvent: async (eventId) => {
        return this._resolveDiscoveryEvent(eventId) ?? this._resolveCustomizationEvent(eventId);
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.promptsDebug";
  }
  static {
    this.MAX_DISCOVERY_DETAILS = 1e4;
  }
  getDiscoveryLogEntry(discoveryInfo) {
    const durationInMillis = discoveryInfo.durationInMillis.toFixed(1);
    const loadedCount = discoveryInfo.files.filter((file) => file.status === "loaded").length;
    const skippedCount = discoveryInfo.files.length - loadedCount;
    switch (discoveryInfo.type) {
      case PromptsType.prompt:
        return {
          name: localize("promptsService.loadSlashCommands", "Slash Commands Discovery"),
          details: loadedCount === 1 ? localize("promptsDebugContribution.resolvedSlashCommand", "Resolved {0} slash command in {1}ms", loadedCount, durationInMillis) : localize("promptsDebugContribution.resolvedSlashCommands", "Resolved {0} slash commands in {1}ms", loadedCount, durationInMillis)
        };
      case PromptsType.agent:
        return {
          name: localize("promptsService.loadAgents", "Agent Discovery"),
          details: loadedCount === 1 ? localize("promptsDebugContribution.resolvedAgent", "Resolved {0} agent in {1}ms", loadedCount, durationInMillis) : localize("promptsDebugContribution.resolvedAgents", "Resolved {0} agents in {1}ms", loadedCount, durationInMillis)
        };
      case PromptsType.skill:
        return {
          name: localize("promptsService.loadSkills", "Skill Discovery"),
          details: loadedCount === 1 ? localize("promptsDebugContribution.resolvedSkill", "Resolved {0} skill in {1}ms", loadedCount, durationInMillis) : localize("promptsDebugContribution.resolvedSkills", "Resolved {0} skills in {1}ms", loadedCount, durationInMillis)
        };
      case PromptsType.instructions:
        return {
          name: localize("promptsService.loadInstructions", "Instructions Discovery"),
          details: loadedCount === 1 ? localize("promptsDebugContribution.resolvedInstruction", "Resolved {0} instruction in {1}ms", loadedCount, durationInMillis) : localize("promptsDebugContribution.resolvedInstructions", "Resolved {0} instructions in {1}ms", loadedCount, durationInMillis)
        };
      case PromptsType.hook: {
        const hookDiscoveryInfo = discoveryInfo;
        const hookCount = hookDiscoveryInfo.hooksInfo ? Object.values(hookDiscoveryInfo.hooksInfo.hooks).reduce((total, hooks) => total + hooks.length, 0) : loadedCount;
        const details = skippedCount > 0 ? localize("promptsDebugContribution.resolvedHooksWithSkipped", "Resolved {0} hooks from {1} files in {2}ms, skipped {3}", hookCount, loadedCount, durationInMillis, skippedCount) : hookCount === 1 ? localize("promptsDebugContribution.resolvedHook", "Resolved {0} hook in {1}ms", hookCount, durationInMillis) : localize("promptsDebugContribution.resolvedHooks", "Resolved {0} hooks in {1}ms", hookCount, durationInMillis);
        return {
          name: localize("promptsService.loadHooks", "Hook Discovery"),
          details
        };
      }
    }
  }
  _resolveDiscoveryEvent(eventId) {
    const info = this._discoveryEventDetails.get(eventId);
    if (!info) {
      return void 0;
    }
    return this._toFileListContent(info);
  }
  _resolveCustomizationEvent(eventId) {
    const data = this._customizationEventDetails.get(eventId);
    if (!data) {
      return void 0;
    }
    const { debugInfo, hooks } = data;
    const logs = [...debugInfo.debugDetails];
    if (hooks) {
      for (const hookType of Object.values(HookType)) {
        const commands = hooks[hookType];
        if (commands && commands.length > 0) {
          for (const cmd of commands) {
            const commandLabel = formatHookCommandLabel(cmd, OS) || localize("hook.unknownCommand", "(unknown command)");
            logs.push({
              category: "hook",
              name: commandLabel,
              reason: hookType,
              uri: cmd.sourceUri
            });
          }
        }
      }
    }
    return {
      kind: "customizationSummary",
      resolutionLogs: logs,
      durationInMillis: debugInfo.durationInMillis,
      counts: {
        instructions: logs.filter((e) => e.category === "applying" || e.category === "referenced").length,
        skills: logs.filter((e) => e.category === "skill").length,
        agents: logs.filter((e) => e.category === "custom-agent").length,
        hooks: logs.filter((e) => e.category === "hook").length,
        skipped: logs.filter((e) => e.category === "skipped").length
      }
    };
  }
  _toFileListContent(info) {
    return {
      kind: "fileList",
      discoveryType: info.type,
      durationInMillis: info.durationInMillis,
      files: info.files.map((f) => ({
        uri: f.promptPath.uri,
        name: f.promptPath.name,
        status: f.status,
        storage: f.promptPath.storage,
        extensionId: f.promptPath.extension?.identifier.value,
        skipReason: f.skipReason,
        errorMessage: f.errorMessage,
        duplicateOf: f.duplicateOf
      })),
      sourceFolders: info.sourceFolders?.map((sf) => ({
        uri: sf.uri,
        storage: sf.storage
      }))
    };
  }
};
PromptsDebugContribution = __decorateClass([
  __decorateParam(0, IPromptsService),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IChatDebugService),
  __decorateParam(4, ILogService)
], PromptsDebugContribution);
const MAX_LIST_ITEMS = 100;
function truncateList(items) {
  if (items.length <= MAX_LIST_ITEMS) {
    return items.join(", ");
  }
  return items.slice(0, MAX_LIST_ITEMS).join(", ") + ` (+${items.length - MAX_LIST_ITEMS} more)`;
}
export {
  PromptsDebugContribution
};
