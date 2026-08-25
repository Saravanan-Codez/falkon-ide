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
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { ChatCollapsibleListContentPart } from "../chatReferencesContentPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { getToolApprovalMessage } from "./chatToolPartUtilities.js";
let ChatResultListSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, context, message, toolDetails, listPool, instantiationService) {
    super(toolInvocation);
    this.codeblocks = [];
    const collapsibleListPart = this._register(instantiationService.createInstance(
      ChatCollapsibleListContentPart,
      toolDetails.map((detail) => ({
        kind: "reference",
        reference: detail
      })),
      message,
      context,
      listPool,
      getToolApprovalMessage(toolInvocation)
    ));
    collapsibleListPart.icon = Codicon.check;
    this.domNode = collapsibleListPart.domNode;
  }
};
ChatResultListSubPart = __decorateClass([
  __decorateParam(5, IInstantiationService)
], ChatResultListSubPart);
export {
  ChatResultListSubPart
};
