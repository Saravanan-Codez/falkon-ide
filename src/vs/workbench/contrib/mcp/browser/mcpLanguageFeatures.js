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
import { computeLevenshteinDistance } from "../../../../base/common/diff/diff.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { createMarkdownCommandLink, MarkdownString } from "../../../../base/common/htmlContent.js";
import { findNodeAtLocation, parseTree } from "../../../../base/common/json.js";
import { Disposable, DisposableStore, dispose, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../nls.js";
import { IAgentHostConnectionsService, LOCAL_AGENT_HOST_SCHEME_PREFIX } from "../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { remoteAgentHostSessionTypeId } from "../../../../platform/agentHost/common/agentHostSessionType.js";
import { AgentSession } from "../../../../platform/agentHost/common/agentService.js";
import { ActionType } from "../../../../platform/agentHost/common/state/protocol/actions.js";
import { CustomizationType, McpServerStatus } from "../../../../platform/agentHost/common/state/protocol/state.js";
import { StateComponents } from "../../../../platform/agentHost/common/state/sessionState.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
import { StorageScope } from "../../../../platform/storage/common/storage.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { ConfigurationResolverExpression } from "../../../services/configurationResolver/common/configurationResolverExpression.js";
import { IAgentHostCustomizationService } from "../../chat/browser/agentSessions/agentHost/agentHostCustomizationService.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { isContributionDisabled } from "../../chat/common/enablement.js";
import { McpCommandIds } from "../common/mcpCommandIds.js";
import { mcpConfigurationSection } from "../common/mcpConfiguration.js";
import { countRunningMcpServersInOtherSessions, getActiveAgentHostMcpSessionResource } from "../common/mcpEditorAffordanceState.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
import { IMcpService, IMcpWorkbenchService, McpConnectionState, mcpOAuthClientSecretStorageKey } from "../common/mcpTypes.js";
const diagnosticOwner = "vscode.mcp";
let McpLanguageFeatures = class extends Disposable {
  constructor(languageFeaturesService, _mcpRegistry, _mcpWorkbenchService, _mcpService, _chatWidgetService, _agentHostCustomizationService, _agentHostConnectionsService, _markerService, _configurationResolverService, _secretStorageService) {
    super();
    this._mcpRegistry = _mcpRegistry;
    this._mcpWorkbenchService = _mcpWorkbenchService;
    this._mcpService = _mcpService;
    this._chatWidgetService = _chatWidgetService;
    this._agentHostCustomizationService = _agentHostCustomizationService;
    this._agentHostConnectionsService = _agentHostConnectionsService;
    this._markerService = _markerService;
    this._configurationResolverService = _configurationResolverService;
    this._secretStorageService = _secretStorageService;
    this._cachedMcpSection = this._register(new MutableDisposable());
    const patterns = [
      { pattern: "**/mcp.json" },
      { pattern: "**/.mcp.json" },
      { pattern: "**/workspace.json" }
    ];
    const onDidChangeCodeLens = this._register(new Emitter());
    const codeLensProvider = {
      onDidChange: onDidChangeCodeLens.event,
      provideCodeLenses: (model, range) => this._provideCodeLenses(model, () => onDidChangeCodeLens.fire(codeLensProvider))
    };
    const refreshCodeLens = () => onDidChangeCodeLens.fire(codeLensProvider);
    this._register(languageFeaturesService.codeLensProvider.register(patterns, codeLensProvider));
    this._register(this._secretStorageService.onDidChangeSecret((key) => {
      if (key.startsWith("mcp.oauth.clientSecret:")) {
        refreshCodeLens();
      }
    }));
    const focusedWidgetViewModelListener = this._register(new MutableDisposable());
    const updateFocusedWidgetViewModelListener = () => {
      focusedWidgetViewModelListener.value = this._chatWidgetService.lastFocusedWidget?.onDidChangeViewModel(refreshCodeLens);
      refreshCodeLens();
    };
    const connectionStateListeners = this._register(new MutableDisposable());
    const updateConnectionStateListeners = () => {
      const store = new DisposableStore();
      for (const connectionInfo of this._agentHostConnectionsService.connections) {
        const connection = connectionInfo.connection;
        if (connection) {
          store.add(connection.onDidAction(({ action }) => {
            switch (action.type) {
              case ActionType.SessionCustomizationsChanged:
              case ActionType.SessionCustomizationUpdated:
              case ActionType.SessionCustomizationRemoved:
              case ActionType.SessionMcpServerStateChanged:
                refreshCodeLens();
                break;
            }
          }));
        }
      }
      connectionStateListeners.value = store;
      refreshCodeLens();
    };
    updateFocusedWidgetViewModelListener();
    updateConnectionStateListeners();
    this._register(this._chatWidgetService.onDidChangeFocusedWidget(updateFocusedWidgetViewModelListener));
    this._register(this._chatWidgetService.onDidChangeFocusedSession(refreshCodeLens));
    this._register(this._agentHostConnectionsService.onDidChangeConnections(updateConnectionStateListeners));
    this._register(this._agentHostCustomizationService.onDidChangeCustomizations(refreshCodeLens));
    this._register(languageFeaturesService.inlayHintsProvider.register(patterns, {
      onDidChangeInlayHints: _mcpRegistry.onDidChangeInputs,
      provideInlayHints: (model, range) => this._provideInlayHints(model, range)
    }));
  }
  /** Simple mechanism to avoid extra json parsing for hints+lenses */
  async _parseModel(model) {
    if (this._cachedMcpSection.value?.model === model) {
      return this._cachedMcpSection.value;
    }
    const uri = model.uri;
    const inConfig = uri.path.endsWith("/.mcp.json") ? { scope: StorageScope.WORKSPACE, target: ConfigurationTarget.WORKSPACE_FOLDER, serversKey: "mcpServers" } : await this._mcpWorkbenchService.getMcpConfigPath(model.uri);
    if (!inConfig) {
      return void 0;
    }
    const value = model.getValue();
    const tree = parseTree(value);
    const listeners = [
      model.onDidChangeContent(() => this._cachedMcpSection.clear()),
      model.onWillDispose(() => this._cachedMcpSection.clear())
    ];
    this._addDiagnostics(model, value, tree, inConfig);
    return this._cachedMcpSection.value = {
      model,
      tree,
      inConfig,
      dispose: () => {
        this._markerService.remove(diagnosticOwner, [uri]);
        dispose(listeners);
      }
    };
  }
  _addDiagnostics(tm, value, tree, inConfig) {
    const serversKey = inConfig.serversKey ?? "servers";
    const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, serversKey] : [serversKey]);
    if (!serversNode) {
      return;
    }
    const getClosestMatchingVariable = (name) => {
      let bestValue = "";
      let bestDistance = Infinity;
      for (const variable of this._configurationResolverService.resolvableVariables) {
        const distance = computeLevenshteinDistance(name, variable);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestValue = variable;
        }
      }
      return bestValue;
    };
    const diagnostics = [];
    forEachPropertyWithReplacement(serversNode, (node) => {
      const expr = ConfigurationResolverExpression.parse(node.value);
      for (const { id, name, arg } of expr.unresolved()) {
        if (!this._configurationResolverService.resolvableVariables.has(name)) {
          const position = value.indexOf(id, node.offset);
          if (position === -1) {
            continue;
          }
          const start = tm.getPositionAt(position);
          const end = tm.getPositionAt(position + id.length);
          diagnostics.push({
            severity: MarkerSeverity.Warning,
            message: localize("mcp.variableNotFound", "Variable `{0}` not found, did you mean ${{1}}?", name, getClosestMatchingVariable(name) + (arg ? `:${arg}` : "")),
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
            modelVersionId: tm.getVersionId()
          });
        }
      }
    });
    if (diagnostics.length) {
      this._markerService.changeOne(diagnosticOwner, tm.uri, diagnostics);
    } else {
      this._markerService.remove(diagnosticOwner, [tm.uri]);
    }
  }
  async _provideCodeLenses(model, onDidChangeCodeLens) {
    const parsed = await this._parseModel(model);
    if (!parsed) {
      return void 0;
    }
    const { tree, inConfig } = parsed;
    const serversKey = inConfig.serversKey ?? "servers";
    const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, serversKey] : [serversKey]);
    if (!serversNode) {
      return void 0;
    }
    const store = new DisposableStore();
    const lenses = [];
    const lensList = { lenses, dispose: () => store.dispose() };
    const read = (observable) => {
      store.add(Event.fromObservableLight(observable)(onDidChangeCodeLens));
      return observable.get();
    };
    const collection = read(this._mcpRegistry.collections).find((c) => isEqual(c.presentation?.origin, model.uri));
    if (!collection) {
      return lensList;
    }
    const agentHostSession = getActiveAgentHostMcpSessionResource(this._chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource);
    if (agentHostSession) {
      const mcpServers = this._agentHostCustomizationService.getMcpServers(agentHostSession);
      const otherRunningCounts = this._getOtherRunningAgentHostMcpServerCounts(agentHostSession);
      for (const node of serversNode.children || []) {
        if (node.type !== "property" || node.children?.[0]?.type !== "string") {
          continue;
        }
        const name = node.children[0].value;
        const server = mcpServers.find((s) => s.name === name);
        if (!server) {
          continue;
        }
        this._addAgentHostServerCodeLenses(lenses, Range.fromPositions(model.getPositionAt(node.children[0].offset)), agentHostSession, server, otherRunningCounts.get(name) ?? 0);
      }
    } else {
      const mcpServers = read(this._mcpService.servers).filter((s) => s.collection.id === collection.id);
      for (const node of serversNode.children || []) {
        if (node.type !== "property" || node.children?.[0]?.type !== "string") {
          continue;
        }
        const name = node.children[0].value;
        const server = mcpServers.find((s) => s.definition.label === name);
        if (!server) {
          continue;
        }
        const range = Range.fromPositions(model.getPositionAt(node.children[0].offset));
        if (isContributionDisabled(read(server.enablement))) {
          lenses.push({
            range,
            command: {
              id: McpCommandIds.ServerOptions,
              title: "$(circle-slash) " + localize("server.disabled", "Disabled"),
              arguments: [server.definition.id]
            }
          });
          continue;
        }
        const canDebug = !!server.readDefinitions().get().server?.devMode?.debug;
        const state = read(server.connectionState).state;
        switch (state) {
          case McpConnectionState.Kind.Error:
            lenses.push({
              range,
              command: {
                id: McpCommandIds.ShowOutput,
                title: "$(error) " + localize("server.error", "Error"),
                arguments: [server.definition.id]
              }
            }, {
              range,
              command: {
                id: McpCommandIds.RestartServer,
                title: localize("mcp.restart", "Restart"),
                arguments: [server.definition.id, { autoTrustChanges: true }]
              }
            });
            if (canDebug) {
              lenses.push({
                range,
                command: {
                  id: McpCommandIds.RestartServer,
                  title: localize("mcp.debug", "Debug"),
                  arguments: [server.definition.id, { debug: true, autoTrustChanges: true }]
                }
              });
            }
            break;
          case McpConnectionState.Kind.Starting:
            lenses.push({
              range,
              command: {
                id: McpCommandIds.ShowOutput,
                title: "$(loading~spin) " + localize("server.starting", "Starting"),
                arguments: [server.definition.id]
              }
            }, {
              range,
              command: {
                id: McpCommandIds.StopServer,
                title: localize("cancel", "Cancel"),
                arguments: [server.definition.id]
              }
            });
            break;
          case McpConnectionState.Kind.Running:
            lenses.push({
              range,
              command: {
                id: McpCommandIds.ShowOutput,
                title: "$(check) " + localize("server.running", "Running"),
                arguments: [server.definition.id]
              }
            }, {
              range,
              command: {
                id: McpCommandIds.StopServer,
                title: localize("mcp.stop", "Stop"),
                arguments: [server.definition.id]
              }
            }, {
              range,
              command: {
                id: McpCommandIds.RestartServer,
                title: localize("mcp.restart", "Restart"),
                arguments: [server.definition.id, { autoTrustChanges: true }]
              }
            });
            if (canDebug) {
              lenses.push({
                range,
                command: {
                  id: McpCommandIds.RestartServer,
                  title: localize("mcp.debug", "Debug"),
                  arguments: [server.definition.id, { autoTrustChanges: true, debug: true }]
                }
              });
            }
            break;
          case McpConnectionState.Kind.Stopped:
            lenses.push({
              range,
              command: {
                id: McpCommandIds.StartServer,
                title: "$(debug-start) " + localize("mcp.start", "Start"),
                arguments: [server.definition.id, { autoTrustChanges: true }]
              }
            });
            if (canDebug) {
              lenses.push({
                range,
                command: {
                  id: McpCommandIds.StartServer,
                  title: localize("mcp.debug", "Debug"),
                  arguments: [server.definition.id, { autoTrustChanges: true, debug: true }]
                }
              });
            }
        }
        if (state !== McpConnectionState.Kind.Error) {
          const toolCount = read(server.tools).length;
          if (toolCount) {
            lenses.push({
              range,
              command: {
                id: "",
                title: localize("server.toolCount", "{0} tools", toolCount)
              }
            });
          }
          const promptCount = read(server.prompts).length;
          if (promptCount) {
            lenses.push({
              range,
              command: {
                id: McpCommandIds.StartPromptForServer,
                title: localize("server.promptcount", "{0} prompts", promptCount),
                arguments: [server]
              }
            });
          }
          lenses.push({
            range,
            command: {
              id: McpCommandIds.ServerOptions,
              title: localize("mcp.server.more", "More..."),
              arguments: [server.definition.id]
            }
          });
        }
      }
    }
    const candidates = [];
    for (const node of serversNode.children || []) {
      if (node.type !== "property" || node.children?.[0]?.type !== "string" || !node.children[1]) {
        continue;
      }
      const serverName = node.children[0].value;
      const serverValue = node.children[1];
      const clientIdNode = findNodeAtLocation(serverValue, ["oauth", "clientId"]);
      if (clientIdNode && clientIdNode.type === "string") {
        const clientId = clientIdNode.value;
        if (clientId) {
          const urlNode = findNodeAtLocation(serverValue, ["url"]);
          const rawUrl = urlNode && urlNode.type === "string" ? urlNode.value : void 0;
          if (!rawUrl) {
            continue;
          }
          let mcpServerUrl;
          try {
            mcpServerUrl = URI.parse(rawUrl).toString(true);
          } catch {
            continue;
          }
          candidates.push({ clientId, mcpServerUrl, serverName, clientIdOffset: clientIdNode.offset });
        }
      }
    }
    const existingSecrets = await Promise.all(
      candidates.map((c) => this._secretStorageService.get(mcpOAuthClientSecretStorageKey(c.mcpServerUrl, c.clientId)))
    );
    for (let i = 0; i < candidates.length; i++) {
      const { clientId, mcpServerUrl, serverName, clientIdOffset } = candidates[i];
      const existing = existingSecrets[i];
      const title = existing ? localize("mcp.replaceClientSecret", "Replace Client Secret") : localize("mcp.setClientSecret", "Set Client Secret");
      lenses.push({
        range: Range.fromPositions(model.getPositionAt(clientIdOffset)),
        command: {
          id: McpCommandIds.SetOAuthClientSecret,
          title,
          arguments: [clientId, mcpServerUrl, serverName]
        }
      });
    }
    return lensList;
  }
  _addAgentHostServerCodeLenses(lenses, range, agentHostSession, server, otherRunningSessionCount) {
    const commandArg = { agentHostSession, serverId: server.id };
    if (!server.enabled) {
      lenses.push({
        range,
        command: {
          id: McpCommandIds.AgentHostServerOptions,
          title: "$(circle-slash) " + localize("server.disabled", "Disabled"),
          arguments: [agentHostSession, server.id]
        }
      });
      return;
    }
    switch (server.status) {
      case McpServerStatus.Error:
        lenses.push({
          range,
          command: {
            id: McpCommandIds.AgentHostServerOptions,
            title: "$(error) " + localize("server.error", "Error"),
            arguments: [agentHostSession, server.id]
          }
        });
        lenses.push({
          range,
          command: {
            id: McpCommandIds.StartServer,
            title: localize("mcp.start", "Start"),
            arguments: [commandArg]
          }
        });
        break;
      case McpServerStatus.Starting:
        lenses.push({
          range,
          command: {
            id: McpCommandIds.AgentHostServerOptions,
            title: "$(loading~spin) " + localize("server.starting", "Starting"),
            arguments: [agentHostSession, server.id]
          }
        });
        lenses.push({
          range,
          command: {
            id: McpCommandIds.StopServer,
            title: localize("cancel", "Cancel"),
            arguments: [commandArg]
          }
        });
        break;
      case McpServerStatus.Ready:
        lenses.push({
          range,
          command: {
            id: McpCommandIds.AgentHostServerOptions,
            title: "$(check) " + localize("server.running", "Running"),
            arguments: [agentHostSession, server.id]
          }
        });
        lenses.push({
          range,
          command: {
            id: McpCommandIds.StopServer,
            title: localize("mcp.stop", "Stop"),
            arguments: [commandArg]
          }
        });
        break;
      case McpServerStatus.AuthRequired:
        lenses.push({
          range,
          command: {
            id: McpCommandIds.AgentHostServerOptions,
            title: "$(account) " + localize("server.authRequired", "Authentication Required"),
            arguments: [agentHostSession, server.id]
          }
        });
        lenses.push({
          range,
          command: {
            id: McpCommandIds.StopServer,
            title: localize("mcp.stop", "Stop"),
            arguments: [commandArg]
          }
        });
        break;
      case McpServerStatus.Stopped:
        lenses.push({
          range,
          command: {
            id: McpCommandIds.StartServer,
            title: "$(debug-start) " + localize("mcp.start", "Start"),
            arguments: [commandArg]
          }
        });
        break;
    }
    if (otherRunningSessionCount > 0) {
      lenses.push({
        range,
        command: {
          id: "",
          title: otherRunningSessionCount === 1 ? localize("server.runningInOneOtherSession", "(Running in 1 session)") : localize("server.runningInOtherSessions", "(Running in {0} sessions)", otherRunningSessionCount)
        }
      });
    }
    if (server.status !== McpServerStatus.Error) {
      lenses.push({
        range,
        command: {
          id: McpCommandIds.AgentHostServerOptions,
          title: localize("mcp.server.more", "More..."),
          arguments: [agentHostSession, server.id]
        }
      });
    }
  }
  _getOtherRunningAgentHostMcpServerCounts(agentHostSession) {
    const sessionServers = [];
    for (const connectionInfo of this._agentHostConnectionsService.connections) {
      const connection = connectionInfo.connection;
      if (!connection) {
        continue;
      }
      for (const subscription of connection.getActiveSubscriptions()) {
        if (subscription.kind !== StateComponents.Session) {
          continue;
        }
        const state = connection.getSubscriptionUnmanaged(StateComponents.Session, subscription.resource)?.value;
        const resource = this._toAgentHostSessionResource(connectionInfo, subscription.resource);
        if (!resource || !state || state instanceof Error) {
          continue;
        }
        sessionServers.push({ resource, servers: this._getMcpServersFromSessionState(state) });
      }
    }
    return countRunningMcpServersInOtherSessions(agentHostSession, sessionServers);
  }
  _toAgentHostSessionResource(connectionInfo, backendSession) {
    const provider = AgentSession.provider(backendSession);
    if (!provider) {
      return void 0;
    }
    const scheme = connectionInfo.isAmbient ? `${LOCAL_AGENT_HOST_SCHEME_PREFIX}${provider}` : remoteAgentHostSessionTypeId(connectionInfo.authority, provider);
    return URI.from({ scheme, path: backendSession.path });
  }
  _getMcpServersFromSessionState(state) {
    const servers = [];
    const collect = (customizations) => {
      for (const customization of customizations ?? []) {
        if (customization.type === CustomizationType.McpServer) {
          servers.push({
            name: customization.name,
            enabled: customization.enabled,
            status: customization.state.kind
          });
        } else if (customization.type === CustomizationType.Directory || customization.type === CustomizationType.Plugin) {
          collect(customization.children);
        }
      }
    };
    collect(state.customizations);
    return servers;
  }
  async _provideInlayHints(model, range) {
    const parsed = await this._parseModel(model);
    if (!parsed) {
      return void 0;
    }
    const { tree, inConfig } = parsed;
    const mcpSection = inConfig.section ? findNodeAtLocation(tree, [...inConfig.section]) : tree;
    if (!mcpSection) {
      return void 0;
    }
    const inputsNode = findNodeAtLocation(mcpSection, ["inputs"]);
    if (!inputsNode) {
      return void 0;
    }
    const inputs = await this._mcpRegistry.getSavedInputs(inConfig.scope);
    const hints = [];
    const serversNode = findNodeAtLocation(mcpSection, [inConfig.serversKey ?? "servers"]);
    if (serversNode) {
      annotateServers(serversNode);
    }
    annotateInputs(inputsNode);
    return { hints, dispose: () => {
    } };
    function annotateServers(servers) {
      forEachPropertyWithReplacement(servers, (node) => {
        const expr = ConfigurationResolverExpression.parse(node.value);
        for (const { id } of expr.unresolved()) {
          const saved = inputs[id];
          if (saved) {
            pushAnnotation(id, node.offset + node.value.indexOf(id) + id.length, saved);
          }
        }
      });
    }
    function annotateInputs(node) {
      if (node.type !== "array" || !node.children) {
        return;
      }
      for (const input of node.children) {
        if (input.type !== "object" || !input.children) {
          continue;
        }
        const idProp = input.children.find((c) => c.type === "property" && c.children?.[0].value === "id");
        if (!idProp) {
          continue;
        }
        const id = idProp.children[1];
        if (!id || id.type !== "string" || !id.value) {
          continue;
        }
        const savedId = "${input:" + id.value + "}";
        const saved = inputs[savedId];
        if (saved) {
          pushAnnotation(savedId, id.offset + 1 + id.length, saved);
        }
      }
    }
    function pushAnnotation(savedId, offset, saved) {
      const tooltip = new MarkdownString([
        createMarkdownCommandLink({ id: McpCommandIds.EditStoredInput, text: localize("edit", "Edit"), arguments: [savedId, model.uri, mcpConfigurationSection, inConfig.target], tooltip: localize("edit.savedValue.tooltip", "Edit saved value") }),
        createMarkdownCommandLink({ id: McpCommandIds.RemoveStoredInput, text: localize("clear", "Clear"), arguments: [inConfig.scope, savedId], tooltip: localize("clear.savedValue.tooltip", "Clear saved value") }),
        createMarkdownCommandLink({ id: McpCommandIds.RemoveStoredInput, text: localize("clearAll", "Clear All"), arguments: [inConfig.scope], tooltip: localize("clearAll.savedValues.tooltip", "Clear all saved values") })
      ].join(" | "), { isTrusted: true });
      const hint = {
        label: "= " + (saved.input?.type === "promptString" && saved.input.password ? "*".repeat(10) : saved.value || ""),
        position: model.getPositionAt(offset),
        tooltip,
        paddingLeft: true
      };
      hints.push(hint);
      return hint;
    }
  }
};
McpLanguageFeatures = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, IMcpWorkbenchService),
  __decorateParam(3, IMcpService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, IAgentHostCustomizationService),
  __decorateParam(6, IAgentHostConnectionsService),
  __decorateParam(7, IMarkerService),
  __decorateParam(8, IConfigurationResolverService),
  __decorateParam(9, ISecretStorageService)
], McpLanguageFeatures);
function forEachPropertyWithReplacement(node, callback) {
  if (node.type === "string" && typeof node.value === "string" && node.value.includes(ConfigurationResolverExpression.VARIABLE_LHS)) {
    callback(node);
  } else if (node.type === "property") {
    node.children?.slice(1).forEach((n) => forEachPropertyWithReplacement(n, callback));
  } else {
    node.children?.forEach((n) => forEachPropertyWithReplacement(n, callback));
  }
}
export {
  McpLanguageFeatures
};
