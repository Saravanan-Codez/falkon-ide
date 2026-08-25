import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { FileSystemProviderCapabilities, FileType, hasReadWriteCapability } from "../../../../platform/files/common/files.js";
import { isEqual } from "../../../../base/common/resources.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
class LocalHistoryFileSystemProvider {
  constructor(fileService) {
    this.fileService = fileService;
    this.mapSchemeToProvider = /* @__PURE__ */ new Map();
    //#endregion
    //#region Unsupported File Operations
    this.onDidChangeCapabilities = Event.None;
    this.onDidChangeFile = Event.None;
  }
  static {
    this.SCHEMA = "vscode-local-history";
  }
  static toLocalHistoryFileSystem(resource) {
    const serializedLocalHistoryResource = {
      location: resource.location.toString(true),
      associatedResource: resource.associatedResource.toString(true)
    };
    return resource.associatedResource.with({
      scheme: LocalHistoryFileSystemProvider.SCHEMA,
      query: JSON.stringify(serializedLocalHistoryResource)
    });
  }
  static fromLocalHistoryFileSystem(resource) {
    const serializedLocalHistoryResource = JSON.parse(resource.query);
    return {
      location: URI.parse(serializedLocalHistoryResource.location),
      associatedResource: URI.parse(serializedLocalHistoryResource.associatedResource)
    };
  }
  static {
    this.EMPTY_RESOURCE = URI.from({ scheme: LocalHistoryFileSystemProvider.SCHEMA, path: "/empty" });
  }
  static {
    this.EMPTY = {
      location: LocalHistoryFileSystemProvider.EMPTY_RESOURCE,
      associatedResource: LocalHistoryFileSystemProvider.EMPTY_RESOURCE
    };
  }
  get capabilities() {
    return FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.Readonly;
  }
  async withProvider(resource) {
    const scheme = resource.scheme;
    let providerPromise = this.mapSchemeToProvider.get(scheme);
    if (!providerPromise) {
      const provider = this.fileService.getProvider(scheme);
      if (provider) {
        providerPromise = Promise.resolve(provider);
      } else {
        providerPromise = new Promise((resolve) => {
          const disposable = this.fileService.onDidChangeFileSystemProviderRegistrations((e) => {
            if (e.added && e.provider && e.scheme === scheme) {
              disposable.dispose();
              resolve(e.provider);
            }
          });
        });
      }
      this.mapSchemeToProvider.set(scheme, providerPromise);
    }
    return providerPromise;
  }
  //#region Supported File Operations
  async stat(resource) {
    const location = LocalHistoryFileSystemProvider.fromLocalHistoryFileSystem(resource).location;
    if (isEqual(LocalHistoryFileSystemProvider.EMPTY_RESOURCE, location)) {
      return { type: FileType.File, ctime: 0, mtime: 0, size: 0 };
    }
    return (await this.withProvider(location)).stat(location);
  }
  async readFile(resource) {
    const location = LocalHistoryFileSystemProvider.fromLocalHistoryFileSystem(resource).location;
    if (isEqual(LocalHistoryFileSystemProvider.EMPTY_RESOURCE, location)) {
      return VSBuffer.fromString("").buffer;
    }
    const provider = await this.withProvider(location);
    if (hasReadWriteCapability(provider)) {
      return provider.readFile(location);
    }
    throw new Error("Unsupported");
  }
  async writeFile(resource, content, opts) {
  }
  async mkdir(resource) {
  }
  async readdir(resource) {
    return [];
  }
  async rename(from, to, opts) {
  }
  async delete(resource, opts) {
  }
  watch(resource, opts) {
    return Disposable.None;
  }
  //#endregion
}
export {
  LocalHistoryFileSystemProvider
};
