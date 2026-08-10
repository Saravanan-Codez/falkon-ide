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
import { Range } from "../../../../editor/common/core/range.js";
import { getWordAtText } from "../../../../editor/common/core/wordHelper.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../nls.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { getCopilotCliSessionRawId } from "../../../../workbench/contrib/chat/browser/copilotCliEventsUri.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { createSessionReferenceVariableEntry } from "../../../services/sessions/browser/sessionReference.js";
const VARIABLE_LEADER = "#";
const SESSION_TOKEN = "session";
const ADD_SESSION_REFERENCE_COMMAND = "sessions.chat.addSessionReference";
CommandsRegistry.registerCommand(ADD_SESSION_REFERENCE_COMMAND, (_accessor, arg) => {
  arg.handler.acceptSessionReference(arg.entry, arg.referenceText);
});
let SessionReferenceCompletionHandler = class extends Disposable {
  constructor(_editor, _contextAttachments, languageFeaturesService, sessionsManagementService, sessionsService) {
    super();
    this._editor = _editor;
    this._contextAttachments = _contextAttachments;
    this.languageFeaturesService = languageFeaturesService;
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    /** Inline `#session:<title>` reference texts present in the editor, for decoration. */
    this._referenceTexts = /* @__PURE__ */ new Set();
    this._decorations = this._editor.createDecorationsCollection();
    this._registerSessionCompletions();
    this._registerDecorations();
  }
  static {
    this._wordPattern = /#[^\s]*/g;
  }
  static {
    // MUST use g-flag
    this._className = "sessions-variable-reference";
  }
  _registerSessionCompletions() {
    const uri = this._editor.getModel()?.uri;
    if (!uri) {
      return;
    }
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: uri.scheme, hasAccessToAllModels: true }, {
      _debugDisplayName: "sessionsVariableSession",
      triggerCharacters: [VARIABLE_LEADER],
      provideCompletionItems: (model, position, _context, _token) => {
        const varWord = getWordAtText(position.column, SessionReferenceCompletionHandler._wordPattern, model.getLineContent(position.lineNumber), 0);
        if (!varWord || !varWord.word.startsWith(VARIABLE_LEADER)) {
          return null;
        }
        const typed = varWord.word.slice(VARIABLE_LEADER.length).toLowerCase();
        if (typed.length > 0 && !SESSION_TOKEN.startsWith(typed) && !typed.startsWith(SESSION_TOKEN)) {
          return null;
        }
        const replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
        const insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
        const suggestions = typed.length === 0 ? [] : this._collectSessionItems({ insert, replace });
        return { suggestions, incomplete: true };
      }
    }));
  }
  /** Attaches the chosen session and decorates its inline reference text. */
  acceptSessionReference(entry, referenceText) {
    this._contextAttachments.addAttachments(entry);
    this._referenceTexts.add(referenceText);
    this._updateDecorations();
  }
  _collectSessionItems(range) {
    const activeResource = this.sessionsService.activeSession.get()?.resource;
    const activeResourceStr = activeResource?.toString();
    const sessions = this.sessionsManagementService.getSessions().map((session) => ({ session, rawId: getCopilotCliSessionRawId(session.resource) })).filter((entry) => entry.rawId !== void 0).filter((entry) => {
      return !activeResource || entry.session.resource.scheme === activeResource.scheme;
    }).sort((a, b) => b.session.updatedAt.get().getTime() - a.session.updatedAt.get().getTime());
    return sessions.map(({ session, rawId }, index) => {
      const title = session.title.get() || localize("untitledSession", "Untitled session");
      const referenceTitle = title.replace(/\s+/g, " ").trim() || localize("untitledSession", "Untitled session");
      const isActive = activeResourceStr === session.resource.toString();
      const date = session.updatedAt.get().toLocaleString();
      const description = isActive ? localize("currentSessionLabel", "{0} (current)", date) : date;
      const referenceText = `${VARIABLE_LEADER}${SESSION_TOKEN}:${referenceTitle}`;
      const entry = createSessionReferenceVariableEntry(rawId, referenceTitle, session.resource);
      return {
        label: { label: referenceTitle, description },
        // Include the leading `#` so the typed `#session` word matches
        // (Monaco filters against the word including the trigger char).
        filterText: `${VARIABLE_LEADER}${SESSION_TOKEN} ${referenceTitle}`,
        // Insert the inline reference, replacing the typed `#session…` token.
        insertText: `${referenceText} `,
        range,
        kind: CompletionItemKind.Reference,
        sortText: String(index).padStart(4, "0"),
        command: {
          id: ADD_SESSION_REFERENCE_COMMAND,
          title: "",
          arguments: [{ handler: this, entry, referenceText }]
        }
      };
    });
  }
  // --- Decorations ---
  _registerDecorations() {
    this._register(this._editor.onDidChangeModelContent(() => this._updateDecorations()));
    this._updateDecorations();
  }
  _updateDecorations() {
    const model = this._editor.getModel();
    if (!model || this._referenceTexts.size === 0) {
      this._decorations.set([]);
      return;
    }
    const value = model.getValue();
    const decos = [];
    for (const referenceText of this._referenceTexts) {
      let index = value.indexOf(referenceText);
      while (index !== -1) {
        const startPos = model.getPositionAt(index);
        const endPos = model.getPositionAt(index + referenceText.length);
        decos.push({
          range: Range.fromPositions(startPos, endPos),
          options: { description: "sessions-session-reference", inlineClassName: SessionReferenceCompletionHandler._className }
        });
        index = value.indexOf(referenceText, index + referenceText.length);
      }
    }
    this._decorations.set(decos);
  }
};
SessionReferenceCompletionHandler = __decorateClass([
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, ISessionsManagementService),
  __decorateParam(4, ISessionsService)
], SessionReferenceCompletionHandler);
export {
  SessionReferenceCompletionHandler
};
