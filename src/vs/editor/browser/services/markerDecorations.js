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
import { IMarkerDecorationsService } from "../../common/services/markerDecorations.js";
let MarkerDecorationsContribution = class {
  static {
    this.ID = "editor.contrib.markerDecorations";
  }
  constructor(_editor, _markerDecorationsService) {
  }
  dispose() {
  }
};
MarkerDecorationsContribution = __decorateClass([
  __decorateParam(1, IMarkerDecorationsService)
], MarkerDecorationsContribution);
export {
  MarkerDecorationsContribution
};
