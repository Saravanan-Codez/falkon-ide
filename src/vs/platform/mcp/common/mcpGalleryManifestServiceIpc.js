import { Barrier } from "../../../base/common/async.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { McpGalleryManifestStatus } from "./mcpGalleryManifest.js";
class McpGalleryManifestIPCService extends Disposable {
  constructor(server) {
    super();
    this._onDidChangeMcpGalleryManifest = this._register(new Emitter());
    this.onDidChangeMcpGalleryManifest = this._onDidChangeMcpGalleryManifest.event;
    this._onDidChangeMcpGalleryManifestStatus = this._register(new Emitter());
    this.onDidChangeMcpGalleryManifestStatus = this._onDidChangeMcpGalleryManifestStatus.event;
    this.barrier = new Barrier();
    server.registerChannel("mcpGalleryManifest", {
      listen: () => Event.None,
      call: async (context, command, args) => {
        switch (command) {
          case "setMcpGalleryManifest": {
            const manifest = Array.isArray(args) ? args[0] : null;
            return Promise.resolve(this.setMcpGalleryManifest(manifest));
          }
        }
        throw new Error("Invalid call");
      }
    });
  }
  get mcpGalleryManifestStatus() {
    return this._mcpGalleryManifest ? McpGalleryManifestStatus.Available : McpGalleryManifestStatus.Unavailable;
  }
  async getMcpGalleryManifest() {
    await this.barrier.wait();
    return this._mcpGalleryManifest ?? null;
  }
  setMcpGalleryManifest(manifest) {
    this._mcpGalleryManifest = manifest;
    this._onDidChangeMcpGalleryManifest.fire(manifest);
    this._onDidChangeMcpGalleryManifestStatus.fire(this.mcpGalleryManifestStatus);
    this.barrier.open();
  }
}
export {
  McpGalleryManifestIPCService
};
