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
import { compareBy, delta } from "../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { groupBy } from "../../../../../base/common/collections.js";
import { ErrorNoTelemetry } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../../base/common/linkedList.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { Schemas } from "../../../../../base/common/network.js";
import { derived, observableValueOpts, runOnChange, ValueWithChangeEventFromObservable } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { compare } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { assertType } from "../../../../../base/common/types.js";
import { TextEdit } from "../../../../../editor/common/languages.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IDecorationsService } from "../../../../services/decorations/common/decorations.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from "../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, chatEditingAgentSupportsReadonlyReferencesContextKey, chatEditingResourceContextKey, ChatEditingSessionState, inChatEditingSessionContextKey, ModifiedFileEntryState, parseChatMultiDiffUri } from "../../common/editing/chatEditingService.js";
import { isCellTextEditOperationArray } from "../../common/model/chatModel.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { ChatEditorInput } from "../widgetHosts/editor/chatEditorInput.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { ChatEditingSession } from "./chatEditingSession.js";
import { ChatEditingSnapshotTextModelContentProvider, ChatEditingTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
let ChatEditingService = class extends Disposable {
  constructor(_instantiationService, multiDiffSourceResolverService, textModelService, contextKeyService, _chatService, _editorService, decorationsService, _fileService, lifecycleService, storageService, logService, extensionService, productService, notebookService, _configurationService) {
    super();
    this._instantiationService = _instantiationService;
    this._chatService = _chatService;
    this._editorService = _editorService;
    this._fileService = _fileService;
    this.lifecycleService = lifecycleService;
    this.notebookService = notebookService;
    this._configurationService = _configurationService;
    this._providers = /* @__PURE__ */ new Map();
    this._sessionsObs = observableValueOpts({ equalsFn: (a, b) => false }, new LinkedList());
    this.editingSessionsObs = derived((r) => {
      const result = Array.from(this._sessionsObs.read(r));
      return result;
    });
    this._register(decorationsService.registerDecorationsProvider(_instantiationService.createInstance(ChatDecorationsProvider, this.editingSessionsObs)));
    this._register(multiDiffSourceResolverService.registerResolver(_instantiationService.createInstance(ChatEditingMultiDiffSourceResolver, this.editingSessionsObs)));
    this._register(textModelService.registerTextModelContentProvider(ChatEditingTextModelContentProvider.scheme, _instantiationService.createInstance(ChatEditingTextModelContentProvider, this)));
    this._register(textModelService.registerTextModelContentProvider(Schemas.chatEditingSnapshotScheme, _instantiationService.createInstance(ChatEditingSnapshotTextModelContentProvider, this)));
    this._register(this._chatService.onDidDisposeSession((e) => {
      if (e.reason === "cleared") {
        for (const resource of e.sessionResources) {
          this.getEditingSession(resource)?.stop();
        }
      }
    }));
    const readonlyEnabledContextKey = chatEditingAgentSupportsReadonlyReferencesContextKey.bindTo(contextKeyService);
    const setReadonlyFilesEnabled = () => {
      const enabled = productService.quality !== "stable" && extensionService.extensions.some((e) => e.enabledApiProposals?.includes("chatReadonlyPromptReference"));
      readonlyEnabledContextKey.set(enabled);
    };
    setReadonlyFilesEnabled();
    this._register(extensionService.onDidRegisterExtensions(setReadonlyFilesEnabled));
    this._register(extensionService.onDidChangeExtensions(setReadonlyFilesEnabled));
    let storageTask;
    this._register(storageService.onWillSaveState(() => {
      const tasks = [];
      for (const session of this.editingSessionsObs.get()) {
        if (!session.isGlobalEditingSession) {
          continue;
        }
        tasks.push(session.storeState());
      }
      storageTask = Promise.resolve(storageTask).then(() => Promise.all(tasks)).finally(() => storageTask = void 0);
    }));
    this._register(this.lifecycleService.onWillShutdown((e) => {
      if (!storageTask) {
        return;
      }
      e.join(storageTask, {
        id: "join.chatEditingSession",
        label: localize("join.chatEditingSession", "Saving chat edits history")
      });
    }));
  }
  dispose() {
    dispose(this._sessionsObs.get());
    super.dispose();
  }
  startOrContinueGlobalEditingSession(chatModel) {
    return this.getEditingSession(chatModel.sessionResource) || this.createEditingSession(chatModel, true);
  }
  _lookupEntry(uri) {
    for (const item of Iterable.concat(this.editingSessionsObs.get())) {
      const candidate = item.getEntry(uri);
      if (candidate instanceof AbstractChatEditingModifiedFileEntry) {
        return candidate.acquire();
      }
    }
    return void 0;
  }
  getEditingSession(chatSessionResource) {
    return this.editingSessionsObs.get().find((candidate) => isEqual(candidate.chatSessionResource, chatSessionResource));
  }
  createEditingSession(chatModel, global = false) {
    return this._createEditingSession(chatModel, global, void 0);
  }
  transferEditingSession(chatModel, session) {
    return this._createEditingSession(chatModel, session.isGlobalEditingSession, session);
  }
  _createEditingSession(chatModel, global, initFrom) {
    assertType(this.getEditingSession(chatModel.sessionResource) === void 0, "CANNOT have more than one editing session per chat session");
    const provider = this._providers.get(getChatSessionType(chatModel.sessionResource));
    const session = provider ? provider.createEditingSession(chatModel.sessionResource) : this._instantiationService.createInstance(ChatEditingSession, chatModel.sessionResource, global, this._lookupEntry.bind(this), initFrom);
    const list = this._sessionsObs.get();
    const removeSession = list.unshift(session);
    const store = new DisposableStore();
    this._store.add(store);
    if (!provider && session instanceof ChatEditingSession) {
      store.add(this.installAutoApplyObserver(session, chatModel));
    }
    store.add(session.onDidDispose((e) => {
      removeSession();
      this._sessionsObs.set(list, void 0);
      this._store.delete(store);
    }));
    this._sessionsObs.set(list, void 0);
    return session;
  }
  registerEditingSessionProvider(scheme, provider) {
    this._providers.set(scheme, provider);
    return toDisposable(() => {
      if (this._providers.get(scheme) === provider) {
        this._providers.delete(scheme);
      }
    });
  }
  installAutoApplyObserver(session, chatModel) {
    if (!chatModel) {
      throw new ErrorNoTelemetry(`Edit session was created for a non-existing chat session: ${session.chatSessionResource}`);
    }
    const observerDisposables = new DisposableStore();
    observerDisposables.add(chatModel.onDidChange(async (e) => {
      if (e.kind !== "addRequest") {
        return;
      }
      session.createSnapshot(e.request.id, void 0);
      const responseModel = e.request.response;
      if (responseModel) {
        this.observerEditsInResponse(e.request.id, responseModel, session, observerDisposables);
      }
    }));
    observerDisposables.add(chatModel.onDidDispose(() => observerDisposables.dispose()));
    return observerDisposables;
  }
  observerEditsInResponse(requestId, responseModel, session, observerDisposables) {
    let K;
    ((K2) => {
      K2[K2["Stream"] = 0] = "Stream";
      K2[K2["Workspace"] = 1] = "Workspace";
    })(K || (K = {}));
    const editsSeen = [];
    const initialActiveEditor = this._editorService.activeEditorPane?.input;
    const editorOpenPromises = new ResourceMap();
    const openChatEditedFiles = this._configurationService.getValue("accessibility.openChatEditedFiles");
    const ensureEditorOpen = (partUri) => {
      const uri = CellUri.parse(partUri)?.notebook ?? partUri;
      if (editorOpenPromises.has(uri)) {
        return;
      }
      editorOpenPromises.set(uri, (async () => {
        if (this.notebookService.getNotebookTextModel(uri) || uri.scheme === Schemas.untitled || await this._fileService.exists(uri).catch(() => false)) {
          const activeUri = this._editorService.activeEditorPane?.input.resource;
          const currentActiveEditor = this._editorService.activeEditorPane?.input;
          const editorDidChange = initialActiveEditor && currentActiveEditor ? !initialActiveEditor.matches(currentActiveEditor) : initialActiveEditor !== currentActiveEditor;
          const inactive = editorDidChange || this._editorService.activeEditorPane?.input instanceof ChatEditorInput && isEqual(this._editorService.activeEditorPane.input.sessionResource, session.chatSessionResource) || Boolean(activeUri && session.entries.get().find((entry) => isEqual(activeUri, entry.modifiedURI)));
          this._editorService.openEditor({ resource: uri, options: { inactive, preserveFocus: true, pinned: true, isExplicit: false } });
        }
      })());
    };
    const onResponseComplete = () => {
      for (const remaining of editsSeen) {
        if (remaining?.kind === 0 /* Stream */) {
          remaining.stream.complete();
        }
      }
      editsSeen.length = 0;
      editorOpenPromises.clear();
    };
    const handleResponseParts = async () => {
      if (responseModel.isCanceled) {
        return;
      }
      let undoStop;
      for (let i = 0; i < responseModel.response.value.length; i++) {
        const part = responseModel.response.value[i];
        if (part.kind === "undoStop") {
          undoStop = part.id;
          continue;
        }
        if (part.kind === "workspaceEdit") {
          if (!editsSeen[i]) {
            editsSeen[i] = { kind: 1 /* Workspace */ };
            session.applyWorkspaceEdit(part, responseModel, undoStop ?? responseModel.requestId);
          }
          continue;
        }
        if (part.kind !== "textEditGroup" && part.kind !== "notebookEditGroup") {
          continue;
        }
        if (part.isExternalEdit) {
          continue;
        }
        if (openChatEditedFiles) {
          ensureEditorOpen(part.uri);
        }
        let entry = editsSeen[i];
        if (!entry) {
          entry = { kind: 0 /* Stream */, seen: 0, stream: session.startStreamingEdits(CellUri.parse(part.uri)?.notebook ?? part.uri, responseModel, undoStop) };
          editsSeen[i] = entry;
        }
        if (entry.kind !== 0 /* Stream */) {
          continue;
        }
        const isFirst = entry.seen === 0;
        const newEdits = part.edits.slice(entry.seen);
        entry.seen = part.edits.length;
        if (newEdits.length > 0 || isFirst) {
          for (let i2 = 0; i2 < newEdits.length; i2++) {
            const edit = newEdits[i2];
            const done = part.done ? i2 === newEdits.length - 1 : false;
            if (isTextEditOperationArray(edit)) {
              entry.stream.pushText(edit, done);
            } else if (isCellTextEditOperationArray(edit)) {
              for (const edits of Object.values(groupBy(edit, (e) => e.uri.toString()))) {
                if (edits) {
                  entry.stream.pushNotebookCellText(edits[0].uri, edits.map((e) => e.edit), done);
                }
              }
            } else {
              entry.stream.pushNotebook(edit, done);
            }
          }
        }
        if (part.done) {
          entry.stream.complete();
        }
      }
    };
    if (responseModel.isComplete) {
      handleResponseParts().then(() => {
        onResponseComplete();
      });
    } else {
      const disposable = observerDisposables.add(responseModel.onDidChange((e2) => {
        if (e2.reason === "undoStop") {
          session.createSnapshot(requestId, e2.id);
        } else {
          handleResponseParts().then(() => {
            if (responseModel.isComplete) {
              onResponseComplete();
              observerDisposables.delete(disposable);
            }
          });
        }
      }));
    }
  }
};
ChatEditingService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IMultiDiffSourceResolverService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IDecorationsService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILifecycleService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ILogService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IProductService),
  __decorateParam(13, INotebookService),
  __decorateParam(14, IConfigurationService)
], ChatEditingService);
function observeArrayChanges(obs, compare2, store) {
  const emitter = store.add(new Emitter());
  store.add(runOnChange(obs, (newArr, oldArr) => {
    const change = delta(oldArr || [], newArr, compare2);
    const changedElements = [].concat(change.added).concat(change.removed);
    emitter.fire(changedElements);
  }));
  return emitter.event;
}
class ChatDecorationsProvider extends Disposable {
  constructor(_sessions) {
    super();
    this._sessions = _sessions;
    this.label = localize("chat", "Chat Editing");
    this._currentEntries = derived(this, (r) => {
      const sessions = this._sessions.read(r);
      if (!sessions) {
        return [];
      }
      const result = [];
      for (const session of sessions) {
        if (session.state.read(r) !== ChatEditingSessionState.Disposed) {
          const entries = session.entries.read(r);
          result.push(...entries);
        }
      }
      return result;
    });
    this._currentlyEditingUris = derived(this, (r) => {
      const uri = this._currentEntries.read(r);
      return uri.filter((entry) => entry.isCurrentlyBeingModifiedBy.read(r)).map((entry) => entry.modifiedURI);
    });
    this._modifiedUris = derived(this, (r) => {
      const uri = this._currentEntries.read(r);
      return uri.filter((entry) => !entry.isCurrentlyBeingModifiedBy.read(r) && entry.state.read(r) === ModifiedFileEntryState.Modified).map((entry) => entry.modifiedURI);
    });
    this.onDidChange = Event.any(
      observeArrayChanges(this._currentlyEditingUris, compareBy((uri) => uri.toString(), compare), this._store),
      observeArrayChanges(this._modifiedUris, compareBy((uri) => uri.toString(), compare), this._store)
    );
  }
  provideDecorations(uri, _token) {
    const isCurrentlyBeingModified = this._currentlyEditingUris.get().some((e) => isEqual(e, uri));
    if (isCurrentlyBeingModified) {
      return {
        weight: 1e3,
        letter: ThemeIcon.modify(Codicon.loading, "spin"),
        bubble: false
      };
    }
    const isModified = this._modifiedUris.get().some((e) => isEqual(e, uri));
    if (isModified) {
      return {
        weight: 1e3,
        letter: Codicon.diffModified,
        tooltip: localize("chatEditing.modified2", "Pending changes from chat"),
        bubble: true
      };
    }
    return void 0;
  }
}
let ChatEditingMultiDiffSourceResolver = class {
  constructor(_editingSessionsObs, _instantiationService) {
    this._editingSessionsObs = _editingSessionsObs;
    this._instantiationService = _instantiationService;
  }
  canHandleUri(uri) {
    return uri.scheme === CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME;
  }
  async resolveDiffSource(uri) {
    const parsed = parseChatMultiDiffUri(uri);
    const thisSession = derived(this, (r) => {
      return this._editingSessionsObs.read(r).find((candidate) => isEqual(candidate.chatSessionResource, parsed.chatSessionResource));
    });
    return this._instantiationService.createInstance(ChatEditingMultiDiffSource, thisSession, parsed.showPreviousChanges);
  }
};
ChatEditingMultiDiffSourceResolver = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ChatEditingMultiDiffSourceResolver);
class ChatEditingMultiDiffSource {
  constructor(_currentSession, _showPreviousChanges) {
    this._currentSession = _currentSession;
    this._showPreviousChanges = _showPreviousChanges;
    this._resources = derived(this, (reader) => {
      const currentSession = this._currentSession.read(reader);
      if (!currentSession) {
        return [];
      }
      const entries = currentSession.entries.read(reader);
      return entries.map((entry) => {
        if (this._showPreviousChanges) {
          const entryDiffObs = currentSession.getEntryDiffBetweenStops(entry.modifiedURI, void 0, void 0);
          const entryDiff = entryDiffObs?.read(reader);
          if (entryDiff) {
            return new MultiDiffEditorItem(
              entryDiff.originalURI,
              entryDiff.modifiedURI,
              void 0,
              void 0,
              {
                [chatEditingResourceContextKey.key]: entry.entryId
              }
            );
          }
        }
        return new MultiDiffEditorItem(
          entry.originalURI,
          entry.modifiedURI,
          void 0,
          void 0,
          {
            [chatEditingResourceContextKey.key]: entry.entryId
            // [inChatEditingSessionContextKey.key]: true
          }
        );
      });
    });
    this.resources = new ValueWithChangeEventFromObservable(this._resources);
    this.contextKeys = {
      [inChatEditingSessionContextKey.key]: true
    };
  }
}
function isTextEditOperationArray(value) {
  return value.some((e) => TextEdit.isTextEdit(e));
}
export {
  ChatEditingMultiDiffSourceResolver,
  ChatEditingService
};
