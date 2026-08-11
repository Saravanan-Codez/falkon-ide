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
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ListResizeColumnAction } from "./listResizeColumnAction.js";
let ListContext = class {
  static {
    this.ID = "workbench.contrib.listContext";
  }
  constructor(contextKeyService) {
    contextKeyService.createKey("listSupportsTypeNavigation", true);
    contextKeyService.createKey("listSupportsKeyboardNavigation", true);
  }
};
ListContext = __decorateClass([
  __decorateParam(0, IContextKeyService)
], ListContext);
registerWorkbenchContribution2(ListContext.ID, ListContext, WorkbenchPhase.BlockStartup);
registerAction2(ListResizeColumnAction);
export {
  ListContext
};
