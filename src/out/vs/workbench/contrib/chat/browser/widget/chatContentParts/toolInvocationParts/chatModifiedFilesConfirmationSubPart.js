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
import * as dom from "../../../../../../../base/browser/dom.js";
import { Button, ButtonWithIcon } from "../../../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { basename, isEqual } from "../../../../../../../base/common/resources.js";
import { hasKey } from "../../../../../../../base/common/types.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { localize } from "../../../../../../../nls.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { IMarkdownRendererService } from "../../../../../../../platform/markdown/browser/markdownRenderer.js";
import { defaultButtonStyles } from "../../../../../../../platform/theme/browser/defaultStyles.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../../common/tools/languageModelToolsService.js";
import { ModifiedFileEntryState } from "../../../../common/editing/chatEditingService.js";
import { ChatContextKeys } from "../../../../common/actions/chatContextKeys.js";
import { IChatWidgetService } from "../../../chat.js";
import { IChatToolRiskAssessmentService } from "../../../tools/chatToolRiskAssessmentService.js";
import { ChatCustomConfirmationWidget } from "../chatConfirmationWidget.js";
import { renderFileWidgets } from "../chatInlineAnchorWidget.js";
import { IChatMarkdownAnchorService } from "../chatMarkdownAnchorService.js";
import { IEditorService } from "../../../../../../services/editor/common/editorService.js";
import { AbstractToolConfirmationSubPart } from "./abstractToolConfirmationSubPart.js";
import { createApprovalReasonBadge } from "./toolRiskBadgeHelper.js";
function isCreatedFile(file) {
  return file.editKind === "create" || file.editKind === void 0 && !file.originalUri && !file.originalContentUri && !!file.modifiedContentUri;
}
function findModifiedFileConfirmationEntry(modifiedFiles, resource) {
  return modifiedFiles.find((file) => isEqual(URI.revive(file.uri), resource));
}
function getModifiedFilesSummaryLabel(modifiedFiles) {
  const allFilesCreated = modifiedFiles.length > 0 && modifiedFiles.every(isCreatedFile);
  if (allFilesCreated) {
    return modifiedFiles.length === 1 ? localize("oneFileCreated", "1 file created") : localize("manyFilesCreated", "{0} files created", modifiedFiles.length);
  }
  return modifiedFiles.length === 1 ? localize("oneFileChanged", "1 file changed") : localize("manyFilesChanged", "{0} files changed", modifiedFiles.length);
}
function createModifiedFilePreviewEditorInput(resource, originalUri, modifiedContentUri, title, options) {
  const modifiedUri = modifiedContentUri ?? resource;
  if (originalUri) {
    return {
      original: { resource: originalUri },
      modified: { resource: modifiedUri },
      options
    };
  }
  if (modifiedContentUri) {
    return {
      label: title ?? basename(resource),
      original: { resource: void 0, contents: "" },
      modified: { resource: modifiedContentUri },
      options
    };
  }
  return { resource, options };
}
let ChatModifiedFilesConfirmationSubPart = class extends AbstractToolConfirmationSubPart {
  constructor(toolInvocation, context, listPool, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, markdownRendererService, chatMarkdownAnchorService, editorService, commandService, riskAssessmentService) {
    super(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService);
    this.listPool = listPool;
    this.markdownRendererService = markdownRendererService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.editorService = editorService;
    this.commandService = commandService;
    this.codeblocks = [];
    const state = toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation || !state.confirmationMessages?.title) {
      throw new Error("Modified files confirmation messages are missing");
    }
    const data = toolInvocation.toolSpecificData;
    if (!data || data.kind !== "modifiedFilesConfirmation") {
      throw new Error("Modified files confirmation data is missing");
    }
    const tool = languageModelToolsService.getTool(toolInvocation.toolId);
    const confirmWidget = this._register(this.instantiationService.createInstance(
      ChatCustomConfirmationWidget,
      this.context,
      {
        title: this.getTitle(),
        icon: tool?.icon && hasKey(tool.icon, { id: true }) ? tool.icon : Codicon.tools,
        subtitle: typeof toolInvocation.originMessage === "string" ? toolInvocation.originMessage : toolInvocation.originMessage?.value,
        buttons: this.createButtons(data.options),
        message: this.createWidgetContentElement(state.confirmationMessages.message, data),
        footerBanner: createApprovalReasonBadge(this._store, this.instantiationService, state.confirmationMessages.approvalReason)?.domNode ?? this.createRiskBadgeDomNode(state.parameters)
      }
    ));
    const hasToolConfirmation = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
    hasToolConfirmation.set(true);
    this._register(confirmWidget.onDidClick(({ button, isTouchClick }) => {
      button.data();
      if (!isTouchClick) {
        this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.focusInput();
      }
    }));
    this._register(toDisposable(() => hasToolConfirmation.reset()));
    this.domNode = confirmWidget.domNode;
  }
  createButtons(options) {
    const [primaryOption, ...secondaryOptions] = options;
    return [
      {
        label: primaryOption,
        data: () => this.confirmWith(this.toolInvocation, { type: ToolConfirmKind.UserAction, selectedButton: primaryOption }),
        moreActions: secondaryOptions.map((option) => ({
          label: option,
          data: () => this.confirmWith(this.toolInvocation, { type: ToolConfirmKind.UserAction, selectedButton: option })
        }))
      }
    ];
  }
  createWidgetContentElement(message, data) {
    const container = dom.$(".chat-modified-files-confirmation");
    if (message) {
      const renderedMessage = this._register(this.markdownRendererService.render(typeof message === "string" ? new MarkdownString(message) : message));
      renderFileWidgets(renderedMessage.element, this.instantiationService, this.chatMarkdownAnchorService, this._store, {
        ...this.openedEditors.fileWidgetOptions,
        openResource: (resource, editorOptions) => this.openModifiedFilePreview(data, resource, editorOptions)
      });
      container.append(renderedMessage.element);
    }
    container.append(this.createModifiedFilesElement(data));
    return container;
  }
  createModifiedFilesElement(data) {
    const container = dom.$(".chat-modified-files-confirmation-list.chat-editing-session-container.show-file-icons");
    const overview = dom.append(container, dom.$(".chat-editing-session-overview"));
    const title = dom.append(overview, dom.$(".working-set-title"));
    const titleButton = this._register(new ButtonWithIcon(title, {
      buttonBackground: void 0,
      buttonBorder: void 0,
      buttonForeground: void 0,
      buttonHoverBackground: void 0,
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0,
      supportIcons: true
    }));
    const actions = dom.append(overview, dom.$(".chat-editing-session-actions"));
    const countsContainer = dom.$(".working-set-line-counts");
    const addedSpan = dom.append(countsContainer, dom.$(".working-set-lines-added"));
    const removedSpan = dom.append(countsContainer, dom.$(".working-set-lines-removed"));
    titleButton.element.appendChild(countsContainer);
    const filesLabel = getModifiedFilesSummaryLabel(data.modifiedFiles);
    titleButton.label = filesLabel;
    let added = 0;
    let removed = 0;
    let hasDiffStats = false;
    for (const file of data.modifiedFiles) {
      if (typeof file.insertions === "number" || typeof file.deletions === "number") {
        hasDiffStats = true;
        added += file.insertions ?? 0;
        removed += file.deletions ?? 0;
      }
    }
    if (hasDiffStats) {
      addedSpan.textContent = `+${added}`;
      removedSpan.textContent = `-${removed}`;
      titleButton.element.setAttribute("aria-label", localize("modifiedFilesSummaryWithCounts", "{0}, {1} lines added, {2} lines removed", filesLabel, added, removed));
      countsContainer.setAttribute("aria-label", localize("modifiedFilesCounts", "{0} lines added, {1} lines removed", added, removed));
    } else {
      countsContainer.remove();
      titleButton.element.setAttribute("aria-label", filesLabel);
    }
    const viewAllChangesButton = this._register(new Button(actions, {
      ...defaultButtonStyles,
      secondary: true,
      small: true,
      supportIcons: true,
      ariaLabel: localize("viewAllChanges", "View All Changes"),
      title: localize("viewAllChanges", "View All Changes")
    }));
    viewAllChangesButton.element.classList.add("default-colors");
    viewAllChangesButton.icon = Codicon.diffMultiple;
    viewAllChangesButton.label = " ";
    this._register(viewAllChangesButton.onDidClick(async () => {
      await this.openAllChanges(data);
    }));
    const listReference = this._register(this.listPool.get());
    const list = listReference.object;
    const listItems = data.modifiedFiles.map((file) => {
      const resource = URI.revive(file.uri);
      const originalUri = file.originalUri ? URI.revive(file.originalUri) : void 0;
      const modifiedContentUri = file.modifiedContentUri ? URI.revive(file.modifiedContentUri) : void 0;
      const originalContentUri = file.originalContentUri ? URI.revive(file.originalContentUri) : void 0;
      return {
        kind: "reference",
        reference: resource,
        title: file.title,
        description: file.description,
        state: ModifiedFileEntryState.Accepted,
        showModifiedState: true,
        options: {
          diffMeta: typeof file.insertions === "number" || typeof file.deletions === "number" ? {
            added: file.insertions ?? 0,
            removed: file.deletions ?? 0
          } : void 0,
          originalUri: originalContentUri ?? originalUri,
          modifiedUri: modifiedContentUri,
          status: void 0
        }
      };
    });
    this._register(list.onDidOpen(async (e) => {
      if (e.element?.kind !== "reference" || !URI.isUri(e.element.reference)) {
        return;
      }
      const options = e.element.options;
      await this.editorService.openEditor(createModifiedFilePreviewEditorInput(
        e.element.reference,
        options?.originalUri,
        options?.modifiedUri,
        e.element.title,
        e.editorOptions
      ));
    }));
    const maxItemsShown = 6;
    const itemsShown = Math.min(listItems.length, maxItemsShown);
    const height = itemsShown * 22;
    const workingSetContainer = dom.append(container, dom.$(".chat-editing-session-list.collapsed"));
    list.layout(height);
    list.getHTMLElement().style.height = `${height}px`;
    list.splice(0, list.length, listItems);
    workingSetContainer.append(list.getHTMLElement());
    let isCollapsed = true;
    const setExpansionState = () => {
      titleButton.icon = isCollapsed ? Codicon.chevronRight : Codicon.chevronDown;
      workingSetContainer.classList.toggle("collapsed", isCollapsed);
    };
    setExpansionState();
    const toggleWorkingSet = () => {
      isCollapsed = !isCollapsed;
      setExpansionState();
    };
    this._register(titleButton.onDidClick(toggleWorkingSet));
    this._register(dom.addDisposableListener(overview, "click", (e) => {
      if (e.defaultPrevented) {
        return;
      }
      const target = e.target;
      if (target.closest(".monaco-button")) {
        return;
      }
      toggleWorkingSet();
    }));
    return container;
  }
  async openModifiedFilePreview(data, resource, editorOptions) {
    const file = findModifiedFileConfirmationEntry(data.modifiedFiles, resource);
    if (!file) {
      return false;
    }
    await this.editorService.openEditor(createModifiedFilePreviewEditorInput(
      resource,
      file.originalContentUri ? URI.revive(file.originalContentUri) : file.originalUri ? URI.revive(file.originalUri) : void 0,
      file.modifiedContentUri ? URI.revive(file.modifiedContentUri) : void 0,
      file.title,
      editorOptions
    ));
    return true;
  }
  async openAllChanges(data) {
    await this.commandService.executeCommand("_workbench.openMultiDiffEditor", {
      title: localize("modifiedFilesAllChangesTitle", "All Changes"),
      resources: data.modifiedFiles.map((file) => ({
        originalUri: file.originalContentUri ? URI.revive(file.originalContentUri) : file.originalUri ? URI.revive(file.originalUri) : void 0,
        modifiedUri: file.modifiedContentUri ? URI.revive(file.modifiedContentUri) : URI.revive(file.uri)
      }))
    });
  }
  createContentElement() {
    throw new Error("Not used");
  }
  getTitle() {
    const state = this.toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return "";
    }
    const title = state.confirmationMessages?.title;
    return typeof title === "string" ? title : title?.value ?? "";
  }
};
ChatModifiedFilesConfirmationSubPart = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, ILanguageModelToolsService),
  __decorateParam(8, IMarkdownRendererService),
  __decorateParam(9, IChatMarkdownAnchorService),
  __decorateParam(10, IEditorService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, IChatToolRiskAssessmentService)
], ChatModifiedFilesConfirmationSubPart);
export {
  ChatModifiedFilesConfirmationSubPart,
  createModifiedFilePreviewEditorInput,
  findModifiedFileConfirmationEntry,
  getModifiedFilesSummaryLabel
};
