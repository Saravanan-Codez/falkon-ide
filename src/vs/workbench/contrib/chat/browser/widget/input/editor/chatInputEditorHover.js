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
import { DisposableStore } from "../../../../../../../base/common/lifecycle.js";
import { Range } from "../../../../../../../editor/common/core/range.js";
import { HoverAnchorType, HoverParticipantRegistry, RenderedHoverParts } from "../../../../../../../editor/contrib/hover/browser/hoverTypes.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IChatWidgetService } from "../../../chat.js";
import { ChatAgentHover, getChatAgentHoverOptions } from "../../chatAgentHover.js";
import { ChatEditorHoverWrapper } from "./editorHoverWrapper.js";
import { ChatRequestDynamicVariablePart, extractAgentAndCommand } from "../../../../common/requestParser/chatParserTypes.js";
import * as nls from "../../../../../../../nls.js";
import { isImageVariableEntry } from "../../../../common/attachments/chatVariableEntries.js";
import { coerceImageBuffer } from "../../../../common/chatImageExtraction.js";
import { createImageHoverContent } from "../../../attachments/chatAttachmentWidgets.js";
import { URI } from "../../../../../../../base/common/uri.js";
let ChatAgentHoverParticipant = class {
  constructor(editor, instantiationService, chatWidgetService, commandService) {
    this.editor = editor;
    this.instantiationService = instantiationService;
    this.chatWidgetService = chatWidgetService;
    this.commandService = commandService;
    this.hoverOrdinal = 1;
  }
  computeSync(anchor, _lineDecorations) {
    if (!this.editor.hasModel()) {
      return [];
    }
    const widget = this.chatWidgetService.getWidgetByInputUri(this.editor.getModel().uri);
    if (!widget) {
      return [];
    }
    const { agentPart } = extractAgentAndCommand(widget.parsedInput);
    if (!agentPart) {
      return [];
    }
    if (Range.containsPosition(agentPart.editorRange, anchor.range.getStartPosition())) {
      return [new ChatAgentHoverPart(this, Range.lift(agentPart.editorRange), agentPart.agent)];
    }
    return [];
  }
  renderHoverParts(context, hoverParts) {
    if (!hoverParts.length) {
      return new RenderedHoverParts([]);
    }
    const disposables = new DisposableStore();
    const hover = disposables.add(this.instantiationService.createInstance(ChatAgentHover));
    disposables.add(hover.onDidChangeContents(() => context.onContentsChanged()));
    const hoverPart = hoverParts[0];
    const agent = hoverPart.agent;
    hover.setAgent(agent.id);
    const actions = getChatAgentHoverOptions(() => agent, this.commandService).actions;
    const wrapper = this.instantiationService.createInstance(ChatEditorHoverWrapper, hover.domNode, actions);
    const wrapperNode = wrapper.domNode;
    context.fragment.appendChild(wrapperNode);
    const renderedHoverPart = {
      hoverPart,
      hoverElement: wrapperNode,
      dispose() {
        disposables.dispose();
      }
    };
    return new RenderedHoverParts([renderedHoverPart]);
  }
  getAccessibleContent(hoverPart) {
    return nls.localize("hoverAccessibilityChatAgent", "There is a chat agent hover part here.");
  }
};
ChatAgentHoverParticipant = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, ICommandService)
], ChatAgentHoverParticipant);
class ChatAgentHoverPart {
  constructor(owner, range, agent) {
    this.owner = owner;
    this.range = range;
    this.agent = agent;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && this.range.startColumn <= anchor.range.startColumn && this.range.endColumn >= anchor.range.endColumn;
  }
}
HoverParticipantRegistry.register(ChatAgentHoverParticipant);
let ChatAttachmentReferenceHoverParticipant = class {
  constructor(editor, chatWidgetService) {
    this.editor = editor;
    this.chatWidgetService = chatWidgetService;
    this.hoverOrdinal = 2;
  }
  computeSync(anchor, _lineDecorations) {
    if (!this.editor.hasModel()) {
      return [];
    }
    const widget = this.chatWidgetService.getWidgetByInputUri(this.editor.getModel().uri);
    if (!widget) {
      return [];
    }
    const part = widget.parsedInput.parts.find((part2) => part2 instanceof ChatRequestDynamicVariablePart && part2.isAttachmentReference === true && Range.containsPosition(part2.editorRange, anchor.range.getStartPosition()));
    if (!part) {
      return [];
    }
    const attachment = widget.attachmentModel.attachments.find((attachment2) => attachment2.id === part.id && !attachment2.range);
    if (!attachment || !isImageVariableEntry(attachment)) {
      return [];
    }
    const buffer = coerceImageBuffer(attachment.value);
    return buffer ? [new ChatAttachmentReferenceHoverPart(this, Range.lift(part.editorRange), attachment, buffer)] : [];
  }
  renderHoverParts(context, hoverParts) {
    if (!hoverParts.length) {
      return new RenderedHoverParts([]);
    }
    const hoverPart = hoverParts[0];
    const resource = hoverPart.attachment.references?.find((reference) => URI.isUri(reference.reference))?.reference;
    const hover = createImageHoverContent(URI.isUri(resource) ? resource : void 0, hoverPart.attachment.fullName ?? hoverPart.attachment.name, hoverPart.buffer, hoverPart.attachment.id, () => context.onContentsChanged());
    hover.element.setAttribute("aria-label", nls.localize("chat.attachmentReference.imageHover", "Image attachment reference, {0}", hoverPart.attachment.name));
    context.fragment.appendChild(hover.element);
    return new RenderedHoverParts([{
      hoverPart,
      hoverElement: hover.element,
      dispose: () => hover.disposable.dispose()
    }]);
  }
  getAccessibleContent(hoverPart) {
    return nls.localize("chat.attachmentReference.imageHoverAccessible", "Image attachment reference, {0}", hoverPart.attachment.name);
  }
};
ChatAttachmentReferenceHoverParticipant = __decorateClass([
  __decorateParam(1, IChatWidgetService)
], ChatAttachmentReferenceHoverParticipant);
class ChatAttachmentReferenceHoverPart {
  constructor(owner, range, attachment, buffer) {
    this.owner = owner;
    this.range = range;
    this.attachment = attachment;
    this.buffer = buffer;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && Range.containsPosition(this.range, anchor.range.getStartPosition());
  }
}
HoverParticipantRegistry.register(ChatAttachmentReferenceHoverParticipant);
export {
  ChatAgentHoverPart,
  ChatAgentHoverParticipant,
  ChatAttachmentReferenceHoverPart,
  ChatAttachmentReferenceHoverParticipant
};
