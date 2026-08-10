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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { MarkdownString } from "../../../base/common/htmlContent.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { format2, uppercaseFirstLetter } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { asJson, asText, isSuccess, IRequestService } from "../../request/common/request.js";
import { GalleryMcpServerStatus, McpGalleryResolveStatus, RegistryType, TransportType } from "./mcpManagement.js";
import { IMcpGalleryManifestService, McpGalleryManifestStatus, getMcpGalleryManifestResourceUri, McpGalleryResourceType } from "./mcpGalleryManifest.js";
import { CancellationError, isCancellationError } from "../../../base/common/errors.js";
import { isObject, isString } from "../../../base/common/types.js";
var IconMimeType = /* @__PURE__ */ ((IconMimeType2) => {
  IconMimeType2["PNG"] = "image/png";
  IconMimeType2["JPEG"] = "image/jpeg";
  IconMimeType2["JPG"] = "image/jpg";
  IconMimeType2["SVG"] = "image/svg+xml";
  IconMimeType2["WEBP"] = "image/webp";
  return IconMimeType2;
})(IconMimeType || {});
var IconTheme = /* @__PURE__ */ ((IconTheme2) => {
  IconTheme2["LIGHT"] = "light";
  IconTheme2["DARK"] = "dark";
  return IconTheme2;
})(IconTheme || {});
var McpServerSchemaVersion_v2025_07_09;
((McpServerSchemaVersion_v2025_07_092) => {
  McpServerSchemaVersion_v2025_07_092.VERSION = "v0-2025-07-09";
  McpServerSchemaVersion_v2025_07_092.SCHEMA = `https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json`;
  class Serializer {
    toRawGalleryMcpServerResult(input) {
      if (!input || typeof input !== "object" || !Array.isArray(input.servers)) {
        return void 0;
      }
      const from = input;
      const servers = [];
      for (const server of from.servers) {
        const rawServer = this.toRawGalleryMcpServer(server);
        if (!rawServer) {
          return void 0;
        }
        servers.push(rawServer);
      }
      return {
        metadata: {
          count: from.metadata.count ?? 0,
          nextCursor: from.metadata?.next_cursor
        },
        servers
      };
    }
    toRawGalleryMcpServer(input) {
      if (!input || typeof input !== "object") {
        return void 0;
      }
      const from = input;
      if (!from.name || !isString(from.name) || (!from.description || !isString(from.description)) || (!from.version || !isString(from.version))) {
        return void 0;
      }
      if (from.$schema && from.$schema !== McpServerSchemaVersion_v2025_07_092.SCHEMA) {
        return void 0;
      }
      const registryInfo = from._meta?.["io.modelcontextprotocol.registry/official"];
      function convertServerInput(input2) {
        return {
          ...input2,
          isRequired: input2.is_required,
          isSecret: input2.is_secret
        };
      }
      function convertVariables(variables) {
        const result = {};
        for (const [key, value] of Object.entries(variables)) {
          result[key] = convertServerInput(value);
        }
        return result;
      }
      function convertServerArgument(arg) {
        if (arg.type === "positional") {
          return {
            ...arg,
            valueHint: arg.value_hint,
            isRepeated: arg.is_repeated,
            isRequired: arg.is_required,
            isSecret: arg.is_secret,
            variables: arg.variables ? convertVariables(arg.variables) : void 0
          };
        }
        return {
          ...arg,
          isRepeated: arg.is_repeated,
          isRequired: arg.is_required,
          isSecret: arg.is_secret,
          variables: arg.variables ? convertVariables(arg.variables) : void 0
        };
      }
      function convertKeyValueInput(input2) {
        return {
          ...input2,
          isRequired: input2.is_required,
          isSecret: input2.is_secret,
          variables: input2.variables ? convertVariables(input2.variables) : void 0
        };
      }
      function convertTransport(input2) {
        switch (input2.type) {
          case "stdio":
            return {
              type: TransportType.STDIO
            };
          case "streamable-http":
            return {
              type: TransportType.STREAMABLE_HTTP,
              url: input2.url,
              headers: input2.headers?.map(convertKeyValueInput)
            };
          case "sse":
            return {
              type: TransportType.SSE,
              url: input2.url,
              headers: input2.headers?.map(convertKeyValueInput)
            };
          default:
            return {
              type: TransportType.STDIO
            };
        }
      }
      function convertRegistryType(input2) {
        switch (input2) {
          case "npm":
            return RegistryType.NODE;
          case "docker":
          case "docker-hub":
          case "oci":
            return RegistryType.DOCKER;
          case "pypi":
            return RegistryType.PYTHON;
          case "nuget":
            return RegistryType.NUGET;
          case "mcpb":
            return RegistryType.MCPB;
          default:
            return RegistryType.NODE;
        }
      }
      const gitHubInfo = from._meta["io.modelcontextprotocol.registry/publisher-provided"]?.github;
      return {
        id: registryInfo.id,
        name: from.name,
        description: from.description,
        repository: from.repository ? {
          url: from.repository.url,
          source: from.repository.source,
          id: from.repository.id
        } : void 0,
        readme: from.repository?.readme,
        version: from.version,
        createdAt: from.created_at,
        updatedAt: from.updated_at,
        packages: from.packages?.map((p) => ({
          identifier: p.identifier ?? p.name,
          registryType: convertRegistryType(p.registry_type ?? p.registry_name),
          version: p.version,
          fileSha256: p.file_sha256,
          registryBaseUrl: p.registry_base_url,
          transport: p.transport ? convertTransport(p.transport) : { type: TransportType.STDIO },
          packageArguments: p.package_arguments?.map(convertServerArgument),
          runtimeHint: p.runtime_hint,
          runtimeArguments: p.runtime_arguments?.map(convertServerArgument),
          environmentVariables: p.environment_variables?.map(convertKeyValueInput)
        })),
        remotes: from.remotes?.map((remote) => {
          const type = remote.type ?? remote.transport_type ?? remote.transport;
          return {
            type: type === TransportType.SSE ? TransportType.SSE : TransportType.STREAMABLE_HTTP,
            url: remote.url,
            headers: remote.headers?.map(convertKeyValueInput)
          };
        }),
        registryInfo: {
          isLatest: registryInfo.is_latest,
          publishedAt: registryInfo.published_at,
          updatedAt: registryInfo.updated_at
        },
        githubInfo: gitHubInfo ? {
          name: gitHubInfo.name,
          nameWithOwner: gitHubInfo.name_with_owner,
          displayName: gitHubInfo.display_name,
          isInOrganization: gitHubInfo.is_in_organization,
          license: gitHubInfo.license,
          opengraphImageUrl: gitHubInfo.opengraph_image_url,
          ownerAvatarUrl: gitHubInfo.owner_avatar_url,
          primaryLanguage: gitHubInfo.primary_language,
          primaryLanguageColor: gitHubInfo.primary_language_color,
          pushedAt: gitHubInfo.pushed_at,
          stargazerCount: gitHubInfo.stargazer_count,
          topics: gitHubInfo.topics,
          usesCustomOpengraphImage: gitHubInfo.uses_custom_opengraph_image
        } : void 0
      };
    }
  }
  McpServerSchemaVersion_v2025_07_092.SERIALIZER = new Serializer();
})(McpServerSchemaVersion_v2025_07_09 || (McpServerSchemaVersion_v2025_07_09 = {}));
var McpServerSchemaVersion_v0_1;
((McpServerSchemaVersion_v0_12) => {
  McpServerSchemaVersion_v0_12.VERSION = "v0.1";
  class Serializer {
    toRawGalleryMcpServerResult(input) {
      if (!input || typeof input !== "object" || !Array.isArray(input.servers)) {
        return void 0;
      }
      const from = input;
      const servers = [];
      for (const server of from.servers) {
        const rawServer = this.toRawGalleryMcpServer(server);
        if (!rawServer) {
          if (servers.length === 0) {
            return void 0;
          } else {
            continue;
          }
        }
        servers.push(rawServer);
      }
      return {
        metadata: from.metadata,
        servers
      };
    }
    toRawGalleryMcpServer(input) {
      if (!input || typeof input !== "object") {
        return void 0;
      }
      const from = input;
      if (!from.server || !isObject(from.server) || (!from.server.name || !isString(from.server.name)) || (!from.server.description || !isString(from.server.description)) || (!from.server.version || !isString(from.server.version))) {
        return void 0;
      }
      const { "io.modelcontextprotocol.registry/official": registryInfo, ...apicInfo } = from._meta;
      const githubInfo = from.server._meta?.["io.modelcontextprotocol.registry/publisher-provided"]?.github;
      return {
        name: from.server.name,
        description: from.server.description,
        version: from.server.version,
        title: from.server.title,
        repository: from.server.repository ? {
          url: from.server.repository.url,
          source: from.server.repository.source,
          id: from.server.repository.id
        } : void 0,
        readme: githubInfo?.readme,
        icons: from.server.icons,
        websiteUrl: from.server.websiteUrl,
        packages: from.server.packages,
        remotes: from.server.remotes,
        status: registryInfo?.status,
        registryInfo,
        githubInfo,
        apicInfo
      };
    }
  }
  McpServerSchemaVersion_v0_12.SERIALIZER = new Serializer();
})(McpServerSchemaVersion_v0_1 || (McpServerSchemaVersion_v0_1 = {}));
var McpServerSchemaVersion_v0;
((McpServerSchemaVersion_v02) => {
  McpServerSchemaVersion_v02.VERSION = "v0";
  class Serializer {
    constructor() {
      this.galleryMcpServerDataSerializers = [];
      this.galleryMcpServerDataSerializers.push(McpServerSchemaVersion_v0_1.SERIALIZER);
      this.galleryMcpServerDataSerializers.push(McpServerSchemaVersion_v2025_07_09.SERIALIZER);
    }
    toRawGalleryMcpServerResult(input) {
      for (const serializer of this.galleryMcpServerDataSerializers) {
        const result = serializer.toRawGalleryMcpServerResult(input);
        if (result) {
          return result;
        }
      }
      return void 0;
    }
    toRawGalleryMcpServer(input) {
      for (const serializer of this.galleryMcpServerDataSerializers) {
        const result = serializer.toRawGalleryMcpServer(input);
        if (result) {
          return result;
        }
      }
      return void 0;
    }
  }
  McpServerSchemaVersion_v02.SERIALIZER = new Serializer();
})(McpServerSchemaVersion_v0 || (McpServerSchemaVersion_v0 = {}));
const DefaultPageSize = 50;
const DefaultQueryState = {
  pageSize: DefaultPageSize
};
class Query {
  constructor(state = DefaultQueryState) {
    this.state = state;
  }
  get pageSize() {
    return this.state.pageSize;
  }
  get searchText() {
    return this.state.searchText;
  }
  get cursor() {
    return this.state.cursor;
  }
  withPage(cursor, pageSize = this.pageSize) {
    return new Query({ ...this.state, pageSize, cursor });
  }
  withSearchText(searchText) {
    return new Query({ ...this.state, searchText });
  }
}
let McpGalleryService = class extends Disposable {
  constructor(requestService, fileService, logService, mcpGalleryManifestService) {
    super();
    this.requestService = requestService;
    this.fileService = fileService;
    this.logService = logService;
    this.mcpGalleryManifestService = mcpGalleryManifestService;
    this.galleryMcpServerDataSerializers = /* @__PURE__ */ new Map();
    this.galleryMcpServerDataSerializers.set(McpServerSchemaVersion_v0.VERSION, McpServerSchemaVersion_v0.SERIALIZER);
    this.galleryMcpServerDataSerializers.set(McpServerSchemaVersion_v0_1.VERSION, McpServerSchemaVersion_v0_1.SERIALIZER);
  }
  isEnabled() {
    return this.mcpGalleryManifestService.mcpGalleryManifestStatus === McpGalleryManifestStatus.Available;
  }
  async query(options, token = CancellationToken.None) {
    const mcpGalleryManifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
    if (!mcpGalleryManifest) {
      return {
        firstPage: { items: [], hasMore: false },
        getNextPage: async () => ({ items: [], hasMore: false })
      };
    }
    let query = new Query();
    if (options?.text) {
      query = query.withSearchText(options.text.trim());
    }
    const { servers, metadata } = await this.queryGalleryMcpServers(query, mcpGalleryManifest, token);
    let currentCursor = metadata.nextCursor;
    return {
      firstPage: { items: servers, hasMore: !!metadata.nextCursor },
      getNextPage: async (ct) => {
        if (ct.isCancellationRequested) {
          throw new CancellationError();
        }
        if (!currentCursor) {
          return { items: [], hasMore: false };
        }
        const { servers: servers2, metadata: nextMetadata } = await this.queryGalleryMcpServers(query.withPage(currentCursor).withSearchText(void 0), mcpGalleryManifest, ct);
        currentCursor = nextMetadata.nextCursor;
        return { items: servers2, hasMore: !!nextMetadata.nextCursor };
      }
    };
  }
  async getMcpServersFromGallery(infos) {
    const resolved = await this.resolveMcpServersFromGallery(infos);
    const mcpServers = [];
    for (const result of resolved.values()) {
      if (result.status === McpGalleryResolveStatus.Found) {
        mcpServers.push(result.server);
      }
    }
    return mcpServers;
  }
  async resolveMcpServersFromGallery(infos) {
    const result = /* @__PURE__ */ new Map();
    const mcpGalleryManifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
    if (!mcpGalleryManifest) {
      for (const info of infos) {
        result.set(info.name, { status: McpGalleryResolveStatus.Failed });
      }
      return result;
    }
    await Promise.all(infos.map(async (info) => {
      try {
        const mcpServer = await this.getMcpServerByName(info, mcpGalleryManifest);
        result.set(info.name, mcpServer ? { status: McpGalleryResolveStatus.Found, server: mcpServer } : { status: McpGalleryResolveStatus.NotFound });
      } catch (error) {
        this.logService.warn(`Failed to resolve MCP server '${info.name}' from gallery: ${error}`);
        result.set(info.name, { status: McpGalleryResolveStatus.Failed });
      }
    }));
    return result;
  }
  async getMcpServerByName({ name, id }, mcpGalleryManifest) {
    const urls = [
      this.getLatestServerVersionUrl(name, mcpGalleryManifest),
      this.getNamedServerUrl(name, mcpGalleryManifest),
      id ? this.getServerIdUrl(id, mcpGalleryManifest) : void 0
    ];
    let attempted = false;
    let lastError;
    for (const url of urls) {
      if (!url) {
        continue;
      }
      attempted = true;
      try {
        const mcpServer = await this.getMcpServer(url);
        if (mcpServer) {
          if (mcpServer.name === name) {
            return mcpServer;
          }
          lastError = new Error(`MCP server lookup for '${name}' returned '${mcpServer.name}'`);
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!attempted) {
      throw new Error(`Cannot resolve MCP server '${name}': registry manifest has no server lookup endpoint`);
    }
    if (lastError !== void 0) {
      throw lastError;
    }
    return void 0;
  }
  async getReadme(gallery, token) {
    const readmeUrl = gallery.readmeUrl;
    if (!readmeUrl) {
      return Promise.resolve(localize("noReadme", "No README available"));
    }
    const uri = URI.parse(readmeUrl);
    if (uri.scheme === Schemas.file) {
      try {
        const content = await this.fileService.readFile(uri);
        return content.value.toString();
      } catch (error) {
        this.logService.error(`Failed to read file from ${uri}: ${error}`);
      }
    }
    if (uri.authority !== "raw.githubusercontent.com") {
      return new MarkdownString(localize("readme.viewInBrowser", "You can find information about this server [here]({0})", readmeUrl)).value;
    }
    const context = await this.requestService.request({
      type: "GET",
      url: readmeUrl,
      callSite: "mcpGalleryService.getReadme"
    }, token);
    const result = await asText(context);
    if (!result) {
      throw new Error(`Failed to fetch README from ${readmeUrl}`);
    }
    return result;
  }
  toGalleryMcpServer(server, manifest) {
    let publisher = "";
    let displayName = server.title;
    if (server.githubInfo?.name) {
      if (!displayName) {
        displayName = server.githubInfo.name.split("-").map((s) => s.toLowerCase() === "mcp" ? "MCP" : s.toLowerCase() === "github" ? "GitHub" : uppercaseFirstLetter(s)).join(" ");
      }
      publisher = server.githubInfo.nameWithOwner.split("/")[0];
    } else {
      const nameParts = server.name.split("/");
      if (nameParts.length > 0) {
        const domainParts = nameParts[0].split(".");
        if (domainParts.length > 0) {
          publisher = domainParts[domainParts.length - 1];
        }
      }
      if (!displayName) {
        displayName = nameParts[nameParts.length - 1].split("-").map((s) => uppercaseFirstLetter(s)).join(" ");
      }
    }
    if (server.githubInfo?.displayName) {
      displayName = server.githubInfo.displayName;
    }
    let icon;
    if (server.githubInfo?.preferredImage) {
      icon = {
        light: server.githubInfo.preferredImage,
        dark: server.githubInfo.preferredImage
      };
    } else if (server.githubInfo?.ownerAvatarUrl) {
      icon = {
        light: server.githubInfo.ownerAvatarUrl,
        dark: server.githubInfo.ownerAvatarUrl
      };
    } else if (server.apicInfo?.["x-ms-icon"]) {
      icon = {
        light: server.apicInfo["x-ms-icon"],
        dark: server.apicInfo["x-ms-icon"]
      };
    } else if (server.icons && server.icons.length > 0) {
      const lightIcon = server.icons.find((icon2) => icon2.theme === "light") ?? server.icons[0];
      const darkIcon = server.icons.find((icon2) => icon2.theme === "dark") ?? lightIcon;
      icon = {
        light: lightIcon.src,
        dark: darkIcon.src
      };
    }
    const webUrl = manifest ? this.getWebUrl(server.name, manifest) : void 0;
    const publisherUrl = manifest ? this.getPublisherUrl(publisher, manifest) : void 0;
    return {
      id: server.id,
      name: server.name,
      displayName,
      galleryUrl: manifest?.url,
      webUrl,
      description: server.description,
      status: server.status ?? GalleryMcpServerStatus.Active,
      version: server.version,
      isLatest: server.registryInfo?.isLatest ?? true,
      publishDate: server.registryInfo?.publishedAt ? Date.parse(server.registryInfo.publishedAt) : void 0,
      lastUpdated: server.githubInfo?.pushedAt ? Date.parse(server.githubInfo.pushedAt) : server.registryInfo?.updatedAt ? Date.parse(server.registryInfo.updatedAt) : void 0,
      repositoryUrl: server.repository?.url,
      readme: server.readme,
      icon,
      publisher,
      publisherUrl,
      license: server.githubInfo?.license,
      starsCount: server.githubInfo?.stargazerCount,
      topics: server.githubInfo?.topics,
      configuration: {
        packages: server.packages,
        remotes: server.remotes
      }
    };
  }
  async queryGalleryMcpServers(query, mcpGalleryManifest, token) {
    const { servers, metadata } = await this.queryRawGalleryMcpServers(query, mcpGalleryManifest, token);
    return {
      servers: servers.map((item) => this.toGalleryMcpServer(item, mcpGalleryManifest)),
      metadata
    };
  }
  async queryRawGalleryMcpServers(query, mcpGalleryManifest, token) {
    const mcpGalleryUrl = this.getMcpGalleryUrl(mcpGalleryManifest);
    if (!mcpGalleryUrl) {
      return { servers: [], metadata: { count: 0 } };
    }
    const uri = URI.parse(mcpGalleryUrl);
    if (uri.scheme === Schemas.file) {
      try {
        const content = await this.fileService.readFile(uri);
        const data2 = content.value.toString();
        return JSON.parse(data2);
      } catch (error) {
        this.logService.error(`Failed to read file from ${uri}: ${error}`);
      }
    }
    let url = `${mcpGalleryUrl}?limit=${query.pageSize}&version=latest`;
    if (query.cursor) {
      url += `&cursor=${query.cursor}`;
    }
    if (query.searchText) {
      const text = encodeURIComponent(query.searchText);
      url += `&search=${text}`;
    }
    let context;
    try {
      context = await this.requestService.request({
        type: "GET",
        url,
        callSite: "mcpGalleryService.queryMcpServers"
      }, token);
    } catch (error) {
      if (isCancellationError(error)) {
        throw error;
      }
      this.logService.error(`Failed to query MCP gallery: ${error}`);
      return { servers: [], metadata: { count: 0 } };
    }
    if (!isSuccess(context)) {
      this.logService.error(`Failed to query MCP gallery: Server returned ${context.res.statusCode}`);
      return { servers: [], metadata: { count: 0 } };
    }
    const data = await asJson(context);
    if (!data) {
      return { servers: [], metadata: { count: 0 } };
    }
    const result = this.serializeMcpServersResult(data, mcpGalleryManifest);
    if (!result) {
      throw new Error(`Failed to serialize MCP servers result from ${mcpGalleryUrl}`, data);
    }
    return result;
  }
  async getMcpServer(mcpServerUrl, mcpGalleryManifest) {
    const context = await this.requestService.request({
      type: "GET",
      url: mcpServerUrl,
      callSite: "mcpGalleryService.getMcpServer"
    }, CancellationToken.None);
    if (context.res.statusCode === 404) {
      return void 0;
    }
    if (context.res.statusCode && context.res.statusCode >= 400) {
      throw new Error(`Failed to fetch MCP server from ${mcpServerUrl}: server responded with ${context.res.statusCode}`);
    }
    const data = await asJson(context);
    if (!data) {
      throw new Error(`Failed to fetch MCP server from ${mcpServerUrl}: empty response`);
    }
    if (!mcpGalleryManifest) {
      mcpGalleryManifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
    }
    mcpGalleryManifest = mcpGalleryManifest && mcpServerUrl.startsWith(mcpGalleryManifest.url) ? mcpGalleryManifest : null;
    const server = this.serializeMcpServer(data, mcpGalleryManifest);
    if (!server) {
      throw new Error(`Failed to serialize MCP server from ${mcpServerUrl}`, data);
    }
    return this.toGalleryMcpServer(server, mcpGalleryManifest);
  }
  serializeMcpServer(data, mcpGalleryManifest) {
    return this.getSerializer(mcpGalleryManifest)?.toRawGalleryMcpServer(data);
  }
  serializeMcpServersResult(data, mcpGalleryManifest) {
    return this.getSerializer(mcpGalleryManifest)?.toRawGalleryMcpServerResult(data);
  }
  getSerializer(mcpGalleryManifest) {
    const version = mcpGalleryManifest?.version ?? "v0";
    return this.galleryMcpServerDataSerializers.get(version);
  }
  getNamedServerUrl(name, mcpGalleryManifest) {
    const namedResourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, McpGalleryResourceType.McpServerNamedResourceUri);
    if (!namedResourceUriTemplate) {
      return void 0;
    }
    return format2(namedResourceUriTemplate, { name });
  }
  getServerIdUrl(id, mcpGalleryManifest) {
    const resourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, McpGalleryResourceType.McpServerIdUri);
    if (!resourceUriTemplate) {
      return void 0;
    }
    return format2(resourceUriTemplate, { id });
  }
  getLatestServerVersionUrl(name, mcpGalleryManifest) {
    const latestVersionResourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, McpGalleryResourceType.McpServerLatestVersionUri);
    if (!latestVersionResourceUriTemplate) {
      return void 0;
    }
    return format2(latestVersionResourceUriTemplate, { name: encodeURIComponent(name) });
  }
  getWebUrl(name, mcpGalleryManifest) {
    const resourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, McpGalleryResourceType.McpServerWebUri);
    if (!resourceUriTemplate) {
      return void 0;
    }
    return format2(resourceUriTemplate, { name });
  }
  getPublisherUrl(name, mcpGalleryManifest) {
    const resourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, McpGalleryResourceType.PublisherUriTemplate);
    if (!resourceUriTemplate) {
      return void 0;
    }
    return format2(resourceUriTemplate, { name });
  }
  getMcpGalleryUrl(mcpGalleryManifest) {
    return getMcpGalleryManifestResourceUri(mcpGalleryManifest, McpGalleryResourceType.McpServersQueryService);
  }
};
McpGalleryService = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IMcpGalleryManifestService)
], McpGalleryService);
export {
  McpGalleryService
};
