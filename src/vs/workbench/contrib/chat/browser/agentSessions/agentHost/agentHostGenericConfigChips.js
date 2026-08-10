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
import * as dom from "../../../../../../base/browser/dom.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Disposable, DisposableMap, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { StateComponents } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { isUntitledChatSession } from "../../../common/model/chatUri.js";
import { AgentHostChatInputPicker, isClaimedByDedicatedPicker } from "./agentHostChatInputPicker.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "./agentHostSessionWorkingDirectoryResolver.js";
import { IAgentHostNewSessionFolderService } from "./agentHostNewSessionFolderService.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { toAgentHostBackendSessionUri } from "./agentHostSessionUri.js";
let AgentHostGenericConfigChips = class extends Disposable {
  constructor(_widget, _instantiationService, _agentHostService, _provisional, _workingDirectoryResolver, _workspaceContextService, _newSessionFolderService) {
    super();
    this._widget = _widget;
    this._instantiationService = _instantiationService;
    this._agentHostService = _agentHostService;
    this._provisional = _provisional;
    this._workingDirectoryResolver = _workingDirectoryResolver;
    this._workspaceContextService = _workspaceContextService;
    this._newSessionFolderService = _newSessionFolderService;
    this._chips = this._register(new DisposableMap());
    /**
     * Subscription to the active session's backend state. Maintained for the
     * lifetime of any one (sessionResource, backendSession) pair; replaced
     * via {@link _reattach} when the active session changes.
     */
    this._subRef = this._register(new MutableDisposable());
    this._initialResolveCts = this._register(new MutableDisposable());
    this._register(this._widget.onDidChangeViewModel(() => this._reattach()));
    this._register(this._provisional.onDidChange((sessionResource) => {
      const current = this._widget.viewModel?.sessionResource;
      if (current && current.toString() === sessionResource.toString()) {
        this._reattach();
      }
    }));
    this._reattach();
  }
  render(container) {
    this._container = container;
    this._sync();
  }
  _reattach() {
    const sessionResource = this._widget.viewModel?.sessionResource;
    const provisionalBackend = sessionResource ? this._provisional.get(sessionResource) : void 0;
    const backendSession = provisionalBackend ?? (sessionResource ? toAgentHostBackendSessionUri(sessionResource) : void 0);
    if (!sessionResource || !backendSession) {
      this._subRef.clear();
      this._initialResolved = void 0;
      this._cancelInitialResolve();
      this._sync();
      return;
    }
    if (isUntitledChatSession(sessionResource) && !provisionalBackend) {
      this._subRef.clear();
      if (!this._initialResolved || this._initialResolved.sessionResource.toString() !== sessionResource.toString()) {
        this._initialResolved = void 0;
        void this._refreshInitialResolved(sessionResource, backendSession);
      }
      this._sync();
      return;
    }
    this._initialResolved = void 0;
    this._cancelInitialResolve();
    const ref = this._agentHostService.getSubscription(StateComponents.Session, backendSession, "AgentHostGenericConfigChips");
    const sub = ref.object;
    const listener = sub.onDidChange(() => this._sync());
    this._subRef.value = {
      sub,
      backendSession,
      dispose: () => {
        listener.dispose();
        ref.dispose();
      }
    };
    this._sync();
  }
  _cancelInitialResolve() {
    this._initialResolveCts.value?.cancel();
    this._initialResolveCts.clear();
  }
  async _refreshInitialResolved(sessionResource, backendSession) {
    this._initialResolveCts.value?.cancel();
    const cts = new CancellationTokenSource();
    this._initialResolveCts.value = cts;
    try {
      const result = await this._agentHostService.resolveSessionConfig({
        provider: backendSession.scheme,
        workingDirectory: this._readWorkingDirectory()
      });
      if (cts.token.isCancellationRequested || this._widget.viewModel?.sessionResource?.toString() !== sessionResource.toString()) {
        return;
      }
      this._initialResolved = { sessionResource, result };
      this._sync();
    } catch {
    }
  }
  _readWorkingDirectory() {
    const state = this._subRef.value?.sub.value;
    if (state && !(state instanceof Error)) {
      const cwd = state.workingDirectories?.[0];
      return typeof cwd === "string" ? URI.parse(cwd) : cwd;
    }
    const sessionResource = this._widget.viewModel?.sessionResource;
    return (sessionResource && this._newSessionFolderService.getFolder(sessionResource)) ?? (sessionResource && this._workingDirectoryResolver.resolve(sessionResource)) ?? this._newSessionFolderService.getDefaultFolder() ?? this._workspaceContextService.getWorkspace().folders[0]?.uri;
  }
  _readSchemaProperties() {
    const sessionResource = this._widget.viewModel?.sessionResource;
    if (this._subRef.value) {
      const state = this._subRef.value.sub.value;
      if (!state || state instanceof Error || !state.config) {
        return void 0;
      }
      const overlay = sessionResource ? this._provisional.getResolvedConfig(sessionResource) : void 0;
      return Object.entries((overlay?.schema ?? state.config.schema).properties);
    }
    if (this._initialResolved && sessionResource && this._initialResolved.sessionResource.toString() === sessionResource.toString()) {
      return Object.entries(this._initialResolved.result.schema.properties);
    }
    return void 0;
  }
  _sync() {
    if (!this._container) {
      return;
    }
    const entries = this._readSchemaProperties();
    const desired = /* @__PURE__ */ new Set();
    if (entries) {
      for (const [property, schema] of entries) {
        if (isClaimedByDedicatedPicker(property, schema)) {
          continue;
        }
        desired.add(property);
      }
    }
    for (const property of [...this._chips.keys()]) {
      if (!desired.has(property)) {
        this._chips.deleteAndDispose(property);
      }
    }
    for (const property of desired) {
      if (this._chips.has(property)) {
        continue;
      }
      const chip = this._instantiationService.createInstance(AgentHostChatInputPicker, this._widget, property);
      const slot = dom.append(this._container, dom.$(".agent-host-generic-chip-slot.chat-input-picker-item"));
      chip.render(slot);
      this._chips.set(property, {
        dispose: () => {
          chip.dispose();
          slot.remove();
        }
      });
    }
  }
};
AgentHostGenericConfigChips = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IAgentHostService),
  __decorateParam(3, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(4, IAgentHostSessionWorkingDirectoryResolver),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IAgentHostNewSessionFolderService)
], AgentHostGenericConfigChips);
export {
  AgentHostGenericConfigChips
};
