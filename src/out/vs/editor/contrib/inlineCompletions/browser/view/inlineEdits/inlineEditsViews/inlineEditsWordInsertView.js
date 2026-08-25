import { n } from "../../../../../../../base/browser/dom.js";
import { Event } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { constObservable, derived } from "../../../../../../../base/common/observable.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { Point } from "../../../../../../common/core/2d/point.js";
import { Rect } from "../../../../../../common/core/2d/rect.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/ranges/offsetRange.js";
import { getModifiedBorderColor, INLINE_EDITS_BORDER_RADIUS } from "../theme.js";
import { mapOutFalsy, rectToProps } from "../utils/utils.js";
class InlineEditsWordInsertView extends Disposable {
  constructor(_editor, _edit, _tabAction) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._tabAction = _tabAction;
    this.onDidClick = Event.None;
    this._start = this._editor.observePosition(constObservable(this._edit.range.getStartPosition()), this._store);
    this._layout = derived(this, (reader) => {
      const start = this._start.read(reader);
      if (!start) {
        return void 0;
      }
      const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
      const lineHeight = this._editor.observeLineHeightForPosition(this._edit.range.getStartPosition()).read(reader);
      const w = this._editor.getOption(EditorOption.fontInfo).read(reader).typicalHalfwidthCharacterWidth;
      const width = this._edit.text.length * w + 5;
      const center = new Point(contentLeft + start.x + w / 2 - this._editor.scrollLeft.read(reader), start.y);
      const modified = Rect.fromLeftTopWidthHeight(center.x - width / 2, center.y + lineHeight + 5, width, lineHeight);
      const background = Rect.hull([Rect.fromPoint(center), modified]).withMargin(4);
      return {
        modified,
        center,
        background,
        lowerBackground: background.intersectVertical(new OffsetRange(modified.top - 2, Number.MAX_SAFE_INTEGER))
      };
    });
    this._div = n.div({
      class: "word-insert"
    }, [
      derived(this, (reader) => {
        const layout = mapOutFalsy(this._layout).read(reader);
        if (!layout) {
          return [];
        }
        const modifiedBorderColor = asCssVariable(getModifiedBorderColor(this._tabAction).read(reader));
        return [
          n.div({
            style: {
              position: "absolute",
              ...rectToProps((reader2) => layout.read(reader2).lowerBackground),
              borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
              background: "var(--vscode-editor-background)"
            }
          }, []),
          n.div({
            style: {
              position: "absolute",
              ...rectToProps((reader2) => layout.read(reader2).modified),
              borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
              padding: "0px",
              textAlign: "center",
              background: "var(--vscode-inlineEdit-modifiedChangedTextBackground)",
              fontFamily: this._editor.getOption(EditorOption.fontFamily),
              fontSize: this._editor.getOption(EditorOption.fontSize),
              fontWeight: this._editor.getOption(EditorOption.fontWeight)
            }
          }, [
            this._edit.text
          ]),
          n.div({
            style: {
              position: "absolute",
              ...rectToProps((reader2) => layout.read(reader2).background),
              borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
              border: `1px solid ${modifiedBorderColor}`,
              //background: 'rgba(122, 122, 122, 0.12)', looks better
              background: "var(--vscode-inlineEdit-wordReplacementView-background)"
            }
          }, []),
          n.svg({
            viewBox: "0 0 12 18",
            width: 12,
            height: 18,
            fill: "none",
            style: {
              position: "absolute",
              left: derived(this, (reader2) => layout.read(reader2).center.x - 9),
              top: derived(this, (reader2) => layout.read(reader2).center.y + 4),
              transform: "scale(1.4, 1.4)"
            }
          }, [
            n.svgElem("path", {
              d: "M5.06445 0H7.35759C7.35759 0 7.35759 8.47059 7.35759 11.1176C7.35759 13.7647 9.4552 18 13.4674 18C17.4795 18 -2.58445 18 0.281373 18C3.14719 18 5.06477 14.2941 5.06477 11.1176C5.06477 7.94118 5.06445 0 5.06445 0Z",
              fill: "var(--vscode-inlineEdit-modifiedChangedTextBackground)"
            })
          ])
        ];
      })
    ]).keepUpdated(this._store);
    this.isHovered = constObservable(false);
    this._register(this._editor.createOverlayWidget({
      domNode: this._div.element,
      minContentWidthInPx: constObservable(0),
      position: constObservable({ preference: { top: 0, left: 0 } }),
      allowEditorOverflow: false
    }));
  }
}
export {
  InlineEditsWordInsertView
};
