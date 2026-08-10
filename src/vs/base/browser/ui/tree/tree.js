import { ListDragOverEffectPosition, ListDragOverEffectType } from "../list/list.js";
var TreeVisibility = /* @__PURE__ */ ((TreeVisibility2) => {
  TreeVisibility2[TreeVisibility2["Hidden"] = 0] = "Hidden";
  TreeVisibility2[TreeVisibility2["Visible"] = 1] = "Visible";
  TreeVisibility2[TreeVisibility2["Recurse"] = 2] = "Recurse";
  return TreeVisibility2;
})(TreeVisibility || {});
var ObjectTreeElementCollapseState = /* @__PURE__ */ ((ObjectTreeElementCollapseState2) => {
  ObjectTreeElementCollapseState2[ObjectTreeElementCollapseState2["Expanded"] = 0] = "Expanded";
  ObjectTreeElementCollapseState2[ObjectTreeElementCollapseState2["Collapsed"] = 1] = "Collapsed";
  ObjectTreeElementCollapseState2[ObjectTreeElementCollapseState2["PreserveOrExpanded"] = 2] = "PreserveOrExpanded";
  ObjectTreeElementCollapseState2[ObjectTreeElementCollapseState2["PreserveOrCollapsed"] = 3] = "PreserveOrCollapsed";
  return ObjectTreeElementCollapseState2;
})(ObjectTreeElementCollapseState || {});
var TreeMouseEventTarget = /* @__PURE__ */ ((TreeMouseEventTarget2) => {
  TreeMouseEventTarget2[TreeMouseEventTarget2["Unknown"] = 0] = "Unknown";
  TreeMouseEventTarget2[TreeMouseEventTarget2["Twistie"] = 1] = "Twistie";
  TreeMouseEventTarget2[TreeMouseEventTarget2["Element"] = 2] = "Element";
  TreeMouseEventTarget2[TreeMouseEventTarget2["Filter"] = 3] = "Filter";
  return TreeMouseEventTarget2;
})(TreeMouseEventTarget || {});
var TreeDragOverBubble = /* @__PURE__ */ ((TreeDragOverBubble2) => {
  TreeDragOverBubble2[TreeDragOverBubble2["Down"] = 0] = "Down";
  TreeDragOverBubble2[TreeDragOverBubble2["Up"] = 1] = "Up";
  return TreeDragOverBubble2;
})(TreeDragOverBubble || {});
const TreeDragOverReactions = {
  acceptBubbleUp() {
    return { accept: true, bubble: 1 /* Up */ };
  },
  acceptBubbleDown(autoExpand = false) {
    return { accept: true, bubble: 0 /* Down */, autoExpand };
  },
  acceptCopyBubbleUp() {
    return { accept: true, bubble: 1 /* Up */, effect: { type: ListDragOverEffectType.Copy, position: ListDragOverEffectPosition.Over } };
  },
  acceptCopyBubbleDown(autoExpand = false) {
    return { accept: true, bubble: 0 /* Down */, effect: { type: ListDragOverEffectType.Copy, position: ListDragOverEffectPosition.Over }, autoExpand };
  }
};
class TreeError extends Error {
  constructor(user, message) {
    super(`TreeError [${user}] ${message}`);
  }
}
class WeakMapper {
  constructor(fn) {
    this.fn = fn;
    this._map = /* @__PURE__ */ new WeakMap();
  }
  map(key) {
    let result = this._map.get(key);
    if (!result) {
      result = this.fn(key);
      this._map.set(key, result);
    }
    return result;
  }
}
export {
  ObjectTreeElementCollapseState,
  TreeDragOverBubble,
  TreeDragOverReactions,
  TreeError,
  TreeMouseEventTarget,
  TreeVisibility,
  WeakMapper
};
