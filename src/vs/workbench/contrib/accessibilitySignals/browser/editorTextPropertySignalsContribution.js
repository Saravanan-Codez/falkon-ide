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
import { disposableTimeout } from "../../../../base/common/async.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, observableFromEvent, observableFromPromise, observableFromValueWithChangeEvent, observableSignalFromEvent, wasEventTriggeredRecently } from "../../../../base/common/observable.js";
import { isDefined } from "../../../../base/common/types.js";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { CursorChangeReason } from "../../../../editor/common/cursorEvents.js";
import { FoldingController } from "../../../../editor/contrib/folding/browser/folding.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IDebugService } from "../../debug/common/debug.js";
let EditorTextPropertySignalsContribution = class extends Disposable {
  constructor(_editorService, _instantiationService, _accessibilitySignalService) {
    super();
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._textProperties = [
      this._instantiationService.createInstance(MarkerTextProperty, AccessibilitySignal.errorAtPosition, AccessibilitySignal.errorOnLine, MarkerSeverity.Error),
      this._instantiationService.createInstance(MarkerTextProperty, AccessibilitySignal.warningAtPosition, AccessibilitySignal.warningOnLine, MarkerSeverity.Warning),
      this._instantiationService.createInstance(FoldedAreaTextProperty),
      this._instantiationService.createInstance(BreakpointTextProperty)
    ];
    this._someAccessibilitySignalIsEnabled = derived(
      this,
      (reader) => this._textProperties.flatMap((p) => [p.lineSignal, p.positionSignal]).filter(isDefined).some((signal) => observableFromValueWithChangeEvent(this, this._accessibilitySignalService.getEnabledState(signal, false)).read(reader))
    );
    this._activeEditorObservable = observableFromEvent(
      this,
      this._editorService.onDidActiveEditorChange,
      (_) => {
        const activeTextEditorControl = this._editorService.activeTextEditorControl;
        const editor = isDiffEditor(activeTextEditorControl) ? activeTextEditorControl.getOriginalEditor() : isCodeEditor(activeTextEditorControl) ? activeTextEditorControl : void 0;
        return editor && editor.hasModel() ? { editor, model: editor.getModel() } : void 0;
      }
    );
    this._register(autorunWithStore((reader, store) => {
      if (!this._someAccessibilitySignalIsEnabled.read(reader)) {
        return;
      }
      const activeEditor = this._activeEditorObservable.read(reader);
      if (activeEditor) {
        this._registerAccessibilitySignalsForEditor(activeEditor.editor, activeEditor.model, store);
      }
    }));
  }
  _registerAccessibilitySignalsForEditor(editor, editorModel, store) {
    let lastLine = -1;
    const ignoredLineSignalsForCurrentLine = /* @__PURE__ */ new Set();
    const timeouts = store.add(new DisposableStore());
    const propertySources = this._textProperties.map((p) => ({ source: p.createSource(editor, editorModel), property: p }));
    const didType = wasEventTriggeredRecently(editor.onDidChangeModelContent, 100, store);
    store.add(editor.onDidChangeCursorPosition((args) => {
      timeouts.clear();
      if (args && args.reason !== CursorChangeReason.Explicit && args.reason !== CursorChangeReason.NotSet) {
        ignoredLineSignalsForCurrentLine.clear();
        return;
      }
      const trigger = (property, source, mode) => {
        const signal = mode === "line" ? property.lineSignal : property.positionSignal;
        if (!signal || !this._accessibilitySignalService.getEnabledState(signal, false).value || !source.isPresent(position, mode, void 0)) {
          return;
        }
        for (const modality of ["sound", "announcement"]) {
          if (this._accessibilitySignalService.getEnabledState(signal, false, modality).value) {
            const delay = this._accessibilitySignalService.getDelayMs(signal, modality, mode) + (didType.get() ? 1e3 : 0);
            timeouts.add(disposableTimeout(() => {
              if (source.isPresent(position, mode, void 0)) {
                if (!(mode === "line") || !ignoredLineSignalsForCurrentLine.has(property)) {
                  this._accessibilitySignalService.playSignal(signal, { modality });
                }
                ignoredLineSignalsForCurrentLine.add(property);
              }
            }, delay));
          }
        }
      };
      const position = args.position;
      const lineNumber = position.lineNumber;
      if (lineNumber !== lastLine) {
        ignoredLineSignalsForCurrentLine.clear();
        lastLine = lineNumber;
        for (const p of propertySources) {
          trigger(p.property, p.source, "line");
        }
      }
      for (const p of propertySources) {
        trigger(p.property, p.source, "positional");
      }
      for (const s of propertySources) {
        if (![s.property.lineSignal, s.property.positionSignal].some((s2) => s2 && this._accessibilitySignalService.getEnabledState(s2, false).value)) {
          return;
        }
        let lastValueAtPosition = void 0;
        let lastValueOnLine = void 0;
        timeouts.add(autorun((reader) => {
          const newValueAtPosition = s.source.isPresentAtPosition(args.position, reader);
          const newValueOnLine = s.source.isPresentOnLine(args.position.lineNumber, reader);
          if (lastValueAtPosition !== void 0 && lastValueAtPosition !== void 0) {
            if (!lastValueAtPosition && newValueAtPosition) {
              trigger(s.property, s.source, "positional");
            }
            if (!lastValueOnLine && newValueOnLine) {
              trigger(s.property, s.source, "line");
            }
          }
          lastValueAtPosition = newValueAtPosition;
          lastValueOnLine = newValueOnLine;
        }));
      }
    }));
  }
};
EditorTextPropertySignalsContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IAccessibilitySignalService)
], EditorTextPropertySignalsContribution);
class TextPropertySource {
  static {
    this.notPresent = new TextPropertySource({ isPresentAtPosition: () => false, isPresentOnLine: () => false });
  }
  constructor(options) {
    this.isPresentOnLine = options.isPresentOnLine;
    this.isPresentAtPosition = options.isPresentAtPosition ?? (() => false);
  }
  isPresent(position, mode, reader) {
    return mode === "line" ? this.isPresentOnLine(position.lineNumber, reader) : this.isPresentAtPosition(position, reader);
  }
}
let MarkerTextProperty = class {
  constructor(positionSignal, lineSignal, severity, markerService) {
    this.positionSignal = positionSignal;
    this.lineSignal = lineSignal;
    this.severity = severity;
    this.markerService = markerService;
    this.debounceWhileTyping = true;
  }
  createSource(editor, model) {
    const obs = observableSignalFromEvent("onMarkerChanged", this.markerService.onMarkerChanged);
    return new TextPropertySource({
      isPresentAtPosition: (position, reader) => {
        obs.read(reader);
        const hasMarker = this.markerService.read({ resource: model.uri }).some(
          (m) => m.severity === this.severity && m.startLineNumber <= position.lineNumber && position.lineNumber <= m.endLineNumber && m.startColumn <= position.column && position.column <= m.endColumn
        );
        return hasMarker;
      },
      isPresentOnLine: (lineNumber, reader) => {
        obs.read(reader);
        const hasMarker = this.markerService.read({ resource: model.uri }).some(
          (m) => m.severity === this.severity && m.startLineNumber <= lineNumber && lineNumber <= m.endLineNumber
        );
        return hasMarker;
      }
    });
  }
};
MarkerTextProperty = __decorateClass([
  __decorateParam(3, IMarkerService)
], MarkerTextProperty);
class FoldedAreaTextProperty {
  constructor() {
    this.lineSignal = AccessibilitySignal.foldedArea;
  }
  createSource(editor, _model) {
    const foldingController = FoldingController.get(editor);
    if (!foldingController) {
      return TextPropertySource.notPresent;
    }
    const foldingModel = observableFromPromise(foldingController.getFoldingModel() ?? Promise.resolve(void 0));
    return new TextPropertySource({
      isPresentOnLine(lineNumber, reader) {
        const m = foldingModel.read(reader);
        const regionAtLine = m.value?.getRegionAtLine(lineNumber);
        const hasFolding = !regionAtLine ? false : regionAtLine.isCollapsed && regionAtLine.startLineNumber === lineNumber;
        return hasFolding;
      }
    });
  }
}
let BreakpointTextProperty = class {
  constructor(debugService) {
    this.debugService = debugService;
    this.lineSignal = AccessibilitySignal.break;
  }
  createSource(editor, model) {
    const signal = observableSignalFromEvent("onDidChangeBreakpoints", this.debugService.getModel().onDidChangeBreakpoints);
    const debugService = this.debugService;
    return new TextPropertySource({
      isPresentOnLine(lineNumber, reader) {
        signal.read(reader);
        const breakpoints = debugService.getModel().getBreakpoints({ uri: model.uri, lineNumber });
        const hasBreakpoints = breakpoints.length > 0;
        return hasBreakpoints;
      }
    });
  }
};
BreakpointTextProperty = __decorateClass([
  __decorateParam(0, IDebugService)
], BreakpointTextProperty);
export {
  EditorTextPropertySignalsContribution
};
