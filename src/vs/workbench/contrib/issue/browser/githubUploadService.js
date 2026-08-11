import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IGitHubUploadService = createDecorator("githubUploadService");
class BrowserGitHubUploadService {
  async resolveRepositoryId() {
    throw new Error("Not supported in browser");
  }
  async uploadViaMobileApi() {
    throw new Error("Not supported in browser");
  }
}
export {
  BrowserGitHubUploadService,
  IGitHubUploadService
};
