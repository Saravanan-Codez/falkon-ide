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
import { Disposable, DisposableMap, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { URI } from "../../../../../../base/common/uri.js";
import { AgentSession } from "../../../../../../platform/agentHost/common/agentService.js";
import { fromAgentHostUri } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { agentHostAgentPickerStorageKey } from "../../../../../../platform/agentHost/common/customAgents.js";
import { isUntitledChatSession } from "../../../common/model/chatUri.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../common/contributions.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { IChatWidgetService } from "../../chat.js";
import { ChatMode } from "../../../common/chatModes.js";
import { ChatModeKind } from "../../../common/constants.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
const AGENT_HOST_SESSION_SCHEME_PREFIX = "agent-host-";
let AgentHostModeSynchronizer = class extends Disposable {
  constructor(_chatWidgetService, _provisionalSessionService, _storageService, environmentService) {
    super();
    this._chatWidgetService = _chatWidgetService;
    this._provisionalSessionService = _provisionalSessionService;
    this._storageService = _storageService;
    this._widgetListeners = this._register(new DisposableMap());
    this._updatingWidgets = /* @__PURE__ */ new Set();
    if (environmentService.isSessionsWindow) {
      return;
    }
    for (const widget of this._chatWidgetService.getAllWidgets()) {
      this._attachWidget(widget);
    }
    this._register(this._chatWidgetService.onDidAddWidget((widget) => this._attachWidget(widget)));
    this._register(this._chatWidgetService.onDidChangeFocusedSession(() => {
      const widget = this._chatWidgetService.lastFocusedWidget;
      if (widget) {
        this._syncWidgetFromBackend(widget);
      }
    }));
    this._register(this._provisionalSessionService.onDidChange((sessionResource) => {
      const widget = this._chatWidgetService.getWidgetBySessionResource(sessionResource);
      if (widget) {
        this._syncWidgetFromBackend(widget);
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostModeSynchronizer";
  }
  _attachWidget(widget) {
    if (this._widgetListeners.has(widget)) {
      return;
    }
    const store = new DisposableStore();
    store.add(widget.input.onDidChangeCurrentChatMode((e) => this._onWidgetModeChanged(widget, e)));
    store.add(widget.onDidChangeViewModel(() => this._syncWidgetFromBackend(widget)));
    store.add(autorun((reader) => {
      const modes = widget.input.currentChatModesObs.read(reader);
      reader.store.add(modes.onDidChange(() => this._syncWidgetFromBackend(widget)));
    }));
    this._widgetListeners.set(widget, store);
    this._syncWidgetFromBackend(widget);
  }
  _onWidgetModeChanged(widget, e) {
    if (!e.isUserInitiated) {
      return;
    }
    if (this._updatingWidgets.has(widget)) {
      return;
    }
    const sessionResource = widget.viewModel?.sessionResource;
    const backendSession = sessionResource ? this._resolveBackendSession(sessionResource) : void 0;
    if (!sessionResource || !backendSession) {
      return;
    }
    const mode = widget.input.currentModeObs.get();
    const agentUri = this._agentUriFromMode(mode);
    if (this._readSelectedAgent(sessionResource) === agentUri) {
      return;
    }
    this._storeSelectedAgent(sessionResource, agentUri);
  }
  _syncWidgetFromBackend(widget) {
    const sessionResource = widget.viewModel?.sessionResource;
    const backendSession = sessionResource ? this._resolveBackendSession(sessionResource) : void 0;
    if (!sessionResource || !backendSession) {
      return;
    }
    if (!isUntitledChatSession(sessionResource)) {
      return;
    }
    const agentUri = this._readSelectedAgent(sessionResource);
    if (agentUri === void 0) {
      return;
    }
    void this._applyMode(widget, sessionResource, agentUri);
  }
  async _applyMode(widget, sessionResource, agentUri) {
    const modes = widget.input.currentChatModesObs.get();
    await modes.waitForPendingUpdates();
    if (widget.viewModel?.sessionResource.toString() !== sessionResource.toString()) {
      return;
    }
    const mode = this._findMode(modes, agentUri);
    if (!mode || widget.input.currentModeObs.get().id === mode.id) {
      return;
    }
    this._updatingWidgets.add(widget);
    try {
      widget.input.setChatMode(mode.id, false);
    } finally {
      this._updatingWidgets.delete(widget);
    }
  }
  _findMode(modes, modeId) {
    return modes.findModeById(modeId) ?? modes.custom.find((mode) => {
      const uri = mode.uri?.get();
      return uri && fromAgentHostUri(uri).toString() === modeId;
    });
  }
  _agentUriFromMode(mode) {
    if (mode.kind !== ChatModeKind.Agent || mode.id === ChatMode.Agent.id || mode.isBuiltin) {
      return void 0;
    }
    const uri = mode.uri?.get();
    return uri ? fromAgentHostUri(uri).toString() : URI.parse(mode.id).toString();
  }
  _storeSelectedAgent(sessionResource, agentUri) {
    const key = agentHostAgentPickerStorageKey(sessionResource.scheme);
    if (agentUri) {
      this._storageService.store(key, agentUri, StorageScope.PROFILE, StorageTarget.MACHINE);
    } else {
      this._storageService.remove(key, StorageScope.PROFILE);
    }
  }
  _readSelectedAgent(sessionResource) {
    const key = agentHostAgentPickerStorageKey(sessionResource.scheme);
    return this._storageService.get(key, StorageScope.PROFILE);
  }
  _resolveBackendSession(sessionResource) {
    const provisionalSession = this._provisionalSessionService.get(sessionResource);
    if (provisionalSession) {
      return provisionalSession;
    }
    if (!sessionResource.scheme.startsWith(AGENT_HOST_SESSION_SCHEME_PREFIX)) {
      return void 0;
    }
    const provider = sessionResource.scheme.substring(AGENT_HOST_SESSION_SCHEME_PREFIX.length);
    return provider ? AgentSession.uri(provider, sessionResource.path.substring(1)) : void 0;
  }
};
AgentHostModeSynchronizer = __decorateClass([
  __decorateParam(0, IChatWidgetService),
  __decorateParam(1, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IWorkbenchEnvironmentService)
], AgentHostModeSynchronizer);
registerWorkbenchContribution2(AgentHostModeSynchronizer.ID, AgentHostModeSynchronizer, WorkbenchPhase.Eventually);
export {
  AgentHostModeSynchronizer
};
