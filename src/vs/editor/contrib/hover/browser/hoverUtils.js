import * as dom from "../../../../base/browser/dom.js";
var PADDING = /* @__PURE__ */ ((PADDING2) => {
  PADDING2[PADDING2["VALUE"] = 3] = "VALUE";
  return PADDING2;
})(PADDING || {});
function isMousePositionWithinElement(element, posx, posy) {
  const elementRect = dom.getDomNodePagePosition(element);
  if (posx < elementRect.left + 3 /* VALUE */ || posx > elementRect.left + elementRect.width - 3 /* VALUE */ || posy < elementRect.top + 3 /* VALUE */ || posy > elementRect.top + elementRect.height - 3 /* VALUE */) {
    return false;
  }
  return true;
}
function shouldShowHover(hoverEnabled, multiCursorModifier, mouseEvent) {
  if (hoverEnabled === "on") {
    return true;
  }
  if (hoverEnabled === "off") {
    return false;
  }
  return isTriggerModifierPressed(multiCursorModifier, mouseEvent.event);
}
function isTriggerModifierPressed(multiCursorModifier, event) {
  if (multiCursorModifier === "altKey") {
    return event.ctrlKey || event.metaKey;
  }
  return event.altKey;
}
export {
  isMousePositionWithinElement,
  isTriggerModifierPressed,
  shouldShowHover
};
