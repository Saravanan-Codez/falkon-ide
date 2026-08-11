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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { hash } from "../../../../base/common/hash.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../files/common/files.js";
import { IAgentPluginManager } from "../../common/agentPluginManager.js";
import { customizationId } from "../../common/state/sessionState.js";
import { CustomizationType } from "../../common/state/protocol/state.js";
import { DiscoveredType } from "../copilot/sessionCustomizationDiscovery.js";
const DISPLAY_NAME = "VS Code Synced Data";
const HOST_DISCOVERY_DIR = "host-discovery";
const MANIFEST_CONTENT = JSON.stringify({
  name: DISPLAY_NAME,
  description: "Customization data discovered from this workspace and your home directory"
}, null, "	");
function pluginDirForType(type) {
  switch (type) {
    case DiscoveredType.Agent:
      return "agents";
    case DiscoveredType.Skill:
      return "skills";
    case DiscoveredType.Instruction:
      return "rules";
    case DiscoveredType.Hook:
      return "hooks";
    case DiscoveredType.AgentInstruction:
      return void 0;
  }
}
let SessionPluginBundler = class extends Disposable {
  constructor(workingDirectory, _fileService, pluginManager) {
    super();
    this._fileService = _fileService;
    const authority = `host-${hash(workingDirectory.toString())}`;
    this._rootUri = URI.joinPath(pluginManager.basePath, HOST_DISCOVERY_DIR, authority);
  }
  get rootUri() {
    return this._rootUri;
  }
  get lastNonce() {
    return this._lastNonce;
  }
  /**
   * Bundles the given files into the on-disk plugin directory.
   *
   * Overwrites any previous bundle for this working directory. Returns a
   * {@link ClientPluginCustomization} pointing at the on-disk plugin root
   * with a content-based nonce, or `undefined` when there are no files or
   * cancellation was requested.
   */
  async bundle(directories, token = CancellationToken.None) {
    if (directories.length === 0 || token.isCancellationRequested) {
      return void 0;
    }
    const hashParts = [];
    const files = [];
    for (const discoveredDirectory of directories) {
      const dir = pluginDirForType(discoveredDirectory.type);
      if (!dir) {
        continue;
      }
      for (const file of discoveredDirectory.files) {
        const fileUri = file.uri;
        const fileName = basename(fileUri);
        let destUri;
        let hashKey;
        if (discoveredDirectory.type === DiscoveredType.Skill) {
          const skillDirName = basename(dirname(fileUri));
          destUri = URI.joinPath(this._rootUri, dir, skillDirName, fileName);
          hashKey = `${dir}/${skillDirName}/${fileName}`;
        } else {
          destUri = URI.joinPath(this._rootUri, dir, fileName);
          hashKey = `${dir}/${fileName}`;
        }
        const content = await this._fileService.readFile(fileUri);
        if (token.isCancellationRequested) {
          return void 0;
        }
        files.push({ destUri, content: content.value });
        hashParts.push(`${hashKey}:${content.value.toString()}`);
      }
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    hashParts.sort();
    const nonce = String(hash(hashParts.join("\n")));
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
    if (this._lastNonce === nonce) {
      return result;
    }
    try {
      await this._fileService.del(this._rootUri, { recursive: true });
    } catch {
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const manifestUri = URI.joinPath(this._rootUri, ".plugin", "plugin.json");
    await this._fileService.createFolder(dirname(manifestUri));
    if (token.isCancellationRequested) {
      return void 0;
    }
    await this._fileService.writeFile(manifestUri, VSBuffer.fromString(MANIFEST_CONTENT));
    if (token.isCancellationRequested) {
      return void 0;
    }
    for (const file of files) {
      await this._fileService.createFolder(dirname(file.destUri));
      if (token.isCancellationRequested) {
        return void 0;
      }
      await this._fileService.writeFile(file.destUri, file.content);
      if (token.isCancellationRequested) {
        return void 0;
      }
    }
    this._lastNonce = nonce;
    return result;
  }
};
SessionPluginBundler = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IAgentPluginManager)
], SessionPluginBundler);
export {
  SessionPluginBundler
};
