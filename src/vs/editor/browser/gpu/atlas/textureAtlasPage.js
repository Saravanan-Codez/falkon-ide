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
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { NKeyMap } from "../../../../base/common/map.js";
import { ILogService, LogLevel } from "../../../../platform/log/common/log.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { TextureAtlasShelfAllocator } from "./textureAtlasShelfAllocator.js";
import { TextureAtlasSlabAllocator } from "./textureAtlasSlabAllocator.js";
let TextureAtlasPage = class extends Disposable {
  constructor(textureIndex, pageSize, allocatorType, _logService, themeService) {
    super();
    this._logService = _logService;
    this._version = 0;
    this._usedArea = { left: 0, top: 0, right: 0, bottom: 0 };
    this._glyphMap = new NKeyMap();
    this._glyphInOrderSet = /* @__PURE__ */ new Set();
    this._canvas = new OffscreenCanvas(pageSize, pageSize);
    this._colorMap = themeService.getColorTheme().tokenColorMap;
    switch (allocatorType) {
      case "shelf":
        this._allocator = new TextureAtlasShelfAllocator(this._canvas, textureIndex);
        break;
      case "slab":
        this._allocator = new TextureAtlasSlabAllocator(this._canvas, textureIndex);
        break;
      default:
        this._allocator = allocatorType(this._canvas, textureIndex);
        break;
    }
    this._register(toDisposable(() => {
      this._canvas.width = 1;
      this._canvas.height = 1;
    }));
  }
  get version() {
    return this._version;
  }
  static {
    /**
     * The maximum number of glyphs that can be drawn to the page. This is currently a hard static
     * cap that must not be reached as it will cause the GPU buffer to overflow.
     */
    this.maximumGlyphCount = 5e3;
  }
  get usedArea() {
    return this._usedArea;
  }
  get source() {
    return this._canvas;
  }
  get glyphs() {
    return this._glyphInOrderSet.values();
  }
  getGlyph(rasterizer, chars, tokenMetadata, decorationStyleSetId) {
    return this._glyphMap.get(chars, tokenMetadata, decorationStyleSetId, rasterizer.cacheKey) ?? this._createGlyph(rasterizer, chars, tokenMetadata, decorationStyleSetId);
  }
  _createGlyph(rasterizer, chars, tokenMetadata, decorationStyleSetId) {
    if (this._glyphInOrderSet.size >= TextureAtlasPage.maximumGlyphCount) {
      return void 0;
    }
    const rasterizedGlyph = rasterizer.rasterizeGlyph(chars, tokenMetadata, decorationStyleSetId, this._colorMap);
    const glyph = this._allocator.allocate(rasterizedGlyph);
    if (glyph === void 0) {
      return void 0;
    }
    this._glyphMap.set(glyph, chars, tokenMetadata, decorationStyleSetId, rasterizer.cacheKey);
    this._glyphInOrderSet.add(glyph);
    this._version++;
    this._usedArea.right = Math.max(this._usedArea.right, glyph.x + glyph.w - 1);
    this._usedArea.bottom = Math.max(this._usedArea.bottom, glyph.y + glyph.h - 1);
    if (this._logService.getLevel() === LogLevel.Trace) {
      this._logService.trace("New glyph", {
        chars,
        tokenMetadata,
        decorationStyleSetId,
        rasterizedGlyph,
        glyph
      });
    }
    return glyph;
  }
  getUsagePreview() {
    return this._allocator.getUsagePreview();
  }
  getStats() {
    return this._allocator.getStats();
  }
};
TextureAtlasPage = __decorateClass([
  __decorateParam(3, ILogService),
  __decorateParam(4, IThemeService)
], TextureAtlasPage);
export {
  TextureAtlasPage
};
