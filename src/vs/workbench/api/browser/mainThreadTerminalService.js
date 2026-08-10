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
import { DisposableStore, Disposable, MutableDisposable, combinedDisposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { URI } from "../../../base/common/uri.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ProcessPropertyType, remoteResolverTerminal, TerminalExitReason, TerminalLocation } from "../../../platform/terminal/common/terminal.js";
import { TerminalDataBufferer } from "../../../platform/terminal/common/terminalDataBuffering.js";
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from "../../contrib/terminal/browser/terminal.js";
import { TerminalProcessExtHostProxy } from "../../contrib/terminal/browser/terminalProcessExtHostProxy.js";
import { IEnvironmentVariableService } from "../../contrib/terminal/common/environmentVariable.js";
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection, serializeEnvironmentVariableCollection } from "../../../platform/terminal/common/environmentVariableShared.js";
import { ITerminalProfileResolverService, ITerminalProfileService } from "../../contrib/terminal/common/terminal.js";
import { IRemoteAgentService } from "../../services/remote/common/remoteAgentService.js";
import { OS } from "../../../base/common/platform.js";
import { Promises } from "../../../base/common/async.js";
import { ITerminalLinkProviderService } from "../../contrib/terminalContrib/links/browser/links.js";
import { ITerminalQuickFixService, TerminalQuickFixType } from "../../contrib/terminalContrib/quickFix/browser/quickFix.js";
import { TerminalCapability } from "../../../platform/terminal/common/capabilities/capabilities.js";
import { ITerminalCompletionService } from "../../contrib/terminalContrib/suggest/browser/terminalCompletionService.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { hasKey } from "../../../base/common/types.js";
let MainThreadTerminalService = class extends Disposable {
  constructor(_extHostContext, _terminalService, _terminalLinkProviderService, _terminalQuickFixService, _instantiationService, _environmentVariableService, _logService, _terminalProfileResolverService, remoteAgentService, _terminalGroupService, _terminalEditorService, _terminalProfileService, _terminalCompletionService, _environmentService) {
    super();
    this._terminalService = _terminalService;
    this._terminalLinkProviderService = _terminalLinkProviderService;
    this._terminalQuickFixService = _terminalQuickFixService;
    this._instantiationService = _instantiationService;
    this._environmentVariableService = _environmentVariableService;
    this._logService = _logService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._terminalGroupService = _terminalGroupService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalProfileService = _terminalProfileService;
    this._terminalCompletionService = _terminalCompletionService;
    this._environmentService = _environmentService;
    /**
     * Stores a map from a temporary terminal id (a UUID generated on the extension host side)
     * to a numeric terminal id (an id generated on the renderer side)
     * This comes in play only when dealing with terminals created on the extension host side
     */
    this._extHostTerminals = /* @__PURE__ */ new Map();
    this._terminalProcessProxies = this._register(new DisposableMap());
    this._profileProviders = this._register(new DisposableMap());
    this._completionProviders = this._register(new DisposableMap());
    this._quickFixProviders = this._register(new DisposableMap());
    this._dataEventTracker = this._register(new MutableDisposable());
    this._sendCommandEventListener = this._register(new MutableDisposable());
    /**
     * A single shared terminal link provider for the exthost. When an ext registers a link
     * provider, this is registered with the terminal on the renderer side and all links are
     * provided through this, even from multiple ext link providers. Xterm should remove lower
     * priority intersecting links itself.
     */
    this._linkProvider = this._register(new MutableDisposable());
    this._os = OS;
    this._proxy = _extHostContext.getProxy(ExtHostContext.ExtHostTerminalService);
    this._register(_terminalService.onDidCreateInstance((instance) => {
      this._onTerminalOpened(instance);
      this._onInstanceDimensionsChanged(instance);
    }));
    this._register(_terminalService.onDidDisposeInstance((instance) => this._onTerminalDisposed(instance)));
    this._register(_terminalService.onAnyInstanceProcessIdReady((instance) => this._onTerminalProcessIdReady(instance)));
    this._register(_terminalService.onDidChangeInstanceDimensions((instance) => this._onInstanceDimensionsChanged(instance)));
    this._register(_terminalService.onAnyInstanceMaximumDimensionsChange((instance) => this._onInstanceMaximumDimensionsChanged(instance)));
    this._register(_terminalService.onDidRequestStartExtensionTerminal((e) => this._onRequestStartExtensionTerminal(e)));
    this._register(_terminalService.onDidChangeActiveInstance((instance) => this._onActiveTerminalChanged(instance ? instance.instanceId : null)));
    this._register(_terminalService.onAnyInstanceTitleChange((instance) => instance && this._onTitleChanged(instance.instanceId, instance.title)));
    this._register(_terminalService.onAnyInstanceDataInput((instance) => this._proxy.$acceptTerminalInteraction(instance.instanceId)));
    this._register(_terminalService.onAnyInstanceSelectionChange((instance) => this._proxy.$acceptTerminalSelection(instance.instanceId, instance.selection)));
    this._register(_terminalService.onAnyInstanceShellTypeChanged((instance) => this._onShellTypeChanged(instance.instanceId)));
    for (const instance of this._terminalService.instances) {
      this._onTerminalOpened(instance);
      instance.processReady.then(() => this._onTerminalProcessIdReady(instance));
      if (instance.shellType) {
        this._proxy.$acceptTerminalShellType(instance.instanceId, instance.shellType);
      }
    }
    const activeInstance = this._terminalService.activeInstance;
    if (activeInstance) {
      this._proxy.$acceptActiveTerminalChanged(activeInstance.instanceId);
    }
    if (this._environmentVariableService.collections.size > 0) {
      const collectionAsArray = [...this._environmentVariableService.collections.entries()];
      const serializedCollections = collectionAsArray.map((e) => {
        return [e[0], serializeEnvironmentVariableCollection(e[1].map)];
      });
      this._proxy.$initEnvironmentVariableCollections(serializedCollections);
    }
    remoteAgentService.getEnvironment().then(async (env) => {
      this._os = env?.os || OS;
      this._updateDefaultProfile();
    });
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => this._updateDefaultProfile()));
  }
  async _updateDefaultProfile() {
    const remoteAuthority = this._environmentService.remoteAuthority;
    const defaultProfile = this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority, os: this._os });
    const defaultAutomationProfile = this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority, os: this._os, allowAutomationShell: true });
    this._proxy.$acceptDefaultProfile(...await Promise.all([defaultProfile, defaultAutomationProfile]));
  }
  async _getTerminalInstance(id) {
    if (typeof id === "string") {
      return this._extHostTerminals.get(id);
    }
    return this._terminalService.getInstanceFromId(id);
  }
  async $createTerminal(extHostTerminalId, launchConfig) {
    const shellLaunchConfig = {
      name: launchConfig.name,
      executable: launchConfig.shellPath,
      args: launchConfig.shellArgs,
      cwd: typeof launchConfig.cwd === "string" ? launchConfig.cwd : URI.revive(launchConfig.cwd),
      icon: launchConfig.icon,
      color: launchConfig.color,
      initialText: launchConfig.initialText,
      waitOnExit: launchConfig.waitOnExit,
      ignoreConfigurationCwd: true,
      env: launchConfig.env,
      strictEnv: launchConfig.strictEnv,
      hideFromUser: launchConfig.hideFromUser,
      customPtyImplementation: launchConfig.isExtensionCustomPtyTerminal ? (id, cols, rows) => new TerminalProcessExtHostProxy(id, cols, rows, this._terminalService) : void 0,
      extHostTerminalId,
      forceShellIntegration: launchConfig.forceShellIntegration,
      isFeatureTerminal: launchConfig.isFeatureTerminal,
      [remoteResolverTerminal]: launchConfig.isRemoteResolverTerminal || void 0,
      isExtensionOwnedTerminal: launchConfig.isExtensionOwnedTerminal,
      useShellEnvironment: launchConfig.useShellEnvironment,
      isTransient: launchConfig.isTransient,
      shellIntegrationNonce: launchConfig.shellIntegrationNonce,
      titleTemplate: launchConfig.titleTemplate
    };
    const terminal = Promises.withAsyncBody(async (r) => {
      const terminal2 = await this._terminalService.createTerminal({
        config: shellLaunchConfig,
        cwd: launchConfig.isRemoteResolverTerminal ? shellLaunchConfig.cwd : void 0,
        location: await this._deserializeParentTerminal(launchConfig.location)
      });
      r(terminal2);
    });
    this._extHostTerminals.set(extHostTerminalId, terminal);
    const terminalInstance = await terminal;
    this._register(terminalInstance.onDisposed(() => {
      this._extHostTerminals.delete(extHostTerminalId);
    }));
  }
  async _deserializeParentTerminal(location) {
    if (typeof location === "object" && hasKey(location, { parentTerminal: true })) {
      const parentTerminal = await this._extHostTerminals.get(location.parentTerminal.toString());
      return parentTerminal ? { parentTerminal } : void 0;
    }
    return location;
  }
  async $show(id, preserveFocus) {
    const terminalInstance = await this._getTerminalInstance(id);
    if (terminalInstance) {
      this._terminalService.setActiveInstance(terminalInstance);
      if (terminalInstance.target === TerminalLocation.Editor) {
        await this._terminalEditorService.revealActiveEditor(preserveFocus);
      } else {
        await this._terminalGroupService.showPanel(!preserveFocus);
      }
    }
  }
  async $hide(id) {
    const instanceToHide = await this._getTerminalInstance(id);
    const activeInstance = this._terminalService.activeInstance;
    if (activeInstance && activeInstance.instanceId === instanceToHide?.instanceId && activeInstance.target !== TerminalLocation.Editor) {
      this._terminalGroupService.hidePanel();
    }
  }
  async $dispose(id) {
    (await this._getTerminalInstance(id))?.dispose(TerminalExitReason.Extension);
  }
  async $sendText(id, text, shouldExecute) {
    const instance = await this._getTerminalInstance(id);
    await instance?.sendText(text, shouldExecute);
  }
  $sendProcessExit(terminalId, exitCode) {
    this._terminalProcessProxies.get(terminalId)?.proxy.emitExit(exitCode);
  }
  $startSendingDataEvents() {
    if (!this._dataEventTracker.value) {
      this._dataEventTracker.value = this._instantiationService.createInstance(TerminalDataEventTracker, (id, data) => {
        this._onTerminalData(id, data);
      });
      for (const instance of this._terminalService.instances) {
        for (const data of instance.initialDataEvents || []) {
          this._onTerminalData(instance.instanceId, data);
        }
      }
    }
  }
  $stopSendingDataEvents() {
    this._dataEventTracker.clear();
  }
  $startSendingCommandEvents() {
    if (this._sendCommandEventListener.value) {
      return;
    }
    const multiplexer = this._terminalService.createOnInstanceCapabilityEvent(TerminalCapability.CommandDetection, (capability) => capability.onCommandFinished);
    const sub = multiplexer.event((e) => {
      this._onDidExecuteCommand(e.instance.instanceId, {
        commandLine: e.data.command,
        // TODO: Convert to URI if possible
        cwd: e.data.cwd,
        exitCode: e.data.exitCode,
        output: e.data.getOutput()
      });
    });
    this._sendCommandEventListener.value = combinedDisposable(multiplexer, sub);
  }
  $stopSendingCommandEvents() {
    this._sendCommandEventListener.clear();
  }
  $startLinkProvider() {
    this._linkProvider.value = this._terminalLinkProviderService.registerLinkProvider(new ExtensionTerminalLinkProvider(this._proxy));
  }
  $stopLinkProvider() {
    this._linkProvider.clear();
  }
  $registerProcessSupport(isSupported) {
    this._terminalService.registerProcessSupport(isSupported);
  }
  $registerCompletionProvider(id, extensionIdentifier, ...triggerCharacters) {
    this._completionProviders.set(id, this._terminalCompletionService.registerTerminalCompletionProvider(extensionIdentifier, id, {
      id,
      provideCompletions: async (commandLine, cursorIndex, token) => {
        const completions = await this._proxy.$provideTerminalCompletions(id, { commandLine, cursorIndex }, token);
        if (!completions) {
          return void 0;
        }
        if (completions.resourceOptions) {
          const { cwd, globPattern, ...rest } = completions.resourceOptions;
          return {
            items: completions.items?.map((c) => ({
              provider: `ext:${id}`,
              ...c
            })),
            resourceOptions: {
              ...rest,
              cwd,
              globPattern
            }
          };
        }
        return completions.items?.map((c) => ({
          provider: `ext:${id}`,
          ...c
        }));
      }
    }, ...triggerCharacters));
  }
  $unregisterCompletionProvider(id) {
    this._completionProviders.deleteAndDispose(id);
  }
  $registerProfileProvider(id, extensionIdentifier) {
    this._profileProviders.set(id, this._terminalProfileService.registerTerminalProfileProvider(extensionIdentifier, id, {
      createContributedTerminalProfile: async (options) => {
        return this._proxy.$createContributedProfileTerminal(id, options);
      }
    }));
  }
  $unregisterProfileProvider(id) {
    this._profileProviders.deleteAndDispose(id);
  }
  async $registerQuickFixProvider(id, extensionId) {
    this._quickFixProviders.set(id, this._terminalQuickFixService.registerQuickFixProvider(id, {
      provideTerminalQuickFixes: async (terminalCommand, lines, options, token) => {
        if (token.isCancellationRequested) {
          return;
        }
        if (options.outputMatcher?.length && options.outputMatcher.length > 40) {
          options.outputMatcher.length = 40;
          this._logService.warn("Cannot exceed output matcher length of 40");
        }
        const commandLineMatch = terminalCommand.command.match(options.commandLineMatcher);
        if (!commandLineMatch || !lines) {
          return;
        }
        const outputMatcher = options.outputMatcher;
        let outputMatch;
        if (outputMatcher) {
          outputMatch = getOutputMatchForLines(lines, outputMatcher);
        }
        if (!outputMatch) {
          return;
        }
        const matchResult = { commandLineMatch, outputMatch, commandLine: terminalCommand.command };
        if (matchResult) {
          const result = await this._proxy.$provideTerminalQuickFixes(id, matchResult, token);
          if (result && Array.isArray(result)) {
            return result.map((r) => parseQuickFix(id, extensionId, r));
          } else if (result) {
            return parseQuickFix(id, extensionId, result);
          }
        }
        return;
      }
    }));
  }
  $unregisterQuickFixProvider(id) {
    this._quickFixProviders.deleteAndDispose(id);
  }
  _onActiveTerminalChanged(terminalId) {
    this._proxy.$acceptActiveTerminalChanged(terminalId);
  }
  _onTerminalData(terminalId, data) {
    this._proxy.$acceptTerminalProcessData(terminalId, data);
  }
  _onDidExecuteCommand(terminalId, command) {
    this._proxy.$acceptDidExecuteCommand(terminalId, command);
  }
  _onTitleChanged(terminalId, name) {
    this._proxy.$acceptTerminalTitleChange(terminalId, name);
  }
  _onShellTypeChanged(terminalId) {
    const terminalInstance = this._terminalService.getInstanceFromId(terminalId);
    if (terminalInstance) {
      this._proxy.$acceptTerminalShellType(terminalId, terminalInstance.shellType);
    }
  }
  _onTerminalDisposed(terminalInstance) {
    this._proxy.$acceptTerminalClosed(terminalInstance.instanceId, terminalInstance.exitCode, terminalInstance.exitReason ?? TerminalExitReason.Unknown);
    this._terminalProcessProxies.deleteAndDispose(terminalInstance.instanceId);
  }
  _onTerminalOpened(terminalInstance) {
    const extHostTerminalId = terminalInstance.shellLaunchConfig.extHostTerminalId;
    const shellLaunchConfigDto = {
      name: terminalInstance.shellLaunchConfig.name,
      executable: terminalInstance.shellLaunchConfig.executable,
      args: terminalInstance.shellLaunchConfig.args,
      cwd: terminalInstance.shellLaunchConfig.cwd,
      env: terminalInstance.shellLaunchConfig.env,
      hideFromUser: terminalInstance.shellLaunchConfig.hideFromUser,
      tabActions: terminalInstance.shellLaunchConfig.tabActions,
      titleTemplate: terminalInstance.shellLaunchConfig.titleTemplate
    };
    this._proxy.$acceptTerminalOpened(terminalInstance.instanceId, extHostTerminalId, terminalInstance.title, shellLaunchConfigDto);
  }
  _onTerminalProcessIdReady(terminalInstance) {
    if (terminalInstance.processId === void 0) {
      return;
    }
    this._proxy.$acceptTerminalProcessId(terminalInstance.instanceId, terminalInstance.processId);
  }
  _onInstanceDimensionsChanged(instance) {
    this._proxy.$acceptTerminalDimensions(instance.instanceId, instance.cols, instance.rows);
  }
  _onInstanceMaximumDimensionsChanged(instance) {
    this._proxy.$acceptTerminalMaximumDimensions(instance.instanceId, instance.maxCols, instance.maxRows);
  }
  _onRequestStartExtensionTerminal(request) {
    const proxy = request.proxy;
    const store = new DisposableStore();
    store.add(proxy);
    this._terminalProcessProxies.set(proxy.instanceId, { proxy, dispose: () => store.dispose() });
    const initialDimensions = request.cols && request.rows ? {
      columns: request.cols,
      rows: request.rows
    } : void 0;
    this._proxy.$startExtensionTerminal(
      proxy.instanceId,
      initialDimensions
    ).then(request.callback);
    store.add(proxy.onInput((data) => this._proxy.$acceptProcessInput(proxy.instanceId, data)));
    store.add(proxy.onShutdown((immediate) => this._proxy.$acceptProcessShutdown(proxy.instanceId, immediate)));
    store.add(proxy.onRequestCwd(() => this._proxy.$acceptProcessRequestCwd(proxy.instanceId)));
    store.add(proxy.onRequestInitialCwd(() => this._proxy.$acceptProcessRequestInitialCwd(proxy.instanceId)));
  }
  $sendProcessData(terminalId, data) {
    this._terminalProcessProxies.get(terminalId)?.proxy.emitData(data);
  }
  $sendProcessReady(terminalId, pid, cwd, windowsPty) {
    this._terminalProcessProxies.get(terminalId)?.proxy.emitReady(pid, cwd, windowsPty);
  }
  $sendProcessProperty(terminalId, property) {
    if (property.type === ProcessPropertyType.Title) {
      const instance = this._terminalService.getInstanceFromId(terminalId);
      instance?.rename(property.value);
    }
    this._terminalProcessProxies.get(terminalId)?.proxy.emitProcessProperty(property);
  }
  $setEnvironmentVariableCollection(extensionIdentifier, persistent, collection, descriptionMap) {
    if (collection) {
      const translatedCollection = {
        persistent,
        map: deserializeEnvironmentVariableCollection(collection),
        descriptionMap: deserializeEnvironmentDescriptionMap(descriptionMap)
      };
      this._environmentVariableService.set(extensionIdentifier, translatedCollection);
    } else {
      this._environmentVariableService.delete(extensionIdentifier);
    }
  }
};
MainThreadTerminalService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTerminalService),
  __decorateParam(1, ITerminalService),
  __decorateParam(2, ITerminalLinkProviderService),
  __decorateParam(3, ITerminalQuickFixService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IEnvironmentVariableService),
  __decorateParam(6, ILogService),
  __decorateParam(7, ITerminalProfileResolverService),
  __decorateParam(8, IRemoteAgentService),
  __decorateParam(9, ITerminalGroupService),
  __decorateParam(10, ITerminalEditorService),
  __decorateParam(11, ITerminalProfileService),
  __decorateParam(12, ITerminalCompletionService),
  __decorateParam(13, IWorkbenchEnvironmentService)
], MainThreadTerminalService);
let TerminalDataEventTracker = class extends Disposable {
  constructor(_callback, _terminalService) {
    super();
    this._callback = _callback;
    this._terminalService = _terminalService;
    this._instanceListeners = this._register(new DisposableMap());
    this._register(this._bufferer = new TerminalDataBufferer(this._callback));
    for (const instance of this._terminalService.instances) {
      this._registerInstance(instance);
    }
    this._register(this._terminalService.onDidCreateInstance((instance) => this._registerInstance(instance)));
    this._register(this._terminalService.onDidDisposeInstance((instance) => {
      this._bufferer.stopBuffering(instance.instanceId);
      this._instanceListeners.deleteAndDispose(instance.instanceId);
    }));
  }
  _registerInstance(instance) {
    this._instanceListeners.set(instance.instanceId, this._bufferer.startBuffering(instance.instanceId, instance.onData));
  }
};
TerminalDataEventTracker = __decorateClass([
  __decorateParam(1, ITerminalService)
], TerminalDataEventTracker);
class ExtensionTerminalLinkProvider {
  constructor(_proxy) {
    this._proxy = _proxy;
  }
  async provideLinks(instance, line) {
    const proxy = this._proxy;
    const extHostLinks = await proxy.$provideLinks(instance.instanceId, line);
    return extHostLinks.map((dto) => ({
      id: dto.id,
      startIndex: dto.startIndex,
      length: dto.length,
      label: dto.label,
      activate: () => proxy.$activateLink(instance.instanceId, dto.id)
    }));
  }
}
function getOutputMatchForLines(lines, outputMatcher) {
  const match = lines.join("\n").match(outputMatcher.lineMatcher);
  return match ? { regexMatch: match, outputLines: lines } : void 0;
}
function parseQuickFix(id, source, fix) {
  let type = TerminalQuickFixType.TerminalCommand;
  if (hasKey(fix, { uri: true })) {
    fix.uri = URI.revive(fix.uri);
    type = TerminalQuickFixType.Opener;
  } else if (hasKey(fix, { id: true })) {
    type = TerminalQuickFixType.VscodeCommand;
  }
  return { id, type, source, ...fix };
}
export {
  MainThreadTerminalService,
  getOutputMatchForLines
};
