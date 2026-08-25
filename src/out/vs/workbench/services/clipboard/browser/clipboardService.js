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
import { localize } from "../../../../nls.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { BrowserClipboardService as BaseBrowserClipboardService } from "../../../../platform/clipboard/browser/clipboardService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
let BrowserClipboardService = class extends BaseBrowserClipboardService {
  constructor(notificationService, openerService, environmentService, logService, layoutService) {
    super(layoutService, logService);
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.environmentService = environmentService;
  }
  async writeText(text, type) {
    this.logService.trace("BrowserClipboardService#writeText called with type:", type, " with text.length:", text.length);
    if (!!this.environmentService.extensionTestsLocationURI && typeof type !== "string") {
      type = "vscode-tests";
    }
    this.logService.trace("BrowserClipboardService#super.writeText");
    return super.writeText(text, type);
  }
  async readText(type) {
    this.logService.trace("BrowserClipboardService#readText called with type:", type);
    if (!!this.environmentService.extensionTestsLocationURI && typeof type !== "string") {
      type = "vscode-tests";
    }
    if (type) {
      this.logService.trace("BrowserClipboardService#super.readText");
      return super.readText(type);
    }
    try {
      const readText = await getActiveWindow().navigator.clipboard.readText();
      this.logService.trace("BrowserClipboardService#readText with readText.length:", readText.length);
      return readText;
    } catch (error) {
      return new Promise((resolve) => {
        const listener = new DisposableStore();
        const handle = this.notificationService.prompt(
          Severity.Error,
          localize("clipboardError", "Unable to read from the browser's clipboard. Please make sure you have granted access for this website to read from the clipboard."),
          [{
            label: localize("retry", "Retry"),
            run: async () => {
              listener.dispose();
              resolve(await this.readText(type));
            }
          }, {
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2151362")
          }],
          {
            sticky: true
          }
        );
        listener.add(Event.once(handle.onDidClose)(() => resolve("")));
      });
    }
  }
};
BrowserClipboardService = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IOpenerService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILayoutService)
], BrowserClipboardService);
registerSingleton(IClipboardService, BrowserClipboardService, InstantiationType.Delayed);
export {
  BrowserClipboardService
};
