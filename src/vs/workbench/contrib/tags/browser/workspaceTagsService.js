import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkspaceTagsService } from "../common/workspaceTags.js";
class NoOpWorkspaceTagsService {
  getTags() {
    return Promise.resolve({});
  }
  async getTelemetryWorkspaceId(workspace, state) {
    return void 0;
  }
  getHashedRemotesFromUri(workspaceUri, stripEndingDotGit) {
    return Promise.resolve([]);
  }
}
registerSingleton(IWorkspaceTagsService, NoOpWorkspaceTagsService, InstantiationType.Delayed);
export {
  NoOpWorkspaceTagsService
};
