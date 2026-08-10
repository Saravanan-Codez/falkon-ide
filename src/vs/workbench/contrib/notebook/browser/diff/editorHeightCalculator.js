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
import { UnchangedRegion } from "../../../../../editor/browser/widget/diffEditor/diffEditorViewModel.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { getEditorPadding } from "./diffCellEditorOptions.js";
import { HeightOfHiddenLinesRegionInDiffEditor } from "./diffElementViewModel.js";
let DiffEditorHeightCalculatorService = class {
  constructor(lineHeight, textModelResolverService, editorWorkerService, configurationService) {
    this.lineHeight = lineHeight;
    this.textModelResolverService = textModelResolverService;
    this.editorWorkerService = editorWorkerService;
    this.configurationService = configurationService;
  }
  async diffAndComputeHeight(original, modified) {
    const [originalModel, modifiedModel] = await Promise.all([this.textModelResolverService.createModelReference(original), this.textModelResolverService.createModelReference(modified)]);
    try {
      const diffChanges = await this.editorWorkerService.computeDiff(original, modified, {
        ignoreTrimWhitespace: true,
        maxComputationTimeMs: 0,
        computeMoves: false
      }, "advanced").then((diff) => diff?.changes || []);
      const unchangedRegionFeatureEnabled = this.configurationService.getValue("diffEditor.hideUnchangedRegions.enabled");
      const minimumLineCount = this.configurationService.getValue("diffEditor.hideUnchangedRegions.minimumLineCount");
      const contextLineCount = this.configurationService.getValue("diffEditor.hideUnchangedRegions.contextLineCount");
      const originalLineCount = originalModel.object.textEditorModel.getLineCount();
      const modifiedLineCount = modifiedModel.object.textEditorModel.getLineCount();
      const unchanged = unchangedRegionFeatureEnabled ? UnchangedRegion.fromDiffs(
        diffChanges,
        originalLineCount,
        modifiedLineCount,
        minimumLineCount ?? 3,
        contextLineCount ?? 3
      ) : [];
      const numberOfNewLines = diffChanges.reduce((prev, curr) => {
        if (curr.original.isEmpty && !curr.modified.isEmpty) {
          return prev + curr.modified.length;
        }
        if (!curr.original.isEmpty && !curr.modified.isEmpty && curr.modified.length > curr.original.length) {
          return prev + curr.modified.length - curr.original.length;
        }
        return prev;
      }, 0);
      const orginalNumberOfLines = originalModel.object.textEditorModel.getLineCount();
      const numberOfHiddenLines = unchanged.reduce((prev, curr) => prev + curr.lineCount, 0);
      const numberOfHiddenSections = unchanged.length;
      const unchangeRegionsHeight = numberOfHiddenSections * HeightOfHiddenLinesRegionInDiffEditor;
      const visibleLineCount = orginalNumberOfLines + numberOfNewLines - numberOfHiddenLines;
      return visibleLineCount * this.lineHeight + getEditorPadding(visibleLineCount).top + getEditorPadding(visibleLineCount).bottom + unchangeRegionsHeight;
    } finally {
      originalModel.dispose();
      modifiedModel.dispose();
    }
  }
  computeHeightFromLines(lineCount) {
    return lineCount * this.lineHeight + getEditorPadding(lineCount).top + getEditorPadding(lineCount).bottom;
  }
};
DiffEditorHeightCalculatorService = __decorateClass([
  __decorateParam(1, ITextModelService),
  __decorateParam(2, IEditorWorkerService),
  __decorateParam(3, IConfigurationService)
], DiffEditorHeightCalculatorService);
export {
  DiffEditorHeightCalculatorService
};
