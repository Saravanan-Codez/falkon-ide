import { getActiveWindow } from "../../../../base/browser/dom.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { NKeyMap } from "../../../../base/common/map.js";
import { ensureNonNullable } from "../gpuUtils.js";
import { UsagePreviewColors } from "./atlas.js";
class TextureAtlasSlabAllocator {
  constructor(_canvas, _textureIndex, options) {
    this._canvas = _canvas;
    this._textureIndex = _textureIndex;
    this._slabs = [];
    this._activeSlabsByDims = new NKeyMap();
    this._unusedRects = [];
    this._openRegionsByHeight = /* @__PURE__ */ new Map();
    this._openRegionsByWidth = /* @__PURE__ */ new Map();
    /** A set of all glyphs allocated, this is only tracked to enable debug related functionality */
    this._allocatedGlyphs = /* @__PURE__ */ new Set();
    this._nextIndex = 0;
    this._ctx = ensureNonNullable(this._canvas.getContext("2d", {
      willReadFrequently: true
    }));
    this._slabW = Math.min(
      options?.slabW ?? 64 << Math.max(Math.floor(getActiveWindow().devicePixelRatio) - 1, 0),
      this._canvas.width
    );
    this._slabH = Math.min(
      options?.slabH ?? this._slabW,
      this._canvas.height
    );
    this._slabsPerRow = Math.floor(this._canvas.width / this._slabW);
    this._slabsPerColumn = Math.floor(this._canvas.height / this._slabH);
  }
  allocate(rasterizedGlyph) {
    const glyphWidth = rasterizedGlyph.boundingBox.right - rasterizedGlyph.boundingBox.left + 1;
    const glyphHeight = rasterizedGlyph.boundingBox.bottom - rasterizedGlyph.boundingBox.top + 1;
    if (glyphWidth > this._canvas.width || glyphHeight > this._canvas.height) {
      throw new BugIndicatingError("Glyph is too large for the atlas page");
    }
    if (glyphWidth > this._slabW || glyphHeight > this._slabH) {
      if (this._allocatedGlyphs.size > 0) {
        return void 0;
      }
      let sizeCandidate = this._canvas.width;
      while (glyphWidth < sizeCandidate / 2 && glyphHeight < sizeCandidate / 2) {
        sizeCandidate /= 2;
      }
      this._slabW = sizeCandidate;
      this._slabH = sizeCandidate;
      this._slabsPerRow = Math.floor(this._canvas.width / this._slabW);
      this._slabsPerColumn = Math.floor(this._canvas.height / this._slabH);
    }
    const desiredSlabSize = {
      // Nearest square number
      // TODO: This can probably be optimized
      // w: 1 << Math.ceil(Math.sqrt(glyphWidth)),
      // h: 1 << Math.ceil(Math.sqrt(glyphHeight)),
      // Nearest x px
      // w: Math.ceil(glyphWidth / nearestXPixels) * nearestXPixels,
      // h: Math.ceil(glyphHeight / nearestXPixels) * nearestXPixels,
      // Round odd numbers up
      // w: glyphWidth % 0 === 1 ? glyphWidth + 1 : glyphWidth,
      // h: glyphHeight % 0 === 1 ? glyphHeight + 1 : glyphHeight,
      // Exact number only
      w: glyphWidth,
      h: glyphHeight
    };
    let slab = this._activeSlabsByDims.get(desiredSlabSize.w, desiredSlabSize.h);
    if (slab) {
      const glyphsPerSlab = Math.floor(this._slabW / slab.entryW) * Math.floor(this._slabH / slab.entryH);
      if (slab.count >= glyphsPerSlab) {
        slab = void 0;
      }
    }
    let dx;
    let dy;
    if (!slab) {
      if (glyphWidth < glyphHeight) {
        const openRegions = this._openRegionsByWidth.get(glyphWidth);
        if (openRegions?.length) {
          for (let i = openRegions.length - 1; i >= 0; i--) {
            const r = openRegions[i];
            if (r.w >= glyphWidth && r.h >= glyphHeight) {
              dx = r.x;
              dy = r.y;
              if (glyphWidth < r.w) {
                this._unusedRects.push({
                  x: r.x + glyphWidth,
                  y: r.y,
                  w: r.w - glyphWidth,
                  h: glyphHeight
                });
              }
              r.y += glyphHeight;
              r.h -= glyphHeight;
              if (r.h === 0) {
                if (i === openRegions.length - 1) {
                  openRegions.pop();
                } else {
                  this._unusedRects.splice(i, 1);
                }
              }
              break;
            }
          }
        }
      } else {
        const openRegions = this._openRegionsByHeight.get(glyphHeight);
        if (openRegions?.length) {
          for (let i = openRegions.length - 1; i >= 0; i--) {
            const r = openRegions[i];
            if (r.w >= glyphWidth && r.h >= glyphHeight) {
              dx = r.x;
              dy = r.y;
              if (glyphHeight < r.h) {
                this._unusedRects.push({
                  x: r.x,
                  y: r.y + glyphHeight,
                  w: glyphWidth,
                  h: r.h - glyphHeight
                });
              }
              r.x += glyphWidth;
              r.w -= glyphWidth;
              if (r.h === 0) {
                if (i === openRegions.length - 1) {
                  openRegions.pop();
                } else {
                  this._unusedRects.splice(i, 1);
                }
              }
              break;
            }
          }
        }
      }
    }
    if (dx === void 0 || dy === void 0) {
      if (!slab) {
        if (this._slabs.length >= this._slabsPerRow * this._slabsPerColumn) {
          return void 0;
        }
        slab = {
          x: Math.floor(this._slabs.length % this._slabsPerRow) * this._slabW,
          y: Math.floor(this._slabs.length / this._slabsPerRow) * this._slabH,
          entryW: desiredSlabSize.w,
          entryH: desiredSlabSize.h,
          count: 0
        };
        const unusedW = this._slabW % slab.entryW;
        const unusedH = this._slabH % slab.entryH;
        if (unusedW) {
          addEntryToMapArray(this._openRegionsByWidth, unusedW, {
            x: slab.x + this._slabW - unusedW,
            w: unusedW,
            y: slab.y,
            h: this._slabH - (unusedH ?? 0)
          });
        }
        if (unusedH) {
          addEntryToMapArray(this._openRegionsByHeight, unusedH, {
            x: slab.x,
            w: this._slabW,
            y: slab.y + this._slabH - unusedH,
            h: unusedH
          });
        }
        this._slabs.push(slab);
        this._activeSlabsByDims.set(slab, desiredSlabSize.w, desiredSlabSize.h);
      }
      const glyphsPerRow = Math.floor(this._slabW / slab.entryW);
      dx = slab.x + Math.floor(slab.count % glyphsPerRow) * slab.entryW;
      dy = slab.y + Math.floor(slab.count / glyphsPerRow) * slab.entryH;
      slab.count++;
    }
    this._ctx.drawImage(
      rasterizedGlyph.source,
      // source
      rasterizedGlyph.boundingBox.left,
      rasterizedGlyph.boundingBox.top,
      glyphWidth,
      glyphHeight,
      // destination
      dx,
      dy,
      glyphWidth,
      glyphHeight
    );
    const glyph = {
      pageIndex: this._textureIndex,
      glyphIndex: this._nextIndex++,
      x: dx,
      y: dy,
      w: glyphWidth,
      h: glyphHeight,
      originOffsetX: rasterizedGlyph.originOffset.x,
      originOffsetY: rasterizedGlyph.originOffset.y,
      fontBoundingBoxAscent: rasterizedGlyph.fontBoundingBoxAscent,
      fontBoundingBoxDescent: rasterizedGlyph.fontBoundingBoxDescent
    };
    this._allocatedGlyphs.add(glyph);
    return glyph;
  }
  getUsagePreview() {
    const w = this._canvas.width;
    const h = this._canvas.height;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = ensureNonNullable(canvas.getContext("2d"));
    ctx.fillStyle = UsagePreviewColors.Unused;
    ctx.fillRect(0, 0, w, h);
    let slabEntryPixels = 0;
    let usedPixels = 0;
    let slabEdgePixels = 0;
    let restrictedPixels = 0;
    const slabW = 64 << Math.floor(getActiveWindow().devicePixelRatio) - 1;
    const slabH = slabW;
    for (const slab of this._slabs) {
      let x = 0;
      let y = 0;
      for (let i = 0; i < slab.count; i++) {
        if (x + slab.entryW > slabW) {
          x = 0;
          y += slab.entryH;
        }
        ctx.fillStyle = UsagePreviewColors.Wasted;
        ctx.fillRect(slab.x + x, slab.y + y, slab.entryW, slab.entryH);
        slabEntryPixels += slab.entryW * slab.entryH;
        x += slab.entryW;
      }
      const entriesPerRow = Math.floor(slabW / slab.entryW);
      const entriesPerCol = Math.floor(slabH / slab.entryH);
      const thisSlabPixels = slab.entryW * entriesPerRow * slab.entryH * entriesPerCol;
      slabEdgePixels += slabW * slabH - thisSlabPixels;
    }
    for (const g of this._allocatedGlyphs) {
      usedPixels += g.w * g.h;
      ctx.fillStyle = UsagePreviewColors.Used;
      ctx.fillRect(g.x, g.y, g.w, g.h);
    }
    const unusedRegions = Array.from(this._openRegionsByWidth.values()).flat().concat(Array.from(this._openRegionsByHeight.values()).flat());
    for (const r of unusedRegions) {
      ctx.fillStyle = UsagePreviewColors.Restricted;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      restrictedPixels += r.w * r.h;
    }
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this._canvas, 0, 0);
    ctx.globalAlpha = 1;
    return canvas.convertToBlob();
  }
  getStats() {
    const w = this._canvas.width;
    const h = this._canvas.height;
    let slabEntryPixels = 0;
    let usedPixels = 0;
    let slabEdgePixels = 0;
    let wastedPixels = 0;
    let restrictedPixels = 0;
    const totalPixels = w * h;
    const slabW = 64 << Math.floor(getActiveWindow().devicePixelRatio) - 1;
    const slabH = slabW;
    for (const slab of this._slabs) {
      let x = 0;
      let y = 0;
      for (let i = 0; i < slab.count; i++) {
        if (x + slab.entryW > slabW) {
          x = 0;
          y += slab.entryH;
        }
        slabEntryPixels += slab.entryW * slab.entryH;
        x += slab.entryW;
      }
      const entriesPerRow = Math.floor(slabW / slab.entryW);
      const entriesPerCol = Math.floor(slabH / slab.entryH);
      const thisSlabPixels = slab.entryW * entriesPerRow * slab.entryH * entriesPerCol;
      slabEdgePixels += slabW * slabH - thisSlabPixels;
    }
    for (const g of this._allocatedGlyphs) {
      usedPixels += g.w * g.h;
    }
    const unusedRegions = Array.from(this._openRegionsByWidth.values()).flat().concat(Array.from(this._openRegionsByHeight.values()).flat());
    for (const r of unusedRegions) {
      restrictedPixels += r.w * r.h;
    }
    const edgeUsedPixels = slabEdgePixels - restrictedPixels;
    wastedPixels = slabEntryPixels - (usedPixels - edgeUsedPixels);
    const efficiency = usedPixels / (usedPixels + wastedPixels + restrictedPixels);
    return [
      `page[${this._textureIndex}]:`,
      `     Total: ${totalPixels}px (${w}x${h})`,
      `      Used: ${usedPixels}px (${(usedPixels / totalPixels * 100).toFixed(2)}%)`,
      `    Wasted: ${wastedPixels}px (${(wastedPixels / totalPixels * 100).toFixed(2)}%)`,
      `Restricted: ${restrictedPixels}px (${(restrictedPixels / totalPixels * 100).toFixed(2)}%) (hard to allocate)`,
      `Efficiency: ${efficiency === 1 ? "100" : (efficiency * 100).toFixed(2)}%`,
      `     Slabs: ${this._slabs.length} of ${Math.floor(this._canvas.width / slabW) * Math.floor(this._canvas.height / slabH)}`
    ].join("\n");
  }
}
function addEntryToMapArray(map, key, entry) {
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  list.push(entry);
}
export {
  TextureAtlasSlabAllocator
};
