import { Orientation } from "../sash/sash.js";
import { equals, tail } from "../../../common/arrays.js";
import { Disposable } from "../../../common/lifecycle.js";
import "./gridview.css";
import { GridView, orthogonal, Sizing as GridViewSizing } from "./gridview.js";
import { LayoutPriority, Orientation as Orientation2, orthogonal as orthogonal2 } from "./gridview.js";
var Direction = /* @__PURE__ */ ((Direction2) => {
  Direction2[Direction2["Up"] = 0] = "Up";
  Direction2[Direction2["Down"] = 1] = "Down";
  Direction2[Direction2["Left"] = 2] = "Left";
  Direction2[Direction2["Right"] = 3] = "Right";
  return Direction2;
})(Direction || {});
function oppositeDirection(direction) {
  switch (direction) {
    case 0 /* Up */:
      return 1 /* Down */;
    case 1 /* Down */:
      return 0 /* Up */;
    case 2 /* Left */:
      return 3 /* Right */;
    case 3 /* Right */:
      return 2 /* Left */;
  }
}
function isGridBranchNode(node) {
  return !!node.children;
}
function getGridNode(node, location) {
  if (location.length === 0) {
    return node;
  }
  if (!isGridBranchNode(node)) {
    throw new Error("Invalid location");
  }
  const [index, ...rest] = location;
  return getGridNode(node.children[index], rest);
}
function intersects(one, other) {
  return !(one.start >= other.end || other.start >= one.end);
}
function getBoxBoundary(box, direction) {
  const orientation = getDirectionOrientation(direction);
  const offset = direction === 0 /* Up */ ? box.top : direction === 3 /* Right */ ? box.left + box.width : direction === 1 /* Down */ ? box.top + box.height : box.left;
  const range = {
    start: orientation === Orientation.HORIZONTAL ? box.top : box.left,
    end: orientation === Orientation.HORIZONTAL ? box.top + box.height : box.left + box.width
  };
  return { offset, range };
}
function findAdjacentBoxLeafNodes(boxNode, direction, boundary) {
  const result = [];
  function _(boxNode2, direction2, boundary2) {
    if (isGridBranchNode(boxNode2)) {
      for (const child of boxNode2.children) {
        _(child, direction2, boundary2);
      }
    } else {
      const { offset, range } = getBoxBoundary(boxNode2.box, direction2);
      if (offset === boundary2.offset && intersects(range, boundary2.range)) {
        result.push(boxNode2);
      }
    }
  }
  _(boxNode, direction, boundary);
  return result;
}
function getLocationOrientation(rootOrientation, location) {
  return location.length % 2 === 0 ? orthogonal(rootOrientation) : rootOrientation;
}
function getDirectionOrientation(direction) {
  return direction === 0 /* Up */ || direction === 1 /* Down */ ? Orientation.VERTICAL : Orientation.HORIZONTAL;
}
function getRelativeLocation(rootOrientation, location, direction) {
  const orientation = getLocationOrientation(rootOrientation, location);
  const directionOrientation = getDirectionOrientation(direction);
  if (orientation === directionOrientation) {
    let [rest, index] = tail(location);
    if (direction === 3 /* Right */ || direction === 1 /* Down */) {
      index += 1;
    }
    return [...rest, index];
  } else {
    const index = direction === 3 /* Right */ || direction === 1 /* Down */ ? 1 : 0;
    return [...location, index];
  }
}
function indexInParent(element) {
  const parentElement = element.parentElement;
  if (!parentElement) {
    throw new Error("Invalid grid element");
  }
  let el = parentElement.firstElementChild;
  let index = 0;
  while (el !== element && el !== parentElement.lastElementChild && el) {
    el = el.nextElementSibling;
    index++;
  }
  return index;
}
function getGridLocation(element) {
  const parentElement = element.parentElement;
  if (!parentElement) {
    throw new Error("Invalid grid element");
  }
  if (/\bmonaco-grid-view\b/.test(parentElement.className)) {
    return [];
  }
  const index = indexInParent(parentElement);
  const ancestor = parentElement.parentElement.parentElement.parentElement.parentElement;
  return [...getGridLocation(ancestor), index];
}
var Sizing;
((Sizing2) => {
  Sizing2.Distribute = { type: "distribute" };
  Sizing2.Split = { type: "split" };
  Sizing2.Auto = { type: "auto" };
  function Invisible(cachedVisibleSize) {
    return { type: "invisible", cachedVisibleSize };
  }
  Sizing2.Invisible = Invisible;
})(Sizing || (Sizing = {}));
class Grid extends Disposable {
  /**
   * Create a new {@link Grid}. A grid must *always* have a view
   * inside.
   *
   * @param view An initial view for this Grid.
   */
  constructor(view, options = {}) {
    super();
    this.views = /* @__PURE__ */ new Map();
    this.didLayout = false;
    if (view instanceof GridView) {
      this.gridview = view;
      this.gridview.getViewMap(this.views);
    } else {
      this.gridview = new GridView(options);
    }
    this._register(this.gridview);
    this._register(this.gridview.onDidSashReset(this.onDidSashReset, this));
    if (!(view instanceof GridView)) {
      this._addView(view, 0, [0]);
    }
    this.onDidChange = this.gridview.onDidChange;
    this.onDidScroll = this.gridview.onDidScroll;
    this.onDidChangeViewMaximized = this.gridview.onDidChangeViewMaximized;
  }
  /**
   * The orientation of the grid. Matches the orientation of the root
   * {@link SplitView} in the grid's {@link GridLocation} model.
   */
  get orientation() {
    return this.gridview.orientation;
  }
  set orientation(orientation) {
    this.gridview.orientation = orientation;
  }
  /**
   * The width of the grid.
   */
  get width() {
    return this.gridview.width;
  }
  /**
   * The height of the grid.
   */
  get height() {
    return this.gridview.height;
  }
  /**
   * The minimum width of the grid.
   */
  get minimumWidth() {
    return this.gridview.minimumWidth;
  }
  /**
   * The minimum height of the grid.
   */
  get minimumHeight() {
    return this.gridview.minimumHeight;
  }
  /**
   * The maximum width of the grid.
   */
  get maximumWidth() {
    return this.gridview.maximumWidth;
  }
  /**
   * The maximum height of the grid.
   */
  get maximumHeight() {
    return this.gridview.maximumHeight;
  }
  /**
   * A collection of sashes perpendicular to each edge of the grid.
   * Corner sashes will be created for each intersection.
   */
  get boundarySashes() {
    return this.gridview.boundarySashes;
  }
  set boundarySashes(boundarySashes) {
    this.gridview.boundarySashes = boundarySashes;
  }
  /**
   * Enable/disable edge snapping across all grid views.
   */
  set edgeSnapping(edgeSnapping) {
    this.gridview.edgeSnapping = edgeSnapping;
  }
  /**
   * The DOM element for this view.
   */
  get element() {
    return this.gridview.element;
  }
  style(styles) {
    this.gridview.style(styles);
  }
  /**
   * Layout the {@link Grid}.
   *
   * Optionally provide a `top` and `left` positions, those will propagate
   * as an origin for positions passed to {@link IView.layout}.
   *
   * @param width The width of the {@link Grid}.
   * @param height The height of the {@link Grid}.
   * @param top Optional, the top location of the {@link Grid}.
   * @param left Optional, the left location of the {@link Grid}.
   */
  layout(width, height, top = 0, left = 0) {
    this.gridview.layout(width, height, top, left);
    this.didLayout = true;
  }
  /**
   * Add a {@link IView view} to this {@link Grid}, based on another reference view.
   *
   * Take this grid as an example:
   *
   * ```
   *  +-----+---------------+
   *  |  A  |      B        |
   *  +-----+---------+-----+
   *  |        C      |     |
   *  +---------------+  D  |
   *  |        E      |     |
   *  +---------------+-----+
   * ```
   *
   * Calling `addView(X, Sizing.Distribute, C, Direction.Right)` will make the following
   * changes:
   *
   * ```
   *  +-----+---------------+
   *  |  A  |      B        |
   *  +-----+-+-------+-----+
   *  |   C   |   X   |     |
   *  +-------+-------+  D  |
   *  |        E      |     |
   *  +---------------+-----+
   * ```
   *
   * Or `addView(X, Sizing.Distribute, D, Direction.Down)`:
   *
   * ```
   *  +-----+---------------+
   *  |  A  |      B        |
   *  +-----+---------+-----+
   *  |        C      |  D  |
   *  +---------------+-----+
   *  |        E      |  X  |
   *  +---------------+-----+
   * ```
   *
   * @param newView The view to add.
   * @param size Either a fixed size, or a dynamic {@link Sizing} strategy.
   * @param referenceView Another view to place this new view next to.
   * @param direction The direction the new view should be placed next to the reference view.
   */
  addView(newView, size, referenceView, direction) {
    if (this.views.has(newView)) {
      throw new Error("Can't add same view twice");
    }
    const orientation = getDirectionOrientation(direction);
    if (this.views.size === 1 && this.orientation !== orientation) {
      this.orientation = orientation;
    }
    const referenceLocation = this.getViewLocation(referenceView);
    const location = getRelativeLocation(this.gridview.orientation, referenceLocation, direction);
    let viewSize;
    if (typeof size === "number") {
      viewSize = size;
    } else if (size.type === "split") {
      const [, index] = tail(referenceLocation);
      viewSize = GridViewSizing.Split(index);
    } else if (size.type === "distribute") {
      viewSize = GridViewSizing.Distribute;
    } else if (size.type === "auto") {
      const [, index] = tail(referenceLocation);
      viewSize = GridViewSizing.Auto(index);
    } else {
      viewSize = size;
    }
    this._addView(newView, viewSize, location);
  }
  addViewAt(newView, size, location) {
    if (this.views.has(newView)) {
      throw new Error("Can't add same view twice");
    }
    let viewSize;
    if (typeof size === "number") {
      viewSize = size;
    } else if (size.type === "distribute") {
      viewSize = GridViewSizing.Distribute;
    } else {
      viewSize = size;
    }
    this._addView(newView, viewSize, location);
  }
  _addView(newView, size, location) {
    this.views.set(newView, newView.element);
    this.gridview.addView(newView, size, location);
  }
  /**
   * Remove a {@link IView view} from this {@link Grid}.
   *
   * @param view The {@link IView view} to remove.
   * @param sizing Whether to distribute other {@link IView view}'s sizes.
   */
  removeView(view, sizing) {
    if (this.views.size === 1) {
      throw new Error("Can't remove last view");
    }
    const location = this.getViewLocation(view);
    let gridViewSizing;
    if (sizing?.type === "distribute") {
      gridViewSizing = GridViewSizing.Distribute;
    } else if (sizing?.type === "auto") {
      const index = location[location.length - 1];
      gridViewSizing = GridViewSizing.Auto(index === 0 ? 1 : index - 1);
    }
    this.gridview.removeView(location, gridViewSizing);
    this.views.delete(view);
  }
  /**
   * Move a {@link IView view} to another location in the grid.
   *
   * @remarks See {@link Grid.addView}.
   *
   * @param view The {@link IView view} to move.
   * @param sizing Either a fixed size, or a dynamic {@link Sizing} strategy.
   * @param referenceView Another view to place the view next to.
   * @param direction The direction the view should be placed next to the reference view.
   */
  moveView(view, sizing, referenceView, direction) {
    const sourceLocation = this.getViewLocation(view);
    const [sourceParentLocation, from] = tail(sourceLocation);
    const referenceLocation = this.getViewLocation(referenceView);
    const targetLocation = getRelativeLocation(this.gridview.orientation, referenceLocation, direction);
    const [targetParentLocation, to] = tail(targetLocation);
    if (equals(sourceParentLocation, targetParentLocation)) {
      this.gridview.moveView(sourceParentLocation, from, to);
    } else {
      this.removeView(view, typeof sizing === "number" ? void 0 : sizing);
      this.addView(view, sizing, referenceView, direction);
    }
  }
  /**
   * Move a {@link IView view} to another location in the grid.
   *
   * @remarks Internal method, do not use without knowing what you're doing.
   * @remarks See {@link GridView.moveView}.
   *
   * @param view The {@link IView view} to move.
   * @param location The {@link GridLocation location} to insert the view on.
   */
  moveViewTo(view, location) {
    const sourceLocation = this.getViewLocation(view);
    const [sourceParentLocation, from] = tail(sourceLocation);
    const [targetParentLocation, to] = tail(location);
    if (equals(sourceParentLocation, targetParentLocation)) {
      this.gridview.moveView(sourceParentLocation, from, to);
    } else {
      const size = this.getViewSize(view);
      const orientation = getLocationOrientation(this.gridview.orientation, sourceLocation);
      const cachedViewSize = this.getViewCachedVisibleSize(view);
      const sizing = typeof cachedViewSize === "undefined" ? orientation === Orientation.HORIZONTAL ? size.width : size.height : Sizing.Invisible(cachedViewSize);
      this.removeView(view);
      this.addViewAt(view, sizing, location);
    }
  }
  /**
   * Swap two {@link IView views} within the {@link Grid}.
   *
   * @param from One {@link IView view}.
   * @param to Another {@link IView view}.
   */
  swapViews(from, to) {
    const fromLocation = this.getViewLocation(from);
    const toLocation = this.getViewLocation(to);
    return this.gridview.swapViews(fromLocation, toLocation);
  }
  /**
   * Resize a {@link IView view}.
   *
   * @param view The {@link IView view} to resize.
   * @param size The size the view should be.
   */
  resizeView(view, size) {
    const location = this.getViewLocation(view);
    return this.gridview.resizeView(location, size);
  }
  /**
   * Returns whether all other {@link IView views} are at their minimum size.
   *
   * @param view The reference {@link IView view}.
   */
  isViewExpanded(view) {
    const location = this.getViewLocation(view);
    return this.gridview.isViewExpanded(location);
  }
  /**
   * Returns whether the {@link IView view} is maximized.
   *
   * @param view The reference {@link IView view}.
   */
  isViewMaximized(view) {
    const location = this.getViewLocation(view);
    return this.gridview.isViewMaximized(location);
  }
  /**
   * Returns whether the {@link IView view} is maximized.
   *
   * @param view The reference {@link IView view}.
   */
  hasMaximizedView() {
    return this.gridview.hasMaximizedView();
  }
  /**
   * Get the size of a {@link IView view}.
   *
   * @param view The {@link IView view}. Provide `undefined` to get the size
   * of the grid itself.
   */
  getViewSize(view) {
    if (!view) {
      return this.gridview.getViewSize();
    }
    const location = this.getViewLocation(view);
    return this.gridview.getViewSize(location);
  }
  /**
   * Get the cached visible size of a {@link IView view}. This was the size
   * of the view at the moment it last became hidden.
   *
   * @param view The {@link IView view}.
   */
  getViewCachedVisibleSize(view) {
    const location = this.getViewLocation(view);
    return this.gridview.getViewCachedVisibleSize(location);
  }
  /**
   * Maximizes the specified view and hides all other views.
   * @param view The view to maximize.
   * @param excludeViews Optional array of views to exclude from being hidden.
   */
  maximizeView(view, excludeViews = []) {
    if (this.views.size < 2) {
      throw new Error("At least two views are required to maximize a view");
    }
    const location = this.getViewLocation(view);
    this.gridview.maximizeView(location, excludeViews);
  }
  exitMaximizedView() {
    this.gridview.exitMaximizedView();
  }
  /**
   * Expand the size of a {@link IView view} by collapsing all other views
   * to their minimum sizes.
   *
   * @param view The {@link IView view}.
   */
  expandView(view) {
    const location = this.getViewLocation(view);
    this.gridview.expandView(location);
  }
  /**
   * Distribute the size among all {@link IView views} within the entire grid.
   */
  distributeViewSizes() {
    this.gridview.distributeViewSizes();
  }
  /**
   * Returns whether a {@link IView view} is visible.
   *
   * @param view The {@link IView view}.
   */
  isViewVisible(view) {
    const location = this.getViewLocation(view);
    return this.gridview.isViewVisible(location);
  }
  /**
   * Set the visibility state of a {@link IView view}.
   *
   * @param view The {@link IView view}.
   * @param sizing Whether to redistribute the containing {@link SplitView} after revealing the view.
   */
  setViewVisible(view, visible, sizing) {
    const location = this.getViewLocation(view);
    this.gridview.setViewVisible(location, visible);
    if (visible && sizing?.type === "distribute") {
      const parentLocation = location.length > 0 ? tail(location)[0] : void 0;
      this.gridview.distributeViewSizes(parentLocation);
    }
  }
  /**
   * Returns a descriptor for the entire grid.
   */
  getViews() {
    return this.gridview.getView();
  }
  /**
   * Utility method to return the collection all views which intersect
   * a view's edge.
   *
   * @param view The {@link IView view}.
   * @param direction Which direction edge to be considered.
   * @param wrap Whether the grid wraps around (from right to left, from bottom to top).
   */
  getNeighborViews(view, direction, wrap = false) {
    if (!this.didLayout) {
      throw new Error("Can't call getNeighborViews before first layout");
    }
    const location = this.getViewLocation(view);
    const root = this.getViews();
    const node = getGridNode(root, location);
    let boundary = getBoxBoundary(node.box, direction);
    if (wrap) {
      if (direction === 0 /* Up */ && node.box.top === 0) {
        boundary = { offset: root.box.top + root.box.height, range: boundary.range };
      } else if (direction === 3 /* Right */ && node.box.left + node.box.width === root.box.width) {
        boundary = { offset: 0, range: boundary.range };
      } else if (direction === 1 /* Down */ && node.box.top + node.box.height === root.box.height) {
        boundary = { offset: 0, range: boundary.range };
      } else if (direction === 2 /* Left */ && node.box.left === 0) {
        boundary = { offset: root.box.left + root.box.width, range: boundary.range };
      }
    }
    return findAdjacentBoxLeafNodes(root, oppositeDirection(direction), boundary).map((node2) => node2.view);
  }
  getViewLocation(view) {
    const element = this.views.get(view);
    if (!element) {
      throw new Error("View not found");
    }
    return getGridLocation(element);
  }
  onDidSashReset(location) {
    const resizeToPreferredSize = (location2) => {
      const node = this.gridview.getView(location2);
      if (isGridBranchNode(node)) {
        return false;
      }
      const direction = getLocationOrientation(this.orientation, location2);
      const size = direction === Orientation.HORIZONTAL ? node.view.preferredWidth : node.view.preferredHeight;
      if (typeof size !== "number") {
        return false;
      }
      const viewSize = direction === Orientation.HORIZONTAL ? { width: Math.round(size) } : { height: Math.round(size) };
      this.gridview.resizeView(location2, viewSize);
      return true;
    };
    if (resizeToPreferredSize(location)) {
      return;
    }
    const [parentLocation, index] = tail(location);
    if (resizeToPreferredSize([...parentLocation, index + 1])) {
      return;
    }
    this.gridview.distributeViewSizes(parentLocation);
  }
}
class SerializableGrid extends Grid {
  constructor() {
    super(...arguments);
    /**
     * Useful information in order to proportionally restore view sizes
     * upon the very first layout call.
     */
    this.initialLayoutContext = true;
  }
  static serializeNode(node, orientation) {
    const size = orientation === Orientation.VERTICAL ? node.box.width : node.box.height;
    if (!isGridBranchNode(node)) {
      const serializedLeafNode = { type: "leaf", data: node.view.toJSON(), size };
      if (typeof node.cachedVisibleSize === "number") {
        serializedLeafNode.size = node.cachedVisibleSize;
        serializedLeafNode.visible = false;
      } else if (node.maximized) {
        serializedLeafNode.maximized = true;
      }
      return serializedLeafNode;
    }
    const data = node.children.map((c) => SerializableGrid.serializeNode(c, orthogonal(orientation)));
    if (data.some((c) => c.visible !== false)) {
      return { type: "branch", data, size };
    }
    return { type: "branch", data, size, visible: false };
  }
  /**
   * Construct a new {@link SerializableGrid} from a JSON object.
   *
   * @param json The JSON object.
   * @param deserializer A deserializer which can revive each view.
   * @returns A new {@link SerializableGrid} instance.
   */
  static deserialize(json, deserializer, options = {}) {
    if (typeof json.orientation !== "number") {
      throw new Error("Invalid JSON: 'orientation' property must be a number.");
    } else if (typeof json.width !== "number") {
      throw new Error("Invalid JSON: 'width' property must be a number.");
    } else if (typeof json.height !== "number") {
      throw new Error("Invalid JSON: 'height' property must be a number.");
    }
    const gridview = GridView.deserialize(json, deserializer, options);
    const result = new SerializableGrid(gridview, options);
    return result;
  }
  /**
   * Construct a new {@link SerializableGrid} from a grid descriptor.
   *
   * @param gridDescriptor A grid descriptor in which leaf nodes point to actual views.
   * @returns A new {@link SerializableGrid} instance.
   */
  static from(gridDescriptor, options = {}) {
    return SerializableGrid.deserialize(createSerializedGrid(gridDescriptor), { fromJSON: (view) => view }, options);
  }
  /**
   * Serialize this grid into a JSON object.
   */
  serialize() {
    return {
      root: SerializableGrid.serializeNode(this.getViews(), this.orientation),
      orientation: this.orientation,
      width: this.width,
      height: this.height
    };
  }
  layout(width, height, top = 0, left = 0) {
    super.layout(width, height, top, left);
    if (this.initialLayoutContext) {
      this.initialLayoutContext = false;
      this.gridview.trySet2x2();
    }
  }
}
function isGridBranchNodeDescriptor(nodeDescriptor) {
  return !!nodeDescriptor.groups;
}
function sanitizeGridNodeDescriptor(nodeDescriptor, rootNode) {
  if (!rootNode && nodeDescriptor.groups && nodeDescriptor.groups.length <= 1) {
    nodeDescriptor.groups = void 0;
  }
  if (!isGridBranchNodeDescriptor(nodeDescriptor)) {
    return;
  }
  let totalDefinedSize = 0;
  let totalDefinedSizeCount = 0;
  for (const child of nodeDescriptor.groups) {
    sanitizeGridNodeDescriptor(child, false);
    if (child.size) {
      totalDefinedSize += child.size;
      totalDefinedSizeCount++;
    }
  }
  const totalUndefinedSize = totalDefinedSizeCount > 0 ? totalDefinedSize : 1;
  const totalUndefinedSizeCount = nodeDescriptor.groups.length - totalDefinedSizeCount;
  const eachUndefinedSize = totalUndefinedSize / totalUndefinedSizeCount;
  for (const child of nodeDescriptor.groups) {
    if (!child.size) {
      child.size = eachUndefinedSize;
    }
  }
}
function createSerializedNode(nodeDescriptor) {
  if (isGridBranchNodeDescriptor(nodeDescriptor)) {
    return { type: "branch", data: nodeDescriptor.groups.map((c) => createSerializedNode(c)), size: nodeDescriptor.size };
  } else {
    return { type: "leaf", data: nodeDescriptor.data, size: nodeDescriptor.size };
  }
}
function getDimensions(node, orientation) {
  if (node.type === "branch") {
    const childrenDimensions = node.data.map((c) => getDimensions(c, orthogonal(orientation)));
    if (orientation === Orientation.VERTICAL) {
      const width = node.size || (childrenDimensions.length === 0 ? void 0 : Math.max(...childrenDimensions.map((d) => d.width || 0)));
      const height = childrenDimensions.length === 0 ? void 0 : childrenDimensions.reduce((r, d) => r + (d.height || 0), 0);
      return { width, height };
    } else {
      const width = childrenDimensions.length === 0 ? void 0 : childrenDimensions.reduce((r, d) => r + (d.width || 0), 0);
      const height = node.size || (childrenDimensions.length === 0 ? void 0 : Math.max(...childrenDimensions.map((d) => d.height || 0)));
      return { width, height };
    }
  } else {
    const width = orientation === Orientation.VERTICAL ? node.size : void 0;
    const height = orientation === Orientation.VERTICAL ? void 0 : node.size;
    return { width, height };
  }
}
function createSerializedGrid(gridDescriptor) {
  sanitizeGridNodeDescriptor(gridDescriptor, true);
  const root = createSerializedNode(gridDescriptor);
  const { width, height } = getDimensions(root, gridDescriptor.orientation);
  return {
    root,
    orientation: gridDescriptor.orientation,
    width: width || 1,
    height: height || 1
  };
}
export {
  Direction,
  Grid,
  LayoutPriority,
  Orientation2 as Orientation,
  SerializableGrid,
  Sizing,
  createSerializedGrid,
  getRelativeLocation,
  isGridBranchNode,
  orthogonal2 as orthogonal,
  sanitizeGridNodeDescriptor
};
