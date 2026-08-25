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
import * as nls from "../../../nls.js";
import { addDisposableListener, getActiveWindow } from "../../../base/browser/dom.js";
import { createFastDomNode } from "../../../base/browser/fastDomNode.js";
import { Color } from "../../../base/common/color.js";
import { BugIndicatingError } from "../../../base/common/errors.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { observableValue, runOnChange } from "../../../base/common/observable.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { TextureAtlas } from "./atlas/textureAtlas.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { INotificationService, Severity } from "../../../platform/notification/common/notification.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { GPULifecycle } from "./gpuDisposable.js";
import { ensureNonNullable, observeDevicePixelDimensions } from "./gpuUtils.js";
import { RectangleRenderer } from "./rectangleRenderer.js";
import { DecorationCssRuleExtractor } from "./css/decorationCssRuleExtractor.js";
import { Event } from "../../../base/common/event.js";
import { EditorOption } from "../../common/config/editorOptions.js";
import { DecorationStyleCache } from "./css/decorationStyleCache.js";
import { InlineDecorationType } from "../../common/viewModel/inlineDecorations.js";
let ViewGpuContext = class extends Disposable {
  constructor(context, _instantiationService, _notificationService, configurationService, _themeService) {
    super();
    this._instantiationService = _instantiationService;
    this._notificationService = _notificationService;
    this.configurationService = configurationService;
    this._themeService = _themeService;
    /**
     * The hard cap for line columns rendered by the GPU renderer.
     */
    this.maxGpuCols = 2e3;
    this.canvas = createFastDomNode(document.createElement("canvas"));
    this.canvas.setClassName("editorCanvas");
    this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration("editor.scrollbar.verticalScrollbarSize")) {
        const verticalScrollbarSize = configurationService.getValue("editor").scrollbar?.verticalScrollbarSize ?? 14;
        this.canvas.domNode.style.boxSizing = "border-box";
        this.canvas.domNode.style.paddingRight = `${verticalScrollbarSize}px`;
      }
    }));
    this.ctx = ensureNonNullable(this.canvas.domNode.getContext("webgpu"));
    if (!ViewGpuContext.device) {
      ViewGpuContext.device = GPULifecycle.requestDevice((message) => {
        const choices = [{
          label: nls.localize("editor.dom.render", "Use DOM-based rendering"),
          run: () => this.configurationService.updateValue("editor.experimentalGpuAcceleration", "off")
        }];
        this._notificationService.prompt(Severity.Warning, message, choices);
      }).then((ref) => {
        ViewGpuContext.deviceSync = ref.object;
        if (!ViewGpuContext._atlas) {
          ViewGpuContext._atlas = this._instantiationService.createInstance(TextureAtlas, ref.object.limits.maxTextureDimension2D, void 0, ViewGpuContext.decorationStyleCache);
        }
        return ref.object;
      });
    }
    const dprObs = observableValue(this, getActiveWindow().devicePixelRatio);
    this._register(addDisposableListener(getActiveWindow(), "resize", () => {
      dprObs.set(getActiveWindow().devicePixelRatio, void 0);
    }));
    this.devicePixelRatio = dprObs;
    this._register(runOnChange(this.devicePixelRatio, () => ViewGpuContext.atlas?.clear()));
    this._register(this._themeService.onDidColorThemeChange(() => {
      ViewGpuContext.decorationCssRuleExtractor.clear();
      ViewGpuContext.atlas?.clear();
    }));
    const canvasDevicePixelDimensions = observableValue(this, { width: this.canvas.domNode.width, height: this.canvas.domNode.height });
    this._register(observeDevicePixelDimensions(
      this.canvas.domNode,
      getActiveWindow(),
      (width, height) => {
        this.canvas.domNode.width = width;
        this.canvas.domNode.height = height;
        canvasDevicePixelDimensions.set({ width, height }, void 0);
      }
    ));
    this.canvasDevicePixelDimensions = canvasDevicePixelDimensions;
    const contentLeft = observableValue(this, 0);
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      contentLeft.set(context.configuration.options.get(EditorOption.layoutInfo).contentLeft, void 0);
    }));
    this.contentLeft = contentLeft;
    this.rectangleRenderer = this._register(this._instantiationService.createInstance(RectangleRenderer, context, this.contentLeft, this.devicePixelRatio, this.canvas.domNode, this.ctx, ViewGpuContext.device));
  }
  static {
    this._decorationCssRuleExtractor = new DecorationCssRuleExtractor();
  }
  static get decorationCssRuleExtractor() {
    return ViewGpuContext._decorationCssRuleExtractor;
  }
  static {
    this._decorationStyleCache = new DecorationStyleCache();
  }
  static get decorationStyleCache() {
    return ViewGpuContext._decorationStyleCache;
  }
  /**
   * The shared texture atlas to use across all views.
   *
   * @throws if called before the GPU device is resolved
   */
  static get atlas() {
    if (!ViewGpuContext._atlas) {
      throw new BugIndicatingError("Cannot call ViewGpuContext.textureAtlas before device is resolved");
    }
    return ViewGpuContext._atlas;
  }
  /**
   * The shared texture atlas to use across all views. This is a convenience alias for
   * {@link ViewGpuContext.atlas}.
   *
   * @throws if called before the GPU device is resolved
   */
  get atlas() {
    return ViewGpuContext.atlas;
  }
  /**
   * This method determines which lines can be and are allowed to be rendered using the GPU
   * renderer. Eventually this should trend all lines, except maybe exceptional cases like
   * decorations that use class names.
   */
  canRender(options, viewportData, lineNumber) {
    const data = viewportData.getViewLineRenderingData(lineNumber);
    if (data.containsRTL || data.maxColumn > this.maxGpuCols) {
      return false;
    }
    if (data.inlineDecorations.length > 0) {
      let supported = true;
      for (const decoration of data.inlineDecorations) {
        if (decoration.type !== InlineDecorationType.Regular) {
          supported = false;
          break;
        }
        const styleRules = ViewGpuContext._decorationCssRuleExtractor.getStyleRules(this.canvas.domNode, decoration.inlineClassName);
        supported &&= styleRules.every((rule) => {
          if (rule.selectorText.includes(":")) {
            return false;
          }
          for (const r of rule.style) {
            if (!supportsCssRule(r, rule.style)) {
              return false;
            }
          }
          return true;
        });
        if (!supported) {
          break;
        }
      }
      return supported;
    }
    return true;
  }
  /**
   * Like {@link canRender} but returns detailed information about why the line cannot be rendered.
   */
  canRenderDetailed(options, viewportData, lineNumber) {
    const data = viewportData.getViewLineRenderingData(lineNumber);
    const reasons = [];
    if (data.containsRTL) {
      reasons.push("containsRTL");
    }
    if (data.maxColumn > this.maxGpuCols) {
      reasons.push("maxColumn > maxGpuCols");
    }
    if (data.inlineDecorations.length > 0) {
      let supported = true;
      const problemTypes = [];
      const problemSelectors = [];
      const problemRules = [];
      for (const decoration of data.inlineDecorations) {
        if (decoration.type !== InlineDecorationType.Regular) {
          problemTypes.push(decoration.type);
          supported = false;
          continue;
        }
        const styleRules = ViewGpuContext._decorationCssRuleExtractor.getStyleRules(this.canvas.domNode, decoration.inlineClassName);
        supported &&= styleRules.every((rule) => {
          if (rule.selectorText.includes(":")) {
            problemSelectors.push(rule.selectorText);
            return false;
          }
          for (const r of rule.style) {
            if (!supportsCssRule(r, rule.style)) {
              problemRules.push(`${r}: ${rule.style[r]}`);
              return false;
            }
          }
          return true;
        });
        if (!supported) {
          continue;
        }
      }
      if (problemTypes.length > 0) {
        reasons.push(`inlineDecorations with unsupported types (${problemTypes.map((e) => `\`${e}\``).join(", ")})`);
      }
      if (problemRules.length > 0) {
        reasons.push(`inlineDecorations with unsupported CSS rules (${problemRules.map((e) => `\`${e}\``).join(", ")})`);
      }
      if (problemSelectors.length > 0) {
        reasons.push(`inlineDecorations with unsupported CSS selectors (${problemSelectors.map((e) => `\`${e}\``).join(", ")})`);
      }
    }
    return reasons;
  }
};
ViewGpuContext = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IThemeService)
], ViewGpuContext);
const gpuSupportedDecorationCssRules = [
  "color",
  "font-weight",
  "opacity",
  "text-decoration",
  "text-decoration-color",
  "text-decoration-line",
  "text-decoration-style",
  "text-decoration-thickness"
];
function supportsCssRule(rule, style) {
  if (!gpuSupportedDecorationCssRules.includes(rule)) {
    return false;
  }
  switch (rule) {
    case "text-decoration":
    case "text-decoration-line": {
      const value = style.getPropertyValue(rule);
      return value === "line-through";
    }
    case "text-decoration-color": {
      const value = style.getPropertyValue(rule);
      if (/^var\(--[^,]+,\s*(?:initial|inherit)\)$/.test(value)) {
        return true;
      }
      return Color.Format.CSS.parse(value) !== null;
    }
    case "text-decoration-style": {
      const value = style.getPropertyValue(rule);
      return value === "initial";
    }
    case "text-decoration-thickness": {
      const value = style.getPropertyValue(rule);
      return value === "initial" || /^\d+(\.\d+)?px$/.test(value);
    }
    default:
      return true;
  }
}
export {
  ViewGpuContext
};
