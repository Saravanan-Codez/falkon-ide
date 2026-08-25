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
import { Event, Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableFromEvent } from "../../../../base/common/observable.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { CellKind, NotebookCellExecutionState } from "../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../common/notebookExecutionStateService.js";
import { getAllOutputsText } from "./viewModel/cellOutputTextHelper.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
let NotebookAccessibilityProvider = class extends Disposable {
  constructor(viewModel, isReplHistory, notebookExecutionStateService, keybindingService, configurationService, accessibilityService) {
    super();
    this.viewModel = viewModel;
    this.isReplHistory = isReplHistory;
    this.notebookExecutionStateService = notebookExecutionStateService;
    this.keybindingService = keybindingService;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this._onDidAriaLabelChange = this._register(new Emitter());
    this.onDidAriaLabelChange = this._onDidAriaLabelChange.event;
    this._register(Event.debounce(
      this.notebookExecutionStateService.onDidChangeExecution,
      (last, e) => this.mergeEvents(last, e),
      100
    )((updates) => {
      if (!updates.length) {
        return;
      }
      const viewModel2 = this.viewModel();
      if (viewModel2) {
        for (const update of updates) {
          const cellModel = viewModel2.getCellByHandle(update.cellHandle);
          if (cellModel) {
            this._onDidAriaLabelChange.fire(cellModel);
          }
        }
        const lastUpdate = updates[updates.length - 1];
        if (this.shouldReadCellOutputs(lastUpdate.state)) {
          const cell = viewModel2.getCellByHandle(lastUpdate.cellHandle);
          if (cell && cell.outputsViewModels.length) {
            const text = getAllOutputsText(viewModel2.notebookDocument, cell, true);
            alert(text);
          }
        }
      }
    }, this));
  }
  shouldReadCellOutputs(state) {
    return state === void 0 && this.isReplHistory && this.accessibilityService.isScreenReaderOptimized() && this.configurationService.getValue("accessibility.replEditor.readLastExecutionOutput");
  }
  get verbositySettingId() {
    return this.isReplHistory ? AccessibilityVerbositySettingId.ReplEditor : AccessibilityVerbositySettingId.Notebook;
  }
  getAriaLabel(element) {
    const event = Event.filter(this.onDidAriaLabelChange, (e) => e === element);
    return observableFromEvent(this, event, () => {
      const viewModel = this.viewModel();
      if (!viewModel) {
        return "";
      }
      const index = viewModel.getCellIndex(element);
      if (index >= 0) {
        return this.getLabel(element);
      }
      return "";
    });
  }
  createItemLabel(executionLabel, cellKind) {
    return this.isReplHistory ? `cell${executionLabel}` : `${cellKind === CellKind.Markup ? "markdown" : "code"} cell${executionLabel}`;
  }
  getLabel(element) {
    const executionState = this.notebookExecutionStateService.getCellExecution(element.uri)?.state;
    const executionLabel = executionState === NotebookCellExecutionState.Executing ? ", executing" : executionState === NotebookCellExecutionState.Pending ? ", pending" : "";
    return this.createItemLabel(executionLabel, element.cellKind);
  }
  get widgetAriaLabelName() {
    return this.isReplHistory ? nls.localize("replHistoryTreeAriaLabel", "REPL Editor History") : nls.localize("notebookTreeAriaLabel", "Notebook");
  }
  getWidgetAriaLabel() {
    const keybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
    if (this.configurationService.getValue(this.verbositySettingId)) {
      return keybinding ? nls.localize("notebookTreeAriaLabelHelp", "{0}\nUse {1} for accessibility help", this.widgetAriaLabelName, keybinding) : nls.localize("notebookTreeAriaLabelHelpNoKb", "{0}\nRun the Open Accessibility Help command for more information", this.widgetAriaLabelName);
    }
    return this.widgetAriaLabelName;
  }
  mergeEvents(last, e) {
    const viewModel = this.viewModel();
    const result = last || [];
    if (viewModel && e.type === NotebookExecutionType.cell && e.affectsNotebook(viewModel.uri)) {
      const index = result.findIndex((update) => update.cellHandle === e.cellHandle);
      if (index >= 0) {
        result.splice(index, 1);
      }
      result.push({ cellHandle: e.cellHandle, state: e.changed?.state });
    }
    return result;
  }
};
NotebookAccessibilityProvider = __decorateClass([
  __decorateParam(2, INotebookExecutionStateService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IAccessibilityService)
], NotebookAccessibilityProvider);
export {
  NotebookAccessibilityProvider
};
