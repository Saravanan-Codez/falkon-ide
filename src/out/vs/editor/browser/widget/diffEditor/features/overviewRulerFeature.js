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
import { EventType, addDisposableListener, addStandardDisposableListener, h } from "../../../../../base/browser/dom.js";
import { createFastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { ScrollbarState } from "../../../../../base/browser/ui/scrollbar/scrollbarState.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, observableFromEvent, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { appendRemoveOnDispose } from "../utils.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { Position } from "../../../../common/core/position.js";
import { OverviewRulerZone } from "../../../../common/viewModel/overviewZoneManager.js";
import { defaultInsertColor, defaultRemoveColor, diffInserted, diffOverviewRulerInserted, diffOverviewRulerRemoved, diffRemoved } from "../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
let OverviewRulerFeature = class extends Disposable {
  constructor(_editors, _rootElement, _diffModel, _rootWidth, _rootHeight, _modifiedEditorLayoutInfo, _themeService) {
    super();
    this._editors = _editors;
    this._rootElement = _rootElement;
    this._diffModel = _diffModel;
    this._rootWidth = _rootWidth;
    this._rootHeight = _rootHeight;
    this._modifiedEditorLayoutInfo = _modifiedEditorLayoutInfo;
    this._themeService = _themeService;
    this.width = OverviewRulerFeature.ENTIRE_DIFF_OVERVIEW_WIDTH;
    this._rootElement.classList.add("has-diff-overview");
    this._register(toDisposable(() => this._rootElement.classList.remove("has-diff-overview")));
    const currentColorTheme = observableFromEvent(this._themeService.onDidColorThemeChange, () => this._themeService.getColorTheme());
    const currentColors = derived((reader) => {
      const theme = currentColorTheme.read(reader);
      const insertColor = theme.getColor(diffOverviewRulerInserted) || (theme.getColor(diffInserted) || defaultInsertColor).transparent(2);
      const removeColor = theme.getColor(diffOverviewRulerRemoved) || (theme.getColor(diffRemoved) || defaultRemoveColor).transparent(2);
      return { insertColor, removeColor };
    });
    const viewportDomElement = createFastDomNode(document.createElement("div"));
    viewportDomElement.setClassName("diffViewport");
    viewportDomElement.setPosition("absolute");
    const diffOverviewRoot = h("div.diffOverview", {
      style: { position: "absolute", top: "0px", width: OverviewRulerFeature.ENTIRE_DIFF_OVERVIEW_WIDTH + "px" }
    }).root;
    this._register(appendRemoveOnDispose(diffOverviewRoot, viewportDomElement.domNode));
    this._register(addStandardDisposableListener(diffOverviewRoot, EventType.POINTER_DOWN, (e) => {
      this._editors.modified.delegateVerticalScrollbarPointerDown(e);
    }));
    this._register(addDisposableListener(diffOverviewRoot, EventType.MOUSE_WHEEL, (e) => {
      this._editors.modified.delegateScrollFromMouseWheelEvent(e);
    }, { passive: false }));
    this._register(appendRemoveOnDispose(this._rootElement, diffOverviewRoot));
    this._register(autorunWithStore((reader, store) => {
      const m = this._diffModel.read(reader);
      const originalOverviewRuler = this._editors.original.createOverviewRuler("original diffOverviewRuler");
      if (originalOverviewRuler) {
        store.add(originalOverviewRuler);
        store.add(appendRemoveOnDispose(diffOverviewRoot, originalOverviewRuler.getDomNode()));
      }
      const modifiedOverviewRuler = this._editors.modified.createOverviewRuler("modified diffOverviewRuler");
      if (modifiedOverviewRuler) {
        store.add(modifiedOverviewRuler);
        store.add(appendRemoveOnDispose(diffOverviewRoot, modifiedOverviewRuler.getDomNode()));
      }
      if (!originalOverviewRuler || !modifiedOverviewRuler) {
        return;
      }
      const origViewZonesChanged = observableSignalFromEvent("viewZoneChanged", this._editors.original.onDidChangeViewZones);
      const modViewZonesChanged = observableSignalFromEvent("viewZoneChanged", this._editors.modified.onDidChangeViewZones);
      const origHiddenRangesChanged = observableSignalFromEvent("hiddenRangesChanged", this._editors.original.onDidChangeHiddenAreas);
      const modHiddenRangesChanged = observableSignalFromEvent("hiddenRangesChanged", this._editors.modified.onDidChangeHiddenAreas);
      store.add(autorun((reader2) => {
        origViewZonesChanged.read(reader2);
        modViewZonesChanged.read(reader2);
        origHiddenRangesChanged.read(reader2);
        modHiddenRangesChanged.read(reader2);
        const colors = currentColors.read(reader2);
        const diff = m?.diff.read(reader2)?.mappings;
        function createZones(ranges, color, editor) {
          const vm = editor._getViewModel();
          if (!vm) {
            return [];
          }
          return ranges.filter((d) => d.length > 0).map((r) => {
            const start = vm.coordinatesConverter.convertModelPositionToViewPosition(new Position(r.startLineNumber, 1));
            const end = vm.coordinatesConverter.convertModelPositionToViewPosition(new Position(r.endLineNumberExclusive, 1));
            const lineCount = end.lineNumber - start.lineNumber;
            return new OverviewRulerZone(start.lineNumber, end.lineNumber, lineCount, color.toString());
          });
        }
        const originalZones = createZones((diff || []).map((d) => d.lineRangeMapping.original), colors.removeColor, this._editors.original);
        const modifiedZones = createZones((diff || []).map((d) => d.lineRangeMapping.modified), colors.insertColor, this._editors.modified);
        originalOverviewRuler?.setZones(originalZones);
        modifiedOverviewRuler?.setZones(modifiedZones);
      }));
      store.add(autorun((reader2) => {
        const height = this._rootHeight.read(reader2);
        const width = this._rootWidth.read(reader2);
        const layoutInfo = this._modifiedEditorLayoutInfo.read(reader2);
        if (layoutInfo) {
          const freeSpace = OverviewRulerFeature.ENTIRE_DIFF_OVERVIEW_WIDTH - 2 * OverviewRulerFeature.ONE_OVERVIEW_WIDTH;
          originalOverviewRuler.setLayout({
            top: 0,
            height,
            right: freeSpace + OverviewRulerFeature.ONE_OVERVIEW_WIDTH,
            width: OverviewRulerFeature.ONE_OVERVIEW_WIDTH
          });
          modifiedOverviewRuler.setLayout({
            top: 0,
            height,
            right: 0,
            width: OverviewRulerFeature.ONE_OVERVIEW_WIDTH
          });
          const scrollTop = this._editors.modifiedScrollTop.read(reader2);
          const scrollHeight = this._editors.modifiedScrollHeight.read(reader2);
          const scrollBarOptions = this._editors.modified.getOption(EditorOption.scrollbar);
          const state = new ScrollbarState(
            scrollBarOptions.verticalHasArrows ? scrollBarOptions.arrowSize : 0,
            scrollBarOptions.verticalScrollbarSize,
            0,
            layoutInfo.height,
            scrollHeight,
            scrollTop
          );
          viewportDomElement.setTop(state.getSliderPosition());
          viewportDomElement.setHeight(state.getSliderSize());
        } else {
          viewportDomElement.setTop(0);
          viewportDomElement.setHeight(0);
        }
        diffOverviewRoot.style.height = height + "px";
        diffOverviewRoot.style.left = width - OverviewRulerFeature.ENTIRE_DIFF_OVERVIEW_WIDTH + "px";
        viewportDomElement.setWidth(OverviewRulerFeature.ENTIRE_DIFF_OVERVIEW_WIDTH);
      }));
    }));
  }
  static {
    this.ONE_OVERVIEW_WIDTH = 15;
  }
  static {
    this.ENTIRE_DIFF_OVERVIEW_WIDTH = this.ONE_OVERVIEW_WIDTH * 2;
  }
};
OverviewRulerFeature = __decorateClass([
  __decorateParam(6, IThemeService)
], OverviewRulerFeature);
export {
  OverviewRulerFeature
};
