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
import { $, addDisposableListener, getActiveWindow } from "../../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../../base/browser/formattedTextRenderer.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { ContentWidgetPositionPreference } from "../../../../../editor/browser/editorBrowser.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../../editor/browser/editorExtensions.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ChangeLanguageAction } from "../../../../browser/parts/editor/editorStatus.js";
import { LOG_MODE_ID, OUTPUT_MODE_ID } from "../../../../services/output/common/output.js";
import { SEARCH_RESULT_LANGUAGE_ID } from "../../../../services/search/common/search.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { IChatAgentService } from "../../../chat/common/participants/chatAgents.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
import { IInlineChatSessionService } from "../../../inlineChat/browser/inlineChatSessionService.js";
import { EmptyTextEditorHintContributionId } from "./emptyTextEditorHintTypes.js";
import "./emptyTextEditorHint.css";
const emptyTextEditorHintSetting = "workbench.editor.empty.hint";
let EmptyTextEditorHintContribution = class extends Disposable {
  constructor(editor, configurationService, inlineChatSessionService, chatAgentService, instantiationService) {
    super();
    this.editor = editor;
    this.configurationService = configurationService;
    this.inlineChatSessionService = inlineChatSessionService;
    this.chatAgentService = chatAgentService;
    this.instantiationService = instantiationService;
    this._register(this.editor.onDidChangeModel(() => this.update()));
    this._register(this.editor.onDidChangeModelLanguage(() => this.update()));
    this._register(this.editor.onDidChangeModelContent(() => this.update()));
    this._register(this.chatAgentService.onDidChangeAgents(() => this.update()));
    this._register(this.editor.onDidChangeModelDecorations(() => this.update()));
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.readOnly)) {
        this.update();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(emptyTextEditorHintSetting)) {
        this.update();
      }
    }));
    this._register(inlineChatSessionService.onWillStartSession((editor2) => {
      if (this.editor === editor2) {
        this.disposeHint();
      }
    }));
    this._register(inlineChatSessionService.onDidChangeSessions(() => {
      this.update();
    }));
  }
  static {
    this.ID = EmptyTextEditorHintContributionId;
  }
  shouldRenderHint() {
    const configValue = this.configurationService.getValue(emptyTextEditorHintSetting);
    if (configValue === "hidden") {
      return false;
    }
    if (this.editor.getOption(EditorOption.readOnly)) {
      return false;
    }
    const model = this.editor.getModel();
    const languageId = model?.getLanguageId();
    if (!model || languageId === OUTPUT_MODE_ID || languageId === LOG_MODE_ID || languageId === SEARCH_RESULT_LANGUAGE_ID) {
      return false;
    }
    if (this.inlineChatSessionService.getSessionByTextModel(model.uri)) {
      return false;
    }
    if (this.editor.getModel()?.getValueLength()) {
      return false;
    }
    const hasConflictingDecorations = Boolean(this.editor.getLineDecorations(1)?.find(
      (d) => d.options.beforeContentClassName || d.options.afterContentClassName || d.options.before?.content || d.options.after?.content
    ));
    if (hasConflictingDecorations) {
      return false;
    }
    const hasEditorAgents = Boolean(this.chatAgentService.getDefaultAgent(ChatAgentLocation.EditorInline));
    const shouldRenderDefaultHint = model?.uri.scheme === Schemas.untitled && languageId === PLAINTEXT_LANGUAGE_ID;
    return hasEditorAgents || shouldRenderDefaultHint;
  }
  update() {
    const shouldRenderHint = this.shouldRenderHint();
    if (shouldRenderHint && !this.textHintContentWidget) {
      this.textHintContentWidget = this.instantiationService.createInstance(EmptyTextEditorHintContentWidget, this.editor);
    } else if (!shouldRenderHint && this.textHintContentWidget) {
      this.disposeHint();
    }
  }
  disposeHint() {
    this.textHintContentWidget?.dispose();
    this.textHintContentWidget = void 0;
  }
  dispose() {
    super.dispose();
    this.disposeHint();
  }
};
EmptyTextEditorHintContribution = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInlineChatSessionService),
  __decorateParam(3, IChatAgentService),
  __decorateParam(4, IInstantiationService)
], EmptyTextEditorHintContribution);
let EmptyTextEditorHintContentWidget = class extends Disposable {
  constructor(editor, commandService, configurationService, keybindingService, chatAgentService, telemetryService, contextMenuService) {
    super();
    this.editor = editor;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.chatAgentService = chatAgentService;
    this.telemetryService = telemetryService;
    this.contextMenuService = contextMenuService;
    this.isVisible = false;
    this.ariaLabel = "";
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (this.domNode && e.hasChanged(EditorOption.fontInfo)) {
        this.editor.applyFontInfo(this.domNode);
      }
    }));
    const onDidFocusEditorText = Event.debounce(this.editor.onDidFocusEditorText, () => void 0, 500);
    this._register(onDidFocusEditorText(() => {
      if (this.editor.hasTextFocus() && this.isVisible && this.ariaLabel && this.configurationService.getValue(AccessibilityVerbositySettingId.EmptyEditorHint)) {
        status(this.ariaLabel);
      }
    }));
    this.editor.addContentWidget(this);
  }
  static {
    this.ID = "editor.widget.emptyHint";
  }
  getId() {
    return EmptyTextEditorHintContentWidget.ID;
  }
  disableHint(e) {
    const disableHint = () => {
      this.configurationService.updateValue(emptyTextEditorHintSetting, "hidden");
      this.dispose();
      this.editor.focus();
    };
    if (!e) {
      disableHint();
      return;
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => {
        return new StandardMouseEvent(getActiveWindow(), e);
      },
      getActions: () => {
        return [
          {
            id: "workench.action.disableEmptyEditorHint",
            label: localize("disableEditorEmptyHint", "Disable Empty Editor Hint"),
            tooltip: localize("disableEditorEmptyHint", "Disable Empty Editor Hint"),
            enabled: true,
            class: void 0,
            run: () => {
              disableHint();
            }
          }
        ];
      }
    });
  }
  getHint() {
    const hasInlineChatProvider = this.chatAgentService.getActivatedAgents().filter((candidate) => candidate.locations.includes(ChatAgentLocation.EditorInline)).length > 0;
    const hintHandler = {
      disposables: this._store,
      callback: (index, event) => {
        switch (index) {
          case "0":
            hasInlineChatProvider ? askSomething(event.browserEvent) : languageOnClickOrTap(event.browserEvent);
            break;
          case "1":
            hasInlineChatProvider ? languageOnClickOrTap(event.browserEvent) : this.disableHint();
            break;
          case "2":
            this.disableHint();
            break;
        }
      }
    };
    const askSomethingCommandId = "inlineChat.start";
    const askSomething = async (e) => {
      e.stopPropagation();
      this.telemetryService.publicLog2("workbenchActionExecuted", {
        id: askSomethingCommandId,
        from: "hint"
      });
      await this.commandService.executeCommand(askSomethingCommandId, { from: "hint" });
    };
    const languageOnClickOrTap = async (e) => {
      e.stopPropagation();
      this.editor.focus();
      this.telemetryService.publicLog2("workbenchActionExecuted", {
        id: ChangeLanguageAction.ID,
        from: "hint"
      });
      await this.commandService.executeCommand(ChangeLanguageAction.ID);
      this.editor.focus();
    };
    const keybindingsLookup = [askSomethingCommandId, ChangeLanguageAction.ID];
    const keybindingLabels = keybindingsLookup.map((id) => this.keybindingService.lookupKeybinding(id)?.getLabel());
    const hintMsg = (hasInlineChatProvider ? localize({
      key: "emptyTextEditorHintWithInlineChat",
      comment: [
        "Preserve double-square brackets and their order",
        "language refers to a programming language"
      ]
    }, "[[Generate code]] ({0}), or [[select a language]] ({1}). Start typing to dismiss or [[don't show]] this again.", keybindingLabels.at(0) ?? "", keybindingLabels.at(1) ?? "") : localize({
      key: "emptyTextEditorHintWithoutInlineChat",
      comment: [
        "Preserve double-square brackets and their order",
        "language refers to a programming language"
      ]
    }, "[[Select a language]] ({0}) to get started. Start typing to dismiss or [[don't show]] this again.", keybindingLabels.at(1) ?? "")).replaceAll(" ()", "");
    const hintElement = renderFormattedText(hintMsg, {
      actionHandler: hintHandler,
      renderCodeSegments: false
    });
    hintElement.style.fontStyle = "italic";
    const ariaLabel = hasInlineChatProvider ? localize("defaultHintAriaLabelWithInlineChat", "Execute {0} to ask a question, execute {1} to select a language and get started. Start typing to dismiss.", ...keybindingLabels) : localize("defaultHintAriaLabelWithoutInlineChat", "Execute {0} to select a language and get started. Start typing to dismiss.", ...keybindingLabels);
    for (const anchor of hintElement.querySelectorAll("a")) {
      anchor.style.cursor = "pointer";
    }
    return { hintElement, ariaLabel };
  }
  getDomNode() {
    if (!this.domNode) {
      this.domNode = $(".empty-editor-hint");
      this.domNode.style.width = "max-content";
      this.domNode.style.paddingLeft = "4px";
      const { hintElement, ariaLabel } = this.getHint();
      this.domNode.append(hintElement);
      this.ariaLabel = ariaLabel.concat(localize("disableHint", " Toggle {0} in settings to disable this hint.", AccessibilityVerbositySettingId.EmptyEditorHint));
      this._register(addDisposableListener(this.domNode, "click", () => {
        this.editor.focus();
      }));
      this.editor.applyFontInfo(this.domNode);
      const lineHeight = this.editor.getLineHeightForPosition(new Position(1, 1));
      this.domNode.style.lineHeight = lineHeight + "px";
    }
    return this.domNode;
  }
  getPosition() {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  dispose() {
    super.dispose();
    this.editor.removeContentWidget(this);
  }
};
EmptyTextEditorHintContentWidget = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IChatAgentService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IContextMenuService)
], EmptyTextEditorHintContentWidget);
registerEditorContribution(EmptyTextEditorHintContribution.ID, EmptyTextEditorHintContribution, EditorContributionInstantiation.Eager);
export {
  EmptyTextEditorHintContribution,
  emptyTextEditorHintSetting
};
