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
import { VSBuffer } from "../../../../../../base/common/buffer.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { basename, dirname } from "../../../../../../base/common/resources.js";
import { URI } from "../../../../../../base/common/uri.js";
import { hash } from "../../../../../../base/common/hash.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { PromptsType } from "../../../common/promptSyntax/promptTypes.js";
import { customizationId } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { CustomizationType } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { IAgentHostFileSystemService, SYNCED_CUSTOMIZATION_SCHEME } from "../../../../../../workbench/services/agentHost/common/agentHostFileSystemService.js";
const DISPLAY_NAME = "VS Code Synced Data";
const MANIFEST_CONTENT = JSON.stringify({
  name: DISPLAY_NAME,
  description: "Customization data synced from VS Code"
}, null, "	");
function pluginDirForType(type) {
  switch (type) {
    case PromptsType.instructions:
      return "rules";
    case PromptsType.prompt:
      return "commands";
    case PromptsType.agent:
      return "agents";
    case PromptsType.skill:
      return "skills";
    case PromptsType.hook:
      return void 0;
  }
}
let SyncedCustomizationBundler = class extends Disposable {
  constructor(authority, _fileService, agentHostFileSystemService) {
    super();
    this._fileService = _fileService;
    /** Maps a synced (destination) URI string back to its original source location. Rebuilt on every {@link bundle}. */
    this._originByDest = /* @__PURE__ */ new Map();
    this._authority = authority;
    agentHostFileSystemService.ensureSyncedCustomizationProvider();
  }
  /**
   * Root URI of the virtual plugin directory for this bundler.
   * The authority is encoded into the path (not the URI authority) because
   * {@link InMemoryFileSystemProvider} only routes by path.
   */
  get _rootUri() {
    return URI.from({ scheme: SYNCED_CUSTOMIZATION_SCHEME, path: `/${this._authority}` });
  }
  /**
   * Bundles the given files and MCP servers into the in-memory plugin
   * filesystem.
   *
   * Overwrites any previous bundle content. Returns a {@link ClientPluginCustomization}
   * pointing at the virtual plugin directory with a content-based nonce.
   *
   * @returns The bundle result, or `undefined` if there is nothing to sync.
   */
  async bundle(files, mcpServers = []) {
    const syncable = files.filter((f) => pluginDirForType(f.type) !== void 0);
    if (syncable.length === 0 && mcpServers.length === 0) {
      return void 0;
    }
    const entries = [];
    const originByDest = /* @__PURE__ */ new Map();
    await Promise.all(syncable.map(async (file) => {
      const dir = pluginDirForType(file.type);
      const fileName = basename(file.uri);
      let destUri;
      let hashKey;
      if (file.type === PromptsType.skill && fileName.toLowerCase() === "skill.md") {
        const skillDirName = basename(dirname(file.uri));
        destUri = URI.joinPath(this._rootUri, dir, skillDirName, fileName);
        hashKey = `${dir}/${skillDirName}/${fileName}`;
      } else {
        destUri = URI.joinPath(this._rootUri, dir, fileName);
        hashKey = `${dir}/${fileName}`;
      }
      if (file.source !== void 0) {
        originByDest.set(destUri.toString(), {
          uri: file.uri,
          source: file.source,
          extensionId: file.extensionId,
          pluginUri: file.pluginUri
        });
      }
      const content = await this._fileService.readFile(file.uri);
      entries.push({ destUri, content: content.value, hashPart: `${hashKey}:${content.value.toString()}` });
    }));
    this._originByDest = originByDest;
    let mcpContent;
    if (mcpServers.length > 0) {
      const servers = {};
      for (const server of [...mcpServers].sort((a, b) => a.name.localeCompare(b.name))) {
        servers[server.name] = server.configuration;
      }
      mcpContent = JSON.stringify({ mcpServers: servers }, null, "	");
    }
    const hashParts = entries.map((e) => e.hashPart);
    if (mcpContent !== void 0) {
      hashParts.push(`.mcp.json:${mcpContent}`);
    }
    hashParts.sort();
    const nonce = String(hash(hashParts.join("\n")));
    if (nonce === this._lastNonce && this._lastRef) {
      return this._lastRef;
    }
    try {
      await this._fileService.del(this._rootUri, { recursive: true });
    } catch {
    }
    const manifestUri = URI.joinPath(this._rootUri, ".plugin", "plugin.json");
    await this._fileService.writeFile(manifestUri, VSBuffer.fromString(MANIFEST_CONTENT));
    for (const entry of entries) {
      await this._fileService.writeFile(entry.destUri, entry.content);
    }
    if (mcpContent !== void 0) {
      const mcpUri = URI.joinPath(this._rootUri, ".mcp.json");
      await this._fileService.writeFile(mcpUri, VSBuffer.fromString(mcpContent));
    }
    this._lastNonce = nonce;
    const rootUriString = this._rootUri.toString();
    const result = {
      ref: {
        type: CustomizationType.Plugin,
        id: customizationId(rootUriString),
        uri: rootUriString,
        name: DISPLAY_NAME,
        enabled: true,
        nonce
      }
    };
    this._lastRef = result;
    return result;
  }
  /**
   * Returns the last computed nonce, or `undefined` if no bundle has been created.
   */
  get lastNonce() {
    return this._lastNonce;
  }
  /**
   * Recovers the original provenance of a file that was flattened into the
   * synthetic bundle, given its synced (destination) URI. Returns `undefined`
   * for URIs that are not part of the most recent bundle.
   */
  getOrigin(syncedUri) {
    return this._originByDest.get(syncedUri.toString());
  }
};
SyncedCustomizationBundler = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IAgentHostFileSystemService)
], SyncedCustomizationBundler);
export {
  SYNCED_CUSTOMIZATION_SCHEME,
  SyncedCustomizationBundler
};
