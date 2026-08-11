function computeMobileMultiDiffItemHeight(item, metrics) {
  if (item.collapsed) {
    return metrics.fileHeaderHeight;
  }
  if (item.state !== "loaded") {
    if (item.state === "unloaded" || item.state === "loading") {
      const estimatedHeight = computeDiffBodyHeight(item.estimatedHunkCount, item.estimatedRowCount, metrics);
      if (estimatedHeight !== void 0) {
        return metrics.fileHeaderHeight + estimatedHeight;
      }
    }
    return metrics.fileHeaderHeight + metrics.placeholderHeight;
  }
  const bodyHeight = computeDiffBodyHeight(item.hunkCount, item.rowCount, metrics);
  if (bodyHeight === void 0) {
    return metrics.fileHeaderHeight + metrics.placeholderHeight;
  }
  return metrics.fileHeaderHeight + bodyHeight;
}
function computeDiffBodyHeight(hunkCount, rowCount, metrics) {
  const normalizedHunkCount = Math.max(0, hunkCount ?? 0);
  const normalizedRowCount = Math.max(0, rowCount ?? 0);
  if (normalizedHunkCount === 0 && normalizedRowCount === 0) {
    return void 0;
  }
  return metrics.bodyVerticalPadding + normalizedHunkCount * metrics.hunkHeaderHeight + normalizedRowCount * metrics.rowHeight;
}
function computeMobileMultiDiffVirtualLayout(items, options) {
  const viewportHeight = Math.max(0, options.viewportHeight);
  const scrollTop = Math.max(0, options.scrollTop);
  const overscan = Math.max(0, options.overscan ?? 0);
  const visibleStart = Math.max(0, scrollTop - overscan);
  const visibleEnd = scrollTop + viewportHeight + overscan;
  let totalHeight = 0;
  const visibleItems = [];
  for (let index = 0; index < items.length; index++) {
    const virtualTop = totalHeight;
    const virtualHeight = computeMobileMultiDiffItemHeight(items[index], options.metrics);
    const virtualBottom = virtualTop + virtualHeight;
    totalHeight = virtualBottom;
    if (virtualHeight <= 0 || virtualTop >= visibleEnd || virtualBottom <= visibleStart) {
      continue;
    }
    const innerOffset = clamp(scrollTop - virtualTop, 0, virtualHeight);
    visibleItems.push({
      index,
      virtualTop,
      virtualHeight,
      renderTop: virtualTop,
      renderHeight: virtualHeight,
      innerOffset
    });
  }
  return {
    totalHeight,
    items: visibleItems
  };
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
export {
  computeMobileMultiDiffItemHeight,
  computeMobileMultiDiffVirtualLayout
};
