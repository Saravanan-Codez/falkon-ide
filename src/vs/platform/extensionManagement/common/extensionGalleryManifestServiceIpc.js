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
import { Barrier } from "../../../base/common/async.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { ExtensionGalleryManifestStatus } from "./extensionGalleryManifest.js";
import { ExtensionGalleryManifestService } from "./extensionGalleryManifestService.js";
let ExtensionGalleryManifestIPCService = class extends ExtensionGalleryManifestService {
  constructor(server, logService, productService) {
    super(productService);
    this.logService = logService;
    this._onDidChangeExtensionGalleryManifest = this._register(new Emitter());
    this.onDidChangeExtensionGalleryManifest = this._onDidChangeExtensionGalleryManifest.event;
    this._onDidChangeExtensionGalleryManifestStatus = this._register(new Emitter());
    this.onDidChangeExtensionGalleryManifestStatus = this._onDidChangeExtensionGalleryManifestStatus.event;
    this.barrier = new Barrier();
    server.registerChannel("extensionGalleryManifest", {
      listen: () => Event.None,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: async (context, command, args) => {
        switch (command) {
          case "setExtensionGalleryManifest":
            return Promise.resolve(this.setExtensionGalleryManifest(args[0]));
        }
        throw new Error("Invalid call");
      }
    });
  }
  get extensionGalleryManifestStatus() {
    return this._extensionGalleryManifest ? ExtensionGalleryManifestStatus.Available : ExtensionGalleryManifestStatus.Unavailable;
  }
  async getExtensionGalleryManifest() {
    await this.barrier.wait();
    return this._extensionGalleryManifest ?? null;
  }
  setExtensionGalleryManifest(manifest) {
    this.logService.trace(`[Marketplace] Setting manifest ${manifest ? "available" : "unavailable"}`);
    this._extensionGalleryManifest = manifest;
    this._onDidChangeExtensionGalleryManifest.fire(manifest);
    this._onDidChangeExtensionGalleryManifestStatus.fire(this.extensionGalleryManifestStatus);
    this.barrier.open();
  }
};
ExtensionGalleryManifestIPCService = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IProductService)
], ExtensionGalleryManifestIPCService);
export {
  ExtensionGalleryManifestIPCService
};
