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
import { Codicon } from "../../../../../base/common/codicons.js";
import {
  escapeMarkdownSyntaxTokens,
  MarkdownString
} from "../../../../../base/common/htmlContent.js";
import { isAuxiliaryWindow } from "../../../../../base/browser/window.js";
import { getWindowById } from "../../../../../base/browser/dom.js";
import { getZoomFactor } from "../../../../../base/browser/browser.js";
import { localize } from "../../../../../nls.js";
import { IPlaywrightService } from "../../../../../platform/browserView/common/playwrightService.js";
import { readImageDimensions } from "../../../../../base/common/image.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { GroupsOrder, IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { ToolDataSource } from "../../../chat/common/tools/languageModelToolsService.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { BrowserEditorInput } from "../../common/browserEditorInput.js";
import { errorResult, getSessionId, playwrightInvokeRaw } from "./browserToolHelpers.js";
import { BrowserChatToolReferenceName } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { OpenPageToolId } from "./openBrowserTool.js";
import { ReadBrowserToolData } from "./readBrowserTool.js";
const ScreenshotBrowserToolData = {
  id: "screenshot_page",
  toolReferenceName: BrowserChatToolReferenceName.ScreenshotPage,
  displayName: localize("screenshotBrowserTool.displayName", "Screenshot Page"),
  userDescription: localize("screenshotBrowserTool.userDescription", "Capture a screenshot of a browser page"),
  modelDescription: `Capture a screenshot of the current browser page. You can't perform actions based on the screenshot; use ${ReadBrowserToolData.id} for actions.`,
  icon: Codicon.deviceCamera,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID to capture, acquired from context or the open tool.`
      },
      ref: {
        type: "string",
        description: "Element reference to capture. If omitted, captures the whole viewport."
      },
      selector: {
        type: "string",
        description: 'Playwright selector of an element to capture when "ref" is not available. If omitted, captures the whole viewport.'
      },
      element: {
        type: "string",
        description: 'Human-readable description of the element to capture (e.g., "chart diagram", "product image").'
      },
      scrollIntoViewIfNeeded: {
        type: "boolean",
        description: "Whether to scroll the element into view before capturing. Defaults to false."
      }
    },
    required: ["pageId"]
  }
};
let ScreenshotBrowserTool = class {
  constructor(browserViewWorkbenchService, playwrightService, telemetryService, editorGroupsService) {
    this.browserViewWorkbenchService = browserViewWorkbenchService;
    this.playwrightService = playwrightService;
    this.telemetryService = telemetryService;
    this.editorGroupsService = editorGroupsService;
  }
  async prepareToolInvocation(_context, _token) {
    const params = _context.parameters;
    if (params.element) {
      const element = escapeMarkdownSyntaxTokens(params.element);
      return {
        invocationMessage: new MarkdownString(localize("browser.screenshot.invocation.element", "Capturing screenshot of {0}", element)),
        pastTenseMessage: new MarkdownString(localize("browser.screenshot.past.element", "Captured screenshot of {0}", element))
      };
    }
    return {
      invocationMessage: localize("browser.screenshot.invocation", "Capturing browser screenshot"),
      pastTenseMessage: localize("browser.screenshot.past", "Captured browser screenshot")
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    let selector = params.selector;
    if (params.ref) {
      selector = `aria-ref=${params.ref}`;
    }
    const browserViewModel = await this.browserViewWorkbenchService.getKnownBrowserViews().get(params.pageId)?.resolve();
    if (!browserViewModel) {
      return errorResult(`No browser page found with ID ${params.pageId}`);
    }
    const bounds = selector && await playwrightInvokeRaw(this.playwrightService, sessionId, params.pageId, async (page, selector2, scrollIntoViewIfNeeded) => {
      const locator = page.locator(selector2);
      if (scrollIntoViewIfNeeded) {
        await locator.scrollIntoViewIfNeeded();
      }
      return locator.boundingBox();
    }, selector, params.scrollIntoViewIfNeeded) || void 0;
    const screenshot = await browserViewModel.captureScreenshot({ pageRect: bounds });
    const dimensions = readImageDimensions(screenshot);
    const hostWindow = this.findBrowserViewHostWindow(browserViewModel);
    this.telemetryService.publicLog2("integratedBrowser.tools.screenshot.captured", {
      // Screenshot tool options
      screenshotType: bounds ? "element" : "viewport",
      selectorSource: params.ref ? "ref" : params.selector ? "selector" : "none",
      scrollIntoViewIfNeeded: !!params.scrollIntoViewIfNeeded,
      // Image metadata
      imageWidth: dimensions?.width,
      imageHeight: dimensions?.height,
      byteLength: screenshot.byteLength,
      // Conversion factors
      windowZoomFactor: hostWindow && getZoomFactor(hostWindow),
      windowDevicePixelRatio: hostWindow?.devicePixelRatio,
      browserZoomFactor: browserViewModel.zoomFactor,
      // Window metadata
      windowInnerWidth: hostWindow?.innerWidth,
      windowInnerHeight: hostWindow?.innerHeight,
      isInAuxiliaryWindow: hostWindow && isAuxiliaryWindow(hostWindow),
      isBrowserViewVisible: browserViewModel.visible,
      // Screen metadata
      screenWidth: hostWindow?.screen.width,
      screenHeight: hostWindow?.screen.height,
      screenAvailWidth: hostWindow?.screen.availWidth,
      screenAvailHeight: hostWindow?.screen.availHeight
    });
    return {
      content: [
        {
          kind: "data",
          value: {
            mimeType: "image/jpeg",
            data: screenshot
          }
        }
      ]
    };
  }
  findBrowserViewHostWindow(model) {
    for (const group of this.editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      for (const editor of group.editors) {
        if (editor instanceof BrowserEditorInput && editor.id === model.id) {
          return getWindowById(group.windowId, true).window;
        }
      }
    }
    return void 0;
  }
};
ScreenshotBrowserTool = __decorateClass([
  __decorateParam(0, IBrowserViewWorkbenchService),
  __decorateParam(1, IPlaywrightService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IEditorGroupsService)
], ScreenshotBrowserTool);
export {
  ScreenshotBrowserTool,
  ScreenshotBrowserToolData
};
