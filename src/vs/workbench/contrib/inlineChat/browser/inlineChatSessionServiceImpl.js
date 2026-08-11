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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, dispose, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { autorun, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { isCodeEditor, isCompositeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IChatAgentService } from "../../chat/common/participants/chatAgents.js";
import { ModifiedFileEntryState } from "../../chat/common/editing/chatEditingService.js";
import { IChatService } from "../../chat/common/chatService/chatService.js";
import { ChatAgentLocation } from "../../chat/common/constants.js";
import { ILanguageModelToolsService, ToolDataSource } from "../../chat/common/tools/languageModelToolsService.js";
import { CTX_INLINE_CHAT_HAS_AGENT, CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT, CTX_INLINE_CHAT_POSSIBLE, InlineChatConfigKeys } from "../common/inlineChat.js";
import { IInlineChatSessionService } from "./inlineChatSessionService.js";
class InlineChatError extends Error {
  static {
    this.code = "InlineChatError";
  }
  constructor(message) {
    super(message);
    this.name = InlineChatError.code;
  }
}
let InlineChatSessionServiceImpl = class {
  constructor(chatService, chatAgentService) {
    this.#store = new DisposableStore();
    this.#sessions = new ResourceMap();
    this.#onWillStartSession = this.#store.add(new Emitter());
    this.onWillStartSession = this.#onWillStartSession.event;
    this.#onDidChangeSessions = this.#store.add(new Emitter());
    this.onDidChangeSessions = this.#onDidChangeSessions.event;
    this.#chatService = chatService;
    const agentObs = observableFromEvent(this, chatAgentService.onDidChangeAgents, () => chatAgentService.getDefaultAgent(ChatAgentLocation.EditorInline));
    this.#store.add(autorun((r) => {
      const agent = agentObs.read(r);
      if (!agent) {
        dispose(this.#sessions.values());
        this.#sessions.clear();
      }
    }));
  }
  #store;
  #sessions;
  #onWillStartSession;
  #onDidChangeSessions;
  #chatService;
  dispose() {
    this.#store.dispose();
  }
  createSession(editor) {
    const uri = editor.getModel().uri;
    if (this.#sessions.has(uri)) {
      throw new Error("Session already exists");
    }
    this.#onWillStartSession.fire(editor);
    const chatModelRef = this.#chatService.startNewLocalSession(ChatAgentLocation.EditorInline, {
      canUseTools: false
      /* SEE https://github.com/microsoft/vscode/issues/279946 */
    });
    const chatModel = chatModelRef.object;
    chatModel.startEditingSession(false);
    const terminationState = observableValue(this, void 0);
    const store = new DisposableStore();
    store.add(toDisposable(() => {
      void this.#chatService.cancelCurrentRequestForSession(chatModel.sessionResource, "inlineChatSession");
      chatModel.editingSession?.reject();
      this.#sessions.delete(uri);
      this.#onDidChangeSessions.fire(this);
    }));
    store.add(chatModelRef);
    store.add(autorun((r) => {
      const entries = chatModel.editingSession?.entries.read(r);
      if (!entries?.length) {
        return;
      }
      const state = entries.find((entry) => isEqual(entry.modifiedURI, uri))?.state.read(r);
      if (state === ModifiedFileEntryState.Accepted || state === ModifiedFileEntryState.Rejected) {
        const response = chatModel.getRequests().at(-1)?.response;
        if (response) {
          this.#chatService.notifyUserAction({
            sessionResource: response.session.sessionResource,
            requestId: response.requestId,
            agentId: response.agent?.id,
            command: response.slashCommand?.name,
            result: response.result,
            action: {
              kind: "inlineChat",
              action: state === ModifiedFileEntryState.Accepted ? "accepted" : "discarded"
            }
          });
        }
      }
      const allSettled = entries.every((entry) => {
        const state2 = entry.state.read(r);
        return (state2 === ModifiedFileEntryState.Accepted || state2 === ModifiedFileEntryState.Rejected) && !entry.isCurrentlyBeingModifiedBy.read(r);
      });
      if (allSettled && !chatModel.requestInProgress.read(void 0)) {
        store.dispose();
      }
    }));
    const result = {
      uri,
      initialPosition: editor.getSelection().getStartPosition().delta(-1),
      /* one line above selection start */
      initialSelection: editor.getSelection(),
      chatModel,
      editingSession: chatModel.editingSession,
      terminationState,
      setTerminationState: (state) => {
        terminationState.set(state, void 0);
        this.#onDidChangeSessions.fire(this);
      },
      dispose: store.dispose.bind(store)
    };
    this.#sessions.set(uri, result);
    this.#onDidChangeSessions.fire(this);
    return result;
  }
  getSessionByTextModel(uri) {
    let result = this.#sessions.get(uri);
    if (!result) {
      for (const [_, candidate] of this.#sessions) {
        const entry = candidate.editingSession.getEntry(uri);
        if (entry) {
          result = candidate;
          break;
        }
      }
    }
    return result;
  }
  getSessionBySessionUri(sessionResource) {
    for (const session of this.#sessions.values()) {
      if (isEqual(session.chatModel.sessionResource, sessionResource)) {
        return session;
      }
    }
    return void 0;
  }
};
InlineChatSessionServiceImpl = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IChatAgentService)
], InlineChatSessionServiceImpl);
let InlineChatEnabler = class {
  static {
    this.Id = "inlineChat.enabler";
  }
  #ctxHasProvider;
  #ctxHasNotebookProvider;
  #ctxPossible;
  #store = new DisposableStore();
  constructor(contextKeyService, chatAgentService, editorService, configService) {
    this.#ctxHasProvider = CTX_INLINE_CHAT_HAS_AGENT.bindTo(contextKeyService);
    this.#ctxHasNotebookProvider = CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT.bindTo(contextKeyService);
    this.#ctxPossible = CTX_INLINE_CHAT_POSSIBLE.bindTo(contextKeyService);
    const agentObs = observableFromEvent(this, chatAgentService.onDidChangeAgents, () => chatAgentService.getDefaultAgent(ChatAgentLocation.EditorInline));
    const notebookAgentObs = observableFromEvent(this, chatAgentService.onDidChangeAgents, () => chatAgentService.getDefaultAgent(ChatAgentLocation.Notebook));
    const notebookAgentConfigObs = observableConfigValue(InlineChatConfigKeys.NotebookAgent, false, configService);
    this.#store.add(autorun((r) => {
      const agent = agentObs.read(r);
      if (!agent) {
        this.#ctxHasProvider.reset();
      } else {
        this.#ctxHasProvider.set(true);
      }
    }));
    this.#store.add(autorun((r) => {
      this.#ctxHasNotebookProvider.set(notebookAgentConfigObs.read(r) && !!notebookAgentObs.read(r));
    }));
    const updateEditor = () => {
      const ctrl = editorService.activeEditorPane?.getControl();
      const isCodeEditorLike = isCodeEditor(ctrl) || isDiffEditor(ctrl) || isCompositeEditor(ctrl);
      this.#ctxPossible.set(isCodeEditorLike);
    };
    this.#store.add(editorService.onDidActiveEditorChange(updateEditor));
    updateEditor();
  }
  dispose() {
    this.#ctxPossible.reset();
    this.#ctxHasProvider.reset();
    this.#store.dispose();
  }
};
InlineChatEnabler = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IConfigurationService)
], InlineChatEnabler);
let InlineChatEscapeToolContribution = class extends Disposable {
  static {
    this.Id = "inlineChat.escapeTool";
  }
  static #data = {
    id: "inline_chat_exit",
    source: ToolDataSource.Internal,
    canBeReferencedInPrompt: false,
    alwaysDisplayInputOutput: false,
    displayName: localize("name", "Inline Chat to Panel Chat"),
    modelDescription: "Show a short textual response when not being able to make code changes and when not having been asked for code changes. Can also be used to move the request to the richer panel chat which supports edits across files, creating and deleting files, multi-turn conversations between the user and the assistant, and access to more IDE tools, like retrieve problems, interact with source control, run terminal commands etc.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        response: {
          type: "string",
          description: localize("response.description", "Optional brief response for inline chat. Keep it at 10 words or fewer."),
          maxLength: 200
        }
      }
    }
  };
  constructor(lmTools, inlineChatSessionService, logService) {
    super();
    this._store.add(lmTools.registerTool(InlineChatEscapeToolContribution.#data, {
      invoke: async (invocation, _tokenCountFn, _progress, _token) => {
        const sessionResource = invocation.context?.sessionResource;
        if (!sessionResource) {
          logService.warn("InlineChatEscapeToolContribution: no sessionId in tool invocation context");
          return { content: [{ kind: "text", value: "Cancel" }] };
        }
        const session = inlineChatSessionService.getSessionBySessionUri(sessionResource);
        if (!session) {
          logService.warn(`InlineChatEscapeToolContribution: no session found for id ${sessionResource}`);
          return { content: [{ kind: "text", value: "Cancel" }] };
        }
        const lastRequest = session.chatModel.getRequests().at(-1);
        if (!lastRequest) {
          logService.warn(`InlineChatEscapeToolContribution: no request found for id ${sessionResource}`);
          return { content: [{ kind: "text", value: "Cancel" }], toolResultMessage: localize("tool.cancel", "Cancel") };
        }
        const response = typeof invocation.parameters?.response === "string" && invocation.parameters.response.trim().length > 0 ? invocation.parameters.response.trim() : localize("terminated.message", "Inline chat is designed for making single-file code changes. Continue your request in the Chat view or rephrase it for inline chat.");
        session.setTerminationState(response);
        return { content: [{ kind: "text", value: "Success" }] };
      }
    }));
  }
};
InlineChatEscapeToolContribution = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, IInlineChatSessionService),
  __decorateParam(2, ILogService)
], InlineChatEscapeToolContribution);
export {
  InlineChatEnabler,
  InlineChatError,
  InlineChatEscapeToolContribution,
  InlineChatSessionServiceImpl
};
