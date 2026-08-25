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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { localize } from "../../../../../../nls.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { ChatEditPillElement, isResourceContentEmpty } from "./chatEditPillElement.js";
let ChatExternalEditContentPart = class extends ChatEditPillElement {
  constructor(edit, _context, labelService, modelService, languageService, hoverService, editorService, textModelService) {
    super(labelService, modelService, languageService, hoverService);
    this.edit = edit;
    this.editorService = editorService;
    this.textModelService = textModelService;
    this._onDidChangeDiff = this._register(new Emitter());
    /**
     * Fires once with the static diff stats from the part data. Wired up by
     * the list renderer so {@link ChatThinkingContentPart} can aggregate
     * per-file stats into the thinking title.
     *
     * The fire is deferred to the next microtask so that consumers
     * subscribing immediately after construction (e.g. via
     * `ChatThinkingContentPart.appendItem`) still receive the initial value.
     */
    this.onDidChangeDiff = this._onDidChangeDiff.event;
    this.render(edit);
    this._register(this.onDidClick((opts) => this.openEdit(opts)));
  }
  get domNode() {
    return this.element;
  }
  render(edit) {
    this.setUri(edit.uri);
    const { icon, label } = describeEdit(edit);
    this.setStatus(icon, label);
    this.setProgressFill(void 0);
    this.setLabelDetail("");
    if (edit.diff && (edit.diff.added > 0 || edit.diff.removed > 0)) {
      this.setDiff(edit.diff);
      const fileName = this.labelService.getUriBasenameLabel(edit.uri);
      const insertionsFragment = edit.diff.added === 1 ? localize("chat.codeblock.insertions.one", "1 insertion") : localize("chat.codeblock.insertions", "{0} insertions", edit.diff.added);
      const deletionsFragment = edit.diff.removed === 1 ? localize("chat.codeblock.deletions.one", "1 deletion") : localize("chat.codeblock.deletions", "{0} deletions", edit.diff.removed);
      this.setAriaLabel(localize("summary", "Edited {0}, {1}, {2}", fileName, insertionsFragment, deletionsFragment));
      const diff = edit.diff;
      queueMicrotask(() => {
        if (this._store.isDisposed) {
          return;
        }
        this._onDidChangeDiff.fire({ added: diff.added, removed: diff.removed });
      });
    } else {
      this.setDiff(void 0);
      this.setAriaLabel(`${label} ${this.labelService.getUriBasenameLabel(edit.uri)}`);
    }
  }
  async openEdit({ editorOptions: options, openToSide }) {
    const group = openToSide ? SIDE_GROUP : void 0;
    if (this.edit.beforeContentUri && this.edit.afterContentUri) {
      if (this.edit.editKind === "edit" && (this.edit.diff?.removed ?? 0) === 0 && await isResourceContentEmpty(this.textModelService, this.edit.beforeContentUri)) {
        this.editorService.openEditor({ resource: this.edit.uri, options }, group);
        return;
      }
      this.editorService.openEditor({
        original: { resource: this.edit.beforeContentUri },
        modified: { resource: this.edit.afterContentUri },
        options
      }, group);
    } else if (this.edit.editKind === "delete" && this.edit.beforeContentUri) {
      this.editorService.openEditor({ resource: this.edit.beforeContentUri, options }, group);
    } else if (this.edit.editKind !== "delete") {
      this.editorService.openEditor({ resource: this.edit.uri, options }, group);
    }
  }
  hasSameContent(other, _followingContent, _element) {
    if (other.kind !== "externalEdit") {
      return false;
    }
    return isEqual(other.uri, this.edit.uri) && other.editKind === this.edit.editKind && (other.diff?.added ?? 0) === (this.edit.diff?.added ?? 0) && (other.diff?.removed ?? 0) === (this.edit.diff?.removed ?? 0);
  }
};
ChatExternalEditContentPart = __decorateClass([
  __decorateParam(2, ILabelService),
  __decorateParam(3, IModelService),
  __decorateParam(4, ILanguageService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, ITextModelService)
], ChatExternalEditContentPart);
function describeEdit(edit) {
  switch (edit.editKind) {
    case "create":
      return { icon: Codicon.check, label: localize("chat.externalEdit.created", "Created") };
    case "delete":
      return { icon: Codicon.check, label: localize("chat.externalEdit.deleted", "Deleted") };
    case "rename":
      return { icon: Codicon.check, label: localize("chat.externalEdit.renamed", "Renamed") };
    case "edit":
      return { icon: Codicon.check, label: localize("chat.codeblock.edited", "Edited") };
  }
}
export {
  ChatExternalEditContentPart
};
