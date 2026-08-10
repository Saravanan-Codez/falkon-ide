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
import { CustomizationHarnessServiceBase } from "../../../../workbench/contrib/chat/common/customizationHarnessService.js";
import { IPromptsService } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js";
let SessionsCustomizationHarnessService = class extends CustomizationHarnessServiceBase {
  constructor(promptsService) {
    super([], "", promptsService);
  }
  registerExternalHarness(descriptor) {
    const registration = super.registerExternalHarness(descriptor);
    if (!this.findHarnessById(this.activeHarness.get())) {
      this.setActiveSession(this.getSessionResourceForHarness(descriptor.id));
    }
    return registration;
  }
};
SessionsCustomizationHarnessService = __decorateClass([
  __decorateParam(0, IPromptsService)
], SessionsCustomizationHarnessService);
export {
  SessionsCustomizationHarnessService
};
