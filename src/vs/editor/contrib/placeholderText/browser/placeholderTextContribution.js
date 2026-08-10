import { h } from "../../../../base/browser/dom.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, constObservable, derivedObservableWithCache, derivedOpts, derived } from "../../../../base/common/observable.js";
import { observableCodeEditor } from "../../../browser/observableCodeEditor.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
class PlaceholderTextContribution extends Disposable {
  constructor(_editor) {
    super();
    this._editor = _editor;
    this._editorObs = observableCodeEditor(this._editor);
    this._placeholderText = this._editorObs.getOption(EditorOption.placeholder);
    this._state = derivedOpts({ owner: this, equalsFn: structuralEquals }, (reader) => {
      const p = this._placeholderText.read(reader);
      if (!p) {
        return void 0;
      }
      if (!this._editorObs.valueIsEmpty.read(reader)) {
        return void 0;
      }
      return { placeholder: p };
    });
    this._shouldViewBeAlive = isOrWasTrue(this, (reader) => this._state.read(reader)?.placeholder !== void 0);
    this._view = derived((reader) => {
      if (!this._shouldViewBeAlive.read(reader)) {
        return;
      }
      const element = h("div.editorPlaceholder");
      reader.store.add(autorun((reader2) => {
        const data = this._state.read(reader2);
        const shouldBeVisibile = data?.placeholder !== void 0;
        element.root.style.display = shouldBeVisibile ? "block" : "none";
        element.root.innerText = data?.placeholder ?? "";
      }));
      reader.store.add(autorun((reader2) => {
        const info = this._editorObs.layoutInfo.read(reader2);
        element.root.style.left = `${info.contentLeft}px`;
        element.root.style.width = info.contentWidth - info.verticalScrollbarWidth + "px";
        element.root.style.top = `${this._editor.getTopForLineNumber(0)}px`;
      }));
      reader.store.add(autorun((reader2) => {
        element.root.style.fontFamily = this._editorObs.getOption(EditorOption.fontFamily).read(reader2);
        element.root.style.fontSize = this._editorObs.getOption(EditorOption.fontSize).read(reader2) + "px";
        element.root.style.lineHeight = this._editorObs.getOption(EditorOption.lineHeight).read(reader2) + "px";
      }));
      reader.store.add(this._editorObs.createOverlayWidget({
        allowEditorOverflow: false,
        minContentWidthInPx: constObservable(0),
        position: constObservable(null),
        domNode: element.root
      }));
    });
    this._view.recomputeInitiallyAndOnChange(this._store);
  }
  static get(editor) {
    return editor.getContribution(PlaceholderTextContribution.ID);
  }
  static {
    this.ID = "editor.contrib.placeholderText";
  }
}
function isOrWasTrue(owner, fn) {
  return derivedObservableWithCache(owner, (reader, lastValue) => {
    if (lastValue === true) {
      return true;
    }
    return fn(reader);
  });
}
export {
  PlaceholderTextContribution
};
