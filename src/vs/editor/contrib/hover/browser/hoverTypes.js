var HoverAnchorType = /* @__PURE__ */ ((HoverAnchorType2) => {
  HoverAnchorType2[HoverAnchorType2["Range"] = 1] = "Range";
  HoverAnchorType2[HoverAnchorType2["ForeignElement"] = 2] = "ForeignElement";
  return HoverAnchorType2;
})(HoverAnchorType || {});
class HoverRangeAnchor {
  constructor(priority, range, initialMousePosX, initialMousePosY) {
    this.priority = priority;
    this.range = range;
    this.initialMousePosX = initialMousePosX;
    this.initialMousePosY = initialMousePosY;
    this.type = 1 /* Range */;
  }
  equals(other) {
    return other.type === 1 /* Range */ && this.range.equalsRange(other.range);
  }
  canAdoptVisibleHover(lastAnchor, showAtPosition) {
    return lastAnchor.type === 1 /* Range */ && showAtPosition.lineNumber === this.range.startLineNumber;
  }
}
class HoverForeignElementAnchor {
  constructor(priority, owner, range, initialMousePosX, initialMousePosY, supportsMarkerHover) {
    this.priority = priority;
    this.owner = owner;
    this.range = range;
    this.initialMousePosX = initialMousePosX;
    this.initialMousePosY = initialMousePosY;
    this.supportsMarkerHover = supportsMarkerHover;
    this.type = 2 /* ForeignElement */;
  }
  equals(other) {
    return other.type === 2 /* ForeignElement */ && this.owner === other.owner;
  }
  canAdoptVisibleHover(lastAnchor, showAtPosition) {
    return lastAnchor.type === 2 /* ForeignElement */ && this.owner === lastAnchor.owner;
  }
}
class RenderedHoverParts {
  constructor(renderedHoverParts, disposables) {
    this.renderedHoverParts = renderedHoverParts;
    this.disposables = disposables;
  }
  dispose() {
    for (const part of this.renderedHoverParts) {
      part.dispose();
    }
    this.disposables?.dispose();
  }
}
const HoverParticipantRegistry = new class HoverParticipantRegistry2 {
  constructor() {
    this._participants = [];
  }
  register(ctor) {
    this._participants.push(ctor);
  }
  getAll() {
    return this._participants;
  }
}();
export {
  HoverAnchorType,
  HoverForeignElementAnchor,
  HoverParticipantRegistry,
  HoverRangeAnchor,
  RenderedHoverParts
};
