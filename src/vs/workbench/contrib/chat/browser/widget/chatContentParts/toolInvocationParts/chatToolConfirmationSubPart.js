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
import { Separator } from "../../../../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../../../../base/common/async.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { count } from "../../../../../../../base/common/strings.js";
import { isEmptyObject } from "../../../../../../../base/common/types.js";
import { generateUuid } from "../../../../../../../base/common/uuid.js";
import { ElementSizeObserver } from "../../../../../../../editor/browser/config/elementSizeObserver.js";
import { ILanguageService } from "../../../../../../../editor/common/languages/language.js";
import { localize } from "../../../../../../../nls.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { IMarkerService, MarkerSeverity } from "../../../../../../../platform/markers/common/markers.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { createToolSchemaUri, ILanguageModelToolsService } from "../../../../common/tools/languageModelToolsService.js";
import { ILanguageModelToolsConfirmationService } from "../../../../common/tools/languageModelToolsConfirmationService.js";
import { AcceptToolConfirmationActionId, SkipToolConfirmationActionId } from "../../../actions/chatToolActions.js";
import { IChatWidgetService } from "../../../chat.js";
import { IChatToolRiskAssessmentService } from "../../../tools/chatToolRiskAssessmentService.js";
import { renderFileWidgets } from "../chatInlineAnchorWidget.js";
import { CodeBlockPart } from "../codeBlockPart.js";
import { IChatMarkdownAnchorService } from "../chatMarkdownAnchorService.js";
import { ChatMarkdownContentPart } from "../chatMarkdownContentPart.js";
import { AbstractToolConfirmationSubPart } from "./abstractToolConfirmationSubPart.js";
const SHOW_MORE_MESSAGE_HEIGHT_TRIGGER = 100;
let ToolConfirmationSubPart = class extends AbstractToolConfirmationSubPart {
  constructor(toolInvocation, context, renderer, editorPool, currentWidthDelegate, codeBlockStartIndex, instantiationService, keybindingService, languageService, contextKeyService, chatWidgetService, commandService, markerService, languageModelToolsService, chatMarkdownAnchorService, confirmationService, riskAssessmentService) {
    const state = toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation || !state.confirmationMessages?.title) {
      throw new Error("Confirmation messages are missing");
    }
    super(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService);
    this.renderer = renderer;
    this.editorPool = editorPool;
    this.currentWidthDelegate = currentWidthDelegate;
    this.codeBlockStartIndex = codeBlockStartIndex;
    this.languageService = languageService;
    this.commandService = commandService;
    this.markerService = markerService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.confirmationService = confirmationService;
    this.markdownParts = [];
    this.render({
      allowActionId: AcceptToolConfirmationActionId,
      skipActionId: SkipToolConfirmationActionId,
      allowLabel: state.confirmationMessages.confirmResults ? localize("allowReview", "Allow and Review Once") : localize("allow", "Allow Once"),
      skipLabel: localize("skip.detail", "Proceed without running this tool"),
      partType: "chatToolConfirmation",
      subtitle: typeof toolInvocation.originMessage === "string" ? toolInvocation.originMessage : toolInvocation.originMessage?.value
    });
  }
  get codeblocks() {
    return this.markdownParts.flatMap((part) => part.codeblocks);
  }
  additionalPrimaryActions() {
    const actions = super.additionalPrimaryActions();
    const state = this.toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return actions;
    }
    if (state.confirmationMessages?.allowAutoConfirm !== false) {
      const approveCombination = state.confirmationMessages?.approveCombination;
      const combination = approveCombination ? {
        label: typeof approveCombination.label === "string" ? approveCombination.label : approveCombination.label.value,
        key: approveCombination.key,
        arguments: approveCombination.arguments
      } : void 0;
      const confirmActions = this.confirmationService.getPreConfirmActions({
        toolId: this.toolInvocation.toolId,
        source: this.toolInvocation.source,
        parameters: state.parameters,
        chatSessionResource: this.context.element.sessionResource,
        combination
      });
      for (const action of confirmActions) {
        if (action.divider) {
          actions.push(new Separator());
        }
        actions.push({
          label: action.label,
          tooltip: action.detail,
          scope: action.scope,
          data: async () => {
            const shouldConfirm = await action.select();
            if (shouldConfirm) {
              this.confirmWith(this.toolInvocation, { type: ToolConfirmKind.UserAction });
            }
          }
        });
      }
    }
    if (state.confirmationMessages?.confirmResults) {
      actions.unshift(
        {
          label: localize("allowSkip", "Allow and Skip Reviewing Result"),
          data: () => {
            state.confirmationMessages.confirmResults = void 0;
            this.confirmWith(this.toolInvocation, { type: ToolConfirmKind.UserAction });
          }
        },
        new Separator()
      );
    }
    return actions;
  }
  useAllowOnceAsPrimary() {
    const state = this.toolInvocation.state.get();
    if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return !!state.confirmationMessages?.approveCombination;
    }
    return false;
  }
  createContentElement() {
    const state = this.toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return "";
    }
    const { message, disclaimer } = state.confirmationMessages;
    const toolInvocation = this.toolInvocation;
    if (typeof message === "string" && !disclaimer) {
      return message;
    } else {
      const codeBlockRenderOptions = {
        hideToolbar: true,
        reserveWidth: 19,
        verticalPadding: 5,
        editorOptions: {
          tabFocusMode: true,
          ariaLabel: this.getTitle()
        }
      };
      const elements = dom.h("div", [
        dom.h(".message@messageContainer", [
          dom.h(".message-wrapper@message"),
          dom.h(".see-more@showMore", [
            dom.h("a", [localize("showMore", "Show More")])
          ])
        ]),
        dom.h(".editor@editor"),
        dom.h(".disclaimer@disclaimer")
      ]);
      if (toolInvocation.toolSpecificData?.kind === "input" && toolInvocation.toolSpecificData.rawInput && !isEmptyObject(toolInvocation.toolSpecificData.rawInput)) {
        const titleEl = document.createElement("h3");
        titleEl.textContent = localize("chat.input", "Input");
        elements.editor.appendChild(titleEl);
        const inputData = toolInvocation.toolSpecificData;
        const codeBlockRenderOptions2 = {
          hideToolbar: true,
          reserveWidth: 19,
          maxHeightInLines: 13,
          verticalPadding: 5,
          editorOptions: {
            wordWrap: "off",
            readOnly: false,
            ariaLabel: this.getTitle()
          }
        };
        const langId = this.languageService.getLanguageIdByLanguageName("json");
        const rawJsonInput = JSON.stringify(inputData.rawInput ?? {}, null, 1);
        const canSeeMore = count(rawJsonInput, "\n") > 2;
        const initialText = rawJsonInput.replace(/\n */g, " ");
        const key = CodeBlockPart.poolKey(this.context.element.id, this.codeBlockStartIndex);
        const editor = this._register(this.editorPool.get(key));
        editor.object.render({
          codeBlockIndex: this.codeBlockStartIndex,
          element: this.context.element,
          languageId: langId ?? "json",
          text: initialText,
          renderOptions: codeBlockRenderOptions2,
          chatSessionResource: this.context.element.sessionResource
        }, this.currentWidthDelegate());
        const model = editor.object.editor.getModel();
        const markerOwner = generateUuid();
        const schemaUri = createToolSchemaUri(toolInvocation.toolId);
        const validator = new RunOnceScheduler(async () => {
          const newMarker = [];
          const result = await this.commandService.executeCommand("json.validate", schemaUri, model.getValue());
          for (const item of result ?? []) {
            if (item.range && item.message) {
              newMarker.push({
                severity: item.severity === "Error" ? MarkerSeverity.Error : MarkerSeverity.Warning,
                message: item.message,
                startLineNumber: item.range[0].line + 1,
                startColumn: item.range[0].character + 1,
                endLineNumber: item.range[1].line + 1,
                endColumn: item.range[1].character + 1,
                code: item.code ? String(item.code) : void 0
              });
            }
          }
          this.markerService.changeOne(markerOwner, model.uri, newMarker);
        }, 500);
        validator.schedule();
        this._register(model.onDidChangeContent(() => validator.schedule()));
        this._register(toDisposable(() => this.markerService.remove(markerOwner, [model.uri])));
        this._register(validator);
        this.codeblocks.push({
          codeBlockIndex: this.codeBlockStartIndex,
          codemapperUri: void 0,
          elementId: this.context.element.id,
          focus: () => editor.object.focus(),
          ownerMarkdownPartId: this.codeblocksPartId,
          uri: model.uri,
          chatSessionResource: this.context.element.sessionResource
        });
        this._register(model.onDidChangeContent((e) => {
          try {
            inputData.rawInput = JSON.parse(model.getValue());
          } catch {
          }
        }));
        elements.editor.append(editor.object.element);
        if (canSeeMore) {
          const seeMore = dom.h("div.see-more", [dom.h("a@link")]);
          seeMore.link.textContent = localize("seeMore", "See more");
          this._register(dom.addDisposableGenericMouseDownListener(seeMore.link, () => {
            try {
              const parsed = JSON.parse(model.getValue());
              model.setValue(JSON.stringify(parsed, null, 2));
              editor.object.editor.updateOptions({ tabFocusMode: false });
              editor.object.editor.updateOptions({ wordWrap: "on" });
            } catch {
            }
            seeMore.root.remove();
          }));
          elements.editor.append(seeMore.root);
        }
      }
      const mdPart = this._makeMarkdownPart(elements.message, message, codeBlockRenderOptions);
      const messageSeeMoreObserver = this._register(new ElementSizeObserver(mdPart.domNode, void 0));
      const updateSeeMoreDisplayed = () => {
        const show = messageSeeMoreObserver.getHeight() > SHOW_MORE_MESSAGE_HEIGHT_TRIGGER;
        if (elements.messageContainer.classList.contains("can-see-more") !== show) {
          elements.messageContainer.classList.toggle("can-see-more", show);
        }
      };
      this._register(dom.addDisposableListener(elements.showMore, "click", () => {
        elements.messageContainer.classList.toggle("can-see-more", false);
        messageSeeMoreObserver.dispose();
      }));
      this._register(messageSeeMoreObserver.onDidChange(updateSeeMoreDisplayed));
      messageSeeMoreObserver.startObserving();
      if (disclaimer) {
        this._makeMarkdownPart(elements.disclaimer, disclaimer, codeBlockRenderOptions);
      } else {
        elements.disclaimer.remove();
      }
      return elements.root;
    }
  }
  getTitle() {
    const state = this.toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return "";
    }
    const title = state.confirmationMessages?.title;
    if (!title) {
      return "";
    }
    return typeof title === "string" ? title : title.value;
  }
  _makeMarkdownPart(container, message, codeBlockRenderOptions) {
    const part = this._register(this.instantiationService.createInstance(
      ChatMarkdownContentPart,
      {
        kind: "markdownContent",
        content: typeof message === "string" ? new MarkdownString().appendMarkdown(message) : message
      },
      this.context,
      this.editorPool,
      false,
      this.codeBlockStartIndex,
      this.renderer,
      void 0,
      this.currentWidthDelegate(),
      { codeBlockRenderOptions }
    ));
    renderFileWidgets(part.domNode, this.instantiationService, this.chatMarkdownAnchorService, this._store, this.openedEditors.fileWidgetOptions);
    container.append(part.domNode);
    return part;
  }
};
ToolConfirmationSubPart = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IChatWidgetService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, IMarkerService),
  __decorateParam(13, ILanguageModelToolsService),
  __decorateParam(14, IChatMarkdownAnchorService),
  __decorateParam(15, ILanguageModelToolsConfirmationService),
  __decorateParam(16, IChatToolRiskAssessmentService)
], ToolConfirmationSubPart);
export {
  ToolConfirmationSubPart
};
