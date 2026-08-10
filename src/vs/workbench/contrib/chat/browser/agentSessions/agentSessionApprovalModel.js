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
import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { Disposable, DisposableResourceMap } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunIterableDelta, observableValue } from "../../../../../base/common/observable.js";
import { migrateLegacyTerminalToolSpecificData } from "../../common/chat.js";
import { IChatService, IChatToolInvocation, ToolConfirmKind } from "../../common/chatService/chatService.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
var AgentSessionApprovalKind = /* @__PURE__ */ ((AgentSessionApprovalKind2) => {
  AgentSessionApprovalKind2["Terminal"] = "terminal";
  AgentSessionApprovalKind2["Question"] = "question";
  AgentSessionApprovalKind2["Other"] = "other";
  return AgentSessionApprovalKind2;
})(AgentSessionApprovalKind || {});
function agentSessionApprovalId(info) {
  return info.approvalId;
}
let AgentSessionApprovalModel = class extends Disposable {
  constructor(_chatService, _languageService) {
    super();
    this._chatService = _chatService;
    this._languageService = _languageService;
    this._approvals = /* @__PURE__ */ new Map();
    this._modelTrackers = this._register(new DisposableResourceMap());
    this._register(autorunIterableDelta(
      (reader) => this._chatService.chatModels.read(reader),
      ({ addedValues, removedValues }) => {
        for (const model of addedValues) {
          this._modelTrackers.set(model.sessionResource, this._trackModel(model));
        }
        for (const model of removedValues) {
          this._modelTrackers.deleteAndDispose(model.sessionResource);
          this._approvals.get(model.sessionResource.toString())?.set(void 0, void 0);
        }
      }
    ));
  }
  getApproval(sessionResource) {
    return this._getOrCreateApproval(sessionResource.toString());
  }
  _getOrCreateApproval(key) {
    let obs = this._approvals.get(key);
    if (!obs) {
      obs = observableValue(`sessionApproval.${key}`, void 0);
      this._approvals.set(key, obs);
    }
    return obs;
  }
  _trackModel(model) {
    const settable = this._getOrCreateApproval(model.sessionResource.toString());
    const setIfChanged = (value) => {
      const current = settable.get();
      if (current === value) {
        return;
      }
      if (current !== void 0 && value !== void 0 && current.approvalId === value.approvalId && current.kind === value.kind && current.label === value.label && current.languageId === value.languageId) {
        return;
      }
      settable.set(value, void 0);
    };
    return autorun((reader) => {
      const needsInput = model.requestNeedsInput.read(reader);
      if (!needsInput) {
        setIfChanged(void 0);
        return;
      }
      const lastResponse = model.lastRequest?.response;
      if (!lastResponse?.response?.value) {
        setIfChanged(void 0);
        return;
      }
      for (const part of lastResponse.response.value) {
        if (part.kind !== "toolInvocation" || part.toolSpecificData?.kind === "modifiedFilesConfirmation") {
          continue;
        }
        const state = part.state.read(reader);
        if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
          let label;
          let languageId;
          let kind;
          if (part.toolSpecificData?.kind === "terminal") {
            const terminalData = migrateLegacyTerminalToolSpecificData(part.toolSpecificData);
            label = terminalData.presentationOverrides?.commandLine ?? terminalData.commandLine.forDisplay ?? terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
            languageId = this._languageService.getLanguageIdByLanguageName(terminalData.presentationOverrides?.language ?? terminalData.language) ?? void 0;
            kind = "terminal" /* Terminal */;
          } else if (needsInput.detail) {
            label = needsInput.detail;
            kind = "question" /* Question */;
          } else {
            const msg = part.invocationMessage;
            label = typeof msg === "string" ? msg : renderAsPlaintext(msg);
            kind = "other" /* Other */;
          }
          const confirmState = state;
          setIfChanged({
            approvalId: part.toolCallId,
            kind,
            label,
            languageId,
            since: /* @__PURE__ */ new Date(),
            confirm: () => confirmState.confirm({ type: ToolConfirmKind.UserAction })
          });
          return;
        }
      }
      setIfChanged(void 0);
    });
  }
};
AgentSessionApprovalModel = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, ILanguageService)
], AgentSessionApprovalModel);
export {
  AgentSessionApprovalKind,
  AgentSessionApprovalModel,
  agentSessionApprovalId
};
