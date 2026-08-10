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
import { isEqual } from "../../../../base/common/resources.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { InjectedTextCursorStops } from "../../../../editor/common/model.js";
import { Range } from "../../../../editor/common/core/range.js";
import { getWordAtText } from "../../../../editor/common/core/wordHelper.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { localize } from "../../../../nls.js";
import { AICustomizationManagementCommands, AICustomizationManagementSection } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.js";
import { IChatSubmitRequestHandlerService } from "../../../../workbench/contrib/chat/browser/chatSubmitRequestHandlerService.js";
import { INewChatModelPickerService } from "./newChatModelPicker.js";
import { isAgentHostTarget } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { getChatSessionType } from "../../../../workbench/contrib/chat/common/model/chatUri.js";
import { ISessionContext } from "../../../services/sessions/browser/sessionContext.js";
import { ICustomizationHarnessService } from "../../../../workbench/contrib/chat/common/customizationHarnessService.js";
import { IChatPetService } from "../../../../workbench/contrib/chat/browser/chatPetService.js";
const SESSIONS_EXECUTE_SLASH_COMMAND_ID = "sessions.chat.executeSlashCommand";
CommandsRegistry.registerCommand(SESSIONS_EXECUTE_SLASH_COMMAND_ID, (_, handler, slashCommandStr) => {
  handler.tryExecuteSlashCommand(slashCommandStr);
  handler.clearInput();
});
let SlashCommandHandler = class extends Disposable {
  constructor(_editor, commandService, languageFeaturesService, harnessService, newChatModelPickerService, sessionContext, chatPetService, submitRequestHandlerService) {
    super();
    this._editor = _editor;
    this.commandService = commandService;
    this.languageFeaturesService = languageFeaturesService;
    this.harnessService = harnessService;
    this.newChatModelPickerService = newChatModelPickerService;
    this.sessionContext = sessionContext;
    this.chatPetService = chatPetService;
    this.id = "sessions.slashCommands";
    this._slashCommands = [];
    this._cachedPromptCommands = [];
    this._promptCommandsRefreshGeneration = 0;
    this._commandDecorations = this._editor.createDecorationsCollection();
    this._placeholderDecorations = this._editor.createDecorationsCollection();
    this._registerSlashCommands();
    this._register(submitRequestHandlerService.register(this));
    this._registerCompletions();
    this._registerDecorations();
    this._register(autorun((reader) => {
      this._refreshPromptCommands(this.sessionContext.session.read(reader)?.resource);
    }));
    this._register(this.harnessService.onDidChangeSlashCommands((e) => {
      const sessionResource = this.sessionContext.session.get()?.resource;
      if (sessionResource && e.sessionType === getChatSessionType(sessionResource)) {
        this._refreshPromptCommands(sessionResource);
      }
    }));
  }
  static {
    this._commandClassName = "sessions-slash-command";
  }
  static {
    this._placeholderClassName = "sessions-slash-placeholder";
  }
  clearInput() {
    this._editor.getModel()?.setValue("");
  }
  async tryHandle(request) {
    const currentSessionResource = this.sessionContext.session.get()?.resource;
    if (!currentSessionResource || !request.providerId || !request.sessionId || !isEqual(currentSessionResource, request.sessionResource)) {
      return false;
    }
    return this.tryExecuteSlashCommand(request.input);
  }
  _refreshPromptCommands(sessionResource) {
    const refreshGeneration = ++this._promptCommandsRefreshGeneration;
    if (!sessionResource) {
      this._cachedPromptCommands = [];
      this._updateDecorations();
      return;
    }
    this.harnessService.getSlashCommands(sessionResource, CancellationToken.None).then((commands) => {
      const currentSessionResource = this.sessionContext.session.get()?.resource;
      if (refreshGeneration !== this._promptCommandsRefreshGeneration || !currentSessionResource || !isEqual(currentSessionResource, sessionResource)) {
        return;
      }
      this._cachedPromptCommands = commands;
      this._updateDecorations();
    }, () => {
      const currentSessionResource = this.sessionContext.session.get()?.resource;
      if (refreshGeneration !== this._promptCommandsRefreshGeneration || !currentSessionResource || !isEqual(currentSessionResource, sessionResource)) {
        return;
      }
      this._cachedPromptCommands = [];
      this._updateDecorations();
    });
  }
  /**
   * Attempts to parse and execute a slash command from the input.
   * Returns `true` if a command was handled.
   */
  tryExecuteSlashCommand(query) {
    const match = query.match(/^\/([\w\p{L}\d_\-\.:]+)\s*(.*)/su);
    if (!match) {
      return false;
    }
    const commandName = match[1];
    const slashCommand = this._slashCommands.find((c) => c.command === commandName);
    if (!slashCommand) {
      return false;
    }
    slashCommand.execute(match[2]?.trim() ?? "");
    return true;
  }
  _registerSlashCommands() {
    const openSection = (section) => () => this.commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, section);
    this._slashCommands.push({
      command: "vscode-pet",
      detail: localize("slashCommand.vscodePet", "Toggle an interactive VS Code pet (Experimental)"),
      sortText: "z3_vscodePet",
      executeImmediately: true,
      execute: () => this.chatPetService.toggle()
    });
    this._slashCommands.push({
      command: "agents",
      detail: localize("slashCommand.agents", "View and manage custom agents"),
      sortText: "z3_agents",
      executeImmediately: true,
      execute: openSection(AICustomizationManagementSection.Agents)
    });
    this._slashCommands.push({
      command: "skills",
      detail: localize("slashCommand.skills", "View and manage skills"),
      sortText: "z3_skills",
      executeImmediately: true,
      execute: openSection(AICustomizationManagementSection.Skills)
    });
    this._slashCommands.push({
      command: "instructions",
      detail: localize("slashCommand.instructions", "View and manage instructions"),
      sortText: "z3_instructions",
      executeImmediately: true,
      execute: openSection(AICustomizationManagementSection.Instructions)
    });
    this._slashCommands.push({
      command: "hooks",
      detail: localize("slashCommand.hooks", "View and manage hooks"),
      sortText: "z3_hooks",
      executeImmediately: true,
      execute: openSection(AICustomizationManagementSection.Hooks)
    });
    this._slashCommands.push({
      command: "models",
      detail: localize("slashCommand.models", "Open the model picker"),
      sortText: "z3_models",
      executeImmediately: true,
      execute: () => this.newChatModelPickerService.openModelPicker()
    });
  }
  _registerDecorations() {
    this._register(this._editor.onDidChangeModelContent(() => this._updateDecorations()));
    this._register(autorun((reader) => {
      this.sessionContext.session.read(reader);
      this._updateDecorations();
    }));
    this._updateDecorations();
  }
  _updateDecorations() {
    const model = this._editor.getModel();
    const value = model?.getValue() ?? "";
    const match = value.match(/^\/([\w\p{L}\d_\-\.:]+)\s?/u);
    const activeSession = this.sessionContext.session.get();
    if (!match || activeSession && isAgentHostTarget(getChatSessionType(activeSession.resource))) {
      this._commandDecorations.clear();
      this._placeholderDecorations.clear();
      return;
    }
    const commandName = match[1];
    const slashCommand = this._slashCommands.find((c) => c.command === commandName);
    const promptCommand = this._cachedPromptCommands.find((c) => c.name === commandName);
    if (!slashCommand && !promptCommand) {
      this._commandDecorations.clear();
      this._placeholderDecorations.clear();
      return;
    }
    const commandEnd = match[0].trimEnd().length;
    this._commandDecorations.set([{
      range: new Range(1, 1, 1, commandEnd + 1),
      options: { description: "sessions-slash-command", inlineClassName: SlashCommandHandler._commandClassName }
    }]);
    const restOfInput = value.slice(match[0].length).trim();
    const detail = slashCommand?.detail ?? promptCommand?.argumentHint;
    if (!restOfInput && detail) {
      const placeholderCol = match[0].length + 1;
      this._placeholderDecorations.set([{
        range: new Range(1, placeholderCol, 1, model.getLineMaxColumn(1)),
        options: {
          description: "sessions-slash-placeholder",
          // The range is collapsed (nothing follows the command), so injected
          // text only renders with `showIfCollapsed`.
          showIfCollapsed: true,
          after: { content: detail, inlineClassName: SlashCommandHandler._placeholderClassName, cursorStops: InjectedTextCursorStops.None }
        }
      }]);
    } else {
      this._placeholderDecorations.clear();
    }
  }
  _registerCompletions() {
    const uri = this._editor.getModel()?.uri;
    if (!uri) {
      return;
    }
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: uri.scheme, hasAccessToAllModels: true }, {
      _debugDisplayName: "sessionsSlashCommands",
      triggerCharacters: ["/"],
      provideCompletionItems: (model, position, _context, _token) => {
        const range = this._computeCompletionRanges(model, position, /\/\w*/g);
        if (!range) {
          return null;
        }
        const textBefore = model.getValueInRange(new Range(1, 1, range.replace.startLineNumber, range.replace.startColumn));
        if (textBefore.trim() !== "") {
          return null;
        }
        return {
          suggestions: this._slashCommands.map((c, i) => {
            const withSlash = `/${c.command}`;
            return {
              label: withSlash,
              insertText: c.executeImmediately ? "" : `${withSlash} `,
              detail: c.detail,
              range,
              sortText: c.sortText ?? "a".repeat(i + 1),
              kind: CompletionItemKind.Text,
              command: c.executeImmediately ? { id: SESSIONS_EXECUTE_SLASH_COMMAND_ID, title: withSlash, arguments: [this, withSlash] } : void 0
            };
          })
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: uri.scheme, hasAccessToAllModels: true }, {
      _debugDisplayName: "sessionsPromptSlashCommands",
      triggerCharacters: ["/"],
      provideCompletionItems: async (model, position, _context, token) => {
        const activeSession = this.sessionContext.session.get();
        if (!activeSession) {
          return null;
        }
        if (isAgentHostTarget(getChatSessionType(activeSession.resource))) {
          return null;
        }
        const range = this._computeCompletionRanges(model, position, /\/[\p{L}0-9_.:-]*/gu);
        if (!range) {
          return null;
        }
        const textBefore = model.getValueInRange(new Range(1, 1, range.replace.startLineNumber, range.replace.startColumn));
        if (textBefore.trim() !== "") {
          return null;
        }
        const promptCommands = await this.harnessService.getSlashCommands(activeSession?.resource, token);
        const userInvocable = promptCommands.filter((c) => c.userInvocable);
        if (userInvocable.length === 0) {
          return null;
        }
        return {
          suggestions: userInvocable.map((c, i) => {
            const label = `/${c.name}`;
            return {
              label: { label, description: c.description },
              insertText: `${label} `,
              documentation: c.description,
              range,
              sortText: "b".repeat(i + 1),
              kind: CompletionItemKind.Text
            };
          })
        };
      }
    }));
  }
  _computeCompletionRanges(model, position, reg) {
    const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
    if (!varWord && model.getWordUntilPosition(position).word) {
      return;
    }
    if (!varWord && position.column > 1) {
      const textBefore = model.getValueInRange(new Range(position.lineNumber, position.column - 1, position.lineNumber, position.column));
      if (textBefore !== " ") {
        return;
      }
    }
    let insert;
    let replace;
    if (!varWord) {
      insert = replace = Range.fromPositions(position);
    } else {
      insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
      replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
    }
    return { insert, replace };
  }
};
SlashCommandHandler = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, ICustomizationHarnessService),
  __decorateParam(4, INewChatModelPickerService),
  __decorateParam(5, ISessionContext),
  __decorateParam(6, IChatPetService),
  __decorateParam(7, IChatSubmitRequestHandlerService)
], SlashCommandHandler);
export {
  SESSIONS_EXECUTE_SLASH_COMMAND_ID,
  SlashCommandHandler
};
