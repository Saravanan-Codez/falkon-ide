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
import { EditSuggestionId } from "../../../../../../editor/common/textModelEditSource.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { escapeModelIdForTelemetry } from "../../../../../../platform/telemetry/common/telemetry.js";
import { DataChannelForwardingTelemetryService, forwardToChannelIf, isCopilotLikeExtension } from "../../../../../../platform/dataChannel/browser/forwardingTelemetryService.js";
import { IRandomService } from "../../randomService.js";
let AiEditTelemetryServiceImpl = class {
  constructor(instantiationService, _randomService) {
    this.instantiationService = instantiationService;
    this._randomService = _randomService;
    this._telemetryService = this.instantiationService.createInstance(DataChannelForwardingTelemetryService);
  }
  createSuggestionId(data) {
    const suggestionId = EditSuggestionId.newId((ns) => this._randomService.generatePrefixedUuid(ns));
    this._telemetryService.publicLog2("editTelemetry.codeSuggested", {
      eventId: this._randomService.generatePrefixedUuid("evt"),
      suggestionId,
      presentation: data.presentation,
      feature: data.feature,
      sourceExtensionId: data.source?.extensionId,
      sourceExtensionVersion: data.source?.extensionVersion,
      sourceProviderId: data.source?.providerId,
      languageId: data.languageId,
      editCharsInserted: data.editDeltaInfo?.charsAdded,
      editCharsDeleted: data.editDeltaInfo?.charsRemoved,
      editLinesInserted: data.editDeltaInfo?.linesAdded,
      editLinesDeleted: data.editDeltaInfo?.linesRemoved,
      modeId: data.modeId,
      modelId: escapeModelIdForTelemetry(data.modelId),
      applyCodeBlockSuggestionId: data.applyCodeBlockSuggestionId,
      sourceRequestId: data.sourceRequestId,
      ...forwardToChannelIf(isCopilotLikeExtension(data.source?.extensionId))
    });
    return suggestionId;
  }
  handleCodeAccepted(data) {
    this._telemetryService.publicLog2("editTelemetry.codeAccepted", {
      eventId: this._randomService.generatePrefixedUuid("evt"),
      suggestionId: data.suggestionId,
      presentation: data.presentation,
      feature: data.feature,
      sourceExtensionId: data.source?.extensionId,
      sourceExtensionVersion: data.source?.extensionVersion,
      sourceProviderId: data.source?.providerId,
      languageId: data.languageId,
      editCharsInserted: data.editDeltaInfo?.charsAdded,
      editCharsDeleted: data.editDeltaInfo?.charsRemoved,
      editLinesInserted: data.editDeltaInfo?.linesAdded,
      editLinesDeleted: data.editDeltaInfo?.linesRemoved,
      modeId: data.modeId,
      modelId: escapeModelIdForTelemetry(data.modelId),
      applyCodeBlockSuggestionId: data.applyCodeBlockSuggestionId,
      sourceRequestId: data.sourceRequestId,
      acceptanceMethod: data.acceptanceMethod,
      ...forwardToChannelIf(isCopilotLikeExtension(data.source?.extensionId))
    });
  }
  handleCodeRejected(data) {
    this._telemetryService.publicLog2("editTelemetry.codeRejected", {
      eventId: this._randomService.generatePrefixedUuid("evt"),
      suggestionId: data.suggestionId,
      presentation: data.presentation,
      feature: data.feature,
      sourceExtensionId: data.source?.extensionId,
      sourceExtensionVersion: data.source?.extensionVersion,
      sourceProviderId: data.source?.providerId,
      languageId: data.languageId,
      editCharsInserted: data.editDeltaInfo?.charsAdded,
      editCharsDeleted: data.editDeltaInfo?.charsRemoved,
      editLinesInserted: data.editDeltaInfo?.linesAdded,
      editLinesDeleted: data.editDeltaInfo?.linesRemoved,
      modeId: data.modeId,
      modelId: escapeModelIdForTelemetry(data.modelId),
      applyCodeBlockSuggestionId: data.applyCodeBlockSuggestionId,
      sourceRequestId: data.sourceRequestId,
      rejectionMethod: data.rejectionMethod,
      ...forwardToChannelIf(isCopilotLikeExtension(data.source?.extensionId))
    });
  }
};
AiEditTelemetryServiceImpl = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IRandomService)
], AiEditTelemetryServiceImpl);
export {
  AiEditTelemetryServiceImpl
};
