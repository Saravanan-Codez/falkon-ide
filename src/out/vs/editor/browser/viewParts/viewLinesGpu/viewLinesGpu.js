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
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { autorun, runOnChange } from "../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { TextureAtlasPage } from "../../gpu/atlas/textureAtlasPage.js";
import { BindingId } from "../../gpu/gpu.js";
import { GPULifecycle } from "../../gpu/gpuDisposable.js";
import { quadVertices } from "../../gpu/gpuUtils.js";
import { ViewGpuContext } from "../../gpu/viewGpuContext.js";
import { FloatHorizontalRange, HorizontalPosition, HorizontalRange, LineVisibleRanges, VisibleRanges } from "../../view/renderingContext.js";
import { ViewPart } from "../../view/viewPart.js";
import { ViewLineOptions } from "../viewLines/viewLineOptions.js";
import { CursorColumns } from "../../../common/core/cursorColumns.js";
import { TextureAtlas } from "../../gpu/atlas/textureAtlas.js";
import { createContentSegmenter } from "../../gpu/contentSegmenter.js";
import { ViewportRenderStrategy } from "../../gpu/renderStrategy/viewportRenderStrategy.js";
import { FullFileRenderStrategy } from "../../gpu/renderStrategy/fullFileRenderStrategy.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { GlyphRasterizer } from "../../gpu/raster/glyphRasterizer.js";
var GlyphStorageBufferInfo = /* @__PURE__ */ ((GlyphStorageBufferInfo2) => {
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["FloatsPerEntry"] = 6] = "FloatsPerEntry";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["BytesPerEntry"] = 24] = "BytesPerEntry";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["Offset_TexturePosition"] = 0] = "Offset_TexturePosition";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["Offset_TextureSize"] = 2] = "Offset_TextureSize";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["Offset_OriginPosition"] = 4] = "Offset_OriginPosition";
  return GlyphStorageBufferInfo2;
})(GlyphStorageBufferInfo || {});
let ViewLinesGpu = class extends ViewPart {
  constructor(context, _viewGpuContext, _instantiationService, _logService) {
    super(context);
    this._viewGpuContext = _viewGpuContext;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    /**
     * Tracks the maximum line width seen so far for horizontal scrollbar sizing.
     * This is needed because GPU-rendered lines don't have DOM nodes to measure.
     */
    this._maxLineWidth = 0;
    this._atlasGpuTextureVersions = [];
    this._initialized = false;
    this._glyphRasterizer = this._register(new MutableDisposable());
    this._renderStrategy = this._register(new MutableDisposable());
    this.canvas = this._viewGpuContext.canvas.domNode;
    this._register(autorun((reader) => {
      this._viewGpuContext.canvasDevicePixelDimensions.read(reader);
      const lastViewportData = this._lastViewportData;
      if (lastViewportData) {
        setTimeout(() => {
          if (lastViewportData === this._lastViewportData) {
            this.renderText(lastViewportData);
          }
        });
      }
    }));
    this.initWebgpu();
  }
  async initWebgpu() {
    this._device = ViewGpuContext.deviceSync || await ViewGpuContext.device;
    if (this._store.isDisposed) {
      return;
    }
    const atlas = ViewGpuContext.atlas;
    this._register(atlas.onDidDeleteGlyphs(() => {
      this._atlasGpuTextureVersions.length = 0;
      this._atlasGpuTextureVersions[0] = 0;
      this._atlasGpuTextureVersions[1] = 0;
      this._renderStrategy.value.reset();
    }));
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this._viewGpuContext.ctx.configure({
      device: this._device,
      format: presentationFormat,
      alphaMode: "premultiplied"
    });
    this._renderPassColorAttachment = {
      view: null,
      // Will be filled at render time
      loadOp: "load",
      storeOp: "store"
    };
    this._renderPassDescriptor = {
      label: "Monaco render pass",
      colorAttachments: [this._renderPassColorAttachment]
    };
    let layoutInfoUniformBuffer;
    {
      let Info;
      ((Info2) => {
        Info2[Info2["FloatsPerEntry"] = 6] = "FloatsPerEntry";
        Info2[Info2["BytesPerEntry"] = 24] = "BytesPerEntry";
        Info2[Info2["Offset_CanvasWidth____"] = 0] = "Offset_CanvasWidth____";
        Info2[Info2["Offset_CanvasHeight___"] = 1] = "Offset_CanvasHeight___";
        Info2[Info2["Offset_ViewportOffsetX"] = 2] = "Offset_ViewportOffsetX";
        Info2[Info2["Offset_ViewportOffsetY"] = 3] = "Offset_ViewportOffsetY";
        Info2[Info2["Offset_ViewportWidth__"] = 4] = "Offset_ViewportWidth__";
        Info2[Info2["Offset_ViewportHeight_"] = 5] = "Offset_ViewportHeight_";
      })(Info || (Info = {}));
      const bufferValues = new Float32Array(6 /* FloatsPerEntry */);
      const updateBufferValues = (canvasDevicePixelWidth = this.canvas.width, canvasDevicePixelHeight = this.canvas.height) => {
        bufferValues[0 /* Offset_CanvasWidth____ */] = canvasDevicePixelWidth;
        bufferValues[1 /* Offset_CanvasHeight___ */] = canvasDevicePixelHeight;
        bufferValues[2 /* Offset_ViewportOffsetX */] = Math.ceil(this._context.configuration.options.get(EditorOption.layoutInfo).contentLeft * getActiveWindow().devicePixelRatio);
        bufferValues[3 /* Offset_ViewportOffsetY */] = 0;
        bufferValues[4 /* Offset_ViewportWidth__ */] = bufferValues[0 /* Offset_CanvasWidth____ */] - bufferValues[2 /* Offset_ViewportOffsetX */];
        bufferValues[5 /* Offset_ViewportHeight_ */] = bufferValues[1 /* Offset_CanvasHeight___ */] - bufferValues[3 /* Offset_ViewportOffsetY */];
        return bufferValues;
      };
      layoutInfoUniformBuffer = this._register(GPULifecycle.createBuffer(this._device, {
        label: "Monaco uniform buffer",
        size: 24 /* BytesPerEntry */,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }, () => updateBufferValues())).object;
      this._register(runOnChange(this._viewGpuContext.canvasDevicePixelDimensions, ({ width, height }) => {
        this._device.queue.writeBuffer(layoutInfoUniformBuffer, 0, updateBufferValues(width, height));
      }));
      this._register(runOnChange(this._viewGpuContext.contentLeft, () => {
        this._device.queue.writeBuffer(layoutInfoUniformBuffer, 0, updateBufferValues());
      }));
    }
    let atlasInfoUniformBuffer;
    {
      let Info;
      ((Info2) => {
        Info2[Info2["FloatsPerEntry"] = 2] = "FloatsPerEntry";
        Info2[Info2["BytesPerEntry"] = 8] = "BytesPerEntry";
        Info2[Info2["Offset_Width_"] = 0] = "Offset_Width_";
        Info2[Info2["Offset_Height"] = 1] = "Offset_Height";
      })(Info || (Info = {}));
      atlasInfoUniformBuffer = this._register(GPULifecycle.createBuffer(this._device, {
        label: "Monaco atlas info uniform buffer",
        size: 8 /* BytesPerEntry */,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }, () => {
        const values = new Float32Array(2 /* FloatsPerEntry */);
        values[0 /* Offset_Width_ */] = atlas.pageSize;
        values[1 /* Offset_Height */] = atlas.pageSize;
        return values;
      })).object;
    }
    const fontFamily = this._context.configuration.options.get(EditorOption.fontFamily);
    const fontSize = this._context.configuration.options.get(EditorOption.fontSize);
    this._glyphRasterizer.value = this._register(new GlyphRasterizer(fontSize, fontFamily, this._viewGpuContext.devicePixelRatio.get(), ViewGpuContext.decorationStyleCache));
    this._register(runOnChange(this._viewGpuContext.devicePixelRatio, () => {
      this._refreshGlyphRasterizer();
    }));
    this._renderStrategy.value = this._instantiationService.createInstance(FullFileRenderStrategy, this._context, this._viewGpuContext, this._device, this._glyphRasterizer);
    this._glyphStorageBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco glyph storage buffer",
      size: TextureAtlas.maximumPageCount * (TextureAtlasPage.maximumGlyphCount * 24 /* BytesPerEntry */),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })).object;
    this._atlasGpuTextureVersions[0] = 0;
    this._atlasGpuTextureVersions[1] = 0;
    this._atlasGpuTexture = this._register(GPULifecycle.createTexture(this._device, {
      label: "Monaco atlas texture",
      format: "rgba8unorm",
      size: { width: atlas.pageSize, height: atlas.pageSize, depthOrArrayLayers: TextureAtlas.maximumPageCount },
      dimension: "2d",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    })).object;
    this._updateAtlasStorageBufferAndTexture();
    this._vertexBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco vertex buffer",
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    }, quadVertices)).object;
    const module = this._device.createShaderModule({
      label: "Monaco shader module",
      code: this._renderStrategy.value.wgsl
    });
    this._pipeline = this._device.createRenderPipeline({
      label: "Monaco render pipeline",
      layout: "auto",
      vertex: {
        module,
        buffers: [
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            // 2 floats, 4 bytes each
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" }
              // position
            ]
          }
        ]
      },
      fragment: {
        module,
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha"
              },
              alpha: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha"
              }
            }
          }
        ]
      }
    });
    this._rebuildBindGroup = () => {
      this._bindGroup = this._device.createBindGroup({
        label: "Monaco bind group",
        layout: this._pipeline.getBindGroupLayout(0),
        entries: [
          // TODO: Pass in generically as array?
          { binding: BindingId.GlyphInfo, resource: { buffer: this._glyphStorageBuffer } },
          {
            binding: BindingId.TextureSampler,
            resource: this._device.createSampler({
              label: "Monaco atlas sampler",
              magFilter: "nearest",
              minFilter: "nearest"
            })
          },
          { binding: BindingId.Texture, resource: this._atlasGpuTexture.createView() },
          { binding: BindingId.LayoutInfoUniform, resource: { buffer: layoutInfoUniformBuffer } },
          { binding: BindingId.AtlasDimensionsUniform, resource: { buffer: atlasInfoUniformBuffer } },
          ...this._renderStrategy.value.bindGroupEntries
        ]
      });
    };
    this._rebuildBindGroup();
    this._initialized = true;
    if (this._initViewportData) {
      for (const viewportData of this._initViewportData) {
        this.renderText(viewportData);
      }
      this._initViewportData = void 0;
    }
  }
  _refreshRenderStrategy(viewportData) {
    if (this._renderStrategy.value?.type === "viewport") {
      return;
    }
    if (viewportData.endLineNumber < FullFileRenderStrategy.maxSupportedLines && this._viewportMaxColumn(viewportData) < FullFileRenderStrategy.maxSupportedColumns) {
      return;
    }
    this._logService.trace(`File is larger than ${FullFileRenderStrategy.maxSupportedLines} lines or ${FullFileRenderStrategy.maxSupportedColumns} columns, switching to viewport render strategy`);
    const viewportRenderStrategy = this._instantiationService.createInstance(ViewportRenderStrategy, this._context, this._viewGpuContext, this._device, this._glyphRasterizer);
    this._renderStrategy.value = viewportRenderStrategy;
    this._register(viewportRenderStrategy.onDidChangeBindGroupEntries(() => this._rebuildBindGroup?.()));
    this._rebuildBindGroup?.();
  }
  _viewportMaxColumn(viewportData) {
    let maxColumn = 0;
    let lineData;
    for (let i = viewportData.startLineNumber; i <= viewportData.endLineNumber; i++) {
      lineData = viewportData.getViewLineRenderingData(i);
      maxColumn = Math.max(maxColumn, lineData.maxColumn);
    }
    return maxColumn;
  }
  _updateAtlasStorageBufferAndTexture() {
    for (const [layerIndex, page] of ViewGpuContext.atlas.pages.entries()) {
      if (layerIndex >= TextureAtlas.maximumPageCount) {
        console.log(`Attempt to upload atlas page [${layerIndex}], only ${TextureAtlas.maximumPageCount} are supported currently`);
        continue;
      }
      if (page.version === this._atlasGpuTextureVersions[layerIndex]) {
        continue;
      }
      this._logService.trace("Updating atlas page[", layerIndex, "] from version ", this._atlasGpuTextureVersions[layerIndex], " to version ", page.version);
      const entryCount = 6 /* FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount;
      const values = new Float32Array(entryCount);
      let entryOffset = 0;
      for (const glyph of page.glyphs) {
        values[entryOffset + 0 /* Offset_TexturePosition */] = glyph.x;
        values[entryOffset + 0 /* Offset_TexturePosition */ + 1] = glyph.y;
        values[entryOffset + 2 /* Offset_TextureSize */] = glyph.w;
        values[entryOffset + 2 /* Offset_TextureSize */ + 1] = glyph.h;
        values[entryOffset + 4 /* Offset_OriginPosition */] = glyph.originOffsetX;
        values[entryOffset + 4 /* Offset_OriginPosition */ + 1] = glyph.originOffsetY;
        entryOffset += 6 /* FloatsPerEntry */;
      }
      if (entryOffset / 6 /* FloatsPerEntry */ > TextureAtlasPage.maximumGlyphCount) {
        throw new Error(`Attempting to write more glyphs (${entryOffset / 6 /* FloatsPerEntry */}) than the GPUBuffer can hold (${TextureAtlasPage.maximumGlyphCount})`);
      }
      this._device.queue.writeBuffer(
        this._glyphStorageBuffer,
        layerIndex * 6 /* FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount * Float32Array.BYTES_PER_ELEMENT,
        values,
        0,
        6 /* FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount
      );
      if (page.usedArea.right - page.usedArea.left > 0 && page.usedArea.bottom - page.usedArea.top > 0) {
        this._device.queue.copyExternalImageToTexture(
          { source: page.source },
          {
            texture: this._atlasGpuTexture,
            origin: {
              x: page.usedArea.left,
              y: page.usedArea.top,
              z: layerIndex
            }
          },
          {
            width: page.usedArea.right - page.usedArea.left + 1,
            height: page.usedArea.bottom - page.usedArea.top + 1
          }
        );
      }
      this._atlasGpuTextureVersions[layerIndex] = page.version;
    }
  }
  prepareRender(ctx) {
    throw new BugIndicatingError("Should not be called");
  }
  render(ctx) {
    throw new BugIndicatingError("Should not be called");
  }
  // #region Event handlers
  // Since ViewLinesGpu currently coordinates rendering to the canvas, it must listen to all
  // changed events that any GPU part listens to. This is because any drawing to the canvas will
  // clear it for that frame, so all parts must be rendered every time.
  //
  // Additionally, since this is intrinsically linked to ViewLines, it must also listen to events
  // from that side. Luckily rendering is cheap, it's only when uploaded data changes does it
  // start to cost.
  onConfigurationChanged(e) {
    this._refreshGlyphRasterizer();
    this._maxLineWidth = 0;
    return true;
  }
  onCursorStateChanged(e) {
    return true;
  }
  onDecorationsChanged(e) {
    return true;
  }
  onFlushed(e) {
    this._maxLineWidth = 0;
    return true;
  }
  onLinesChanged(e) {
    return true;
  }
  onLinesDeleted(e) {
    this._maxLineWidth = 0;
    return true;
  }
  onLinesInserted(e) {
    return true;
  }
  onLineMappingChanged(e) {
    return true;
  }
  onRevealRangeRequest(e) {
    return true;
  }
  onScrollChanged(e) {
    return true;
  }
  onThemeChanged(e) {
    return true;
  }
  onZonesChanged(e) {
    return true;
  }
  // #endregion
  _refreshGlyphRasterizer() {
    const glyphRasterizer = this._glyphRasterizer.value;
    if (!glyphRasterizer) {
      return;
    }
    const fontFamily = this._context.configuration.options.get(EditorOption.fontFamily);
    const fontSize = this._context.configuration.options.get(EditorOption.fontSize);
    const devicePixelRatio = this._viewGpuContext.devicePixelRatio.get();
    if (glyphRasterizer.fontFamily !== fontFamily || glyphRasterizer.fontSize !== fontSize || glyphRasterizer.devicePixelRatio !== devicePixelRatio) {
      this._glyphRasterizer.value = new GlyphRasterizer(fontSize, fontFamily, devicePixelRatio, ViewGpuContext.decorationStyleCache);
    }
  }
  renderText(viewportData) {
    if (this._initialized) {
      this._refreshRenderStrategy(viewportData);
      return this._renderText(viewportData);
    } else {
      this._initViewportData = this._initViewportData ?? [];
      this._initViewportData.push(viewportData);
    }
  }
  _renderText(viewportData) {
    this._viewGpuContext.rectangleRenderer.draw(viewportData);
    const options = new ViewLineOptions(this._context.configuration, this._context.theme.type);
    this._renderStrategy.value.update(viewportData, options);
    this._updateAtlasStorageBufferAndTexture();
    const encoder = this._device.createCommandEncoder({ label: "Monaco command encoder" });
    this._renderPassColorAttachment.view = this._viewGpuContext.ctx.getCurrentTexture().createView({ label: "Monaco canvas texture view" });
    const pass = encoder.beginRenderPass(this._renderPassDescriptor);
    pass.setPipeline(this._pipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    const contentLeft = Math.ceil(this._viewGpuContext.contentLeft.get() * this._viewGpuContext.devicePixelRatio.get());
    pass.setScissorRect(contentLeft, 0, this.canvas.width - contentLeft, this.canvas.height);
    pass.setBindGroup(0, this._bindGroup);
    this._renderStrategy.value.draw(pass, viewportData);
    pass.end();
    const commandBuffer = encoder.finish();
    this._device.queue.submit([commandBuffer]);
    this._lastViewportData = viewportData;
    this._lastViewLineOptions = options;
    this._updateMaxLineWidth(viewportData, options);
  }
  /**
   * Update the max line width based on GPU-rendered lines.
   * This is needed because GPU-rendered lines don't have DOM nodes to measure.
   */
  _updateMaxLineWidth(viewportData, viewLineOptions) {
    const dpr = getActiveWindow().devicePixelRatio;
    let localMaxLineWidth = 0;
    for (let lineNumber = viewportData.startLineNumber; lineNumber <= viewportData.endLineNumber; lineNumber++) {
      if (!this._viewGpuContext.canRender(viewLineOptions, viewportData, lineNumber)) {
        continue;
      }
      const lineData = viewportData.getViewLineRenderingData(lineNumber);
      const lineWidth = this._computeLineWidth(lineData, viewLineOptions, dpr);
      localMaxLineWidth = Math.max(localMaxLineWidth, lineWidth);
    }
    const iLineWidth = Math.ceil(localMaxLineWidth);
    if (iLineWidth > this._maxLineWidth) {
      this._maxLineWidth = iLineWidth;
      this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
    }
  }
  /**
   * Compute the width of a line in CSS pixels.
   */
  _computeLineWidth(lineData, viewLineOptions, dpr) {
    const content = lineData.content;
    let contentSegmenter;
    if (!(lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations)) {
      contentSegmenter = createContentSegmenter(lineData, viewLineOptions);
    }
    let width = 0;
    let tabXOffset = 0;
    for (let x = 0; x < content.length; x++) {
      let chars;
      if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
        chars = content.charAt(x);
      } else {
        const segment = contentSegmenter.getSegmentAtIndex(x);
        if (segment === void 0) {
          continue;
        }
        chars = segment;
      }
      if (chars === "	") {
        const offsetBefore = x + tabXOffset;
        tabXOffset = CursorColumns.nextRenderTabStop(x + tabXOffset, lineData.tabSize);
        width += viewLineOptions.spaceWidth * (tabXOffset - offsetBefore);
        tabXOffset -= x + 1;
      } else if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
        width += viewLineOptions.spaceWidth;
      } else {
        width += this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / dpr;
      }
    }
    return width;
  }
  linesVisibleRangesForRange(_range, includeNewLines) {
    if (!this._lastViewportData) {
      return null;
    }
    const originalEndLineNumber = _range.endLineNumber;
    const range = Range.intersectRanges(_range, this._lastViewportData.visibleRange);
    if (!range) {
      return null;
    }
    const rendStartLineNumber = this._lastViewportData.startLineNumber;
    const rendEndLineNumber = this._lastViewportData.endLineNumber;
    const viewportData = this._lastViewportData;
    const viewLineOptions = this._lastViewLineOptions;
    if (!viewportData || !viewLineOptions) {
      return null;
    }
    const visibleRanges = [];
    let nextLineModelLineNumber = 0;
    if (includeNewLines) {
      nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(range.startLineNumber, 1)).lineNumber;
    }
    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
      if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
        continue;
      }
      const startColumn = lineNumber === range.startLineNumber ? range.startColumn : 1;
      const continuesInNextLine = lineNumber !== originalEndLineNumber;
      const endColumn = continuesInNextLine ? this._context.viewModel.getLineMaxColumn(lineNumber) : range.endColumn;
      const visibleRangesForLine = this._visibleRangesForLineRange(lineNumber, startColumn, endColumn);
      if (!visibleRangesForLine) {
        continue;
      }
      if (includeNewLines && lineNumber < originalEndLineNumber) {
        const currentLineModelLineNumber = nextLineModelLineNumber;
        nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber + 1, 1)).lineNumber;
        if (currentLineModelLineNumber !== nextLineModelLineNumber) {
          visibleRangesForLine.ranges[visibleRangesForLine.ranges.length - 1].width += viewLineOptions.spaceWidth;
        }
      }
      visibleRanges.push(new LineVisibleRanges(visibleRangesForLine.outsideRenderedLine, lineNumber, HorizontalRange.from(visibleRangesForLine.ranges), continuesInNextLine));
    }
    if (visibleRanges.length === 0) {
      return null;
    }
    return visibleRanges;
  }
  _visibleRangesForLineRange(lineNumber, startColumn, endColumn) {
    if (this.shouldRender()) {
      return null;
    }
    const viewportData = this._lastViewportData;
    const viewLineOptions = this._lastViewLineOptions;
    if (!viewportData || !viewLineOptions || lineNumber < viewportData.startLineNumber || lineNumber > viewportData.endLineNumber) {
      return null;
    }
    const lineData = viewportData.getViewLineRenderingData(lineNumber);
    const content = lineData.content;
    let contentSegmenter;
    if (!(lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations)) {
      contentSegmenter = createContentSegmenter(lineData, viewLineOptions);
    }
    let chars = "";
    let resolvedStartColumn = 0;
    let resolvedStartCssPixelOffset = 0;
    for (let x = 0; x < startColumn - 1; x++) {
      if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
        chars = content.charAt(x);
      } else {
        chars = contentSegmenter.getSegmentAtIndex(x);
        if (chars === void 0) {
          continue;
        }
        resolvedStartCssPixelOffset += this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / getActiveWindow().devicePixelRatio - viewLineOptions.spaceWidth;
      }
      if (chars === "	") {
        resolvedStartColumn = CursorColumns.nextRenderTabStop(resolvedStartColumn, lineData.tabSize);
      } else {
        resolvedStartColumn++;
      }
    }
    let resolvedEndColumn = resolvedStartColumn;
    let resolvedEndCssPixelOffset = 0;
    for (let x = startColumn - 1; x < endColumn - 1; x++) {
      if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
        chars = content.charAt(x);
      } else {
        chars = contentSegmenter.getSegmentAtIndex(x);
        if (chars === void 0) {
          continue;
        }
        resolvedEndCssPixelOffset += this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / getActiveWindow().devicePixelRatio - viewLineOptions.spaceWidth;
      }
      if (chars === "	") {
        resolvedEndColumn = CursorColumns.nextRenderTabStop(resolvedEndColumn, lineData.tabSize);
      } else {
        resolvedEndColumn++;
      }
    }
    const result = new VisibleRanges(false, [
      new FloatHorizontalRange(
        resolvedStartColumn * viewLineOptions.spaceWidth + resolvedStartCssPixelOffset,
        (resolvedEndColumn - resolvedStartColumn) * viewLineOptions.spaceWidth + resolvedEndCssPixelOffset
      )
    ]);
    return result;
  }
  visibleRangeForPosition(position) {
    const visibleRanges = this._visibleRangesForLineRange(position.lineNumber, position.column, position.column);
    if (!visibleRanges) {
      return null;
    }
    return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
  }
  getLineWidth(lineNumber) {
    if (!this._lastViewportData || !this._lastViewLineOptions) {
      return void 0;
    }
    if (!this._viewGpuContext.canRender(this._lastViewLineOptions, this._lastViewportData, lineNumber)) {
      return void 0;
    }
    const lineData = this._lastViewportData.getViewLineRenderingData(lineNumber);
    const lineRange = this._visibleRangesForLineRange(lineNumber, 1, lineData.maxColumn);
    const lastRange = lineRange?.ranges.at(-1);
    if (lastRange) {
      return lastRange.left + lastRange.width;
    }
    return void 0;
  }
  getPositionAtCoordinate(lineNumber, mouseContentHorizontalOffset) {
    if (!this._lastViewportData || !this._lastViewLineOptions) {
      return void 0;
    }
    if (!this._viewGpuContext.canRender(this._lastViewLineOptions, this._lastViewportData, lineNumber)) {
      return void 0;
    }
    const lineData = this._lastViewportData.getViewLineRenderingData(lineNumber);
    const content = lineData.content;
    const dpr = getActiveWindow().devicePixelRatio;
    const mouseContentHorizontalOffsetDevicePixels = mouseContentHorizontalOffset * dpr;
    const spaceWidthDevicePixels = this._lastViewLineOptions.spaceWidth * dpr;
    const contentSegmenter = createContentSegmenter(lineData, this._lastViewLineOptions);
    let widthSoFar = 0;
    let charWidth = 0;
    let tabXOffset = 0;
    let column = 0;
    for (let x = 0; x < content.length; x++) {
      const chars = contentSegmenter.getSegmentAtIndex(x);
      if (chars === void 0) {
        column++;
        continue;
      }
      if (chars === "	") {
        const offsetBefore = x + tabXOffset;
        tabXOffset = CursorColumns.nextRenderTabStop(x + tabXOffset, lineData.tabSize);
        charWidth = spaceWidthDevicePixels * (tabXOffset - offsetBefore);
        tabXOffset -= x + 1;
      } else if (lineData.isBasicASCII && this._lastViewLineOptions.useMonospaceOptimizations) {
        charWidth = spaceWidthDevicePixels;
      } else {
        charWidth = this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width;
      }
      if (mouseContentHorizontalOffsetDevicePixels < widthSoFar + charWidth / 2) {
        break;
      }
      widthSoFar += charWidth;
      column++;
    }
    return new Position(lineNumber, column + 1);
  }
};
ViewLinesGpu = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], ViewLinesGpu);
export {
  ViewLinesGpu
};
