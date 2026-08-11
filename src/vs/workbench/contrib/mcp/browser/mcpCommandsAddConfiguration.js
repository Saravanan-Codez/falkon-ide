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
import { mapFindFirst } from "../../../../base/common/arraysFind.js";
import { assertNever } from "../../../../base/common/assert.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { parse as parseJsonc } from "../../../../base/common/jsonc.js";
import { mnemonicButtonLabel } from "../../../../base/common/labels.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { autorun } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { McpServerType } from "../../../../platform/mcp/common/mcpPlatformTypes.js";
import { RegistryType } from "../../../../platform/mcp/common/mcpManagement.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isWorkspaceFolder, IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IWorkbenchMcpManagementService } from "../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { IAgentHostCustomizationService } from "../../chat/browser/agentSessions/agentHost/agentHostCustomizationService.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { isAgentHostTarget } from "../../chat/common/chatSessionsService.js";
import { getChatSessionType } from "../../chat/common/model/chatUri.js";
import { McpCommandIds } from "../common/mcpCommandIds.js";
import { allDiscoverySources, mcpDiscoverySection, mcpStdioServerSchema } from "../common/mcpConfiguration.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
import { IMcpService, McpConnectionState } from "../common/mcpTypes.js";
import { ILogService } from "../../../../platform/log/common/log.js";
var AddConfigurationType = /* @__PURE__ */ ((AddConfigurationType2) => {
  AddConfigurationType2[AddConfigurationType2["Stdio"] = 0] = "Stdio";
  AddConfigurationType2[AddConfigurationType2["HTTP"] = 1] = "HTTP";
  AddConfigurationType2[AddConfigurationType2["NpmPackage"] = 2] = "NpmPackage";
  AddConfigurationType2[AddConfigurationType2["PipPackage"] = 3] = "PipPackage";
  AddConfigurationType2[AddConfigurationType2["NuGetPackage"] = 4] = "NuGetPackage";
  AddConfigurationType2[AddConfigurationType2["DockerImage"] = 5] = "DockerImage";
  return AddConfigurationType2;
})(AddConfigurationType || {});
const AssistedTypes = {
  [2 /* NpmPackage */]: {
    title: localize("mcp.npm.title", "Enter NPM Package Name"),
    placeholder: localize("mcp.npm.placeholder", "Package name (e.g., @org/package)"),
    pickLabel: localize("mcp.serverType.npm", "NPM Package"),
    pickDescription: localize("mcp.serverType.npm.description", "Install from an NPM package name"),
    enabledConfigKey: null
    // always enabled
  },
  [3 /* PipPackage */]: {
    title: localize("mcp.pip.title", "Enter Pip Package Name"),
    placeholder: localize("mcp.pip.placeholder", "Package name (e.g., package-name)"),
    pickLabel: localize("mcp.serverType.pip", "Pip Package"),
    pickDescription: localize("mcp.serverType.pip.description", "Install from a Pip package name"),
    enabledConfigKey: null
    // always enabled
  },
  [4 /* NuGetPackage */]: {
    title: localize("mcp.nuget.title", "Enter NuGet Package Name"),
    placeholder: localize("mcp.nuget.placeholder", "Package name (e.g., Package.Name)"),
    pickLabel: localize("mcp.serverType.nuget", "NuGet Package"),
    pickDescription: localize("mcp.serverType.nuget.description", "Install from a NuGet package name"),
    enabledConfigKey: "chat.mcp.assisted.nuget.enabled"
  },
  [5 /* DockerImage */]: {
    title: localize("mcp.docker.title", "Enter Docker Image Name"),
    placeholder: localize("mcp.docker.placeholder", "Image name (e.g., mcp/imagename)"),
    pickLabel: localize("mcp.serverType.docker", "Docker Image"),
    pickDescription: localize("mcp.serverType.docker.description", "Install from a Docker image"),
    enabledConfigKey: null
    // always enabled
  }
};
var AddConfigurationCopilotCommand = /* @__PURE__ */ ((AddConfigurationCopilotCommand2) => {
  AddConfigurationCopilotCommand2["IsSupported"] = "github.copilot.chat.mcp.setup.check";
  AddConfigurationCopilotCommand2["ValidatePackage"] = "github.copilot.chat.mcp.setup.validatePackage";
  AddConfigurationCopilotCommand2["StartFlow"] = "github.copilot.chat.mcp.setup.flow";
  return AddConfigurationCopilotCommand2;
})(AddConfigurationCopilotCommand || {});
let McpAddConfigurationCommand = class {
  constructor(workspaceFolder, _quickInputService, _mcpManagementService, _workspaceService, _environmentService, _commandService, _mcpRegistry, _openerService, _editorService, _fileService, _notificationService, _telemetryService, _mcpService, _label, _configurationService, _agentHostCustomizations, _chatWidgetService) {
    this.workspaceFolder = workspaceFolder;
    this._quickInputService = _quickInputService;
    this._mcpManagementService = _mcpManagementService;
    this._workspaceService = _workspaceService;
    this._environmentService = _environmentService;
    this._commandService = _commandService;
    this._mcpRegistry = _mcpRegistry;
    this._openerService = _openerService;
    this._editorService = _editorService;
    this._fileService = _fileService;
    this._notificationService = _notificationService;
    this._telemetryService = _telemetryService;
    this._mcpService = _mcpService;
    this._label = _label;
    this._configurationService = _configurationService;
    this._agentHostCustomizations = _agentHostCustomizations;
    this._chatWidgetService = _chatWidgetService;
  }
  async getServerType() {
    const items = [
      { kind: 0 /* Stdio */, label: localize("mcp.serverType.command", "Command (stdio)"), description: localize("mcp.serverType.command.description", "Run a local command that implements the MCP protocol") },
      { kind: 1 /* HTTP */, label: localize("mcp.serverType.http", "HTTP (HTTP or Server-Sent Events)"), description: localize("mcp.serverType.http.description", "Connect to a remote HTTP server that implements the MCP protocol") }
    ];
    let aiSupported;
    try {
      aiSupported = await this._commandService.executeCommand("github.copilot.chat.mcp.setup.check" /* IsSupported */);
    } catch {
    }
    if (aiSupported) {
      items.unshift({ type: "separator", label: localize("mcp.serverType.manual", "Manual Install") });
      const elligableTypes = Object.entries(AssistedTypes).map(([type, { pickLabel, pickDescription, enabledConfigKey }]) => {
        if (enabledConfigKey) {
          const enabled = this._configurationService.getValue(enabledConfigKey) ?? false;
          if (!enabled) {
            return;
          }
        }
        return {
          kind: Number(type),
          label: pickLabel,
          description: pickDescription
        };
      }).filter((x) => !!x);
      items.push(
        { type: "separator", label: localize("mcp.serverType.copilot", "Model-Assisted") },
        ...elligableTypes
      );
    }
    items.push({ type: "separator" });
    const discovery = this._configurationService.getValue(mcpDiscoverySection);
    if (discovery && typeof discovery === "object" && allDiscoverySources.some((d) => !discovery[d])) {
      items.push({
        kind: "discovery",
        label: localize("mcp.servers.discovery", "Add from another application...")
      });
    }
    items.push({
      kind: "browse",
      label: localize("mcp.servers.browse", "Browse MCP Servers...")
    });
    const result = await this._quickInputService.pick(items, {
      placeHolder: localize("mcp.serverType.placeholder", "Choose the type of MCP server to add")
    });
    if (result?.kind === "browse") {
      this._commandService.executeCommand(McpCommandIds.Browse);
      return void 0;
    }
    if (result?.kind === "discovery") {
      this._commandService.executeCommand("workbench.action.openSettings", mcpDiscoverySection);
      return void 0;
    }
    return result?.kind;
  }
  async getStdioConfig() {
    const command = await this._quickInputService.input({
      title: localize("mcp.command.title", "Enter Command"),
      placeHolder: localize("mcp.command.placeholder", "Command to run (with optional arguments)"),
      ignoreFocusLost: true
    });
    if (!command) {
      return void 0;
    }
    this._telemetryService.publicLog2("mcp.addserver", {
      packageType: "stdio"
    });
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g);
    return {
      type: McpServerType.LOCAL,
      command: parts[0].replace(/"/g, ""),
      args: parts.slice(1).map((arg) => arg.replace(/"/g, ""))
    };
  }
  async getSSEConfig() {
    const url = await this._quickInputService.input({
      title: localize("mcp.url.title", "Enter Server URL"),
      placeHolder: localize("mcp.url.placeholder", "URL of the MCP server (e.g., http://localhost:3000)"),
      ignoreFocusLost: true
    });
    if (!url) {
      return void 0;
    }
    this._telemetryService.publicLog2("mcp.addserver", {
      packageType: "sse"
    });
    return { url, type: McpServerType.REMOTE };
  }
  async getServerId(suggestion = `my-mcp-server-${generateUuid().split("-")[0]}`) {
    const id = await this._quickInputService.input({
      title: localize("mcp.serverId.title", "Enter Server ID"),
      placeHolder: localize("mcp.serverId.placeholder", "Unique identifier for this server"),
      value: suggestion,
      ignoreFocusLost: true
    });
    return id;
  }
  async getConfigurationTarget() {
    const options = [
      { target: ConfigurationTarget.USER_LOCAL, label: localize("mcp.target.user", "Global"), description: localize("mcp.target.user.description", "Available in all workspaces, runs locally") }
    ];
    const raLabel = this._environmentService.remoteAuthority && this._label.getHostLabel(Schemas.vscodeRemote, this._environmentService.remoteAuthority);
    if (raLabel) {
      options.push({ target: ConfigurationTarget.USER_REMOTE, label: localize("mcp.target.remote", "Remote"), description: localize("mcp.target..remote.description", "Available on this remote machine, runs on {0}", raLabel) });
    }
    const workbenchState = this._workspaceService.getWorkbenchState();
    if (workbenchState !== WorkbenchState.EMPTY) {
      const target = workbenchState === WorkbenchState.FOLDER ? this._workspaceService.getWorkspace().folders[0] : ConfigurationTarget.WORKSPACE;
      if (this._environmentService.remoteAuthority) {
        options.push({ target, label: localize("mcp.target.workspace", "Workspace"), description: localize("mcp.target.workspace.description.remote", "Available in this workspace, runs on {0}", raLabel) });
      } else {
        options.push({ target, label: localize("mcp.target.workspace", "Workspace"), description: localize("mcp.target.workspace.description", "Available in this workspace, runs locally") });
      }
    }
    if (options.length === 1) {
      return options[0].target;
    }
    const targetPick = await this._quickInputService.pick(options, {
      title: localize("mcp.target.title", "Add MCP Server"),
      placeHolder: localize("mcp.target.placeholder", "Select the configuration target")
    });
    return targetPick?.target;
  }
  async getInstallTarget() {
    const session = this._chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource;
    const hasAgentHostSession = !!session && isAgentHostTarget(getChatSessionType(session));
    if (this.workspaceFolder) {
      return { kind: "local", target: this.workspaceFolder };
    }
    if (session && hasAgentHostSession) {
      const AGENT_HOST_ID = "$agentHost";
      const LOCAL_ID = "$local";
      const items = [
        {
          id: AGENT_HOST_ID,
          label: localize("mcp.target.agentHost", "Add to Current Agent Session"),
          alwaysShow: true
        },
        { type: "separator" },
        {
          id: LOCAL_ID,
          label: localize("mcp.target.local", "Install Server Locally..."),
          iconClass: ThemeIcon.asClassName(Codicon.arrowLeft),
          alwaysShow: true
        }
      ];
      const targetPick = await this._quickInputService.pick(items, {
        title: localize("mcp.target.title", "Add MCP Server"),
        placeHolder: localize("mcp.target.placeholder", "Select the configuration target")
      });
      if (!targetPick) {
        return void 0;
      }
      if (targetPick.id === AGENT_HOST_ID) {
        return { kind: "agentHost", session };
      }
      const target2 = await this.getConfigurationTarget();
      return target2 ? { kind: "local", target: target2 } : void 0;
    }
    const target = await this.getConfigurationTarget();
    return target ? { kind: "local", target } : void 0;
  }
  async getAssistedConfig(type) {
    const packageName = await this._quickInputService.input({
      ignoreFocusLost: true,
      title: AssistedTypes[type].title,
      placeHolder: AssistedTypes[type].placeholder
    });
    if (!packageName) {
      return void 0;
    }
    let LoadAction;
    ((LoadAction2) => {
      LoadAction2["Retry"] = "retry";
      LoadAction2["Cancel"] = "cancel";
      LoadAction2["Allow"] = "allow";
      LoadAction2["OpenUri"] = "openUri";
    })(LoadAction || (LoadAction = {}));
    const loadingQuickPickStore = new DisposableStore();
    const loadingQuickPick = loadingQuickPickStore.add(this._quickInputService.createQuickPick());
    loadingQuickPick.title = localize("mcp.loading.title", "Loading package details...");
    loadingQuickPick.busy = true;
    loadingQuickPick.ignoreFocusOut = true;
    const packageType = this.getPackageType(type);
    this._telemetryService.publicLog2("mcp.addserver", {
      packageType
    });
    this._commandService.executeCommand(
      "github.copilot.chat.mcp.setup.validatePackage" /* ValidatePackage */,
      {
        type: packageType,
        name: packageName,
        targetConfig: {
          ...mcpStdioServerSchema,
          properties: {
            ...mcpStdioServerSchema.properties,
            name: {
              type: "string",
              description: "Suggested name of the server, alphanumeric and hyphen only"
            }
          },
          required: [...mcpStdioServerSchema.required || [], "name"]
        }
      }
    ).then((result) => {
      if (!result || result.state === "error") {
        loadingQuickPick.title = result?.error || "Unknown error loading package";
        const items = [];
        if (result?.helpUri) {
          items.push({
            id: "openUri" /* OpenUri */,
            label: result.helpUriLabel ?? localize("mcp.error.openHelpUri", "Open help URL"),
            helpUri: URI.parse(result.helpUri)
          });
        }
        items.push(
          { id: "retry" /* Retry */, label: localize("mcp.error.retry", "Try a different package") },
          { id: "cancel" /* Cancel */, label: localize("cancel", "Cancel") }
        );
        loadingQuickPick.items = items;
      } else {
        loadingQuickPick.title = localize(
          "mcp.confirmPublish",
          "Install {0}{1} from {2}?",
          result.name ?? packageName,
          result.version ? `@${result.version}` : "",
          result.publisher
        );
        loadingQuickPick.items = [
          { id: "allow" /* Allow */, label: localize("allow", "Allow") },
          { id: "cancel" /* Cancel */, label: localize("cancel", "Cancel") }
        ];
      }
      loadingQuickPick.busy = false;
    });
    const loadingAction = await new Promise((resolve) => {
      loadingQuickPickStore.add(loadingQuickPick.onDidAccept(() => resolve(loadingQuickPick.selectedItems[0])));
      loadingQuickPickStore.add(loadingQuickPick.onDidHide(() => resolve(void 0)));
      loadingQuickPick.show();
    }).finally(() => loadingQuickPickStore.dispose());
    switch (loadingAction?.id) {
      case "retry" /* Retry */:
        return this.getAssistedConfig(type);
      case "openUri" /* OpenUri */:
        if (loadingAction.helpUri) {
          this._openerService.open(loadingAction.helpUri);
        }
        return void 0;
      case "allow" /* Allow */:
        break;
      case "cancel" /* Cancel */:
      default:
        return void 0;
    }
    const config = await this._commandService.executeCommand(
      "github.copilot.chat.mcp.setup.flow" /* StartFlow */,
      {
        name: packageName,
        type: packageType
      }
    );
    if (config?.type === "mapped") {
      return {
        name: config.name,
        server: config.server,
        inputs: config.inputs
      };
    } else if (config?.type === "assisted" || !config?.type) {
      return config;
    } else {
      assertNever(config?.type);
    }
  }
  /** Shows the location of a server config once it's discovered. */
  showOnceDiscovered(name) {
    const store = new DisposableStore();
    store.add(autorun((reader) => {
      const colls = this._mcpRegistry.collections.read(reader);
      const servers = this._mcpService.servers.read(reader);
      const match = mapFindFirst(colls, (collection) => mapFindFirst(
        collection.serverDefinitions.read(reader),
        (server2) => server2.label === name ? { server: server2, collection } : void 0
      ));
      const server = match && servers.find((s) => s.definition.id === match.server.id);
      if (match && server) {
        if (match.collection.presentation?.origin) {
          this._editorService.openEditor({
            resource: match.collection.presentation.origin,
            options: {
              selection: match.server.presentation?.origin?.range,
              preserveFocus: true
            }
          });
        } else {
          this._commandService.executeCommand(McpCommandIds.ServerOptions, name);
        }
        server.start({ promptType: "all-untrusted" }).then((state) => {
          if (state.state === McpConnectionState.Kind.Error) {
            server.showOutput();
          }
        });
        store.dispose();
      }
    }));
    store.add(disposableTimeout(() => store.dispose(), 5e3));
  }
  async run() {
    const serverType = await this.getServerType();
    if (serverType === void 0) {
      return;
    }
    let config;
    let suggestedName;
    let inputs;
    let inputValues;
    switch (serverType) {
      case 0 /* Stdio */:
        config = await this.getStdioConfig();
        break;
      case 1 /* HTTP */:
        config = await this.getSSEConfig();
        break;
      case 2 /* NpmPackage */:
      case 3 /* PipPackage */:
      case 4 /* NuGetPackage */:
      case 5 /* DockerImage */: {
        const r = await this.getAssistedConfig(serverType);
        config = r?.server ? { ...r.server, type: McpServerType.LOCAL } : void 0;
        suggestedName = r?.name;
        inputs = r?.inputs;
        inputValues = r?.inputValues;
        break;
      }
      default:
        assertNever(serverType);
    }
    if (!config) {
      return;
    }
    const name = await this.getServerId(suggestedName);
    if (!name) {
      return;
    }
    const installTarget = await this.getInstallTarget();
    if (!installTarget) {
      return;
    }
    if (installTarget.kind === "agentHost") {
      this._agentHostCustomizations.addMcpServer(installTarget.session, name, config);
      return;
    }
    const { target } = installTarget;
    await this._mcpManagementService.install({ name, config, inputs }, { target });
    if (inputValues) {
      for (const [key, value] of Object.entries(inputValues)) {
        await this._mcpRegistry.setSavedInput(key, (isWorkspaceFolder(target) ? ConfigurationTarget.WORKSPACE_FOLDER : target) ?? ConfigurationTarget.WORKSPACE, value);
      }
    }
    const packageType = this.getPackageType(serverType);
    if (packageType) {
      this._telemetryService.publicLog2("mcp.addserver.completed", {
        packageType,
        serverType: config.type,
        target: target === ConfigurationTarget.WORKSPACE ? "workspace" : "user"
      });
    }
    this.showOnceDiscovered(name);
  }
  async pickForUrlHandler(resource, showIsPrimary = false) {
    const name = decodeURIComponent(basename(resource)).replace(/\.json$/, "");
    const placeHolder = localize("install.title", "Install MCP server {0}", name);
    const items = [
      { id: "install", label: localize("install.start", "Install Server") },
      { id: "show", label: localize("install.show", "Show Configuration", name) },
      { id: "rename", label: localize("install.rename", 'Rename "{0}"', name) },
      { id: "cancel", label: localize("cancel", "Cancel") }
    ];
    if (showIsPrimary) {
      [items[0], items[1]] = [items[1], items[0]];
    }
    const pick = await this._quickInputService.pick(items, { placeHolder, ignoreFocusLost: true });
    const getEditors = () => this._editorService.findEditors(resource);
    switch (pick?.id) {
      case "show":
        await this._editorService.openEditor({ resource });
        break;
      case "install":
        await this._editorService.save(getEditors());
        try {
          const contents = await this._fileService.readFile(resource);
          const { inputs, ...config } = parseJsonc(contents.value.toString());
          await this._mcpManagementService.install({ name, config, inputs });
          this._editorService.closeEditors(getEditors());
          this.showOnceDiscovered(name);
        } catch (e) {
          this._notificationService.error(localize("install.error", "Error installing MCP server {0}: {1}", name, e.message));
          await this._editorService.openEditor({ resource });
        }
        break;
      case "rename": {
        const newName = await this._quickInputService.input({ placeHolder: localize("install.newName", "Enter new name"), value: name });
        if (newName) {
          const newURI = resource.with({ path: `/${encodeURIComponent(newName)}.json` });
          await this._editorService.save(getEditors());
          await this._fileService.move(resource, newURI);
          return this.pickForUrlHandler(newURI, showIsPrimary);
        }
        break;
      }
    }
  }
  getPackageType(serverType) {
    switch (serverType) {
      case 2 /* NpmPackage */:
        return "npm";
      case 3 /* PipPackage */:
        return "pip";
      case 4 /* NuGetPackage */:
        return "nuget";
      case 5 /* DockerImage */:
        return "docker";
      case 0 /* Stdio */:
        return "stdio";
      case 1 /* HTTP */:
        return "sse";
      default:
        return void 0;
    }
  }
};
McpAddConfigurationCommand = __decorateClass([
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, IWorkbenchMcpManagementService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IMcpRegistry),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IFileService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IMcpService),
  __decorateParam(13, ILabelService),
  __decorateParam(14, IConfigurationService),
  __decorateParam(15, IAgentHostCustomizationService),
  __decorateParam(16, IChatWidgetService)
], McpAddConfigurationCommand);
let McpInstallFromManifestCommand = class {
  constructor(_fileDialogService, _fileService, _quickInputService, _notificationService, _mcpManagementService, _logService) {
    this._fileDialogService = _fileDialogService;
    this._fileService = _fileService;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._mcpManagementService = _mcpManagementService;
    this._logService = _logService;
  }
  async run() {
    const result = await this._fileDialogService.showOpenDialog({
      title: localize("mcp.installFromManifest.title", "Select MCP Server Manifest"),
      filters: [{ name: localize("mcp.installFromManifest.filter", "MCP Manifest"), extensions: ["json"] }],
      canSelectFiles: true,
      canSelectMany: false,
      openLabel: mnemonicButtonLabel(localize({ key: "mcp.installFromManifest.openLabel", comment: ["&& denotes a mnemonic"] }, "&&Install"))
    });
    if (!result?.[0]) {
      return;
    }
    const manifestUri = result[0];
    let manifest;
    try {
      const contents = await this._fileService.readFile(manifestUri);
      manifest = parseJsonc(contents.value.toString());
    } catch (e) {
      this._notificationService.error(localize("mcp.installFromManifest.readError", "Failed to read manifest file: {0}", e.message));
      return;
    }
    if (!manifest || typeof manifest !== "object") {
      this._notificationService.error(localize("mcp.installFromManifest.invalidJson", "Invalid manifest file: expected a JSON object"));
      return;
    }
    const galleryManifest = manifest;
    let packageType;
    if (Array.isArray(galleryManifest.packages) && galleryManifest.packages.length > 0) {
      packageType = galleryManifest.packages[0].registryType;
    } else if (Array.isArray(galleryManifest.remotes) && galleryManifest.remotes.length > 0) {
      packageType = RegistryType.REMOTE;
    } else {
      this._notificationService.error(localize("mcp.installFromManifest.invalidManifest", "Invalid manifest: expected 'packages' or 'remotes' with at least one entry"));
      return;
    }
    let config;
    let inputs;
    try {
      const { mcpServerConfiguration, notices } = this._mcpManagementService.getMcpServerConfigurationFromManifest(galleryManifest, packageType);
      config = mcpServerConfiguration.config;
      inputs = mcpServerConfiguration.inputs;
      if (notices.length > 0) {
        this._logService.warn(`MCP Management Service: Warnings while installing the MCP server from ${manifestUri.path}`, notices);
      }
    } catch (e) {
      this._notificationService.error(localize("mcp.installFromManifest.parseError", "Failed to parse manifest: {0}", e.message));
      return;
    }
    let name = galleryManifest.name;
    if (!name) {
      name = await this._quickInputService.input({
        title: localize("mcp.installFromManifest.serverId.title", "Enter Server ID"),
        placeHolder: localize("mcp.installFromManifest.serverId.placeholder", "Unique identifier for this server"),
        value: basename(manifestUri).replace(/\.json$/i, ""),
        ignoreFocusLost: true
      });
      if (!name) {
        return;
      }
    }
    try {
      await this._mcpManagementService.install({ name, config, inputs });
      this._notificationService.info(localize("mcp.installFromManifest.success", "MCP server '{0}' installed successfully", name));
    } catch (e) {
      this._notificationService.error(localize("mcp.installFromManifest.installError", "Failed to install MCP server: {0}", e.message));
    }
  }
};
McpInstallFromManifestCommand = __decorateClass([
  __decorateParam(0, IFileDialogService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IWorkbenchMcpManagementService),
  __decorateParam(5, ILogService)
], McpInstallFromManifestCommand);
export {
  AddConfigurationType,
  AssistedTypes,
  McpAddConfigurationCommand,
  McpInstallFromManifestCommand
};
