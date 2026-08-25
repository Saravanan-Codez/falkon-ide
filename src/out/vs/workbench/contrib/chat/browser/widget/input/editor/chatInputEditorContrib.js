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
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { themeColorFromId } from "../../../../../../../base/common/themables.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { MouseTargetType } from "../../../../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../../../../editor/common/core/position.js";
import { Range } from "../../../../../../../editor/common/core/range.js";
import { TrackedRangeStickiness } from "../../../../../../../editor/common/model.js";
import { ILabelService } from "../../../../../../../platform/label/common/label.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { getInputPlaceholderColor, getRangeForPlaceholder } from "./chatInputPlaceholderDecoration.js";
import { IChatAgentService } from "../../../../common/participants/chatAgents.js";
import { localize } from "../../../../../../../nls.js";
import { chatSlashCommandBackground, chatSlashCommandForeground } from "../../../../common/widget/chatColors.js";
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestDynamicVariablePart, ChatRequestSlashCommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, ChatRequestToolSetPart, chatAgentLeader, chatSubcommandLeader } from "../../../../common/requestParser/chatParserTypes.js";
import { agentReg, slashReg, variableReg } from "../../../../common/requestParser/chatRequestParser.js";
import { ChatWidget } from "../../chatWidget.js";
import { dynamicVariableDecorationType } from "../../../attachments/chatDynamicVariables.js";
import { NativeEditContextRegistry } from "../../../../../../../editor/browser/controller/editContext/native/nativeEditContextRegistry.js";
import { TextAreaEditContextRegistry } from "../../../../../../../editor/browser/controller/editContext/textArea/textAreaEditContextRegistry.js";
import { ThrottledDelayer } from "../../../../../../../base/common/async.js";
import { isCancellationError } from "../../../../../../../base/common/errors.js";
import { IEditorService } from "../../../../../../services/editor/common/editorService.js";
import { getChatSessionType } from "../../../../common/model/chatUri.js";
import { ICustomizationHarnessService } from "../../../../common/customizationHarnessService.js";
const decorationDescription = "chat";
const placeholderDecorationType = "chat-session-detail";
const slashCommandTextDecorationType = "chat-session-text";
const clickableSlashPromptTextDecorationType = "chat-session-clickable-text";
const variableTextDecorationType = "chat-variable-text";
function agentAndCommandToKey(agent, subcommand) {
  return subcommand ? `${agent.id}__${subcommand}` : agent.id;
}
function isWhitespaceOrPromptPart(p) {
  return p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestSlashPromptPart;
}
function exactlyOneSpaceAfterPart(parsedRequest, part) {
  const partIdx = parsedRequest.indexOf(part);
  if (parsedRequest.length > partIdx + 2) {
    return false;
  }
  const nextPart = parsedRequest[partIdx + 1];
  return nextPart && nextPart instanceof ChatRequestTextPart && nextPart.text === " ";
}
let InputEditorDecorations = class extends Disposable {
  constructor(widget, codeEditorService, themeService, chatAgentService, labelService, customizationHarnessService, editorService) {
    super();
    this.widget = widget;
    this.codeEditorService = codeEditorService;
    this.themeService = themeService;
    this.chatAgentService = chatAgentService;
    this.labelService = labelService;
    this.customizationHarnessService = customizationHarnessService;
    this.editorService = editorService;
    this.id = "inputEditorDecorations";
    this.previouslyUsedAgents = /* @__PURE__ */ new Set();
    this.viewModelDisposables = this._register(new MutableDisposable());
    this.updateThrottle = this._register(new ThrottledDelayer(InputEditorDecorations.UPDATE_DELAY));
    this.registeredDecorationTypes();
    this.triggerInputEditorDecorationsUpdate();
    this._register(this.widget.inputEditor.onDidChangeModelContent(() => this.triggerInputEditorDecorationsUpdate()));
    this._register(this.widget.inputEditor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.placeholder)) {
        this.triggerInputEditorDecorationsUpdate();
      }
    }));
    this._register(this.widget.onDidChangeParsedInput(() => this.triggerInputEditorDecorationsUpdate()));
    this._register(this.widget.onDidChangeViewModel(() => {
      this.registerViewModelListeners();
      this.previouslyUsedAgents.clear();
      this.triggerInputEditorDecorationsUpdate();
    }));
    this._register(this.widget.onDidSubmitAgent((e) => {
      this.previouslyUsedAgents.add(agentAndCommandToKey(e.agent, e.slashCommand?.name));
    }));
    this._register(this.widget.inputEditor.onMouseDown((e) => {
      this.mouseDownPromptSlashCommand = void 0;
      if (!e.event.leftButton || e.target.type !== MouseTargetType.CONTENT_TEXT || !e.target.position) {
        return;
      }
      const clickablePromptSlashCommand = this.clickablePromptSlashCommand;
      if (!clickablePromptSlashCommand || !clickablePromptSlashCommand.range.containsPosition(e.target.position)) {
        return;
      }
      this.mouseDownPromptSlashCommand = {
        position: Position.lift(e.target.position),
        uri: clickablePromptSlashCommand.uri,
        range: clickablePromptSlashCommand.range
      };
    }));
    this._register(this.widget.inputEditor.onMouseUp((e) => {
      const mouseDownPromptSlashCommand = this.mouseDownPromptSlashCommand;
      this.mouseDownPromptSlashCommand = void 0;
      if (!mouseDownPromptSlashCommand || e.target.type !== MouseTargetType.CONTENT_TEXT || !e.target.position) {
        return;
      }
      if (!mouseDownPromptSlashCommand.range.containsPosition(e.target.position) || !Position.equals(mouseDownPromptSlashCommand.position, e.target.position)) {
        return;
      }
      void this.editorService.openEditor({ resource: mouseDownPromptSlashCommand.uri });
    }));
    this._register(this.chatAgentService.onDidChangeAgents(() => this.triggerInputEditorDecorationsUpdate()));
    this._register(this.customizationHarnessService.onDidChangeSlashCommands((e) => {
      const sessionResource = this.widget.viewModel?.sessionResource;
      if (sessionResource && e.sessionType === getChatSessionType(sessionResource)) {
        this.triggerInputEditorDecorationsUpdate();
      }
    }));
    this._register(autorun((reader) => {
      const currentMode = this.widget.input.currentModeObs.read(reader);
      if (currentMode) {
        currentMode.description.read(reader);
      }
      this.triggerInputEditorDecorationsUpdate();
    }));
    this.registerViewModelListeners();
  }
  static {
    this.UPDATE_DELAY = 200;
  }
  registerViewModelListeners() {
    this.viewModelDisposables.value = this.widget.viewModel?.onDidChange((e) => {
      if (e?.kind === "changePlaceholder" || e?.kind === "initialize") {
        this.triggerInputEditorDecorationsUpdate();
      }
    });
  }
  registeredDecorationTypes() {
    this._register(this.codeEditorService.registerDecorationType(decorationDescription, placeholderDecorationType, {}));
    this._register(this.codeEditorService.registerDecorationType(decorationDescription, slashCommandTextDecorationType, {
      color: themeColorFromId(chatSlashCommandForeground),
      backgroundColor: themeColorFromId(chatSlashCommandBackground),
      borderRadius: "3px"
    }));
    this._register(this.codeEditorService.registerDecorationType(decorationDescription, clickableSlashPromptTextDecorationType, {
      color: themeColorFromId(chatSlashCommandForeground),
      backgroundColor: themeColorFromId(chatSlashCommandBackground),
      borderRadius: "3px",
      cursor: "pointer"
    }));
    this._register(this.codeEditorService.registerDecorationType(decorationDescription, variableTextDecorationType, {
      color: themeColorFromId(chatSlashCommandForeground),
      backgroundColor: themeColorFromId(chatSlashCommandBackground),
      borderRadius: "3px"
    }));
    this._register(this.codeEditorService.registerDecorationType(decorationDescription, dynamicVariableDecorationType, {
      color: themeColorFromId(chatSlashCommandForeground),
      backgroundColor: themeColorFromId(chatSlashCommandBackground),
      borderRadius: "3px",
      rangeBehavior: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    }));
  }
  getPlaceholderColor() {
    return getInputPlaceholderColor(this.themeService);
  }
  triggerInputEditorDecorationsUpdate() {
    this.updateInputPlaceholderDecoration();
    this.updateThrottle.trigger((token) => this.updateAsyncInputEditorDecorations(token)).catch((err) => {
      if (!isCancellationError(err)) {
        throw err;
      }
    });
  }
  updateInputPlaceholderDecoration() {
    const inputValue = this.widget.inputEditor.getValue();
    const viewModel = this.widget.viewModel;
    if (!viewModel) {
      this.updateAriaPlaceholder(void 0);
      if (inputValue) {
        this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, []);
      }
      return;
    }
    if (!inputValue) {
      if (this.widget.inputEditor.getOption(EditorOption.placeholder)) {
        this.updateAriaPlaceholder(void 0);
        this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, []);
        return;
      }
      const mode = this.widget.input.currentModeObs.get();
      const placeholder = mode.argumentHint?.get() ?? mode.description.get() ?? "";
      const displayPlaceholder = viewModel.inputPlaceholder || placeholder;
      const decoration = [
        {
          range: {
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 1,
            endColumn: 1e3
          },
          renderOptions: {
            after: {
              contentText: displayPlaceholder,
              color: this.getPlaceholderColor()
            }
          }
        }
      ];
      this.updateAriaPlaceholder(displayPlaceholder || void 0);
      this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, decoration);
      return;
    }
    this.updateAriaPlaceholder(void 0);
    const parsedRequest = this.widget.parsedInput.parts;
    let placeholderDecoration;
    const agentPart = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
    const agentSubcommandPart = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
    const onlyAgentAndWhitespace = agentPart && parsedRequest.every((p) => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart);
    if (onlyAgentAndWhitespace) {
      const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, void 0));
      const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentPart.agent.metadata.followupPlaceholder;
      if (agentPart.agent.description && exactlyOneSpaceAfterPart(parsedRequest, agentPart)) {
        placeholderDecoration = [{
          range: getRangeForPlaceholder(agentPart.editorRange),
          renderOptions: {
            after: {
              contentText: shouldRenderFollowupPlaceholder ? agentPart.agent.metadata.followupPlaceholder : agentPart.agent.description,
              color: this.getPlaceholderColor()
            }
          }
        }];
      }
    }
    const onlyAgentAndAgentCommandAndWhitespace = agentPart && agentSubcommandPart && parsedRequest.every((p) => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart);
    if (onlyAgentAndAgentCommandAndWhitespace) {
      const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, agentSubcommandPart.command.name));
      const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentSubcommandPart.command.followupPlaceholder;
      if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(parsedRequest, agentSubcommandPart)) {
        placeholderDecoration = [{
          range: getRangeForPlaceholder(agentSubcommandPart.editorRange),
          renderOptions: {
            after: {
              contentText: shouldRenderFollowupPlaceholder ? agentSubcommandPart.command.followupPlaceholder : agentSubcommandPart.command.description,
              color: this.getPlaceholderColor()
            }
          }
        }];
      }
    }
    const onlyAgentCommandAndWhitespace = agentSubcommandPart && parsedRequest.every((p) => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentSubcommandPart);
    if (onlyAgentCommandAndWhitespace) {
      if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(parsedRequest, agentSubcommandPart)) {
        placeholderDecoration = [{
          range: getRangeForPlaceholder(agentSubcommandPart.editorRange),
          renderOptions: {
            after: {
              contentText: agentSubcommandPart.command.description,
              color: this.getPlaceholderColor()
            }
          }
        }];
      }
    }
    this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, placeholderDecoration ?? []);
  }
  async updateAsyncInputEditorDecorations(token) {
    this.clickablePromptSlashCommand = void 0;
    this.widget.inputEditor.setDecorationsByType(decorationDescription, clickableSlashPromptTextDecorationType, []);
    const parsedRequest = this.widget.parsedInput.parts;
    const viewModel = this.widget.viewModel;
    if (!viewModel) {
      return;
    }
    const agentPart = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
    const agentSubcommandPart = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
    const slashCommandPart = parsedRequest.find((p) => p instanceof ChatRequestSlashCommandPart);
    const slashPromptPart = parsedRequest.find((p) => p instanceof ChatRequestSlashPromptPart);
    const promptSlashCommand = slashPromptPart ? await this.customizationHarnessService.resolvePromptSlashCommand(slashPromptPart.name, viewModel.sessionResource, token) : void 0;
    if (token.isCancellationRequested) {
      return;
    }
    if (slashPromptPart && promptSlashCommand) {
      const onlyPromptCommandAndWhitespace = slashPromptPart && parsedRequest.every(isWhitespaceOrPromptPart);
      if (onlyPromptCommandAndWhitespace && exactlyOneSpaceAfterPart(parsedRequest, slashPromptPart) && promptSlashCommand) {
        const description = promptSlashCommand.argumentHint;
        if (description) {
          this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, [{
            range: getRangeForPlaceholder(slashPromptPart.editorRange),
            renderOptions: {
              after: {
                contentText: description,
                color: this.getPlaceholderColor()
              }
            }
          }]);
        }
      }
    }
    const textDecorations = [];
    if (agentPart) {
      textDecorations.push({ range: agentPart.editorRange });
    }
    if (agentSubcommandPart) {
      textDecorations.push({ range: agentSubcommandPart.editorRange, hoverMessage: new MarkdownString(agentSubcommandPart.command.description) });
    }
    if (slashCommandPart) {
      textDecorations.push({ range: slashCommandPart.editorRange, hoverMessage: new MarkdownString(slashCommandPart.slashCommand.detail) });
    }
    if (slashPromptPart && promptSlashCommand) {
      this.clickablePromptSlashCommand = {
        range: Range.lift(slashPromptPart.editorRange),
        uri: promptSlashCommand.uri
      };
      const promptHoverMessage = new MarkdownString();
      if (promptSlashCommand.description) {
        promptHoverMessage.appendText(promptSlashCommand.description);
        promptHoverMessage.appendText("\n");
      }
      promptHoverMessage.appendText(localize(
        "chatInput.promptSlashCommand.open",
        "Click to open {0}",
        this.labelService.getUriLabel(promptSlashCommand.uri, { relative: true })
      ));
      const promptDecoration = {
        range: slashPromptPart.editorRange,
        hoverMessage: promptHoverMessage
      };
      this.widget.inputEditor.setDecorationsByType(decorationDescription, clickableSlashPromptTextDecorationType, [promptDecoration]);
    }
    this.widget.inputEditor.setDecorationsByType(decorationDescription, slashCommandTextDecorationType, textDecorations);
    const varDecorations = [];
    const toolParts = parsedRequest.filter((p) => p instanceof ChatRequestToolPart || p instanceof ChatRequestToolSetPart);
    for (const tool of toolParts) {
      varDecorations.push({ range: tool.editorRange });
    }
    const dynamicVariableParts = parsedRequest.filter((p) => p instanceof ChatRequestDynamicVariablePart);
    const isEditingPreviousRequest = !!viewModel.editing;
    if (isEditingPreviousRequest) {
      for (const variable of dynamicVariableParts) {
        varDecorations.push({ range: variable.editorRange, hoverMessage: URI.isUri(variable.data) ? new MarkdownString(this.labelService.getUriLabel(variable.data, { relative: true })) : void 0 });
      }
    }
    this.widget.inputEditor.setDecorationsByType(decorationDescription, variableTextDecorationType, varDecorations);
  }
  updateAriaPlaceholder(value) {
    const nativeEditContext = NativeEditContextRegistry.get(this.widget.inputEditor.getId());
    if (nativeEditContext) {
      const domNode = nativeEditContext.domNode.domNode;
      if (value && value.trim().length) {
        domNode.setAttribute("aria-placeholder", value);
      } else {
        domNode.removeAttribute("aria-placeholder");
      }
    } else {
      const textAreaEditContext = TextAreaEditContextRegistry.get(this.widget.inputEditor.getId());
      if (textAreaEditContext) {
        const textArea = textAreaEditContext.textArea.domNode;
        if (value && value.trim().length) {
          textArea.setAttribute("aria-placeholder", value);
        } else {
          textArea.removeAttribute("aria-placeholder");
        }
      }
    }
  }
};
InputEditorDecorations = __decorateClass([
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IChatAgentService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ICustomizationHarnessService),
  __decorateParam(6, IEditorService)
], InputEditorDecorations);
class InputEditorSlashCommandMode extends Disposable {
  constructor(widget) {
    super();
    this.widget = widget;
    this.id = "InputEditorSlashCommandMode";
    this._register(this.widget.onDidChangeAgent((e) => {
      if (e.slashCommand && e.slashCommand.isSticky || !e.slashCommand && e.agent.metadata.isSticky) {
        this.repopulateAgentCommand(e.agent, e.slashCommand);
      }
    }));
    this._register(this.widget.onDidSubmitAgent((e) => {
      this.repopulateAgentCommand(e.agent, e.slashCommand);
    }));
  }
  async repopulateAgentCommand(agent, slashCommand) {
    if (this.widget.inputEditor.getValue().trim()) {
      return;
    }
    let value;
    if (slashCommand && slashCommand.isSticky) {
      value = `${chatAgentLeader}${agent.name} ${chatSubcommandLeader}${slashCommand.name} `;
    } else if (agent.metadata.isSticky) {
      value = `${chatAgentLeader}${agent.name} `;
    }
    if (value) {
      this.widget.inputEditor.setValue(value);
      this.widget.inputEditor.setPosition({ lineNumber: 1, column: value.length + 1 });
    }
  }
}
ChatWidget.CONTRIBS.push(InputEditorDecorations, InputEditorSlashCommandMode);
class ChatTokenDeleter extends Disposable {
  constructor(widget) {
    super();
    this.widget = widget;
    this.id = "chatTokenDeleter";
    let prevInsertTokenRange;
    this._register(this.widget.inputEditor.onDidChangeModelContent((e) => {
      let insertedTokenRange;
      if (e.changes.length === 1) {
        const change = e.changes[0];
        if (change.text.length > 0 && change.rangeLength === 1) {
          if (slashReg.test(change.text) || agentReg.test(change.text) || variableReg.test(change.text)) {
            insertedTokenRange = new Range(change.range.startLineNumber, change.range.startColumn, change.range.endLineNumber, change.range.startColumn + change.text.length);
          }
        } else if (change.text.length === 0 && prevInsertTokenRange && change.range.endColumn === prevInsertTokenRange.endColumn) {
          this.widget.inputEditor.executeEdits(this.id, [{
            range: prevInsertTokenRange,
            text: ""
          }]);
          this.widget.refreshParsedInput();
        }
      }
      prevInsertTokenRange = insertedTokenRange;
    }));
  }
}
ChatWidget.CONTRIBS.push(ChatTokenDeleter);
