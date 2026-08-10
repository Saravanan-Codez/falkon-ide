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
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { runOnChange } from "../../../../../base/common/observable.js";
import { AnnotatedStringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { EditDeltaInfo } from "../../../../../editor/common/textModelEditSource.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { createDocWithJustReason } from "../helpers/documentWithAnnotatedEdits.js";
import { IAiEditTelemetryService } from "./aiEditTelemetry/aiEditTelemetryService.js";
import { forwardToChannelIf, isCopilotLikeExtension } from "../../../../../platform/dataChannel/browser/forwardingTelemetryService.js";
import { ProviderId } from "../../../../../editor/common/languages.js";
import { ArcTelemetryReporter } from "./arcTelemetryReporter.js";
import { IRandomService } from "../randomService.js";
let EditTelemetryReportInlineEditArcSender = class extends Disposable {
  constructor(docWithAnnotatedEdits, scmRepoBridge, _instantiationService) {
    super();
    this._instantiationService = _instantiationService;
    this._register(runOnChange(docWithAnnotatedEdits.value, (_val, _prev, changes) => {
      const edit = AnnotatedStringEdit.compose(changes.map((c) => c.edit));
      if (!edit.replacements.some((r) => r.data.editSource.metadata.source === "inlineCompletionAccept")) {
        return;
      }
      if (!edit.replacements.every((r) => r.data.editSource.metadata.source === "inlineCompletionAccept")) {
        onUnexpectedError(new Error("ArcTelemetrySender: Not all edits are inline completion accept edits!"));
        return;
      }
      if (edit.replacements[0].data.editSource.metadata.source !== "inlineCompletionAccept") {
        return;
      }
      const data = edit.replacements[0].data.editSource.metadata;
      const docWithJustReason = createDocWithJustReason(docWithAnnotatedEdits, this._store);
      const reporter = this._store.add(this._instantiationService.createInstance(ArcTelemetryReporter, [0, 30, 120, 300, 600, 900].map((s) => s * 1e3), _prev, docWithJustReason, scmRepoBridge, edit, (res) => {
        res.telemetryService.publicLog2("editTelemetry.reportInlineEditArc", {
          extensionId: data.$extensionId ?? "",
          extensionVersion: data.$extensionVersion ?? "",
          opportunityId: data.$$requestUuid ?? "unknown",
          languageId: data.$$languageId,
          correlationId: data.$$correlationId,
          didBranchChange: res.didBranchChange ? 1 : 0,
          timeDelayMs: res.timeDelayMs,
          originalCharCount: res.originalCharCount,
          originalLineCount: res.originalLineCount,
          originalDeletedLineCount: res.originalDeletedLineCount,
          arc: res.arc,
          currentLineCount: res.currentLineCount,
          currentDeletedLineCount: res.currentDeletedLineCount,
          ...forwardToChannelIf(isCopilotLikeExtension(data.$extensionId))
        });
      }, () => {
        this._store.delete(reporter);
      }));
    }));
  }
};
EditTelemetryReportInlineEditArcSender = __decorateClass([
  __decorateParam(2, IInstantiationService)
], EditTelemetryReportInlineEditArcSender);
let CreateSuggestionIdForChatOrInlineChatCaller = class extends Disposable {
  constructor(docWithAnnotatedEdits, _aiEditTelemetryService) {
    super();
    this._aiEditTelemetryService = _aiEditTelemetryService;
    this._register(runOnChange(docWithAnnotatedEdits.value, (_val, _prev, changes) => {
      const edit = AnnotatedStringEdit.compose(changes.map((c) => c.edit));
      const supportedSource = /* @__PURE__ */ new Set(["Chat.applyEdits", "inlineChat.applyEdits"]);
      if (!edit.replacements.some((r) => supportedSource.has(r.data.editSource.metadata.source))) {
        return;
      }
      if (!edit.replacements.every((r) => supportedSource.has(r.data.editSource.metadata.source))) {
        onUnexpectedError(new Error(`ArcTelemetrySender: Not all edits are ${edit.replacements[0].data.editSource.metadata.source}!`));
        return;
      }
      let applyCodeBlockSuggestionId = void 0;
      const data = edit.replacements[0].data.editSource;
      let feature;
      if (data.metadata.source === "Chat.applyEdits") {
        feature = "sideBarChat";
        if (data.metadata.$$mode === "applyCodeBlock") {
          applyCodeBlockSuggestionId = data.metadata.$$codeBlockSuggestionId;
        }
      } else {
        feature = "inlineChat";
      }
      const providerId = new ProviderId(data.props.$extensionId, data.props.$extensionVersion, data.props.$providerId);
      this._aiEditTelemetryService.createSuggestionId({
        applyCodeBlockSuggestionId,
        languageId: data.props.$$languageId,
        presentation: "highlightedEdit",
        feature,
        source: providerId,
        modelId: data.props.$modelId,
        // eslint-disable-next-line local/code-no-any-casts
        modeId: data.props.$$mode,
        editDeltaInfo: EditDeltaInfo.fromEdit(edit, _prev),
        sourceRequestId: void 0
      });
    }));
  }
};
CreateSuggestionIdForChatOrInlineChatCaller = __decorateClass([
  __decorateParam(1, IAiEditTelemetryService)
], CreateSuggestionIdForChatOrInlineChatCaller);
let EditTelemetryReportEditArcForChatOrInlineChatSender = class extends Disposable {
  constructor(docWithAnnotatedEdits, scmRepoBridge, _instantiationService, _randomService) {
    super();
    this._instantiationService = _instantiationService;
    this._randomService = _randomService;
    this._register(runOnChange(docWithAnnotatedEdits.value, (_val, _prev, changes) => {
      const edit = AnnotatedStringEdit.compose(changes.map((c) => c.edit));
      const supportedSource = /* @__PURE__ */ new Set(["Chat.applyEdits", "inlineChat.applyEdits"]);
      if (!edit.replacements.some((r) => supportedSource.has(r.data.editSource.metadata.source))) {
        return;
      }
      if (!edit.replacements.every((r) => supportedSource.has(r.data.editSource.metadata.source))) {
        onUnexpectedError(new Error(`ArcTelemetrySender: Not all edits are ${edit.replacements[0].data.editSource.metadata.source}!`));
        return;
      }
      const data = edit.replacements[0].data.editSource;
      const uniqueEditId = this._randomService.generateUuid();
      const docWithJustReason = createDocWithJustReason(docWithAnnotatedEdits, this._store);
      const reporter = this._store.add(this._instantiationService.createInstance(ArcTelemetryReporter, [0, 60, 300].map((s) => s * 1e3), _prev, docWithJustReason, scmRepoBridge, edit, (res) => {
        res.telemetryService.publicLog2("editTelemetry.reportEditArc", {
          sourceKeyCleaned: data.toKey(Number.MAX_SAFE_INTEGER, {
            $extensionId: false,
            $extensionVersion: false,
            $$requestUuid: false,
            $$sessionId: false,
            $$requestId: false,
            $$languageId: false,
            $modelId: false
          }),
          extensionId: data.props.$extensionId,
          extensionVersion: data.props.$extensionVersion,
          opportunityId: data.props.$$requestUuid,
          editSessionId: data.props.$$sessionId,
          requestId: data.props.$$requestId,
          modelId: data.props.$modelId,
          languageId: data.props.$$languageId,
          mode: data.props.$$mode,
          uniqueEditId,
          provider: void 0,
          agentSessionId: void 0,
          isSubagentSession: void 0,
          didBranchChange: res.didBranchChange ? 1 : 0,
          timeDelayMs: res.timeDelayMs,
          originalCharCount: res.originalCharCount,
          originalLineCount: res.originalLineCount,
          originalDeletedLineCount: res.originalDeletedLineCount,
          arc: res.arc,
          currentLineCount: res.currentLineCount,
          currentDeletedLineCount: res.currentDeletedLineCount,
          ...forwardToChannelIf(isCopilotLikeExtension(data.props.$extensionId))
        });
      }, () => {
        this._store.delete(reporter);
      }));
    }));
  }
};
EditTelemetryReportEditArcForChatOrInlineChatSender = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IRandomService)
], EditTelemetryReportEditArcForChatOrInlineChatSender);
export {
  CreateSuggestionIdForChatOrInlineChatCaller,
  EditTelemetryReportEditArcForChatOrInlineChatSender,
  EditTelemetryReportInlineEditArcSender
};
