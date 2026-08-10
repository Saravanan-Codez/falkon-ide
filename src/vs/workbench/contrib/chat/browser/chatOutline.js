import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { createMatches } from "../../../../base/common/filters.js";
import { escapeIcons } from "../../../../base/common/iconLabels.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { OutlineTarget } from "../../../services/outline/browser/outline.js";
import { isRequestVM } from "../common/model/chatViewModel.js";
import { isChatFollowup } from "../common/chatService/chatService.js";
import { getExplicitFileOrImageAttachmentSummary } from "../common/attachments/chatVariableEntries.js";
function getChatRequestLabel(request, index) {
  const message = request.message;
  let raw;
  if (isChatFollowup(message)) {
    raw = message.message ?? "";
  } else {
    raw = message.text || (Array.isArray(message.parts) ? message.parts.map((part) => part.text).join("") : "");
  }
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (text.length > 0) {
    return text;
  }
  return getExplicitFileOrImageAttachmentSummary(request.variables) ?? localize("chatOutline.emptyRequest", "Request {0}", index + 1);
}
class ChatOutlineEntry {
  constructor(index, element) {
    this.index = index;
    this.element = element;
  }
  get id() {
    return this.element.id;
  }
  get icon() {
    return Codicon.commentDiscussion;
  }
  get label() {
    return getChatRequestLabel(this.element, this.index);
  }
}
class ChatOutlineVirtualDelegate {
  getHeight() {
    return 22;
  }
  getTemplateId() {
    return ChatOutlineRenderer.templateId;
  }
}
class ChatOutlineRenderer {
  constructor() {
    this.templateId = ChatOutlineRenderer.templateId;
  }
  static {
    this.templateId = "ChatOutlineRenderer";
  }
  renderTemplate(container) {
    container.classList.add("chat-outline-element");
    const iconClass = document.createElement("div");
    container.append(iconClass);
    const iconLabel = new IconLabel(container, { supportHighlights: true });
    return { container, iconClass, iconLabel };
  }
  renderElement(node, _index, template) {
    const options = {
      matches: createMatches(node.filterData),
      labelEscapeNewLines: true
    };
    template.iconClass.className = "element-icon " + ThemeIcon.asClassNameArray(node.element.icon).join(" ");
    template.iconLabel.setLabel(node.element.label, void 0, options);
  }
  disposeTemplate(template) {
    template.iconLabel.dispose();
  }
}
class ChatOutlineAccessibility {
  getAriaLabel(element) {
    return element.label;
  }
  getWidgetAriaLabel() {
    return localize("chatOutline", "Chat Outline");
  }
}
class ChatOutlineComparator {
  compareByPosition(a, b) {
    return a.index - b.index;
  }
  compareByType(a, b) {
    return a.index - b.index;
  }
  compareByName(a, b) {
    return a.label.localeCompare(b.label);
  }
}
class ChatOutlineTreeDataSource {
  getChildren(element) {
    if (element instanceof ChatOutline) {
      return element.entries;
    }
    return [];
  }
}
class ChatOutlineQuickPickDataSource {
  constructor(_outline) {
    this._outline = _outline;
  }
  getQuickPickElements() {
    return this._outline.entries.map((entry) => ({
      element: entry,
      // Codicons cannot be passed via `iconClasses` in this quick pick (only
      // file icons can); embed the icon inline in the label instead and
      // escape only the request text so `$(...)` in it stays literal.
      label: `$(${entry.icon.id}) ${escapeIcons(entry.label)}`,
      ariaLabel: entry.label
    }));
  }
}
class ChatOutlineBreadcrumbsDataSource {
  constructor(_outline) {
    this._outline = _outline;
  }
  getBreadcrumbElements() {
    const active = this._outline.activeElement;
    return active ? [{ element: active, label: active.label }] : [];
  }
}
class ChatOutline {
  constructor(_widget, target) {
    this._widget = _widget;
    this.outlineKind = "chat";
    this._disposables = new DisposableStore();
    this._onDidChange = this._disposables.add(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._entries = [];
    this._viewModelDisposables = this._disposables.add(new DisposableStore());
    this._entriesSignature = "";
    this._recomputeEntries();
    this._disposables.add(this._widget.onDidChangeViewModel(() => {
      const changed = this._recomputeEntries();
      this._registerViewModelListener();
      if (changed) {
        this._onDidChange.fire({});
      }
    }));
    this._registerViewModelListener();
    const options = {
      collapseByDefault: target === OutlineTarget.Breadcrumbs,
      expandOnlyOnTwistieClick: true,
      multipleSelectionSupport: false,
      accessibilityProvider: new ChatOutlineAccessibility(),
      identityProvider: { getId: (element) => element.id },
      keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (element) => element.label }
    };
    this.config = {
      treeDataSource: new ChatOutlineTreeDataSource(),
      quickPickDataSource: new ChatOutlineQuickPickDataSource(this),
      breadcrumbsDataSource: new ChatOutlineBreadcrumbsDataSource(this),
      delegate: new ChatOutlineVirtualDelegate(),
      renderers: [new ChatOutlineRenderer()],
      comparator: new ChatOutlineComparator(),
      options
    };
  }
  _registerViewModelListener() {
    this._viewModelDisposables.clear();
    const viewModel = this._widget.viewModel;
    if (viewModel) {
      this._viewModelDisposables.add(viewModel.onDidChange(() => {
        if (this._recomputeEntries()) {
          this._onDidChange.fire({});
        }
      }));
    }
  }
  _recomputeEntries() {
    const items = this._widget.viewModel?.getItems() ?? [];
    const entries = [];
    let index = 0;
    for (const item of items) {
      if (isRequestVM(item)) {
        entries.push(new ChatOutlineEntry(index++, item));
      }
    }
    const signature = entries.map((entry) => `${entry.id}\0${entry.label}`).join("");
    if (signature === this._entriesSignature) {
      return false;
    }
    this._entries = entries;
    this._entriesSignature = signature;
    return true;
  }
  get entries() {
    return this._entries;
  }
  get uri() {
    return this._widget.viewModel?.sessionResource;
  }
  get isEmpty() {
    return this._entries.length === 0;
  }
  get activeElement() {
    const focus = this._widget.getFocus();
    if (!focus) {
      return void 0;
    }
    return this._entries.find((entry) => entry.element === focus);
  }
  reveal(entry, _options, _sideBySide, _select) {
    const item = entry.element;
    this._widget.reveal(item);
    this._widget.focus(item);
  }
  preview(entry) {
    this._widget.reveal(entry.element);
    return Disposable.None;
  }
  captureViewState() {
    return Disposable.None;
  }
  dispose() {
    this._disposables.dispose();
  }
}
export {
  ChatOutline,
  ChatOutlineEntry,
  getChatRequestLabel
};
