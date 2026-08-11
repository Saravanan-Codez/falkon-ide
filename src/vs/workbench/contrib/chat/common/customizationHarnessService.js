import { Codicon } from "../../../../base/common/codicons.js";
import { derived, observableValue } from "../../../../base/common/observable.js";
import { Emitter } from "../../../../base/common/event.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { AICustomizationManagementSection, BUILTIN_STORAGE } from "./aiCustomizationWorkspaceService.js";
import { PromptsType } from "./promptSyntax/promptTypes.js";
import { AGENT_MD_FILENAME } from "./promptSyntax/config/promptFileLocations.js";
import { matchesSessionType, PromptsStorage } from "./promptSyntax/service/promptsService.js";
import { SessionType } from "./chatSessionsService.js";
import { CustomAgent } from "./promptSyntax/service/promptsServiceImpl.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { getCanonicalPluginCommandId } from "./plugins/agentPluginService.js";
import { getChatSessionType, LocalChatSessionUri } from "./model/chatUri.js";
const ICustomizationHarnessService = createDecorator("customizationHarnessService");
function isPluginCustomizationItem(item) {
  return item.type === "plugin" || item.type === AICustomizationManagementSection.Plugins;
}
const EMPTY_DESCRIPTOR = {
  id: "",
  label: "",
  icon: Codicon.sparkle
};
function createVSCodeHarnessDescriptor() {
  return {
    id: SessionType.Local,
    label: localize("harness.local", "Local"),
    icon: ThemeIcon.fromId(Codicon.vm.id),
    supportsTroubleshoot: true,
    hiddenSections: [AICustomizationManagementSection.Tools],
    sectionOverrides: /* @__PURE__ */ new Map([
      [AICustomizationManagementSection.Instructions, {
        rootFileShortcuts: [AGENT_MD_FILENAME]
      }]
    ])
  };
}
class CustomizationHarnessServiceBase {
  constructor(staticHarnesses, defaultHarness, promptsService) {
    this.promptsService = promptsService;
    this._onDidChangeSlashCommands = new Emitter();
    this.onDidChangeSlashCommands = this._onDidChangeSlashCommands.event;
    this._onDidChangeCustomAgents = new Emitter();
    this.onDidChangeCustomAgents = this._onDidChangeCustomAgents.event;
    this._providerListeners = [];
    this._isDisposed = false;
    this._externalHarnesses = [];
    this._staticHarnesses = staticHarnesses;
    this.promptsService = promptsService;
    this._activeSessionResource = observableValue(this, this.getSessionResourceForHarness(defaultHarness));
    this.activeSessionResource = this._activeSessionResource;
    this._activeHarness = derived(this, (reader) => getChatSessionType(this._activeSessionResource.read(reader)));
    this.activeHarness = this._activeHarness;
    this._availableHarnesses = observableValue(this, [...this._staticHarnesses]);
    this.availableHarnesses = this._availableHarnesses;
    this._rebindProviderListeners();
  }
  _getAllHarnesses() {
    const externalIds = new Set(this._externalHarnesses.map((h) => h.id));
    return [
      ...this._staticHarnesses.filter((h) => !externalIds.has(h.id)),
      ...this._externalHarnesses
    ];
  }
  _refreshAvailableHarnesses() {
    if (this._isDisposed) {
      return;
    }
    this._availableHarnesses.set(this._getAllHarnesses(), void 0);
    this._rebindProviderListeners();
  }
  _rebindProviderListeners() {
    for (const listener of this._providerListeners) {
      listener.dispose();
    }
    this._providerListeners.length = 0;
    for (const harness of this._getAllHarnesses()) {
      const provider = harness.itemProvider;
      if (!provider) {
        this._providerListeners.push(this.promptsService.onDidChangeSlashCommands(() => this._onDidChangeSlashCommands.fire({ sessionType: harness.id })));
        this._providerListeners.push(this.promptsService.onDidChangeCustomAgents(() => this._onDidChangeCustomAgents.fire({ sessionType: harness.id })));
      } else {
        this._providerListeners.push(provider.onDidChange(() => this._onDidChangeSlashCommands.fire({ sessionType: harness.id })));
        this._providerListeners.push(provider.onDidChange(() => this._onDidChangeCustomAgents.fire({ sessionType: harness.id })));
      }
    }
  }
  dispose() {
    this._isDisposed = true;
    for (const listener of this._providerListeners) {
      listener.dispose();
    }
    this._providerListeners.length = 0;
    this._onDidChangeSlashCommands.dispose();
    this._onDidChangeCustomAgents.dispose();
  }
  registerExternalHarness(descriptor) {
    this._externalHarnesses.push(descriptor);
    this._refreshAvailableHarnesses();
    return {
      dispose: () => {
        if (this._isDisposed) {
          return;
        }
        const idx = this._externalHarnesses.indexOf(descriptor);
        if (idx >= 0) {
          this._externalHarnesses.splice(idx, 1);
          this._refreshAvailableHarnesses();
        }
      }
    };
  }
  findHarnessById(id) {
    return this._getAllHarnesses().find((h) => h.id === id);
  }
  setActiveSession(sessionResource) {
    this._activeSessionResource.set(sessionResource, void 0);
  }
  getActiveDescriptor() {
    const activeId = this._activeHarness.get();
    const descriptor = this.findHarnessById(activeId);
    return descriptor ?? EMPTY_DESCRIPTOR;
  }
  async getSlashCommands(sessionResource, token) {
    const sessionType = getChatSessionType(sessionResource);
    const harness = this.findHarnessById(sessionType);
    if (!harness || !harness.itemProvider) {
      const commands = await this.promptsService.getPromptSlashCommands(token);
      return commands.filter((command) => matchesSessionType(command.sessionTypes, sessionType));
    }
    const items = await harness.itemProvider.provideChatSessionCustomizations(sessionResource, token);
    if (!items) {
      return [];
    }
    const result = [];
    for (const item of items) {
      if (item.enabled !== false && (item.type === PromptsType.prompt || item.type === PromptsType.skill)) {
        const storage = item.source;
        const narrowStorage = storage !== void 0 && storage !== BUILTIN_STORAGE ? storage : PromptsStorage.local;
        result.push({
          uri: item.uri,
          type: item.type,
          name: item.pluginUri ? getCanonicalPluginCommandId({ uri: item.pluginUri, label: item.pluginLabel }, item.name) : item.name,
          description: item.description,
          userInvocable: item.userInvocable ?? true,
          storage: narrowStorage,
          sessionTypes: [sessionType]
        });
      }
    }
    return result;
  }
  async getCustomAgents(sessionResource, token) {
    const sessionType = getChatSessionType(sessionResource);
    const harness = this.findHarnessById(sessionType);
    if (!harness || !harness.itemProvider) {
      const allAgents = await this.promptsService.getCustomAgents(token);
      return allAgents.filter((agent) => matchesSessionType(agent.sessionTypes, sessionType));
    }
    if (harness.itemProvider.provideCustomAgents) {
      return harness.itemProvider.provideCustomAgents(sessionResource, token);
    }
    const items = await harness.itemProvider.provideChatSessionCustomizations(sessionResource, token);
    if (!items || token.isCancellationRequested) {
      return [];
    }
    const getSource = (item) => {
      if (item.source === PromptsStorage.extension && item.extensionId) {
        return { storage: PromptsStorage.extension, extensionId: new ExtensionIdentifier(item.extensionId) };
      } else if (item.source === PromptsStorage.plugin && item.pluginUri) {
        return { storage: PromptsStorage.plugin, pluginUri: item.pluginUri };
      } else if (item.source === PromptsStorage.user) {
        return { storage: PromptsStorage.user };
      }
      return { storage: PromptsStorage.local };
    };
    const result = [];
    for (const item of items) {
      if (item.type === PromptsType.agent) {
        const promptFile = await this.promptsService.parseNew(item.uri, token);
        const extra = {
          name: item.name,
          description: item.description,
          sessionTypes: [sessionType],
          hooks: void 0,
          source: getSource(item),
          type: PromptsType.agent,
          enabled: item.enabled !== false
        };
        result.push(CustomAgent.fromParsedPromptFile(promptFile, extra));
      }
    }
    return result;
  }
  async resolvePromptSlashCommand(name, sessionResource, token) {
    const commands = await this.getSlashCommands(sessionResource, token);
    const command = commands.find((cmd) => cmd.name === name);
    if (command) {
      const parsedPromptFile = await this.promptsService.parseNew(command.uri, token);
      return {
        ...command,
        userInvocable: parsedPromptFile.header?.userInvocable ?? command.userInvocable,
        parsedPromptFile
      };
    }
    return void 0;
  }
  getSessionResourceForHarness(sessionType) {
    if (sessionType === SessionType.Local) {
      return LocalChatSessionUri.getNewSessionUri();
    }
    return URI.from({ scheme: sessionType, path: "/untitled-2" });
  }
}
export {
  CustomizationHarnessServiceBase,
  ICustomizationHarnessService,
  createVSCodeHarnessDescriptor,
  isPluginCustomizationItem
};
