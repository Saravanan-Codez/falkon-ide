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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX } from "../../../../platform/accessibility/common/accessibility.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
const IAccessibleViewInformationService = createDecorator("accessibleViewInformationService");
let AccessibleViewInformationService = class extends Disposable {
  constructor(_storageService) {
    super();
    this._storageService = _storageService;
  }
  hasShownAccessibleView(viewId) {
    return this._storageService.getBoolean(`${ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX}${viewId}`, StorageScope.APPLICATION, false) === true;
  }
};
AccessibleViewInformationService = __decorateClass([
  __decorateParam(0, IStorageService)
], AccessibleViewInformationService);
export {
  AccessibleViewInformationService,
  IAccessibleViewInformationService
};
