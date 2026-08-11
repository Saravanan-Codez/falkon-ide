import { getWindow, addDisposableListener, n } from "../../../../base/browser/dom.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { autorun, derived, disposableObservableValue, observableValue } from "../../../../base/common/observable.js";
import { observableCodeEditor } from "../../../browser/observableCodeEditor.js";
import { Point } from "../../../common/core/2d/point.js";
import { AnimationFrameScheduler } from "../../../../base/browser/animatedValue.js";
import { appendRemoveOnDispose } from "../../../browser/widget/diffEditor/utils.js";
import "./middleScroll.css";
class MiddleScrollController extends Disposable {
  constructor(_editor) {
    super();
    this._editor = _editor;
    const obsEditor = observableCodeEditor(this._editor);
    const scrollOnMiddleClick = obsEditor.getOption(EditorOption.scrollOnMiddleClick);
    this._register(autorun((reader) => {
      if (!scrollOnMiddleClick.read(reader)) {
        return;
      }
      const editorDomNode = obsEditor.domNode.read(reader);
      if (!editorDomNode) {
        return;
      }
      const scrollingSession = reader.store.add(
        disposableObservableValue(
          "scrollingSession",
          void 0
        )
      );
      reader.store.add(this._editor.onMouseDown((e) => {
        const session = scrollingSession.read(void 0);
        if (session) {
          scrollingSession.set(void 0, void 0);
          return;
        }
        if (!e.event.middleButton) {
          return;
        }
        e.event.stopPropagation();
        e.event.preventDefault();
        const store = new DisposableStore();
        const initialPos = new Point(e.event.posx, e.event.posy);
        const mousePos = observeWindowMousePos(getWindow(editorDomNode), initialPos, store);
        const mouseDeltaAfterThreshold = mousePos.map((v) => v.subtract(initialPos).withThreshold(5));
        const editorDomNodeRect = editorDomNode.getBoundingClientRect();
        const initialMousePosInEditor = new Point(initialPos.x - editorDomNodeRect.left, initialPos.y - editorDomNodeRect.top);
        scrollingSession.set({
          mouseDeltaAfterThreshold,
          initialMousePosInEditor,
          didScroll: false,
          dispose: () => store.dispose()
        }, void 0);
        store.add(this._editor.onMouseUp((e2) => {
          const session2 = scrollingSession.read(void 0);
          if (session2 && session2.didScroll) {
            scrollingSession.set(void 0, void 0);
          }
        }));
        store.add(this._editor.onKeyDown((e2) => {
          scrollingSession.set(void 0, void 0);
        }));
      }));
      reader.store.add(autorun((reader2) => {
        const session = scrollingSession.read(reader2);
        if (!session) {
          return;
        }
        let lastTime = Date.now();
        reader2.store.add(autorun((reader3) => {
          AnimationFrameScheduler.instance.invalidateOnNextAnimationFrame(reader3);
          const curTime = Date.now();
          const frameDurationMs = curTime - lastTime;
          lastTime = curTime;
          const mouseDelta = session.mouseDeltaAfterThreshold.read(void 0);
          const factor = frameDurationMs / 32;
          const scrollDelta = mouseDelta.scale(factor);
          const scrollPos = new Point(this._editor.getScrollLeft(), this._editor.getScrollTop());
          this._editor.setScrollPosition(toScrollPosition(scrollPos.add(scrollDelta)));
          if (!scrollDelta.isZero()) {
            session.didScroll = true;
          }
        }));
        const directionAttr = derived((reader3) => {
          const delta = session.mouseDeltaAfterThreshold.read(reader3);
          let direction = "";
          direction += delta.y < 0 ? "n" : delta.y > 0 ? "s" : "";
          direction += delta.x < 0 ? "w" : delta.x > 0 ? "e" : "";
          return direction;
        });
        reader2.store.add(autorun((reader3) => {
          editorDomNode.setAttribute("data-scroll-direction", directionAttr.read(reader3));
        }));
      }));
      const dotDomElem = reader.store.add(n.div({
        class: ["scroll-editor-on-middle-click-dot", scrollingSession.map((session) => session ? "" : "hidden")],
        style: {
          left: scrollingSession.map((session) => session ? session.initialMousePosInEditor.x : 0),
          top: scrollingSession.map((session) => session ? session.initialMousePosInEditor.y : 0)
        }
      }).toDisposableLiveElement());
      reader.store.add(appendRemoveOnDispose(editorDomNode, dotDomElem.element));
      reader.store.add(autorun((reader2) => {
        const session = scrollingSession.read(reader2);
        editorDomNode.classList.toggle("scroll-editor-on-middle-click-editor", !!session);
      }));
    }));
  }
  static {
    this.ID = "editor.contrib.middleScroll";
  }
  static get(editor) {
    return editor.getContribution(MiddleScrollController.ID);
  }
}
function observeWindowMousePos(window, initialPos, store) {
  const val = observableValue("pos", initialPos);
  store.add(addDisposableListener(window, "mousemove", (e) => {
    val.set(new Point(e.pageX, e.pageY), void 0);
  }));
  return val;
}
function toScrollPosition(p) {
  return {
    scrollLeft: p.x,
    scrollTop: p.y
  };
}
export {
  MiddleScrollController
};
