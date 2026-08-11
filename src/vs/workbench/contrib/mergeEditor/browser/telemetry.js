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
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
let MergeEditorTelemetry = class {
  constructor(telemetryService) {
    this.telemetryService = telemetryService;
  }
  reportMergeEditorOpened(args) {
    this.telemetryService.publicLog2("mergeEditor.opened", {
      conflictCount: args.conflictCount,
      combinableConflictCount: args.combinableConflictCount,
      baseVisible: args.baseVisible,
      isColumnView: args.isColumnView,
      baseTop: args.baseTop
    });
  }
  reportLayoutChange(args) {
    this.telemetryService.publicLog2("mergeEditor.layoutChanged", {
      baseVisible: args.baseVisible,
      isColumnView: args.isColumnView,
      baseTop: args.baseTop
    });
  }
  reportMergeEditorClosed(args) {
    this.telemetryService.publicLog2("mergeEditor.closed", {
      conflictCount: args.conflictCount,
      combinableConflictCount: args.combinableConflictCount,
      durationOpenedSecs: args.durationOpenedSecs,
      remainingConflictCount: args.remainingConflictCount,
      accepted: args.accepted,
      conflictsResolvedWithBase: args.conflictsResolvedWithBase,
      conflictsResolvedWithInput1: args.conflictsResolvedWithInput1,
      conflictsResolvedWithInput2: args.conflictsResolvedWithInput2,
      conflictsResolvedWithSmartCombination: args.conflictsResolvedWithSmartCombination,
      manuallySolvedConflictCountThatEqualNone: args.manuallySolvedConflictCountThatEqualNone,
      manuallySolvedConflictCountThatEqualSmartCombine: args.manuallySolvedConflictCountThatEqualSmartCombine,
      manuallySolvedConflictCountThatEqualInput1: args.manuallySolvedConflictCountThatEqualInput1,
      manuallySolvedConflictCountThatEqualInput2: args.manuallySolvedConflictCountThatEqualInput2,
      manuallySolvedConflictCountThatEqualNoneAndStartedWithBase: args.manuallySolvedConflictCountThatEqualNoneAndStartedWithBase,
      manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1: args.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1,
      manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2: args.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2,
      manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart: args.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart,
      manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart: args.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart
    });
  }
  reportAcceptInvoked(inputNumber, otherAccepted) {
    this.telemetryService.publicLog2("mergeEditor.action.accept", {
      otherAccepted,
      isInput1: inputNumber === 1
    });
  }
  reportSmartCombinationInvoked(otherAccepted) {
    this.telemetryService.publicLog2("mergeEditor.action.smartCombination", {
      otherAccepted
    });
  }
  reportRemoveInvoked(inputNumber, otherAccepted) {
    this.telemetryService.publicLog2("mergeEditor.action.remove", {
      otherAccepted,
      isInput1: inputNumber === 1
    });
  }
  reportResetToBaseInvoked() {
    this.telemetryService.publicLog2("mergeEditor.action.resetToBase", {});
  }
  reportNavigationToNextConflict() {
    this.telemetryService.publicLog2("mergeEditor.action.goToNextConflict", {});
  }
  reportNavigationToPreviousConflict() {
    this.telemetryService.publicLog2("mergeEditor.action.goToPreviousConflict", {});
  }
  reportConflictCounterClicked() {
    this.telemetryService.publicLog2("mergeEditor.action.conflictCounterClicked", {});
  }
};
MergeEditorTelemetry = __decorateClass([
  __decorateParam(0, ITelemetryService)
], MergeEditorTelemetry);
export {
  MergeEditorTelemetry
};
