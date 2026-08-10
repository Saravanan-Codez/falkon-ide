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
import { renderAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent, observableSignalFromEvent, observableValue, waitForState } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { observableCodeEditor } from "../../../../editor/browser/observableCodeEditor.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { IMarkerDecorationsService } from "../../../../editor/common/services/markerDecorations.js";
import { localize } from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IChatEditingService, ModifiedFileEntryState } from "../../chat/common/editing/chatEditingService.js";
import { ChatMode } from "../../chat/common/chatModes.js";
import { IChatService, IChatToolInvocation, ToolConfirmKind } from "../../chat/common/chatService/chatService.js";
import { IDiagnosticVariableEntryFilterData } from "../../chat/common/attachments/chatVariableEntries.js";
import { isResponseVM } from "../../chat/common/model/chatViewModel.js";
import { ChatAgentLocation } from "../../chat/common/constants.js";
import { ILanguageModelChatMetadata, ILanguageModelsService, isILanguageModelChatSelector } from "../../chat/common/languageModels.js";
import { isNotebookContainingCellEditor as isNotebookWithCellEditor } from "../../notebook/browser/notebookEditor.js";
import { INotebookEditorService } from "../../notebook/browser/services/notebookEditorService.js";
import { CellUri } from "../../notebook/common/notebookCommon.js";
import { CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT, CTX_INLINE_CHAT_TERMINATED, CTX_INLINE_CHAT_VISIBLE, INLINE_CHAT_ID, InlineChatConfigKeys } from "../common/inlineChat.js";
import { InlineChatAffordance } from "./inlineChatAffordance.js";
import { continueInPanelChat, IInlineChatSessionService, rephraseInlineChat } from "./inlineChatSessionService.js";
import { InlineChatZoneWidget } from "./inlineChatZoneWidget.js";
class InlineChatRunOptions {
  static isInlineChatRunOptions(options) {
    if (typeof options !== "object" || options === null) {
      return false;
    }
    const { initialSelection, initialRange, message, autoSend, position, attachments, modelSelector, resolveOnResponse, attachDiagnostics } = options;
    if (typeof message !== "undefined" && typeof message !== "string" || typeof autoSend !== "undefined" && typeof autoSend !== "boolean" || typeof initialRange !== "undefined" && !Range.isIRange(initialRange) || typeof initialSelection !== "undefined" && !Selection.isISelection(initialSelection) || typeof position !== "undefined" && !Position.isIPosition(position) || typeof attachments !== "undefined" && (!Array.isArray(attachments) || !attachments.every((item) => item instanceof URI)) || typeof modelSelector !== "undefined" && !isILanguageModelChatSelector(modelSelector) || typeof resolveOnResponse !== "undefined" && typeof resolveOnResponse !== "boolean" || typeof attachDiagnostics !== "undefined" && typeof attachDiagnostics !== "boolean") {
      return false;
    }
    return true;
  }
}
function getEditorId(editor, model) {
  return `${editor.getId()},${model.id}`;
}
let InlineChatController = class {
  static {
    this.ID = INLINE_CHAT_ID;
  }
  static get(editor) {
    return editor.getContribution(InlineChatController.ID) ?? void 0;
  }
  /**
   * Stores the user's explicitly chosen model (qualified name) from a previous inline chat request in the same session.
   * When set, this takes priority over the inlineChat.defaultModel setting.
   */
  static #userSelectedModel;
  #store = new DisposableStore();
  #isActiveController = observableValue(this, false);
  #zone;
  #currentSession;
  #editor;
  #instaService;
  #notebookEditorService;
  #inlineChatSessionService;
  #configurationService;
  #editorService;
  #markerDecorationsService;
  #languageModelService;
  #logService;
  #chatEditingService;
  #chatService;
  get widget() {
    return this.#zone.value.widget;
  }
  get isActive() {
    return Boolean(this.#currentSession.get());
  }
  constructor(editor, instaService, notebookEditorService, inlineChatSessionService, codeEditorService, contextKeyService, configurationService, editorService, markerDecorationsService, languageModelService, logService, chatEditingService, chatService) {
    this.#editor = editor;
    this.#instaService = instaService;
    this.#notebookEditorService = notebookEditorService;
    this.#inlineChatSessionService = inlineChatSessionService;
    this.#configurationService = configurationService;
    this.#editorService = editorService;
    this.#markerDecorationsService = markerDecorationsService;
    this.#languageModelService = languageModelService;
    this.#logService = logService;
    this.#chatEditingService = chatEditingService;
    this.#chatService = chatService;
    const editorObs = observableCodeEditor(editor);
    const ctxInlineChatVisible = CTX_INLINE_CHAT_VISIBLE.bindTo(contextKeyService);
    const ctxFileBelongsToChat = CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT.bindTo(contextKeyService);
    const ctxTerminated = CTX_INLINE_CHAT_TERMINATED.bindTo(contextKeyService);
    const notebookAgentConfig = observableConfigValue(InlineChatConfigKeys.NotebookAgent, false, this.#configurationService);
    this.#store.add(autorun((r) => {
      const model = editorObs.model.read(r);
      if (!model) {
        ctxFileBelongsToChat.set(false);
        return;
      }
      const sessions = this.#chatEditingService.editingSessionsObs.read(r);
      let hasEdits = false;
      for (const session of sessions) {
        const entries = session.entries.read(r);
        for (const entry of entries) {
          if (isEqual(entry.modifiedURI, model.uri)) {
            hasEdits = true;
            break;
          }
        }
        if (hasEdits) {
          break;
        }
      }
      ctxFileBelongsToChat.set(hasEdits);
    }));
    this.inputOverlayWidget = this.#store.add(this.#instaService.createInstance(InlineChatAffordance, this.#editor));
    this.#zone = new Lazy(() => {
      assertType(this.#editor.hasModel(), "[Illegal State] widget should only be created when the editor has a model");
      const location = {
        location: ChatAgentLocation.EditorInline,
        resolveData: () => {
          assertType(this.#editor.hasModel());
          const wholeRange = this.#editor.getSelection();
          const document = this.#editor.getModel().uri;
          return {
            type: ChatAgentLocation.EditorInline,
            id: getEditorId(this.#editor, this.#editor.getModel()),
            selection: this.#editor.getSelection(),
            document,
            wholeRange
          };
        }
      };
      const notebookEditor = this.#notebookEditorService.getNotebookForPossibleCell(this.#editor);
      if (!!notebookEditor) {
        location.location = ChatAgentLocation.Notebook;
        if (notebookAgentConfig.get()) {
          location.resolveData = () => {
            assertType(this.#editor.hasModel());
            return {
              type: ChatAgentLocation.Notebook,
              sessionInputUri: this.#editor.getModel().uri
            };
          };
        }
      }
      const result = this.#instaService.createInstance(
        InlineChatZoneWidget,
        location,
        {
          enableWorkingSet: "implicit",
          enableImplicitContext: false,
          renderInputOnTop: false,
          renderInputToolbarBelowInput: true,
          filter: (item) => {
            if (!isResponseVM(item)) {
              return false;
            }
            return !!item.model.isPendingConfirmation.get();
          },
          menus: {
            telemetrySource: "inlineChatWidget",
            executeToolbar: MenuId.ChatEditorInlineExecute,
            inputSideToolbar: MenuId.ChatEditorInlineInputSide
          },
          defaultMode: ChatMode.Ask
        },
        { editor: this.#editor, notebookEditor },
        () => Promise.resolve()
      );
      this.#store.add(result);
      result.domNode.classList.add("inline-chat-2");
      return result;
    });
    const sessionsSignal = observableSignalFromEvent(this, inlineChatSessionService.onDidChangeSessions);
    this.#currentSession = derived((r) => {
      sessionsSignal.read(r);
      const model = editorObs.model.read(r);
      const session = model && inlineChatSessionService.getSessionByTextModel(model.uri);
      return session ?? void 0;
    });
    let lastSession = void 0;
    this.#store.add(autorun((r) => {
      const session = this.#currentSession.read(r);
      if (!session) {
        this.#isActiveController.set(false, void 0);
        if (lastSession && !lastSession.chatModel.hasRequests) {
          const state = lastSession.chatModel.inputModel.state.read(void 0);
          if (!state || !state.inputText && state.attachments.length === 0) {
            lastSession.dispose();
            lastSession = void 0;
          }
        }
        return;
      }
      lastSession = session;
      let foundOne = false;
      for (const editor2 of codeEditorService.listCodeEditors()) {
        const ctrl = InlineChatController.get(editor2);
        if (ctrl && ctrl.#isActiveController.read(void 0)) {
          foundOne = true;
          break;
        }
      }
      if (!foundOne && editorObs.isFocused.read(r)) {
        this.#isActiveController.set(true, void 0);
      }
    }));
    const visibleSessionObs = observableValue(this, void 0);
    this.#store.add(autorun((r) => {
      const model = editorObs.model.read(r);
      const session = this.#currentSession.read(r);
      const isActive = this.#isActiveController.read(r);
      if (!session || !isActive || !model) {
        visibleSessionObs.set(void 0, void 0);
      } else {
        visibleSessionObs.set(session, void 0);
      }
    }));
    const defaultPlaceholderObs = visibleSessionObs.map((session, r) => {
      return session?.initialSelection.isEmpty() ? localize("placeholder", "Generate code") : localize("placeholderWithSelection", "Modify selected code");
    });
    this.#store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      ctxTerminated.set(!!session?.terminationState.read(r));
    }));
    this.#store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      if (!session) {
        this.#zone.rawValue?.hide();
        this.#zone.rawValue?.widget.chatWidget.setModel(void 0);
        editor.focus();
        ctxInlineChatVisible.reset();
      } else {
        ctxInlineChatVisible.set(true);
        this.#zone.value.widget.chatWidget.setModel(session.chatModel);
        if (!this.#zone.value.position) {
          this.#zone.value.widget.chatWidget.setInputPlaceholder(defaultPlaceholderObs.read(r));
          this.#zone.value.widget.chatWidget.input.renderAttachedContext();
          this.#zone.value.show(session.initialPosition);
        }
        this.#zone.value.reveal(this.#zone.value.position);
        this.#zone.value.widget.focus();
      }
    }));
    this.#store.add(autorun((r) => {
      const session = this.#currentSession.read(r);
      if (!session) {
        return;
      }
      const lastRequest = session.chatModel.lastRequestObs.read(r);
      const response = lastRequest?.response;
      const pending = response?.isPendingConfirmation.read(r);
      if (pending) {
        this.#logService.info(`[InlineChat] auto-approving: ${pending.detail ?? "unknown"}`);
        for (const part of response.response.value) {
          if (part.kind === "toolInvocation") {
            IChatToolInvocation.confirmWith(part, { type: ToolConfirmKind.ConfirmationNotNeeded, reason: "inlineChat" });
          }
        }
      }
    }));
    this.#store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      if (session) {
        const entries = session.editingSession.entries.read(r);
        const sessionCellUri = CellUri.parse(session.uri);
        const otherEntries = entries.filter((entry) => {
          if (isEqual(entry.modifiedURI, session.uri)) {
            return false;
          }
          if (!!sessionCellUri && isEqual(sessionCellUri.notebook, entry.modifiedURI)) {
            return false;
          }
          return true;
        });
        for (const entry of otherEntries) {
          this.#editorService.openEditor({ resource: entry.modifiedURI }, SIDE_GROUP).catch(onUnexpectedError);
        }
      }
    }));
    const lastResponseObs = visibleSessionObs.map((session, r) => {
      if (!session) {
        return;
      }
      const lastRequest = observableFromEvent(this, session.chatModel.onDidChange, () => session.chatModel.getRequests().at(-1)).read(r);
      return lastRequest?.response;
    });
    const lastResponseProgressObs = lastResponseObs.map((response, r) => {
      if (!response) {
        return;
      }
      return observableFromEvent(this, response.onDidChange, () => response.response.value.findLast((part) => part.kind === "progressMessage")).read(r);
    });
    this.#store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      const response = lastResponseObs.read(r);
      const terminationState = session?.terminationState.read(r);
      this.#zone.rawValue?.widget.updateInfo("");
      if (!response?.isInProgress.read(r)) {
        this.#zone.rawValue?.status.set(response?.result?.details ?? "", void 0);
        if (response?.result?.errorDetails) {
          this.#zone.rawValue?.widget.updateInfo(`$(error) ${response.result.errorDetails.message}`);
          alert(response.result.errorDetails.message);
        } else if (terminationState) {
          this.#zone.rawValue?.showTerminationCard(terminationState, this.#instaService);
        }
        if (!terminationState) {
          this.#zone.rawValue?.hideTerminationCard();
        }
        this.#zone.rawValue?.widget.domNode.classList.toggle("request-in-progress", false);
        this.#zone.rawValue?.widget.chatWidget.setInputPlaceholder(defaultPlaceholderObs.read(r));
      } else {
        this.#zone.rawValue?.widget.domNode.classList.toggle("request-in-progress", true);
        this.#zone.rawValue?.status.set("", void 0);
        let placeholder = response.request?.message.text;
        const lastProgress = lastResponseProgressObs.read(r);
        if (lastProgress) {
          placeholder = renderAsPlaintext(lastProgress.content);
        }
        this.#zone.rawValue?.widget.chatWidget.setInputPlaceholder(placeholder || localize("loading", "Working..."));
      }
    }));
    this.#store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      if (!session) {
        return;
      }
      const entry = session.editingSession.readEntry(session.uri, r);
      if (entry?.state.read(r) === ModifiedFileEntryState.Modified) {
        entry?.enableReviewModeUntilSettled();
      }
    }));
    this.#store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      const entry = session?.editingSession.readEntry(session.uri, r);
      const pane = this.#editorService.visibleEditorPanes.find((candidate) => candidate.getControl() === this.#editor || isNotebookWithCellEditor(candidate, this.#editor));
      if (pane && entry) {
        entry?.getEditorIntegration(pane);
      }
      if (entry?.diffInfo && this.#zone.rawValue?.position) {
        const { position } = this.#zone.rawValue;
        const diff = entry.diffInfo.read(r);
        for (const change of diff.changes) {
          if (change.modified.contains(position.lineNumber)) {
            this.#zone.rawValue?.updatePositionAndHeight(new Position(change.modified.startLineNumber - 1, 1));
            break;
          }
        }
      }
    }));
  }
  dispose() {
    this.#store.dispose();
  }
  getWidgetPosition() {
    return this.#zone.rawValue?.position;
  }
  focus() {
    this.#zone.rawValue?.widget.focus();
  }
  async run(arg) {
    assertType(this.#editor.hasModel());
    const uri = this.#editor.getModel().uri;
    const existingSession = this.#inlineChatSessionService.getSessionByTextModel(uri);
    if (existingSession) {
      await existingSession.editingSession.accept();
      existingSession.dispose();
    }
    this.#isActiveController.set(true, void 0);
    const session = this.#inlineChatSessionService.createSession(this.#editor);
    return this.#runZone(session, arg);
  }
  /**
   * Zone mode: use the full zone widget and chat widget for request submission.
   */
  async #runZone(session, arg) {
    assertType(this.#editor.hasModel());
    const uri = this.#editor.getModel().uri;
    const sessionStore = new DisposableStore();
    try {
      await this.#applyModelDefaults(session, sessionStore);
      if (arg) {
        arg.attachDiagnostics ??= true;
      }
      if (arg?.attachDiagnostics) {
        const entries = [];
        for (const [range, marker] of this.#markerDecorationsService.getLiveMarkers(uri)) {
          if (range.intersectRanges(this.#editor.getSelection())) {
            const filter = IDiagnosticVariableEntryFilterData.fromMarker(marker);
            entries.push(IDiagnosticVariableEntryFilterData.toEntry(filter));
          }
        }
        if (entries.length > 0) {
          this.#zone.value.widget.chatWidget.attachmentModel.addContext(...entries);
          const msg = entries.length > 1 ? localize("fixN", "Fix the attached problems") : localize("fix1", "Fix the attached problem");
          this.#zone.value.widget.chatWidget.input.setValue(msg, true);
          arg.message = msg;
          this.#zone.value.widget.chatWidget.inputEditor.setSelection(new Selection(1, 1, Number.MAX_SAFE_INTEGER, 1));
        }
      }
      if (arg && InlineChatRunOptions.isInlineChatRunOptions(arg)) {
        if (arg.initialRange) {
          this.#editor.revealRange(arg.initialRange);
        }
        if (arg.initialSelection) {
          this.#editor.setSelection(arg.initialSelection);
        }
        if (arg.attachments) {
          await Promise.all(arg.attachments.map(async (attachment) => {
            await this.#zone.value.widget.chatWidget.attachmentModel.addFile(attachment);
          }));
          delete arg.attachments;
        }
        if (arg.modelSelector) {
          const id = (await this.#languageModelService.selectLanguageModels(arg.modelSelector)).sort().at(0);
          if (!id) {
            throw new Error(`No language models found matching selector: ${JSON.stringify(arg.modelSelector)}.`);
          }
          const model = this.#languageModelService.lookupLanguageModel(id);
          if (!model) {
            throw new Error(`Language model not loaded: ${id}.`);
          }
          this.#zone.value.widget.chatWidget.input.setCurrentLanguageModel({ metadata: model, identifier: id }, true);
        }
        if (arg.message) {
          this.#zone.value.widget.chatWidget.setInput(arg.message);
          if (arg.autoSend) {
            await this.#zone.value.widget.chatWidget.acceptInput();
          }
        }
      }
      if (!arg?.resolveOnResponse) {
        await Event.toPromise(session.editingSession.onDidDispose);
        const rejected = session.editingSession.getEntry(uri)?.state.get() === ModifiedFileEntryState.Rejected;
        return !rejected;
      } else {
        const modifiedObs = derived((r) => {
          const entry = session.editingSession.readEntry(uri, r);
          return entry?.state.read(r) === ModifiedFileEntryState.Modified && !entry?.isCurrentlyBeingModifiedBy.read(r);
        });
        await waitForState(modifiedObs, (state) => state === true);
        return true;
      }
    } finally {
      sessionStore.dispose();
    }
  }
  async acceptSession() {
    const session = this.#currentSession.get();
    if (!session) {
      return;
    }
    await session.editingSession.accept();
    session.dispose();
  }
  async rejectSession() {
    const session = this.#currentSession.get();
    if (!session) {
      return;
    }
    await this.#chatService.cancelCurrentRequestForSession(session.chatModel.sessionResource, "inlineChatReject");
    await session.editingSession.reject();
    session.dispose();
  }
  async continueSessionInChat() {
    const session = this.#currentSession.get();
    if (!session) {
      return;
    }
    await this.#instaService.invokeFunction(continueInPanelChat, session);
  }
  async rephraseSession() {
    const session = this.#currentSession.get();
    if (!session) {
      return;
    }
    const requestText = this.#instaService.invokeFunction(rephraseInlineChat, session);
    if (requestText) {
      this.#zone.rawValue?.widget.chatWidget.setInput(requestText);
    }
    this.#zone.rawValue?.widget.focus();
  }
  async #selectVendorDefaultModel(session) {
    const model = this.#zone.value.widget.chatWidget.input.selectedLanguageModel.get();
    if (model && !model.metadata.isDefaultForLocation[session.chatModel.initialLocation]) {
      const ids = await this.#languageModelService.selectLanguageModels({ vendor: model.metadata.vendor });
      for (const identifier of ids) {
        const candidate = this.#languageModelService.lookupLanguageModel(identifier);
        if (candidate?.isDefaultForLocation[session.chatModel.initialLocation]) {
          this.#zone.value.widget.chatWidget.input.setCurrentLanguageModel({ metadata: candidate, identifier });
          break;
        }
      }
    }
  }
  /**
   * Applies model defaults based on settings and tracks user model changes.
   * Prioritization: user session choice > inlineChat.defaultModel setting > vendor default
   */
  async #applyModelDefaults(session, sessionStore) {
    const userSelectedModel = InlineChatController.#userSelectedModel;
    const defaultModelSetting = this.#configurationService.getValue(InlineChatConfigKeys.DefaultModel);
    let modelApplied = false;
    if (userSelectedModel) {
      modelApplied = this.#zone.value.widget.chatWidget.input.switchModelByQualifiedName([userSelectedModel]);
      if (!modelApplied) {
        InlineChatController.#userSelectedModel = void 0;
      }
    }
    if (!modelApplied && defaultModelSetting) {
      modelApplied = this.#zone.value.widget.chatWidget.input.switchModelByQualifiedName([defaultModelSetting]);
      if (!modelApplied) {
        this.#logService.warn(`inlineChat.defaultModel setting value '${defaultModelSetting}' did not match any available model. Falling back to vendor default.`);
      }
    }
    if (!modelApplied) {
      await this.#selectVendorDefaultModel(session);
    }
    let initialModelId;
    sessionStore.add(autorun((r) => {
      const newModel = this.#zone.value.widget.chatWidget.input.selectedLanguageModel.read(r);
      if (!newModel) {
        return;
      }
      if (!initialModelId) {
        initialModelId = newModel.identifier;
        return;
      }
      if (initialModelId !== newModel.identifier) {
        InlineChatController.#userSelectedModel = ILanguageModelChatMetadata.asQualifiedName(newModel.metadata);
        initialModelId = newModel.identifier;
      }
    }));
  }
};
InlineChatController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotebookEditorService),
  __decorateParam(3, IInlineChatSessionService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IMarkerDecorationsService),
  __decorateParam(9, ILanguageModelsService),
  __decorateParam(10, ILogService),
  __decorateParam(11, IChatEditingService),
  __decorateParam(12, IChatService)
], InlineChatController);
export {
  InlineChatController,
  InlineChatRunOptions
};
