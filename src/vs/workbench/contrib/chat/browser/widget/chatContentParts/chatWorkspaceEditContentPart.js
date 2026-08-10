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
import { $, append } from "../../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import { ChatProgressSubPart } from "./chatProgressContentPart.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
let ChatWorkspaceEditContentPart = class extends Disposable {
  constructor(workspaceEdit, _context, chatContentMarkdownRenderer, instantiationService, chatMarkdownAnchorService, labelService) {
    super();
    this.workspaceEdit = workspaceEdit;
    this.instantiationService = instantiationService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.labelService = labelService;
    this.domNode = $(".chat-workspace-edit-content-part");
    const renderEntry = (message, icon) => {
      const result = this._register(chatContentMarkdownRenderer.render(new MarkdownString(message, { isTrusted: true })));
      result.element.classList.add("progress-step");
      renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._store);
      const progressPart = this._register(this.instantiationService.createInstance(ChatProgressSubPart, result.element, icon, void 0));
      append(this.domNode, progressPart.domNode);
    };
    for (const edit of workspaceEdit.edits) {
      if (edit.oldResource && !edit.newResource) {
        renderEntry(localize("deleted", "Deleted `{0}`", this.labelService.getUriBasenameLabel(edit.oldResource)), Codicon.trash);
      } else if (!edit.oldResource && edit.newResource) {
        renderEntry(localize("created", "Created []({0})", edit.newResource.toString()), Codicon.newFile);
      } else if (edit.oldResource && edit.newResource) {
        renderEntry(localize("renamedTo", "Renamed {0} to []({1})", this.labelService.getUriBasenameLabel(edit.oldResource), edit.newResource.toString()), Codicon.arrowRight);
      }
    }
  }
  hasSameContent(other, _followingContent, _element) {
    if (other.kind !== "workspaceEdit") {
      return false;
    }
    if (other.edits.length !== this.workspaceEdit.edits.length) {
      return false;
    }
    for (let i = 0; i < other.edits.length; i++) {
      const a = other.edits[i];
      const b = this.workspaceEdit.edits[i];
      if (a.oldResource?.toString() !== b.oldResource?.toString() || a.newResource?.toString() !== b.newResource?.toString()) {
        return false;
      }
    }
    return true;
  }
};
ChatWorkspaceEditContentPart = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IChatMarkdownAnchorService),
  __decorateParam(5, ILabelService)
], ChatWorkspaceEditContentPart);
export {
  ChatWorkspaceEditContentPart
};
