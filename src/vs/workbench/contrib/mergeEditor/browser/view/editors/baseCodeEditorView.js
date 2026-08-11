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
import { h, reset } from "../../../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { BugIndicatingError } from "../../../../../../base/common/errors.js";
import { autorun, autorunWithStore, derived } from "../../../../../../base/common/observable.js";
import { MinimapPosition, OverviewRulerLane } from "../../../../../../editor/common/model.js";
import { localize } from "../../../../../../nls.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { applyObservableDecorations } from "../../utils.js";
import { handledConflictMinimapOverViewRulerColor, unhandledConflictMinimapOverViewRulerColor } from "../colors.js";
import { EditorGutter } from "../editorGutter.js";
import { CodeEditorView, TitleMenu, createSelectionsAutorun } from "./codeEditorView.js";
let BaseCodeEditorView = class extends CodeEditorView {
  constructor(viewModel, instantiationService, configurationService) {
    super(instantiationService, viewModel, configurationService);
    this.decorations = derived(this, (reader) => {
      const viewModel = this.viewModel.read(reader);
      if (!viewModel) {
        return [];
      }
      const model = viewModel.model;
      const textModel = model.base;
      const activeModifiedBaseRange = viewModel.activeModifiedBaseRange.read(reader);
      const showNonConflictingChanges = viewModel.showNonConflictingChanges.read(reader);
      const showDeletionMarkers = this.showDeletionMarkers.read(reader);
      const result = [];
      for (const modifiedBaseRange of model.modifiedBaseRanges.read(reader)) {
        const range = modifiedBaseRange.baseRange;
        if (!range) {
          continue;
        }
        const isHandled = model.isHandled(modifiedBaseRange).read(reader);
        if (!modifiedBaseRange.isConflicting && isHandled && !showNonConflictingChanges) {
          continue;
        }
        const blockClassNames = ["merge-editor-block"];
        let blockPadding = [0, 0, 0, 0];
        if (isHandled) {
          blockClassNames.push("handled");
        }
        if (modifiedBaseRange === activeModifiedBaseRange) {
          blockClassNames.push("focused");
          blockPadding = [0, 2, 0, 2];
        }
        blockClassNames.push("base");
        const inputToDiffAgainst = viewModel.baseShowDiffAgainst.read(reader);
        if (inputToDiffAgainst) {
          for (const diff of modifiedBaseRange.getInputDiffs(inputToDiffAgainst)) {
            const range2 = diff.inputRange.toInclusiveRange();
            if (range2) {
              result.push({
                range: range2,
                options: {
                  className: `merge-editor-diff base`,
                  description: "Merge Editor",
                  isWholeLine: true
                }
              });
            }
            for (const diff2 of diff.rangeMappings) {
              if (showDeletionMarkers || !diff2.inputRange.isEmpty()) {
                result.push({
                  range: diff2.inputRange,
                  options: {
                    className: diff2.inputRange.isEmpty() ? `merge-editor-diff-empty-word base` : `merge-editor-diff-word base`,
                    description: "Merge Editor",
                    showIfCollapsed: true
                  }
                });
              }
            }
          }
        }
        result.push({
          range: range.toInclusiveRangeOrEmpty(),
          options: {
            showIfCollapsed: true,
            blockClassName: blockClassNames.join(" "),
            blockPadding,
            blockIsAfterEnd: range.startLineNumber > textModel.getLineCount(),
            description: "Merge Editor",
            minimap: {
              position: MinimapPosition.Gutter,
              color: { id: isHandled ? handledConflictMinimapOverViewRulerColor : unhandledConflictMinimapOverViewRulerColor }
            },
            overviewRuler: modifiedBaseRange.isConflicting ? {
              position: OverviewRulerLane.Center,
              color: { id: isHandled ? handledConflictMinimapOverViewRulerColor : unhandledConflictMinimapOverViewRulerColor }
            } : void 0
          }
        });
      }
      return result;
    });
    this._register(
      createSelectionsAutorun(this, (baseRange, viewModel2) => baseRange)
    );
    this._register(
      instantiationService.createInstance(TitleMenu, MenuId.MergeBaseToolbar, this.htmlElements.title)
    );
    this._register(
      autorunWithStore((reader, store) => {
        if (this.checkboxesVisible.read(reader)) {
          store.add(new EditorGutter(this.editor, this.htmlElements.gutterDiv, {
            getIntersectingGutterItems: (range, reader2) => [],
            createView: (item, target) => {
              throw new BugIndicatingError();
            }
          }));
        }
      })
    );
    this._register(
      autorun((reader) => {
        const vm = this.viewModel.read(reader);
        if (!vm) {
          return;
        }
        this.editor.setModel(vm.model.base);
        reset(this.htmlElements.title, ...renderLabelWithIcons(localize("base", "Base")));
        const baseShowDiffAgainst = vm.baseShowDiffAgainst.read(reader);
        let node = void 0;
        if (baseShowDiffAgainst) {
          const label = localize("compareWith", "Comparing with {0}", baseShowDiffAgainst === 1 ? vm.model.input1.title : vm.model.input2.title);
          const tooltip = localize("compareWithTooltip", "Differences are highlighted with a background color.");
          node = h("span", { title: tooltip }, [label]).root;
        }
        reset(this.htmlElements.description, ...node ? [node] : []);
      })
    );
    this._register(applyObservableDecorations(this.editor, this.decorations));
  }
};
BaseCodeEditorView = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService)
], BaseCodeEditorView);
export {
  BaseCodeEditorView
};
