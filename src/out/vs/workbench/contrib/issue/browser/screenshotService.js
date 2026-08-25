import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IScreenshotService = createDecorator("screenshotService");
class BrowserScreenshotService {
  async captureScreenshot(_rect) {
    return void 0;
  }
}
export {
  BrowserScreenshotService,
  IScreenshotService
};
