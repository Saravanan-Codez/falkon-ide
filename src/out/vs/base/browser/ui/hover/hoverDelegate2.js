import { Disposable } from "../../../common/lifecycle.js";
let baseHoverDelegate = {
  showInstantHover: () => void 0,
  showDelayedHover: () => void 0,
  setupDelayedHover: () => Disposable.None,
  setupDelayedHoverAtMouse: () => Disposable.None,
  hideHover: () => void 0,
  showAndFocusLastHover: () => void 0,
  setupManagedHover: () => ({
    dispose: () => void 0,
    show: () => void 0,
    hide: () => void 0,
    update: () => void 0
  }),
  showManagedHover: () => void 0
};
function setBaseLayerHoverDelegate(hoverDelegate) {
  baseHoverDelegate = hoverDelegate;
}
function getBaseLayerHoverDelegate() {
  return baseHoverDelegate;
}
export {
  getBaseLayerHoverDelegate,
  setBaseLayerHoverDelegate
};
