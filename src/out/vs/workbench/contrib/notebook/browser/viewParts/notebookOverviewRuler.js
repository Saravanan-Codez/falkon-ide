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
import { getWindow } from "../../../../../base/browser/dom.js";
import { createFastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { PixelRatio } from "../../../../../base/browser/pixelRatio.js";
import { IThemeService, Themable } from "../../../../../platform/theme/common/themeService.js";
import { NotebookOverviewRulerLane } from "../notebookBrowser.js";
let NotebookOverviewRuler = class extends Themable {
  constructor(notebookEditor, container, themeService) {
    super(themeService);
    this.notebookEditor = notebookEditor;
    this._lanes = 3;
    this._domNode = createFastDomNode(document.createElement("canvas"));
    this._domNode.setPosition("relative");
    this._domNode.setLayerHinting(true);
    this._domNode.setContain("strict");
    container.appendChild(this._domNode.domNode);
    this._register(notebookEditor.onDidChangeDecorations(() => {
      this.layout();
    }));
    this._register(PixelRatio.getInstance(getWindow(this._domNode.domNode)).onDidChange(() => {
      this.layout();
    }));
  }
  layout() {
    const width = 10;
    const layoutInfo = this.notebookEditor.getLayoutInfo();
    const scrollHeight = layoutInfo.scrollHeight;
    const height = layoutInfo.height;
    const ratio = PixelRatio.getInstance(getWindow(this._domNode.domNode)).value;
    this._domNode.setWidth(width);
    this._domNode.setHeight(height);
    this._domNode.domNode.width = width * ratio;
    this._domNode.domNode.height = height * ratio;
    const ctx = this._domNode.domNode.getContext("2d");
    ctx.clearRect(0, 0, width * ratio, height * ratio);
    this._render(ctx, width * ratio, height * ratio, scrollHeight * ratio, ratio);
  }
  _render(ctx, width, height, scrollHeight, ratio) {
    const viewModel = this.notebookEditor.getViewModel();
    const fontInfo = this.notebookEditor.getLayoutInfo().fontInfo;
    const laneWidth = width / this._lanes;
    let currentFrom = 0;
    if (viewModel) {
      for (let i = 0; i < viewModel.viewCells.length; i++) {
        const viewCell = viewModel.viewCells[i];
        const textBuffer = viewCell.textBuffer;
        const decorations = viewCell.getCellDecorations();
        const cellHeight = viewCell.layoutInfo.totalHeight / scrollHeight * ratio * height;
        decorations.filter((decoration) => decoration.overviewRuler).forEach((decoration) => {
          const overviewRuler = decoration.overviewRuler;
          const fillStyle = this.getColor(overviewRuler.color) ?? "#000000";
          const lineHeight = Math.min(fontInfo.lineHeight, viewCell.layoutInfo.editorHeight / scrollHeight / textBuffer.getLineCount() * ratio * height);
          const lineNumbers = overviewRuler.modelRanges.map((range) => range.startLineNumber).reduce((previous, current) => {
            if (previous.length === 0) {
              previous.push(current);
            } else {
              const last = previous[previous.length - 1];
              if (last !== current) {
                previous.push(current);
              }
            }
            return previous;
          }, []);
          let x = 0;
          switch (overviewRuler.position) {
            case NotebookOverviewRulerLane.Left:
              x = 0;
              break;
            case NotebookOverviewRulerLane.Center:
              x = laneWidth;
              break;
            case NotebookOverviewRulerLane.Right:
              x = laneWidth * 2;
              break;
            default:
              break;
          }
          const width2 = overviewRuler.position === NotebookOverviewRulerLane.Full ? laneWidth * 3 : laneWidth;
          for (let i2 = 0; i2 < lineNumbers.length; i2++) {
            ctx.fillStyle = fillStyle;
            const lineNumber = lineNumbers[i2];
            const offset = (lineNumber - 1) * lineHeight;
            ctx.fillRect(x, currentFrom + offset, width2, lineHeight);
          }
          if (overviewRuler.includeOutput) {
            ctx.fillStyle = fillStyle;
            const outputOffset = viewCell.layoutInfo.editorHeight / scrollHeight * ratio * height;
            const decorationHeight = fontInfo.lineHeight / scrollHeight * ratio * height;
            ctx.fillRect(laneWidth, currentFrom + outputOffset, laneWidth, decorationHeight);
          }
        });
        currentFrom += cellHeight;
      }
      const overviewRulerDecorations = viewModel.getOverviewRulerDecorations();
      for (let i = 0; i < overviewRulerDecorations.length; i++) {
        const decoration = overviewRulerDecorations[i];
        if (!decoration.options.overviewRuler) {
          continue;
        }
        const viewZoneInfo = this.notebookEditor.getViewZoneLayoutInfo(decoration.viewZoneId);
        if (!viewZoneInfo) {
          continue;
        }
        const fillStyle = this.getColor(decoration.options.overviewRuler.color) ?? "#000000";
        let x = 0;
        switch (decoration.options.overviewRuler.position) {
          case NotebookOverviewRulerLane.Left:
            x = 0;
            break;
          case NotebookOverviewRulerLane.Center:
            x = laneWidth;
            break;
          case NotebookOverviewRulerLane.Right:
            x = laneWidth * 2;
            break;
          default:
            break;
        }
        const width2 = decoration.options.overviewRuler.position === NotebookOverviewRulerLane.Full ? laneWidth * 3 : laneWidth;
        ctx.fillStyle = fillStyle;
        const viewZoneHeight = viewZoneInfo.height / scrollHeight * ratio * height;
        const viewZoneTop = viewZoneInfo.top / scrollHeight * ratio * height;
        ctx.fillRect(x, viewZoneTop, width2, viewZoneHeight);
      }
    }
  }
};
NotebookOverviewRuler = __decorateClass([
  __decorateParam(2, IThemeService)
], NotebookOverviewRuler);
export {
  NotebookOverviewRuler
};
