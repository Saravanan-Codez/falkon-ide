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
import { CachedFunction } from "../../../../../base/common/cache.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, mapObservableArrayCached, derived, observableValue, derivedWithSetter, observableFromEvent } from "../../../../../base/common/observable.js";
import { DynamicCssRules } from "../../../../../editor/browser/editorDom.js";
import { observableCodeEditor } from "../../../../../editor/browser/observableCodeEditor.js";
import { CodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IStatusbarService, StatusbarAlignment } from "../../../../services/statusbar/browser/statusbar.js";
import { EditSourceTrackingImpl } from "./editSourceTrackingImpl.js";
import { DataChannelForwardingTelemetryService } from "../../../../../platform/dataChannel/browser/forwardingTelemetryService.js";
import { EDIT_TELEMETRY_DETAILS_SETTING_ID, EDIT_TELEMETRY_SHOW_DECORATIONS, EDIT_TELEMETRY_SHOW_STATUS_BAR } from "../settings.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { AgentHostEditMarkerService } from "./agentHostEditMarkerService.js";
let EditTrackingFeature = class extends Disposable {
  constructor(_workspace, _annotatedDocuments, _configurationService, _instantiationService, _statusbarService, _editorService, _extensionService) {
    super();
    this._workspace = _workspace;
    this._annotatedDocuments = _annotatedDocuments;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._statusbarService = _statusbarService;
    this._editorService = _editorService;
    this._extensionService = _extensionService;
    this._showStateInMarkdownDoc = "editTelemetry.showDebugDetails";
    this._toggleDecorations = "editTelemetry.toggleDebugDecorations";
    this._editSourceTrackingShowDecorations = makeSettable(observableConfigValue(EDIT_TELEMETRY_SHOW_DECORATIONS, false, this._configurationService));
    this._editSourceTrackingShowStatusBar = observableConfigValue(EDIT_TELEMETRY_SHOW_STATUS_BAR, false, this._configurationService);
    const editSourceDetailsEnabled = observableConfigValue(EDIT_TELEMETRY_DETAILS_SETTING_ID, false, this._configurationService);
    const extensions = observableFromEvent(this._extensionService.onDidChangeExtensions, () => {
      return this._extensionService.extensions;
    });
    const extensionIds = derived((reader) => new Set(extensions.read(reader).map((e) => e.identifier.value.toLowerCase())));
    function getExtensionInfoObs(extensionId) {
      const extIdLowerCase = extensionId.toLowerCase();
      return derived((reader) => extensionIds.read(reader).has(extIdLowerCase));
    }
    const copilotInstalled = getExtensionInfoObs("GitHub.copilot");
    const copilotChatInstalled = getExtensionInfoObs("GitHub.copilot-chat");
    const shouldSendDetails = derived((reader) => editSourceDetailsEnabled.read(reader) || !!copilotInstalled.read(reader) || !!copilotChatInstalled.read(reader));
    const instantiationServiceWithInterceptedTelemetry = this._instantiationService.createChild(new ServiceCollection(
      [ITelemetryService, this._instantiationService.createInstance(DataChannelForwardingTelemetryService)]
    ));
    const markerService = this._register(instantiationServiceWithInterceptedTelemetry.createInstance(AgentHostEditMarkerService));
    const impl = this._register(instantiationServiceWithInterceptedTelemetry.createInstance(EditSourceTrackingImpl, shouldSendDetails, this._annotatedDocuments, markerService));
    this._register(autorun((reader) => {
      if (!this._editSourceTrackingShowDecorations.read(reader)) {
        return;
      }
      const visibleEditors = observableFromEvent(this, this._editorService.onDidVisibleEditorsChange, () => this._editorService.visibleTextEditorControls);
      mapObservableArrayCached(this, visibleEditors, (editor, store) => {
        if (editor instanceof CodeEditorWidget) {
          const obsEditor = observableCodeEditor(editor);
          const cssStyles = new DynamicCssRules(editor);
          const decorations = new CachedFunction((source) => {
            const r = store.add(cssStyles.createClassNameRef({
              backgroundColor: source.getColor()
            }));
            return r.className;
          });
          store.add(obsEditor.setDecorations(derived((reader2) => {
            const uri = obsEditor.model.read(reader2)?.uri;
            if (!uri) {
              return [];
            }
            const doc = this._workspace.getDocument(uri);
            if (!doc) {
              return [];
            }
            const docsState = impl.docsState.read(reader2).get(doc);
            if (!docsState) {
              return [];
            }
            const ranges = docsState.longtermTracker.read(reader2)?.getTrackedRanges(reader2) ?? [];
            return ranges.map((r) => ({
              range: doc.value.read(void 0).getTransformer().getRange(r.range),
              options: {
                description: "editSourceTracking",
                inlineClassName: decorations.get(r.source)
              }
            }));
          })));
        }
      }).recomputeInitiallyAndOnChange(reader.store);
    }));
    this._register(autorun((reader) => {
      if (!this._editSourceTrackingShowStatusBar.read(reader)) {
        return;
      }
      const statusBarItem = reader.store.add(this._statusbarService.addEntry(
        {
          name: "",
          text: "",
          command: this._showStateInMarkdownDoc,
          tooltip: "Edit Source Tracking",
          ariaLabel: ""
        },
        "editTelemetry",
        StatusbarAlignment.RIGHT,
        100
      ));
      const sumChangedCharacters = derived((reader2) => {
        const docs = impl.docsState.read(reader2);
        let sum = 0;
        for (const state of docs.values()) {
          const t = state.longtermTracker.read(reader2);
          if (!t) {
            continue;
          }
          const d = state.getTelemetryData(t.getTrackedRanges(reader2));
          sum += d.totalModifiedCharactersInFinalState;
        }
        return sum;
      });
      const tooltipMarkdownString = derived((reader2) => {
        const docs = impl.docsState.read(reader2);
        const docsDataInTooltip = [];
        const editSources = [];
        for (const [doc, state] of docs) {
          const tracker = state.longtermTracker.read(reader2);
          if (!tracker) {
            continue;
          }
          const trackedRanges = tracker.getTrackedRanges(reader2);
          const data = state.getTelemetryData(trackedRanges);
          if (data.totalModifiedCharactersInFinalState === 0) {
            continue;
          }
          editSources.push(...trackedRanges.map((r) => r.source));
          const filteredData = Object.fromEntries(
            Object.entries(data).filter(([_, value]) => !(typeof value === "number") || value !== 0)
          );
          docsDataInTooltip.push([
            `### ${doc.uri.fsPath}`,
            "```json",
            JSON.stringify(filteredData, void 0, "	"),
            "```",
            "\n"
          ].join("\n"));
        }
        let tooltipContent;
        if (docsDataInTooltip.length === 0) {
          tooltipContent = "No modified documents";
        } else if (docsDataInTooltip.length <= 3) {
          tooltipContent = docsDataInTooltip.join("\n\n");
        } else {
          const lastThree = docsDataInTooltip.slice(-3);
          tooltipContent = "...\n\n" + lastThree.join("\n\n");
        }
        const agenda = this._createEditSourceAgenda(editSources);
        const tooltipWithCommand = new MarkdownString(tooltipContent + "\n\n[View Details](command:" + this._showStateInMarkdownDoc + ")");
        tooltipWithCommand.appendMarkdown("\n\n" + agenda + "\n\nToggle decorations: [Click here](command:" + this._toggleDecorations + ")");
        tooltipWithCommand.isTrusted = { enabledCommands: [this._toggleDecorations] };
        tooltipWithCommand.supportHtml = true;
        return tooltipWithCommand;
      });
      reader.store.add(autorun((reader2) => {
        statusBarItem.update({
          name: "editTelemetry",
          text: `$(edit) ${sumChangedCharacters.read(reader2)} chars inserted`,
          ariaLabel: `Edit Source Tracking: ${sumChangedCharacters.read(reader2)} modified characters`,
          tooltip: tooltipMarkdownString.read(reader2),
          command: this._showStateInMarkdownDoc
        });
      }));
      reader.store.add(CommandsRegistry.registerCommand(this._toggleDecorations, () => {
        this._editSourceTrackingShowDecorations.set(!this._editSourceTrackingShowDecorations.read(void 0), void 0);
      }));
    }));
  }
  _createEditSourceAgenda(editSources) {
    const editSourcesSeen = /* @__PURE__ */ new Set();
    const editSourceInfo = [];
    for (const editSource of editSources) {
      if (!editSourcesSeen.has(editSource.toString())) {
        editSourcesSeen.add(editSource.toString());
        editSourceInfo.push({ name: editSource.toString(), color: editSource.getColor() });
      }
    }
    const agendaItems = editSourceInfo.map(
      (info) => `<span style="background-color:${info.color};border-radius:3px;">${info.name}</span>`
    );
    return agendaItems.join(" ");
  }
};
EditTrackingFeature = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IStatusbarService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IExtensionService)
], EditTrackingFeature);
function makeSettable(obs) {
  const overrideObs = observableValue("overrideObs", void 0);
  return derivedWithSetter(overrideObs, (reader) => {
    return overrideObs.read(reader) ?? obs.read(reader);
  }, (value, tx) => {
    overrideObs.set(value, tx);
  });
}
export {
  EditTrackingFeature
};
