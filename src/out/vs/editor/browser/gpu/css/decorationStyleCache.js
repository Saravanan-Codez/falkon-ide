import { NKeyMap } from "../../../../base/common/map.js";
class DecorationStyleCache {
  constructor() {
    this._nextId = 1;
    this._cacheById = /* @__PURE__ */ new Map();
    this._cacheByStyle = new NKeyMap();
  }
  getOrCreateEntry(color, bold, opacity, strikethrough, strikethroughThickness, strikethroughColor) {
    if (color === void 0 && bold === void 0 && opacity === void 0 && strikethrough === void 0 && strikethroughThickness === void 0 && strikethroughColor === void 0) {
      return 0;
    }
    const result = this._cacheByStyle.get(
      color ?? 0,
      bold ? 1 : 0,
      opacity === void 0 ? "" : opacity.toFixed(2),
      strikethrough ? 1 : 0,
      strikethroughThickness === void 0 ? "" : strikethroughThickness.toFixed(2),
      strikethroughColor ?? 0
    );
    if (result) {
      return result.id;
    }
    const id = this._nextId++;
    const entry = {
      id,
      color,
      bold,
      opacity,
      strikethrough,
      strikethroughThickness,
      strikethroughColor
    };
    this._cacheById.set(id, entry);
    this._cacheByStyle.set(
      entry,
      color ?? 0,
      bold ? 1 : 0,
      opacity === void 0 ? "" : opacity.toFixed(2),
      strikethrough ? 1 : 0,
      strikethroughThickness === void 0 ? "" : strikethroughThickness.toFixed(2),
      strikethroughColor ?? 0
    );
    return id;
  }
  getStyleSet(id) {
    if (id === 0) {
      return void 0;
    }
    return this._cacheById.get(id);
  }
}
export {
  DecorationStyleCache
};
