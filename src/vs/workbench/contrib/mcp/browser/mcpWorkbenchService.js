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
import { Emitter, Event } from "../../../../base/common/event.js";
import { createCommandUri, MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IMcpGalleryService, mcpAccessConfig, McpAccessValue, IAllowedMcpServersService, McpGalleryResolveStatus } from "../../../../platform/mcp/common/mcpManagement.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { McpServerType } from "../../../../platform/mcp/common/mcpPlatformTypes.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { StorageScope } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { MCP_CONFIGURATION_KEY, WORKSPACE_STANDALONE_CONFIGURATIONS } from "../../../services/configuration/common/configuration.js";
import { ACTIVE_GROUP, IEditorService, MODAL_GROUP } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IWorkbenchMcpManagementService, LocalMcpServerScope, REMOTE_USER_CONFIG_ID, USER_CONFIG_ID, WORKSPACE_CONFIG_ID, WORKSPACE_FOLDER_CONFIG_ID_PREFIX } from "../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { mcpConfigurationSection } from "../common/mcpConfiguration.js";
import { HasInstalledMcpServersContext, IMcpService, IMcpWorkbenchService, McpCollectionSortOrder, McpServerEnablementState, McpServerInstallState, McpServersGalleryStatusContext } from "../common/mcpTypes.js";
import { ContributionEnablementState } from "../../chat/common/enablement.js";
import { McpServerEditorInput } from "./mcpServerEditorInput.js";
import { IMcpGalleryManifestService } from "../../../../platform/mcp/common/mcpGalleryManifest.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { autorun, runOnChange } from "../../../../base/common/observable.js";
import Severity from "../../../../base/common/severity.js";
import { ThrottledDelayer } from "../../../../base/common/async.js";
let McpWorkbenchServer = class {
  constructor(installStateProvider, runtimeStateProvider, local, gallery, installable, mcpGalleryService, fileService) {
    this.installStateProvider = installStateProvider;
    this.runtimeStateProvider = runtimeStateProvider;
    this.local = local;
    this.gallery = gallery;
    this.installable = installable;
    this.mcpGalleryService = mcpGalleryService;
    this.fileService = fileService;
    this.local = local;
  }
  get id() {
    return this.local?.id ?? this.gallery?.name ?? this.installable?.name ?? this.name;
  }
  get name() {
    return this.gallery?.name ?? this.local?.name ?? this.installable?.name ?? "";
  }
  get label() {
    return this.gallery?.displayName ?? this.local?.displayName ?? this.local?.name ?? this.installable?.name ?? "";
  }
  get icon() {
    return this.gallery?.icon ?? this.local?.icon;
  }
  get installState() {
    return this.installStateProvider(this);
  }
  get codicon() {
    return this.gallery?.codicon ?? this.local?.codicon;
  }
  get publisherDisplayName() {
    return this.gallery?.publisherDisplayName ?? this.local?.publisherDisplayName ?? this.gallery?.publisher ?? this.local?.publisher;
  }
  get publisherUrl() {
    return this.gallery?.publisherDomain?.link;
  }
  get description() {
    return this.gallery?.description ?? this.local?.description ?? "";
  }
  get starsCount() {
    return this.gallery?.starsCount ?? 0;
  }
  get license() {
    return this.gallery?.license;
  }
  get repository() {
    return this.gallery?.repositoryUrl;
  }
  get config() {
    return this.local?.config ?? this.installable?.config;
  }
  get runtimeStatus() {
    return this.runtimeStateProvider(this);
  }
  get readmeUrl() {
    return this.local?.readmeUrl ?? (this.gallery?.readmeUrl ? URI.parse(this.gallery.readmeUrl) : void 0);
  }
  async getReadme(token) {
    if (this.local?.readmeUrl) {
      const content = await this.fileService.readFile(this.local.readmeUrl);
      return content.value.toString();
    }
    if (this.gallery?.readme) {
      return this.gallery.readme;
    }
    if (this.gallery?.readmeUrl) {
      return this.mcpGalleryService.getReadme(this.gallery, token);
    }
    return Promise.reject(new Error("not available"));
  }
  async getManifest(token) {
    if (this.local?.manifest) {
      return this.local.manifest;
    }
    if (this.gallery) {
      return this.gallery.configuration;
    }
    throw new Error("No manifest available");
  }
};
McpWorkbenchServer = __decorateClass([
  __decorateParam(5, IMcpGalleryService),
  __decorateParam(6, IFileService)
], McpWorkbenchServer);
let McpWorkbenchService = class extends Disposable {
  constructor(mcpGalleryManifestService, mcpGalleryService, mcpManagementService, editorService, userDataProfilesService, uriIdentityService, workspaceService, environmentService, labelService, productService, remoteAgentService, configurationService, instantiationService, telemetryService, logService, extensionsWorkbenchService, allowedMcpServersService, mcpService, urlService) {
    super();
    this.mcpGalleryService = mcpGalleryService;
    this.mcpManagementService = mcpManagementService;
    this.editorService = editorService;
    this.userDataProfilesService = userDataProfilesService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceService = workspaceService;
    this.environmentService = environmentService;
    this.labelService = labelService;
    this.productService = productService;
    this.remoteAgentService = remoteAgentService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.telemetryService = telemetryService;
    this.logService = logService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.allowedMcpServersService = allowedMcpServersService;
    this.mcpService = mcpService;
    this.installing = [];
    this.uninstalling = [];
    this._local = [];
    this.registrySyncGeneration = 0;
    this.registryGeneration = 0;
    this.localQueryGeneration = 0;
    this.profileChangeGeneration = 0;
    // Source identity is intentionally trusted only in-process; IPC copies are re-verified.
    this.gallerySourceGenerations = /* @__PURE__ */ new WeakMap();
    this.registrySyncDelayer = this._register(new ThrottledDelayer(0));
    this._onChange = this._register(new Emitter());
    this.onChange = this._onChange.event;
    this._onReset = this._register(new Emitter());
    this.onReset = this._onReset.event;
    this._register(this.mcpManagementService.onDidInstallMcpServersInCurrentProfile((e) => this.onDidInstallMcpServers(e)));
    this._register(this.mcpManagementService.onDidUpdateMcpServersInCurrentProfile((e) => this.onDidUpdateMcpServers(e)));
    this._register(this.mcpManagementService.onDidUninstallMcpServerInCurrentProfile((e) => this.onDidUninstallMcpServer(e)));
    this._register(this.mcpManagementService.onDidChangeProfile((e) => this.onDidChangeProfile()));
    this.queryLocal().then(() => {
      if (this._store.isDisposed) {
        return;
      }
      this._register(mcpGalleryManifestService.onDidChangeMcpGalleryManifest(() => {
        this.invalidateRegistryVerification();
        this.scheduleRegistrySync();
      }));
      this.scheduleRegistrySync();
    });
    urlService.registerHandler(this);
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(mcpAccessConfig)) {
        this._onChange.fire(void 0);
      }
    }));
    this._register(this.allowedMcpServersService.onDidChangeAllowedMcpServers(() => {
      this._local = this.sort(this._local);
      this._onChange.fire(void 0);
    }));
    this._register(runOnChange(mcpService.servers, () => {
      this._local = this.sort(this._local);
      this._onChange.fire(void 0);
    }));
    this._register(autorun((reader) => {
      for (const server of mcpService.servers.read(reader)) {
        server.enablement.read(reader);
      }
      this._onChange.fire(void 0);
    }));
  }
  get local() {
    return [...this._local];
  }
  async onDidChangeProfile() {
    const profileChangeGeneration = ++this.profileChangeGeneration;
    const generation = ++this.localQueryGeneration;
    this.invalidateRegistryVerification();
    await this.queryLocalForGeneration(generation);
    if (profileChangeGeneration !== this.profileChangeGeneration) {
      return;
    }
    this._onReset.fire();
    this.scheduleRegistrySync();
  }
  invalidateRegistryVerification() {
    this.registryGeneration++;
    this.registrySyncGeneration++;
    for (const server of this._local) {
      server.gallery = void 0;
    }
    this._onChange.fire(void 0);
  }
  areSameMcpServers(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.name === b.name && a.scope === b.scope;
  }
  onDidUninstallMcpServer(e) {
    if (e.error) {
      return;
    }
    const uninstalled = this._local.find((server) => this.areSameMcpServers(server.local, e));
    if (uninstalled) {
      this._local = this._local.filter((server) => server !== uninstalled);
      this._onChange.fire(uninstalled);
    }
  }
  onDidInstallMcpServers(e) {
    let needsRegistrySync = false;
    for (const { local, name, source } of e) {
      let server = this.installing.find((server2) => server2.local && local ? this.areSameMcpServers(server2.local, local) : server2.name === name);
      this.installing = server ? this.installing.filter((e2) => e2 !== server) : this.installing;
      if (local) {
        const trustedGallery = this.getTrustedGallerySource(source) ?? this.getTrustedGallerySource(server?.gallery);
        if (server) {
          server.local = local;
        } else {
          server = this.instantiationService.createInstance(McpWorkbenchServer, (e2) => this.getInstallState(e2), (e2) => this.getRuntimeStatus(e2), local, void 0, void 0);
        }
        server.gallery = trustedGallery?.name === local.name ? trustedGallery : void 0;
        needsRegistrySync = true;
        this._local = this._local.filter((server2) => !this.areSameMcpServers(server2.local, local));
        this.addServer(server);
      }
      this._onChange.fire(server);
    }
    if (needsRegistrySync) {
      this.scheduleRegistrySync();
    }
  }
  onDidUpdateMcpServers(e) {
    let needsRegistrySync = false;
    for (const result of e) {
      if (!result.local) {
        continue;
      }
      const serverIndex = this._local.findIndex((server2) => this.areSameMcpServers(server2.local, result.local));
      let server;
      if (serverIndex !== -1) {
        this._local[serverIndex].local = result.local;
        server = this._local[serverIndex];
      } else {
        server = this.instantiationService.createInstance(McpWorkbenchServer, (e2) => this.getInstallState(e2), (e2) => this.getRuntimeStatus(e2), result.local, void 0, void 0);
        this.addServer(server);
      }
      const trustedGallery = this.getTrustedGallerySource(result.source) ?? this.getTrustedGallerySource(server.gallery);
      server.gallery = trustedGallery?.name === result.local.name ? trustedGallery : void 0;
      needsRegistrySync = true;
      this._onChange.fire(server);
    }
    if (needsRegistrySync) {
      this.scheduleRegistrySync();
    }
  }
  fromGallery(gallery, registryGeneration) {
    this.rememberGallerySource(gallery, registryGeneration);
    for (const local of this._local) {
      if (local.name === gallery.name) {
        return local;
      }
    }
    return void 0;
  }
  scheduleRegistrySync() {
    const generation = ++this.registrySyncGeneration;
    void this.registrySyncDelayer.trigger(() => this.syncInstalledMcpServers(generation)).catch((error) => this.logService.error(error));
  }
  async syncInstalledMcpServers(generation) {
    if (!this.mcpGalleryService.isEnabled()) {
      return;
    }
    const servers = this.local.flatMap((server) => server.local ? [{ server, local: server.local }] : []);
    const infosByName = /* @__PURE__ */ new Map();
    for (const { local } of servers) {
      const existing = infosByName.get(local.name);
      if (!existing || !existing.id && local.galleryId) {
        infosByName.set(local.name, { name: local.name, id: local.galleryId });
      }
    }
    const infos = [...infosByName.values()];
    if (!infos.length) {
      return;
    }
    const resolved = await this.mcpGalleryService.resolveMcpServersFromGallery(infos);
    if (generation !== this.registrySyncGeneration) {
      return;
    }
    this.syncInstalledMcpServersWithGallery(resolved, servers, generation);
  }
  syncInstalledMcpServersWithGallery(resolved, servers, generation) {
    for (const { server: mcpServer, local } of servers) {
      if (generation !== this.registrySyncGeneration || !this._local.includes(mcpServer) || mcpServer.local !== local) {
        continue;
      }
      const result = resolved.get(local.name);
      if (!result || result.status === McpGalleryResolveStatus.Failed) {
        continue;
      }
      if (result.status === McpGalleryResolveStatus.NotFound) {
        if (mcpServer.gallery) {
          mcpServer.gallery = void 0;
          this._onChange.fire(mcpServer);
        }
        continue;
      }
      const gallery = result.server;
      const changed = mcpServer.gallery !== gallery;
      this.rememberGallerySource(gallery);
      mcpServer.gallery = gallery;
      if (changed) {
        this._onChange.fire(mcpServer);
      }
    }
  }
  async queryGallery(options, token) {
    if (!this.mcpGalleryService.isEnabled()) {
      return {
        firstPage: { items: [], hasMore: false },
        getNextPage: async () => ({ items: [], hasMore: false })
      };
    }
    const registryGeneration = this.registryGeneration;
    const pager = await this.mcpGalleryService.query(options, token);
    const mapPage = (page) => ({
      items: page.items.map((gallery) => this.fromGallery(gallery, registryGeneration) ?? this.instantiationService.createInstance(McpWorkbenchServer, (e) => this.getInstallState(e), (e) => this.getRuntimeStatus(e), void 0, gallery, void 0)),
      hasMore: page.hasMore
    });
    return {
      firstPage: mapPage(pager.firstPage),
      getNextPage: async (ct) => {
        const nextPage = await pager.getNextPage(ct);
        return mapPage(nextPage);
      }
    };
  }
  async queryLocal() {
    await this.queryLocalForGeneration(++this.localQueryGeneration);
    return [...this.local];
  }
  async queryLocalForGeneration(generation) {
    const installed = await this.mcpManagementService.getInstalled();
    if (generation !== this.localQueryGeneration) {
      return false;
    }
    this._local = this.sort(installed.map((i) => {
      const existing = this._local.find((local2) => local2.id === i.id);
      const local = existing ?? this.instantiationService.createInstance(McpWorkbenchServer, (e) => this.getInstallState(e), (e) => this.getRuntimeStatus(e), void 0, void 0, void 0);
      local.local = i;
      return local;
    }));
    this._onChange.fire(void 0);
    return true;
  }
  rememberGallerySource(gallery, registryGeneration = this.registryGeneration) {
    if (registryGeneration === this.registryGeneration) {
      this.gallerySourceGenerations.set(gallery, registryGeneration);
    }
  }
  getTrustedGallerySource(gallery) {
    return gallery && this.gallerySourceGenerations.get(gallery) === this.registryGeneration ? gallery : void 0;
  }
  addServer(server) {
    this._local.push(server);
    this._local = this.sort(this._local);
  }
  sort(local) {
    return local.sort((a, b) => {
      if (a.name === b.name) {
        const aEnabled = !a.runtimeStatus || a.runtimeStatus.state === McpServerEnablementState.Enabled;
        const bEnabled = !b.runtimeStatus || b.runtimeStatus.state === McpServerEnablementState.Enabled;
        if (aEnabled !== bEnabled) {
          return aEnabled ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      }
      return a.name.localeCompare(b.name);
    });
  }
  getEnabledLocalMcpServers() {
    const result = /* @__PURE__ */ new Map();
    const userRemote = [];
    const workspace = [];
    for (const server of this.local) {
      const enablementStatus = this.getEnablementStatus(server);
      if (enablementStatus && enablementStatus.state !== McpServerEnablementState.Enabled) {
        continue;
      }
      if (server.local?.scope === LocalMcpServerScope.User) {
        result.set(server.name, server.local);
      } else if (server.local?.scope === LocalMcpServerScope.RemoteUser) {
        userRemote.push(server.local);
      } else if (server.local?.scope === LocalMcpServerScope.Workspace) {
        workspace.push(server.local);
      }
    }
    for (const server of userRemote) {
      const existing = result.get(server.name);
      if (existing) {
        this.logService.warn(localize("overwriting", "Overwriting mcp server '{0}' from {1} with {2}.", server.name, server.mcpResource.path, existing.mcpResource.path));
      }
      result.set(server.name, server);
    }
    for (const server of workspace) {
      const existing = result.get(server.name);
      if (existing) {
        this.logService.warn(localize("overwriting", "Overwriting mcp server '{0}' from {1} with {2}.", server.name, server.mcpResource.path, existing.mcpResource.path));
      }
      result.set(server.name, server);
    }
    return [...result.values()];
  }
  canInstall(mcpServer) {
    if (!(mcpServer instanceof McpWorkbenchServer)) {
      return new MarkdownString().appendText(localize("not an extension", "The provided object is not an mcp server."));
    }
    if (mcpServer.gallery) {
      const result = this.mcpManagementService.canInstall(mcpServer.gallery);
      if (result === true) {
        return true;
      }
      return result;
    }
    if (mcpServer.installable) {
      const result = this.mcpManagementService.canInstall(mcpServer.installable);
      if (result === true) {
        return true;
      }
      return result;
    }
    return new MarkdownString().appendText(localize("cannot be installed", "Cannot install the '{0}' MCP Server because it is not available in this setup.", mcpServer.label));
  }
  async install(server, installOptions) {
    if (!(server instanceof McpWorkbenchServer)) {
      throw new Error("Invalid server instance");
    }
    if (server.installable) {
      const installable = server.installable;
      return this.doInstall(server, () => this.mcpManagementService.install(installable, installOptions));
    }
    if (server.gallery) {
      const gallery = server.gallery;
      return this.doInstall(server, () => this.mcpManagementService.installFromGallery(gallery, installOptions));
    }
    throw new Error("No installable server found");
  }
  async uninstall(server) {
    if (!server.local) {
      throw new Error("Local server is missing");
    }
    await this.mcpManagementService.uninstall(server.local);
  }
  async doInstall(server, installTask) {
    const source = server.gallery ? "gallery" : "local";
    const serverName = server.name;
    const hasInputs = !!(server.installable?.inputs && server.installable.inputs.length > 0);
    this.installing.push(server);
    this._onChange.fire(server);
    try {
      await installTask();
      const result = await this.waitAndGetInstalledMcpServer(server);
      this.telemetryService.publicLog2("mcp/serverInstall", {
        serverName,
        source,
        scope: result.local?.scope ?? "unknown",
        success: true,
        hasInputs
      });
      return result;
    } catch (error) {
      this.telemetryService.publicLog2("mcp/serverInstall", {
        serverName,
        source,
        scope: "unknown",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        hasInputs
      });
      throw error;
    } finally {
      if (this.installing.includes(server)) {
        this.installing.splice(this.installing.indexOf(server), 1);
        this._onChange.fire(server);
      }
    }
  }
  async waitAndGetInstalledMcpServer(server) {
    let installed = this.local.find((local) => local.name === server.name);
    if (!installed) {
      await Event.toPromise(Event.filter(this.onChange, (e) => !!e && this.local.some((local) => local.name === server.name)));
    }
    installed = this.local.find((local) => local.name === server.name);
    if (!installed) {
      throw new Error("Extension should have been installed");
    }
    return installed;
  }
  getMcpConfigPath(arg) {
    if (arg instanceof URI) {
      const mcpResource = arg;
      for (const profile of this.userDataProfilesService.profiles) {
        if (this.uriIdentityService.extUri.isEqual(profile.mcpResource, mcpResource)) {
          return this.getUserMcpConfigPath(mcpResource);
        }
      }
      return this.remoteAgentService.getEnvironment().then((remoteEnvironment) => {
        if (remoteEnvironment && this.uriIdentityService.extUri.isEqual(remoteEnvironment.mcpResource, mcpResource)) {
          return this.getRemoteMcpConfigPath(mcpResource);
        }
        return this.getWorkspaceMcpConfigPath(mcpResource);
      });
    }
    if (arg.scope === LocalMcpServerScope.User) {
      return this.getUserMcpConfigPath(arg.mcpResource);
    }
    if (arg.scope === LocalMcpServerScope.Workspace) {
      return this.getWorkspaceMcpConfigPath(arg.mcpResource);
    }
    if (arg.scope === LocalMcpServerScope.RemoteUser) {
      return this.getRemoteMcpConfigPath(arg.mcpResource);
    }
    return void 0;
  }
  getUserMcpConfigPath(mcpResource) {
    return {
      id: USER_CONFIG_ID,
      key: "userLocalValue",
      target: ConfigurationTarget.USER_LOCAL,
      label: localize("mcp.configuration.userLocalValue", "Global in {0}", this.productService.nameShort),
      scope: StorageScope.PROFILE,
      order: McpCollectionSortOrder.User,
      uri: mcpResource,
      section: []
    };
  }
  getRemoteMcpConfigPath(mcpResource) {
    return {
      id: REMOTE_USER_CONFIG_ID,
      key: "userRemoteValue",
      target: ConfigurationTarget.USER_REMOTE,
      label: this.environmentService.remoteAuthority ? this.labelService.getHostLabel(Schemas.vscodeRemote, this.environmentService.remoteAuthority) : "Remote",
      scope: StorageScope.PROFILE,
      order: McpCollectionSortOrder.User + McpCollectionSortOrder.RemoteBoost,
      remoteAuthority: this.environmentService.remoteAuthority,
      uri: mcpResource,
      section: []
    };
  }
  getWorkspaceMcpConfigPath(mcpResource) {
    const workspace = this.workspaceService.getWorkspace();
    if (workspace.configuration && this.uriIdentityService.extUri.isEqual(workspace.configuration, mcpResource)) {
      return {
        id: WORKSPACE_CONFIG_ID,
        key: "workspaceValue",
        target: ConfigurationTarget.WORKSPACE,
        label: basename(mcpResource),
        scope: StorageScope.WORKSPACE,
        order: McpCollectionSortOrder.Workspace,
        remoteAuthority: this.environmentService.remoteAuthority,
        uri: mcpResource,
        section: ["settings", mcpConfigurationSection]
      };
    }
    const workspaceFolders = workspace.folders;
    for (let index = 0; index < workspaceFolders.length; index++) {
      const workspaceFolder = workspaceFolders[index];
      if (this.uriIdentityService.extUri.isEqual(this.uriIdentityService.extUri.joinPath(workspaceFolder.uri, WORKSPACE_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY]), mcpResource)) {
        return {
          id: `${WORKSPACE_FOLDER_CONFIG_ID_PREFIX}${index}`,
          key: "workspaceFolderValue",
          target: ConfigurationTarget.WORKSPACE_FOLDER,
          label: `${workspaceFolder.name}/.vscode/mcp.json`,
          scope: StorageScope.WORKSPACE,
          remoteAuthority: this.environmentService.remoteAuthority,
          order: McpCollectionSortOrder.WorkspaceFolder,
          uri: mcpResource,
          workspaceFolder
        };
      }
    }
    return void 0;
  }
  async handleURL(uri) {
    if (uri.path === "mcp/install") {
      return this.handleMcpInstallUri(uri);
    }
    if (uri.path.startsWith("mcp/by-name/")) {
      const mcpServerName = uri.path.substring("mcp/by-name/".length);
      if (mcpServerName) {
        return this.handleMcpServerByName(mcpServerName);
      }
    }
    if (uri.path.startsWith("mcp/")) {
      const mcpServerUrl = uri.path.substring(4);
      if (mcpServerUrl) {
        return this.handleMcpServerUrl(`${Schemas.https}://${mcpServerUrl}`);
      }
    }
    return false;
  }
  async handleMcpInstallUri(uri) {
    let parsed;
    try {
      parsed = JSON.parse(decodeURIComponent(uri.query));
    } catch (e) {
      return false;
    }
    try {
      const { name, inputs, ...config } = parsed;
      if (config.gallery && this.mcpGalleryService.isEnabled()) {
        try {
          const registryGeneration = this.registryGeneration;
          const [galleryServer] = await this.mcpGalleryService.getMcpServersFromGallery([{ name }]);
          if (galleryServer) {
            this.rememberGallerySource(galleryServer, registryGeneration);
            const local = this.local.find((e) => e.name === galleryServer.name) ?? this.instantiationService.createInstance(McpWorkbenchServer, (e) => this.getInstallState(e), (e) => this.getRuntimeStatus(e), void 0, galleryServer, void 0);
            this.open(local);
            return true;
          }
          this.logService.info(`MCP server '${name}' not found in gallery, installing as local`);
        } catch (e) {
          this.logService.info(`Gallery verification failed for MCP server '${name}', installing as local`);
        }
      }
      if (config.type === void 0) {
        config.type = parsed.command ? McpServerType.LOCAL : McpServerType.REMOTE;
      }
      this.open(this.instantiationService.createInstance(McpWorkbenchServer, (e) => this.getInstallState(e), (e) => this.getRuntimeStatus(e), void 0, void 0, { name, config, inputs }));
    } catch (e) {
    }
    return true;
  }
  async handleMcpServerUrl(url) {
    try {
      const gallery = await this.mcpGalleryService.getMcpServer(url);
      if (!gallery) {
        this.logService.info(`MCP server '${url}' not found`);
        return true;
      }
      const local = this.local.find((e) => e.name === gallery.name) ?? this.instantiationService.createInstance(McpWorkbenchServer, (e) => this.getInstallState(e), (e) => this.getRuntimeStatus(e), void 0, gallery, void 0);
      this.open(local);
    } catch (e) {
      this.logService.error(e);
    }
    return true;
  }
  async handleMcpServerByName(name) {
    try {
      const registryGeneration = this.registryGeneration;
      const [gallery] = await this.mcpGalleryService.getMcpServersFromGallery([{ name }]);
      if (!gallery) {
        this.logService.info(`MCP server '${name}' not found`);
        return true;
      }
      this.rememberGallerySource(gallery, registryGeneration);
      const local = this.local.find((e) => e.name === gallery.name) ?? this.instantiationService.createInstance(McpWorkbenchServer, (e) => this.getInstallState(e), (e) => this.getRuntimeStatus(e), void 0, gallery, void 0);
      this.open(local);
    } catch (e) {
      this.logService.error(e);
    }
    return true;
  }
  async openSearch(searchValue, preserveFocus) {
    await this.extensionsWorkbenchService.openSearch(`@mcp ${searchValue}`, preserveFocus);
  }
  async open(extension, options) {
    const useModal = this.configurationService.getValue("extensions.allowOpenInModalEditor");
    await this.editorService.openEditor(this.instantiationService.createInstance(McpServerEditorInput, extension), options, useModal ? MODAL_GROUP : ACTIVE_GROUP);
  }
  getInstallState(extension) {
    if (this.installing.some((i) => i.name === extension.name)) {
      return McpServerInstallState.Installing;
    }
    if (this.uninstalling.some((e) => e.name === extension.name)) {
      return McpServerInstallState.Uninstalling;
    }
    const local = this.local.find((e) => e === extension);
    return local ? McpServerInstallState.Installed : McpServerInstallState.Uninstalled;
  }
  getRuntimeStatus(mcpServer) {
    const enablementStatus = this.getEnablementStatus(mcpServer);
    if (enablementStatus) {
      return enablementStatus;
    }
    const server = this.mcpService.servers.get().find((s) => s.definition.id === mcpServer.id);
    if (!server) {
      return { state: McpServerEnablementState.Disabled };
    }
    const enablement = server.enablement.get();
    if (enablement === ContributionEnablementState.DisabledProfile) {
      return {
        state: McpServerEnablementState.DisabledProfile,
        message: {
          severity: Severity.Info,
          text: new MarkdownString(localize("disabled globally", "This MCP server is disabled."))
        }
      };
    }
    if (enablement === ContributionEnablementState.DisabledWorkspace) {
      return {
        state: McpServerEnablementState.DisabledWorkspace,
        message: {
          severity: Severity.Info,
          text: new MarkdownString(localize("disabled in workspace", "This MCP server is disabled for this workspace."))
        }
      };
    }
    return void 0;
  }
  getEnablementStatus(mcpServer) {
    if (!mcpServer.local) {
      return void 0;
    }
    const settingsCommandLink = createCommandUri("workbench.action.openSettings", { query: `@id:${mcpAccessConfig}` }).toString();
    const accessValue = this.configurationService.getValue(mcpAccessConfig);
    if (accessValue === McpAccessValue.None) {
      return {
        state: McpServerEnablementState.DisabledByAccess,
        message: {
          severity: Severity.Warning,
          text: new MarkdownString(localize("disabled - all not allowed", "This MCP Server is disabled because MCP servers are configured to be disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink))
        }
      };
    }
    if (accessValue === McpAccessValue.Registry) {
      if (!mcpServer.gallery) {
        return {
          state: McpServerEnablementState.DisabledByAccess,
          message: {
            severity: Severity.Warning,
            text: new MarkdownString(localize("disabled - some not allowed", "This MCP Server is disabled because it is configured to be disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink))
          }
        };
      }
      const remoteUrl = mcpServer.local.config.type === McpServerType.REMOTE && mcpServer.local.config.url;
      if (remoteUrl && !mcpServer.gallery.configuration.remotes?.some((remote) => remote.url === remoteUrl)) {
        return {
          state: McpServerEnablementState.DisabledByAccess,
          message: {
            severity: Severity.Warning,
            text: new MarkdownString(localize("disabled - some not allowed", "This MCP Server is disabled because it is configured to be disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink))
          }
        };
      }
    }
    return void 0;
  }
};
McpWorkbenchService = __decorateClass([
  __decorateParam(0, IMcpGalleryManifestService),
  __decorateParam(1, IMcpGalleryService),
  __decorateParam(2, IWorkbenchMcpManagementService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IWorkbenchEnvironmentService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IRemoteAgentService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, ITelemetryService),
  __decorateParam(14, ILogService),
  __decorateParam(15, IExtensionsWorkbenchService),
  __decorateParam(16, IAllowedMcpServersService),
  __decorateParam(17, IMcpService),
  __decorateParam(18, IURLService)
], McpWorkbenchService);
let MCPContextsInitialisation = class extends Disposable {
  static {
    this.ID = "workbench.mcp.contexts.initialisation";
  }
  constructor(mcpWorkbenchService, mcpGalleryManifestService, contextKeyService) {
    super();
    const mcpServersGalleryStatus = McpServersGalleryStatusContext.bindTo(contextKeyService);
    mcpServersGalleryStatus.set(mcpGalleryManifestService.mcpGalleryManifestStatus);
    this._register(mcpGalleryManifestService.onDidChangeMcpGalleryManifestStatus((status) => mcpServersGalleryStatus.set(status)));
    const hasInstalledMcpServersContextKey = HasInstalledMcpServersContext.bindTo(contextKeyService);
    mcpWorkbenchService.queryLocal().finally(() => {
      hasInstalledMcpServersContextKey.set(mcpWorkbenchService.local.length > 0);
      this._register(mcpWorkbenchService.onChange(() => hasInstalledMcpServersContextKey.set(mcpWorkbenchService.local.length > 0)));
    });
  }
};
MCPContextsInitialisation = __decorateClass([
  __decorateParam(0, IMcpWorkbenchService),
  __decorateParam(1, IMcpGalleryManifestService),
  __decorateParam(2, IContextKeyService)
], MCPContextsInitialisation);
export {
  MCPContextsInitialisation,
  McpWorkbenchService
};
