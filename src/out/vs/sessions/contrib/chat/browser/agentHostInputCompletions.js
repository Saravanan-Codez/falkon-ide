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
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { OffsetRange } from "../../../../editor/common/core/ranges/offsetRange.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { getCommandArgumentHint, getCompletionAction } from "../../../../platform/agentHost/common/meta/agentCompletionAttachmentMeta.js";
import { AgentHostCompletionReferenceKind, getAgentHostCompletionReferenceKind, isAgentHostCompletionVariableEntry, toAgentHostCompletionVariableEntry } from "../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js";
import { IChatSessionsService, isAgentHostTarget } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { getChatSessionType } from "../../../../workbench/contrib/chat/common/model/chatUri.js";
import { AgentHostInputCompletionsBase } from "../../../../workbench/contrib/chat/browser/widget/input/editor/agentHostInputCompletionsBase.js";
import { getInputPlaceholderColor, getRangeForPlaceholder } from "../../../../workbench/contrib/chat/browser/widget/input/editor/chatInputPlaceholderDecoration.js";
import { applyAgentHostCompletionAction, isPolicyBlockedCompletionAction } from "../../../../workbench/contrib/chat/browser/agentHostCompletionAction.js";
import { isAgentHostProvider } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionContext } from "../../../services/sessions/browser/sessionContext.js";
const ADD_REFERENCE_COMMAND = "sessions.chat.addAgentHostReference";
CommandsRegistry.registerCommand(ADD_REFERENCE_COMMAND, (_accessor, arg) => {
  arg.handler.acceptCompletion(arg.entry, arg.insertText, arg.range);
});
const CONFIG_ACTION_COMMAND = "sessions.chat.applyAgentHostConfigAction";
CommandsRegistry.registerCommand(CONFIG_ACTION_COMMAND, async (accessor, arg) => {
  await arg.handler.applyConfigAction(accessor, arg);
});
function getAgentHostCompletionAttachmentRange(value, referenceText, preferredRange, messageOffset, messageLength) {
  if (!referenceText) {
    return void 0;
  }
  let bestIndex = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  let from = 0;
  while (true) {
    const index = value.indexOf(referenceText, from);
    if (index < 0) {
      break;
    }
    const distance = preferredRange ? Math.abs(index - preferredRange.start) : index;
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
    from = index + referenceText.length;
  }
  if (bestIndex < 0) {
    return void 0;
  }
  const start = bestIndex - messageOffset;
  const endExclusive = start + referenceText.length;
  if (start < 0 || endExclusive > messageLength) {
    return void 0;
  }
  return new OffsetRange(start, endExclusive);
}
function getCommandArgumentHintPlaceholder(value, attachments, insertedReferences) {
  for (const entry of attachments) {
    if (getAgentHostCompletionReferenceKind(entry) !== AgentHostCompletionReferenceKind.Command) {
      continue;
    }
    const argumentHint = getCommandArgumentHint(entry._meta);
    if (!argumentHint) {
      continue;
    }
    const reference = insertedReferences.get(entry.id);
    if (!reference) {
      continue;
    }
    const range = getAgentHostCompletionAttachmentRange(value, reference.text, reference.range, 0, value.length);
    if (!range) {
      continue;
    }
    if (value.slice(0, range.start).trim().length > 0 || value.slice(range.endExclusive) !== " ") {
      return void 0;
    }
    return { argumentHint, endOffset: range.endExclusive };
  }
  return void 0;
}
let AgentHostInputCompletionHandler = class extends AgentHostInputCompletionsBase {
  constructor(_editor, _contextAttachments, languageFeaturesService, _sessionContext, chatSessionsService, _codeEditorService, _themeService, _configurationService) {
    super(languageFeaturesService, chatSessionsService);
    this._editor = _editor;
    this._contextAttachments = _contextAttachments;
    this._sessionContext = _sessionContext;
    this._codeEditorService = _codeEditorService;
    this._themeService = _themeService;
    this._configurationService = _configurationService;
    this._registration = this._register(new MutableDisposable());
    /**
     * Inserted reference per accepted attachment id. Used to find and decorate
     * the accepted occurrence in the editor and dropped when the user removes
     * the attachment chip.
     */
    this._insertedReferences = /* @__PURE__ */ new Map();
    this._register(this._codeEditorService.registerDecorationType(AgentHostInputCompletionHandler._argumentHintDecorationDescription, AgentHostInputCompletionHandler._argumentHintDecorationType, {}));
    this._decorations = this._editor.createDecorationsCollection();
    this._registerDecorations();
    let currentScheme;
    this._register(autorun((reader) => {
      const session = this._sessionContext.session.read(reader);
      const scheme = session ? getChatSessionType(session.resource) : void 0;
      if (scheme === currentScheme) {
        return;
      }
      currentScheme = scheme;
      this._registration.clear();
      if (scheme && isAgentHostTarget(scheme)) {
        void this._registerForScheme(scheme);
      }
    }));
  }
  static {
    this._className = "sessions-agent-host-reference";
  }
  static {
    this._argumentHintDecorationDescription = "sessions-chat";
  }
  static {
    this._argumentHintDecorationType = "sessions-command-argument-hint";
  }
  async _registerForScheme(scheme) {
    const triggerCharacters = await this._chatSessionsService.getChatInputCompletionTriggerCharacters(scheme);
    if (!triggerCharacters || triggerCharacters.length === 0) {
      return;
    }
    const activeSession = this._sessionContext.session.get();
    if (!activeSession || getChatSessionType(activeSession.resource) !== scheme) {
      return;
    }
    const editorUri = this._editor.getModel()?.uri;
    if (!editorUri) {
      return;
    }
    this._registration.value = this._registerProvider(
      { scheme: editorUri.scheme, hasAccessToAllModels: true },
      `sessionsAgentHostInputCompletions[${scheme}]`,
      triggerCharacters,
      scheme
    );
  }
  _resolveContext(model, scheme) {
    if (/^\s*\/troubleshoot\b/.test(model.getValue())) {
      return void 0;
    }
    const session = this._sessionContext.session.get();
    if (!session) {
      return void 0;
    }
    const sessionResource = session.resource;
    if (getChatSessionType(sessionResource) !== scheme) {
      return void 0;
    }
    return { sessionResource, context: void 0 };
  }
  _buildItem(position, item) {
    const replaceRange = AgentHostInputCompletionHandler.computeRange(position, item);
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
          const referenceText2 = item.insertText.trimEnd();
          const entry2 = keep ? toAgentHostCompletionVariableEntry(AgentHostCompletionReferenceKind.Command, referenceText2, attachment.command, attachment._meta) : void 0;
          return {
            label: { label, description: attachment.description },
            insertText: item.insertText,
            filterText: label,
            range: replaceRange,
            kind: CompletionItemKind.Text,
            documentation: attachment.description,
            command: {
              id: CONFIG_ACTION_COMMAND,
              title: "",
              arguments: [{
                handler: this,
                action,
                entry: entry2,
                referenceText: referenceText2,
                referenceRange: entry2 ? this._toOffsetRange(replaceRange.replace, referenceText2) : void 0
              }]
            }
          };
        }
        const referenceText = item.insertText.trimEnd();
        const entry = toAgentHostCompletionVariableEntry(AgentHostCompletionReferenceKind.Command, referenceText, attachment.command, attachment._meta);
        return {
          label: { label: item.insertText, description: attachment.description },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          kind: CompletionItemKind.Text,
          documentation: attachment.description,
          command: {
            id: ADD_REFERENCE_COMMAND,
            title: "",
            arguments: [{
              handler: this,
              entry,
              insertText: referenceText,
              range: this._toOffsetRange(replaceRange.replace, referenceText)
            }]
          }
        };
      }
      case "skill": {
        const referenceText = item.insertText.trimEnd();
        const entry = toAgentHostCompletionVariableEntry(AgentHostCompletionReferenceKind.Skill, referenceText, attachment.uri, attachment._meta);
        return {
          label: { label: item.insertText, description: attachment.description },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          documentation: attachment.description,
          kind: CompletionItemKind.Text,
          command: {
            id: ADD_REFERENCE_COMMAND,
            title: "",
            arguments: [{
              handler: this,
              entry,
              insertText: referenceText,
              range: this._toOffsetRange(replaceRange.replace, referenceText)
            }]
          }
        };
      }
      case "chat": {
        return void 0;
      }
      default: {
        const label = attachment.displayName ?? item.insertText;
        const description = attachment.uri.path;
        const kind = attachment.isDirectory ? CompletionItemKind.Folder : CompletionItemKind.File;
        const entry = {
          id: attachment.uri.toString(),
          name: attachment.displayName ?? this._basename(attachment.uri),
          value: attachment.uri,
          kind: attachment.isDirectory ? "directory" : "file",
          _meta: attachment._meta
        };
        return {
          label: { label, description },
          insertText: item.insertText,
          filterText: item.insertText,
          range: replaceRange,
          kind,
          command: {
            id: ADD_REFERENCE_COMMAND,
            title: "",
            arguments: [{
              handler: this,
              entry,
              insertText: item.insertText,
              range: this._toOffsetRange(replaceRange.replace, item.insertText)
            }]
          }
        };
      }
    }
  }
  _basename(uri) {
    const idx = uri.path.lastIndexOf("/");
    return idx >= 0 ? uri.path.slice(idx + 1) : uri.path;
  }
  // --- Attachment + decoration bridging ---
  /**
   * Called when the user accepts an item from the Monaco completion
   * widget (via the registered command). Adds the resource to the
   * context attachments and tracks the inserted text so it can be
   * highlighted in the editor.
   */
  acceptCompletion(entry, insertText, range) {
    this._insertedReferences.set(entry.id, { text: insertText, range });
    this._contextAttachments.setAttachments([...this._contextAttachments.attachments.filter((e) => e.id !== entry.id), entry]);
    this._updateDecorations();
  }
  /**
   * Accept handler for config-action completions (permission/mode toggles).
   * Applies the session-config change (gated by the elevated-permission
   * confirmation for `autoApprove`) via this input's scoped session's
   * agent-host provider. Keep-text items (non-empty insertText) then add their
   * argument-hint reference; toggle items insert nothing, so there is no text
   * to remove.
   */
  async applyConfigAction(accessor, arg) {
    const session = this._sessionContext.session.get();
    if (!session) {
      return;
    }
    const dialogService = accessor.get(IDialogService);
    const storageService = accessor.get(IStorageService);
    const sessionsProvidersService = accessor.get(ISessionsProvidersService);
    const applied = await applyAgentHostCompletionAction(arg.action, dialogService, storageService, async (config) => {
      const provider = sessionsProvidersService.getProvider(session.providerId);
      if (provider && isAgentHostProvider(provider)) {
        await Promise.all(Object.entries(config).map(([key, value]) => provider.setSessionConfigValue(session.sessionId, key, value).catch(() => {
        })));
      }
    });
    if (applied && arg.entry) {
      this.acceptCompletion(arg.entry, arg.referenceText, arg.referenceRange);
    }
  }
  getAttachmentsForSend(messageText, messageOffset = 0) {
    const model = this._editor.getModel();
    const value = model?.getValue() ?? "";
    const messageLength = messageText?.length ?? value.length;
    const result = [];
    for (const entry of this._contextAttachments.attachments) {
      const reference = this._insertedReferences.get(entry.id) ?? (isAgentHostCompletionVariableEntry(entry) ? { text: entry.name, range: void 0 } : void 0);
      if (!reference) {
        result.push(entry);
        continue;
      }
      const range = getAgentHostCompletionAttachmentRange(value, reference.text, reference.range, messageOffset, messageLength);
      if (!range) {
        if (!isAgentHostCompletionVariableEntry(entry)) {
          result.push(entry);
        }
        continue;
      }
      result.push({ ...entry, range });
    }
    return result;
  }
  _registerDecorations() {
    this._register(this._editor.onDidChangeModelContent(() => this._updateDecorations()));
    this._register(this._contextAttachments.onDidChangeContext(() => this._updateDecorations()));
    this._updateDecorations();
  }
  _updateDecorations() {
    const attachedIds = new Set(this._contextAttachments.attachments.map((a) => a.id));
    for (const id of [...this._insertedReferences.keys()]) {
      if (!attachedIds.has(id)) {
        this._insertedReferences.delete(id);
      }
    }
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    const value = model.getValue();
    const decos = [];
    for (const reference of this._insertedReferences.values()) {
      const range = getAgentHostCompletionAttachmentRange(value, reference.text, reference.range, 0, value.length);
      if (!range) {
        continue;
      }
      const startPos = model.getPositionAt(range.start);
      const endPos = model.getPositionAt(range.endExclusive);
      decos.push({
        range: {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        },
        options: { description: "sessions-agent-host-reference", inlineClassName: AgentHostInputCompletionHandler._className }
      });
    }
    this._decorations.set(decos);
    this._editor.setDecorationsByType(
      AgentHostInputCompletionHandler._argumentHintDecorationDescription,
      AgentHostInputCompletionHandler._argumentHintDecorationType,
      this._getArgumentHintDecorations(model, value)
    );
  }
  /**
   * Computes the inline placeholder (ghost text) shown after an accepted
   * agent-host slash command whose `_meta` carries an argument hint. Shown
   * only while the command is the sole content followed by a single trailing
   * space (i.e. before any argument has been typed).
   */
  _getArgumentHintDecorations(model, value) {
    const placeholder = getCommandArgumentHintPlaceholder(value, this._contextAttachments.attachments, this._insertedReferences);
    if (!placeholder) {
      return [];
    }
    const endPos = model.getPositionAt(placeholder.endOffset);
    return [{
      range: getRangeForPlaceholder({ startLineNumber: endPos.lineNumber, endLineNumber: endPos.lineNumber, startColumn: endPos.column, endColumn: endPos.column }),
      renderOptions: { after: { contentText: placeholder.argumentHint, color: getInputPlaceholderColor(this._themeService) } }
    }];
  }
  _toOffsetRange(range, insertText) {
    const model = this._editor.getModel();
    if (!model) {
      return void 0;
    }
    const start = model.getOffsetAt(range.getStartPosition());
    return new OffsetRange(start, start + insertText.length);
  }
};
AgentHostInputCompletionHandler = __decorateClass([
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, ISessionContext),
  __decorateParam(4, IChatSessionsService),
  __decorateParam(5, ICodeEditorService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IConfigurationService)
], AgentHostInputCompletionHandler);
export {
  AgentHostInputCompletionHandler,
  getAgentHostCompletionAttachmentRange,
  getCommandArgumentHintPlaceholder
};
