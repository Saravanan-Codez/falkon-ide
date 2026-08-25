import { Range } from "./range.js";
var AnchorAlignment = /* @__PURE__ */ ((AnchorAlignment2) => {
  AnchorAlignment2[AnchorAlignment2["LEFT"] = 0] = "LEFT";
  AnchorAlignment2[AnchorAlignment2["RIGHT"] = 1] = "RIGHT";
  return AnchorAlignment2;
})(AnchorAlignment || {});
var AnchorPosition = /* @__PURE__ */ ((AnchorPosition2) => {
  AnchorPosition2[AnchorPosition2["BELOW"] = 0] = "BELOW";
  AnchorPosition2[AnchorPosition2["ABOVE"] = 1] = "ABOVE";
  return AnchorPosition2;
})(AnchorPosition || {});
var AnchorAxisAlignment = /* @__PURE__ */ ((AnchorAxisAlignment2) => {
  AnchorAxisAlignment2[AnchorAxisAlignment2["VERTICAL"] = 0] = "VERTICAL";
  AnchorAxisAlignment2[AnchorAxisAlignment2["HORIZONTAL"] = 1] = "HORIZONTAL";
  return AnchorAxisAlignment2;
})(AnchorAxisAlignment || {});
var LayoutAnchorPosition = /* @__PURE__ */ ((LayoutAnchorPosition2) => {
  LayoutAnchorPosition2[LayoutAnchorPosition2["Before"] = 0] = "Before";
  LayoutAnchorPosition2[LayoutAnchorPosition2["After"] = 1] = "After";
  return LayoutAnchorPosition2;
})(LayoutAnchorPosition || {});
var LayoutAnchorMode = /* @__PURE__ */ ((LayoutAnchorMode2) => {
  LayoutAnchorMode2[LayoutAnchorMode2["AVOID"] = 0] = "AVOID";
  LayoutAnchorMode2[LayoutAnchorMode2["ALIGN"] = 1] = "ALIGN";
  return LayoutAnchorMode2;
})(LayoutAnchorMode || {});
function layout(viewportSize, viewSize, anchor) {
  const layoutAfterAnchorBoundary = anchor.mode === 1 /* ALIGN */ ? anchor.offset : anchor.offset + anchor.size;
  const layoutBeforeAnchorBoundary = anchor.mode === 1 /* ALIGN */ ? anchor.offset + anchor.size : anchor.offset;
  if (anchor.position === 0 /* Before */) {
    if (viewSize <= viewportSize - layoutAfterAnchorBoundary) {
      return { position: layoutAfterAnchorBoundary, result: "ok" };
    }
    if (viewSize <= layoutBeforeAnchorBoundary) {
      return { position: layoutBeforeAnchorBoundary - viewSize, result: "flipped" };
    }
    return { position: Math.max(viewportSize - viewSize, 0), result: "overlap" };
  } else {
    if (viewSize <= layoutBeforeAnchorBoundary) {
      return { position: layoutBeforeAnchorBoundary - viewSize, result: "ok" };
    }
    if (viewSize <= viewportSize - layoutAfterAnchorBoundary && layoutBeforeAnchorBoundary < viewSize / 2) {
      return { position: layoutAfterAnchorBoundary, result: "flipped" };
    }
    return { position: 0, result: "overlap" };
  }
}
function layout2d(viewport, view, anchor, options) {
  let anchorAlignment = options?.anchorAlignment ?? 0 /* LEFT */;
  let anchorPosition = options?.anchorPosition ?? 0 /* BELOW */;
  const anchorAxisAlignment = options?.anchorAxisAlignment ?? 0 /* VERTICAL */;
  let top;
  let left;
  if (anchorAxisAlignment === 0 /* VERTICAL */) {
    const verticalAnchor = { offset: anchor.top - viewport.top, size: anchor.height, position: anchorPosition === 0 /* BELOW */ ? 0 /* Before */ : 1 /* After */ };
    const horizontalAnchor = { offset: anchor.left, size: anchor.width, position: anchorAlignment === 0 /* LEFT */ ? 0 /* Before */ : 1 /* After */, mode: 1 /* ALIGN */ };
    const verticalLayoutResult = layout(viewport.height, view.height, verticalAnchor);
    top = verticalLayoutResult.position + viewport.top;
    if (verticalLayoutResult.result === "flipped") {
      anchorPosition = anchorPosition === 0 /* BELOW */ ? 1 /* ABOVE */ : 0 /* BELOW */;
    }
    if (Range.intersects({ start: top, end: top + view.height }, { start: verticalAnchor.offset, end: verticalAnchor.offset + verticalAnchor.size })) {
      horizontalAnchor.mode = 0 /* AVOID */;
    }
    const horizontalLayoutResult = layout(viewport.width, view.width, horizontalAnchor);
    left = horizontalLayoutResult.position;
    if (horizontalLayoutResult.result === "flipped") {
      anchorAlignment = anchorAlignment === 0 /* LEFT */ ? 1 /* RIGHT */ : 0 /* LEFT */;
    }
  } else {
    const horizontalAnchor = { offset: anchor.left, size: anchor.width, position: anchorAlignment === 0 /* LEFT */ ? 0 /* Before */ : 1 /* After */ };
    const verticalAnchor = { offset: anchor.top, size: anchor.height, position: anchorPosition === 0 /* BELOW */ ? 0 /* Before */ : 1 /* After */, mode: 1 /* ALIGN */ };
    const horizontalLayoutResult = layout(viewport.width, view.width, horizontalAnchor);
    left = horizontalLayoutResult.position;
    if (horizontalLayoutResult.result === "flipped") {
      anchorAlignment = anchorAlignment === 0 /* LEFT */ ? 1 /* RIGHT */ : 0 /* LEFT */;
    }
    if (Range.intersects({ start: left, end: left + view.width }, { start: horizontalAnchor.offset, end: horizontalAnchor.offset + horizontalAnchor.size })) {
      verticalAnchor.mode = 0 /* AVOID */;
    }
    const verticalLayoutResult = layout(viewport.height, view.height, verticalAnchor);
    top = verticalLayoutResult.position + viewport.top;
    if (verticalLayoutResult.result === "flipped") {
      anchorPosition = anchorPosition === 0 /* BELOW */ ? 1 /* ABOVE */ : 0 /* BELOW */;
    }
  }
  const right = viewport.width - (left + view.width);
  const bottom = viewport.height - (top + view.height);
  return { top, left, bottom, right, anchorAlignment, anchorPosition };
}
export {
  AnchorAlignment,
  AnchorAxisAlignment,
  AnchorPosition,
  LayoutAnchorMode,
  LayoutAnchorPosition,
  layout,
  layout2d
};
