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
import { DisposableMap } from "../../../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { assertType } from "../../../../../../../base/common/types.js";
import { localize } from "../../../../../../../nls.js";
import { AgentHostCompletionReferenceKind, chatReferenceVariableEntryId, toAgentHostCompletionVariableEntry, toChatReferenceDynamicVariableValue } from "../../../../common/attachments/chatVariableEntries.js";
import { CompletionItemKind } from "../../../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../../../editor/common/services/languageFeatures.js";
import { CommandsRegistry } from "../../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../../../platform/dialogs/common/dialogs.js";
import { IStorageService } from "../../../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../../../platform/workspace/common/workspace.js";
import { IAgentHostService } from "../../../../../../../platform/agentHost/common/agentService.js";
import { getCompletionAction } from "../../../../../../../platform/agentHost/common/meta/agentCompletionAttachmentMeta.js";
import { Registry } from "../../../../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../../../../common/contributions.js";
import { LifecyclePhase } from "../../../../../../services/lifecycle/common/lifecycle.js";
import { ChatDynamicVariableModel } from "../../../attachments/chatDynamicVariables.js";
import { IChatSessionsService, isAgentHostTarget } from "../../../../common/chatSessionsService.js";
import { getChatSessionType } from "../../../../common/model/chatUri.js";
import { IChatWidgetService } from "../../../chat.js";
import { applyAgentHostCompletionAction, isPolicyBlockedCompletionAction } from "../../../agentHostCompletionAction.js";
import { applyAgentHostSessionConfigChange } from "../../../agentSessions/agentHost/applyAgentHostSessionConfig.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "../../../agentSessions/agentHost/agentHostSessionWorkingDirectoryResolver.js";
import { IAgentHostUntitledProvisionalSessionService } from "../../../agentSessions/agentHost/agentHostUntitledProvisionalSessionService.js";
import { AgentHostInputCompletionsBase } from "./agentHostInputCompletionsBase.js";
let AgentHostInputCompletions = class extends AgentHostInputCompletionsBase {
  constructor(languageFeaturesService, _chatWidgetService, chatSessionsService, _configurationService) {
    super(languageFeaturesService, chatSessionsService);
    this._chatWidgetService = _chatWidgetService;
    this._configurationService = _configurationService;
    /** Per-scheme registrations of the Monaco completion provider. */
    this._registrations = this._register(new DisposableMap());
    this._register(CommandsRegistry.registerCommand(AgentHostInputCompletions.addReferenceCommand, (_services, arg) => {
      assertType(arg instanceof AgentHostReferenceArgument);
      arg.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
        id: arg.id,
        range: arg.range,
        isFile: arg.isFile,
        isDirectory: arg.isDirectory,
        fullName: arg.displayName,
        data: arg.data,
        _meta: arg._meta
      });
    }));
    this._register(CommandsRegistry.registerCommand(AgentHostInputCompletions.configActionCommand, async (accessor, arg) => {
      assertType(arg instanceof AgentHostConfigActionArgument);
      const sessionResource = arg.widget.viewModel?.model.sessionResource;
      if (!sessionResource) {
        return;
      }
      const dialogService = accessor.get(IDialogService);
      const storageService = accessor.get(IStorageService);
      const services = {
        agentHostService: accessor.get(IAgentHostService),
        provisionalService: accessor.get(IAgentHostUntitledProvisionalSessionService),
        workingDirectoryResolver: accessor.get(IAgentHostSessionWorkingDirectoryResolver),
        workspaceContextService: accessor.get(IWorkspaceContextService),
        configurationService: accessor.get(IConfigurationService)
      };
      const applied = await applyAgentHostCompletionAction(arg.action, dialogService, storageService, async (config) => {
        await applyAgentHostSessionConfigChange(sessionResource, config, services);
      });
      if (applied && arg.reference) {
        arg.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
          id: arg.reference.id,
          range: arg.reference.range,
          isFile: arg.reference.isFile,
          isDirectory: arg.reference.isDirectory,
          fullName: arg.reference.displayName,
          data: arg.reference.data,
          _meta: arg.reference._meta
        });
      }
    }));
    for (const scheme of this._chatSessionsService.getContentProviderSchemes()) {
      void this._registerForScheme(scheme);
    }
    this._register(this._chatSessionsService.onDidChangeContentProviderSchemes(({ added, removed }) => {
      for (const scheme of removed) {
        this._registrations.deleteAndDispose(scheme);
      }
      for (const scheme of added) {
        void this._registerForScheme(scheme);
      }
    }));
  }
  static {
    this.addReferenceCommand = "_chatAgentHostAddReferenceCmd";
  }
  static {
    this.configActionCommand = "_chatAgentHostConfigActionCmd";
  }
  async _registerForScheme(scheme) {
    if (!isAgentHostTarget(scheme)) {
      return;
    }
    const triggerCharacters = await this._chatSessionsService.getChatInputCompletionTriggerCharacters(scheme);
    if (!triggerCharacters || triggerCharacters.length === 0) {
      return;
    }
    if (!this._chatSessionsService.getContentProviderSchemes().includes(scheme)) {
      return;
    }
    this._registrations.set(scheme, this._registerProvider(
      { scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true },
      `agentHostChatInputCompletions[${scheme}]`,
      triggerCharacters,
      scheme
    ));
  }
  _resolveContext(model, scheme) {
    const widget = this._chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget?.viewModel) {
      return void 0;
    }
    const sessionResource = widget.viewModel.model.sessionResource;
    if (getChatSessionType(sessionResource) !== scheme) {
      return void 0;
    }
    return { sessionResource, context: widget };
  }
  _buildItem(position, item, widget) {
    const replaceRange = AgentHostInputCompletions.computeRange(position, item);
    const attachment = item.attachment;
    switch (attachment.kind) {
      case "command": {
        const action = getCompletionAction(attachment._meta);
        if (action) {
          if (isPolicyBlockedCompletionAction(action, this._configurationService)) {
            return void 0;
          }
          const keep = item.insertText !== "";
          const label = item.label ?? item.insertText;
          const reference = keep ? AgentHostReferenceArgument.forCommand(widget, attachment.command, attachment.description, AgentHostInputCompletions._insertedTokenRange(replaceRange, item.insertText), attachment._meta) : void 0;
          return {
            label: { label, description: attachment.description },
            insertText: item.insertText,
            filterText: label,
            range: replaceRange,
            kind: CompletionItemKind.Text,
            detail: attachment.description,
            command: {
              id: AgentHostInputCompletions.configActionCommand,
              title: "",
              arguments: [new AgentHostConfigActionArgument(widget, action, reference)]
            }
          };
        }
        return {
          label: { label: item.insertText, description: attachment.description },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          kind: CompletionItemKind.Text,
          detail: attachment.description,
          command: {
            id: AgentHostInputCompletions.addReferenceCommand,
            title: "",
            arguments: [AgentHostReferenceArgument.forCommand(widget, attachment.command, attachment.description, AgentHostInputCompletions._insertedTokenRange(replaceRange, item.insertText), attachment._meta)]
          }
        };
      }
      case "skill": {
        const label = attachment.displayName ? "/" + attachment.displayName : item.insertText.trimEnd();
        return {
          label: { label, description: attachment.description },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          kind: CompletionItemKind.Text,
          detail: attachment.description,
          command: {
            id: AgentHostInputCompletions.addReferenceCommand,
            title: "",
            arguments: [AgentHostReferenceArgument.forSkill(widget, attachment.uri, attachment.displayName, AgentHostInputCompletions._insertedTokenRange(replaceRange, item.insertText), attachment._meta)]
          }
        };
      }
      case "chat": {
        const label = attachment.displayName ?? attachment.title;
        return {
          label: { label, description: localize("chatReferenceDescription", "Chat") },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          kind: CompletionItemKind.Reference,
          command: {
            id: AgentHostInputCompletions.addReferenceCommand,
            title: "",
            arguments: [AgentHostReferenceArgument.forChat(widget, attachment.uri, attachment.endTurn, attachment.title, attachment.displayName, AgentHostInputCompletions._insertedTokenRange(replaceRange, item.insertText), attachment._meta)]
          }
        };
      }
      default: {
        const label = attachment.displayName ?? item.insertText;
        const description = attachment.uri.path;
        return {
          label: { label, description },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          kind: attachment.isDirectory ? CompletionItemKind.Folder : CompletionItemKind.File,
          command: {
            id: AgentHostInputCompletions.addReferenceCommand,
            title: "",
            arguments: [AgentHostReferenceArgument.forResource(widget, attachment.uri, attachment.displayName, !!attachment.isDirectory, AgentHostInputCompletions._insertedRange(replaceRange, item.insertText), attachment._meta)]
          }
        };
      }
    }
  }
  static _insertedRange(replaceRange, insertText) {
    return replaceRange.replace.setEndPosition(replaceRange.replace.startLineNumber, replaceRange.replace.startColumn + insertText.length);
  }
  static _insertedTokenRange(replaceRange, insertText) {
    return this._insertedRange(replaceRange, insertText.trimEnd());
  }
};
AgentHostInputCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatSessionsService),
  __decorateParam(3, IConfigurationService)
], AgentHostInputCompletions);
class AgentHostReferenceArgument {
  constructor(widget, id, data, displayName, isFile, isDirectory, range, _meta) {
    this.widget = widget;
    this.id = id;
    this.data = data;
    this.displayName = displayName;
    this.isFile = isFile;
    this.isDirectory = isDirectory;
    this.range = range;
    this._meta = _meta;
  }
  static forResource(widget, uri, displayName, isDirectory, range, _meta) {
    return new AgentHostReferenceArgument(widget, uri.toString(), uri, displayName, !isDirectory, isDirectory, range, _meta);
  }
  static forSkill(widget, uri, displayName, range, _meta) {
    const entry = toAgentHostCompletionVariableEntry(AgentHostCompletionReferenceKind.Skill, displayName ?? uri.toString(), uri, _meta);
    return new AgentHostReferenceArgument(widget, entry.id, entry.value, displayName, false, false, range, _meta);
  }
  static forCommand(widget, command, description, range, _meta) {
    const entry = toAgentHostCompletionVariableEntry(AgentHostCompletionReferenceKind.Command, description ?? command, command, _meta);
    return new AgentHostReferenceArgument(widget, entry.id, entry.value, description, false, false, range, _meta);
  }
  static forChat(widget, uri, endTurn, title, displayName, range, _meta) {
    return new AgentHostReferenceArgument(widget, chatReferenceVariableEntryId(uri, endTurn), toChatReferenceDynamicVariableValue(uri, endTurn), displayName ?? title, false, false, range, _meta);
  }
}
class AgentHostConfigActionArgument {
  constructor(widget, action, reference) {
    this.widget = widget;
    this.action = action;
    this.reference = reference;
  }
}
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(AgentHostInputCompletions, LifecyclePhase.Eventually);
export {
  AgentHostInputCompletions
};
