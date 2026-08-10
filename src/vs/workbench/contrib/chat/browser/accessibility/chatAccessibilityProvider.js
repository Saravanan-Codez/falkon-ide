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
import { marked } from "../../../../../base/common/marked/marked.js";
import { isDefined } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { migrateLegacyTerminalToolSpecificData } from "../../common/chat.js";
import { getExplicitFileOrImageAttachmentSummary } from "../../common/attachments/chatVariableEntries.js";
import { IChatToolInvocation } from "../../common/chatService/chatService.js";
import { isRequestVM, isResponseVM } from "../../common/model/chatViewModel.js";
import { isToolResultInputOutputDetails, isToolResultOutputDetails, toolContentToA11yString } from "../../common/tools/languageModelToolsService.js";
import { CancelChatActionId } from "../actions/chatExecuteActions.js";
import { AcceptToolConfirmationActionId } from "../actions/chatToolActions.js";
const getToolConfirmationAlert = (accessor, toolInvocation) => {
  const keybindingService = accessor.get(IKeybindingService);
  const contextKeyService = accessor.get(IContextKeyService);
  const acceptKb = keybindingService.lookupKeybinding(AcceptToolConfirmationActionId, contextKeyService)?.getAriaLabel();
  const cancelKb = keybindingService.lookupKeybinding(CancelChatActionId, contextKeyService)?.getAriaLabel();
  const authenticationServers = toolInvocation.map((invocation) => invocation.state.get()).filter((state) => state.type === IChatToolInvocation.StateKind.WaitingForAuthentication).map((state) => state.server.name);
  const text = toolInvocation.map((v) => {
    const state = v.state.get();
    if (state.type === IChatToolInvocation.StateKind.WaitingForAuthentication) {
      return;
    }
    if (state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
      const detail = isToolResultInputOutputDetails(state.resultDetails) ? state.resultDetails.input : isToolResultOutputDetails(state.resultDetails) ? void 0 : toolContentToA11yString(state.contentForModel);
      return {
        title: localize("toolPostApprovalTitle", "Approve results of tool"),
        detail
      };
    }
    if (!(state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && state.confirmationMessages?.message)) {
      return;
    }
    let input = "";
    if (v.toolSpecificData) {
      if (v.toolSpecificData.kind === "terminal") {
        const terminalData = migrateLegacyTerminalToolSpecificData(v.toolSpecificData);
        input = terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
      } else if (v.toolSpecificData.kind === "extensions") {
        input = JSON.stringify(v.toolSpecificData.extensions);
      } else if (v.toolSpecificData.kind === "input") {
        input = JSON.stringify(v.toolSpecificData.rawInput);
      } else if (v.toolSpecificData.kind === "modifiedFilesConfirmation") {
        input = localize("modifiedFilesConfirmationInput", "{0} files", v.toolSpecificData.modifiedFiles.length);
      }
    }
    const titleObj = state.confirmationMessages?.title;
    const title = typeof titleObj === "string" ? titleObj : titleObj?.value || "";
    return {
      title: (title + (input ? ": " + input : "")).trim(),
      detail: void 0
    };
  }).filter(isDefined);
  const messages = [];
  if (text.length > 0) {
    messages.push(acceptKb && cancelKb ? localize("toolInvocationsHintKb", "Chat confirmation required: {0}. Press {1} to accept or {2} to cancel.", text.map((t) => t.title).join(", "), acceptKb, cancelKb) : localize("toolInvocationsHint", "Chat confirmation required: {0}", text.map((t) => t.title).join(", ")));
  }
  if (text.some((t) => t.detail)) {
    messages.push(localize("toolInvocationsHintDetails", "Details: {0}", text.map((t) => t.detail ? t.detail : "").join(" ")));
  }
  if (authenticationServers.length > 0) {
    messages.push(localize("toolAuthenticationHint", "MCP authentication required for {0}. Use the Authenticate button in the tool call.", authenticationServers.join(", ")));
  }
  return messages.join(" ");
};
let ChatAccessibilityProvider = class {
  constructor(_accessibleViewService, _instantiationService) {
    this._accessibleViewService = _accessibleViewService;
    this._instantiationService = _instantiationService;
  }
  getWidgetRole() {
    return "list";
  }
  getRole(element) {
    return "listitem";
  }
  getWidgetAriaLabel() {
    return localize("chat", "Chat");
  }
  getAriaLabel(element) {
    if (isRequestVM(element)) {
      return element.messageText.trim() || getExplicitFileOrImageAttachmentSummary(element.variables) || "";
    }
    if (isResponseVM(element)) {
      return this._getLabelWithInfo(element);
    }
    return "";
  }
  _getLabelWithInfo(element) {
    const accessibleViewHint = this._accessibleViewService.getOpenAriaHint(AccessibilityVerbositySettingId.Chat);
    let label = "";
    const toolInvocation = element.response.value.filter((v) => v.kind === "toolInvocation");
    let toolInvocationHint = "";
    if (toolInvocation.length) {
      const waitingForConfirmation = toolInvocation.filter((v) => {
        const state = v.state.get().type;
        return state === IChatToolInvocation.StateKind.WaitingForConfirmation || state === IChatToolInvocation.StateKind.WaitingForPostApproval || state === IChatToolInvocation.StateKind.WaitingForAuthentication;
      });
      if (waitingForConfirmation.length) {
        toolInvocationHint = this._instantiationService.invokeFunction(getToolConfirmationAlert, toolInvocation);
      }
    }
    const tableCount = marked.lexer(element.response.toString()).filter((token) => token.type === "table")?.length ?? 0;
    let tableCountHint = "";
    switch (tableCount) {
      case 0:
        break;
      case 1:
        tableCountHint = localize("singleTableHint", "1 table ");
        break;
      default:
        tableCountHint = localize("multiTableHint", "{0} tables ", tableCount);
        break;
    }
    const fileTreeCount = element.response.value.filter((v) => v.kind === "treeData").length ?? 0;
    let fileTreeCountHint = "";
    switch (fileTreeCount) {
      case 0:
        break;
      case 1:
        fileTreeCountHint = localize("singleFileTreeHint", "1 file tree ");
        break;
      default:
        fileTreeCountHint = localize("multiFileTreeHint", "{0} file trees ", fileTreeCount);
        break;
    }
    const elicitationCount = element.response.value.filter((v) => v.kind === "elicitation2" || v.kind === "elicitationSerialized");
    let elicitationHint = "";
    for (const elicitation of elicitationCount) {
      const title = typeof elicitation.title === "string" ? elicitation.title : elicitation.title.value;
      const message = typeof elicitation.message === "string" ? elicitation.message : elicitation.message.value;
      elicitationHint += title + " " + message;
    }
    const codeBlockCount = marked.lexer(element.response.toString()).filter((token) => token.type === "code")?.length ?? 0;
    switch (codeBlockCount) {
      case 0:
        label = accessibleViewHint ? localize("noCodeBlocksHint", "{0}{1}{2}{3}{4} {5}", toolInvocationHint, fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString(), accessibleViewHint) : localize("noCodeBlocks", "{0}{1}{2} {3}", fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString());
        break;
      case 1:
        label = accessibleViewHint ? localize("singleCodeBlockHint", "{0}{1}{2}1 code block: {3} {4}{5}", toolInvocationHint, fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString(), accessibleViewHint) : localize("singleCodeBlock", "{0}{1}1 code block: {2} {3}", fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString());
        break;
      default:
        label = accessibleViewHint ? localize("multiCodeBlockHint", "{0}{1}{2}{3} code blocks: {4}{5} {6}", toolInvocationHint, fileTreeCountHint, elicitationHint, tableCountHint, codeBlockCount, element.response.toString(), accessibleViewHint) : localize("multiCodeBlock", "{0}{1}{2} code blocks: {3} {4}", fileTreeCountHint, elicitationHint, codeBlockCount, tableCountHint, element.response.toString());
        break;
    }
    return label;
  }
};
ChatAccessibilityProvider = __decorateClass([
  __decorateParam(0, IAccessibleViewService),
  __decorateParam(1, IInstantiationService)
], ChatAccessibilityProvider);
export {
  ChatAccessibilityProvider,
  getToolConfirmationAlert
};
