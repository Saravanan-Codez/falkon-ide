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
import { IWorkbenchConfigurationService } from "../../../../services/configuration/common/configuration.js";
import { IRemoteAuthorityResolverService } from "../../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { serializeEnvironmentDescriptionMap, serializeEnvironmentVariableCollection } from "../../../../../platform/terminal/common/environmentVariableShared.js";
import { IConfigurationResolverService } from "../../../../services/configurationResolver/common/configurationResolver.js";
import { SideBySideEditor, EditorResourceAccessor } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { Schemas } from "../../../../../base/common/network.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IEnvironmentVariableService } from "../environmentVariable.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
import { RemoteTerminalChannelEvent, RemoteTerminalChannelRequest } from "./terminal.js";
import { ConfigurationResolverExpression } from "../../../../services/configurationResolver/common/configurationResolverExpression.js";
const REMOTE_TERMINAL_CHANNEL_NAME = "remoteterminal";
let RemoteTerminalChannelClient = class {
  constructor(_remoteAuthority, _channel, _configurationService, _workspaceContextService, _resolverService, _environmentVariableService, _remoteAuthorityResolverService, _logService, _editorService, _labelService, _environmentService) {
    this._remoteAuthority = _remoteAuthority;
    this._channel = _channel;
    this._configurationService = _configurationService;
    this._workspaceContextService = _workspaceContextService;
    this._resolverService = _resolverService;
    this._environmentVariableService = _environmentVariableService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._logService = _logService;
    this._editorService = _editorService;
    this._labelService = _labelService;
    this._environmentService = _environmentService;
  }
  get onPtyHostExit() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnPtyHostExitEvent);
  }
  get onPtyHostStart() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnPtyHostStartEvent);
  }
  get onPtyHostUnresponsive() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnPtyHostUnresponsiveEvent);
  }
  get onPtyHostResponsive() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnPtyHostResponsiveEvent);
  }
  get onPtyHostRequestResolveVariables() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnPtyHostRequestResolveVariablesEvent);
  }
  get onProcessData() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnProcessDataEvent);
  }
  get onProcessExit() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnProcessExitEvent);
  }
  get onProcessReady() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnProcessReadyEvent);
  }
  get onProcessReplay() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnProcessReplayEvent);
  }
  get onProcessOrphanQuestion() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnProcessOrphanQuestion);
  }
  get onExecuteCommand() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnExecuteCommand);
  }
  get onDidRequestDetach() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnDidRequestDetach);
  }
  get onDidChangeProperty() {
    return this._channel.listen(RemoteTerminalChannelEvent.OnDidChangeProperty);
  }
  restartPtyHost() {
    return this._channel.call(RemoteTerminalChannelRequest.RestartPtyHost, []);
  }
  async createProcess(shellLaunchConfig, configuration, activeWorkspaceRootUri, options, shouldPersistTerminal, cols, rows, unicodeVersion) {
    await this._configurationService.whenRemoteConfigurationLoaded();
    const resolvedVariables = /* @__PURE__ */ Object.create(null);
    const lastActiveWorkspace = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
    const expr = ConfigurationResolverExpression.parse({ shellLaunchConfig, configuration });
    try {
      await this._resolverService.resolveAsync(lastActiveWorkspace, expr);
    } catch (err) {
      this._logService.error(err);
    }
    for (const [{ inner }, resolved] of expr.resolved()) {
      if (/^config:/.test(inner) || inner === "selectedText" || inner === "lineNumber") {
        resolvedVariables[inner] = resolved.value;
      }
    }
    const envVariableCollections = [];
    for (const [k, v] of this._environmentVariableService.collections.entries()) {
      envVariableCollections.push([k, serializeEnvironmentVariableCollection(v.map), serializeEnvironmentDescriptionMap(v.descriptionMap)]);
    }
    const resolverResult = await this._remoteAuthorityResolverService.resolveAuthority(this._remoteAuthority);
    const resolverEnv = {
      /**
       * If the extension host was spawned via a launch configuration,
       * include the environment provided by that launch configuration.
       */
      ...this._environmentService.debugExtensionHost.env ?? {},
      ...resolverResult.options?.extensionHostEnv
    };
    const workspace = this._workspaceContextService.getWorkspace();
    const workspaceFolders = workspace.folders;
    const activeWorkspaceFolder = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) : null;
    const activeFileResource = EditorResourceAccessor.getOriginalUri(this._editorService.activeEditor, {
      supportSideBySide: SideBySideEditor.PRIMARY,
      filterByScheme: [Schemas.file, Schemas.vscodeUserData, Schemas.vscodeRemote]
    });
    const args = {
      configuration,
      resolvedVariables,
      envVariableCollections,
      shellLaunchConfig,
      workspaceId: workspace.id,
      workspaceName: this._labelService.getWorkspaceLabel(workspace),
      workspaceFolders,
      activeWorkspaceFolder,
      activeFileResource,
      shouldPersistTerminal,
      options,
      cols,
      rows,
      unicodeVersion,
      resolverEnv
    };
    return await this._channel.call(RemoteTerminalChannelRequest.CreateProcess, args);
  }
  requestDetachInstance(workspaceId, instanceId) {
    return this._channel.call(RemoteTerminalChannelRequest.RequestDetachInstance, [workspaceId, instanceId]);
  }
  acceptDetachInstanceReply(requestId, persistentProcessId) {
    return this._channel.call(RemoteTerminalChannelRequest.AcceptDetachInstanceReply, [requestId, persistentProcessId]);
  }
  attachToProcess(id) {
    return this._channel.call(RemoteTerminalChannelRequest.AttachToProcess, [id]);
  }
  detachFromProcess(id, forcePersist) {
    return this._channel.call(RemoteTerminalChannelRequest.DetachFromProcess, [id, forcePersist]);
  }
  listProcesses() {
    return this._channel.call(RemoteTerminalChannelRequest.ListProcesses);
  }
  getLatency() {
    return this._channel.call(RemoteTerminalChannelRequest.GetLatency);
  }
  getPerformanceMarks() {
    return this._channel.call(RemoteTerminalChannelRequest.GetPerformanceMarks);
  }
  reduceConnectionGraceTime() {
    return this._channel.call(RemoteTerminalChannelRequest.ReduceConnectionGraceTime);
  }
  processBinary(id, data) {
    return this._channel.call(RemoteTerminalChannelRequest.ProcessBinary, [id, data]);
  }
  start(id) {
    return this._channel.call(RemoteTerminalChannelRequest.Start, [id]);
  }
  input(id, data) {
    return this._channel.call(RemoteTerminalChannelRequest.Input, [id, data]);
  }
  sendSignal(id, signal) {
    return this._channel.call(RemoteTerminalChannelRequest.SendSignal, [id, signal]);
  }
  acknowledgeDataEvent(id, charCount) {
    return this._channel.call(RemoteTerminalChannelRequest.AcknowledgeDataEvent, [id, charCount]);
  }
  setUnicodeVersion(id, version) {
    return this._channel.call(RemoteTerminalChannelRequest.SetUnicodeVersion, [id, version]);
  }
  setNextCommandId(id, commandLine, commandId) {
    return this._channel.call(RemoteTerminalChannelRequest.SetNextCommandId, [id, commandLine, commandId]);
  }
  shutdown(id, immediate) {
    return this._channel.call(RemoteTerminalChannelRequest.Shutdown, [id, immediate]);
  }
  resize(id, cols, rows, pixelWidth, pixelHeight) {
    return this._channel.call(RemoteTerminalChannelRequest.Resize, [id, cols, rows, pixelWidth, pixelHeight]);
  }
  clearBuffer(id) {
    return this._channel.call(RemoteTerminalChannelRequest.ClearBuffer, [id]);
  }
  getInitialCwd(id) {
    return this._channel.call(RemoteTerminalChannelRequest.GetInitialCwd, [id]);
  }
  getCwd(id) {
    return this._channel.call(RemoteTerminalChannelRequest.GetCwd, [id]);
  }
  orphanQuestionReply(id) {
    return this._channel.call(RemoteTerminalChannelRequest.OrphanQuestionReply, [id]);
  }
  sendCommandResult(reqId, isError, payload) {
    return this._channel.call(RemoteTerminalChannelRequest.SendCommandResult, [reqId, isError, payload]);
  }
  freePortKillProcess(port) {
    return this._channel.call(RemoteTerminalChannelRequest.FreePortKillProcess, [port]);
  }
  getDefaultSystemShell(osOverride) {
    return this._channel.call(RemoteTerminalChannelRequest.GetDefaultSystemShell, [osOverride]);
  }
  getProfiles(profiles, defaultProfile, includeDetectedProfiles) {
    return this._channel.call(RemoteTerminalChannelRequest.GetProfiles, [this._workspaceContextService.getWorkspace().id, profiles, defaultProfile, includeDetectedProfiles]);
  }
  acceptPtyHostResolvedVariables(requestId, resolved) {
    return this._channel.call(RemoteTerminalChannelRequest.AcceptPtyHostResolvedVariables, [requestId, resolved]);
  }
  getEnvironment() {
    return this._channel.call(RemoteTerminalChannelRequest.GetEnvironment);
  }
  getWslPath(original, direction) {
    return this._channel.call(RemoteTerminalChannelRequest.GetWslPath, [original, direction]);
  }
  setTerminalLayoutInfo(layout) {
    const workspace = this._workspaceContextService.getWorkspace();
    const args = {
      workspaceId: workspace.id,
      tabs: layout ? layout.tabs : [],
      background: layout ? layout.background : null
    };
    return this._channel.call(RemoteTerminalChannelRequest.SetTerminalLayoutInfo, args);
  }
  updateTitle(id, title, titleSource) {
    return this._channel.call(RemoteTerminalChannelRequest.UpdateTitle, [id, title, titleSource]);
  }
  updateIcon(id, userInitiated, icon, color) {
    return this._channel.call(RemoteTerminalChannelRequest.UpdateIcon, [id, userInitiated, icon, color]);
  }
  refreshProperty(id, property) {
    return this._channel.call(RemoteTerminalChannelRequest.RefreshProperty, [id, property]);
  }
  updateProperty(id, property, value) {
    return this._channel.call(RemoteTerminalChannelRequest.UpdateProperty, [id, property, value]);
  }
  getTerminalLayoutInfo() {
    const workspace = this._workspaceContextService.getWorkspace();
    const args = {
      workspaceId: workspace.id
    };
    return this._channel.call(RemoteTerminalChannelRequest.GetTerminalLayoutInfo, args);
  }
  reviveTerminalProcesses(workspaceId, state, dateTimeFormatLocate) {
    return this._channel.call(RemoteTerminalChannelRequest.ReviveTerminalProcesses, [workspaceId, state, dateTimeFormatLocate]);
  }
  getRevivedPtyNewId(id) {
    return this._channel.call(RemoteTerminalChannelRequest.GetRevivedPtyNewId, [id]);
  }
  serializeTerminalState(ids) {
    return this._channel.call(RemoteTerminalChannelRequest.SerializeTerminalState, [ids]);
  }
  // #region Pty service contribution RPC calls
  installAutoReply(match, reply) {
    return this._channel.call(RemoteTerminalChannelRequest.InstallAutoReply, [match, reply]);
  }
  uninstallAllAutoReplies() {
    return this._channel.call(RemoteTerminalChannelRequest.UninstallAllAutoReplies, []);
  }
  // #endregion
};
RemoteTerminalChannelClient = __decorateClass([
  __decorateParam(2, IWorkbenchConfigurationService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IConfigurationResolverService),
  __decorateParam(5, IEnvironmentVariableService),
  __decorateParam(6, IRemoteAuthorityResolverService),
  __decorateParam(7, ITerminalLogService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IWorkbenchEnvironmentService)
], RemoteTerminalChannelClient);
export {
  REMOTE_TERMINAL_CHANNEL_NAME,
  RemoteTerminalChannelClient
};
