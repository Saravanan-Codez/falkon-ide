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
import { equals as arraysEqual } from "../../../../base/common/arrays.js";
import { assertNever } from "../../../../base/common/assert.js";
import { decodeHex, encodeHex, VSBuffer } from "../../../../base/common/buffer.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { equals as objectsEqual } from "../../../../base/common/objects.js";
import { ObservableMap } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { McpGalleryManifestStatus } from "../../../../platform/mcp/common/mcpGalleryManifest.js";
import { WORKSPACE_FOLDER_CONFIG_ID_PREFIX } from "../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { MCP } from "./modelContextProtocol.js";
const extensionMcpCollectionPrefix = "ext.";
const MCP_CONFIGURATION_COLLECTION_ID_PREFIX = "mcp.config.";
const MCP_PLUGIN_COLLECTION_ID_PREFIX = "plugin.";
var McpCollectionProvenance = /* @__PURE__ */ ((McpCollectionProvenance2) => {
  McpCollectionProvenance2["Plugin"] = "plugin";
  return McpCollectionProvenance2;
})(McpCollectionProvenance || {});
const WORKSPACE_DOT_MCP_COLLECTION_ID_PREFIX = "workspace-dot-mcp.";
function extensionPrefixedIdentifier(identifier, id) {
  return ExtensionIdentifier.toKey(identifier) + "/" + id;
}
var McpCollectionSortOrder = /* @__PURE__ */ ((McpCollectionSortOrder2) => {
  McpCollectionSortOrder2[McpCollectionSortOrder2["WorkspaceFolder"] = 0] = "WorkspaceFolder";
  McpCollectionSortOrder2[McpCollectionSortOrder2["Workspace"] = 100] = "Workspace";
  McpCollectionSortOrder2[McpCollectionSortOrder2["User"] = 200] = "User";
  McpCollectionSortOrder2[McpCollectionSortOrder2["Extension"] = 300] = "Extension";
  McpCollectionSortOrder2[McpCollectionSortOrder2["Plugin"] = 350] = "Plugin";
  McpCollectionSortOrder2[McpCollectionSortOrder2["Filesystem"] = 400] = "Filesystem";
  McpCollectionSortOrder2[McpCollectionSortOrder2["RemoteBoost"] = -50] = "RemoteBoost";
  return McpCollectionSortOrder2;
})(McpCollectionSortOrder || {});
var McpCollectionDefinition;
((McpCollectionDefinition2) => {
  function equals(a, b) {
    return a.id === b.id && a.remoteAuthority === b.remoteAuthority && a.label === b.label && a.trustBehavior === b.trustBehavior && objectsEqual(a.sandbox, b.sandbox);
  }
  McpCollectionDefinition2.equals = equals;
  function isWorkspaceDiscovered(collection) {
    return collection.configTarget === ConfigurationTarget.WORKSPACE || collection.configTarget === ConfigurationTarget.WORKSPACE_FOLDER;
  }
  McpCollectionDefinition2.isWorkspaceDiscovered = isWorkspaceDiscovered;
  function isVscodeMcpJson(collection) {
    return collection.id.startsWith(`${MCP_CONFIGURATION_COLLECTION_ID_PREFIX}${WORKSPACE_FOLDER_CONFIG_ID_PREFIX}`);
  }
  McpCollectionDefinition2.isVscodeMcpJson = isVscodeMcpJson;
  function isWorkspaceDotMcpJson(collection) {
    return collection.id.startsWith(WORKSPACE_DOT_MCP_COLLECTION_ID_PREFIX);
  }
  McpCollectionDefinition2.isWorkspaceDotMcpJson = isWorkspaceDotMcpJson;
})(McpCollectionDefinition || (McpCollectionDefinition = {}));
var McpServerStaticToolAvailability = /* @__PURE__ */ ((McpServerStaticToolAvailability2) => {
  McpServerStaticToolAvailability2[McpServerStaticToolAvailability2["Initial"] = 0] = "Initial";
  McpServerStaticToolAvailability2[McpServerStaticToolAvailability2["Dynamic"] = 1] = "Dynamic";
  return McpServerStaticToolAvailability2;
})(McpServerStaticToolAvailability || {});
var McpServerDefinition;
((McpServerDefinition2) => {
  function toSerialized(def) {
    return def;
  }
  McpServerDefinition2.toSerialized = toSerialized;
  function fromSerialized(def) {
    return {
      id: def.id,
      label: def.label,
      cacheNonce: def.cacheNonce,
      staticMetadata: def.staticMetadata,
      launch: McpServerLaunch.fromSerialized(def.launch),
      sandboxEnabled: def.sandboxEnabled,
      variableReplacement: def.variableReplacement ? McpServerDefinitionVariableReplacement.fromSerialized(def.variableReplacement) : void 0
    };
  }
  McpServerDefinition2.fromSerialized = fromSerialized;
  function equals(a, b) {
    return a.id === b.id && a.label === b.label && a.cacheNonce === b.cacheNonce && arraysEqual(a.roots, b.roots, (a2, b2) => a2.toString() === b2.toString()) && objectsEqual(a.launch, b.launch) && objectsEqual(a.presentation, b.presentation) && objectsEqual(a.variableReplacement, b.variableReplacement) && objectsEqual(a.devMode, b.devMode) && a.sandboxEnabled === b.sandboxEnabled;
  }
  McpServerDefinition2.equals = equals;
})(McpServerDefinition || (McpServerDefinition = {}));
var McpServerDefinitionVariableReplacement;
((McpServerDefinitionVariableReplacement2) => {
  function toSerialized(def) {
    return def;
  }
  McpServerDefinitionVariableReplacement2.toSerialized = toSerialized;
  function fromSerialized(def) {
    return {
      section: def.section,
      folder: def.folder ? { ...def.folder, uri: URI.revive(def.folder.uri) } : void 0,
      target: def.target
    };
  }
  McpServerDefinitionVariableReplacement2.fromSerialized = fromSerialized;
})(McpServerDefinitionVariableReplacement || (McpServerDefinitionVariableReplacement = {}));
var IAutostartResult;
((IAutostartResult2) => {
  IAutostartResult2.Empty = { working: false, starting: [], serversRequiringInteraction: [] };
})(IAutostartResult || (IAutostartResult = {}));
var LazyCollectionState = /* @__PURE__ */ ((LazyCollectionState2) => {
  LazyCollectionState2[LazyCollectionState2["HasUnknown"] = 0] = "HasUnknown";
  LazyCollectionState2[LazyCollectionState2["LoadingUnknown"] = 1] = "LoadingUnknown";
  LazyCollectionState2[LazyCollectionState2["AllKnown"] = 2] = "AllKnown";
  return LazyCollectionState2;
})(LazyCollectionState || {});
const IMcpService = createDecorator("IMcpService");
class McpStartServerInteraction {
  constructor() {
    /** @internal */
    this.participants = new ObservableMap();
  }
}
var McpServerTrust;
((McpServerTrust2) => {
  let Kind;
  ((Kind2) => {
    Kind2[Kind2["Trusted"] = 0] = "Trusted";
    Kind2[Kind2["TrustedOnNonce"] = 1] = "TrustedOnNonce";
    Kind2[Kind2["Untrusted"] = 2] = "Untrusted";
    Kind2[Kind2["Unknown"] = 3] = "Unknown";
  })(Kind = McpServerTrust2.Kind || (McpServerTrust2.Kind = {}));
})(McpServerTrust || (McpServerTrust = {}));
const isMcpResourceTemplate = (obj) => {
  return obj.template !== void 0;
};
const isMcpResource = (obj) => {
  return obj.mcpUri !== void 0;
};
var McpServerCacheState = /* @__PURE__ */ ((McpServerCacheState2) => {
  McpServerCacheState2[McpServerCacheState2["Unknown"] = 0] = "Unknown";
  McpServerCacheState2[McpServerCacheState2["Cached"] = 1] = "Cached";
  McpServerCacheState2[McpServerCacheState2["Outdated"] = 2] = "Outdated";
  McpServerCacheState2[McpServerCacheState2["RefreshingFromUnknown"] = 3] = "RefreshingFromUnknown";
  McpServerCacheState2[McpServerCacheState2["RefreshingFromCached"] = 4] = "RefreshingFromCached";
  McpServerCacheState2[McpServerCacheState2["Live"] = 5] = "Live";
  return McpServerCacheState2;
})(McpServerCacheState || {});
const mcpPromptReplaceSpecialChars = (s) => s.replace(/[^a-z0-9_.-]/gi, "_");
const mcpPromptPrefix = (definition) => `/mcp.` + mcpPromptReplaceSpecialChars(definition.label);
var McpToolVisibility = /* @__PURE__ */ ((McpToolVisibility2) => {
  McpToolVisibility2[McpToolVisibility2["Model"] = 1] = "Model";
  McpToolVisibility2[McpToolVisibility2["App"] = 2] = "App";
  return McpToolVisibility2;
})(McpToolVisibility || {});
var McpServerTransportType = /* @__PURE__ */ ((McpServerTransportType2) => {
  McpServerTransportType2[McpServerTransportType2["Stdio"] = 1] = "Stdio";
  McpServerTransportType2[McpServerTransportType2["HTTP"] = 2] = "HTTP";
  return McpServerTransportType2;
})(McpServerTransportType || {});
function mcpOAuthClientSecretStorageKey(mcpServerUrl, clientId) {
  return `mcp.oauth.clientSecret:${mcpServerUrl}:${clientId}`;
}
var McpServerLaunch;
((McpServerLaunch2) => {
  function toSerialized(launch) {
    return launch;
  }
  McpServerLaunch2.toSerialized = toSerialized;
  function fromSerialized(launch) {
    switch (launch.type) {
      case 2 /* HTTP */:
        return { type: launch.type, uri: URI.revive(launch.uri), headers: launch.headers, oauth: launch.oauth, authentication: launch.authentication };
      case 1 /* Stdio */:
        return {
          type: launch.type,
          cwd: launch.cwd,
          command: launch.command,
          args: launch.args,
          env: launch.env,
          envFile: launch.envFile,
          sandbox: launch.sandbox
        };
    }
  }
  McpServerLaunch2.fromSerialized = fromSerialized;
  async function hash(launch) {
    const nonce = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(launch)));
    return encodeHex(VSBuffer.wrap(new Uint8Array(nonce)));
  }
  McpServerLaunch2.hash = hash;
})(McpServerLaunch || (McpServerLaunch = {}));
var McpConnectionState;
((McpConnectionState2) => {
  let Kind;
  ((Kind2) => {
    Kind2[Kind2["Stopped"] = 0] = "Stopped";
    Kind2[Kind2["Starting"] = 1] = "Starting";
    Kind2[Kind2["Running"] = 2] = "Running";
    Kind2[Kind2["Error"] = 3] = "Error";
  })(Kind = McpConnectionState2.Kind || (McpConnectionState2.Kind = {}));
  McpConnectionState2.toString = (s) => {
    switch (s.state) {
      case 0 /* Stopped */:
        return localize("mcpstate.stopped", "Stopped");
      case 1 /* Starting */:
        return localize("mcpstate.starting", "Starting");
      case 2 /* Running */:
        return localize("mcpstate.running", "Running");
      case 3 /* Error */:
        return localize("mcpstate.error", "Error {0}", s.message);
      default:
        assertNever(s);
    }
  };
  McpConnectionState2.toKindString = (s) => {
    switch (s) {
      case 0 /* Stopped */:
        return "stopped";
      case 1 /* Starting */:
        return "starting";
      case 2 /* Running */:
        return "running";
      case 3 /* Error */:
        return "error";
      default:
        assertNever(s);
    }
  };
  McpConnectionState2.canBeStarted = (s) => s === 3 /* Error */ || s === 0 /* Stopped */;
  McpConnectionState2.isRunning = (s) => !(0, McpConnectionState2.canBeStarted)(s.state);
})(McpConnectionState || (McpConnectionState = {}));
class MpcResponseError extends Error {
  constructor(message, code, data) {
    super(`MPC ${code}: ${message}`);
    this.code = code;
    this.data = data;
  }
}
class McpConnectionFailedError extends Error {
}
class UserInteractionRequiredError extends Error {
  constructor(reason) {
    super(`${UserInteractionRequiredError.prefix}${reason}`);
    this.reason = reason;
  }
  static {
    this.prefix = "User interaction required: ";
  }
  static is(error) {
    return error.message.startsWith(this.prefix);
  }
}
var McpServerEnablementState = /* @__PURE__ */ ((McpServerEnablementState2) => {
  McpServerEnablementState2[McpServerEnablementState2["Disabled"] = 0] = "Disabled";
  McpServerEnablementState2[McpServerEnablementState2["DisabledByAccess"] = 1] = "DisabledByAccess";
  McpServerEnablementState2[McpServerEnablementState2["DisabledProfile"] = 2] = "DisabledProfile";
  McpServerEnablementState2[McpServerEnablementState2["DisabledWorkspace"] = 3] = "DisabledWorkspace";
  McpServerEnablementState2[McpServerEnablementState2["Enabled"] = 4] = "Enabled";
  return McpServerEnablementState2;
})(McpServerEnablementState || {});
var McpServerInstallState = /* @__PURE__ */ ((McpServerInstallState2) => {
  McpServerInstallState2[McpServerInstallState2["Installing"] = 0] = "Installing";
  McpServerInstallState2[McpServerInstallState2["Installed"] = 1] = "Installed";
  McpServerInstallState2[McpServerInstallState2["Uninstalling"] = 2] = "Uninstalling";
  McpServerInstallState2[McpServerInstallState2["Uninstalled"] = 3] = "Uninstalled";
  return McpServerInstallState2;
})(McpServerInstallState || {});
var McpServerEditorTab = /* @__PURE__ */ ((McpServerEditorTab2) => {
  McpServerEditorTab2["Readme"] = "readme";
  McpServerEditorTab2["Manifest"] = "manifest";
  McpServerEditorTab2["Configuration"] = "configuration";
  return McpServerEditorTab2;
})(McpServerEditorTab || {});
const IMcpWorkbenchService = createDecorator("IMcpWorkbenchService");
let McpServerContainers = class extends Disposable {
  constructor(containers, mcpWorkbenchService) {
    super();
    this.containers = containers;
    this._register(mcpWorkbenchService.onChange(this.update, this));
  }
  set mcpServer(extension) {
    this.containers.forEach((c) => c.mcpServer = extension);
  }
  update(server) {
    for (const container of this.containers) {
      if (server && container.mcpServer) {
        if (server.id === container.mcpServer.id) {
          container.mcpServer = server;
        }
      } else {
        container.update();
      }
    }
  }
};
McpServerContainers = __decorateClass([
  __decorateParam(1, IMcpWorkbenchService)
], McpServerContainers);
const McpServersGalleryStatusContext = new RawContextKey("mcpServersGalleryStatus", McpGalleryManifestStatus.Unavailable);
const HasInstalledMcpServersContext = new RawContextKey("hasInstalledMcpServers", true);
const InstalledMcpServersViewId = "workbench.views.mcp.installed";
var McpResourceURI;
((McpResourceURI2) => {
  McpResourceURI2.scheme = "mcp-resource";
  const emptyAuthorityPlaceholder = "dylo78gyp";
  function fromServer(def, resourceURI) {
    if (typeof resourceURI === "string") {
      resourceURI = URI.parse(resourceURI);
    }
    return resourceURI.with({
      scheme: McpResourceURI2.scheme,
      authority: encodeHex(VSBuffer.fromString(def.id)),
      path: ["", resourceURI.scheme, resourceURI.authority || emptyAuthorityPlaceholder].join("/") + resourceURI.path
    });
  }
  McpResourceURI2.fromServer = fromServer;
  function toServer(uri) {
    if (typeof uri === "string") {
      uri = URI.parse(uri);
    }
    if (uri.scheme !== McpResourceURI2.scheme) {
      throw new Error(`Invalid MCP resource URI: ${uri.toString()}`);
    }
    const parts = uri.path.split("/");
    if (parts.length < 3) {
      throw new Error(`Invalid MCP resource URI: ${uri.toString()}`);
    }
    const [, serverScheme, authority, ...path] = parts;
    const url = new URL(`${serverScheme}://${authority.toLowerCase() === emptyAuthorityPlaceholder ? "" : authority}`);
    url.pathname = path.length ? "/" + path.join("/") : "";
    url.search = uri.query;
    url.hash = uri.fragment;
    return {
      definitionId: decodeHex(uri.authority).toString(),
      resourceURL: url
    };
  }
  McpResourceURI2.toServer = toServer;
})(McpResourceURI || (McpResourceURI = {}));
var McpCapability = /* @__PURE__ */ ((McpCapability2) => {
  McpCapability2[McpCapability2["Logging"] = 1] = "Logging";
  McpCapability2[McpCapability2["Completions"] = 2] = "Completions";
  McpCapability2[McpCapability2["Prompts"] = 4] = "Prompts";
  McpCapability2[McpCapability2["PromptsListChanged"] = 8] = "PromptsListChanged";
  McpCapability2[McpCapability2["Resources"] = 16] = "Resources";
  McpCapability2[McpCapability2["ResourcesSubscribe"] = 32] = "ResourcesSubscribe";
  McpCapability2[McpCapability2["ResourcesListChanged"] = 64] = "ResourcesListChanged";
  McpCapability2[McpCapability2["Tools"] = 128] = "Tools";
  McpCapability2[McpCapability2["ToolsListChanged"] = 256] = "ToolsListChanged";
  return McpCapability2;
})(McpCapability || {});
const IMcpSamplingService = createDecorator("IMcpServerSampling");
class McpError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
  static methodNotFound(method) {
    return new McpError(MCP.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
  static notAllowed() {
    return new McpError(-32e3, "The user has denied permission to call this method.");
  }
  static unknown(e) {
    const mcpError = new McpError(MCP.INTERNAL_ERROR, `Unknown error: ${e.stack}`);
    mcpError.cause = e;
    return mcpError;
  }
}
var McpToolName = /* @__PURE__ */ ((McpToolName2) => {
  McpToolName2["Prefix"] = "mcp_";
  McpToolName2[McpToolName2["MaxPrefixLen"] = 18] = "MaxPrefixLen";
  McpToolName2[McpToolName2["MaxLength"] = 64] = "MaxLength";
  return McpToolName2;
})(McpToolName || {});
var ElicitationKind = /* @__PURE__ */ ((ElicitationKind2) => {
  ElicitationKind2[ElicitationKind2["Form"] = 0] = "Form";
  ElicitationKind2[ElicitationKind2["URL"] = 1] = "URL";
  return ElicitationKind2;
})(ElicitationKind || {});
const IMcpElicitationService = createDecorator("IMcpElicitationService");
const McpToolResourceLinkMimeType = "application/vnd.code.resource-link";
export {
  ElicitationKind,
  HasInstalledMcpServersContext,
  IAutostartResult,
  IMcpElicitationService,
  IMcpSamplingService,
  IMcpService,
  IMcpWorkbenchService,
  InstalledMcpServersViewId,
  LazyCollectionState,
  MCP_CONFIGURATION_COLLECTION_ID_PREFIX,
  MCP_PLUGIN_COLLECTION_ID_PREFIX,
  McpCapability,
  McpCollectionDefinition,
  McpCollectionProvenance,
  McpCollectionSortOrder,
  McpConnectionFailedError,
  McpConnectionState,
  McpError,
  McpResourceURI,
  McpServerCacheState,
  McpServerContainers,
  McpServerDefinition,
  McpServerDefinitionVariableReplacement,
  McpServerEditorTab,
  McpServerEnablementState,
  McpServerInstallState,
  McpServerLaunch,
  McpServerStaticToolAvailability,
  McpServerTransportType,
  McpServerTrust,
  McpServersGalleryStatusContext,
  McpStartServerInteraction,
  McpToolName,
  McpToolResourceLinkMimeType,
  McpToolVisibility,
  MpcResponseError,
  UserInteractionRequiredError,
  WORKSPACE_DOT_MCP_COLLECTION_ID_PREFIX,
  extensionMcpCollectionPrefix,
  extensionPrefixedIdentifier,
  isMcpResource,
  isMcpResourceTemplate,
  mcpOAuthClientSecretStorageKey,
  mcpPromptPrefix,
  mcpPromptReplaceSpecialChars
};
