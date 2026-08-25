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
import { derived, derivedConstOnceDefined, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { Constants } from "../../../../base/common/uint.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { diffEditorDefaultOptions } from "../../../common/config/diffEditor.js";
import { clampedFloat, clampedInt, boolean as validateBooleanOption, stringSet as validateStringSetOption } from "../../../common/config/editorOptions.js";
import { allowsTrueInlineDiffRendering } from "./components/diffEditorViewZones/diffEditorViewZones.js";
let DiffEditorOptions = class {
  constructor(options, _accessibilityService) {
    this._accessibilityService = _accessibilityService;
    this._diffEditorWidth = observableValue(this, 0);
    this._screenReaderMode = observableFromEvent(this, this._accessibilityService.onDidChangeScreenReaderOptimized, () => this._accessibilityService.isScreenReaderOptimized());
    this.couldShowInlineViewBecauseOfSize = derived(
      this,
      (reader) => this._options.read(reader).renderSideBySide && this._diffEditorWidth.read(reader) <= this._options.read(reader).renderSideBySideInlineBreakpoint
    );
    this.renderOverviewRuler = derived(this, (reader) => this._options.read(reader).renderOverviewRuler);
    this.renderSideBySide = derived(this, (reader) => {
      if (this.compactMode.read(reader)) {
        if (this.shouldRenderInlineViewInSmartMode.read(reader)) {
          return false;
        }
      }
      return this._options.read(reader).renderSideBySide && !(this._options.read(reader).useInlineViewWhenSpaceIsLimited && this.couldShowInlineViewBecauseOfSize.read(reader) && !this._screenReaderMode.read(reader));
    });
    this.readOnly = derived(this, (reader) => this._options.read(reader).readOnly);
    this.shouldRenderOldRevertArrows = derived(this, (reader) => {
      if (!this._options.read(reader).renderMarginRevertIcon) {
        return false;
      }
      if (!this.renderSideBySide.read(reader)) {
        return false;
      }
      if (this.readOnly.read(reader)) {
        return false;
      }
      if (this.shouldRenderGutterMenu.read(reader)) {
        return false;
      }
      return true;
    });
    this.shouldRenderGutterMenu = derived(this, (reader) => this._options.read(reader).renderGutterMenu);
    this.renderIndicators = derived(this, (reader) => this._options.read(reader).renderIndicators);
    this.enableSplitViewResizing = derived(this, (reader) => this._options.read(reader).enableSplitViewResizing);
    this.splitViewDefaultRatio = derived(this, (reader) => this._options.read(reader).splitViewDefaultRatio);
    this.ignoreTrimWhitespace = derived(this, (reader) => this._options.read(reader).ignoreTrimWhitespace);
    this.maxComputationTimeMs = derived(this, (reader) => this._options.read(reader).maxComputationTime);
    this.showMoves = derived(this, (reader) => this._options.read(reader).experimental.showMoves && this.renderSideBySide.read(reader));
    this.isInEmbeddedEditor = derived(this, (reader) => this._options.read(reader).isInEmbeddedEditor);
    this.diffWordWrap = derived(this, (reader) => this._options.read(reader).diffWordWrap);
    this.originalEditable = derived(this, (reader) => this._options.read(reader).originalEditable);
    this.diffCodeLens = derived(this, (reader) => this._options.read(reader).diffCodeLens);
    this.accessibilityVerbose = derived(this, (reader) => this._options.read(reader).accessibilityVerbose);
    this.diffAlgorithm = derived(this, (reader) => this._options.read(reader).diffAlgorithm);
    this.showEmptyDecorations = derived(this, (reader) => this._options.read(reader).experimental.showEmptyDecorations);
    this.onlyShowAccessibleDiffViewer = derived(this, (reader) => this._options.read(reader).onlyShowAccessibleDiffViewer);
    this.compactMode = derived(this, (reader) => this._options.read(reader).compactMode);
    this.trueInlineDiffRenderingEnabled = derived(
      this,
      (reader) => this._options.read(reader).experimental.useTrueInlineView
    );
    this.useTrueInlineDiffRendering = derived(
      this,
      (reader) => !this.renderSideBySide.read(reader) && this.trueInlineDiffRenderingEnabled.read(reader)
    );
    this.hideUnchangedRegions = derived(this, (reader) => this._options.read(reader).hideUnchangedRegions.enabled);
    this.hideUnchangedRegionsRevealLineCount = derived(this, (reader) => this._options.read(reader).hideUnchangedRegions.revealLineCount);
    this.hideUnchangedRegionsContextLineCount = derived(this, (reader) => this._options.read(reader).hideUnchangedRegions.contextLineCount);
    this.hideUnchangedRegionsMinimumLineCount = derived(this, (reader) => this._options.read(reader).hideUnchangedRegions.minimumLineCount);
    this._model = observableValue(this, void 0);
    this.shouldRenderInlineViewInSmartMode = this._model.map(this, (model) => derivedConstOnceDefined(this, (reader) => {
      const diffs = model?.diff.read(reader);
      return diffs ? isSimpleDiff(diffs, this.trueInlineDiffRenderingEnabled.read(reader)) : void 0;
    })).flatten().map(this, (v) => !!v);
    this.inlineViewHideOriginalLineNumbers = derived(this, (reader) => this._options.read(reader).hideOriginalLineNumbers || this.compactMode.read(reader));
    const optionsCopy = { ...options, ...validateDiffEditorOptions(options, diffEditorDefaultOptions) };
    this._options = observableValue(this, optionsCopy);
  }
  get editorOptions() {
    return this._options;
  }
  updateOptions(changedOptions) {
    const newDiffEditorOptions = validateDiffEditorOptions(changedOptions, this._options.get());
    const newOptions = { ...this._options.get(), ...changedOptions, ...newDiffEditorOptions };
    this._options.set(newOptions, void 0, { changedOptions });
  }
  setWidth(width) {
    this._diffEditorWidth.set(width, void 0);
  }
  setModel(model) {
    this._model.set(model, void 0);
  }
};
DiffEditorOptions = __decorateClass([
  __decorateParam(1, IAccessibilityService)
], DiffEditorOptions);
function isSimpleDiff(diff, supportsTrueDiffRendering) {
  return diff.mappings.every((m) => isInsertion(m.lineRangeMapping) || isDeletion(m.lineRangeMapping) || supportsTrueDiffRendering && allowsTrueInlineDiffRendering(m.lineRangeMapping));
}
function isInsertion(mapping) {
  return mapping.original.length === 0;
}
function isDeletion(mapping) {
  return mapping.modified.length === 0;
}
function validateDiffEditorOptions(options, defaults) {
  return {
    enableSplitViewResizing: validateBooleanOption(options.enableSplitViewResizing, defaults.enableSplitViewResizing),
    splitViewDefaultRatio: clampedFloat(options.splitViewDefaultRatio, 0.5, 0.1, 0.9),
    renderSideBySide: validateBooleanOption(options.renderSideBySide, defaults.renderSideBySide),
    renderMarginRevertIcon: validateBooleanOption(options.renderMarginRevertIcon, defaults.renderMarginRevertIcon),
    maxComputationTime: clampedInt(options.maxComputationTime, defaults.maxComputationTime, 0, Constants.MAX_SAFE_SMALL_INTEGER),
    maxFileSize: clampedInt(options.maxFileSize, defaults.maxFileSize, 0, Constants.MAX_SAFE_SMALL_INTEGER),
    ignoreTrimWhitespace: validateBooleanOption(options.ignoreTrimWhitespace, defaults.ignoreTrimWhitespace),
    renderIndicators: validateBooleanOption(options.renderIndicators, defaults.renderIndicators),
    originalEditable: validateBooleanOption(options.originalEditable, defaults.originalEditable),
    diffCodeLens: validateBooleanOption(options.diffCodeLens, defaults.diffCodeLens),
    renderOverviewRuler: validateBooleanOption(options.renderOverviewRuler, defaults.renderOverviewRuler),
    diffWordWrap: validateStringSetOption(options.diffWordWrap, defaults.diffWordWrap, ["off", "on", "inherit"]),
    diffAlgorithm: validateStringSetOption(options.diffAlgorithm, defaults.diffAlgorithm, ["legacy", "advanced", "advanced-external", "advanced-wasm"], { "smart": "legacy", "experimental": "advanced" }),
    accessibilityVerbose: validateBooleanOption(options.accessibilityVerbose, defaults.accessibilityVerbose),
    experimental: {
      showMoves: validateBooleanOption(options.experimental?.showMoves, defaults.experimental.showMoves),
      showEmptyDecorations: validateBooleanOption(options.experimental?.showEmptyDecorations, defaults.experimental.showEmptyDecorations),
      useTrueInlineView: validateBooleanOption(options.experimental?.useTrueInlineView, defaults.experimental.useTrueInlineView)
    },
    hideUnchangedRegions: {
      // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
      enabled: validateBooleanOption(options.hideUnchangedRegions?.enabled ?? options.experimental?.collapseUnchangedRegions, defaults.hideUnchangedRegions.enabled),
      contextLineCount: clampedInt(options.hideUnchangedRegions?.contextLineCount, defaults.hideUnchangedRegions.contextLineCount, 0, Constants.MAX_SAFE_SMALL_INTEGER),
      minimumLineCount: clampedInt(options.hideUnchangedRegions?.minimumLineCount, defaults.hideUnchangedRegions.minimumLineCount, 0, Constants.MAX_SAFE_SMALL_INTEGER),
      revealLineCount: clampedInt(options.hideUnchangedRegions?.revealLineCount, defaults.hideUnchangedRegions.revealLineCount, 0, Constants.MAX_SAFE_SMALL_INTEGER)
    },
    isInEmbeddedEditor: validateBooleanOption(options.isInEmbeddedEditor, defaults.isInEmbeddedEditor),
    onlyShowAccessibleDiffViewer: validateBooleanOption(options.onlyShowAccessibleDiffViewer, defaults.onlyShowAccessibleDiffViewer),
    renderSideBySideInlineBreakpoint: clampedInt(options.renderSideBySideInlineBreakpoint, defaults.renderSideBySideInlineBreakpoint, 0, Constants.MAX_SAFE_SMALL_INTEGER),
    useInlineViewWhenSpaceIsLimited: validateBooleanOption(options.useInlineViewWhenSpaceIsLimited, defaults.useInlineViewWhenSpaceIsLimited),
    renderGutterMenu: validateBooleanOption(options.renderGutterMenu, defaults.renderGutterMenu),
    compactMode: validateBooleanOption(options.compactMode, defaults.compactMode),
    hideOriginalLineNumbers: validateBooleanOption(options.hideOriginalLineNumbers, defaults.hideOriginalLineNumbers)
  };
}
export {
  DiffEditorOptions
};
