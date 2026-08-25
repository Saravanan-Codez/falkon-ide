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
import { $, n } from "../../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { KeybindingLabel, unthemedKeybindingLabelOptions } from "../../../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { constObservable, derived, observableFromEvent, observableFromPromise, observableValue } from "../../../../../../../base/common/observable.js";
import { OS } from "../../../../../../../base/common/platform.js";
import { localize } from "../../../../../../../nls.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { editorHoverForeground } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { contrastBorder } from "../../../../../../../platform/theme/common/colors/baseColors.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { LineSource, renderLines, RenderOptions } from "../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { Point } from "../../../../../../common/core/2d/point.js";
import { Rect } from "../../../../../../common/core/2d/rect.js";
import { StringReplacement } from "../../../../../../common/core/edits/stringEdit.js";
import { OffsetRange } from "../../../../../../common/core/ranges/offsetRange.js";
import { ILanguageService } from "../../../../../../common/languages/language.js";
import { LineTokens, TokenArray } from "../../../../../../common/tokens/lineTokens.js";
import { inlineSuggestCommitAlternativeActionId } from "../../../controller/commandIds.js";
import { InlineEditClickEvent } from "../inlineEditsViewInterface.js";
import { getEditorBackgroundColor, getModifiedBorderColor, getOriginalBorderColor, INLINE_EDITS_BORDER_RADIUS, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorPrimaryBorder, inlineEditIndicatorPrimaryForeground, modifiedChangedTextOverlayColor, observeColor, originalChangedTextOverlayColor } from "../theme.js";
import { getEditorValidOverlayRect, mapOutFalsy, rectToProps } from "../utils/utils.js";
import { IUserInteractionService } from "../../../../../../../platform/userInteraction/browser/userInteractionService.js";
class WordReplacementsViewData {
  constructor(edit, editorType, alternativeAction) {
    this.edit = edit;
    this.editorType = editorType;
    this.alternativeAction = alternativeAction;
  }
  equals(other) {
    return this.edit.equals(other.edit) && this.alternativeAction === other.alternativeAction;
  }
}
const BORDER_WIDTH = 1;
const DOM_ID_OVERLAY = "word-replacement-view-overlay";
const DOM_ID_WIDGET = "word-replacement-view-widget";
const DOM_ID_REPLACEMENT = "word-replacement-view-replacement";
const DOM_ID_RENAME = "word-replacement-view-rename";
let InlineEditsWordReplacementView = class extends Disposable {
  constructor(_editor, _viewData, _tabAction, _languageService, _themeService, _keybindingService, _hoverService, _userInteractionService) {
    super();
    this._editor = _editor;
    this._viewData = _viewData;
    this._tabAction = _tabAction;
    this._languageService = _languageService;
    this._themeService = _themeService;
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this._userInteractionService = _userInteractionService;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._start = this._editor.observePosition(constObservable(this._viewData.edit.range.getStartPosition()), this._store);
    this._end = this._editor.observePosition(constObservable(this._viewData.edit.range.getEndPosition()), this._store);
    this._line = document.createElement("div");
    this._primaryElement = observableValue(this, null);
    this._secondaryElement = observableValue(this, null);
    this.isHovered = derived(this, (reader) => {
      const elem = this._primaryElement.read(reader);
      if (!elem) {
        return false;
      }
      return this._userInteractionService.createHoverTracker(elem.element, reader.store).read(reader);
    });
    this._renderTextEffect = derived(this, (_reader) => {
      const tm = this._editor.model.read(void 0);
      if (!tm) {
        return;
      }
      const origLine = tm.getLineContent(this._viewData.edit.range.startLineNumber);
      const edit = StringReplacement.replace(new OffsetRange(this._viewData.edit.range.startColumn - 1, this._viewData.edit.range.endColumn - 1), this._viewData.edit.text);
      const lineToTokenize = edit.replace(origLine);
      const t = tm.tokenization.tokenizeLinesAt(this._viewData.edit.range.startLineNumber, [lineToTokenize])?.[0];
      let tokens;
      if (t) {
        tokens = TokenArray.fromLineTokens(t).slice(edit.getRangeAfterReplace()).toLineTokens(this._viewData.edit.text, this._languageService.languageIdCodec);
      } else {
        tokens = LineTokens.createEmpty(this._viewData.edit.text, this._languageService.languageIdCodec);
      }
      const res = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor.editor).withSetWidth(false).withScrollBeyondLastColumn(0), [], this._line, true);
      this._line.style.width = `${res.minWidthInPx}px`;
    });
    const modifiedLineHeight = this._editor.observeLineHeightForPosition(this._viewData.edit.range.getStartPosition());
    const altCount = observableFromPromise(this._viewData.alternativeAction?.count ?? new Promise((resolve) => resolve(void 0))).map((c) => c.value);
    const altModifierActive = derived(this, (reader) => this._userInteractionService.readModifierKeyStatus(this._editor.editor.getDomNode(), reader).shiftKey);
    this._layout = derived(this, (reader) => {
      this._renderTextEffect.read(reader);
      const widgetStart = this._start.read(reader);
      const widgetEnd = this._end.read(reader);
      if (!widgetStart || !widgetEnd || widgetStart.x > widgetEnd.x || widgetStart.y > widgetEnd.y) {
        return void 0;
      }
      const lineHeight = modifiedLineHeight.read(reader);
      if (lineHeight <= 0) {
        return void 0;
      }
      const scrollLeft = this._editor.scrollLeft.read(reader);
      const w = this._editor.getOption(EditorOption.fontInfo).read(reader).typicalHalfwidthCharacterWidth;
      const modifiedLeftOffset = 3 * w;
      const modifiedTopOffset = 4;
      const modifiedOffset = new Point(modifiedLeftOffset, modifiedTopOffset);
      let alternativeAction = void 0;
      if (this._viewData.alternativeAction) {
        const label = this._viewData.alternativeAction.label;
        const count = altCount.read(reader);
        const active = altModifierActive.read(reader);
        const occurrencesLabel = count !== void 0 ? count === 1 ? localize("labelOccurence", "{0} 1 occurrence", label) : localize("labelOccurences", "{0} {1} occurrences", label, count) : label;
        const keybindingTooltip = localize("shiftToSeeOccurences", "{0} show occurrences", "[shift]");
        alternativeAction = {
          label: count !== void 0 ? active ? occurrencesLabel : label : label,
          tooltip: occurrencesLabel ? `${occurrencesLabel}
${keybindingTooltip}` : void 0,
          icon: void 0,
          //this._viewData.alternativeAction.icon, Do not render icon fo the moment
          count,
          keybinding: this._keybindingService.lookupKeybinding(inlineSuggestCommitAlternativeActionId),
          active: altModifierActive
        };
      }
      const originalLine = Rect.fromPoints(widgetStart, widgetEnd).withHeight(lineHeight).translateX(-scrollLeft);
      const codeLine = Rect.fromPointSize(originalLine.getLeftBottom().add(modifiedOffset), new Point(this._viewData.edit.text.length * w, originalLine.height));
      const modifiedLine = codeLine.withWidth(codeLine.width + (alternativeAction ? alternativeAction.label.length * w + 8 + 4 + 12 : 0));
      const lowerBackground = modifiedLine.withLeft(originalLine.left);
      return {
        alternativeAction,
        originalLine,
        codeLine,
        modifiedLine,
        lowerBackground,
        lineHeight
      };
    });
    this.minEditorScrollHeight = derived(this, (reader) => {
      const layout = mapOutFalsy(this._layout).read(reader);
      if (!layout) {
        return 0;
      }
      return layout.read(reader).modifiedLine.bottom + BORDER_WIDTH + this._editor.editor.getScrollTop();
    });
    this._root = n.div({
      class: "word-replacement"
    }, [
      derived(this, (reader) => {
        const layout = mapOutFalsy(this._layout).read(reader);
        if (!layout) {
          return [];
        }
        const originalBorderColor = getOriginalBorderColor(this._tabAction).map((c) => asCssVariable(c)).read(reader);
        const modifiedBorderColor = getModifiedBorderColor(this._tabAction).map((c) => asCssVariable(c)).read(reader);
        this._line.style.lineHeight = `${layout.read(reader).modifiedLine.height + 2 * BORDER_WIDTH}px`;
        const secondaryElementHovered = constObservable(false);
        const alternativeAction = layout.map((l) => l.alternativeAction);
        const alternativeActionActive = derived((reader2) => (alternativeAction.read(reader2)?.active.read(reader2) ?? false) || secondaryElementHovered.read(reader2));
        const isHighContrast = observableFromEvent(this._themeService.onDidColorThemeChange, () => {
          const theme = this._themeService.getColorTheme();
          return theme.type === "hcDark" || theme.type === "hcLight";
        }).read(reader);
        const hcBorderColor = isHighContrast ? observeColor(contrastBorder, this._themeService).read(reader) : null;
        const primaryActiveStyles = {
          borderColor: hcBorderColor ? hcBorderColor.toString() : modifiedBorderColor,
          backgroundColor: asCssVariable(modifiedChangedTextOverlayColor),
          color: "",
          opacity: "1"
        };
        const secondaryActiveStyles = {
          borderColor: hcBorderColor ? hcBorderColor.toString() : asCssVariable(inlineEditIndicatorPrimaryBorder),
          backgroundColor: asCssVariable(inlineEditIndicatorPrimaryBackground),
          color: asCssVariable(inlineEditIndicatorPrimaryForeground),
          opacity: "1"
        };
        const passiveStyles = {
          borderColor: hcBorderColor ? hcBorderColor.toString() : observeColor(editorHoverForeground, this._themeService).map((c) => c.transparent(0.2).toString()).read(reader),
          backgroundColor: getEditorBackgroundColor(this._viewData.editorType),
          color: "",
          opacity: "0.7"
        };
        const editorBackground = getEditorBackgroundColor(this._viewData.editorType);
        const primaryActionStyles = derived(this, (r) => alternativeActionActive.read(r) ? primaryActiveStyles : primaryActiveStyles);
        const secondaryActionStyles = derived(this, (r) => alternativeActionActive.read(r) ? secondaryActiveStyles : passiveStyles);
        return [
          n.div({
            id: DOM_ID_OVERLAY,
            style: {
              position: "absolute",
              ...rectToProps((r) => getEditorValidOverlayRect(this._editor).read(r)),
              overflow: "hidden",
              pointerEvents: "none"
            }
          }, [
            n.div({
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).lowerBackground.withMargin(BORDER_WIDTH, 2 * BORDER_WIDTH, BORDER_WIDTH, 0)),
                background: editorBackground,
                cursor: "pointer",
                pointerEvents: "auto"
              },
              onmousedown: (e) => this._mouseDown(e)
            }),
            n.div({
              id: DOM_ID_WIDGET,
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).modifiedLine.withMargin(BORDER_WIDTH, 2 * BORDER_WIDTH)),
                width: void 0,
                pointerEvents: "auto",
                boxSizing: "border-box",
                borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
                background: editorBackground,
                display: "flex",
                justifyContent: "left",
                outline: `2px solid ${editorBackground}`
              },
              onmousedown: (e) => this._mouseDown(e)
            }, [
              n.div({
                id: DOM_ID_REPLACEMENT,
                style: {
                  fontFamily: this._editor.getOption(EditorOption.fontFamily),
                  fontSize: this._editor.getOption(EditorOption.fontSize),
                  fontWeight: this._editor.getOption(EditorOption.fontWeight),
                  width: rectToProps((reader2) => layout.read(reader2).codeLine.withMargin(BORDER_WIDTH, 2 * BORDER_WIDTH)).width,
                  borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
                  border: primaryActionStyles.map((s) => `${BORDER_WIDTH}px solid ${s.borderColor}`),
                  boxSizing: "border-box",
                  padding: `${BORDER_WIDTH}px`,
                  opacity: primaryActionStyles.map((s) => s.opacity),
                  background: primaryActionStyles.map((s) => s.backgroundColor),
                  display: "flex",
                  justifyContent: "left",
                  alignItems: "center",
                  pointerEvents: "auto",
                  cursor: "pointer"
                },
                obsRef: (elem) => {
                  this._primaryElement.set(elem, void 0);
                }
              }, [this._line]),
              derived(this, (reader2) => {
                const altAction = alternativeAction.read(reader2);
                if (!altAction) {
                  return void 0;
                }
                const keybinding = document.createElement("div");
                const keybindingLabel = reader2.store.add(new KeybindingLabel(keybinding, OS, { ...unthemedKeybindingLabelOptions, disableTitle: true }));
                keybindingLabel.set(altAction.keybinding);
                return n.div({
                  id: DOM_ID_RENAME,
                  style: {
                    position: "relative",
                    borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
                    borderTop: `${BORDER_WIDTH}px solid`,
                    borderRight: `${BORDER_WIDTH}px solid`,
                    borderBottom: `${BORDER_WIDTH}px solid`,
                    borderLeft: `${BORDER_WIDTH}px solid`,
                    borderColor: secondaryActionStyles.map((s) => s.borderColor),
                    opacity: secondaryActionStyles.map((s) => s.opacity),
                    color: secondaryActionStyles.map((s) => s.color),
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "0 4px 0 1px",
                    marginLeft: "4px",
                    background: secondaryActionStyles.map((s) => s.backgroundColor),
                    cursor: "pointer",
                    textWrap: "nowrap"
                  },
                  class: "inline-edit-alternative-action-label",
                  obsRef: (elem) => {
                    this._secondaryElement.set(elem, void 0);
                  },
                  ref: (elem) => {
                    if (altAction.tooltip) {
                      reader2.store.add(this._hoverService.setupDelayedHoverAtMouse(elem, { content: altAction.tooltip, appearance: { compact: true } }));
                    }
                  }
                }, [
                  keybinding,
                  $("div.inline-edit-alternative-action-label-separator"),
                  altAction.icon ? renderIcon(altAction.icon) : void 0,
                  altAction.label
                ]);
              })
            ]),
            n.div({
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).originalLine.withMargin(BORDER_WIDTH)),
                boxSizing: "border-box",
                borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
                border: `${BORDER_WIDTH}px solid ${originalBorderColor}`,
                background: asCssVariable(originalChangedTextOverlayColor),
                pointerEvents: "none"
              }
            }, []),
            n.svg({
              width: 11,
              height: 14,
              viewBox: "0 0 11 14",
              fill: "none",
              style: {
                position: "absolute",
                left: layout.map((l) => l.modifiedLine.left - 16),
                top: layout.map((l) => l.modifiedLine.top + Math.round((l.lineHeight - 14 - 5) / 2)),
                pointerEvents: "none"
              },
              onmousedown: (e) => this._mouseDown(e)
            }, [
              n.svgElem("path", {
                d: "M1 0C1 2.98966 1 5.92087 1 8.49952C1 9.60409 1.89543 10.5 3 10.5H10.5",
                stroke: asCssVariable(editorHoverForeground)
              }),
              n.svgElem("path", {
                d: "M6 7.5L9.99999 10.49998L6 13.5",
                stroke: asCssVariable(editorHoverForeground)
              })
            ])
          ])
        ];
      })
    ]).keepUpdated(this._store);
    this._register(this._editor.createOverlayWidget({
      domNode: this._root.element,
      minContentWidthInPx: constObservable(0),
      position: constObservable({ preference: { top: 0, left: 0 } }),
      allowEditorOverflow: false
    }));
  }
  static {
    this.MAX_LENGTH = 100;
  }
  _mouseDown(e) {
    const target_id = traverseParentsUntilId(e.target, /* @__PURE__ */ new Set([DOM_ID_WIDGET, DOM_ID_REPLACEMENT, DOM_ID_RENAME, DOM_ID_OVERLAY]));
    if (!target_id) {
      return;
    }
    e.preventDefault();
    this._onDidClick.fire(InlineEditClickEvent.create(e, target_id === DOM_ID_RENAME));
  }
};
InlineEditsWordReplacementView = __decorateClass([
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IUserInteractionService)
], InlineEditsWordReplacementView);
function traverseParentsUntilId(element, ids) {
  let current = element;
  while (current) {
    if (ids.has(current.id)) {
      return current.id;
    }
    current = current.parentElement;
  }
  return null;
}
export {
  InlineEditsWordReplacementView,
  WordReplacementsViewData
};
