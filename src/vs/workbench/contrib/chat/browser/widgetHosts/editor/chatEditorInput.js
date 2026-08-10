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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { revive } from "../../../../../../base/common/marshalling.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { truncate } from "../../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import * as nls from "../../../../../../nls.js";
import { ConfirmResult, IDialogService } from "../../../../../../platform/dialogs/common/dialogs.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { registerIcon } from "../../../../../../platform/theme/common/iconRegistry.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { EditorInputCapabilities, Verbosity } from "../../../../../common/editor.js";
import { EditorInput } from "../../../../../common/editor/editorInput.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IChatSessionsService, localChatSessionType } from "../../../common/chatSessionsService.js";
import { ChatAgentLocation, ChatEditorTitleMaxLength, getDefaultNewChatSessionResource, getDefaultNewChatSessionType } from "../../../common/constants.js";
import { ModifiedFileEntryState } from "../../../common/editing/chatEditingService.js";
import { LocalChatSessionUri, getChatSessionType, isUntitledChatSession } from "../../../common/model/chatUri.js";
const ChatEditorIcon = registerIcon("chat-editor-label-icon", Codicon.chatSparkle, nls.localize("chatEditorLabelIcon", "Icon of the chat editor label."));
let ChatEditorInput = class extends EditorInput {
  constructor(resource, options, chatService, dialogService, configurationService, chatSessionsService, instantiationService, storageService, logService, workspaceContextService, agentHostEnablementService) {
    super();
    this.resource = resource;
    this.options = options;
    this.chatService = chatService;
    this.dialogService = dialogService;
    this.configurationService = configurationService;
    this.chatSessionsService = chatSessionsService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.logService = logService;
    this.workspaceContextService = workspaceContextService;
    this.agentHostEnablementService = agentHostEnablementService;
    this.didTransferOutEditingSession = false;
    this.modelRef = this._register(new MutableDisposable());
    this._modelChangeListener = this._register(new MutableDisposable());
    this.closeHandler = this;
    if (resource.scheme === Schemas.vscodeChatEditor) {
      const parsed = ChatEditorUri.parse(resource);
      if (!parsed || typeof parsed !== "number") {
        throw new Error("Invalid chat URI");
      }
    } else if (resource.scheme === Schemas.vscodeLocalChatSession) {
      const localSessionId = LocalChatSessionUri.parseLocalSessionId(resource);
      if (!localSessionId) {
        throw new Error("Invalid local chat session URI");
      }
      this._sessionResource = resource;
    } else {
      this._sessionResource = resource;
    }
  }
  static {
    this.TypeID = "workbench.input.chatSession";
  }
  static {
    this.EditorID = "workbench.editor.chatSession";
  }
  /**
   * Get the uri of the session this editor input is associated with.
   *
   * This should be preferred over using `resource` directly, as it handles cases where a chat editor becomes a session
   */
  get sessionResource() {
    return this._sessionResource;
  }
  get model() {
    return this.modelRef.value?.object;
  }
  static getNewEditorUri() {
    return ChatEditorUri.getNewEditorUri();
  }
  showConfirm() {
    return !!(this.model && shouldShowClearEditingSessionConfirmation(this.model));
  }
  transferOutEditingSession() {
    this.didTransferOutEditingSession = true;
    return this.model?.editingSession;
  }
  async confirm(editors) {
    if (!this.model?.editingSession || this.didTransferOutEditingSession || this.getSessionType() !== localChatSessionType) {
      return ConfirmResult.SAVE;
    }
    const titleOverride = nls.localize("chatEditorConfirmTitle", "Close Chat Editor");
    const messageOverride = nls.localize("chat.startEditing.confirmation.pending.message.default", "Closing the chat editor will end your current edit session.");
    const result = await showClearEditingSessionConfirmation(this.model, this.dialogService, { titleOverride, messageOverride });
    return result ? ConfirmResult.SAVE : ConfirmResult.CANCEL;
  }
  get editorId() {
    return ChatEditorInput.EditorID;
  }
  get capabilities() {
    return super.capabilities | EditorInputCapabilities.ForceReveal | EditorInputCapabilities.CanDropIntoEditor;
  }
  copy() {
    return this.instantiationService.createInstance(ChatEditorInput, ChatEditorInput.getNewEditorUri(), {});
  }
  matches(otherInput) {
    if (!(otherInput instanceof ChatEditorInput)) {
      return false;
    }
    return isEqual(this.sessionResource, otherInput.sessionResource);
  }
  get typeId() {
    return ChatEditorInput.TypeID;
  }
  getName() {
    if (this.model?.title) {
      return this.model.hasCustomTitle ? this.model.title : truncate(this.model.title, ChatEditorTitleMaxLength);
    }
    if (this._sessionResource) {
      const existingSession = this.chatService.getSession(this._sessionResource);
      if (existingSession?.title) {
        return existingSession.title;
      }
      const persistedTitle = this.chatService.getSessionTitle(this._sessionResource);
      if (persistedTitle && persistedTitle.trim()) {
        return persistedTitle;
      }
    }
    if (this.options.title?.preferred) {
      return this.options.title.preferred;
    }
    return this.options.title?.fallback ?? nls.localize("chatEditorName", "Chat");
  }
  getTitle(verbosity) {
    const name = this.getName();
    if (verbosity === Verbosity.LONG) {
      const sessionTypeDisplayName = this.getSessionTypeDisplayName();
      if (sessionTypeDisplayName) {
        return `${name} | ${sessionTypeDisplayName}`;
      }
    }
    return name;
  }
  getSessionTypeDisplayName() {
    const sessionType = this.getSessionType();
    if (sessionType === localChatSessionType) {
      return;
    }
    const contributions = this.chatSessionsService.getAllChatSessionContributions();
    const contribution = contributions.find((c) => c.type === sessionType);
    return contribution?.displayName;
  }
  getIcon() {
    const resolvedIcon = this.resolveIcon();
    if (resolvedIcon) {
      this.cachedIcon = resolvedIcon;
      return resolvedIcon;
    }
    return ChatEditorIcon;
  }
  resolveIcon() {
    const sessionType = this.getSessionType();
    if (sessionType !== localChatSessionType) {
      return this.chatSessionsService.getChatSessionContribution(sessionType)?.icon;
    }
    return void 0;
  }
  /**
   * Returns chat session type from a URI, or {@linkcode localChatSessionType} if not specified or cannot be determined.
   */
  getSessionType() {
    return getChatSessionType(this._sessionResource ?? this.resource);
  }
  async resolve() {
    const searchParams = new URLSearchParams(this.resource.query);
    const chatSessionType = searchParams.get("chatSessionType");
    const inputType = chatSessionType ?? this.resource.authority;
    if (this._sessionResource) {
      try {
        this.modelRef.value = await this.chatService.acquireOrLoadSession(this._sessionResource, ChatAgentLocation.Chat, CancellationToken.None, "ChatEditorInput#resolve");
      } catch (error) {
        this.logService.warn(`[ChatEditorInput] Failed to acquire session ${this._sessionResource.toString()}`, error);
      }
      if (!this.model && isUntitledChatSession(this._sessionResource) && getChatSessionType(this._sessionResource) !== localChatSessionType) {
        this.logService.warn(`[ChatEditorInput] Falling back to a local chat session because ${this._sessionResource.toString()} could not be acquired`);
        this.modelRef.value = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { canUseTools: !inputType, debugOwner: "ChatEditorInput#resolveUntitledFallback" });
      }
      if (this.shouldReplaceEmptyLocalSession(this._sessionResource)) {
        const defaultResource = getDefaultNewChatSessionResource(this.configurationService, this.chatSessionsService, this.storageService, this.workspaceContextService.getWorkspace(), this.agentHostEnablementService.enabled.get());
        if (getChatSessionType(defaultResource) !== localChatSessionType) {
          let modelRef;
          try {
            modelRef = await this.chatService.acquireOrLoadSession(defaultResource, ChatAgentLocation.Chat, CancellationToken.None, "ChatEditorInput#resolveDefaultSession");
          } catch (error) {
            this.logService.warn(`[ChatEditorInput] Failed to acquire default session ${defaultResource.toString()}`, error);
          }
          if (modelRef) {
            this._sessionResource = defaultResource;
            this.modelRef.value = modelRef;
          } else {
            this.logService.warn(`[ChatEditorInput] Keeping local chat session because default session ${defaultResource.toString()} could not be acquired`);
          }
        }
      }
      if (!this.model && LocalChatSessionUri.parseLocalSessionId(this._sessionResource)) {
        this.modelRef.value = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { canUseTools: true, debugOwner: "ChatEditorInput#resolveNewLocalSession" });
      }
    } else if (!this.options.target) {
      if (this.options.explicitSessionType === localChatSessionType) {
        this.modelRef.value = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { canUseTools: !inputType, debugOwner: "ChatEditorInput#resolveExplicitLocal" });
      } else {
        const defaultResource = getDefaultNewChatSessionResource(this.configurationService, this.chatSessionsService, this.storageService, this.workspaceContextService.getWorkspace(), this.agentHostEnablementService.enabled.get());
        if (getChatSessionType(defaultResource) === localChatSessionType) {
          this.modelRef.value = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { canUseTools: !inputType, debugOwner: "ChatEditorInput#resolveUntitled" });
        } else {
          try {
            this.modelRef.value = await this.chatService.acquireOrLoadSession(defaultResource, ChatAgentLocation.Chat, CancellationToken.None, "ChatEditorInput#resolveDefaultUntitled");
          } catch (error) {
            this.logService.warn(`[ChatEditorInput] Failed to acquire default session ${defaultResource.toString()}`, error);
          }
          if (this.model) {
            this._sessionResource = defaultResource;
          } else {
            this.logService.warn(`[ChatEditorInput] Falling back to a local chat session because ${defaultResource.toString()} could not be acquired`);
            this.modelRef.value = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { canUseTools: !inputType, debugOwner: "ChatEditorInput#resolveUntitledFallback" });
          }
        }
      }
    } else if (this.options.target.data) {
      this.modelRef.value = this.chatService.loadSessionFromData(this.options.target.data, "ChatEditorInput#resolveImportedData");
    }
    if (!this.model || this.isDisposed()) {
      return null;
    }
    this._sessionResource = this.model.sessionResource;
    this._trackModelChanges();
    const newIcon = this.resolveIcon();
    if (newIcon && (!this.cachedIcon || !this.iconsEqual(this.cachedIcon, newIcon))) {
      this.cachedIcon = newIcon;
    }
    this._onDidChangeLabel.fire();
    return this._register(new ChatEditorModel(this.model));
  }
  shouldReplaceEmptyLocalSession(sessionResource) {
    return LocalChatSessionUri.isLocalSession(sessionResource) && this.options.explicitSessionType !== localChatSessionType && !!this.model && !this.model.hasRequests && getDefaultNewChatSessionType(this.configurationService, this.chatSessionsService, this.storageService, this.workspaceContextService.getWorkspace(), this.agentHostEnablementService.enabled.get()) !== localChatSessionType;
  }
  /**
   * Updates the editor input to track a new model. Called when the widget swaps
   * from an untitled session to a real session.
   */
  updateModel(model) {
    this._sessionResource = model.sessionResource;
    this.modelRef.value = this.chatService.acquireExistingSession(model.sessionResource, "ChatEditorInput#updateModel");
    this._trackModelChanges();
    this.cachedIcon = void 0;
    this._onDidChangeLabel.fire();
  }
  _trackModelChanges() {
    if (!this.model) {
      return;
    }
    this._modelChangeListener.value = this.model.onDidChange(() => {
      this.cachedIcon = void 0;
      this._onDidChangeLabel.fire();
    });
  }
  iconsEqual(a, b) {
    if (ThemeIcon.isThemeIcon(a) && ThemeIcon.isThemeIcon(b)) {
      return a.id === b.id;
    }
    if (a instanceof URI && b instanceof URI) {
      return a.toString() === b.toString();
    }
    return false;
  }
};
ChatEditorInput = __decorateClass([
  __decorateParam(2, IChatService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IChatSessionsService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IAgentHostEnablementService)
], ChatEditorInput);
class ChatEditorModel extends Disposable {
  constructor(model) {
    super();
    this.model = model;
    this._isResolved = false;
  }
  async resolve() {
    this._isResolved = true;
  }
  isResolved() {
    return this._isResolved;
  }
  isDisposed() {
    return this._store.isDisposed;
  }
}
var ChatEditorUri;
((ChatEditorUri2) => {
  const scheme = Schemas.vscodeChatEditor;
  function getNewEditorUri() {
    const handle = Math.floor(Math.random() * 1e9);
    return URI.from({ scheme, path: `chat-${handle}` });
  }
  ChatEditorUri2.getNewEditorUri = getNewEditorUri;
  function parse(resource) {
    if (resource.scheme !== scheme) {
      return void 0;
    }
    const match = resource.path.match(/chat-(\d+)/);
    const handleStr = match?.[1];
    if (typeof handleStr !== "string") {
      return void 0;
    }
    const handle = parseInt(handleStr);
    if (isNaN(handle)) {
      return void 0;
    }
    return handle;
  }
  ChatEditorUri2.parse = parse;
})(ChatEditorUri || (ChatEditorUri = {}));
class ChatEditorInputSerializer {
  canSerialize(input) {
    return input instanceof ChatEditorInput && !!input.sessionResource;
  }
  serialize(input) {
    if (!this.canSerialize(input)) {
      return void 0;
    }
    const obj = {
      options: input.options,
      sessionResource: input.sessionResource,
      resource: input.resource
    };
    return JSON.stringify(obj);
  }
  deserialize(instantiationService, serializedEditor) {
    try {
      const parsed = revive(JSON.parse(serializedEditor));
      if (parsed.sessionResource) {
        const sessionResource = URI.revive(parsed.sessionResource);
        return instantiationService.createInstance(ChatEditorInput, sessionResource, parsed.options);
      }
      let resource = URI.revive(parsed.resource);
      if (resource.scheme === Schemas.vscodeChatEditor && parsed.sessionId) {
        resource = LocalChatSessionUri.forSession(parsed.sessionId);
      }
      return instantiationService.createInstance(ChatEditorInput, resource, parsed.options);
    } catch (err) {
      return void 0;
    }
  }
}
async function showClearEditingSessionConfirmation(model, dialogService, options) {
  const undecidedEdits = shouldShowClearEditingSessionConfirmation(model, options);
  if (!undecidedEdits) {
    return true;
  }
  const defaultPhrase = nls.localize("chat.startEditing.confirmation.pending.message.default1", "Starting a new chat will end your current edit session.");
  const defaultTitle = nls.localize("chat.startEditing.confirmation.title", "Start new chat?");
  const phrase = options?.messageOverride ?? defaultPhrase;
  const title = options?.titleOverride ?? defaultTitle;
  const { result } = await dialogService.prompt({
    title,
    message: phrase + " " + nls.localize("chat.startEditing.confirmation.pending.message.2", "Do you want to keep pending edits to {0} files?", undecidedEdits),
    type: "info",
    cancelButton: true,
    buttons: [
      {
        label: nls.localize("chat.startEditing.confirmation.acceptEdits", "Keep & Continue"),
        run: async () => {
          await model.editingSession.accept();
          return true;
        }
      },
      {
        label: nls.localize("chat.startEditing.confirmation.discardEdits", "Undo & Continue"),
        run: async () => {
          await model.editingSession.reject();
          return true;
        }
      }
    ]
  });
  return Boolean(result);
}
function shouldShowClearEditingSessionConfirmation(model, options) {
  if (!model.editingSession || model.willKeepAlive && !options?.isArchiveAction) {
    return 0;
  }
  const currentEdits = model.editingSession.entries.get();
  const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === ModifiedFileEntryState.Modified);
  return undecidedEdits.length;
}
export {
  ChatEditorInput,
  ChatEditorInputSerializer,
  ChatEditorModel,
  shouldShowClearEditingSessionConfirmation,
  showClearEditingSessionConfirmation
};
